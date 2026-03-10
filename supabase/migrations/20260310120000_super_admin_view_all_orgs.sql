-- Allow super admins to view all organizations in the org switcher dropdown
-- PostgreSQL RLS is OR-based across policies, so this doesn't affect existing policies

CREATE POLICY "Super admins can view all organizations"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );
