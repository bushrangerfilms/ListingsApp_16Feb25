-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant necessary permissions to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Try to unschedule if exists (will silently fail if doesn't exist)
DO $$
BEGIN
  PERFORM cron.unschedule('process-email-sequences');
EXCEPTION
  WHEN OTHERS THEN
    -- Job doesn't exist, that's fine
    NULL;
END $$;

-- Create the cron job to run every hour at the top of the hour
SELECT cron.schedule(
  'process-email-sequences',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://pepzeqiupmucxiulfzld.supabase.co/functions/v1/process-email-sequences',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlcHplcWl1cG11Y3hpdWxmemxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NjcwMTksImV4cCI6MjA3NTE0MzAxOX0.Ek2OkXrskC0Us3EhujjVwcyp6a2AFutGdHQA9Esm9L8'
      )
    ) AS request_id;
  $$
);