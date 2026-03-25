-- Add super admin read access to onboarding_progress and org_end_card_settings.
-- These tables were missing the super_admin bypass that other tables have,
-- causing the onboarding checklist and branding banner to incorrectly show
-- when a super admin views an org they're not a direct member of.

CREATE POLICY "Super admins can view any onboarding_progress"
ON public.onboarding_progress FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'super_admin'
  )
);

CREATE POLICY "Super admins can view any org_end_card_settings"
ON public.org_end_card_settings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'super_admin'
  )
);
