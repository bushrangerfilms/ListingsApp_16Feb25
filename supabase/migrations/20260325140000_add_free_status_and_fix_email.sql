-- Add 'free' to account_status CHECK constraint and fix welcome email template

-- Step 1: Update CHECK constraint to include 'free'
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_account_status_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_account_status_check
  CHECK (account_status IN ('free', 'trial', 'trial_expired', 'active', 'payment_failed', 'unsubscribed', 'archived'));

-- Step 2: Update welcome email template to reflect free tier (not trial)
UPDATE public.email_templates
SET body_html = '<div style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  {{#if logo_url}}<div style="text-align:center;margin-bottom:24px;"><img src="{logo_url}" alt="AutoListing" style="max-height:48px;" /></div>{{/if}}
  <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 16px;">Welcome to AutoListing!</h1>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">Hi {first_name},</p>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">Thanks for signing up! Your account for <strong>{business_name}</strong> is all set up and ready to go.</p>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">Here''s what''s included in your free plan:</p>
  <ul style="color: #475569; font-size: 16px; line-height: 1.8;">
    <li>Up to 3 property listings</li>
    <li>AI-generated property videos</li>
    <li>Automated social media posting</li>
    <li>Your own property website</li>
    <li>CRM &amp; lead capture</li>
  </ul>
  <div style="text-align: center; margin: 32px 0;">
    <a href="{login_url}" style="display: inline-block; background-color: {primary_color}; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Get Started</a>
  </div>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">If you have any questions, just reply to this email — we''re here to help.</p>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">Best,<br/>The AutoListing Team</p>
  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #94a3b8; text-align: center;">
    <p>&copy; AutoListing — Streamlined Digital Tech Ltd</p>
  </div>
</div>',
    updated_at = now()
WHERE template_key = 'welcome_signup'
  AND organization_id IS NULL;

-- Step 3: Update admin notification template — remove Trial Ends row
UPDATE public.email_templates
SET body_html = '<div style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 16px;">New Signup</h1>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #64748b; font-size: 14px; width: 140px;">Business</td><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #1e293b; font-size: 14px; font-weight: 600;">{business_name}</td></tr>
    <tr><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #64748b; font-size: 14px;">Contact</td><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #1e293b; font-size: 14px;">{user_name} &lt;{user_email}&gt;</td></tr>
    <tr><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #64748b; font-size: 14px;">Plan</td><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #1e293b; font-size: 14px;">{plan_name}</td></tr>
    <tr><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #64748b; font-size: 14px;">UTM Source</td><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #1e293b; font-size: 14px;">{utm_source}</td></tr>
  </table>
  <div style="text-align: center; margin: 24px 0;">
    <a href="{admin_url}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">View in Admin</a>
  </div>
</div>',
    updated_at = now()
WHERE template_key = 'admin_new_signup_notification'
  AND organization_id IS NULL;
