-- Create billing infrastructure tables for credit-based billing system
-- SAFE VERSION: Handles existing objects gracefully
-- These tables are shared between CRM and Socials apps

-- Plan definitions table
CREATE TABLE IF NOT EXISTS public.plan_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  monthly_price_cents INTEGER DEFAULT 0,
  annual_price_cents INTEGER DEFAULT 0,
  stripe_monthly_price_id VARCHAR(100),
  stripe_annual_price_id VARCHAR(100),
  included_credits INTEGER DEFAULT 0,
  max_users INTEGER DEFAULT 1,
  monthly_credits INTEGER DEFAULT 0,
  features JSONB DEFAULT '[]'::jsonb,
  limits JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Credit packs table already exists with this schema:
-- id, name, description, credits, price_cents, currency, discount_percentage, 
-- stripe_price_id, stripe_product_id, is_active, display_order, metadata, created_at, updated_at
-- So we skip creating it

-- Billing profiles table
CREATE TABLE IF NOT EXISTS public.billing_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(100),
  stripe_subscription_id VARCHAR(100),
  subscription_status VARCHAR(50),
  subscription_plan VARCHAR(50),
  subscription_started_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id)
);

-- Credit ledger table for tracking credit balance
CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('credit', 'debit')),
  amount NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL,
  feature_type VARCHAR(50),
  source VARCHAR(50) NOT NULL,
  description TEXT,
  user_id UUID,
  source_app VARCHAR(20),
  request_id VARCHAR(100),
  stripe_event_id VARCHAR(100),
  stripe_payment_intent_id VARCHAR(100),
  stripe_checkout_session_id VARCHAR(100),
  feature_details JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

-- Signup requests table
CREATE TABLE IF NOT EXISTS public.signup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  plan_name VARCHAR(50),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  utm_term VARCHAR(100),
  utm_content VARCHAR(100),
  referrer TEXT,
  landing_page TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'abandoned', 'failed')),
  organization_id UUID REFERENCES public.organizations(id),
  user_id UUID,
  stripe_checkout_session_id VARCHAR(100),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_ledger_org ON public.credit_ledger(organization_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_created ON public.credit_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_profiles_org ON public.billing_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_profiles_stripe ON public.billing_profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_signup_requests_email ON public.signup_requests(email);
CREATE INDEX IF NOT EXISTS idx_signup_requests_org ON public.signup_requests(organization_id);

-- Enable RLS on all tables (safe to run multiple times)
ALTER TABLE public.plan_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
-- plan_definitions policies
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.plan_definitions;
DROP POLICY IF EXISTS "Service role full access plan_definitions" ON public.plan_definitions;

CREATE POLICY "Anyone can view active plans" ON public.plan_definitions
  FOR SELECT USING (is_active = true);
CREATE POLICY "Service role full access plan_definitions" ON public.plan_definitions
  FOR ALL USING (auth.role() = 'service_role');

-- credit_packs policies (table already exists)
DROP POLICY IF EXISTS "Anyone can view active credit packs" ON public.credit_packs;
DROP POLICY IF EXISTS "Service role full access credit_packs" ON public.credit_packs;

CREATE POLICY "Anyone can view active credit packs" ON public.credit_packs
  FOR SELECT USING (is_active = true);
CREATE POLICY "Service role full access credit_packs" ON public.credit_packs
  FOR ALL USING (auth.role() = 'service_role');

-- billing_profiles policies
DROP POLICY IF EXISTS "Users can view own org billing profile" ON public.billing_profiles;
DROP POLICY IF EXISTS "Service role full access billing_profiles" ON public.billing_profiles;

CREATE POLICY "Users can view own org billing profile" ON public.billing_profiles
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.user_organizations 
      WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "Service role full access billing_profiles" ON public.billing_profiles
  FOR ALL USING (auth.role() = 'service_role');

-- credit_ledger policies
DROP POLICY IF EXISTS "Users can view own org credit ledger" ON public.credit_ledger;
DROP POLICY IF EXISTS "Service role full access credit_ledger" ON public.credit_ledger;

CREATE POLICY "Users can view own org credit ledger" ON public.credit_ledger
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.user_organizations 
      WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "Service role full access credit_ledger" ON public.credit_ledger
  FOR ALL USING (auth.role() = 'service_role');

-- signup_requests policies
DROP POLICY IF EXISTS "Users can view own signup requests" ON public.signup_requests;
DROP POLICY IF EXISTS "Service role full access signup_requests" ON public.signup_requests;

CREATE POLICY "Users can view own signup requests" ON public.signup_requests
  FOR SELECT USING (user_id = auth.uid() OR email = auth.email());
CREATE POLICY "Service role full access signup_requests" ON public.signup_requests
  FOR ALL USING (auth.role() = 'service_role');

-- Seed default plan definitions
INSERT INTO public.plan_definitions (name, display_name, description, monthly_price_cents, annual_price_cents, included_credits, max_users, monthly_credits, display_order, features)
VALUES 
  ('starter', 'Starter', 'Perfect for individual agents getting started', 1900, 19000, 200, 1, 200, 1, '["Basic listings", "CRM basics", "Email templates"]'::jsonb),
  ('pro', 'Pro', 'For growing teams with advanced features', 4900, 49000, 500, 10, 500, 2, '["Unlimited listings", "Advanced CRM", "AI Assistant", "Email automation", "Priority support"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Skip seeding credit_packs - table already has data with a unique constraint on (credits, is_active)
-- Existing credit packs should be managed through the admin UI
