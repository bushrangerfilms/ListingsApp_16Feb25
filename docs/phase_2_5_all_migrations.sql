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
-- Phase 2.5: Trial Lifecycle - Add Master Switch check to sp_consume_credits
-- This is the CRITICAL change that gates ALL credit spending based on organization status
-- 
-- IMPORTANT: This migration modifies the existing sp_consume_credits function
-- by adding a check at the very START that verifies credit_spending_enabled = true
-- before allowing any credit consumption.

CREATE OR REPLACE FUNCTION public.sp_consume_credits(
  p_organization_id uuid,
  p_feature_type public.feature_type,
  p_quantity integer DEFAULT 1,
  p_user_id uuid DEFAULT NULL,
  p_source_app text DEFAULT 'system',
  p_request_id text DEFAULT NULL,
  p_feature_details jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  success boolean,
  new_balance integer,
  credits_consumed integer,
  transaction_id uuid,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost_per_use integer;
  v_total_cost integer;
  v_current_balance integer;
  v_new_balance integer;
  v_transaction_id uuid;
  v_usage_event_id uuid;
  v_spending_enabled boolean;
  v_account_status text;
BEGIN
  -- ============================================================================
  -- MASTER SWITCH CHECK - Added in Phase 2.5 Trial Lifecycle
  -- This check gates ALL credit spending based on organization status
  -- ============================================================================
  SELECT credit_spending_enabled, account_status 
  INTO v_spending_enabled, v_account_status
  FROM public.organizations 
  WHERE id = p_organization_id;

  -- If organization not found, deny spending
  IF v_spending_enabled IS NULL THEN
    RETURN QUERY SELECT 
      false, 
      0, 
      0, 
      NULL::uuid, 
      'Organization not found';
    RETURN;
  END IF;

  -- If credit spending is disabled, return clear error message
  IF v_spending_enabled IS NOT TRUE THEN
    RETURN QUERY SELECT 
      false, 
      0, 
      0, 
      NULL::uuid, 
      format('CREDIT_SPENDING_DISABLED: Account is in %s mode. Please subscribe or update payment method to restore access.', 
        COALESCE(v_account_status, 'read-only'));
    RETURN;
  END IF;
  -- ============================================================================
  -- END MASTER SWITCH CHECK
  -- ============================================================================

  -- Get cost for this feature type
  SELECT credits_per_use INTO v_cost_per_use
  FROM public.usage_rates
  WHERE feature_type = p_feature_type
    AND is_active = true
    AND effective_until IS NULL
  LIMIT 1;

  IF v_cost_per_use IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, NULL::uuid, 'Feature type not found or inactive';
    RETURN;
  END IF;

  -- Calculate total cost
  v_total_cost := v_cost_per_use * p_quantity;

  -- CRITICAL: Lock the organization's balance row to prevent race conditions
  -- Handle first-time balance initialization with race-safe UPSERT
  INSERT INTO public.organization_credit_balances (organization_id, balance)
  VALUES (p_organization_id, 0)
  ON CONFLICT (organization_id) DO NOTHING;
  
  -- Now lock the row (guaranteed to exist after UPSERT)
  SELECT COALESCE(balance, 0) INTO v_current_balance
  FROM public.organization_credit_balances
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  -- Check if sufficient balance
  IF v_current_balance < v_total_cost THEN
    RETURN QUERY SELECT 
      false, 
      v_current_balance, 
      0, 
      NULL::uuid, 
      format('Insufficient credits. Required: %s, Available: %s', v_total_cost, v_current_balance);
    RETURN;
  END IF;

  -- Calculate new balance
  v_new_balance := v_current_balance - v_total_cost;

  -- Insert debit transaction
  INSERT INTO public.credit_transactions (
    organization_id,
    transaction_type,
    amount,
    balance_after,
    source,
    feature_type,
    description,
    created_by,
    source_app,
    request_id
  ) VALUES (
    p_organization_id,
    'debit',
    v_total_cost,
    v_new_balance,
    NULL,
    p_feature_type,
    format('Consumed %s credits for %s (quantity: %s)', v_total_cost, p_feature_type, p_quantity),
    p_user_id,
    p_source_app,
    p_request_id
  )
  RETURNING id INTO v_transaction_id;

  -- Insert usage event for analytics
  INSERT INTO public.credit_usage_events (
    transaction_id,
    organization_id,
    feature_type,
    credits_consumed,
    feature_details,
    user_id,
    source_app
  ) VALUES (
    v_transaction_id,
    p_organization_id,
    p_feature_type,
    v_total_cost,
    p_feature_details,
    p_user_id,
    p_source_app
  )
  RETURNING id INTO v_usage_event_id;

  -- Return success
  RETURN QUERY SELECT 
    true, 
    v_new_balance, 
    v_total_cost, 
    v_transaction_id, 
    NULL::text;
END;
$$;

COMMENT ON FUNCTION public.sp_consume_credits IS 'Atomically consume credits with race condition prevention via SELECT FOR UPDATE. Includes master switch check for account lifecycle (Phase 2.5).';
-- Phase 2.5: Add Dunning Email Templates
-- These are global templates (organization_id = NULL) used for account lifecycle notifications

-- Add missing columns if they don't exist
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS body_text TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS description TEXT;

-- Create unique index for global templates (where org_id is null)
CREATE UNIQUE INDEX IF NOT EXISTS email_templates_global_template_key 
ON email_templates(template_key) WHERE organization_id IS NULL;

-- Insert global dunning templates
DO $$
DECLARE
  tpl RECORD;
BEGIN
  FOR tpl IN 
    SELECT * FROM (VALUES
      ('trial_3_days_left', 'Trial 3 Days Left', 'Your AutoListing trial ends in 3 days',
       '<h1>Hi {{business_name}},</h1><p>Your free trial will end in 3 days.</p><p><a href="{{subscribe_url}}">Subscribe Now</a></p>',
       'Your free trial will end in 3 days. Subscribe: {{subscribe_url}}',
       'Sent 3 days before trial ends'),
      ('trial_1_day_left', 'Trial 1 Day Left', 'Your AutoListing trial ends tomorrow!',
       '<h1>Hi {{business_name}},</h1><p>Your free trial ends tomorrow!</p><p><a href="{{subscribe_url}}">Subscribe Now</a></p>',
       'Your free trial ends tomorrow! Subscribe: {{subscribe_url}}',
       'Sent 1 day before trial ends'),
      ('trial_expired', 'Trial Expired', 'Your AutoListing trial has ended',
       '<h1>Hi {{business_name}},</h1><p>Your trial has ended. Subscribe within 14 days.</p><p><a href="{{subscribe_url}}">Subscribe Now</a></p>',
       'Your trial has ended. Subscribe: {{subscribe_url}}',
       'Sent when trial expires'),
      ('trial_expired_7_days_warning', 'Trial Expired 7 Day Warning', 'Only 7 days left to save your AutoListing account',
       '<h1>Hi {{business_name}},</h1><p>Your trial expired 7 days ago. You have 7 days left before archival.</p><p><a href="{{subscribe_url}}">Subscribe Now</a></p>',
       'Your trial expired 7 days ago. Subscribe: {{subscribe_url}}',
       'Sent 7 days after trial expires'),
      ('payment_failed', 'Payment Failed', 'Action Required: Payment failed',
       '<h1>Hi {{business_name}},</h1><p>Payment failed. Update within 14 days.</p><p><a href="{{billing_url}}">Update Payment</a></p>',
       'Payment failed. Update: {{billing_url}}',
       'Sent when payment fails'),
      ('payment_failed_7_days_warning', 'Payment Failed 7 Day Warning', 'Urgent: 7 days to fix your payment',
       '<h1>Hi {{business_name}},</h1><p>Payment failed 7 days ago. Update now to avoid archival.</p><p><a href="{{billing_url}}">Update Payment</a></p>',
       'Payment failed 7 days ago. Update: {{billing_url}}',
       'Sent 7 days after payment failure'),
      ('payment_recovered', 'Payment Recovered', 'Payment successful - Account restored',
       '<h1>Hi {{business_name}},</h1><p>Payment successful. Account restored.</p>',
       'Payment successful. Account restored.',
       'Sent when payment recovered'),
      ('subscription_canceled', 'Subscription Canceled', 'Your subscription has been canceled',
       '<h1>Hi {{business_name}},</h1><p>Canceled. Read-only for 30 days.</p><p><a href="{{subscribe_url}}">Reactivate</a></p>',
       'Canceled. Reactivate: {{subscribe_url}}',
       'Sent when canceled'),
      ('subscription_canceled_14_days_warning', 'Subscription Canceled 14 Day Warning', '14 days left on your AutoListing account',
       '<h1>Hi {{business_name}},</h1><p>Canceled 16 days ago. 14 days left before archival.</p><p><a href="{{subscribe_url}}">Reactivate</a></p>',
       'Canceled 16 days ago. Reactivate: {{subscribe_url}}',
       'Sent 16 days after cancellation'),
      ('card_expiring', 'Card Expiring', 'Your payment card expires soon',
       '<h1>Hi {{business_name}},</h1><p>Card expires on {{card_expires_at}}.</p><p><a href="{{billing_url}}">Update Payment</a></p>',
       'Card expires on {{card_expires_at}}. Update: {{billing_url}}',
       'Sent when card is about to expire'),
      ('account_archived', 'Account Archived', 'Your account has been archived',
       '<h1>Hi {{business_name}},</h1><p>Archived. Data retained 6 months.</p><p><a href="{{support_url}}">Contact Support</a></p>',
       'Archived. Contact: {{support_url}}',
       'Sent when archived'),
      ('account_archived_30_days_warning', 'Account Archived 30 Day Warning', 'Your data will be deleted in 30 days',
       '<h1>Hi {{business_name}},</h1><p>Archived data will be deleted in 30 days.</p><p><a href="{{support_url}}">Contact Support</a></p>',
       'Data deleted in 30 days. Contact: {{support_url}}',
       'Sent 5 months after archiving'),
      ('subscription_renewed', 'Subscription Renewed', 'Your subscription has renewed',
       '<h1>Hi {{business_name}},</h1><p>{{plan_name}} renewed. {{credits}} credits added.</p>',
       '{{plan_name}} renewed. {{credits}} credits added.',
       'Sent on successful renewal'),
      ('credits_low', 'Credits Low', 'Your credits are running low',
       '<h1>Hi {{business_name}},</h1><p>{{remaining_credits}} credits left.</p><p><a href="{{credits_url}}">Buy Credits</a></p>',
       '{{remaining_credits}} credits left. Buy: {{credits_url}}',
       'Sent when credits low')
    ) AS t(template_key, template_name, subject, body_html, body_text, description)
  LOOP
    UPDATE email_templates SET
      template_name = tpl.template_name,
      subject = tpl.subject,
      body_html = tpl.body_html,
      body_text = tpl.body_text,
      description = tpl.description,
      updated_at = NOW()
    WHERE template_key = tpl.template_key AND organization_id IS NULL;
    
    IF NOT FOUND THEN
      INSERT INTO email_templates (organization_id, template_key, template_name, subject, body_html, body_text, description)
      VALUES (NULL, tpl.template_key, tpl.template_name, tpl.subject, tpl.body_html, tpl.body_text, tpl.description);
    END IF;
  END LOOP;
END $$;

COMMENT ON COLUMN email_templates.body_text IS 'Plain text version of the email body';
COMMENT ON COLUMN email_templates.description IS 'Description of when this template is used';
