-- Daily cron job (2am UTC) to auto-complete onboarding when all tasks are done
-- Checks: configure_services, save_end_card, create_listing (manual tasks)
-- Plus: connect_social (auto-detected via organization_connected_socials table)

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('auto-complete-onboarding');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'auto-complete-onboarding',
  '0 2 * * *',
  $$
  UPDATE public.onboarding_progress op
  SET 
    completed_at = now(),
    tasks_completed = op.tasks_completed || '{"connect_social": true}'::jsonb
  WHERE op.completed_at IS NULL
    AND op.dismissed_at IS NULL
    AND (op.tasks_completed->>'configure_services')::boolean = true
    AND (op.tasks_completed->>'save_end_card')::boolean = true
    AND (op.tasks_completed->>'create_listing')::boolean = true
    AND EXISTS (
      SELECT 1 FROM public.organization_connected_socials ocs
      WHERE ocs.organization_id = op.organization_id
    );
  $$
);
