-- Drop the stale `chk_organizations_locale` CHECK constraint that only
-- allowed en-IE / en-GB / en-US.  Twin constraint `organizations_locale_check`
-- already covers all 6 supported markets (IE/GB/US/CA/AU/NZ); the older
-- 3-locale check would silently reject any en-CA / en-AU / en-NZ write
-- because both constraints must pass.
--
-- This was discovered during the 2026-04-29 Tier 5 audit when the missing
-- `us_launch` feature flag prompted a wider locale-stack inspection.  The
-- IE/GB/US-only constraint hadn't fired in production because no org has
-- yet attempted to set its locale to en-CA / en-AU / en-NZ; once one does,
-- that write would have hit a confusing CHECK error rather than the
-- intended 6-locale validation.
--
-- Idempotent.

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS chk_organizations_locale;

COMMENT ON COLUMN public.organizations.locale IS 'BCP-47 market locale. Allowed: en-IE, en-GB, en-US, en-CA, en-AU, en-NZ. Enforced by organizations_locale_check; this column should match the canonical MarketLocale type in locale-config/locale.config.ts.';
