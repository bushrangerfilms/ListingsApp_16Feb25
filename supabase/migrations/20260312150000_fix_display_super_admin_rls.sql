-- Fix super admin RLS policies on display tables to use user_roles (consistent with rest of app)
-- The previous policies incorrectly referenced admin_users table which has stale data

-- Drop old policies
DROP POLICY IF EXISTS "Super admins can manage display_signage_settings" ON public.display_signage_settings;
DROP POLICY IF EXISTS "Super admins can manage display_analytics" ON public.display_analytics;

-- Recreate using user_roles (matches organizations, discount_codes, etc.)
CREATE POLICY "Super admins can manage display_signage_settings"
  ON public.display_signage_settings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin'::app_role, 'developer'::app_role)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'::app_role
  ));

CREATE POLICY "Super admins can manage display_analytics"
  ON public.display_analytics FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin'::app_role, 'developer'::app_role)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'::app_role
  ));
