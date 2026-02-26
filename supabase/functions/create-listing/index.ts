import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { reportToSentry } from '../_shared/sentry-report.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ListingData {
  clientSlug: string;
  organizationId?: string;
  title: string;
  isPOA?: boolean;
  price: number;
  addressLine1: string;
  addressTown: string;
  county: string;
  eircode?: string;
  bedrooms?: number;
  bathrooms?: number;
  buildingSize?: number;
  landSize?: number;
  buildingType?: string;
  berRating?: string;
  description: string;
  specs?: string;
  category: string;
  furnishingStatus?: string;
  bookingPlatformLink?: string;
  photoUrls: string[];
  heroPhotoUrl: string;
  socialMediaPhotoUrls?: string[];
  markAsNew?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const listingData: ListingData = await req.json();
    
    console.log('[CREATE] Creating listing for client:', listingData.clientSlug);
    if (listingData.isPOA) {
      console.log('Listing marked as POA, storing price as 0');
    }

    // Initialize Supabase client with public schema
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'public' }
    });

    // Get authenticated user's organization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's organization ID
    // If organizationId is provided in the request (e.g. super admin or multi-org user), use it after validation
    let organizationId: string;

    if (listingData.organizationId) {
      // Validate user has access to this organization
      const { data: memberCheck, error: memberError } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('organization_id', listingData.organizationId)
        .maybeSingle();

      if (memberError) {
        console.error('[ORG] Error checking membership:', memberError);
      }

      if (memberCheck) {
        organizationId = memberCheck.organization_id;
      } else {
        // Check if user is a super_admin (can act on any org)
        const { data: roleData } = await supabase
          .from('user_organizations')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['super_admin', 'developer']);

        if (roleData && roleData.length > 0) {
          organizationId = listingData.organizationId;
          console.log('[ORG] Super admin creating listing for org:', organizationId);
        } else {
          console.error('[ORG] User not authorized for organization:', listingData.organizationId);
          return new Response(
            JSON.stringify({ error: 'Not authorized for this organization' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } else {
      // Fallback: look up user's organization (use limit 1 for users with multiple orgs)
      const { data: orgData, error: orgError } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (orgError || !orgData) {
        console.error('[ORG] Error getting organization:', orgError);
        return new Response(
          JSON.stringify({ error: 'No organization found for user' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      organizationId = orgData.organization_id;
    }

    console.log('[ORG] Using organization ID:', organizationId);

    const today = new Date().toISOString().split('T')[0];
    const status = listingData.markAsNew ? 'New' : 'Published';

    // STEP 1: Write to Supabase FIRST (primary source of truth)
    console.log('[SUPABASE] Inserting listing into Supabase...');
    const { data: supabaseListing, error: supabaseError } = await supabase
      .from('listings')
      .insert({
        organization_id: organizationId,
        title: listingData.title,
        description: listingData.description,
        building_type: listingData.buildingType,
        price: listingData.price,
        bedrooms: listingData.bedrooms,
        bathrooms: listingData.bathrooms,
        ensuite: null,
        floor_area_size: listingData.buildingSize,
        land_size: listingData.landSize ? parseFloat(listingData.landSize.toString()) : null,
        address: `${listingData.addressLine1}, ${listingData.addressTown}, ${listingData.county}`,
        address_detail: listingData.addressLine1,
        address_town: listingData.addressTown,
        county: listingData.county,
        eircode: listingData.eircode,
        ber_rating: listingData.berRating,
        category: listingData.category,
        furnished: listingData.furnishingStatus,
        specs: listingData.specs || null,
        photos: listingData.photoUrls,
        hero_photo: listingData.heroPhotoUrl,
        social_media_photos: listingData.socialMediaPhotoUrls || [],
        booking_link: listingData.bookingPlatformLink,
        status,
        status_changed_date: today,
        new_status_set_date: listingData.markAsNew ? today : null,
        date_posted: new Date().toISOString(),
        archived: false,
      })
      .select()
      .single();

    if (supabaseError) {
      console.error('[SUPABASE] Error creating listing:', supabaseError);
      return new Response(
        JSON.stringify({ error: 'Failed to create listing in database', details: supabaseError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[SUPABASE] Listing created successfully:', supabaseListing.id);

    // Trigger buyer matching if listing has bedrooms and is Published or New
    if (listingData.bedrooms && (listingData.markAsNew || status === 'Published')) {
      const matchBuyers = async () => {
        try {
          console.log('[MATCHING] Triggering buyer matching for listing:', supabaseListing.id);
          
          const siteUrl = Deno.env.get('SITE_URL') || 'https://yoursite.com';
          const listingUrl = `${siteUrl}/properties/${supabaseListing.id}`;
          
          const matchResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/match-buyers-to-listing`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': req.headers.get('Authorization') || '',
            },
            body: JSON.stringify({
              listingId: supabaseListing.id,
              listingTitle: listingData.title,
              bedrooms: listingData.bedrooms,
              listingUrl,
              status: listingData.markAsNew ? 'New' : 'Published',
              organizationId: organizationId,
            }),
          });

          if (!matchResponse.ok) {
            const errorText = await matchResponse.text();
            console.error('[MATCHING] Error:', errorText);
          } else {
            const matchResult = await matchResponse.json();
            console.log('[MATCHING] Completed:', matchResult);
          }
        } catch (error) {
          console.error('[MATCHING] Error:', error);
        }
      };

      matchBuyers();
    }

    return new Response(
      JSON.stringify({
        success: true,
        id: supabaseListing.id,
        recordId: supabaseListing.id,
        message: 'Listing created successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    reportToSentry(error, { functionName: 'create-listing' }).catch(() => {});
    console.error('Error in create-listing:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});