-- Phase 1: Social Hub Zoning
-- Creates social_hubs table and adds hub references to listings, social accounts,
-- schedule templates, and posting schedules.
-- Social hubs allow large agencies to zone listings into separate posting branches,
-- each with their own social accounts and schedules.

-- ============================================================================
-- STEP 1: Create social_hubs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.social_hubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Only one default hub per org
  CONSTRAINT unique_default_hub_per_org UNIQUE (organization_id, is_default)
);

-- Drop the unique constraint and replace with a partial unique index
-- (UNIQUE constraint can't filter on is_default = true)
ALTER TABLE public.social_hubs DROP CONSTRAINT IF EXISTS unique_default_hub_per_org;

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_default_hub_per_org
  ON public.social_hubs (organization_id)
  WHERE is_default = true;

COMMENT ON TABLE public.social_hubs IS 'Social media posting branches within an organization. Each hub owns social accounts, schedules, and is assigned listings.';
COMMENT ON COLUMN public.social_hubs.is_default IS 'The default hub auto-created for each org. Existing listings and accounts are assigned here.';

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_social_hubs_org ON public.social_hubs(organization_id);
CREATE INDEX IF NOT EXISTS idx_social_hubs_active ON public.social_hubs(organization_id, is_active) WHERE is_active = true;

-- ============================================================================
-- STEP 2: Enable RLS on social_hubs
-- ============================================================================

ALTER TABLE public.social_hubs ENABLE ROW LEVEL SECURITY;

-- Users can view hubs for their org
CREATE POLICY "Users can view their org social hubs"
  ON public.social_hubs FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_organizations
      WHERE user_id = auth.uid()
    )
  );

-- Admins can manage hubs
CREATE POLICY "Admins can manage social hubs"
  ON public.social_hubs FOR ALL
  TO authenticated
  USING (
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

-- Service role full access
CREATE POLICY "Service role full access to social hubs"
  ON public.social_hubs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 3: Add social_hub_id to listings
-- ============================================================================

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS social_hub_id UUID REFERENCES public.social_hubs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_listings_social_hub ON public.listings(social_hub_id) WHERE social_hub_id IS NOT NULL;

COMMENT ON COLUMN public.listings.social_hub_id IS 'Which social hub this listing is zoned to for posting. NULL = default hub.';

-- ============================================================================
-- STEP 4: Add social_hub_id to organization_social_accounts
-- ============================================================================

ALTER TABLE public.organization_social_accounts
  ADD COLUMN IF NOT EXISTS social_hub_id UUID REFERENCES public.social_hubs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_org_social_accounts_hub
  ON public.organization_social_accounts(social_hub_id) WHERE social_hub_id IS NOT NULL;

COMMENT ON COLUMN public.organization_social_accounts.social_hub_id IS 'Which social hub this account belongs to. NULL = default hub.';

-- ============================================================================
-- STEP 5: Add social_hub_id to recurring_schedule_templates
-- ============================================================================

ALTER TABLE public.recurring_schedule_templates
  ADD COLUMN IF NOT EXISTS social_hub_id UUID REFERENCES public.social_hubs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_templates_hub
  ON public.recurring_schedule_templates(social_hub_id) WHERE social_hub_id IS NOT NULL;

-- ============================================================================
-- STEP 6: Add social_hub_id to listing_posting_schedule
-- ============================================================================

ALTER TABLE public.listing_posting_schedule
  ADD COLUMN IF NOT EXISTS social_hub_id UUID REFERENCES public.social_hubs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posting_schedule_hub
  ON public.listing_posting_schedule(social_hub_id) WHERE social_hub_id IS NOT NULL;

-- ============================================================================
-- STEP 7: Add social_hub_id to listing_schedule_slots
-- ============================================================================

ALTER TABLE public.listing_schedule_slots
  ADD COLUMN IF NOT EXISTS social_hub_id UUID REFERENCES public.social_hubs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_slots_hub
  ON public.listing_schedule_slots(social_hub_id) WHERE social_hub_id IS NOT NULL;

-- ============================================================================
-- STEP 8: Create function to auto-create default hub for existing orgs
-- ============================================================================

-- Create default hubs for all existing organizations that don't have one
INSERT INTO public.social_hubs (organization_id, name, is_default)
SELECT id, 'Main', true
FROM public.organizations
WHERE id NOT IN (
  SELECT organization_id FROM public.social_hubs WHERE is_default = true
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 9: Create trigger to auto-create default hub on new org creation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_default_social_hub()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.social_hubs (organization_id, name, is_default)
  VALUES (NEW.id, 'Main', true)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_org_insert_create_default_hub ON public.organizations;

CREATE TRIGGER after_org_insert_create_default_hub
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_social_hub();

-- ============================================================================
-- STEP 10: Backfill existing listings with their org's default hub
-- ============================================================================

UPDATE public.listings l
SET social_hub_id = sh.id
FROM public.social_hubs sh
WHERE l.organization_id = sh.organization_id
  AND sh.is_default = true
  AND l.social_hub_id IS NULL;

-- ============================================================================
-- STEP 11: Backfill existing social accounts with their org's default hub
-- ============================================================================

UPDATE public.organization_social_accounts osa
SET social_hub_id = sh.id
FROM public.social_hubs sh
WHERE osa.organization_id = sh.organization_id
  AND sh.is_default = true
  AND osa.social_hub_id IS NULL;

SELECT 'Social hub zoning created successfully!' as result;
