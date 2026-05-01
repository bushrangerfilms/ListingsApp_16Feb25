-- External (non-platform-user) recipients for a broadcast campaign.
-- Populated by Super Admin when uploading a contact list (e.g. PlusVibe XLSX export
-- of "Interested" cold leads). Merged with platform-user recipients at send time
-- and deduped against all platform user emails so we never double-send to a known user.

CREATE TABLE IF NOT EXISTS public.broadcast_external_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.broadcast_campaigns(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  source text NOT NULL DEFAULT 'manual_upload',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Lowercase-unique per campaign so re-uploads don't duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS broadcast_external_recipients_campaign_email_unique
  ON public.broadcast_external_recipients (campaign_id, lower(email));

CREATE INDEX IF NOT EXISTS broadcast_external_recipients_campaign_idx
  ON public.broadcast_external_recipients (campaign_id);

ALTER TABLE public.broadcast_external_recipients ENABLE ROW LEVEL SECURITY;

-- Service role only — Super Admin endpoints are the only callers.
CREATE POLICY "service_role_all_external_recipients"
  ON public.broadcast_external_recipients
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
