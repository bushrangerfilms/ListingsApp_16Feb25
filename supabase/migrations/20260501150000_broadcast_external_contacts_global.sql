-- Persistent, global external-contact list for Super Admin broadcasts.
--
-- Replaces the per-campaign `broadcast_external_recipients` table. The
-- workflow is: every Super Admin upload re-imports the same "Interested"
-- export, name overrides set during one campaign should carry into the next,
-- and a re-upload should only insert net-new addresses — never wipe overrides.
--
-- A single global table keeps that invariant trivially. Campaigns no longer
-- own external recipients; instead `buildRecipientList()` always merges the
-- global pool into every campaign's audience.

CREATE TABLE IF NOT EXISTS public.broadcast_external_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text,                         -- name parsed from the upload (display name on incoming row)
  name_override text,                -- Super Admin's manual correction; wins over `name` at send time
  source text NOT NULL DEFAULT 'manual_upload',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS broadcast_external_contacts_email_unique
  ON public.broadcast_external_contacts (lower(email));

ALTER TABLE public.broadcast_external_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_external_contacts"
  ON public.broadcast_external_contacts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Migrate existing per-campaign rows (DISTINCT on lower(email)) so anything
-- already uploaded survives the move. Picks the most recently created row's
-- name when an email appears in multiple campaigns.
INSERT INTO public.broadcast_external_contacts (email, name, source, created_at)
SELECT DISTINCT ON (lower(email))
  email,
  name,
  source,
  created_at
FROM public.broadcast_external_recipients
ORDER BY lower(email), created_at DESC
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS public.broadcast_external_recipients;
