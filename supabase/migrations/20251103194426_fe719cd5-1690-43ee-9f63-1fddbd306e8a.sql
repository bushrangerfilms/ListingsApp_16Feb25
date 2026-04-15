-- Create listings table in Supabase (migrating from Airtable)
CREATE TABLE public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Airtable reference (for dual-write preservation)
  airtable_record_id text UNIQUE,
  
  -- Basic property details
  title text NOT NULL,
  description text,
  building_type text,
  price numeric,
  
  -- Property specifications
  bedrooms integer,
  bathrooms integer,
  ensuite integer,
  floor_area_size numeric,
  
  -- Location
  address text NOT NULL,
  address_detail text,
  
  -- Energy & Category
  ber_rating text,
  category text NOT NULL,
  furnished text,
  
  -- Media & Links
  photos text[], -- Array of photo URLs
  booking_link text,
  
  -- Status tracking
  status text NOT NULL DEFAULT 'New',
  status_changed_date date,
  new_status_set_date date,
  date_posted date NOT NULL DEFAULT CURRENT_DATE,
  
  -- Archive flag
  archived boolean NOT NULL DEFAULT false
);

-- Add indexes for performance
CREATE INDEX idx_listings_status ON public.listings(status);
CREATE INDEX idx_listings_category ON public.listings(category);
CREATE INDEX idx_listings_archived ON public.listings(archived);
CREATE INDEX idx_listings_date_posted ON public.listings(date_posted DESC);
CREATE INDEX idx_listings_airtable_id ON public.listings(airtable_record_id);

-- Add trigger for updated_at
CREATE TRIGGER update_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Public can view non-archived published listings
CREATE POLICY "Anyone can view published listings"
  ON public.listings
  FOR SELECT
  USING (archived = false AND status = 'Published');

-- Admins can view all listings (including archived)
CREATE POLICY "Admins can view all listings"
  ON public.listings
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert listings
CREATE POLICY "Admins can create listings"
  ON public.listings
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update listings
CREATE POLICY "Admins can update listings"
  ON public.listings
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete listings (soft delete via archived flag preferred)
CREATE POLICY "Admins can delete listings"
  ON public.listings
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can manage listings (for edge functions)
CREATE POLICY "Service role can manage listings"
  ON public.listings
  FOR ALL
  USING (true)
  WITH CHECK (true);