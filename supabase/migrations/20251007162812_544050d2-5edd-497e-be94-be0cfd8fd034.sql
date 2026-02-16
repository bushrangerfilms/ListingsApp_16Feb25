-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule auto-archive job to run daily at midnight UTC
SELECT cron.schedule(
  'auto-archive-sold-listings',
  '0 0 * * *', -- Run at midnight every day
  $$
  SELECT
    net.http_post(
        url:='https://pepzeqiupmucxiulfzld.supabase.co/functions/v1/auto-archive-sold-listings',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlcHplcWl1cG11Y3hpdWxmemxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NjcwMTksImV4cCI6MjA3NTE0MzAxOX0.Ek2OkXrskC0Us3EhujjVwcyp6a2AFutGdHQA9Esm9L8"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);