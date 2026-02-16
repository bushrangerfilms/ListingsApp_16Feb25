-- Fix security warning: Set search_path for function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;