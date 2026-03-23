-- Update plan tiers with finalized pricing and limits (2026-03-23)
-- Adds Growth tier, updates all limits, sets EUR weekly prices,
-- removes CRM/email caps, adjusts multi-branch hub counts.

-- ============================================================================
-- STEP 1: Insert/update all plan tiers with final values
-- ============================================================================

INSERT INTO public.plan_definitions (
  name, display_name, description, monthly_price_cents,
  monthly_credits, max_users, features, is_active, display_order,
  max_listings, max_social_hubs, max_posts_per_listing_per_week,
  max_lead_magnets_per_week, max_crm_contacts, max_email_campaigns_per_month,
  has_watermark, allowed_video_styles, plan_tier, billing_interval
) VALUES
-- Free tier (3 listings, VS1+VS3, watermark, website with watermark)
(
  'free', 'Free', 'Try AutoListing with up to 3 listings — includes website with watermark',
  0, 50, 1,
  '["3 listings", "1 post per listing per week", "2 lead magnets per week", "VS1 & VS3 video styles", "Website with watermark", "CRM & email included"]'::jsonb,
  true, 1,
  3, 1, 1, 2, NULL, NULL,
  true, ARRAY['video_style_1', 'video_style_3'], 'free', 'week'
),
-- Essentials (€40/week)
(
  'essentials', 'Essentials', 'Perfect for solo agents growing their social presence',
  4000, 500, 5,
  '["Up to 10 listings", "2 posts per listing per week", "3 lead magnets per week", "All video styles", "CRM & email included"]'::jsonb,
  true, 2,
  10, 1, 2, 3, NULL, NULL,
  false, ARRAY['video_style_1', 'video_style_2', 'video_style_3', 'video_style_4'], 'standard', 'week'
),
-- Growth (€70/week) — NEW
(
  'growth', 'Growth', 'For agents with a growing portfolio',
  7000, 1200, 10,
  '["Up to 25 listings", "2 posts per listing per week", "5 lead magnets per week", "All video styles", "Up to 10 team members", "CRM & email included"]'::jsonb,
  true, 3,
  25, 1, 2, 5, NULL, NULL,
  false, ARRAY['video_style_1', 'video_style_2', 'video_style_3', 'video_style_4'], 'standard', 'week'
),
-- Professional (€130/week)
(
  'professional', 'Professional', 'For active agents and small teams',
  13000, 2500, 30,
  '["Up to 50 listings", "3 posts per listing per week", "Unlimited lead magnets", "All video styles", "Up to 30 team members", "CRM & email included"]'::jsonb,
  true, 4,
  50, 1, 3, NULL, NULL, NULL,
  false, ARRAY['video_style_1', 'video_style_2', 'video_style_3', 'video_style_4'], 'professional', 'week'
),
-- Multi-Branch Small (2 hubs, €170/week)
(
  'multi_branch_s', 'Multi-Branch S', 'For agencies with 2 branches',
  17000, 4000, 30,
  '["2 social hubs", "40 listings per hub (80 total)", "3 posts per listing per week", "Unlimited lead magnets", "All video styles", "CRM & email included"]'::jsonb,
  true, 5,
  80, 2, 3, NULL, NULL, NULL,
  false, ARRAY['video_style_1', 'video_style_2', 'video_style_3', 'video_style_4'], 'multi_branch', 'week'
),
-- Multi-Branch Medium (3-5 hubs, €250/week)
(
  'multi_branch_m', 'Multi-Branch M', 'For agencies with 3 to 5 branches',
  25000, 10000, 30,
  '["3–5 social hubs", "40 listings per hub (200 total)", "3 posts per listing per week", "Unlimited lead magnets", "All video styles", "CRM & email included"]'::jsonb,
  true, 6,
  200, 5, 3, NULL, NULL, NULL,
  false, ARRAY['video_style_1', 'video_style_2', 'video_style_3', 'video_style_4'], 'multi_branch', 'week'
),
-- Multi-Branch Large (6-10 hubs, €350/week)
(
  'multi_branch_l', 'Multi-Branch L', 'For large agency groups with 6 to 10 branches',
  35000, 20000, 30,
  '["6–10 social hubs", "40 listings per hub (400 total)", "3 posts per listing per week", "Unlimited lead magnets", "All video styles", "CRM & email included"]'::jsonb,
  true, 7,
  400, 10, 3, NULL, NULL, NULL,
  false, ARRAY['video_style_1', 'video_style_2', 'video_style_3', 'video_style_4'], 'multi_branch', 'week'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  monthly_credits = EXCLUDED.monthly_credits,
  max_users = EXCLUDED.max_users,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order,
  max_listings = EXCLUDED.max_listings,
  max_social_hubs = EXCLUDED.max_social_hubs,
  max_posts_per_listing_per_week = EXCLUDED.max_posts_per_listing_per_week,
  max_lead_magnets_per_week = EXCLUDED.max_lead_magnets_per_week,
  max_crm_contacts = EXCLUDED.max_crm_contacts,
  max_email_campaigns_per_month = EXCLUDED.max_email_campaigns_per_month,
  has_watermark = EXCLUDED.has_watermark,
  allowed_video_styles = EXCLUDED.allowed_video_styles,
  plan_tier = EXCLUDED.plan_tier,
  billing_interval = EXCLUDED.billing_interval,
  updated_at = now();

-- ============================================================================
-- STEP 2: Seed EUR prices in plan_prices table
-- ============================================================================

INSERT INTO public.plan_prices (plan_name, currency, price_cents, billing_interval, is_active)
VALUES
  ('essentials', 'eur', 4000, 'week', true),
  ('growth', 'eur', 7000, 'week', true),
  ('professional', 'eur', 13000, 'week', true),
  ('multi_branch_s', 'eur', 17000, 'week', true),
  ('multi_branch_m', 'eur', 25000, 'week', true),
  ('multi_branch_l', 'eur', 35000, 'week', true)
ON CONFLICT (plan_name, currency, billing_interval) DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  is_active = EXCLUDED.is_active,
  updated_at = now();

SELECT 'Plan tiers updated with final pricing!' as result;
