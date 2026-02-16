-- Add super_admin role to the current user (keeping admin role as well)
INSERT INTO public.user_roles (user_id, role)
VALUES ('951ae6b9-2e95-4d9c-8e2a-53a26eae17d0'::uuid, 'super_admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;