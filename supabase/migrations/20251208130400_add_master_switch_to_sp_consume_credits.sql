-- Phase 2.5: Trial Lifecycle - Add Master Switch check to sp_consume_credits
-- This is the CRITICAL change that gates ALL credit spending based on organization status
-- 
-- IMPORTANT: This migration modifies the existing sp_consume_credits function
-- by adding a check at the very START that verifies credit_spending_enabled = true
-- before allowing any credit consumption.

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
  v_cost_per_use integer;
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
  -- This check gates ALL credit spending based on organization status
  -- ============================================================================
  SELECT credit_spending_enabled, account_status 
  INTO v_spending_enabled, v_account_status
  FROM public.organizations 
  WHERE id = p_organization_id;

  -- If organization not found, deny spending
  IF v_spending_enabled IS NULL THEN
    RETURN QUERY SELECT 
      false, 
      0, 
      0, 
      NULL::uuid, 
      'Organization not found';
    RETURN;
  END IF;

  -- If credit spending is disabled, return clear error message
  IF v_spending_enabled IS NOT TRUE THEN
    RETURN QUERY SELECT 
      false, 
      0, 
      0, 
      NULL::uuid, 
      format('CREDIT_SPENDING_DISABLED: Account is in %s mode. Please subscribe or update payment method to restore access.', 
        COALESCE(v_account_status, 'read-only'));
    RETURN;
  END IF;
  -- ============================================================================
  -- END MASTER SWITCH CHECK
  -- ============================================================================

  -- Get cost for this feature type
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

  -- Calculate total cost
  v_total_cost := v_cost_per_use * p_quantity;

  -- CRITICAL: Lock the organization's balance row to prevent race conditions
  -- Handle first-time balance initialization with race-safe UPSERT
  INSERT INTO public.organization_credit_balances (organization_id, balance)
  VALUES (p_organization_id, 0)
  ON CONFLICT (organization_id) DO NOTHING;
  
  -- Now lock the row (guaranteed to exist after UPSERT)
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

  -- Calculate new balance
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
    format('Consumed %s credits for %s (quantity: %s)', v_total_cost, p_feature_type, p_quantity),
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

  -- Return success
  RETURN QUERY SELECT 
    true, 
    v_new_balance, 
    v_total_cost, 
    v_transaction_id, 
    NULL::text;
END;
$$;

COMMENT ON FUNCTION public.sp_consume_credits IS 'Atomically consume credits with race condition prevention via SELECT FOR UPDATE. Includes master switch check for account lifecycle (Phase 2.5).';
