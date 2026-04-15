-- Phase 2.5: Trial Lifecycle - Add account lifecycle columns to organizations table
-- This migration adds the master switch and account state tracking

-- Add account_status column with check constraint
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'trial';

-- Add check constraint for valid account statuses (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_account_status_check'
  ) THEN
    ALTER TABLE organizations ADD CONSTRAINT organizations_account_status_check 
      CHECK (account_status IN ('trial', 'trial_expired', 'active', 'payment_failed', 'unsubscribed', 'archived'));
  END IF;
END $$;

-- Add trial tracking columns
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (now() + interval '14 days');

-- Add the MASTER SWITCH for credit spending
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS credit_spending_enabled BOOLEAN DEFAULT true;

-- Add read-only reason and grace period tracking
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS read_only_reason TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_organizations_account_status ON organizations(account_status);
CREATE INDEX IF NOT EXISTS idx_organizations_trial_ends_at ON organizations(trial_ends_at);
CREATE INDEX IF NOT EXISTS idx_organizations_grace_period_ends_at ON organizations(grace_period_ends_at);
CREATE INDEX IF NOT EXISTS idx_organizations_credit_spending_enabled ON organizations(credit_spending_enabled);

-- Add comments for documentation
COMMENT ON COLUMN organizations.account_status IS 'Current account lifecycle state: trial, trial_expired, active, payment_failed, unsubscribed, archived';
COMMENT ON COLUMN organizations.trial_started_at IS 'When the 14-day trial period started';
COMMENT ON COLUMN organizations.trial_ends_at IS 'When the 14-day trial period ends';
COMMENT ON COLUMN organizations.credit_spending_enabled IS 'MASTER SWITCH: Gates all credit consumption. Set to false during read-only states.';
COMMENT ON COLUMN organizations.read_only_reason IS 'Human-readable reason why account is in read-only mode';
COMMENT ON COLUMN organizations.grace_period_ends_at IS 'When the current grace period expires (for trial_expired, payment_failed, unsubscribed states)';
COMMENT ON COLUMN organizations.archived_at IS 'When the account was archived. Data will be deleted 6 months after this date.';
