-- Add optional postcode/Eircode column to valuation_requests.
-- The human-readable label (Eircode / Postcode / ZIP Code / Postal Code) is
-- resolved on the client from the organization's locale via
-- src/lib/regionConfig/postcodes.ts. The column itself stores the raw
-- user-entered value.

ALTER TABLE public.valuation_requests
  ADD COLUMN IF NOT EXISTS postcode TEXT;

COMMENT ON COLUMN public.valuation_requests.postcode IS
  'Optional postcode/Eircode/ZIP provided by the homeowner on the Request Valuation form. Label is locale-driven by the organization''s market.';
