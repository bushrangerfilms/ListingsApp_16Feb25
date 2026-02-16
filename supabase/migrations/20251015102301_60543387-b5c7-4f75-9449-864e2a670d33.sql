-- Remove the single admin constraint to allow multiple admins
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS unique_single_admin;