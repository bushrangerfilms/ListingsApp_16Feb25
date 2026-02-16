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
