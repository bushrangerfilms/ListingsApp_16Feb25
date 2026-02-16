-- Create storage bucket for listing photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-photos',
  'listing-photos',
  true,
  5242880, -- 5MB limit per file
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
);

-- Create storage policies for listing photos
CREATE POLICY "Anyone can view listing photos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'listing-photos');

CREATE POLICY "Service role can upload listing photos"
  ON storage.objects
  FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'listing-photos');

CREATE POLICY "Service role can update listing photos"
  ON storage.objects
  FOR UPDATE
  TO service_role
  USING (bucket_id = 'listing-photos');

CREATE POLICY "Service role can delete listing photos"
  ON storage.objects
  FOR DELETE
  TO service_role
  USING (bucket_id = 'listing-photos');