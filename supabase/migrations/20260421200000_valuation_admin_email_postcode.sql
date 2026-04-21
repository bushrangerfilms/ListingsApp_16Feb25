-- Add postcode/eircode row to the valuation_admin_notification email template.
-- The row is rendered conditionally so it only appears when the requester supplied one.
-- The label is driven by a {postcodeLabel} placeholder populated from the org's country_code.

UPDATE public.email_templates
SET body_html = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #dc2626;">New Valuation Request</h2>
    <p>A new valuation request has been submitted:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; width: 120px;">Name:</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{name}</td></tr>
      <tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Email:</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><a href="mailto:{email}">{email}</a></td></tr>
      <tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Phone:</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><a href="tel:{phone}">{phone}</a></td></tr>
      <tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Property:</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{propertyAddress}</td></tr>
      {{#if postcode}}<tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">{postcodeLabel}:</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{postcode}</td></tr>{{/if}}
      <tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Message:</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{message}</td></tr>
    </table>
    <p>Log in to the CRM to view and manage this lead.</p>
  </div>'
WHERE template_key = 'valuation_admin_notification'
  AND organization_id IS NULL;
