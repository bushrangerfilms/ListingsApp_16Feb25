-- Lead Magnet daily activity digest — schema + email template + cron.
--
-- Daily at 08:00 UTC, each org with quiz activity the previous day gets a
-- counts-only summary email: how many prospects started, how many became
-- leads, how many abandoned, and the top traffic source. Contains NO
-- personal data — no eircode, no town, no property details.
--
-- Rationale: we cannot legally forward abandoned-quiz answer details to
-- the agent without the customer's consent (fails GDPR Art. 6(1)(f)
-- legitimate-interest balancing test — users who abandon forms have a
-- strong reasonable expectation their partial data won't be reused).
-- An anonymized count-only notification carries no personal data and has
-- no GDPR implications.

-- ============================================
-- 1. Opt-out column
-- ============================================
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS lead_magnet_digest_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.organizations.lead_magnet_digest_enabled IS
  'When true (default), the org receives a daily Lead Magnet activity digest '
  'email summarising yesterday''s quiz submissions (counts only, no personal '
  'data). Toggle off via direct DB update or super admin UI.';

-- ============================================
-- 2. Email template (platform default — organization_id NULL)
-- ============================================
-- email_templates has no unique constraint on (organization_id, template_key),
-- so we delete any existing platform-level row with this key before inserting.
DELETE FROM public.email_templates
WHERE organization_id IS NULL
  AND template_key = 'lead_magnet_activity_digest';

INSERT INTO public.email_templates (
  organization_id,
  template_key,
  template_name,
  subject,
  body_html,
  body_text,
  description,
  is_active
) VALUES (
  NULL,
  'lead_magnet_activity_digest',
  'Lead Magnet Activity Digest',
  'Your Lead Magnet activity — {digest_date}',
  $html$<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 16px;">Your Lead Magnet activity</h1>
  <p style="color: #64748b; font-size: 14px; margin-top: -8px; margin-bottom: 24px;">{digest_date}</p>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">Hi {business_name},</p>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">Here's yesterday's activity on your AutoListing Lead Magnet quizzes:</p>
  <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 24px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #1e293b; font-size: 16px;">Prospects started a quiz</td>
        <td style="padding: 8px 0; color: #1e293b; font-size: 20px; font-weight: 700; text-align: right;">{quiz_starts}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #16a34a; font-size: 16px;">Became leads (in your CRM)</td>
        <td style="padding: 8px 0; color: #16a34a; font-size: 20px; font-weight: 700; text-align: right;">{completed}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b; font-size: 16px;">Started but didn't complete</td>
        <td style="padding: 8px 0; color: #64748b; font-size: 20px; font-weight: 700; text-align: right;">{abandoned}</td>
      </tr>
    </table>
  </div>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">Top traffic source: <strong>{top_source}</strong></p>
  <p style="color: #64748b; font-size: 14px; line-height: 1.6;">Completed leads were already sent to you in real time and are in your CRM under Seller Profiles. For privacy reasons we can't share details of abandoned quizzes — a high abandonment count usually means your quiz URL is working and driving interest.</p>
  <div style="text-align: center; margin: 32px 0;">
    <a href="{lead_magnets_url}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">View your Lead Magnet hub</a>
  </div>
  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
    <p>You're receiving this because Lead Magnet activity digests are enabled for your account. To stop receiving these daily summaries, contact support.</p>
  </div>
</div>$html$,
  'Your Lead Magnet activity for {digest_date}: {quiz_starts} prospects started, {completed} became leads, {abandoned} did not complete. Top source: {top_source}. View: {lead_magnets_url}',
  'Daily anonymized activity digest for Lead Magnet quizzes — counts only, no personal data',
  true
);

-- ============================================
-- 3. pg_cron schedule
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('lead-magnet-activity-digest');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Daily at 08:00 UTC — arrives at start of IE/UK working day.
-- Anon key header matches onboarding-nudge pattern; function is deployed
-- with --no-verify-jwt and is idempotent (dunning_emails dedup).
SELECT cron.schedule(
  'lead-magnet-activity-digest',
  '0 8 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://sjcfcxjpukgeaxxkffpq.supabase.co/functions/v1/lead-magnet-activity-digest',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqY2ZjeGpwdWtnZWF4eGtmZnBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MjUxNzYsImV4cCI6MjA3ODEwMTE3Nn0.8h3GN5fM0okI28wd4aka1-uTjij26K2d5JPfAmpNooc"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $cron$
);
