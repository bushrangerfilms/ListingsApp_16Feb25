-- Phase 2: Expand Plan Definitions & Billing
-- Adds plan limit columns, multi-currency pricing, billing_override for pilot customers,
-- and seeds new tier plans (Free, Essentials, Professional, Multi-Branch S/M/L).
--
-- Production plan_definitions schema has:
--   name, display_name, description, monthly_price_cents, annual_price_cents,
--   stripe_monthly_price_id, stripe_annual_price_id, included_credits, max_users,
--   monthly_credits, features, limits, is_active, display_order

-- ============================================================================
-- STEP 1: Add limit columns to plan_definitions
-- ============================================================================

ALTER TABLE public.plan_definitions
  ADD COLUMN IF NOT EXISTS max_listings INTEGER,
  ADD COLUMN IF NOT EXISTS max_social_hubs INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_posts_per_listing_per_week INTEGER,
  ADD COLUMN IF NOT EXISTS max_lead_magnets_per_week INTEGER,
  ADD COLUMN IF NOT EXISTS max_crm_contacts INTEGER,
  ADD COLUMN IF NOT EXISTS max_email_campaigns_per_month INTEGER,
  ADD COLUMN IF NOT EXISTS has_watermark BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS allowed_video_styles TEXT[] DEFAULT ARRAY['video_style_1'],
  ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'month';

-- Add check constraints separately (IF NOT EXISTS not supported for constraints)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plan_definitions_plan_tier_check'
  ) THEN
    ALTER TABLE public.plan_definitions
      ADD CONSTRAINT plan_definitions_plan_tier_check
      CHECK (plan_tier IN ('free', 'standard', 'professional', 'multi_branch'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plan_definitions_billing_interval_check'
  ) THEN
    ALTER TABLE public.plan_definitions
      ADD CONSTRAINT plan_definitions_billing_interval_check
      CHECK (billing_interval IN ('week', 'month', 'year'));
  END IF;
END $$;

COMMENT ON COLUMN public.plan_definitions.max_listings IS 'Maximum total listings across all hubs. NULL = unlimited.';
COMMENT ON COLUMN public.plan_definitions.max_social_hubs IS 'Maximum social hubs (branches). Default 1 for single-location plans.';
COMMENT ON COLUMN public.plan_definitions.max_posts_per_listing_per_week IS 'Max posts per listing per week. NULL = unlimited.';
COMMENT ON COLUMN public.plan_definitions.max_lead_magnets_per_week IS 'Max lead magnet posts per week. NULL = unlimited. 0 = disabled.';
COMMENT ON COLUMN public.plan_definitions.has_watermark IS 'Whether videos have AutoListing watermark (free tier only).';
COMMENT ON COLUMN public.plan_definitions.allowed_video_styles IS 'Which video styles are available. All paid plans get all styles.';
COMMENT ON COLUMN public.plan_definitions.plan_tier IS 'Plan category for grouping in UI and limit enforcement.';
COMMENT ON COLUMN public.plan_definitions.billing_interval IS 'Billing frequency: week, month, or year.';

-- ============================================================================
-- STEP 2: Create plan_prices table for multi-currency pricing
-- Each plan can have prices in EUR, GBP, USD
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.plan_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name TEXT NOT NULL REFERENCES public.plan_definitions(name) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('eur', 'gbp', 'usd')),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  billing_interval TEXT NOT NULL DEFAULT 'week' CHECK (billing_interval IN ('week', 'month', 'year')),
  stripe_price_id TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  UNIQUE(plan_name, currency, billing_interval)
);

COMMENT ON TABLE public.plan_prices IS 'Multi-currency pricing for plans. Supports EUR (IE), GBP (UK), USD (US) markets.';

CREATE INDEX IF NOT EXISTS idx_plan_prices_plan ON public.plan_prices(plan_name);
CREATE INDEX IF NOT EXISTS idx_plan_prices_active ON public.plan_prices(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_plan_prices_stripe ON public.plan_prices(stripe_price_id) WHERE stripe_price_id IS NOT NULL;

-- RLS for plan_prices
ALTER TABLE public.plan_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plan prices"
  ON public.plan_prices FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage plan prices"
  ON public.plan_prices FOR ALL
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

CREATE POLICY "Service role full access to plan prices"
  ON public.plan_prices FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 3: Add billing_override and current_plan_name to organizations
-- ============================================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_override JSONB,
  ADD COLUMN IF NOT EXISTS current_plan_name TEXT;

-- Add FK separately (can't use IF NOT EXISTS on constraints directly)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_current_plan_name_fkey'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_current_plan_name_fkey
      FOREIGN KEY (current_plan_name) REFERENCES public.plan_definitions(name);
  END IF;
END $$;

COMMENT ON COLUMN public.organizations.billing_override IS 'Override for pilot/custom billing arrangements. Structure: { type, plan_equivalent, price_weekly, currency, expires_at, notes }';
COMMENT ON COLUMN public.organizations.current_plan_name IS 'Current active plan. NULL or "free" for free tier.';

-- ============================================================================
-- STEP 4: Deactivate old plan definitions and seed new tiers
-- ============================================================================

-- Mark old plans as inactive (keep for historical reference)
UPDATE public.plan_definitions
SET is_active = false, updated_at = now()
WHERE name IN ('starter', 'pro');

-- Insert new plan tiers (using existing columns: monthly_price_cents for weekly price storage)
INSERT INTO public.plan_definitions (
  name, display_name, description, monthly_price_cents,
  monthly_credits, max_users, features, is_active, display_order,
  max_listings, max_social_hubs, max_posts_per_listing_per_week,
  max_lead_magnets_per_week, max_crm_contacts, max_email_campaigns_per_month,
  has_watermark, allowed_video_styles, plan_tier, billing_interval
) VALUES
-- Free tier
(
  'free', 'Free', 'Try AutoListing with up to 2 listings — no credit card required',
  0, 50, 2,
  '["2 listings", "1 post per listing per week", "Basic video style", "50 CRM contacts", "AutoListing watermark"]'::jsonb,
  true, 1,
  2, 1, 1, 0, 50, 0,
  true, ARRAY['video_style_1'], 'free', 'week'
),
-- Essentials
(
  'essentials', 'Essentials', 'Perfect for solo agents growing their social presence',
  0, 500, 5,
  '["Up to 10 listings", "2 posts per listing per week", "All video styles", "3 lead magnets per week", "500 CRM contacts", "5 email campaigns per month"]'::jsonb,
  true, 2,
  10, 1, 2, 3, 500, 5,
  false, ARRAY['video_style_1', 'video_style_2', 'video_style_4'], 'standard', 'week'
),
-- Professional
(
  'professional', 'Professional', 'For active agents and small teams',
  0, 2000, 10,
  '["Up to 40 listings", "3 posts per listing per week", "All video styles", "Unlimited lead magnets", "Unlimited CRM contacts", "Unlimited email campaigns"]'::jsonb,
  true, 3,
  40, 1, 3, NULL, NULL, NULL,
  false, ARRAY['video_style_1', 'video_style_2', 'video_style_4'], 'professional', 'week'
),
-- Multi-Branch Small (up to 3 hubs)
(
  'multi_branch_s', 'Multi-Branch S', 'For agencies with up to 3 branches',
  0, 6000, 30,
  '["Up to 3 social hubs", "40 listings per hub (120 total)", "3 posts per listing per week", "All video styles", "Unlimited lead magnets", "Unlimited CRM & email"]'::jsonb,
  true, 4,
  120, 3, 3, NULL, NULL, NULL,
  false, ARRAY['video_style_1', 'video_style_2', 'video_style_4'], 'multi_branch', 'week'
),
-- Multi-Branch Medium (up to 8 hubs)
(
  'multi_branch_m', 'Multi-Branch M', 'For agencies with up to 8 branches',
  0, 16000, 80,
  '["Up to 8 social hubs", "40 listings per hub (320 total)", "3 posts per listing per week", "All video styles", "Unlimited lead magnets", "Unlimited CRM & email"]'::jsonb,
  true, 5,
  320, 8, 3, NULL, NULL, NULL,
  false, ARRAY['video_style_1', 'video_style_2', 'video_style_4'], 'multi_branch', 'week'
),
-- Multi-Branch Large (up to 20 hubs)
(
  'multi_branch_l', 'Multi-Branch L', 'For large agency groups',
  0, 40000, 200,
  '["Up to 20 social hubs", "40 listings per hub (800 total)", "3 posts per listing per week", "All video styles", "Unlimited lead magnets", "Unlimited CRM & email"]'::jsonb,
  true, 6,
  800, 20, 3, NULL, NULL, NULL,
  false, ARRAY['video_style_1', 'video_style_2', 'video_style_4'], 'multi_branch', 'week'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  monthly_credits = EXCLUDED.monthly_credits,
  max_users = EXCLUDED.max_users,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order,
  max_listings = EXCLUDED.max_listings,
  max_social_hubs = EXCLUDED.max_social_hubs,
  max_posts_per_listing_per_week = EXCLUDED.max_posts_per_listing_per_week,
  max_lead_magnets_per_week = EXCLUDED.max_lead_magnets_per_week,
  max_crm_contacts = EXCLUDED.max_crm_contacts,
  max_email_campaigns_per_month = EXCLUDED.max_email_campaigns_per_month,
  has_watermark = EXCLUDED.has_watermark,
  allowed_video_styles = EXCLUDED.allowed_video_styles,
  plan_tier = EXCLUDED.plan_tier,
  billing_interval = EXCLUDED.billing_interval,
  updated_at = now();

-- ============================================================================
-- STEP 5: Set existing orgs to 'free' plan by default
-- (Pilot orgs will get billing_override set separately)
-- ============================================================================

UPDATE public.organizations
SET current_plan_name = 'free'
WHERE current_plan_name IS NULL;

-- ============================================================================
-- STEP 6: Update account_status check constraint to include 'free' status
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_account_status_check'
  ) THEN
    ALTER TABLE public.organizations DROP CONSTRAINT organizations_account_status_check;
  END IF;

  ALTER TABLE public.organizations ADD CONSTRAINT organizations_account_status_check
    CHECK (account_status IN ('free', 'trial', 'trial_expired', 'active', 'payment_failed', 'unsubscribed', 'archived'));
END $$;

-- ============================================================================
-- STEP 7: Create stored procedure for plan limit checking
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sp_check_plan_limits(
  p_organization_id UUID,
  p_check_type TEXT -- 'listing', 'social_hub', 'crm_contact'
)
RETURNS TABLE (
  allowed BOOLEAN,
  current_count INTEGER,
  max_allowed INTEGER,
  plan_name TEXT,
  is_override BOOLEAN,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org RECORD;
  v_plan RECORD;
  v_current_count INTEGER;
  v_max_allowed INTEGER;
  v_is_override BOOLEAN := false;
  v_plan_name TEXT;
BEGIN
  -- Fetch org with billing override
  SELECT o.billing_override, o.current_plan_name, o.account_status
  INTO v_org
  FROM public.organizations o
  WHERE o.id = p_organization_id;

  -- If billing_override is set, use the override plan
  IF v_org.billing_override IS NOT NULL AND v_org.billing_override ->> 'plan_equivalent' IS NOT NULL THEN
    v_plan_name := v_org.billing_override ->> 'plan_equivalent';
    v_is_override := true;
  ELSE
    v_plan_name := COALESCE(v_org.current_plan_name, 'free');
  END IF;

  -- Fetch plan limits
  SELECT * INTO v_plan
  FROM public.plan_definitions pd
  WHERE pd.name = v_plan_name AND pd.is_active = true;

  IF v_plan IS NULL THEN
    -- Fallback to free plan limits
    SELECT * INTO v_plan
    FROM public.plan_definitions pd
    WHERE pd.name = 'free' AND pd.is_active = true;
    v_plan_name := 'free';
  END IF;

  -- Get current count and max based on check type
  CASE p_check_type
    WHEN 'listing' THEN
      SELECT COUNT(*) INTO v_current_count
      FROM public.listings l
      WHERE l.organization_id = p_organization_id;
      v_max_allowed := v_plan.max_listings;

    WHEN 'social_hub' THEN
      SELECT COUNT(*) INTO v_current_count
      FROM public.social_hubs sh
      WHERE sh.organization_id = p_organization_id AND sh.is_active = true;
      v_max_allowed := v_plan.max_social_hubs;

    WHEN 'crm_contact' THEN
      -- Count all CRM contacts (sellers + buyers)
      BEGIN
        SELECT COUNT(*) INTO v_current_count
        FROM crm.seller_profiles sp
        WHERE sp.organization_id = p_organization_id;
        v_current_count := v_current_count + (
          SELECT COUNT(*) FROM crm.buyer_profiles bp
          WHERE bp.organization_id = p_organization_id
        );
      EXCEPTION WHEN undefined_table THEN
        v_current_count := 0;
      END;
      v_max_allowed := v_plan.max_crm_contacts;

    ELSE
      -- Unknown check type — allow by default
      RETURN QUERY SELECT true, 0, 0, v_plan_name, v_is_override, 'Unknown check type'::TEXT;
      RETURN;
  END CASE;

  -- NULL max = unlimited
  IF v_max_allowed IS NULL THEN
    RETURN QUERY SELECT true, v_current_count, v_max_allowed, v_plan_name, v_is_override, NULL::TEXT;
    RETURN;
  END IF;

  -- Check limit
  IF v_current_count >= v_max_allowed THEN
    RETURN QUERY SELECT
      false,
      v_current_count,
      v_max_allowed,
      v_plan_name,
      v_is_override,
      format('You have reached the maximum of %s %ss on your %s plan. Upgrade to add more.',
        v_max_allowed, p_check_type, v_plan.display_name)::TEXT;
  ELSE
    RETURN QUERY SELECT true, v_current_count, v_max_allowed, v_plan_name, v_is_override, NULL::TEXT;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.sp_check_plan_limits IS 'Check if an organization has exceeded its plan limits for a given resource type. Respects billing_override for pilot customers.';

-- ============================================================================
-- STEP 8: Create helper view for org plan summary
-- ============================================================================

CREATE OR REPLACE VIEW public.v_organization_plan_summary AS
SELECT
  o.id AS organization_id,
  o.business_name AS organization_name,
  COALESCE(
    o.billing_override ->> 'plan_equivalent',
    o.current_plan_name,
    'free'
  ) AS effective_plan_name,
  pd.display_name AS plan_display_name,
  pd.plan_tier,
  pd.max_listings,
  pd.max_social_hubs,
  pd.max_posts_per_listing_per_week,
  pd.max_lead_magnets_per_week,
  pd.max_crm_contacts,
  pd.max_email_campaigns_per_month,
  pd.has_watermark,
  pd.allowed_video_styles,
  pd.monthly_credits,
  pd.max_users,
  o.billing_override IS NOT NULL AS has_billing_override,
  o.billing_override,
  o.account_status,
  o.credit_spending_enabled,
  (SELECT COUNT(*) FROM public.listings l WHERE l.organization_id = o.id) AS listing_count,
  (SELECT COUNT(*) FROM public.social_hubs sh WHERE sh.organization_id = o.id AND sh.is_active = true) AS hub_count
FROM public.organizations o
LEFT JOIN public.plan_definitions pd ON pd.name = COALESCE(
  o.billing_override ->> 'plan_equivalent',
  o.current_plan_name,
  'free'
);

COMMENT ON VIEW public.v_organization_plan_summary IS 'Summary of each org plan, limits, and current usage counts. Respects billing overrides.';

SELECT 'Plan definitions expanded and billing tiers seeded successfully!' as result;
