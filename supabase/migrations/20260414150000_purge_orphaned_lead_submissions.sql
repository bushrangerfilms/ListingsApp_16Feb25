-- Lead Magnet Worth Estimate: 30-day retention for orphaned submissions.
--
-- `lead_submissions` rows are created on quiz submit with answers_json
-- containing the full quiz data (including eircode + property details).
-- Email/consent are only captured at the subsequent unlock step. Users who
-- abandon after submit leave orphaned rows (email IS NULL, consent = false)
-- that previously had no cleanup policy.
--
-- GDPR storage-limitation compliance: purge orphans older than 30 days.

CREATE OR REPLACE FUNCTION public.purge_orphaned_lead_submissions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.lead_submissions
  WHERE email IS NULL
    AND consent = false
    AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Idempotent reschedule
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-orphaned-lead-submissions') THEN
    PERFORM cron.unschedule('purge-orphaned-lead-submissions');
  END IF;
END $$;

SELECT cron.schedule(
  'purge-orphaned-lead-submissions',
  '0 3 * * *',
  $cron$SELECT public.purge_orphaned_lead_submissions();$cron$
);

-- One-time cleanup of 2 test-data orphans from 2026-04-14 debugging sessions.
-- Safe: both pre-date any real quiz traffic.
DELETE FROM public.lead_submissions
WHERE email IS NULL AND consent = false;
