-- Create listing_brochures table for AI-generated property brochures
CREATE TABLE public.listing_brochures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL DEFAULT 'classic-1',
  content JSONB NOT NULL DEFAULT '{}',
  branding JSONB NOT NULL DEFAULT '{}',
  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,
  ai_generated_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'ready', 'error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_archived BOOLEAN NOT NULL DEFAULT false
);

-- Only one active (non-archived) brochure per listing
CREATE UNIQUE INDEX idx_one_active_brochure_per_listing
  ON listing_brochures(listing_id) WHERE is_archived = false;

-- Fast lookup by org
CREATE INDEX idx_listing_brochures_org ON listing_brochures(organization_id);

-- Enable RLS
ALTER TABLE listing_brochures ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can manage brochures for their organization
CREATE POLICY "Users can view brochures for their org"
  ON listing_brochures FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert brochures for their org"
  ON listing_brochures FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update brochures for their org"
  ON listing_brochures FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete brochures for their org"
  ON listing_brochures FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()
  ));

-- Service role full access (for edge functions)
CREATE POLICY "Service role has full access to brochures"
  ON listing_brochures FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-update updated_at timestamp
CREATE TRIGGER set_listing_brochures_updated_at
  BEFORE UPDATE ON listing_brochures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for generated PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('brochure-pdfs', 'brochure-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: authenticated users can upload brochure PDFs
CREATE POLICY "Authenticated users can upload brochure PDFs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'brochure-pdfs' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view brochure PDFs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'brochure-pdfs');

CREATE POLICY "Authenticated users can update brochure PDFs"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'brochure-pdfs' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete brochure PDFs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'brochure-pdfs' AND auth.role() = 'authenticated');
