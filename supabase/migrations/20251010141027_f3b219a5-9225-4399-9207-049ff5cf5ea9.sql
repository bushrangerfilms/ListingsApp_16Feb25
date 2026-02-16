-- Create listing views tracking table
CREATE TABLE IF NOT EXISTS public.listing_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id text NOT NULL,
  listing_title text,
  viewed_at timestamp with time zone DEFAULT now(),
  ip_address text,
  created_at timestamp with time zone DEFAULT now()
);

-- Index for faster queries
CREATE INDEX idx_listing_views_listing_id ON public.listing_views(listing_id);
CREATE INDEX idx_listing_views_viewed_at ON public.listing_views(viewed_at);

-- Enable RLS
ALTER TABLE public.listing_views ENABLE ROW LEVEL SECURITY;

-- Allow anyone to track listing views
CREATE POLICY "Anyone can track listing views"
  ON public.listing_views
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Admins can view listing analytics
CREATE POLICY "Admins can view listing analytics"
  ON public.listing_views
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));