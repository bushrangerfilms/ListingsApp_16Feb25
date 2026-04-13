-- Free plan: allow all video styles except AI motion (VS2, VS4).
--
-- Previously the free plan's allowed_video_styles was ['video_style_1','video_style_3'],
-- which would have blocked VS5/VS6/legacy too. Product rule is: free tier may use any
-- content type EXCEPT AI motion styles. This update aligns the data with that rule.
--
-- NOTE: Already applied in production via Management API on 2026-04-13. This migration
-- is kept in-repo for reproducibility and rollback.

UPDATE public.plan_definitions
SET allowed_video_styles = ARRAY[
  'video_style_legacy',
  'video_style_1',
  'video_style_3',
  'video_style_5',
  'video_style_6'
]::text[]
WHERE name = 'free';
