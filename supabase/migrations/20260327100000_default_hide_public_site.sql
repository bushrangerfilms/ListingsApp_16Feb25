-- Default new organizations to have public site hidden
-- Existing orgs are not affected
ALTER TABLE public.organizations
  ALTER COLUMN hide_public_site SET DEFAULT true;
