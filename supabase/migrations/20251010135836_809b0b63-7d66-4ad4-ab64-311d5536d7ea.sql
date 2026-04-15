-- Create security definer function to check if admin exists
CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE role = 'admin'
  );
$$;

-- Add RLS policy to allow first authenticated user to become admin
CREATE POLICY "Bootstrap first admin"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  role = 'admin'
  AND user_id = auth.uid()
  AND NOT public.admin_exists()
);

-- Add policy to allow users to read their own roles
CREATE POLICY "Users can read own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Enforce single admin with unique partial index
CREATE UNIQUE INDEX IF NOT EXISTS unique_single_admin
ON public.user_roles ((role))
WHERE role = 'admin';