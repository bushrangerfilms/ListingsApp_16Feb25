-- Add missing columns from Airtable to listings table

-- Address fields (currently address is a concatenated field)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS address_town text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS county text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS eircode text;

-- Property details
ALTER TABLE listings ADD COLUMN IF NOT EXISTS land_size numeric; -- Land Size in Acres
ALTER TABLE listings ADD COLUMN IF NOT EXISTS specs text; -- Specs (Dimensions / Services)

-- Social media and marketing
ALTER TABLE listings ADD COLUMN IF NOT EXISTS sm_posting_status text DEFAULT 'Todo';

-- URL and slug fields
ALTER TABLE listings ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS live_url text;

-- Create unique index on slug per organization
CREATE UNIQUE INDEX IF NOT EXISTS listings_organization_slug_idx ON listings(organization_id, slug) WHERE slug IS NOT NULL;