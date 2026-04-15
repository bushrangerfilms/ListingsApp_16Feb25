-- Phase 2.5: Trial Lifecycle - Create dunning_emails table
-- This table tracks all dunning/lifecycle emails sent to organizations

CREATE TABLE IF NOT EXISTS dunning_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  email_number INTEGER DEFAULT 1,
  recipient_email TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_dunning_emails_org ON dunning_emails(organization_id);
CREATE INDEX IF NOT EXISTS idx_dunning_emails_type ON dunning_emails(email_type);
CREATE INDEX IF NOT EXISTS idx_dunning_emails_sent_at ON dunning_emails(sent_at);

-- Add RLS policies
ALTER TABLE dunning_emails ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access on dunning_emails" ON dunning_emails
  FOR ALL
  USING (auth.role() = 'service_role');

-- Org admins can view their own dunning emails
CREATE POLICY "Org admins can view own dunning emails" ON dunning_emails
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
    )
  );

-- Add comments for documentation
COMMENT ON TABLE dunning_emails IS 'Tracks all dunning and lifecycle emails sent to organizations';
COMMENT ON COLUMN dunning_emails.email_type IS 'Type of email: trial_ending_3days, trial_expired, payment_failed_1, etc.';
COMMENT ON COLUMN dunning_emails.email_number IS 'Sequence number for multi-email sequences (1, 2, 3, etc.)';
COMMENT ON COLUMN dunning_emails.metadata IS 'Additional context like credit balance, days remaining, etc.';
