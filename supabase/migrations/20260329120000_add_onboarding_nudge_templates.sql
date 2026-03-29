-- Add onboarding nudge email templates (Day 1, Day 3, Day 7)
-- Sent to users who signed up but haven't created their first listing

DO $$
DECLARE
  tpl RECORD;
BEGIN
  FOR tpl IN
    SELECT * FROM (VALUES
      ('onboarding_nudge_1', 'Onboarding Nudge - Day 1', 'Your first listing is just minutes away, {first_name}',
       '<div style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  {{#if logo_url}}<div style="text-align:center;margin-bottom:24px;"><img src="{logo_url}" alt="AutoListing" style="max-height:48px;" /></div>{{/if}}
  <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 16px;">Ready to add your first listing?</h1>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">Hi {first_name},</p>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">Welcome aboard! You''re just a few clicks away from having your first property live on AutoListing.</p>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">Adding a listing takes under 2 minutes — just upload your photos and details, and we''ll handle the rest: automated social media videos, smart scheduling, and lead capture.</p>
  <div style="text-align: center; margin: 32px 0;">
    <a href="{create_listing_url}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Add Your First Listing</a>
  </div>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">If you have any questions, just reply to this email — we''re here to help.</p>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">Best,<br/>The AutoListing Team</p>
  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #94a3b8; text-align: center;">
    <p>&copy; AutoListing — Streamlined Digital Tech Ltd</p>
  </div>
</div>',
       'Onboarding nudge sent 24h after signup if no listing created'),

      ('onboarding_nudge_2', 'Onboarding Nudge - Day 3', 'Need a hand getting started, {first_name}?',
       '<div style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  {{#if logo_url}}<div style="text-align:center;margin-bottom:24px;"><img src="{logo_url}" alt="AutoListing" style="max-height:48px;" /></div>{{/if}}
  <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 16px;">Getting started is easy</h1>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">Hi {first_name},</p>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">We noticed you haven''t added a listing yet for <strong>{business_name}</strong>. Here''s how simple it is to get your property marketing on autopilot:</p>
  <table style="width: 100%; margin: 24px 0; border-collapse: collapse;">
    <tr>
      <td style="padding: 16px; vertical-align: top; width: 48px;">
        <div style="width: 32px; height: 32px; border-radius: 50%; background-color: #dbeafe; color: #2563eb; font-weight: 700; font-size: 16px; line-height: 32px; text-align: center;">1</div>
      </td>
      <td style="padding: 16px; color: #475569; font-size: 15px; line-height: 1.5;">
        <strong style="color: #1e293b;">Add your listing</strong><br/>Upload photos and property details — takes under 2 minutes.
      </td>
    </tr>
    <tr>
      <td style="padding: 16px; vertical-align: top;">
        <div style="width: 32px; height: 32px; border-radius: 50%; background-color: #dbeafe; color: #2563eb; font-weight: 700; font-size: 16px; line-height: 32px; text-align: center;">2</div>
      </td>
      <td style="padding: 16px; color: #475569; font-size: 15px; line-height: 1.5;">
        <strong style="color: #1e293b;">Connect your socials</strong><br/>Link your Facebook, Instagram, or TikTok accounts.
      </td>
    </tr>
    <tr>
      <td style="padding: 16px; vertical-align: top;">
        <div style="width: 32px; height: 32px; border-radius: 50%; background-color: #dbeafe; color: #2563eb; font-weight: 700; font-size: 16px; line-height: 32px; text-align: center;">3</div>
      </td>
      <td style="padding: 16px; color: #475569; font-size: 15px; line-height: 1.5;">
        <strong style="color: #1e293b;">Sit back</strong><br/>We auto-generate videos and schedule posts across your channels.
      </td>
    </tr>
  </table>
  <div style="text-align: center; margin: 32px 0;">
    <a href="{create_listing_url}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Add Your First Listing</a>
  </div>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">Questions? Just hit reply — we read every email.</p>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">Best,<br/>The AutoListing Team</p>
  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #94a3b8; text-align: center;">
    <p>&copy; AutoListing — Streamlined Digital Tech Ltd</p>
  </div>
</div>',
       'Onboarding nudge sent 3 days after signup if no listing created'),

      ('onboarding_nudge_3', 'Onboarding Nudge - Day 7', 'We''re here to help you get started, {first_name}',
       '<div style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  {{#if logo_url}}<div style="text-align:center;margin-bottom:24px;"><img src="{logo_url}" alt="AutoListing" style="max-height:48px;" /></div>{{/if}}
  <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 16px;">Can we help?</h1>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">Hi {first_name},</p>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">It''s been a week since you signed up for AutoListing, and we noticed you haven''t added a listing yet. We want to make sure nothing is getting in your way.</p>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">If you''re unsure where to start, or if something isn''t working as expected, we''d love to help. Just reply to this email and one of our team will get back to you personally.</p>
  <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid #2563eb;">
    <p style="color: #1e293b; font-size: 15px; line-height: 1.6; margin: 0;"><strong>What you''re missing out on:</strong></p>
    <ul style="color: #475569; font-size: 15px; line-height: 1.8; margin: 8px 0 0 0; padding-left: 20px;">
      <li>AI-generated property videos posted automatically</li>
      <li>Smart scheduling across Facebook, Instagram &amp; TikTok</li>
      <li>Lead capture forms and buyer matching</li>
      <li>Your own branded property website</li>
    </ul>
  </div>
  <div style="text-align: center; margin: 32px 0;">
    <a href="{create_listing_url}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Add Your First Listing</a>
  </div>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">We built AutoListing to save agents hours every week — we''d love to show you how.</p>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">Best,<br/>The AutoListing Team</p>
  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #94a3b8; text-align: center;">
    <p>&copy; AutoListing — Streamlined Digital Tech Ltd</p>
  </div>
</div>',
       'Onboarding nudge sent 7 days after signup if no listing created — final nudge with support offer')

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
