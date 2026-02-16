/**
 * @deprecated LEGACY SINGLE-TENANT FUNCTION
 * This function contains a hardcoded organization_id and should NOT be used in production.
 * It was created during the single-tenant phase for debugging Bridge Auctioneers specifically.
 * For multi-tenant usage, create a new function that validates organization context.
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' }
    });

    // Get one specific listing to debug
    const { data: listings, error } = await supabase
      .from('listings')
      .select('*')
      .eq('organization_id', 'b3289735-1a9d-42e5-a73d-a56b5754cee2')
      .limit(1);

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!listings || listings.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No listings found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const listing = listings[0];

    // Parse the data carefully
    const photosRaw = listing.photos;
    const socialPhotosRaw = listing.social_media_photos;

    const photosArray = Array.isArray(photosRaw) ? photosRaw : 
                       (typeof photosRaw === 'string' ? JSON.parse(photosRaw) : []);
    const socialPhotosArray = Array.isArray(socialPhotosRaw) ? socialPhotosRaw : 
                             (typeof socialPhotosRaw === 'string' ? JSON.parse(socialPhotosRaw) : []);

    return new Response(
      JSON.stringify({
        success: true,
        listing_title: listing.title,
        listing_id: listing.id,
        raw_photos_type: typeof photosRaw,
        raw_social_photos_type: typeof socialPhotosRaw,
        photos_is_array: Array.isArray(photosRaw),
        social_photos_is_array: Array.isArray(socialPhotosRaw),
        photos_count: photosArray.length,
        social_photos_count: socialPhotosArray.length,
        photos_sample: photosArray.slice(0, 3),
        social_photos_full: socialPhotosArray,
        raw_photos_value: photosRaw,
        raw_social_photos_value: socialPhotosRaw
      }, null, 2),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', stack: error instanceof Error ? error.stack : undefined }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
