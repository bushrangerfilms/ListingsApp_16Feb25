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
    console.log('Checking for expired NEW status listings across all organizations...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' }
    });

    // Calculate the date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    console.log(`Looking for NEW listings with new_status_set_date <= ${thirtyDaysAgoStr}`);

    // Fetch all NEW listings that have been in NEW status for 30+ days
    const { data: listings, error: fetchError } = await supabase
      .from('listings')
      .select('id, title, new_status_set_date, organization_id')
      .eq('status', 'New')
      .not('new_status_set_date', 'is', null)
      .lte('new_status_set_date', thirtyDaysAgoStr);

    if (fetchError) {
      console.error('Error fetching NEW listings:', fetchError);
      throw new Error(`Failed to fetch listings: ${fetchError.message}`);
    }

    console.log(`Found ${listings?.length || 0} NEW listings to expire`);

    const expiredListings = [];

    // Expire each listing
    for (const listing of listings || []) {
      const setDate = new Date(listing.new_status_set_date);
      const daysSinceNew = Math.floor((new Date().getTime() - setDate.getTime()) / (1000 * 60 * 60 * 24));
      
      console.log(`Expiring listing ${listing.id} (${listing.title}) - NEW for ${daysSinceNew} days`);
      
      const { error: updateError } = await supabase
        .from('listings')
        .update({
          status: 'Published',
          new_status_set_date: null,
          status_changed_date: today,
        })
        .eq('id', listing.id);

      if (updateError) {
        console.error(`Failed to expire listing ${listing.id}:`, updateError.message);
      } else {
        expiredListings.push({
          id: listing.id,
          title: listing.title,
          newStatusSetDate: listing.new_status_set_date,
          daysSinceNew,
        });
      }
    }

    console.log(`Auto-expiration complete. Expired ${expiredListings.length} listings`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Auto-expired ${expiredListings.length} NEW listings to Published`,
        expiredListings,
        totalNewListings: listings?.length || 0,
        updatedCount: expiredListings.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in auto-expire-new-status:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
