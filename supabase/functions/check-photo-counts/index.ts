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

    const { data: listings, error } = await supabase
      .from('listings')
      .select('id, title, photos, social_media_photos, hero_photo')
      .eq('organization_id', 'b3289735-1a9d-42e5-a73d-a56b5754cee2')
      .order('created_at', { ascending: false });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = listings.map(listing => {
      const photos = Array.isArray(listing.photos) ? listing.photos : 
                     (typeof listing.photos === 'string' ? JSON.parse(listing.photos) : []);
      const socialPhotos = Array.isArray(listing.social_media_photos) ? listing.social_media_photos : 
                          (typeof listing.social_media_photos === 'string' ? JSON.parse(listing.social_media_photos) : []);

      return {
        title: listing.title,
        gallery_photo_count: photos.length,
        social_media_photo_count: socialPhotos.length,
        has_hero: !!listing.hero_photo,
        sample_gallery_photos: photos.slice(0, 3),
        sample_social_photos: socialPhotos.slice(0, 3)
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        total_listings: listings.length,
        listings: results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
