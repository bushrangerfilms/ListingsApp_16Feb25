-- Seed credit packs with the new pricing structure
-- Prices: 100/€25, 500/€110, 2000/€400, 5000/€900
-- Note: stripe_price_id will be updated after running seed-stripe-products.ts script

-- First, clear existing credit packs to avoid conflicts
DELETE FROM public.credit_packs WHERE is_active = true;

-- Insert new credit pack offerings
INSERT INTO public.credit_packs (
  name, 
  description, 
  credits, 
  price_cents, 
  currency, 
  discount_percentage,
  is_active, 
  display_order,
  metadata
) VALUES
  (
    '100 Credits Pack',
    'Perfect for getting started - €0.25 per credit',
    100,
    2500,
    'eur',
    0,
    true,
    1,
    '{"tier": "starter", "per_credit_cost": 0.25}'::jsonb
  ),
  (
    '500 Credits Pack',
    'Most popular - €0.22 per credit (12% savings)',
    500,
    11000,
    'eur',
    12,
    true,
    2,
    '{"tier": "popular", "per_credit_cost": 0.22, "badge": "Most Popular"}'::jsonb
  ),
  (
    '2000 Credits Pack',
    'Best value for teams - €0.20 per credit (20% savings)',
    2000,
    40000,
    'eur',
    20,
    true,
    3,
    '{"tier": "team", "per_credit_cost": 0.20}'::jsonb
  ),
  (
    '5000 Credits Pack',
    'Enterprise pack - €0.18 per credit (28% savings)',
    5000,
    90000,
    'eur',
    28,
    true,
    4,
    '{"tier": "enterprise", "per_credit_cost": 0.18, "badge": "Best Value"}'::jsonb
  )
ON CONFLICT (credits, is_active) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  discount_percentage = EXCLUDED.discount_percentage,
  display_order = EXCLUDED.display_order,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- Update usage rates for the actual feature costs
-- Based on scratchpad: main video 12-20 credits, secondary aspect 6-10 credits, social post 2-3 credits
UPDATE public.usage_rates SET
  credits_per_use = 15,
  description = 'Generate a main video with AI (primary aspect ratio)',
  updated_at = now()
WHERE feature_type = 'video_generation';

UPDATE public.usage_rates SET
  credits_per_use = 3,
  description = 'Generate a social media post with AI',
  updated_at = now()
WHERE feature_type = 'post_generation';

-- Add a new feature type for secondary video aspect ratios if not exists
INSERT INTO public.usage_rates (feature_type, credits_per_use, description, is_active)
VALUES ('video_generation', 8, 'Generate a secondary aspect ratio video', true)
ON CONFLICT (feature_type) DO NOTHING;

-- Verify the data
SELECT 'Credit packs created:' as info, count(*) as count FROM public.credit_packs WHERE is_active = true;
SELECT name, credits, price_cents, discount_percentage FROM public.credit_packs WHERE is_active = true ORDER BY display_order;
