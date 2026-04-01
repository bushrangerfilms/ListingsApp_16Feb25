-- Phase 2: Expand lead_magnets to support CTA types + add UTM to valuation_requests

-- 2.1: Expand type constraint
ALTER TABLE public.lead_magnets DROP CONSTRAINT IF EXISTS lead_magnets_type_check;
ALTER TABLE public.lead_magnets ADD CONSTRAINT lead_magnets_type_check
  CHECK (type IN ('READY_TO_SELL', 'WORTH_ESTIMATE', 'FREE_VALUATION', 'MARKET_UPDATE', 'TIPS_ADVICE'));

-- 2.2: Auto-provision CTA lead_magnets for all existing orgs
INSERT INTO public.lead_magnets (id, organization_id, type, is_enabled)
SELECT gen_random_uuid(), o.id, t.type, true
FROM public.organizations o
CROSS JOIN (VALUES ('FREE_VALUATION'), ('MARKET_UPDATE'), ('TIPS_ADVICE')) AS t(type)
WHERE o.id != '00000000-0000-0000-0000-000000000000'
ON CONFLICT (organization_id, type) DO NOTHING;

-- 2.3: Add UTM columns to valuation_requests
ALTER TABLE public.valuation_requests
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT,
  ADD COLUMN IF NOT EXISTS post_id TEXT;
