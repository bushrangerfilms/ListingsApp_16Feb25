-- Phase 2: Add region settings to organizations table
-- Enables multi-region support (IE, GB, US) with locale-specific formatting

-- Add locale column (determines language and regional formatting)
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'en-IE';

-- Add currency column (EUR, GBP, USD)
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'EUR';

-- Add timezone column (for date/time display)
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Europe/Dublin';

-- Add VAT rate column (Ireland 23%, UK 20%, US 0%)
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,4) DEFAULT 0.23;

-- Add country code for address validation and compliance
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) DEFAULT 'IE';

-- Create index for filtering by locale/region
CREATE INDEX IF NOT EXISTS idx_organizations_locale ON public.organizations(locale);
CREATE INDEX IF NOT EXISTS idx_organizations_country_code ON public.organizations(country_code);

-- Add check constraint for supported locales
ALTER TABLE public.organizations 
DROP CONSTRAINT IF EXISTS chk_organizations_locale;

ALTER TABLE public.organizations 
ADD CONSTRAINT chk_organizations_locale 
CHECK (locale IN ('en-IE', 'en-GB', 'en-US'));

-- Add check constraint for supported currencies
ALTER TABLE public.organizations 
DROP CONSTRAINT IF EXISTS chk_organizations_currency;

ALTER TABLE public.organizations 
ADD CONSTRAINT chk_organizations_currency 
CHECK (currency IN ('EUR', 'GBP', 'USD'));

-- Add check constraint for supported country codes
ALTER TABLE public.organizations 
DROP CONSTRAINT IF EXISTS chk_organizations_country_code;

ALTER TABLE public.organizations 
ADD CONSTRAINT chk_organizations_country_code 
CHECK (country_code IN ('IE', 'GB', 'US'));

COMMENT ON COLUMN public.organizations.locale IS 'UI locale for translations and formatting (en-IE, en-GB, en-US)';
COMMENT ON COLUMN public.organizations.currency IS 'Currency code for financial displays (EUR, GBP, USD)';
COMMENT ON COLUMN public.organizations.timezone IS 'Timezone for date/time displays';
COMMENT ON COLUMN public.organizations.vat_rate IS 'VAT/tax rate as decimal (0.23 = 23%)';
COMMENT ON COLUMN public.organizations.country_code IS 'ISO country code for address validation and compliance';
