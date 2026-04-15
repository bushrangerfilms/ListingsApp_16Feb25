-- Phase 2.5: Trial Lifecycle - Add payment tracking columns to billing_profiles table
-- This migration adds columns for tracking payment failures and card expiration

-- Add payment failure tracking
ALTER TABLE billing_profiles ADD COLUMN IF NOT EXISTS last_payment_failed_at TIMESTAMPTZ;
ALTER TABLE billing_profiles ADD COLUMN IF NOT EXISTS payment_failure_count INTEGER DEFAULT 0;

-- Add unsubscribe tracking
ALTER TABLE billing_profiles ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;

-- Add card expiration tracking for pre-dunning
ALTER TABLE billing_profiles ADD COLUMN IF NOT EXISTS card_expires_at TIMESTAMPTZ;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_billing_profiles_payment_failed ON billing_profiles(last_payment_failed_at) WHERE last_payment_failed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_profiles_card_expires ON billing_profiles(card_expires_at) WHERE card_expires_at IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN billing_profiles.last_payment_failed_at IS 'Timestamp of the most recent payment failure';
COMMENT ON COLUMN billing_profiles.payment_failure_count IS 'Number of consecutive payment failures';
COMMENT ON COLUMN billing_profiles.unsubscribed_at IS 'When the user canceled their subscription';
COMMENT ON COLUMN billing_profiles.card_expires_at IS 'When the saved card expires, for pre-dunning alerts';
