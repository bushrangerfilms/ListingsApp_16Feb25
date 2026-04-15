-- Convert date_posted from date to timestamptz for precise ordering
-- Must drop crm.listings view first since it depends on this column

-- Step 1: Drop the CRM view that depends on date_posted
DROP VIEW IF EXISTS crm.listings;

-- Step 2: Alter the column type
ALTER TABLE public.listings 
  ALTER COLUMN date_posted TYPE timestamptz USING date_posted::timestamptz;

-- Step 3: Update the default to use NOW() instead of CURRENT_DATE
ALTER TABLE public.listings 
  ALTER COLUMN date_posted SET DEFAULT NOW();

-- Step 4: Recreate the index for the new column type
DROP INDEX IF EXISTS idx_listings_date_posted;
CREATE INDEX idx_listings_date_posted ON public.listings(date_posted DESC);

-- Step 5: Recreate the crm.listings view
CREATE VIEW crm.listings AS
SELECT id,
    organization_id,
    client_id,
    airtable_record_id,
    title,
    description,
    building_type,
    category,
    price,
    bedrooms,
    bathrooms,
    ensuite,
    floor_area_size,
    land_size,
    address,
    address_detail,
    address_town,
    county,
    eircode,
    ber_rating,
    specs,
    furnished,
    photos,
    hero_photo,
    social_media_photos,
    booking_link,
    slug,
    live_url,
    status,
    status_changed_date,
    new_status_set_date,
    date_posted,
    archived,
    sm_posting_status,
    created_at,
    updated_at
FROM public.listings;

-- Step 6: Re-grant permissions on the recreated view
GRANT SELECT ON crm.listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON crm.listings TO authenticated;
GRANT ALL PRIVILEGES ON crm.listings TO service_role;
