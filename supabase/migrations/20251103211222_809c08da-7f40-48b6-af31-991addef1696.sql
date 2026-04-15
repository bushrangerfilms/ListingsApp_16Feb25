-- Phase 6: Add second organization for multi-tenant testing

-- Insert Streamlined Tech organization
INSERT INTO public.organizations (
  slug,
  business_name,
  logo_url,
  domain,
  contact_name,
  contact_email,
  contact_phone,
  business_address,
  psr_licence_number,
  is_active
) VALUES (
  'streamlined-tech',
  'Streamlined Tech',
  '/src/assets/streamlined-tech-logo.png',
  'streamlinedtech.ie',
  'Tech Support',
  'support@streamlinedtech.ie',
  '+353 1 234 5678',
  'Dublin, Ireland',
  NULL,
  true
)
ON CONFLICT (slug) DO NOTHING;

-- Get the organization IDs
DO $$
DECLARE
  v_streamlined_org_id uuid;
  v_bridge_org_id uuid;
BEGIN
  -- Get organization IDs
  SELECT id INTO v_streamlined_org_id FROM public.organizations WHERE slug = 'streamlined-tech';
  SELECT id INTO v_bridge_org_id FROM public.organizations WHERE slug = 'bridge-auctioneers';

  -- Add some test email templates for Streamlined Tech
  INSERT INTO public.email_templates (
    organization_id,
    template_key,
    template_name,
    category,
    subject,
    body_html,
    description
  ) VALUES (
    v_streamlined_org_id,
    'streamlined_welcome',
    'Streamlined Welcome Email',
    'customer',
    'Welcome to Streamlined Tech',
    '<p>Welcome to Streamlined Tech! We''re excited to have you.</p>',
    'Welcome email for new Streamlined Tech clients'
  )
  ON CONFLICT DO NOTHING;

  -- Add test social link for Streamlined Tech
  INSERT INTO public.social_links (
    organization_id,
    platform,
    url,
    enabled,
    display_order
  ) VALUES (
    v_streamlined_org_id,
    'linkedin',
    'https://linkedin.com/company/streamlined-tech',
    true,
    1
  )
  ON CONFLICT DO NOTHING;

END $$;