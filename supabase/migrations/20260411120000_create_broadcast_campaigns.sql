-- Broadcast email system for Super Admin product announcements
-- Three tables: campaigns, recipients, unsubscribes

-- 1. broadcast_campaigns — stores each campaign
CREATE TABLE IF NOT EXISTS public.broadcast_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Content
  subject text NOT NULL,
  body_html text NOT NULL,
  preview_text text,

  -- Sender identity
  from_name text NOT NULL DEFAULT 'AutoListing',
  from_email text NOT NULL DEFAULT 'noreply@autolisting.io',

  -- Audience targeting (empty = all users)
  audience_filters jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Lifecycle
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  scheduled_for timestamptz,
  sent_at timestamptz,

  -- Denormalized stats
  total_recipients integer NOT NULL DEFAULT 0,
  total_sent integer NOT NULL DEFAULT 0,
  total_opened integer NOT NULL DEFAULT 0,
  total_clicked integer NOT NULL DEFAULT 0,
  total_bounced integer NOT NULL DEFAULT 0,

  -- Audit
  created_by uuid REFERENCES auth.users(id),
  sent_by uuid REFERENCES auth.users(id)
);

-- 2. broadcast_recipients — per-recipient tracking
CREATE TABLE IF NOT EXISTS public.broadcast_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.broadcast_campaigns(id) ON DELETE CASCADE,

  -- Recipient info (snapshot at send time)
  email text NOT NULL,
  user_id uuid,
  name text,

  -- Delivery tracking
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'opened', 'clicked', 'bounced', 'complained', 'failed')),
  resend_email_id text,
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(campaign_id, email)
);

-- 3. broadcast_unsubscribes — global broadcast opt-out list
CREATE TABLE IF NOT EXISTS public.broadcast_unsubscribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  user_id uuid,
  unsubscribed_at timestamptz NOT NULL DEFAULT now(),
  reason text
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_status ON public.broadcast_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_created_at ON public.broadcast_campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_campaign_id ON public.broadcast_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_email ON public.broadcast_recipients(email);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_status ON public.broadcast_recipients(status);
CREATE INDEX IF NOT EXISTS idx_broadcast_unsubscribes_email ON public.broadcast_unsubscribes(email);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.update_broadcast_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_broadcast_campaigns_updated_at ON public.broadcast_campaigns;
CREATE TRIGGER trg_broadcast_campaigns_updated_at
  BEFORE UPDATE ON public.broadcast_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_broadcast_campaigns_updated_at();

-- RLS policies
ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_unsubscribes ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by edge functions)
CREATE POLICY "Service role full access on broadcast_campaigns"
  ON public.broadcast_campaigns FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access on broadcast_recipients"
  ON public.broadcast_recipients FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access on broadcast_unsubscribes"
  ON public.broadcast_unsubscribes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
