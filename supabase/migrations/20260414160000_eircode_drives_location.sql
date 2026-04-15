-- Worth Estimate quiz: capture Claude's eircode resolution alongside the
-- valuation. `resolved_town` / `resolved_county` are the authoritative area
-- the estimate is anchored to; they may differ from the user-typed town
-- when the eircode resolution kicks in (e.g. user types "Ballinasloe" but
-- their eircode is actually 25 minutes away).
--
-- These columns are set inside lead-magnet-api/handleSubmit from the
-- `report_market_research` tool output.

ALTER TABLE public.lead_submissions
  ADD COLUMN IF NOT EXISTS resolved_town text,
  ADD COLUMN IF NOT EXISTS resolved_county text,
  ADD COLUMN IF NOT EXISTS resolution_confidence text
    CHECK (resolution_confidence IS NULL
           OR resolution_confidence IN ('high', 'medium', 'low'));

COMMENT ON COLUMN public.lead_submissions.resolved_town IS
  'Town the AI resolved from the user''s eircode (or echoed from user-typed '
  'town when no eircode was provided). This — not answers_json.town — is '
  'the authoritative location the estimate is anchored on.';

COMMENT ON COLUMN public.lead_submissions.resolved_county IS
  'County the AI resolved from the user''s eircode. Authoritative region '
  'for the estimate.';

COMMENT ON COLUMN public.lead_submissions.resolution_confidence IS
  'How confident the AI was in resolving the eircode to a specific area: '
  'high = exact postcode known, medium = general area inferred, low = best '
  'guess or fallback from user-typed town.';
