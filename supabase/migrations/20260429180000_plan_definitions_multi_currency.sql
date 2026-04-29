-- Add per-currency Stripe price ID + cents columns to plan_definitions.
--
-- Existing columns become EUR canonical:
--   monthly_price_cents       (EUR, smallest unit)
--   stripe_monthly_price_id   (EUR price ID)
--
-- New columns mirror that pair for each non-EUR market: GBP / USD / CAD /
-- AUD / NZD.  All start NULL and are populated by `scripts/seed-stripe-
-- prices.ts` which reads `locale-config/pricing.yaml`.
--
-- Once a market has BOTH columns set for every active plan, `stripe-
-- checkout` switches that market's checkouts to USD/etc.  Until then,
-- `stripe-checkout` falls back to EUR for that market and shows
-- "Pricing in EUR" microcopy in the UI.
--
-- Idempotent.

ALTER TABLE public.plan_definitions
  ADD COLUMN IF NOT EXISTS price_cents_gbp           INTEGER,
  ADD COLUMN IF NOT EXISTS price_cents_usd           INTEGER,
  ADD COLUMN IF NOT EXISTS price_cents_cad           INTEGER,
  ADD COLUMN IF NOT EXISTS price_cents_aud           INTEGER,
  ADD COLUMN IF NOT EXISTS price_cents_nzd           INTEGER,
  ADD COLUMN IF NOT EXISTS stripe_monthly_price_id_gbp TEXT,
  ADD COLUMN IF NOT EXISTS stripe_monthly_price_id_usd TEXT,
  ADD COLUMN IF NOT EXISTS stripe_monthly_price_id_cad TEXT,
  ADD COLUMN IF NOT EXISTS stripe_monthly_price_id_aud TEXT,
  ADD COLUMN IF NOT EXISTS stripe_monthly_price_id_nzd TEXT;

COMMENT ON COLUMN public.plan_definitions.monthly_price_cents IS
  'Plan price in EUR cents (canonical).  See price_cents_{gbp,usd,cad,aud,nzd} for other currencies.';
COMMENT ON COLUMN public.plan_definitions.stripe_monthly_price_id IS
  'Stripe Price ID for EUR (canonical).  See stripe_monthly_price_id_{gbp,usd,cad,aud,nzd}.';
COMMENT ON COLUMN public.plan_definitions.price_cents_usd IS
  'Plan price in USD cents.  Populated by seed-stripe-prices.ts from locale-config/pricing.yaml.  NULL = USD pricing not yet active for this plan; stripe-checkout falls back to EUR.';

-- Seed the EUR-equivalent rows from existing data so price_cents_eur is
-- effectively `monthly_price_cents`.  No new column needed for EUR — it's
-- already canonical.
--
-- All other columns left NULL.  Activation is a separate step:
-- `npx tsx scripts/seed-stripe-prices.ts` reads pricing.yaml, calls Stripe
-- API to create Price objects, writes back stripe_monthly_price_id_*
-- and price_cents_* values.
