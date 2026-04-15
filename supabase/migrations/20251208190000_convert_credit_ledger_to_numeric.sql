-- Phase 3.1 Step 3: Convert entire credit ledger to NUMERIC for proper fractional credits
-- This migration enables true fractional credit consumption (e.g., 0.2 credits per email)
--
-- IMPORTANT: Run during low-traffic period. Functions will be briefly unavailable.

-- ============================================================================
-- STEP 1: Drop dependent functions and trigger
-- ============================================================================
DROP TRIGGER IF EXISTS after_credit_transaction_insert ON public.credit_transactions;
DROP FUNCTION IF EXISTS public.update_organization_balance();
DROP FUNCTION IF EXISTS public.sp_consume_credits(uuid, public.feature_type, integer, uuid, text, text, jsonb);
DROP FUNCTION IF EXISTS public.sp_grant_credits(uuid, integer, public.credit_source, text, text, text, text, uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.sp_get_credit_balance(uuid);
DROP FUNCTION IF EXISTS public.get_feature_cost(public.feature_type);

-- ============================================================================
-- STEP 2: Alter credit_transactions table - amount and balance_after to NUMERIC
-- ============================================================================
ALTER TABLE public.credit_transactions 
  ALTER COLUMN amount TYPE NUMERIC(12,2) USING amount::NUMERIC(12,2),
  ALTER COLUMN balance_after TYPE NUMERIC(12,2) USING balance_after::NUMERIC(12,2);

-- Drop and recreate check constraint for amount
ALTER TABLE public.credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_amount_check;
ALTER TABLE public.credit_transactions ADD CONSTRAINT credit_transactions_amount_check CHECK (amount > 0);

-- Drop and recreate check constraint for balance_after  
ALTER TABLE public.credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_balance_after_check;
ALTER TABLE public.credit_transactions ADD CONSTRAINT credit_transactions_balance_after_check CHECK (balance_after >= 0);

-- ============================================================================
-- STEP 3: Alter organization_credit_balances table - balance to NUMERIC
-- ============================================================================
ALTER TABLE public.organization_credit_balances
  ALTER COLUMN balance TYPE NUMERIC(12,2) USING balance::NUMERIC(12,2),
  ALTER COLUMN balance SET DEFAULT 0,
  ALTER COLUMN total_credits_purchased TYPE NUMERIC(12,2) USING total_credits_purchased::NUMERIC(12,2),
  ALTER COLUMN total_credits_consumed TYPE NUMERIC(12,2) USING total_credits_consumed::NUMERIC(12,2);

-- Drop and recreate check constraint for balance
ALTER TABLE public.organization_credit_balances DROP CONSTRAINT IF EXISTS organization_credit_balances_balance_check;
ALTER TABLE public.organization_credit_balances ADD CONSTRAINT organization_credit_balances_balance_check CHECK (balance >= 0);

-- ============================================================================
-- STEP 4: Alter credit_usage_events table - credits_consumed to NUMERIC
-- ============================================================================
ALTER TABLE public.credit_usage_events
  ALTER COLUMN credits_consumed TYPE NUMERIC(12,2) USING credits_consumed::NUMERIC(12,2);

-- Drop and recreate check constraint
ALTER TABLE public.credit_usage_events DROP CONSTRAINT IF EXISTS credit_usage_events_credits_consumed_check;
ALTER TABLE public.credit_usage_events ADD CONSTRAINT credit_usage_events_credits_consumed_check CHECK (credits_consumed > 0);

-- ============================================================================
-- STEP 5: Recreate trigger function with NUMERIC math
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_organization_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance_change NUMERIC(12,2);
BEGIN
  IF NEW.transaction_type = 'credit' THEN
    v_balance_change := NEW.amount;
  ELSE
    v_balance_change := -NEW.amount;
  END IF;

  INSERT INTO public.organization_credit_balances (
    organization_id,
    balance,
    last_transaction_at,
    total_credits_purchased,
    total_credits_consumed,
    transaction_count,
    updated_at
  ) VALUES (
    NEW.organization_id,
    v_balance_change,
    NEW.created_at,
    CASE WHEN NEW.transaction_type = 'credit' THEN NEW.amount ELSE 0 END,
    CASE WHEN NEW.transaction_type = 'debit' THEN NEW.amount ELSE 0 END,
    1,
    now()
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    balance = organization_credit_balances.balance + v_balance_change,
    last_transaction_at = NEW.created_at,
    total_credits_purchased = organization_credit_balances.total_credits_purchased + 
      CASE WHEN NEW.transaction_type = 'credit' THEN NEW.amount ELSE 0 END,
    total_credits_consumed = organization_credit_balances.total_credits_consumed + 
      CASE WHEN NEW.transaction_type = 'debit' THEN NEW.amount ELSE 0 END,
    transaction_count = organization_credit_balances.transaction_count + 1,
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER after_credit_transaction_insert
  AFTER INSERT ON public.credit_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_organization_balance();

-- ============================================================================
-- STEP 6: Recreate get_feature_cost with NUMERIC return
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_feature_cost(
  p_feature_type public.feature_type
)
RETURNS NUMERIC(12,2)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_cost NUMERIC(12,2);
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

COMMENT ON FUNCTION public.get_feature_cost IS 'Get credit cost for a feature type (NUMERIC for fractional credits)';

-- ============================================================================
-- STEP 7: Recreate sp_get_credit_balance with NUMERIC return
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sp_get_credit_balance(
  p_organization_id uuid
)
RETURNS TABLE (
  balance NUMERIC(12,2),
  last_transaction_at timestamptz,
  total_purchased NUMERIC(12,2),
  total_consumed NUMERIC(12,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(ocb.balance, 0::NUMERIC(12,2)) AS balance,
    ocb.last_transaction_at,
    COALESCE(ocb.total_credits_purchased, 0::NUMERIC(12,2)) AS total_purchased,
    COALESCE(ocb.total_credits_consumed, 0::NUMERIC(12,2)) AS total_consumed
  FROM public.organization_credit_balances ocb
  WHERE ocb.organization_id = p_organization_id
  
  UNION ALL
  
  SELECT 0::NUMERIC(12,2), NULL::timestamptz, 0::NUMERIC(12,2), 0::NUMERIC(12,2)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.organization_credit_balances 
    WHERE organization_id = p_organization_id
  )
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.sp_get_credit_balance IS 'Get current credit balance for an organization (NUMERIC for fractional credits)';

-- ============================================================================
-- STEP 8: Recreate sp_grant_credits with NUMERIC amount
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sp_grant_credits(
  p_organization_id uuid,
  p_amount NUMERIC(12,2),
  p_source public.credit_source,
  p_description text DEFAULT NULL,
  p_stripe_event_id text DEFAULT NULL,
  p_stripe_payment_intent_id text DEFAULT NULL,
  p_stripe_checkout_session_id text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_source_app text DEFAULT 'system',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  success boolean,
  new_balance NUMERIC(12,2),
  transaction_id uuid,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC(12,2);
  v_new_balance NUMERIC(12,2);
  v_transaction_id uuid;
BEGIN
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, 0::NUMERIC(12,2), NULL::uuid, 'Amount must be greater than 0';
    RETURN;
  END IF;

  IF p_stripe_event_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.credit_transactions 
      WHERE stripe_event_id = p_stripe_event_id
    ) THEN
      SELECT 
        true,
        ct.balance_after,
        ct.id,
        'Event already processed (idempotent)'::text
      INTO success, new_balance, transaction_id, error_message
      FROM public.credit_transactions ct
      WHERE ct.stripe_event_id = p_stripe_event_id
      LIMIT 1;
      
      RETURN QUERY SELECT success, new_balance, transaction_id, error_message;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.organization_credit_balances (organization_id, balance)
  VALUES (p_organization_id, 0)
  ON CONFLICT (organization_id) DO NOTHING;
  
  SELECT COALESCE(ocb.balance, 0) INTO v_current_balance
  FROM public.organization_credit_balances ocb
  WHERE ocb.organization_id = p_organization_id
  FOR UPDATE;

  v_new_balance := v_current_balance + p_amount;

  INSERT INTO public.credit_transactions (
    organization_id,
    transaction_type,
    amount,
    balance_after,
    source,
    feature_type,
    description,
    stripe_event_id,
    stripe_payment_intent_id,
    stripe_checkout_session_id,
    created_by,
    source_app,
    metadata
  ) VALUES (
    p_organization_id,
    'credit',
    p_amount,
    v_new_balance,
    p_source,
    NULL,
    p_description,
    p_stripe_event_id,
    p_stripe_payment_intent_id,
    p_stripe_checkout_session_id,
    p_created_by,
    p_source_app,
    p_metadata
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT 
    true, 
    v_new_balance, 
    v_transaction_id, 
    NULL::text;
END;
$$;

COMMENT ON FUNCTION public.sp_grant_credits IS 'Add credits to organization with NUMERIC precision and idempotency support';

-- ============================================================================
-- STEP 9: Recreate sp_consume_credits with proper NUMERIC math (no CEIL)
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
  new_balance NUMERIC(12,2),
  credits_consumed NUMERIC(12,2),
  transaction_id uuid,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost_per_use NUMERIC(12,2);
  v_total_cost NUMERIC(12,2);
  v_current_balance NUMERIC(12,2);
  v_new_balance NUMERIC(12,2);
  v_transaction_id uuid;
  v_usage_event_id uuid;
  v_spending_enabled boolean;
  v_account_status text;
BEGIN
  -- Master switch check
  SELECT credit_spending_enabled, account_status 
  INTO v_spending_enabled, v_account_status
  FROM public.organizations 
  WHERE id = p_organization_id;

  IF v_spending_enabled IS NULL THEN
    RETURN QUERY SELECT false, 0::NUMERIC(12,2), 0::NUMERIC(12,2), NULL::uuid, 'Organization not found';
    RETURN;
  END IF;

  IF v_spending_enabled IS NOT TRUE THEN
    RETURN QUERY SELECT false, 0::NUMERIC(12,2), 0::NUMERIC(12,2), NULL::uuid, 
      format('CREDIT_SPENDING_DISABLED: Account is in %s mode.', COALESCE(v_account_status, 'read-only'));
    RETURN;
  END IF;

  -- Get cost for this feature type
  SELECT credits_per_use INTO v_cost_per_use
  FROM public.usage_rates
  WHERE feature_type = p_feature_type
    AND is_active = true
    AND effective_until IS NULL
  LIMIT 1;

  IF v_cost_per_use IS NULL THEN
    RETURN QUERY SELECT false, 0::NUMERIC(12,2), 0::NUMERIC(12,2), NULL::uuid, 'Feature type not found or inactive';
    RETURN;
  END IF;

  -- Calculate total cost with exact NUMERIC precision (no rounding)
  v_total_cost := v_cost_per_use * p_quantity;

  -- Lock balance row
  INSERT INTO public.organization_credit_balances (organization_id, balance)
  VALUES (p_organization_id, 0)
  ON CONFLICT (organization_id) DO NOTHING;
  
  SELECT COALESCE(ocb.balance, 0) INTO v_current_balance
  FROM public.organization_credit_balances ocb
  WHERE ocb.organization_id = p_organization_id
  FOR UPDATE;

  -- Check sufficient balance
  IF v_current_balance < v_total_cost THEN
    RETURN QUERY SELECT 
      false, 
      v_current_balance, 
      0::NUMERIC(12,2), 
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

  -- Insert usage event
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

COMMENT ON FUNCTION public.sp_consume_credits IS 'Atomically consume credits with exact NUMERIC precision. No rounding - true fractional credit support.';

-- ============================================================================
-- STEP 10: Grant execute permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_feature_cost(public.feature_type) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sp_get_credit_balance(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sp_grant_credits(uuid, NUMERIC, public.credit_source, text, text, text, text, uuid, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sp_consume_credits(uuid, public.feature_type, integer, uuid, text, text, jsonb) TO authenticated, service_role;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Check usage rates
SELECT feature_type, credits_per_use FROM public.usage_rates WHERE is_active = true ORDER BY feature_type;

-- Check function signatures
SELECT proname, prorettype::regtype 
FROM pg_proc 
WHERE proname IN ('get_feature_cost', 'sp_get_credit_balance', 'sp_grant_credits', 'sp_consume_credits')
ORDER BY proname;
