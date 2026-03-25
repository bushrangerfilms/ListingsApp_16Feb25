-- Fix remaining RLS policies that reference admin_users instead of user_roles
-- admin_users has stale data; user_roles is the canonical source of truth for roles

-- ai_instruction_sets
DROP POLICY IF EXISTS "Super admins can manage ai_instruction_sets" ON public.ai_instruction_sets;
CREATE POLICY "Super admins can manage ai_instruction_sets"
  ON public.ai_instruction_sets FOR ALL
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

-- ai_instruction_history
DROP POLICY IF EXISTS "Super admins can view ai_instruction_history" ON public.ai_instruction_history;
CREATE POLICY "Super admins can view ai_instruction_history"
  ON public.ai_instruction_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin'::app_role, 'developer'::app_role)
  ));
