-- =============================================================================
-- Pre-Billing Fix: C3a + C3b + C3c + H8
-- Replaces all billing RPCs with corrected versions that:
--   - Use credit_transactions (not legacy credit_ledger)
--   - Have FOR UPDATE row locking (prevents concurrent deduction races)
--   - Have credit_spending_enabled master switch check
--   - Have Stripe event idempotency
--   - Update organization_credit_balances cache explicitly
-- Fixes permissions: revoke from PUBLIC/anon, restrict sp_grant_credits to service_role
-- Creates processed_stripe_events table for webhook idempotency
-- =============================================================================

-- 1. Drop ALL old function overloads (handles multiple signatures)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT oid::regprocedure::text AS sig FROM pg_proc
    WHERE proname = 'sp_consume_credits' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.sig); END LOOP;

  FOR r IN SELECT oid::regprocedure::text AS sig FROM pg_proc
    WHERE proname = 'sp_grant_credits' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.sig); END LOOP;

  FOR r IN SELECT oid::regprocedure::text AS sig FROM pg_proc
    WHERE proname = 'sp_get_credit_balance' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.sig); END LOOP;

  FOR r IN SELECT oid::regprocedure::text AS sig FROM pg_proc
    WHERE proname = 'sp_get_credit_history' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.sig); END LOOP;

  FOR r IN SELECT oid::regprocedure::text AS sig FROM pg_proc
    WHERE proname = 'get_feature_cost' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.sig); END LOOP;
END $$;


-- 2. Helper: get_feature_cost
CREATE OR REPLACE FUNCTION public.get_feature_cost(p_feature_type public.feature_type)
RETURNS NUMERIC(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_cost NUMERIC(10,2);
BEGIN
  SELECT credits_per_use INTO v_cost
  FROM public.usage_rates
  WHERE feature_type = p_feature_type AND is_active = true AND effective_until IS NULL
  LIMIT 1;
  RETURN COALESCE(v_cost, 0);
END;
$$;


-- 3. sp_get_credit_balance — reads from organization_credit_balances cache
CREATE OR REPLACE FUNCTION public.sp_get_credit_balance(p_organization_id uuid)
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
    COALESCE(ocb.balance, 0::NUMERIC(12,2)),
    ocb.last_transaction_at,
    COALESCE(ocb.total_credits_purchased, 0::NUMERIC(12,2)),
    COALESCE(ocb.total_credits_consumed, 0::NUMERIC(12,2))
  FROM public.organization_credit_balances ocb
  WHERE ocb.organization_id = p_organization_id

  UNION ALL

  SELECT 0::NUMERIC(12,2), NULL::timestamptz, 0::NUMERIC(12,2), 0::NUMERIC(12,2)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.organization_credit_balances WHERE organization_id = p_organization_id
  )
  LIMIT 1;
END;
$$;


-- 4. sp_consume_credits — WITH FOR UPDATE locking + master switch + usage_rates
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
  v_cost_per_use NUMERIC(10,2);
  v_total_cost NUMERIC(12,2);
  v_current_balance NUMERIC(12,2);
  v_new_balance NUMERIC(12,2);
  v_transaction_id uuid;
  v_spending_enabled boolean;
  v_account_status text;
BEGIN
  -- Master switch check
  SELECT credit_spending_enabled, account_status
  INTO v_spending_enabled, v_account_status
  FROM public.organizations
  WHERE id = p_organization_id;

  IF v_spending_enabled IS NULL THEN
    RETURN QUERY SELECT false, 0::NUMERIC(12,2), 0::NUMERIC(12,2), NULL::uuid, 'Organization not found'::text;
    RETURN;
  END IF;

  IF v_spending_enabled IS NOT TRUE THEN
    RETURN QUERY SELECT false, 0::NUMERIC(12,2), 0::NUMERIC(12,2), NULL::uuid,
      format('CREDIT_SPENDING_DISABLED: Account is in %s mode.', COALESCE(v_account_status, 'read-only'))::text;
    RETURN;
  END IF;

  -- Get cost from usage_rates
  SELECT credits_per_use INTO v_cost_per_use
  FROM public.usage_rates
  WHERE feature_type = p_feature_type AND is_active = true AND effective_until IS NULL
  LIMIT 1;

  IF v_cost_per_use IS NULL THEN
    RETURN QUERY SELECT false, 0::NUMERIC(12,2), 0::NUMERIC(12,2), NULL::uuid, 'Feature type not found or inactive'::text;
    RETURN;
  END IF;

  v_total_cost := v_cost_per_use * p_quantity;

  -- CRITICAL: Lock the balance row to prevent concurrent deductions
  INSERT INTO public.organization_credit_balances (organization_id, balance)
  VALUES (p_organization_id, 0)
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT COALESCE(ocb.balance, 0) INTO v_current_balance
  FROM public.organization_credit_balances ocb
  WHERE ocb.organization_id = p_organization_id
  FOR UPDATE;

  -- Check sufficient balance
  IF v_current_balance < v_total_cost THEN
    RETURN QUERY SELECT false, v_current_balance, 0::NUMERIC(12,2), NULL::uuid,
      format('Insufficient credits. Required: %s, Available: %s', v_total_cost, v_current_balance)::text;
    RETURN;
  END IF;

  v_new_balance := v_current_balance - v_total_cost;

  -- Insert debit into credit_transactions (canonical table)
  INSERT INTO public.credit_transactions (
    organization_id, transaction_type, amount, balance_after,
    source, feature_type, description,
    created_by, source_app, request_id
  ) VALUES (
    p_organization_id, 'debit', v_total_cost, v_new_balance,
    NULL, p_feature_type,
    format('Consumed %s credits for %s (qty: %s, rate: %s/use)', v_total_cost, p_feature_type, p_quantity, v_cost_per_use),
    p_user_id, p_source_app, p_request_id
  ) RETURNING id INTO v_transaction_id;

  -- Insert usage event
  INSERT INTO public.credit_usage_events (
    transaction_id, organization_id, feature_type,
    credits_consumed, feature_details, user_id, source_app
  ) VALUES (
    v_transaction_id, p_organization_id, p_feature_type,
    v_total_cost, p_feature_details, p_user_id, p_source_app
  );

  -- Update cached balance explicitly
  UPDATE public.organization_credit_balances
  SET balance = v_new_balance,
      total_credits_consumed = COALESCE(total_credits_consumed, 0) + v_total_cost,
      last_transaction_at = NOW()
  WHERE organization_id = p_organization_id;

  RETURN QUERY SELECT true, v_new_balance, v_total_cost, v_transaction_id, NULL::text;
END;
$$;


-- 5. sp_grant_credits — WITH FOR UPDATE locking + idempotency
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
    RETURN QUERY SELECT false, 0::NUMERIC(12,2), NULL::uuid, 'Amount must be greater than 0'::text;
    RETURN;
  END IF;

  -- Idempotency: prevent duplicate Stripe event processing
  IF p_stripe_event_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.credit_transactions WHERE stripe_event_id = p_stripe_event_id) THEN
      RETURN QUERY
        SELECT true, ct.balance_after, ct.id, 'Event already processed (idempotent)'::text
        FROM public.credit_transactions ct
        WHERE ct.stripe_event_id = p_stripe_event_id
        LIMIT 1;
      RETURN;
    END IF;
  END IF;

  -- Lock the balance row
  INSERT INTO public.organization_credit_balances (organization_id, balance)
  VALUES (p_organization_id, 0)
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT COALESCE(ocb.balance, 0) INTO v_current_balance
  FROM public.organization_credit_balances ocb
  WHERE ocb.organization_id = p_organization_id
  FOR UPDATE;

  v_new_balance := v_current_balance + p_amount;

  -- Insert credit into credit_transactions (canonical table)
  INSERT INTO public.credit_transactions (
    organization_id, transaction_type, amount, balance_after,
    source, feature_type, description,
    stripe_event_id, stripe_payment_intent_id, stripe_checkout_session_id,
    created_by, source_app, metadata
  ) VALUES (
    p_organization_id, 'credit', p_amount, v_new_balance,
    p_source, NULL, p_description,
    p_stripe_event_id, p_stripe_payment_intent_id, p_stripe_checkout_session_id,
    p_created_by, p_source_app, p_metadata
  ) RETURNING id INTO v_transaction_id;

  -- Update cached balance explicitly
  UPDATE public.organization_credit_balances
  SET balance = v_new_balance,
      total_credits_purchased = COALESCE(total_credits_purchased, 0) + p_amount,
      last_transaction_at = NOW()
  WHERE organization_id = p_organization_id;

  RETURN QUERY SELECT true, v_new_balance, v_transaction_id, NULL::text;
END;
$$;


-- 6. sp_get_credit_history — reads from credit_transactions
CREATE OR REPLACE FUNCTION public.sp_get_credit_history(
  p_organization_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  transaction_type public.transaction_type,
  amount NUMERIC(12,2),
  balance_after NUMERIC(12,2),
  source public.credit_source,
  feature_type public.feature_type,
  description text,
  created_at timestamptz,
  source_app text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ct.id, ct.transaction_type, ct.amount, ct.balance_after,
         ct.source, ct.feature_type, ct.description, ct.created_at, ct.source_app
  FROM public.credit_transactions ct
  WHERE ct.organization_id = p_organization_id
  ORDER BY ct.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;


-- 7. Migrate existing balances from credit_ledger into organization_credit_balances
-- (Preserves any balance accumulated during pilot phase)
INSERT INTO public.organization_credit_balances (organization_id, balance, last_transaction_at)
SELECT
  cl.organization_id,
  cl.balance_after,
  cl.created_at
FROM (
  SELECT DISTINCT ON (organization_id)
    organization_id, balance_after, created_at
  FROM public.credit_ledger
  ORDER BY organization_id, created_at DESC
) cl
ON CONFLICT (organization_id)
DO UPDATE SET
  balance = CASE
    WHEN public.organization_credit_balances.last_transaction_at IS NULL
      OR public.organization_credit_balances.last_transaction_at < EXCLUDED.last_transaction_at
    THEN EXCLUDED.balance
    ELSE public.organization_credit_balances.balance
  END,
  last_transaction_at = GREATEST(
    public.organization_credit_balances.last_transaction_at,
    EXCLUDED.last_transaction_at
  );


-- 8. Fix permissions
-- C3a: sp_grant_credits — SERVICE ROLE ONLY (prevents any user from granting themselves credits)
REVOKE ALL ON FUNCTION public.sp_grant_credits(uuid, NUMERIC, public.credit_source, text, text, text, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sp_grant_credits(uuid, NUMERIC, public.credit_source, text, text, text, text, uuid, text, jsonb) TO service_role;

-- sp_consume_credits — authenticated + service_role (needed for client-side credit consumption)
REVOKE ALL ON FUNCTION public.sp_consume_credits(uuid, public.feature_type, integer, uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sp_consume_credits(uuid, public.feature_type, integer, uuid, text, text, jsonb) TO authenticated, service_role;

-- Read-only functions — authenticated + service_role
REVOKE ALL ON FUNCTION public.sp_get_credit_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sp_get_credit_balance(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.sp_get_credit_history(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sp_get_credit_history(uuid, integer, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_feature_cost(public.feature_type) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_feature_cost(public.feature_type) TO authenticated, service_role;


-- 9. H8: Create processed_stripe_events table for webhook idempotency
CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only service_role should write to this table (webhooks use service_role)
ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages processed events"
  ON public.processed_stripe_events FOR ALL USING (true);

GRANT SELECT, INSERT ON public.processed_stripe_events TO service_role;
