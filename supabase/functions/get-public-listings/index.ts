import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { domain } = body;
    const page = parseInt(body.page || '1', 10) || 1;
    const pageSize = Math.min(parseInt(body.pageSize || '100', 10) || 100, 500);

    if (!domain) {
      return new Response(
        JSON.stringify({ error: 'Domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[GET_PUBLIC_LISTINGS] Fetching listings for domain:', domain);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'public' }
    });

    // First, find the organization by domain
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, business_name, slug')
      .eq('domain', domain)
      .eq('is_active', true)
      .single();

    if (orgError || !org) {
      console.error('[GET_PUBLIC_LISTINGS] Organization not found for domain:', domain);
      return new Response(
        JSON.stringify({ error: 'Organization not found for this domain' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[GET_PUBLIC_LISTINGS] Found organization:', org.business_name);

    // Fetch published listings for this organization (with pagination)
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: listings, error: listingsError, count: totalCount } = await supabase
      .from('listings')
      .select('id, title, description, building_type, price, bedrooms, bathrooms, floor_area_size, land_size, address, address_detail, address_town, county, eircode, ber_rating, category, furnished, specs, hero_photo, photos, social_media_photos, booking_link, status, date_posted', { count: 'exact' })
      .eq('organization_id', org.id)
      .eq('archived', false)
      .in('status', ['Published', 'Sale Agreed', 'Let Agreed'])
      .order('date_posted', { ascending: false })
      .range(from, to);

    if (listingsError) {
      console.error('[GET_PUBLIC_LISTINGS] Error fetching listings:', listingsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch listings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[GET_PUBLIC_LISTINGS] Found', listings?.length || 0, 'listings');

    // Deduplicate photos (combine photos and social_media_photos arrays)
    const processedListings = (listings || []).map(listing => {
      const allPhotos = [
        ...(listing.photos || []),
        ...(listing.social_media_photos || [])
      ];
      const uniquePhotos = Array.from(new Set(allPhotos));

      return {
        id: listing.id,
        title: listing.title,
        description: listing.description,
        building_type: listing.building_type,
        price: listing.price,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        floor_area_size: listing.floor_area_size,
        land_size: listing.land_size,
        address: listing.address,
        address_detail: listing.address_detail,
        address_town: listing.address_town,
        county: listing.county,
        eircode: listing.eircode,
        ber_rating: listing.ber_rating,
        category: listing.category,
        furnished: listing.furnished,
        specs: listing.specs,
        hero_photo: listing.hero_photo,
        photos: uniquePhotos,
        booking_link: listing.booking_link,
        status: listing.status,
        date_posted: listing.date_posted,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        organization: {
          business_name: org.business_name,
          slug: org.slug,
        },
        listings: processedListings,
        totalCount: totalCount ?? processedListings.length,
        page,
        pageSize,
        hasMore: (totalCount ?? processedListings.length) > from + processedListings.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } }
    );
  } catch (error: any) {
    console.error('[GET_PUBLIC_LISTINGS] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
