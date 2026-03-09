-- Expand CHECK constraints on organizations table to support all 6 markets
-- Markets: IE, GB, US, CA, AU, NZ

-- Drop existing constraints
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_locale_check;
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_currency_check;
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_country_code_check;

-- Recreate with all 6 markets
ALTER TABLE organizations ADD CONSTRAINT organizations_locale_check
  CHECK (locale IN ('en-IE', 'en-GB', 'en-US', 'en-CA', 'en-AU', 'en-NZ'));

ALTER TABLE organizations ADD CONSTRAINT organizations_currency_check
  CHECK (currency IN ('EUR', 'GBP', 'USD', 'CAD', 'AUD', 'NZD'));

ALTER TABLE organizations ADD CONSTRAINT organizations_country_code_check
  CHECK (country_code IN ('IE', 'GB', 'US', 'CA', 'AU', 'NZ'));

-- Add feature flags for new markets
INSERT INTO feature_flags (key, name, description, default_state, is_active) VALUES
  ('ca_launch', 'Canada Launch', 'Enable Canada (en-CA) market', false, true),
  ('au_launch', 'Australia Launch', 'Enable Australia (en-AU) market', false, true),
  ('nz_launch', 'New Zealand Launch', 'Enable New Zealand (en-NZ) market', false, true)
ON CONFLICT (key) DO NOTHING;
