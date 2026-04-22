-- Shared read-through cache for lead-magnet AI content (Market Update insights
-- and Tips & Advice articles). Each Gemini call is the expensive unit; caching
-- by (org, content_type, normalized_area, YYYY-MM) caps spend at a predictable
-- ceiling of orgs × types × areas × months, independent of visitor traffic.
--
-- Key design choices:
--  * Monthly period bucket (not a rolling TTL): predictable, easy to reason about.
--  * area_normalized is lowercased + trimmed on write so "Wexford" vs
--    "wexford" vs " Wexford " don't thrash. Empty string for the no-area case.
--  * jsonb content holds whatever the respective Gemini prompt returns; each
--    handler plucks its own shape out.
--  * LWW via ON CONFLICT DO NOTHING — two concurrent misses both generate,
--    second upsert is a no-op, both visitors get their independently-generated
--    content. Duplicate calls bounded to concurrency, not visitor count.

create table if not exists public.lead_magnet_ai_cache (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_type text not null check (content_type in ('market-update', 'tips-advice')),
  area_normalized text not null,
  period text not null,
  content jsonb not null,
  generated_at timestamptz not null default now(),
  primary key (organization_id, content_type, area_normalized, period)
);

alter table public.lead_magnet_ai_cache enable row level security;

create policy "service_role_all_lead_magnet_ai_cache"
  on public.lead_magnet_ai_cache
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.lead_magnet_ai_cache is
  'Read-through cache for Gemini-generated lead magnet content. Key: (org, content_type, lowercased/trimmed area, YYYY-MM). LWW on conflict.';
