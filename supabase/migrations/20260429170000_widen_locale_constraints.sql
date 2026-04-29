-- Widen organizations.country_code and organizations.currency CHECK constraints
-- to cover all six supported markets: IE, GB, US, CA, AU, NZ.
--
-- Why: regionConfig and the edge function _shared/locale-config.ts already
-- support all six locales, but the DB still rejects CA/AU/NZ inserts. This
-- blocks the canonical locale-config rollout and any future market launch.
--
-- Idempotent: drops existing constraints if present, recreates with the wider set.

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS chk_organizations_country_code;

ALTER TABLE public.organizations
  ADD CONSTRAINT chk_organizations_country_code
  CHECK (country_code IN ('IE', 'GB', 'US', 'CA', 'AU', 'NZ'));

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS chk_organizations_currency;

ALTER TABLE public.organizations
  ADD CONSTRAINT chk_organizations_currency
  CHECK (currency IN ('EUR', 'GBP', 'USD', 'CAD', 'AUD', 'NZD'));

COMMENT ON COLUMN public.organizations.country_code IS 'ISO 3166-1 alpha-2 country code. Allowed: IE, GB, US, CA, AU, NZ.';
COMMENT ON COLUMN public.organizations.currency IS 'ISO 4217 currency code. Allowed: EUR, GBP, USD, CAD, AUD, NZD.';
