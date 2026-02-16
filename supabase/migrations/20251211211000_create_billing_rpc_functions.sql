-- Create RPC functions for credit-based billing system
-- These functions handle credit balance, consumption, granting, and history

-- Drop existing functions first to handle signature changes
DROP FUNCTION IF EXISTS sp_get_credit_balance(UUID);
DROP FUNCTION IF EXISTS sp_consume_credits(UUID, VARCHAR, NUMERIC, UUID, VARCHAR, TEXT, JSONB);
DROP FUNCTION IF EXISTS sp_grant_credits(UUID, NUMERIC, VARCHAR, TEXT, UUID, VARCHAR, VARCHAR, JSONB);
DROP FUNCTION IF EXISTS sp_get_credit_history(UUID, INTEGER, INTEGER);

-- Function to get credit balance for an organization
CREATE OR REPLACE FUNCTION sp_get_credit_balance(p_organization_id UUID)
RETURNS NUMERIC(12,2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance NUMERIC(12,2);
BEGIN
  SELECT COALESCE(
    (SELECT balance_after 
     FROM public.credit_ledger 
     WHERE organization_id = p_organization_id 
     ORDER BY created_at DESC 
     LIMIT 1),
    0
  ) INTO v_balance;
  
  RETURN v_balance;
END;
$$;

-- Function to consume credits for a feature usage
CREATE OR REPLACE FUNCTION sp_consume_credits(
  p_organization_id UUID,
  p_feature_type VARCHAR(50),
  p_credits_amount NUMERIC(12,2),
  p_user_id UUID DEFAULT NULL,
  p_source_app VARCHAR(20) DEFAULT 'crm',
  p_description TEXT DEFAULT NULL,
  p_feature_details JSONB DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  new_balance NUMERIC(12,2),
  credits_consumed NUMERIC(12,2),
  transaction_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance NUMERIC(12,2);
  v_new_balance NUMERIC(12,2);
  v_transaction_id UUID;
BEGIN
  -- Get current balance
  SELECT sp_get_credit_balance(p_organization_id) INTO v_current_balance;
  
  -- Check if sufficient credits
  IF v_current_balance < p_credits_amount THEN
    RAISE EXCEPTION 'Insufficient credits. Required: %, Available: %', p_credits_amount, v_current_balance;
  END IF;
  
  -- Calculate new balance
  v_new_balance := v_current_balance - p_credits_amount;
  
  -- Insert debit transaction
  INSERT INTO public.credit_ledger (
    organization_id,
    transaction_type,
    amount,
    balance_after,
    feature_type,
    source,
    description,
    user_id,
    source_app,
    feature_details,
    created_by
  ) VALUES (
    p_organization_id,
    'debit',
    p_credits_amount,
    v_new_balance,
    p_feature_type,
    'feature_usage',
    COALESCE(p_description, 'Feature usage: ' || p_feature_type),
    p_user_id,
    p_source_app,
    p_feature_details,
    p_user_id
  ) RETURNING id INTO v_transaction_id;
  
  RETURN QUERY SELECT true, v_new_balance, p_credits_amount, v_transaction_id;
END;
$$;

-- Function to grant credits to an organization
CREATE OR REPLACE FUNCTION sp_grant_credits(
  p_organization_id UUID,
  p_credits_amount NUMERIC(12,2),
  p_source VARCHAR(50),
  p_description TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_stripe_event_id VARCHAR(100) DEFAULT NULL,
  p_stripe_payment_intent_id VARCHAR(100) DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  new_balance NUMERIC(12,2),
  credits_granted NUMERIC(12,2),
  transaction_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance NUMERIC(12,2);
  v_new_balance NUMERIC(12,2);
  v_transaction_id UUID;
BEGIN
  -- Get current balance
  SELECT sp_get_credit_balance(p_organization_id) INTO v_current_balance;
  
  -- Calculate new balance
  v_new_balance := v_current_balance + p_credits_amount;
  
  -- Insert credit transaction
  INSERT INTO public.credit_ledger (
    organization_id,
    transaction_type,
    amount,
    balance_after,
    source,
    description,
    user_id,
    stripe_event_id,
    stripe_payment_intent_id,
    metadata,
    created_by
  ) VALUES (
    p_organization_id,
    'credit',
    p_credits_amount,
    v_new_balance,
    p_source,
    COALESCE(p_description, 'Credits granted: ' || p_source),
    p_user_id,
    p_stripe_event_id,
    p_stripe_payment_intent_id,
    p_metadata,
    p_user_id
  ) RETURNING id INTO v_transaction_id;
  
  RETURN QUERY SELECT true, v_new_balance, p_credits_amount, v_transaction_id;
END;
$$;

-- Function to get credit history for an organization
CREATE OR REPLACE FUNCTION sp_get_credit_history(
  p_organization_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  transaction_type VARCHAR(20),
  amount NUMERIC(12,2),
  balance_after NUMERIC(12,2),
  feature_type VARCHAR(50),
  source VARCHAR(50),
  description TEXT,
  source_app VARCHAR(20),
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cl.id,
    cl.transaction_type,
    cl.amount,
    cl.balance_after,
    cl.feature_type,
    cl.source,
    cl.description,
    cl.source_app,
    cl.created_at
  FROM public.credit_ledger cl
  WHERE cl.organization_id = p_organization_id
  ORDER BY cl.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION sp_get_credit_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sp_consume_credits(UUID, VARCHAR, NUMERIC, UUID, VARCHAR, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION sp_grant_credits(UUID, NUMERIC, VARCHAR, TEXT, UUID, VARCHAR, VARCHAR, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION sp_get_credit_history(UUID, INTEGER, INTEGER) TO authenticated;

-- Grant to service_role for Edge Functions
GRANT EXECUTE ON FUNCTION sp_get_credit_balance(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION sp_consume_credits(UUID, VARCHAR, NUMERIC, UUID, VARCHAR, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION sp_grant_credits(UUID, NUMERIC, VARCHAR, TEXT, UUID, VARCHAR, VARCHAR, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION sp_get_credit_history(UUID, INTEGER, INTEGER) TO service_role;
