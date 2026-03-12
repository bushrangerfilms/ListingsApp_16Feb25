-- Add super admin RLS bypass to display signage tables
-- (matches pattern used by ai_instruction_sets, billing_profiles, etc.)

CREATE POLICY "Super admins can manage display_signage_settings"
  ON public.display_signage_settings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = (auth.uid())::text
      AND admin_users.role IN ('super_admin', 'developer')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = (auth.uid())::text
      AND admin_users.role = 'super_admin'
  ));

CREATE POLICY "Super admins can manage display_analytics"
  ON public.display_analytics FOR ALL
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = (auth.uid())::text
      AND admin_users.role IN ('super_admin', 'developer')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = (auth.uid())::text
      AND admin_users.role = 'super_admin'
  ));
