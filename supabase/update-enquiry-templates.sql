-- Update enquiry email templates to use property address and include hero photo
-- Run this in Supabase SQL Editor

-- Update Enquiry Confirmation (to buyer) - uses property address and hero photo
UPDATE public.email_templates 
SET 
  subject = 'Thank you for your enquiry about {property_address}',
  body_html = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
<h1 style="color:#1e40af;">Thank you for your enquiry!</h1>
<p>Dear {name},</p>
<p>We have received your enquiry about:</p>
<div style="background:#f8fafc;padding:15px;border-left:4px solid #1e40af;margin:15px 0;">
<p style="margin:0;font-weight:bold;">{property_address}</p>
</div>
{property_image_section}
<p>One of our team members will be in touch with you shortly to discuss the property and answer any questions you may have.</p>
<p>Best regards,<br><strong>{org_name}</strong></p>
</div>'
WHERE template_key = 'enquiry_confirmation' AND organization_id IS NULL;

-- Update Enquiry Admin Notification - includes property address and hero photo
UPDATE public.email_templates 
SET 
  subject = 'New Property Enquiry: {property_address}',
  body_html = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
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
</div>'
WHERE template_key = 'enquiry_admin_notification' AND organization_id IS NULL;

-- Verify the updates
SELECT template_key, subject, 
  CASE WHEN body_html LIKE '%property_address%' THEN 'Has property_address' ELSE 'Missing' END as has_address,
  CASE WHEN body_html LIKE '%property_image_section%' THEN 'Has image section' ELSE 'Missing' END as has_image
FROM public.email_templates 
WHERE template_key IN ('enquiry_confirmation', 'enquiry_admin_notification');
