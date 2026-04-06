-- Change default for require_post_approval to true for new orgs
-- Existing orgs are NOT affected — only future INSERT rows get the new default
ALTER TABLE public.organization_settings
  ALTER COLUMN require_post_approval SET DEFAULT true;
