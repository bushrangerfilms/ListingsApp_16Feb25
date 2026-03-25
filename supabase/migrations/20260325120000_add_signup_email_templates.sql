-- Add welcome email and admin notification templates for new signups

DO $$
DECLARE
  tpl RECORD;
BEGIN
  FOR tpl IN
    SELECT * FROM (VALUES
      ('welcome_signup', 'Welcome Email', 'Welcome to AutoListing!',
       '<div style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  {{#if logo_url}}<div style="text-align:center;margin-bottom:24px;"><img src="{logo_url}" alt="AutoListing" style="max-height:48px;" /></div>{{/if}}
  <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 16px;">Welcome to AutoListing!</h1>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">Hi {first_name},</p>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">Thanks for signing up! Your account for <strong>{business_name}</strong> is all set up and ready to go.</p>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">Here''s what you get with your 14-day free trial:</p>
  <ul style="color: #475569; font-size: 16px; line-height: 1.8;">
    <li>100 free credits to get started</li>
    <li>AI-powered property descriptions</li>
    <li>Automated social media content</li>
    <li>Lead capture and CRM tools</li>
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
       'Welcome signup email sent to new users'),

      ('admin_new_signup_notification', 'New Signup Admin Notification', 'New Signup: {business_name}',
       '<div style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 16px;">New Signup</h1>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #64748b; font-size: 14px; width: 140px;">Business</td><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #1e293b; font-size: 14px; font-weight: 600;">{business_name}</td></tr>
    <tr><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #64748b; font-size: 14px;">Contact</td><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #1e293b; font-size: 14px;">{user_name} &lt;{user_email}&gt;</td></tr>
    <tr><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #64748b; font-size: 14px;">Plan</td><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #1e293b; font-size: 14px;">{plan_name}</td></tr>
    <tr><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #64748b; font-size: 14px;">Trial Ends</td><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #1e293b; font-size: 14px;">{trial_ends_at}</td></tr>
    <tr><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #64748b; font-size: 14px;">UTM Source</td><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #1e293b; font-size: 14px;">{utm_source}</td></tr>
  </table>
  <div style="text-align: center; margin: 24px 0;">
    <a href="{admin_url}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">View in Admin</a>
  </div>
</div>',
       'Admin notification when a new user signs up')
    ) AS t(template_key, template_name, subject, body_html, description)
  LOOP
    INSERT INTO public.email_templates (template_key, template_name, subject, body_html, description, is_active, organization_id)
    VALUES (tpl.template_key, tpl.template_name, tpl.subject, tpl.body_html, tpl.description, true, NULL)
    ON CONFLICT (template_key) WHERE organization_id IS NULL
    DO UPDATE SET
      template_name = EXCLUDED.template_name,
      subject = EXCLUDED.subject,
      body_html = EXCLUDED.body_html,
      description = EXCLUDED.description,
      is_active = EXCLUDED.is_active;
  END LOOP;
END $$;
