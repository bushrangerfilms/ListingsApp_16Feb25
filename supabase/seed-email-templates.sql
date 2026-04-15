-- Seed default email templates for form submissions
-- Run this in Supabase SQL Editor to enable form email notifications

-- Step 1: First, check what columns exist in your email_templates table
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'email_templates' AND table_schema = 'public';

-- Step 2: Make organization_id nullable to allow platform-wide default templates
-- (Skip this if you get an error - the column might already be nullable or not exist)
ALTER TABLE public.email_templates 
ALTER COLUMN organization_id DROP NOT NULL;

-- Step 3: Drop the unique constraint on template_key so we can have org-specific + default templates
-- (Skip if you get an error about constraint not existing)
ALTER TABLE public.email_templates DROP CONSTRAINT IF EXISTS email_templates_template_key_key;

-- Step 4: Create a composite unique constraint (template_key + organization_id)
-- This allows both default templates (org_id = NULL) and org-specific templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_templates_template_key_org_unique'
  ) THEN
    ALTER TABLE public.email_templates 
    ADD CONSTRAINT email_templates_template_key_org_unique 
    UNIQUE (template_key, organization_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors
  NULL;
END $$;

-- Step 5: Insert default templates (organization_id = NULL for platform-wide defaults)
-- These templates will be used as fallback for all organizations

-- 1. Property Enquiry - Confirmation to Buyer
INSERT INTO public.email_templates (
  organization_id,
  template_key,
  template_name,
  subject,
  body_html,
  available_variables,
  description,
  is_active
) VALUES (
  NULL,
  'enquiry_confirmation',
  'Property Enquiry Confirmation',
  'Thank you for your enquiry about {property_title}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  {{#if logo_url}}
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="{logo_url}" alt="{org_name}" style="max-height: 60px; max-width: 200px;">
  </div>
  {{/if}}
  
  <h1 style="color: {primary_color}; font-size: 24px; margin-bottom: 20px;">Thank You for Your Enquiry</h1>
  
  <p>Dear {name},</p>
  
  <p>Thank you for your interest in <strong>{property_title}</strong>. We have received your enquiry and a member of our team will be in touch with you shortly.</p>
  
  <p>In the meantime, if you have any questions, please don''t hesitate to contact us.</p>
  
  <p style="margin-top: 30px;">
    Kind regards,<br>
    <strong>{org_name}</strong>
  </p>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  
  <p style="font-size: 12px; color: #666;">
    {org_address}
  </p>
</body>
</html>',
  '{"name": "Enquirer name", "property_title": "Property title", "org_name": "Organization name", "logo_url": "Organization logo", "primary_color": "Brand color", "org_address": "Business address"}'::jsonb,
  'Sent to buyers after they submit a property enquiry',
  true
)
ON CONFLICT ON CONSTRAINT email_templates_template_key_org_unique DO UPDATE SET
  template_name = EXCLUDED.template_name,
  subject = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  updated_at = now();

-- 2. Property Enquiry - Admin Notification
INSERT INTO public.email_templates (
  organization_id,
  template_key,
  template_name,
  subject,
  body_html,
  available_variables,
  description,
  is_active
) VALUES (
  NULL,
  'enquiry_admin_notification',
  'Property Enquiry Admin Notification',
  'New Property Enquiry: {property_title}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1e40af; font-size: 24px; margin-bottom: 20px;">New Property Enquiry</h1>
  
  <p>A new enquiry has been submitted for <strong>{property_title}</strong>.</p>
  
  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #1e40af;">Contact Details</h3>
    <p style="margin: 5px 0;"><strong>Name:</strong> {name}</p>
    <p style="margin: 5px 0;"><strong>Email:</strong> <a href="mailto:{email}">{email}</a></p>
    <p style="margin: 5px 0;"><strong>Phone:</strong> <a href="tel:{phone}">{phone}</a></p>
  </div>
  
  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #1e40af;">Message</h3>
    <p style="margin: 0;">{message}</p>
  </div>
  
  <p style="margin-top: 30px; font-size: 12px; color: #666;">
    This is an automated notification from {org_name}.
  </p>
</body>
</html>',
  '{"name": "Enquirer name", "email": "Enquirer email", "phone": "Enquirer phone", "property_title": "Property title", "message": "Enquiry message", "org_name": "Organization name"}'::jsonb,
  'Sent to admins when a new property enquiry is received',
  true
)
ON CONFLICT ON CONSTRAINT email_templates_template_key_org_unique DO UPDATE SET
  template_name = EXCLUDED.template_name,
  subject = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  updated_at = now();

-- 3. Valuation Request - Confirmation to Seller
INSERT INTO public.email_templates (
  organization_id,
  template_key,
  template_name,
  subject,
  body_html,
  available_variables,
  description,
  is_active
) VALUES (
  NULL,
  'valuation_confirmation',
  'Valuation Request Confirmation',
  'Your Valuation Request Has Been Received',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  {{#if logo_url}}
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="{logo_url}" alt="{org_name}" style="max-height: 60px; max-width: 200px;">
  </div>
  {{/if}}
  
  <h1 style="color: {primary_color}; font-size: 24px; margin-bottom: 20px;">Valuation Request Received</h1>
  
  <p>Dear {name},</p>
  
  <p>Thank you for requesting a property valuation for:</p>
  
  <div style="background: #f8fafc; border-radius: 8px; padding: 15px; margin: 20px 0;">
    <p style="margin: 0; font-weight: bold;">{propertyAddress}</p>
  </div>
  
  <p>A member of our team will review your request and contact you within 24-48 hours to arrange a convenient time for the valuation.</p>
  
  <p>If you have any questions in the meantime, please don''t hesitate to get in touch.</p>
  
  <p style="margin-top: 30px;">
    Kind regards,<br>
    <strong>{org_name}</strong>
  </p>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  
  <p style="font-size: 12px; color: #666;">
    {org_address}
  </p>
</body>
</html>',
  '{"name": "Requester name", "propertyAddress": "Property address", "org_name": "Organization name", "logo_url": "Organization logo", "primary_color": "Brand color", "org_address": "Business address"}'::jsonb,
  'Sent to sellers after they request a property valuation',
  true
)
ON CONFLICT ON CONSTRAINT email_templates_template_key_org_unique DO UPDATE SET
  template_name = EXCLUDED.template_name,
  subject = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  updated_at = now();

-- 4. Valuation Request - Admin Notification
INSERT INTO public.email_templates (
  organization_id,
  template_key,
  template_name,
  subject,
  body_html,
  available_variables,
  description,
  is_active
) VALUES (
  NULL,
  'valuation_admin_notification',
  'Valuation Request Admin Notification',
  'New Valuation Request: {propertyAddress}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1e40af; font-size: 24px; margin-bottom: 20px;">New Valuation Request</h1>
  
  <p>A new valuation request has been submitted.</p>
  
  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #1e40af;">Property Details</h3>
    <p style="margin: 5px 0;"><strong>Address:</strong> {propertyAddress}</p>
  </div>
  
  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #1e40af;">Contact Details</h3>
    <p style="margin: 5px 0;"><strong>Name:</strong> {name}</p>
    <p style="margin: 5px 0;"><strong>Email:</strong> <a href="mailto:{email}">{email}</a></p>
    <p style="margin: 5px 0;"><strong>Phone:</strong> <a href="tel:{phone}">{phone}</a></p>
  </div>
  
  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #1e40af;">Additional Information</h3>
    <p style="margin: 0;">{message}</p>
  </div>
  
  <p style="margin-top: 30px; font-size: 12px; color: #666;">
    This is an automated notification from {org_name}.
  </p>
</body>
</html>',
  '{"name": "Requester name", "email": "Requester email", "phone": "Requester phone", "propertyAddress": "Property address", "message": "Additional information", "org_name": "Organization name"}'::jsonb,
  'Sent to admins when a new valuation request is received',
  true
)
ON CONFLICT ON CONSTRAINT email_templates_template_key_org_unique DO UPDATE SET
  template_name = EXCLUDED.template_name,
  subject = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  updated_at = now();

-- 5. Property Alert - Confirmation to Subscriber
INSERT INTO public.email_templates (
  organization_id,
  template_key,
  template_name,
  subject,
  body_html,
  available_variables,
  description,
  is_active
) VALUES (
  NULL,
  'alert_confirmation',
  'Property Alert Confirmation',
  'Your Property Alert Has Been Set Up',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  {{#if logo_url}}
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="{logo_url}" alt="{org_name}" style="max-height: 60px; max-width: 200px;">
  </div>
  {{/if}}
  
  <h1 style="color: {primary_color}; font-size: 24px; margin-bottom: 20px;">Property Alert Activated</h1>
  
  <p>Dear {name},</p>
  
  <p>Thank you for signing up for property alerts. We''ll notify you when new properties matching your criteria become available.</p>
  
  <div style="background: #f8fafc; border-radius: 8px; padding: 15px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Your preferences:</strong> {bedrooms}</p>
  </div>
  
  <p>You can update your preferences or unsubscribe at any time by clicking the link below:</p>
  
  <p><a href="{preferencesUrl}" style="color: {primary_color};">Manage Your Alert Preferences</a></p>
  
  <p style="margin-top: 30px;">
    Kind regards,<br>
    <strong>{org_name}</strong>
  </p>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  
  <p style="font-size: 12px; color: #666;">
    {org_address}
  </p>
</body>
</html>',
  '{"name": "Subscriber name", "bedrooms": "Bedroom preferences", "preferencesUrl": "Preferences URL", "org_name": "Organization name", "logo_url": "Organization logo", "primary_color": "Brand color", "org_address": "Business address"}'::jsonb,
  'Sent to subscribers after they sign up for property alerts',
  true
)
ON CONFLICT ON CONSTRAINT email_templates_template_key_org_unique DO UPDATE SET
  template_name = EXCLUDED.template_name,
  subject = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  updated_at = now();

-- 6. Property Alert - Admin Notification
INSERT INTO public.email_templates (
  organization_id,
  template_key,
  template_name,
  subject,
  body_html,
  available_variables,
  description,
  is_active
) VALUES (
  NULL,
  'alert_admin_notification',
  'Property Alert Admin Notification',
  'New Property Alert Subscriber',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1e40af; font-size: 24px; margin-bottom: 20px;">New Property Alert Subscriber</h1>
  
  <p>A new subscriber has signed up for property alerts.</p>
  
  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #1e40af;">Contact Details</h3>
    <p style="margin: 5px 0;"><strong>Name:</strong> {name}</p>
    <p style="margin: 5px 0;"><strong>Email:</strong> <a href="mailto:{email}">{email}</a></p>
    <p style="margin: 5px 0;"><strong>Phone:</strong> <a href="tel:{phone}">{phone}</a></p>
  </div>
  
  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #1e40af;">Preferences</h3>
    <p style="margin: 5px 0;"><strong>Bedrooms:</strong> {bedrooms}</p>
    <p style="margin: 5px 0;"><strong>Comments:</strong> {comments}</p>
  </div>
  
  <p style="margin-top: 30px; font-size: 12px; color: #666;">
    This is an automated notification from {org_name}.
  </p>
</body>
</html>',
  '{"name": "Subscriber name", "email": "Subscriber email", "phone": "Subscriber phone", "bedrooms": "Bedroom preferences", "comments": "Additional comments", "org_name": "Organization name"}'::jsonb,
  'Sent to admins when a new property alert subscriber signs up',
  true
)
ON CONFLICT ON CONSTRAINT email_templates_template_key_org_unique DO UPDATE SET
  template_name = EXCLUDED.template_name,
  subject = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  updated_at = now();

-- Verify templates were created
SELECT template_key, template_name, organization_id, is_active 
FROM public.email_templates 
WHERE template_key IN (
  'enquiry_confirmation',
  'enquiry_admin_notification',
  'valuation_confirmation',
  'valuation_admin_notification',
  'alert_confirmation',
  'alert_admin_notification'
)
ORDER BY template_key;
