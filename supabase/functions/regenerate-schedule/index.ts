import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientSlug, listingId } = await req.json();

    if (!clientSlug || !listingId) {
      return new Response(
        JSON.stringify({ error: 'clientSlug and listingId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const automationSecret = Deno.env.get('AUTOMATION_SECRET');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!automationSecret) {
      throw new Error('Missing AUTOMATION_SECRET environment variable');
    }

    // Look up the organization by slug
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', clientSlug)
      .maybeSingle();

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch listing and verify it belongs to this organization
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, status, organization_id, automation_enabled')
      .eq('id', listingId)
      .maybeSingle();

    if (listingError || !listing) {
      return new Response(
        JSON.stringify({ error: 'Listing not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (listing.organization_id !== org.id) {
      return new Response(
        JSON.stringify({ error: 'Listing does not belong to this organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!listing.automation_enabled) {
      return new Response(
        JSON.stringify({ error: 'Automation is not enabled for this listing' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fire-and-forget: trigger handle-status-change with force_process
    // Don't await the full response since it can take 30+ seconds
    const currentStatus = listing.status;
    console.log(`🔄 Regenerating schedule for listing ${listingId} (status: ${currentStatus})`);

    fetch(`${supabaseUrl}/functions/v1/handle-status-change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-automation-secret': automationSecret,
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey
      },
      body: JSON.stringify({
        listing_id: listingId,
        old_status: currentStatus,
        new_status: currentStatus,
        force_process: true,
        verification_confirmed: true
      })
    }).then(async (res) => {
      const data = await res.json();
      if (res.ok) {
        console.log(`✅ Schedule regeneration triggered successfully for ${listingId}:`, data);
      } else {
        console.error(`❌ Schedule regeneration failed for ${listingId}:`, data);
      }
    }).catch((err) => {
      console.error(`❌ Schedule regeneration fetch error for ${listingId}:`, err);
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Schedule regeneration started',
        listing_id: listingId,
        status: currentStatus
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in regenerate-schedule:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
