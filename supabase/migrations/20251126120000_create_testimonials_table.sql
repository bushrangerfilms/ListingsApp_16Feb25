-- Ensure has_role function exists (should already exist from earlier migrations)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- Ensure get_user_organization_ids function exists
CREATE OR REPLACE FUNCTION public.get_user_organization_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id 
  FROM public.user_organizations 
  WHERE user_id = _user_id;
$$;

-- Create testimonials table for organization-specific reviews/testimonials
CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  author_role text,
  content text NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  is_featured boolean DEFAULT false,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for efficient querying by organization
CREATE INDEX IF NOT EXISTS idx_testimonials_organization 
ON public.testimonials(organization_id, is_active, display_order);

-- Enable RLS
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active testimonials (for public site)
CREATE POLICY "Anyone can read active testimonials"
ON public.testimonials
FOR SELECT
USING (is_active = true);

-- Policy: Admins and super admins can manage testimonials for their organization
CREATE POLICY "Admins can manage testimonials"
ON public.testimonials
FOR ALL
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_testimonials_updated_at
  BEFORE UPDATE ON public.testimonials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add some default testimonials for Bridge Auctioneers (migration from hardcoded)
INSERT INTO public.testimonials (organization_id, author_name, author_role, content, display_order, is_active)
SELECT 
  id as organization_id,
  'Satisfied Client' as author_name,
  'Property Seller' as author_role,
  'Excellent service. Very reliable and professional. House sold quickly and I was very happy with the way everything was handled.' as content,
  1 as display_order,
  true as is_active
FROM public.organizations WHERE slug = 'bridge-auctioneers'
ON CONFLICT DO NOTHING;

INSERT INTO public.testimonials (organization_id, author_name, author_role, content, display_order, is_active)
SELECT 
  id as organization_id,
  'Happy Seller' as author_name,
  'Property Seller' as author_role,
  'Pure gentleman, very professional when it came to selling our house. Would highly recommend.' as content,
  2 as display_order,
  true as is_active
FROM public.organizations WHERE slug = 'bridge-auctioneers'
ON CONFLICT DO NOTHING;

INSERT INTO public.testimonials (organization_id, author_name, author_role, content, display_order, is_active)
SELECT 
  id as organization_id,
  'Business Partner' as author_name,
  'Professional Contact' as author_role,
  'Professional, caring and always with clients'' best interests at heart. Couldn''t recommend highly enough.' as content,
  3 as display_order,
  true as is_active
FROM public.organizations WHERE slug = 'bridge-auctioneers'
ON CONFLICT DO NOTHING;

INSERT INTO public.testimonials (organization_id, author_name, author_role, content, display_order, is_active)
SELECT 
  id as organization_id,
  'Recent Seller' as author_name,
  'Property Seller' as author_role,
  'Dealt with me in a professional manner throughout the entire process.' as content,
  4 as display_order,
  true as is_active
FROM public.organizations WHERE slug = 'bridge-auctioneers'
ON CONFLICT DO NOTHING;
