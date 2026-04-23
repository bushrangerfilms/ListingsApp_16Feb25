-- Market Update / Tips & Advice redesign (2026-04-23):
--
-- 1. Extend lead_magnet_ai_cache.content_type CHECK to accept the v2 content
--    shapes. Old ('market-update' / 'tips-advice') rows stay in the table but
--    are no longer read — the handlers now query 'market-update-v2' /
--    'tips-advice-v2', so expanded schema (trends, outlook, extended comps,
--    per-tip how_to / pitfalls / pro_tip) doesn't clash with April 2026 rows
--    already cached under the old keys. Month rollover will purge old rows
--    implicitly via the monthly period bucket.
--
-- 2. New market_index_cache table for 24h-TTL regional HPI data pulled from
--    public statistics authorities (Eurostat for IE, ONS for GB; other markets
--    stubbed). Cross-checks LLM-generated trend arrays against the regional
--    index — if outside the ±50% plausibility band, replaces the LLM series;
--    if within, footnotes as "cross-referenced against <Source>". Cache is
--    keyed by (country, region) so a single fetch serves every org in that
--    region for 24h.

alter table public.lead_magnet_ai_cache
  drop constraint if exists lead_magnet_ai_cache_content_type_check;

alter table public.lead_magnet_ai_cache
  add constraint lead_magnet_ai_cache_content_type_check
  check (content_type in (
    'market-update',
    'tips-advice',
    'market-update-v2',
    'tips-advice-v2'
  ));

create table if not exists public.market_index_cache (
  country_code text not null,
  region_key text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (country_code, region_key)
);

alter table public.market_index_cache enable row level security;

create policy "service_role_all_market_index_cache"
  on public.market_index_cache
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.market_index_cache is
  '24h-TTL cache of regional house price indices (Eurostat/ONS/etc). Read by lead-magnet-api before Gemini response is served so historical trend arrays can be cross-checked against an authoritative regional source.';
