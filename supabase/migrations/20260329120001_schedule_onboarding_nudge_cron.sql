-- Schedule daily onboarding nudge cron job (9am UTC)
-- Sends reminder emails to users who signed up but haven't created a listing

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('onboarding-nudge');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'onboarding-nudge',
  '0 9 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://sjcfcxjpukgeaxxkffpq.supabase.co/functions/v1/onboarding-nudge',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqY2ZjeGpwdWtnZWF4eGtmZnBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MjUxNzYsImV4cCI6MjA3ODEwMTE3Nn0.8h3GN5fM0okI28wd4aka1-uTjij26K2d5JPfAmpNooc"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);
