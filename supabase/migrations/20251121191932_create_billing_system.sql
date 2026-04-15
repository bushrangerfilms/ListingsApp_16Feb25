-- Credit-Based Billing System - Database Foundation
-- Phase 1: Tables, views, stored procedures, and RLS policies
-- Shared between CRM and Socials apps for unified billing

-- ============================================================================
-- STEP 1: Create Enums
-- ============================================================================

-- Credit source types (how credits were added)
CREATE TYPE public.credit_source AS ENUM (
  'purchase',           -- Purchased via Stripe
  'subscription',       -- Monthly subscription grant
  'welcome_bonus',      -- Free credits on signup
  'admin_grant',        -- Manually granted by admin
  'refund',            -- Refunded credits
  'promotion'          -- Promotional credits
);

-- Feature types (what consumes credits)
CREATE TYPE public.feature_type AS ENUM (
  'post_generation',    -- Social media post creation
  'video_generation',   -- Video content creation
  'image_enhancement',  -- Future: AI image editing
  'ai_assistant'        -- Future: AI chat usage
);

-- Transaction types (credit movement direction)
CREATE TYPE public.transaction_type AS ENUM (
  'credit',            -- Adding credits (+)
  'debit'              -- Consuming credits (-)
);

-- ============================================================================
-- STEP 2: Create billing_profiles table
-- Links organizations to Stripe customers and subscriptions
-- ============================================================================

CREATE TABLE public.billing_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text,
  subscription_status text CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'incomplete', 'trialing')),
  subscription_plan text,
  subscription_started_at timestamptz,
  subscription_ends_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- One billing profile per organization
  UNIQUE(organization_id)
);

COMMENT ON TABLE public.billing_profiles IS 'Maps organizations to Stripe customers and manages subscription state';

-- Indexes for billing_profiles
CREATE INDEX idx_billing_profiles_org_id ON public.billing_profiles(organization_id);
CREATE INDEX idx_billing_profiles_stripe_customer ON public.billing_profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_billing_profiles_subscription_status ON public.billing_profiles(subscription_status) WHERE subscription_status IS NOT NULL;

-- ============================================================================
-- STEP 3: Create credit_packs table
-- Product catalog for credit pack offerings
-- ============================================================================

CREATE TABLE public.credit_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  credits integer NOT NULL CHECK (credits > 0),
  price_cents integer NOT NULL CHECK (price_cents > 0),
  currency text NOT NULL DEFAULT 'eur',
  discount_percentage integer DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage < 100),
  stripe_price_id text UNIQUE,
  stripe_product_id text,
  is_active boolean DEFAULT true NOT NULL,
  display_order integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Unique pack by credits amount (prevent duplicate offerings)
  UNIQUE(credits, is_active)
);

COMMENT ON TABLE public.credit_packs IS 'Available credit pack products with pricing and Stripe integration';

-- Indexes for credit_packs
CREATE INDEX idx_credit_packs_active ON public.credit_packs(is_active, display_order) WHERE is_active = true;
CREATE INDEX idx_credit_packs_stripe_price ON public.credit_packs(stripe_price_id) WHERE stripe_price_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Create credit_transactions table (LEDGER)
-- Immutable record of all credit movements
-- ============================================================================

CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  transaction_type public.transaction_type NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  source public.credit_source,
  feature_type public.feature_type,
  description text,
  
  -- Stripe integration fields
  stripe_event_id text,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  
  -- Audit trail
  created_by uuid REFERENCES auth.users(id),
  source_app text CHECK (source_app IN ('crm', 'socials', 'admin', 'system')),
  request_id text,
  ip_address inet,
  
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  -- Constraints
  CONSTRAINT valid_credit_transaction CHECK (
    (transaction_type = 'credit' AND source IS NOT NULL) OR
    (transaction_type = 'debit' AND feature_type IS NOT NULL)
  )
);

COMMENT ON TABLE public.credit_transactions IS 'Immutable ledger of all credit additions and deductions';

-- CRITICAL: Unique index on stripe_event_id prevents duplicate webhook processing
CREATE UNIQUE INDEX idx_credit_transactions_stripe_event ON public.credit_transactions(stripe_event_id) 
  WHERE stripe_event_id IS NOT NULL;

-- Performance indexes
CREATE INDEX idx_credit_transactions_org_created ON public.credit_transactions(organization_id, created_at DESC);
CREATE INDEX idx_credit_transactions_type ON public.credit_transactions(transaction_type);
CREATE INDEX idx_credit_transactions_source ON public.credit_transactions(source) WHERE source IS NOT NULL;
CREATE INDEX idx_credit_transactions_feature ON public.credit_transactions(feature_type) WHERE feature_type IS NOT NULL;

-- ============================================================================
-- STEP 5: Create credit_usage_events table
-- Detailed event tracking for analytics
-- ============================================================================

CREATE TABLE public.credit_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.credit_transactions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_type public.feature_type NOT NULL,
  credits_consumed integer NOT NULL CHECK (credits_consumed > 0),
  
  -- Feature-specific details
  feature_details jsonb DEFAULT '{}'::jsonb,
  
  -- User who triggered the action
  user_id uuid REFERENCES auth.users(id),
  
  -- App context
  source_app text NOT NULL CHECK (source_app IN ('crm', 'socials', 'admin', 'system')),
  
  created_at timestamptz DEFAULT now() NOT NULL,
  
  -- Performance metadata
  processing_time_ms integer,
  success boolean DEFAULT true
);

COMMENT ON TABLE public.credit_usage_events IS 'Detailed analytics for credit consumption by feature';

-- Indexes for analytics
CREATE INDEX idx_credit_usage_org_created ON public.credit_usage_events(organization_id, created_at DESC);
CREATE INDEX idx_credit_usage_feature ON public.credit_usage_events(feature_type, created_at DESC);
CREATE INDEX idx_credit_usage_user ON public.credit_usage_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_credit_usage_app ON public.credit_usage_events(source_app, created_at DESC);

-- ============================================================================
-- STEP 6: Create usage_rates table
-- Configurable pricing per feature
-- ============================================================================

CREATE TABLE public.usage_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_type public.feature_type NOT NULL UNIQUE,
  credits_per_use integer NOT NULL CHECK (credits_per_use > 0),
  description text,
  is_active boolean DEFAULT true NOT NULL,
  effective_from timestamptz DEFAULT now() NOT NULL,
  effective_until timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.usage_rates IS 'Credit costs for each feature type';

-- Index for active rate lookups
CREATE INDEX idx_usage_rates_active ON public.usage_rates(feature_type, effective_from DESC) 
  WHERE is_active = true AND effective_until IS NULL;

-- Seed initial usage rates
INSERT INTO public.usage_rates (feature_type, credits_per_use, description) VALUES
  ('post_generation', 10, 'Generate a social media post with AI'),
  ('video_generation', 40, 'Generate a video with AI'),
  ('image_enhancement', 5, 'Enhance or edit images with AI'),
  ('ai_assistant', 1, 'AI assistant message (per 1000 tokens)')
ON CONFLICT (feature_type) DO NOTHING;

-- ============================================================================
-- STEP 7: Create organization_credit_balances table (NOT materialized view)
-- Real-time balance tracking updated within same transaction
-- This table is updated by triggers, providing fast lookups with accurate data
-- ============================================================================

CREATE TABLE public.organization_credit_balances (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  last_transaction_at timestamptz,
  total_credits_purchased integer DEFAULT 0 NOT NULL,
  total_credits_consumed integer DEFAULT 0 NOT NULL,
  transaction_count integer DEFAULT 0 NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.organization_credit_balances IS 'Real-time credit balances updated via triggers';

-- Index for fast lookups (primary key already indexed)
CREATE INDEX idx_org_credit_balances_updated ON public.organization_credit_balances(updated_at DESC);

-- Trigger function to update balance table after transaction insert
CREATE OR REPLACE FUNCTION public.update_organization_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance_change integer;
BEGIN
  -- Calculate balance change
  IF NEW.transaction_type = 'credit' THEN
    v_balance_change := NEW.amount;
  ELSE
    v_balance_change := -NEW.amount;
  END IF;

  -- Insert or update organization balance
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
-- STEP 8: Stored Procedure - Get Credit Balance
-- Fast balance check from balance table
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sp_get_credit_balance(
  p_organization_id uuid
)
RETURNS TABLE (
  balance integer,
  last_transaction_at timestamptz,
  total_purchased integer,
  total_consumed integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(ocb.balance, 0)::integer AS balance,
    ocb.last_transaction_at,
    COALESCE(ocb.total_credits_purchased, 0)::integer AS total_purchased,
    COALESCE(ocb.total_credits_consumed, 0)::integer AS total_consumed
  FROM public.organization_credit_balances ocb
  WHERE ocb.organization_id = p_organization_id
  
  UNION ALL
  
  -- Return 0 balance if organization has no balance record yet
  SELECT 0::integer, NULL::timestamptz, 0::integer, 0::integer
  WHERE NOT EXISTS (
    SELECT 1 FROM public.organization_credit_balances 
    WHERE organization_id = p_organization_id
  )
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.sp_get_credit_balance IS 'Get current credit balance for an organization';

-- ============================================================================
-- STEP 9: Stored Procedure - Consume Credits (CRITICAL - Race Condition Safe)
-- Atomic credit deduction with SELECT FOR UPDATE locking
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
  v_cost_per_use integer;
  v_total_cost integer;
  v_current_balance integer;
  v_new_balance integer;
  v_transaction_id uuid;
  v_usage_event_id uuid;
BEGIN
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

COMMENT ON FUNCTION public.sp_consume_credits IS 'Atomically consume credits with race condition prevention via SELECT FOR UPDATE';

-- ============================================================================
-- STEP 10: Stored Procedure - Grant Credits
-- Add credits from purchases, bonuses, refunds, etc.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sp_grant_credits(
  p_organization_id uuid,
  p_amount integer,
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
  new_balance integer,
  transaction_id uuid,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
  v_transaction_id uuid;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, 0, NULL::uuid, 'Amount must be greater than 0';
    RETURN;
  END IF;

  -- Check for duplicate Stripe event (idempotency)
  IF p_stripe_event_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.credit_transactions 
      WHERE stripe_event_id = p_stripe_event_id
    ) THEN
      -- Event already processed, return existing transaction
      SELECT 
        true,
        balance_after,
        id,
        'Event already processed (idempotent)'::text
      INTO success, new_balance, transaction_id, error_message
      FROM public.credit_transactions
      WHERE stripe_event_id = p_stripe_event_id
      LIMIT 1;
      
      RETURN QUERY SELECT success, new_balance, transaction_id, error_message;
      RETURN;
    END IF;
  END IF;

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

  -- Calculate new balance
  v_new_balance := v_current_balance + p_amount;

  -- Insert credit transaction
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

  -- Return success
  RETURN QUERY SELECT 
    true, 
    v_new_balance, 
    v_transaction_id, 
    NULL::text;
END;
$$;

COMMENT ON FUNCTION public.sp_grant_credits IS 'Add credits to organization with idempotency support for Stripe webhooks';

-- ============================================================================
-- STEP 11: Stored Procedure - Get Credit History
-- Paginated transaction history for billing UI
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sp_get_credit_history(
  p_organization_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  transaction_type public.transaction_type,
  amount integer,
  balance_after integer,
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
  SELECT 
    ct.id,
    ct.transaction_type,
    ct.amount,
    ct.balance_after,
    ct.source,
    ct.feature_type,
    ct.description,
    ct.created_at,
    ct.source_app
  FROM public.credit_transactions ct
  WHERE ct.organization_id = p_organization_id
  ORDER BY ct.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION public.sp_get_credit_history IS 'Get paginated credit transaction history for an organization';

-- ============================================================================
-- STEP 12: Helper Function - Get Feature Cost
-- Cached lookup of feature costs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_feature_cost(
  p_feature_type public.feature_type
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_cost integer;
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

COMMENT ON FUNCTION public.get_feature_cost IS 'Get credit cost for a feature type (cached)';

-- ============================================================================
-- STEP 13: Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.billing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_credit_balances ENABLE ROW LEVEL SECURITY;

-- billing_profiles policies
CREATE POLICY "Users can view their org billing profile"
  ON public.billing_profiles FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_organizations
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage billing profiles"
  ON public.billing_profiles FOR ALL
  TO authenticated
  USING (
    -- User must be in the organization AND have admin role
    organization_id IN (
      SELECT uo.organization_id 
      FROM public.user_organizations uo
      WHERE uo.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('super_admin', 'admin', 'developer')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT uo.organization_id 
      FROM public.user_organizations uo
      WHERE uo.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('super_admin', 'admin', 'developer')
    )
  );

CREATE POLICY "Service role full access to billing profiles"
  ON public.billing_profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- credit_packs policies (publicly viewable for purchase UI)
CREATE POLICY "Anyone can view active credit packs"
  ON public.credit_packs FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

CREATE POLICY "Admins can manage credit packs"
  ON public.credit_packs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'developer')
    )
  );

CREATE POLICY "Service role full access to credit packs"
  ON public.credit_packs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- credit_transactions policies
CREATE POLICY "Users can view their org transactions"
  ON public.credit_transactions FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_organizations
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to transactions"
  ON public.credit_transactions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- credit_usage_events policies
CREATE POLICY "Users can view their org usage events"
  ON public.credit_usage_events FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_organizations
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to usage events"
  ON public.credit_usage_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- usage_rates policies (publicly viewable)
CREATE POLICY "Anyone can view active usage rates"
  ON public.usage_rates FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

CREATE POLICY "Admins can manage usage rates"
  ON public.usage_rates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'developer')
    )
  );

CREATE POLICY "Service role full access to usage rates"
  ON public.usage_rates FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- organization_credit_balances policies
CREATE POLICY "Users can view their org balance"
  ON public.organization_credit_balances FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_organizations
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to balances"
  ON public.organization_credit_balances FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Success Message
-- ============================================================================

SELECT 'Billing system database foundation created successfully! ✅' as result;
