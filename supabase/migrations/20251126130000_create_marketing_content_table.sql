-- Create marketing_content table for customizable per-organization marketing sections
CREATE TABLE IF NOT EXISTS public.marketing_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  section_key VARCHAR(50) NOT NULL, -- e.g., 'sell_property', 'why_choose_us'
  headline TEXT,
  subheadline TEXT,
  paragraph_1 TEXT,
  paragraph_2 TEXT,
  paragraph_3 TEXT,
  image_url TEXT,
  is_enabled BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, section_key)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_marketing_content_org_section 
ON public.marketing_content(organization_id, section_key);

-- Enable RLS
ALTER TABLE public.marketing_content ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage their organization's marketing content
CREATE POLICY "Admins can manage marketing content"
ON public.marketing_content
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND organization_id IN (SELECT get_user_organization_ids(auth.uid()))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

-- Policy: Anyone can read enabled marketing content (for public display)
CREATE POLICY "Public can read enabled marketing content"
ON public.marketing_content
FOR SELECT
USING (is_enabled = true);

-- Grant permissions
GRANT SELECT ON public.marketing_content TO anon;
GRANT ALL ON public.marketing_content TO authenticated;

-- Add comment
COMMENT ON TABLE public.marketing_content IS 'Per-organization customizable marketing content sections';
