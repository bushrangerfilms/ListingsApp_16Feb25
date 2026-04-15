-- Phase 4: Create onboarding_progress table
-- Tracks user onboarding task completion per organization

CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tasks_completed JSONB DEFAULT '{}'::jsonb,
  welcome_seen_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT onboarding_progress_org_unique UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_org ON public.onboarding_progress(organization_id);

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org onboarding" ON public.onboarding_progress
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own org onboarding" ON public.onboarding_progress
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own org onboarding" ON public.onboarding_progress
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_onboarding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER onboarding_progress_updated_at
  BEFORE UPDATE ON public.onboarding_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_onboarding_updated_at();
