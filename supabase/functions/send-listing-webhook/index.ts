import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const webhookSecret = Deno.env.get('REAL_ESTATE_WEBHOOK_SECRET');

  if (!webhookSecret) {
    console.error('REAL_ESTATE_WEBHOOK_SECRET not configured');
    return new Response(
      JSON.stringify({ error: 'Webhook secret not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { listing_id, event_type } = await req.json();

    if (!listing_id || !event_type) {
      return new Response(
        JSON.stringify({ error: 'Missing listing_id or event_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing webhook: ${event_type} for listing ${listing_id}`);

    // For delete events, we can't fetch the listing — send minimal payload
    if (event_type === 'listing.deleted') {
      const payload = {
        event: event_type,
        listing: {
          id: listing_id,
          organization_id: null,
          title: 'Deleted Listing',
          description: null,
          address_line_1: null,
          address_line_2: null,
          city: null,
          county: null,
          eircode: null,
          address: null,
          category: 'For Sale',
          status: 'Archived',
          price: null,
          bedrooms: null,
          bathrooms: null,
          ensuite: null,
          building_size_sqm: null,
          land_size_acres: null,
          building_type: null,
          furnished: null,
          ber_rating: null,
          specs: null,
          hero_photo_url: null,
          gallery_photo_urls: null,
          slug: null,
          live_url: null,
          booking_link: null,
          sm_posting_status: null,
          date_posted: null,
          status_changed_date: null,
          new_status_set_date: null,
          archived: true,
          crm_record_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        organization: {
          id: '',
          name: '',
          logo_url: null,
        },
        timestamp: new Date().toISOString(),
      };

      const payloadJson = JSON.stringify(payload);
      const signature = await signPayload(payloadJson, webhookSecret);

      const response = await fetch(`${supabaseUrl}/functions/v1/receive-listing-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-signature': signature,
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: payloadJson,
      });

      console.log(`Delete webhook forwarded: ${response.status}`);
      return new Response(
        JSON.stringify({ success: true, event: event_type, status: response.status }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch listing with organization
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listing_id)
      .single();

    if (listingError || !listing) {
      console.error('Error fetching listing:', listingError);
      return new Response(
        JSON.stringify({ error: 'Listing not found', listing_id }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch organization
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id, business_name, logo_url')
      .eq('id', listing.organization_id)
      .single();

    if (orgError || !organization) {
      console.error('Error fetching organization:', orgError);
      return new Response(
        JSON.stringify({ error: 'Organization not found', organization_id: listing.organization_id }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construct the full address from parts
    const fullAddress = [
      listing.address,
      listing.address_town,
      listing.county
    ].filter(Boolean).join(', ');

    // Build the payload matching the WebhookPayload interface in receive-listing-webhook
    const payload = {
      event: event_type,
      listing: {
        id: listing.id,
        organization_id: listing.organization_id,
        title: listing.title,
        description: listing.description,
        address_line_1: listing.address,
        address_line_2: listing.address_detail,
        city: listing.address_town,
        county: listing.county,
        eircode: listing.eircode,
        address: fullAddress,
        category: listing.category,
        status: listing.status,
        price: listing.price,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        ensuite: listing.ensuite,
        building_size_sqm: listing.floor_area_size,
        land_size_acres: listing.land_size,
        building_type: listing.building_type,
        furnished: listing.furnished,
        ber_rating: listing.ber_rating,
        specs: listing.specs,
        hero_photo_url: listing.hero_photo,
        gallery_photo_urls: listing.social_media_photos,
        slug: listing.slug,
        live_url: listing.live_url,
        booking_link: listing.booking_link,
        sm_posting_status: listing.sm_posting_status,
        date_posted: listing.date_posted,
        status_changed_date: listing.status_changed_date,
        new_status_set_date: listing.new_status_set_date,
        archived: listing.archived ?? false,
        automation_enabled: listing.automation_enabled ?? true,
        crm_record_id: listing.airtable_record_id,
        created_at: listing.created_at,
        updated_at: listing.updated_at,
      },
      organization: {
        id: organization.id,
        name: organization.business_name,
        logo_url: organization.logo_url,
      },
      timestamp: new Date().toISOString(),
    };

    const payloadJson = JSON.stringify(payload);
    const signature = await signPayload(payloadJson, webhookSecret);

    console.log(`Forwarding ${event_type} webhook for listing "${listing.title}" to receive-listing-webhook`);

    const response = await fetch(`${supabaseUrl}/functions/v1/receive-listing-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': signature,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: payloadJson,
    });

    const responseText = await response.text();
    console.log(`Webhook forwarded: status=${response.status}, response=${responseText.substring(0, 200)}`);

    if (!response.ok) {
      console.error(`receive-listing-webhook returned ${response.status}: ${responseText}`);
      return new Response(
        JSON.stringify({ error: 'Webhook forwarding failed', status: response.status, detail: responseText.substring(0, 500) }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, event: event_type, listing_id, forwarded_status: response.status }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-listing-webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
