-- Create email sequences table
CREATE TABLE IF NOT EXISTS email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name TEXT NOT NULL,
  profile_type TEXT NOT NULL CHECK (profile_type IN ('buyer', 'seller')),
  trigger_stage TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email sequences"
ON email_sequences FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Create email sequence steps table
CREATE TABLE IF NOT EXISTS email_sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  template_key TEXT NOT NULL,
  delay_hours INTEGER NOT NULL DEFAULT 0,
  UNIQUE(sequence_id, step_number)
);

-- Enable RLS
ALTER TABLE email_sequence_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email sequence steps"
ON email_sequence_steps FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Create profile email queue table
CREATE TABLE IF NOT EXISTS profile_email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  buyer_profile_id UUID REFERENCES buyer_profiles(id) ON DELETE CASCADE,
  seller_profile_id UUID REFERENCES seller_profiles(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  template_key TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'paused')),
  error_message TEXT,
  CONSTRAINT check_one_profile CHECK (
    (buyer_profile_id IS NOT NULL AND seller_profile_id IS NULL) OR
    (buyer_profile_id IS NULL AND seller_profile_id IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE profile_email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage profile email queue"
ON profile_email_queue FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage profile email queue"
ON profile_email_queue FOR ALL
USING (true);

-- Create indexes
CREATE INDEX idx_email_queue_buyer ON profile_email_queue(buyer_profile_id);
CREATE INDEX idx_email_queue_seller ON profile_email_queue(seller_profile_id);
CREATE INDEX idx_email_queue_scheduled ON profile_email_queue(scheduled_for);
CREATE INDEX idx_email_queue_status ON profile_email_queue(status);