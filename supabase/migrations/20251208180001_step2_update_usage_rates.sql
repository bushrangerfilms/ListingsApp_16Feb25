-- Phase 3.1 Step 2: Update usage_rates to support fractional credits
-- RUN THIS AFTER Step 1 (enum values) has been committed
-- 
-- IMPORTANT: This script DROPS and RECREATES functions.
-- There will be a brief moment where these functions don't exist.
-- Run during low-traffic period if possible.

-- ============================================================================
-- STEP 1: DROP existing functions (required to change return types)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_feature_cost(public.feature_type);
DROP FUNCTION IF EXISTS public.sp_consume_credits(uuid, public.feature_type, integer, uuid, text, text, jsonb);

-- ============================================================================
-- STEP 2: Alter credits_per_use column to NUMERIC
-- ============================================================================
ALTER TABLE public.usage_rates 
  ALTER COLUMN credits_per_use TYPE NUMERIC(10,2) USING credits_per_use::NUMERIC(10,2);

-- ============================================================================
-- STEP 3: Update existing usage rates to target values
-- ============================================================================
UPDATE public.usage_rates SET credits_per_use = 25, updated_at = now() WHERE feature_type = 'video_generation';
UPDATE public.usage_rates SET credits_per_use = 2, updated_at = now() WHERE feature_type = 'post_generation';
UPDATE public.usage_rates SET credits_per_use = 0.5, updated_at = now() WHERE feature_type = 'ai_assistant';
-- image_enhancement stays at 5 (no change needed)

-- ============================================================================
-- STEP 4: Insert new feature types
-- ============================================================================
INSERT INTO public.usage_rates (feature_type, credits_per_use, description, is_active)
VALUES 
  ('property_extraction', 10, 'AI extraction of property details from documents/images', true),
  ('email_send', 0.2, 'Send an automated email', true)
ON CONFLICT (feature_type) DO UPDATE SET
  credits_per_use = EXCLUDED.credits_per_use,
  description = EXCLUDED.description,
  updated_at = now();

-- ============================================================================
-- STEP 5: Recreate get_feature_cost function with NUMERIC return type
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_feature_cost(
  p_feature_type public.feature_type
)
RETURNS NUMERIC(10,2)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_cost NUMERIC(10,2);
BEGIN
  SELECT credits_per_use INTO v_cost
  FROM public.usage_rates
  WHERE feature_type = p_feature_type
    AND is_active = true
    AND effective_until IS NULL
  LIMIT 1;

  RETURN COALESCE(v_cost, 0);
END;
$$;

COMMENT ON FUNCTION public.get_feature_cost IS 'Get credit cost for a feature type (supports fractional credits)';

-- ============================================================================
-- STEP 6: Recreate sp_consume_credits with NUMERIC support
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sp_consume_credits(
  p_organization_id uuid,
  p_feature_type public.feature_type,
  p_quantity integer DEFAULT 1,
  p_user_id uuid DEFAULT NULL,
  p_source_app text DEFAULT 'system',
  p_request_id text DEFAULT NULL,
  p_feature_details jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  success boolean,
  new_balance integer,
  credits_consumed integer,
  transaction_id uuid,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost_per_use NUMERIC(10,2);
  v_total_cost_numeric NUMERIC(10,2);
  v_total_cost integer;
  v_current_balance integer;
  v_new_balance integer;
  v_transaction_id uuid;
  v_usage_event_id uuid;
  v_spending_enabled boolean;
  v_account_status text;
BEGIN
  -- ============================================================================
  -- MASTER SWITCH CHECK - Added in Phase 2.5 Trial Lifecycle
  -- ============================================================================
  SELECT credit_spending_enabled, account_status 
  INTO v_spending_enabled, v_account_status
  FROM public.organizations 
  WHERE id = p_organization_id;

  IF v_spending_enabled IS NULL THEN
    RETURN QUERY SELECT 
      false, 0, 0, NULL::uuid, 'Organization not found';
    RETURN;
  END IF;

  IF v_spending_enabled IS NOT TRUE THEN
    RETURN QUERY SELECT 
      false, 0, 0, NULL::uuid, 
      format('CREDIT_SPENDING_DISABLED: Account is in %s mode. Please subscribe or update payment method to restore access.', 
        COALESCE(v_account_status, 'read-only'));
    RETURN;
  END IF;
  -- ============================================================================

  -- Get cost for this feature type (now NUMERIC)
  SELECT credits_per_use INTO v_cost_per_use
  FROM public.usage_rates
  WHERE feature_type = p_feature_type
    AND is_active = true
    AND effective_until IS NULL
  LIMIT 1;

  IF v_cost_per_use IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, NULL::uuid, 'Feature type not found or inactive';
    RETURN;
  END IF;

  -- Calculate total cost with NUMERIC precision, then CEIL to integer
  -- This ensures fractional credits are always rounded UP (fair to platform)
  v_total_cost_numeric := v_cost_per_use * p_quantity;
  v_total_cost := CEIL(v_total_cost_numeric)::integer;

  -- CRITICAL: Lock the organization's balance row to prevent race conditions
  INSERT INTO public.organization_credit_balances (organization_id, balance)
  VALUES (p_organization_id, 0)
  ON CONFLICT (organization_id) DO NOTHING;
  
  SELECT COALESCE(balance, 0) INTO v_current_balance
  FROM public.organization_credit_balances
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  -- Check if sufficient balance
  IF v_current_balance < v_total_cost THEN
    RETURN QUERY SELECT 
      false, 
      v_current_balance, 
      0, 
      NULL::uuid, 
      format('Insufficient credits. Required: %s, Available: %s', v_total_cost, v_current_balance);
    RETURN;
  END IF;

  v_new_balance := v_current_balance - v_total_cost;

  -- Insert debit transaction
  INSERT INTO public.credit_transactions (
    organization_id,
    transaction_type,
    amount,
    balance_after,
    source,
    feature_type,
    description,
    created_by,
    source_app,
    request_id
  ) VALUES (
    p_organization_id,
    'debit',
    v_total_cost,
    v_new_balance,
    NULL,
    p_feature_type,
    format('Consumed %s credits for %s (quantity: %s, rate: %s/use)', 
           v_total_cost, p_feature_type, p_quantity, v_cost_per_use),
    p_user_id,
    p_source_app,
    p_request_id
  )
  RETURNING id INTO v_transaction_id;

  -- Insert usage event for analytics
  INSERT INTO public.credit_usage_events (
    transaction_id,
    organization_id,
    feature_type,
    credits_consumed,
    feature_details,
    user_id,
    source_app
  ) VALUES (
    v_transaction_id,
    p_organization_id,
    p_feature_type,
    v_total_cost,
    p_feature_details,
    p_user_id,
    p_source_app
  )
  RETURNING id INTO v_usage_event_id;

  RETURN QUERY SELECT 
    true, 
    v_new_balance, 
    v_total_cost, 
    v_transaction_id, 
    NULL::text;
END;
$$;

COMMENT ON FUNCTION public.sp_consume_credits IS 'Atomically consume credits with NUMERIC rate support. Uses CEIL for fractional costs. Includes master switch check (Phase 2.5).';

-- ============================================================================
-- STEP 7: Grant execute permissions (match original permissions)
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_feature_cost(public.feature_type) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_feature_cost(public.feature_type) TO service_role;

GRANT EXECUTE ON FUNCTION public.sp_consume_credits(uuid, public.feature_type, integer, uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_consume_credits(uuid, public.feature_type, integer, uuid, text, text, jsonb) TO service_role;

-- ============================================================================
-- VERIFICATION: Run this to confirm changes
-- ============================================================================
SELECT feature_type, credits_per_use, description 
FROM public.usage_rates 
WHERE is_active = true 
ORDER BY feature_type;
