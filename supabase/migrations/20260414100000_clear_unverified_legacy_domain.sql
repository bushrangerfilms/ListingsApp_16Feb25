-- Cleanup: clear `organizations.domain` for any row whose custom_domain_status
-- is not 'verified'. This column was previously populated manually or by
-- legacy flows and now drives public routing (LinksPage, domainDetection) —
-- stale values route real visitors to dead domains.
--
-- After this runs, `organizations.domain` is only non-null when the org's
-- custom domain has been verified via the manage-custom-domain flow.

UPDATE public.organizations
SET domain = NULL
WHERE domain IS NOT NULL
  AND (custom_domain_status IS NULL OR custom_domain_status <> 'verified');
