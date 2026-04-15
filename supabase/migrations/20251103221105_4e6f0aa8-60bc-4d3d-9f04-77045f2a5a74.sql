-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Organization admins can manage memberships" ON public.user_organizations;

-- Create a new policy that uses security definer functions to avoid recursion
CREATE POLICY "Admins can manage their org memberships"
ON public.user_organizations
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);