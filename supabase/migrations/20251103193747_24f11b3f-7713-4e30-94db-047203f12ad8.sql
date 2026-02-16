-- Phase 2.1b: Assign developer role to the first admin user

-- Create helper function
CREATE OR REPLACE FUNCTION get_first_admin_user_id()
RETURNS uuid AS $$
DECLARE
  admin_user_id uuid;
BEGIN
  SELECT user_id INTO admin_user_id
  FROM public.user_roles
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;
  
  RETURN admin_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Assign developer role
INSERT INTO public.user_roles (user_id, role)
SELECT get_first_admin_user_id(), 'developer'
WHERE get_first_admin_user_id() IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;