-- Phase 2.5: Trial Lifecycle - Create account_lifecycle_log table
-- This table provides an audit trail of all account state transitions

CREATE TABLE IF NOT EXISTS account_lifecycle_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,
  triggered_by TEXT DEFAULT 'system',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_lifecycle_log_org ON account_lifecycle_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_log_created ON account_lifecycle_log(created_at);
CREATE INDEX IF NOT EXISTS idx_lifecycle_log_new_status ON account_lifecycle_log(new_status);

-- Add RLS policies
ALTER TABLE account_lifecycle_log ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access on account_lifecycle_log" ON account_lifecycle_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- Org admins can view their own lifecycle log
CREATE POLICY "Org admins can view own lifecycle log" ON account_lifecycle_log
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
    )
  );

-- Add comments for documentation
COMMENT ON TABLE account_lifecycle_log IS 'Audit trail of all account state transitions';
COMMENT ON COLUMN account_lifecycle_log.previous_status IS 'Account status before the transition';
COMMENT ON COLUMN account_lifecycle_log.new_status IS 'Account status after the transition';
COMMENT ON COLUMN account_lifecycle_log.reason IS 'Human-readable reason for the transition';
COMMENT ON COLUMN account_lifecycle_log.triggered_by IS 'What triggered the transition: cron, webhook, user_action, admin, etc.';
COMMENT ON COLUMN account_lifecycle_log.metadata IS 'Additional context like stripe_event_id, grace_period_days, etc.';
