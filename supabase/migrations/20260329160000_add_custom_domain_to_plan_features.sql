-- Add custom domain feature to paid plan tiers
-- Free plan: clarify no custom domain
-- All paid plans: add custom domain feature

-- Free plan: update website line
UPDATE plan_definitions
SET features = '["3 listings", "Generate up to 1 post per listing per week posted to all social platforms", "2 lead magnets per week", "Access to 3 video styles", "Property website (AutoListing subdomain)", "CRM & email included"]'::jsonb
WHERE name = 'free';

-- Essentials: add custom domain
UPDATE plan_definitions
SET features = '["Up to 10 listings", "Generate up to 2 posts per listing per week posted to all social platforms", "3 lead magnets per week", "All video styles", "Custom domain (youragency.com)", "CRM & email included"]'::jsonb
WHERE name = 'essentials';

-- Growth: add custom domain
UPDATE plan_definitions
SET features = '["Up to 25 listings", "Generate up to 2 posts per listing per week posted to all social platforms", "5 lead magnets per week", "All video styles", "Custom domain (youragency.com)", "Up to 10 team members", "CRM & email included"]'::jsonb
WHERE name = 'growth';

-- Professional: add custom domain
UPDATE plan_definitions
SET features = '["Up to 50 listings", "Generate up to 3 posts per listing per week posted to all social platforms", "Unlimited lead magnets", "All video styles", "Custom domain (youragency.com)", "Up to 30 team members", "CRM & email included"]'::jsonb
WHERE name = 'professional';

-- Multi-Branch S: add custom domain
UPDATE plan_definitions
SET features = '["2 branches", "40 listings per branch (80 total)", "Generate up to 3 posts per listing per week posted to all social platforms", "Unlimited lead magnets", "All video styles", "Custom domain per branch", "CRM & email included"]'::jsonb
WHERE name = 'multi_branch_s';

-- Multi-Branch M: add custom domain
UPDATE plan_definitions
SET features = '["3–5 branches", "40 listings per branch (200 total)", "Generate up to 3 posts per listing per week posted to all social platforms", "Unlimited lead magnets", "All video styles", "Custom domain per branch", "CRM & email included"]'::jsonb
WHERE name = 'multi_branch_m';

-- Multi-Branch L: add custom domain
UPDATE plan_definitions
SET features = '["6–10 branches", "40 listings per branch (400 total)", "Generate up to 3 posts per listing per week posted to all social platforms", "Unlimited lead magnets", "All video styles", "Custom domain per branch", "CRM & email included"]'::jsonb
WHERE name = 'multi_branch_l';
