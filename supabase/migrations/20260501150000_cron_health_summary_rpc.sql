-- Cron observability — first pass, super-admin dashboard panel.
--
-- Background: pg_cron tracks every job run in cron.job_run_details with
-- status, return_message, end_time. Until now nothing exposed that to
-- the dashboard, so when a cron silently failed nobody noticed (worth
-- noting: pg_cron only sees the SQL-side outcome of net.http_post, not
-- the edge function's logic outcome — but it does catch network errors,
-- secret rotation breaks, deleted-function calls, etc).
--
-- This migration adds a SECURITY DEFINER RPC that joins cron.job and
-- cron.job_run_details and returns a per-job 24h health summary. Gated
-- by the standard super_admin role check (same pattern as the rest of
-- the /internal/* surface).
--
-- The cron schema is extension-managed and not exposed via PostgREST
-- by default; SECURITY DEFINER is the cleanest way to surface the data
-- without opening up the whole schema.

CREATE OR REPLACE FUNCTION public.get_cron_health_summary(
  hours_back integer DEFAULT 24
)
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  active boolean,
  total_runs integer,
  failed_runs integer,
  succeeded_runs integer,
  last_run_at timestamptz,
  last_run_status text,
  last_failure_at timestamptz,
  last_failure_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  caller uuid;
  is_super boolean;
BEGIN
  caller := auth.uid();
  IF caller IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = caller AND role = 'super_admin'
  ) INTO is_super;
  IF NOT is_super THEN
    RAISE EXCEPTION 'super_admin role required';
  END IF;

  -- Clamp hours_back to a sane range so a runaway client doesn't pull
  -- a month of run history through the dashboard.
  hours_back := GREATEST(1, LEAST(168, COALESCE(hours_back, 24)));

  RETURN QUERY
  WITH window_runs AS (
    SELECT
      r.jobid,
      r.status,
      r.end_time,
      r.return_message,
      ROW_NUMBER() OVER (PARTITION BY r.jobid ORDER BY COALESCE(r.end_time, r.start_time) DESC) AS recency_rank,
      ROW_NUMBER() OVER (PARTITION BY r.jobid, (r.status = 'failed') ORDER BY COALESCE(r.end_time, r.start_time) DESC) AS recency_rank_per_status
    FROM cron.job_run_details r
    WHERE r.start_time > now() - make_interval(hours => hours_back)
  ),
  rollups AS (
    SELECT
      wr.jobid,
      COUNT(*)::int AS total_runs,
      COUNT(*) FILTER (WHERE wr.status = 'failed')::int AS failed_runs,
      COUNT(*) FILTER (WHERE wr.status = 'succeeded')::int AS succeeded_runs,
      MAX(wr.end_time) FILTER (WHERE wr.recency_rank = 1) AS last_run_at,
      MAX(wr.status::text) FILTER (WHERE wr.recency_rank = 1) AS last_run_status,
      MAX(wr.end_time) FILTER (WHERE wr.status = 'failed' AND wr.recency_rank_per_status = 1) AS last_failure_at,
      MAX(wr.return_message) FILTER (WHERE wr.status = 'failed' AND wr.recency_rank_per_status = 1) AS last_failure_message
    FROM window_runs wr
    GROUP BY wr.jobid
  )
  SELECT
    j.jobid,
    j.jobname,
    j.schedule,
    j.active,
    COALESCE(ru.total_runs, 0) AS total_runs,
    COALESCE(ru.failed_runs, 0) AS failed_runs,
    COALESCE(ru.succeeded_runs, 0) AS succeeded_runs,
    ru.last_run_at,
    ru.last_run_status,
    ru.last_failure_at,
    -- Truncate noisy return messages so the dashboard payload stays
    -- under a few KB even if a job spat out a stack trace.
    CASE
      WHEN ru.last_failure_message IS NULL THEN NULL
      WHEN length(ru.last_failure_message) > 300 THEN left(ru.last_failure_message, 300) || '…'
      ELSE ru.last_failure_message
    END AS last_failure_message
  FROM cron.job j
  LEFT JOIN rollups ru ON ru.jobid = j.jobid
  ORDER BY
    -- Failing jobs first, then most recent activity.
    COALESCE(ru.failed_runs, 0) DESC,
    j.jobname;
END;
$$;

REVOKE ALL ON FUNCTION public.get_cron_health_summary(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cron_health_summary(integer) TO authenticated;

COMMENT ON FUNCTION public.get_cron_health_summary IS
  'Super-admin: per-job 24h health rollup from pg_cron. Surfaces SQL/network failures of cron-driven HTTP calls, not edge-function logic outcomes.';
