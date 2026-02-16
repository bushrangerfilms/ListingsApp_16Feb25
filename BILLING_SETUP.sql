-- ============================================================================
-- AUTOLISTING.IO - BILLING SYSTEM SETUP (IDEMPOTENT)
-- Safe to run multiple times - handles existing objects
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================================

-- STEP 1: Create Enums (only if they don't exist)
DO $$ BEGIN
  CREATE TYPE public.credit_source AS ENUM ('purchase', 'subscription', 'welcome_bonus', 'admin_grant', 'refund', 'promotion');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.feature_type AS ENUM ('post_generation', 'video_generation', 'image_enhancement', 'ai_assistant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.transaction_type AS ENUM ('credit', 'debit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- STEP 2: Create billing_profiles table
CREATE TABLE IF NOT EXISTS public.billing_profiles (
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
  UNIQUE(organization_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_profiles_org_id ON public.billing_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_profiles_stripe_customer ON public.billing_profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- STEP 3: Create credit_packs table
CREATE TABLE IF NOT EXISTS public.credit_packs (
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
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_packs_active ON public.credit_packs(is_active, display_order) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_credit_packs_stripe_price ON public.credit_packs(stripe_price_id) WHERE stripe_price_id IS NOT NULL;

-- STEP 4: Create credit_transactions table (LEDGER)
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  transaction_type public.transaction_type NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  source public.credit_source,
  feature_type public.feature_type,
  description text,
  stripe_event_id text,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  created_by uuid REFERENCES auth.users(id),
  source_app text CHECK (source_app IN ('crm', 'socials', 'admin', 'system')),
  request_id text,
  ip_address inet,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_credit_transaction CHECK (
    (transaction_type = 'credit' AND source IS NOT NULL) OR
    (transaction_type = 'debit' AND feature_type IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_stripe_event ON public.credit_transactions(stripe_event_id) WHERE stripe_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_transactions_org_created ON public.credit_transactions(organization_id, created_at DESC);

-- STEP 5: Create credit_usage_events table
CREATE TABLE IF NOT EXISTS public.credit_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.credit_transactions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_type public.feature_type NOT NULL,
  credits_consumed integer NOT NULL CHECK (credits_consumed > 0),
  feature_details jsonb DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES auth.users(id),
  source_app text NOT NULL CHECK (source_app IN ('crm', 'socials', 'admin', 'system')),
  created_at timestamptz DEFAULT now() NOT NULL,
  processing_time_ms integer,
  success boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_credit_usage_org_created ON public.credit_usage_events(organization_id, created_at DESC);

-- STEP 6: Create usage_rates table
CREATE TABLE IF NOT EXISTS public.usage_rates (
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

-- Seed usage rates (upsert)
INSERT INTO public.usage_rates (feature_type, credits_per_use, description) VALUES
  ('post_generation', 10, 'Generate a social media post with AI'),
  ('video_generation', 40, 'Generate a video with AI'),
  ('image_enhancement', 5, 'Enhance or edit images with AI'),
  ('ai_assistant', 1, 'AI assistant message (per 1000 tokens)')
ON CONFLICT (feature_type) DO UPDATE SET
  credits_per_use = EXCLUDED.credits_per_use,
  description = EXCLUDED.description,
  updated_at = now();

-- STEP 7: Create organization_credit_balances table
CREATE TABLE IF NOT EXISTS public.organization_credit_balances (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  last_transaction_at timestamptz,
  total_credits_purchased integer DEFAULT 0 NOT NULL,
  total_credits_consumed integer DEFAULT 0 NOT NULL,
  transaction_count integer DEFAULT 0 NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Balance update trigger function (CREATE OR REPLACE is safe)
CREATE OR REPLACE FUNCTION public.update_organization_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_balance_change integer;
BEGIN
  IF NEW.transaction_type = 'credit' THEN v_balance_change := NEW.amount;
  ELSE v_balance_change := -NEW.amount; END IF;
  INSERT INTO public.organization_credit_balances (organization_id, balance, last_transaction_at, total_credits_purchased, total_credits_consumed, transaction_count, updated_at)
  VALUES (NEW.organization_id, v_balance_change, NEW.created_at, CASE WHEN NEW.transaction_type = 'credit' THEN NEW.amount ELSE 0 END, CASE WHEN NEW.transaction_type = 'debit' THEN NEW.amount ELSE 0 END, 1, now())
  ON CONFLICT (organization_id) DO UPDATE SET
    balance = organization_credit_balances.balance + v_balance_change,
    last_transaction_at = NEW.created_at,
    total_credits_purchased = organization_credit_balances.total_credits_purchased + CASE WHEN NEW.transaction_type = 'credit' THEN NEW.amount ELSE 0 END,
    total_credits_consumed = organization_credit_balances.total_credits_consumed + CASE WHEN NEW.transaction_type = 'debit' THEN NEW.amount ELSE 0 END,
    transaction_count = organization_credit_balances.transaction_count + 1,
    updated_at = now();
  RETURN NEW;
END; $$;

-- Drop and recreate trigger (safe pattern)
DROP TRIGGER IF EXISTS after_credit_transaction_insert ON public.credit_transactions;
CREATE TRIGGER after_credit_transaction_insert AFTER INSERT ON public.credit_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_organization_balance();

-- STEP 8: Get Credit Balance Function
CREATE OR REPLACE FUNCTION public.sp_get_credit_balance(p_organization_id uuid)
RETURNS TABLE (balance integer, last_transaction_at timestamptz, total_purchased integer, total_consumed integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT COALESCE(ocb.balance, 0)::integer, ocb.last_transaction_at, COALESCE(ocb.total_credits_purchased, 0)::integer, COALESCE(ocb.total_credits_consumed, 0)::integer
  FROM public.organization_credit_balances ocb WHERE ocb.organization_id = p_organization_id
  UNION ALL SELECT 0::integer, NULL::timestamptz, 0::integer, 0::integer
  WHERE NOT EXISTS (SELECT 1 FROM public.organization_credit_balances WHERE organization_id = p_organization_id) LIMIT 1;
END; $$;

-- STEP 9: Consume Credits Function
CREATE OR REPLACE FUNCTION public.sp_consume_credits(
  p_organization_id uuid, p_feature_type public.feature_type, p_quantity integer DEFAULT 1,
  p_user_id uuid DEFAULT NULL, p_source_app text DEFAULT 'system', p_request_id text DEFAULT NULL, p_feature_details jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE (success boolean, new_balance integer, credits_consumed integer, transaction_id uuid, error_message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cost_per_use integer; v_total_cost integer; v_current_balance integer; v_new_balance integer; v_transaction_id uuid;
BEGIN
  SELECT credits_per_use INTO v_cost_per_use FROM public.usage_rates WHERE feature_type = p_feature_type AND is_active = true AND effective_until IS NULL LIMIT 1;
  IF v_cost_per_use IS NULL THEN RETURN QUERY SELECT false, 0, 0, NULL::uuid, 'Feature type not found or inactive'; RETURN; END IF;
  v_total_cost := v_cost_per_use * p_quantity;
  INSERT INTO public.organization_credit_balances (organization_id, balance) VALUES (p_organization_id, 0) ON CONFLICT (organization_id) DO NOTHING;
  SELECT COALESCE(balance, 0) INTO v_current_balance FROM public.organization_credit_balances WHERE organization_id = p_organization_id FOR UPDATE;
  IF v_current_balance < v_total_cost THEN RETURN QUERY SELECT false, v_current_balance, 0, NULL::uuid, format('Insufficient credits. Required: %s, Available: %s', v_total_cost, v_current_balance); RETURN; END IF;
  v_new_balance := v_current_balance - v_total_cost;
  INSERT INTO public.credit_transactions (organization_id, transaction_type, amount, balance_after, source, feature_type, description, created_by, source_app, request_id)
  VALUES (p_organization_id, 'debit', v_total_cost, v_new_balance, NULL, p_feature_type, format('Consumed %s credits for %s', v_total_cost, p_feature_type), p_user_id, p_source_app, p_request_id) RETURNING id INTO v_transaction_id;
  INSERT INTO public.credit_usage_events (transaction_id, organization_id, feature_type, credits_consumed, feature_details, user_id, source_app)
  VALUES (v_transaction_id, p_organization_id, p_feature_type, v_total_cost, p_feature_details, p_user_id, p_source_app);
  RETURN QUERY SELECT true, v_new_balance, v_total_cost, v_transaction_id, NULL::text;
END; $$;

-- STEP 10: Grant Credits Function (with Stripe idempotency)
CREATE OR REPLACE FUNCTION public.sp_grant_credits(
  p_organization_id uuid, p_amount integer, p_source public.credit_source,
  p_description text DEFAULT NULL, p_stripe_event_id text DEFAULT NULL, p_stripe_payment_intent_id text DEFAULT NULL,
  p_stripe_checkout_session_id text DEFAULT NULL, p_created_by uuid DEFAULT NULL, p_source_app text DEFAULT 'system', p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE (success boolean, new_balance integer, transaction_id uuid, error_message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_current_balance integer; v_new_balance integer; v_transaction_id uuid;
BEGIN
  IF p_amount <= 0 THEN RETURN QUERY SELECT false, 0, NULL::uuid, 'Amount must be greater than 0'; RETURN; END IF;
  IF p_stripe_event_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.credit_transactions WHERE stripe_event_id = p_stripe_event_id) THEN
      RETURN QUERY SELECT true, ct.balance_after, ct.id, 'Event already processed'::text FROM public.credit_transactions ct WHERE stripe_event_id = p_stripe_event_id LIMIT 1; RETURN;
    END IF;
  END IF;
  INSERT INTO public.organization_credit_balances (organization_id, balance) VALUES (p_organization_id, 0) ON CONFLICT (organization_id) DO NOTHING;
  SELECT COALESCE(balance, 0) INTO v_current_balance FROM public.organization_credit_balances WHERE organization_id = p_organization_id FOR UPDATE;
  v_new_balance := v_current_balance + p_amount;
  INSERT INTO public.credit_transactions (organization_id, transaction_type, amount, balance_after, source, feature_type, description, stripe_event_id, stripe_payment_intent_id, stripe_checkout_session_id, created_by, source_app, metadata)
  VALUES (p_organization_id, 'credit', p_amount, v_new_balance, p_source, NULL, p_description, p_stripe_event_id, p_stripe_payment_intent_id, p_stripe_checkout_session_id, p_created_by, p_source_app, p_metadata) RETURNING id INTO v_transaction_id;
  RETURN QUERY SELECT true, v_new_balance, v_transaction_id, NULL::text;
END; $$;

-- STEP 11: Get Credit History Function
CREATE OR REPLACE FUNCTION public.sp_get_credit_history(p_organization_id uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS TABLE (id uuid, transaction_type public.transaction_type, amount integer, balance_after integer, source public.credit_source, feature_type public.feature_type, description text, created_at timestamptz, source_app text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT ct.id, ct.transaction_type, ct.amount, ct.balance_after, ct.source, ct.feature_type, ct.description, ct.created_at, ct.source_app
  FROM public.credit_transactions ct WHERE ct.organization_id = p_organization_id ORDER BY ct.created_at DESC LIMIT p_limit OFFSET p_offset;
END; $$;

-- STEP 12: Enable Row Level Security (safe to run multiple times)
ALTER TABLE public.billing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_credit_balances ENABLE ROW LEVEL SECURITY;

-- STEP 13: RLS Policies (drop first, then create)
-- billing_profiles policies
DROP POLICY IF EXISTS "Users can view their org billing profile" ON public.billing_profiles;
CREATE POLICY "Users can view their org billing profile" ON public.billing_profiles FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Service role full access billing profiles" ON public.billing_profiles;
CREATE POLICY "Service role full access billing profiles" ON public.billing_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- credit_packs policies
DROP POLICY IF EXISTS "Anyone can view active credit packs" ON public.credit_packs;
CREATE POLICY "Anyone can view active credit packs" ON public.credit_packs FOR SELECT TO authenticated, anon USING (is_active = true);
DROP POLICY IF EXISTS "Service role full access credit packs" ON public.credit_packs;
CREATE POLICY "Service role full access credit packs" ON public.credit_packs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- credit_transactions policies
DROP POLICY IF EXISTS "Users can view their org transactions" ON public.credit_transactions;
CREATE POLICY "Users can view their org transactions" ON public.credit_transactions FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Service role full access transactions" ON public.credit_transactions;
CREATE POLICY "Service role full access transactions" ON public.credit_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- credit_usage_events policies
DROP POLICY IF EXISTS "Users can view their org usage events" ON public.credit_usage_events;
CREATE POLICY "Users can view their org usage events" ON public.credit_usage_events FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Service role full access usage events" ON public.credit_usage_events;
CREATE POLICY "Service role full access usage events" ON public.credit_usage_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- usage_rates policies
DROP POLICY IF EXISTS "Anyone can view active usage rates" ON public.usage_rates;
CREATE POLICY "Anyone can view active usage rates" ON public.usage_rates FOR SELECT TO authenticated, anon USING (is_active = true);
DROP POLICY IF EXISTS "Service role full access usage rates" ON public.usage_rates;
CREATE POLICY "Service role full access usage rates" ON public.usage_rates FOR ALL TO service_role USING (true) WITH CHECK (true);

-- organization_credit_balances policies
DROP POLICY IF EXISTS "Users can view their org balance" ON public.organization_credit_balances;
CREATE POLICY "Users can view their org balance" ON public.organization_credit_balances FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Service role full access balances" ON public.organization_credit_balances;
CREATE POLICY "Service role full access balances" ON public.organization_credit_balances FOR ALL TO service_role USING (true) WITH CHECK (true);

-- STEP 14: Seed Credit Packs with YOUR Stripe Price IDs (upsert by credits amount)
INSERT INTO public.credit_packs (name, description, credits, price_cents, currency, discount_percentage, stripe_price_id, stripe_product_id, is_active, display_order) VALUES
  ('100 Credits', '100 credits for social media automation', 100, 2500, 'eur', 0, 'price_1SZEUqFhQ0qaJHvJE1YlbkFY', 'prod_TWH2isHUJnpsjz', true, 1),
  ('500 Credits', '500 credits - 12% savings', 500, 11000, 'eur', 12, 'price_1SZEUrFhQ0qaJHvJlHInQDzO', 'prod_TWH2Eolzc3hFcP', true, 2),
  ('2000 Credits', '2000 credits - 20% savings', 2000, 40000, 'eur', 20, 'price_1SZEUsFhQ0qaJHvJPPoGp3qb', 'prod_TWH2SShR3OzD6K', true, 3),
  ('5000 Credits', '5000 credits - 28% savings', 5000, 90000, 'eur', 28, 'price_1SZEUsFhQ0qaJHvJDUZUt7ps', 'prod_TWH2OOREVrCxFf', true, 4)
ON CONFLICT (stripe_price_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  credits = EXCLUDED.credits,
  price_cents = EXCLUDED.price_cents,
  discount_percentage = EXCLUDED.discount_percentage,
  stripe_product_id = EXCLUDED.stripe_product_id,
  display_order = EXCLUDED.display_order,
  updated_at = now();

SELECT 'Billing system setup complete!' as result;
