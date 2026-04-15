-- Create photo_upscale_jobs table to track Topaz AI upscaling requests
CREATE TABLE public.photo_upscale_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Reference to the listing
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Photo identification
  photo_type text NOT NULL CHECK (photo_type IN ('hero', 'social_media', 'gallery')),
  photo_index integer, -- Index in the array (for social_media/gallery photos)
  
  -- URLs
  original_url text NOT NULL,
  upscaled_url text,
  
  -- Kie.ai job tracking
  job_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  error_message text,
  
  -- Metadata
  original_file_size integer, -- in bytes
  upscaled_file_size integer,
  scale_factor integer DEFAULT 4,
  
  -- Timestamps
  started_at timestamptz,
  completed_at timestamptz
);

-- Add indexes for performance
CREATE INDEX idx_photo_upscale_jobs_listing ON public.photo_upscale_jobs(listing_id);
CREATE INDEX idx_photo_upscale_jobs_org ON public.photo_upscale_jobs(organization_id);
CREATE INDEX idx_photo_upscale_jobs_status ON public.photo_upscale_jobs(status);
CREATE INDEX idx_photo_upscale_jobs_job_id ON public.photo_upscale_jobs(job_id);

-- Add trigger for updated_at
CREATE TRIGGER update_photo_upscale_jobs_updated_at
  BEFORE UPDATE ON public.photo_upscale_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.photo_upscale_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their org's upscale jobs"
  ON public.photo_upscale_jobs
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_organizations 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage upscale jobs"
  ON public.photo_upscale_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
