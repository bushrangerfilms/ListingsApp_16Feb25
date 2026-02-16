-- Plan Definitions Table for Subscription Plans
-- Stores Starter and Pro plan metadata including pricing, credits, and user limits

-- ============================================================================
-- STEP 1: Create plan_definitions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.plan_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'eur',
  billing_interval text NOT NULL DEFAULT 'month' CHECK (billing_interval IN ('month', 'year')),
  monthly_credits integer NOT NULL CHECK (monthly_credits >= 0),
  max_users integer NOT NULL DEFAULT 1 CHECK (max_users >= 1),
  stripe_product_id text,
  stripe_price_id text,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true NOT NULL,
  display_order integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.plan_definitions IS 'Subscription plan definitions (Starter, Pro, etc.)';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_plan_definitions_active ON public.plan_definitions(is_active, display_order) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_plan_definitions_name ON public.plan_definitions(name);
CREATE INDEX IF NOT EXISTS idx_plan_definitions_stripe_price ON public.plan_definitions(stripe_price_id) WHERE stripe_price_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.plan_definitions ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read plan definitions (public pricing page)
CREATE POLICY plan_definitions_read_policy ON public.plan_definitions
  FOR SELECT USING (true);

-- Only admins/service role can modify plans
CREATE POLICY plan_definitions_admin_policy ON public.plan_definitions
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.user_organization_roles uor
      WHERE uor.user_id = auth.uid()
      AND uor.role IN ('super_admin', 'developer')
    )
  );

-- ============================================================================
-- STEP 2: Seed plan definitions with Starter and Pro plans
-- ============================================================================

INSERT INTO public.plan_definitions (
  name,
  display_name,
  description,
  price_cents,
  currency,
  billing_interval,
  monthly_credits,
  max_users,
  features,
  is_active,
  display_order
) VALUES 
(
  'starter',
  'Starter',
  'Perfect for solo agents getting started',
  2900,
  'eur',
  'month',
  200,
  1,
  '[
    "All platform features",
    "200 credits/month included",
    "Property listings management",
    "CRM & contact management",
    "Email automation",
    "AI assistant",
    "Webhook integrations"
  ]'::jsonb,
  true,
  1
),
(
  'pro',
  'Pro',
  'For growing teams and agencies',
  7900,
  'eur',
  'month',
  500,
  10,
  '[
    "All platform features",
    "500 credits/month included",
    "Up to 10 team members",
    "Property listings management",
    "CRM & contact management",
    "Email automation",
    "AI assistant",
    "Advanced analytics",
    "Webhook integrations",
    "Priority support"
  ]'::jsonb,
  true,
  2
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  currency = EXCLUDED.currency,
  billing_interval = EXCLUDED.billing_interval,
  monthly_credits = EXCLUDED.monthly_credits,
  max_users = EXCLUDED.max_users,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- ============================================================================
-- STEP 3: Create signup_requests table for tracking signup flow
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.signup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  plan_name text REFERENCES public.plan_definitions(name),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  referrer text,
  landing_page text,
  ip_address inet,
  user_agent text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'abandoned', 'failed')),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_checkout_session_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.signup_requests IS 'Tracks signup attempts and UTM attribution';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_signup_requests_email ON public.signup_requests(email);
CREATE INDEX IF NOT EXISTS idx_signup_requests_status ON public.signup_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signup_requests_org ON public.signup_requests(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_signup_requests_utm ON public.signup_requests(utm_source, utm_campaign) WHERE utm_source IS NOT NULL;

-- Enable RLS
ALTER TABLE public.signup_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own signup requests
CREATE POLICY signup_requests_user_policy ON public.signup_requests
  FOR SELECT USING (user_id = auth.uid());

-- Admins can see all
CREATE POLICY signup_requests_admin_policy ON public.signup_requests
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.user_organization_roles uor
      WHERE uor.user_id = auth.uid()
      AND uor.role IN ('super_admin', 'developer')
    )
  );

-- ============================================================================
-- STEP 4: Add plan_name to billing_profiles if not exists
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'billing_profiles' 
    AND column_name = 'plan_name'
  ) THEN
    ALTER TABLE public.billing_profiles ADD COLUMN plan_name text REFERENCES public.plan_definitions(name);
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Update usage_rates to match new billing model
-- ============================================================================

-- Update usage rates to match new pricing model
-- video=25, post=2, chatbot=0.5, extraction=10, email=0.2

-- First, add new feature types if they don't exist
DO $$
BEGIN
  -- Check if 'property_extraction' exists in the enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'property_extraction' 
    AND enumtypid = 'public.feature_type'::regtype
  ) THEN
    ALTER TYPE public.feature_type ADD VALUE IF NOT EXISTS 'property_extraction';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'email_send' 
    AND enumtypid = 'public.feature_type'::regtype
  ) THEN
    ALTER TYPE public.feature_type ADD VALUE IF NOT EXISTS 'email_send';
  END IF;
END $$;

-- Update existing rates and add new ones
UPDATE public.usage_rates SET credits_per_use = 2, description = 'Generate a social media post with AI' WHERE feature_type = 'post_generation';
UPDATE public.usage_rates SET credits_per_use = 25, description = 'Generate a video with AI' WHERE feature_type = 'video_generation';
UPDATE public.usage_rates SET credits_per_use = 1, description = 'AI assistant interaction' WHERE feature_type = 'ai_assistant';

-- Note: For fractional credits (0.5, 0.2), we'll use integer math with 10x multiplier
-- So 0.5 credits = 5 in the database (divide by 10 for display)
-- For now, round up to 1 for chatbot and email

SELECT 'Plan definitions and signup tracking created successfully!' as result;
