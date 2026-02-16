-- Remove the unique constraint that limits to a single admin
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS unique_single_admin;