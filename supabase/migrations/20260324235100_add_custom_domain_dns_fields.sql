-- Add Railway DNS details to organizations for custom domain setup
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS custom_domain_cname_target text,
  ADD COLUMN IF NOT EXISTS custom_domain_verification_token text,
  ADD COLUMN IF NOT EXISTS custom_domain_status text DEFAULT 'pending'
    CHECK (custom_domain_status IN ('pending', 'dns_configured', 'verified', 'needs_attention'));

COMMENT ON COLUMN public.organizations.custom_domain_cname_target IS 'Railway CNAME target for custom domain (e.g., fc25q8h6.up.railway.app)';
COMMENT ON COLUMN public.organizations.custom_domain_verification_token IS 'Railway verification TXT record value for domain ownership';
COMMENT ON COLUMN public.organizations.custom_domain_status IS 'Custom domain status: pending, dns_configured, verified, needs_attention';

-- Update bridgeauctioneers.ie org with current Railway DNS details and flag it
UPDATE public.organizations
SET
  custom_domain_cname_target = 'fc25q8h6.up.railway.app',
  custom_domain_verification_token = 'railway-verify=89bea58ebca73c7b432977c8617317d0e8fc8d25affe52e52d1b5fa3605b1719',
  custom_domain_status = 'needs_attention'
WHERE custom_domain = 'bridgeauctioneers.ie';
