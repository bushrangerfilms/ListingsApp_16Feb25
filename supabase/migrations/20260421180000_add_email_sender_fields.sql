-- Phase 2: Auto-provision Resend sender subdomain on custom-domain verification.
-- Adds mirror columns to track the Resend sender state alongside custom_domain_status.
-- Lives under organizations, populated by the extended manage-custom-domain edge function.
--
-- Bridge Auctioneers: these columns remain null on Bridge. Their legacy
-- organizations.from_email ('noreply@em.bridgeauctioneers.ie') stays untouched
-- and continues to be honoured by _shared/resolve-sender.ts, which reads
-- from_email ahead of any Phase 2 logic.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS email_sender_domain TEXT,
  ADD COLUMN IF NOT EXISTS email_sender_resend_id TEXT,
  ADD COLUMN IF NOT EXISTS email_sender_status TEXT,
  ADD COLUMN IF NOT EXISTS email_sender_dns_records JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_email_sender_status_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_email_sender_status_check
      CHECK (email_sender_status IS NULL OR email_sender_status IN ('pending','dns_configured','verified','failed'));
  END IF;
END$$;

COMMENT ON COLUMN public.organizations.email_sender_domain IS
  'Resend-registered sender subdomain (e.g. em.bridgeauctioneers.ie). Set by manage-custom-domain when a paid org verifies a custom public domain.';
COMMENT ON COLUMN public.organizations.email_sender_resend_id IS
  'Resend domain UUID — used to poll verification status and to delete the domain from Resend on cleanup.';
COMMENT ON COLUMN public.organizations.email_sender_status IS
  'Lifecycle of the Resend sender: pending -> dns_configured -> verified | failed. Mirrors custom_domain_status semantics.';
COMMENT ON COLUMN public.organizations.email_sender_dns_records IS
  'DKIM / SPF / MX records Resend returned at create time. Rendered in the CustomDomainSetup DNS guide so the agent can copy them into their DNS provider.';
