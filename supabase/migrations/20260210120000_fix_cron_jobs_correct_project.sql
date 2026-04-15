-- Fix cron jobs to point to the correct Supabase project (sjcfcxjpukgeaxxkffpq)
-- and add missing auto-expire-new-status cron schedule

-- Ensure extensions are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove old cron jobs pointing to wrong project
DO $$
BEGIN
  PERFORM cron.unschedule('auto-archive-sold-listings');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('auto-expire-new-status');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Re-create auto-archive-sold-listings pointing to correct project
SELECT cron.schedule(
  'auto-archive-sold-listings',
  '0 0 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://sjcfcxjpukgeaxxkffpq.supabase.co/functions/v1/auto-archive-sold-listings',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqY2ZjeGpwdWtnZWF4eGtmZnBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MjUxNzYsImV4cCI6MjA3ODEwMTE3Nn0.8h3GN5fM0okI28wd4aka1-uTjij26K2d5JPfAmpNooc"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Create auto-expire-new-status cron job (daily at 1am UTC)
-- Changes listings from "New" to "Published" after 30 days
SELECT cron.schedule(
  'auto-expire-new-status',
  '0 1 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://sjcfcxjpukgeaxxkffpq.supabase.co/functions/v1/auto-expire-new-status',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqY2ZjeGpwdWtnZWF4eGtmZnBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MjUxNzYsImV4cCI6MjA3ODEwMTE3Nn0.8h3GN5fM0okI28wd4aka1-uTjij26K2d5JPfAmpNooc"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);
