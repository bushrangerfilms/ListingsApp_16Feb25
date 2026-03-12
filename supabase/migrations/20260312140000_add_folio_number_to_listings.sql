-- Add folio_number column to listings table for land/property folio references
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS folio_number text;

-- Add a comment for documentation
COMMENT ON COLUMN public.listings.folio_number IS 'Land Registry folio number (optional, primarily used for Land listings)';
