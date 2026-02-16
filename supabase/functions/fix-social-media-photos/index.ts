/**
 * @deprecated LEGACY FUNCTION - MISSING ORGANIZATION FILTER
 * This function processes ALL listings without organization_id filtering.
 * It should only be run by super admins for maintenance purposes.
 * For multi-tenant use, add organization_id filtering.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting fix for social_media_photos column');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' }
    });

    // Get all listings
    const { data: listings, error: fetchError } = await supabase
      .from('listings')
      .select('id, airtable_record_id, title, photos, social_media_photos');

    if (fetchError) {
      console.error('Error fetching listings:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch listings', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${listings.length} listings to process`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const listing of listings) {
      try {
        const photos = listing.photos || [];
        const socialMediaPhotos = listing.social_media_photos || [];
        
        // Skip if no photos
        if (photos.length === 0) {
          console.log(`Listing ${listing.title}: No photos, skipping`);
          skipped++;
          continue;
        }

        // Parse if needed
        const photosArray = typeof photos === 'string' ? JSON.parse(photos) : photos;
        const socialPhotosArray = typeof socialMediaPhotos === 'string' ? JSON.parse(socialMediaPhotos) : socialMediaPhotos;

        // Skip if already has 15 social media photos
        if (socialPhotosArray.length === 15) {
          console.log(`Listing ${listing.title}: Already has 15 social media photos, skipping`);
          skipped++;
          continue;
        }

        // Update social_media_photos to first 15 photos from photos array
        const newSocialMediaPhotos = photosArray.slice(0, 15);

        console.log(`Listing ${listing.title}: Updating from ${socialPhotosArray.length} to ${newSocialMediaPhotos.length} social media photos`);

        const { error: updateError } = await supabase
          .from('listings')
          .update({ social_media_photos: newSocialMediaPhotos })
          .eq('id', listing.id);

        if (updateError) {
          console.error(`Error updating listing ${listing.title}:`, updateError);
          errors++;
        } else {
          updated++;
        }
      } catch (error) {
        console.error(`Error processing listing ${listing.title}:`, error);
        errors++;
      }
    }

    console.log(`Fix complete: ${updated} updated, ${skipped} skipped, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        skipped,
        errors,
        message: `Successfully fixed social_media_photos for ${updated} listings`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
