-- MINIMAL email templates for form submissions
-- This version uses only the essential columns that the send-email function requires
-- Run in Supabase SQL Editor

-- Step 1: Make organization_id nullable (required for platform-wide defaults)
ALTER TABLE public.email_templates 
ALTER COLUMN organization_id DROP NOT NULL;

-- Step 2: Insert templates with minimal columns
-- Using simple INSERT with ON CONFLICT DO NOTHING to avoid errors

-- Enquiry Confirmation (to buyer) - shows property address and hero photo
INSERT INTO public.email_templates (organization_id, template_key, template_name, subject, body_html, is_active)
SELECT NULL, 'enquiry_confirmation', 'Property Enquiry Confirmation', 
  'Thank you for your enquiry about {property_address}',
  '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
<h1 style="color:#1e40af;">Thank you for your enquiry!</h1>
<p>Dear {name},</p>
<p>We have received your enquiry about:</p>
<div style="background:#f8fafc;padding:15px;border-left:4px solid #1e40af;margin:15px 0;">
<p style="margin:0;font-weight:bold;">{property_address}</p>
</div>
{property_image_section}
<p>One of our team members will be in touch with you shortly to discuss the property and answer any questions you may have.</p>
<p>Best regards,<br><strong>{org_name}</strong></p>
</div>',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_key = 'enquiry_confirmation' AND organization_id IS NULL);

-- Enquiry Admin Notification - includes property details with address and photo
INSERT INTO public.email_templates (organization_id, template_key, template_name, subject, body_html, is_active)
SELECT NULL, 'enquiry_admin_notification', 'Property Enquiry Admin Notification',
  'New Property Enquiry: {property_address}',
  '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
<h1 style="color:#1e40af;">New Property Enquiry</h1>
<p>A new enquiry has been submitted.</p>
<div style="background:#f0f9ff;padding:15px;border-left:4px solid #1e40af;border-radius:4px;margin:15px 0;">
<p style="margin:0 0 5px 0;"><strong>Property:</strong> {property_address}</p>
<p style="margin:0;color:#64748b;font-size:14px;">{property_title}</p>
</div>
{property_image_section}
<div style="background:#f8fafc;padding:15px;border-radius:8px;margin:15px 0;">
<p style="margin:0 0 10px 0;"><strong>Contact Details:</strong></p>
<p style="margin:5px 0;"><strong>Name:</strong> {name}</p>
<p style="margin:5px 0;"><strong>Email:</strong> <a href="mailto:{email}">{email}</a></p>
<p style="margin:5px 0;"><strong>Phone:</strong> <a href="tel:{phone}">{phone}</a></p>
<p style="margin:10px 0 0 0;"><strong>Message:</strong> {message}</p>
</div>
</div>',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_key = 'enquiry_admin_notification' AND organization_id IS NULL);

-- Valuation Confirmation (to seller)
INSERT INTO public.email_templates (organization_id, template_key, template_name, subject, body_html, is_active)
SELECT NULL, 'valuation_confirmation', 'Valuation Request Confirmation',
  'Your Valuation Request Has Been Received',
  '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
<h1 style="color:#1e40af;">Valuation Request Received</h1>
<p>Dear {name},</p>
<p>Thank you for requesting a property valuation for:</p>
<div style="background:#f8fafc;padding:15px;border-radius:8px;margin:15px 0;">
<p><strong>{propertyAddress}</strong></p>
</div>
<p>A member of our team will contact you within 24-48 hours.</p>
<p>Kind regards,<br><strong>{org_name}</strong></p>
</div>',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_key = 'valuation_confirmation' AND organization_id IS NULL);

-- Valuation Admin Notification
INSERT INTO public.email_templates (organization_id, template_key, template_name, subject, body_html, is_active)
SELECT NULL, 'valuation_admin_notification', 'Valuation Request Admin Notification',
  'New Valuation Request: {propertyAddress}',
  '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
<h1 style="color:#1e40af;">New Valuation Request</h1>
<p>A new valuation request has been submitted.</p>
<div style="background:#f8fafc;padding:15px;border-radius:8px;margin:15px 0;">
<p><strong>Property:</strong> {propertyAddress}</p>
<p><strong>Name:</strong> {name}</p>
<p><strong>Email:</strong> {email}</p>
<p><strong>Phone:</strong> {phone}</p>
<p><strong>Message:</strong> {message}</p>
</div>
</div>',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_key = 'valuation_admin_notification' AND organization_id IS NULL);

-- Alert Confirmation (to subscriber)
INSERT INTO public.email_templates (organization_id, template_key, template_name, subject, body_html, is_active)
SELECT NULL, 'alert_confirmation', 'Property Alert Confirmation',
  'Your Property Alert Has Been Set Up',
  '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
<h1 style="color:#1e40af;">Property Alert Activated</h1>
<p>Dear {name},</p>
<p>Thank you for signing up for property alerts. We''ll notify you when new properties matching your criteria become available.</p>
<div style="background:#f8fafc;padding:15px;border-radius:8px;margin:15px 0;">
<p><strong>Your preferences:</strong> {bedrooms}</p>
</div>
<p>Kind regards,<br><strong>{org_name}</strong></p>
</div>',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_key = 'alert_confirmation' AND organization_id IS NULL);

-- Alert Admin Notification
INSERT INTO public.email_templates (organization_id, template_key, template_name, subject, body_html, is_active)
SELECT NULL, 'alert_admin_notification', 'Property Alert Admin Notification',
  'New Property Alert Subscriber',
  '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
<h1 style="color:#1e40af;">New Property Alert Subscriber</h1>
<p>A new subscriber has signed up for property alerts.</p>
<div style="background:#f8fafc;padding:15px;border-radius:8px;margin:15px 0;">
<p><strong>Name:</strong> {name}</p>
<p><strong>Email:</strong> {email}</p>
<p><strong>Phone:</strong> {phone}</p>
<p><strong>Bedrooms:</strong> {bedrooms}</p>
<p><strong>Comments:</strong> {comments}</p>
</div>
</div>',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_key = 'alert_admin_notification' AND organization_id IS NULL);

-- Verify the templates
SELECT template_key, template_name, organization_id, is_active 
FROM public.email_templates 
WHERE template_key IN (
  'enquiry_confirmation', 'enquiry_admin_notification',
  'valuation_confirmation', 'valuation_admin_notification',
  'alert_confirmation', 'alert_admin_notification'
);
