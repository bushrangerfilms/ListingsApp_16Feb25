-- Phase 1: Create organizations and user_organizations tables (fixed order)

-- Create organizations table (master client data)
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Business Identity
  slug text UNIQUE NOT NULL,
  business_name text NOT NULL,
  logo_url text,
  domain text,
  
  -- Contact Info
  contact_name text,
  contact_email text,
  contact_phone text,
  business_address text,
  
  -- Business Metadata
  psr_licence_number text,
  listings_base_id text,
  
  -- Settings
  is_active boolean DEFAULT true,
  settings jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_organizations table (many-to-many mapping)
CREATE TABLE IF NOT EXISTS public.user_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  
  -- Role within THIS organization
  role text NOT NULL DEFAULT 'member',
  
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, organization_id)
);

-- Enable RLS on both tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "Users can view their organization"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id 
      FROM public.user_organizations 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update their organization"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT uo.organization_id 
      FROM public.user_organizations uo
      JOIN public.user_roles ur ON ur.user_id = uo.user_id
      WHERE uo.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

CREATE POLICY "Service role can manage organizations"
  ON public.organizations FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for user_organizations
CREATE POLICY "Users can view their memberships"
  ON public.user_organizations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Organization admins can manage memberships"
  ON public.user_organizations FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT uo.organization_id 
      FROM public.user_organizations uo
      WHERE uo.user_id = auth.uid() 
      AND uo.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Service role can manage user_organizations"
  ON public.user_organizations FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create trigger for organizations updated_at
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('organization-logos', 'organization-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for organization logos
CREATE POLICY "Anyone can view organization logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'organization-logos');

CREATE POLICY "Authenticated users can upload organization logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'organization-logos');

CREATE POLICY "Organization admins can update logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'organization-logos');

CREATE POLICY "Organization admins can delete logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'organization-logos');