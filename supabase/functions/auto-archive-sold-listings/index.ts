import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting auto-archive process for sold listings across all organizations...');
    
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

    console.log(`Looking for sold listings with status_changed_date <= ${thirtyDaysAgoStr}`);

    // Fetch all sold listings that are not archived and have been sold for 30+ days
    const { data: listings, error: fetchError } = await supabase
      .from('listings')
      .select('id, title, status_changed_date, organization_id')
      .eq('status', 'Sold')
      .eq('archived', false)
      .lte('status_changed_date', thirtyDaysAgoStr);

    if (fetchError) {
      console.error('Error fetching sold listings:', fetchError);
      throw new Error(`Failed to fetch listings: ${fetchError.message}`);
    }

    console.log(`Found ${listings?.length || 0} sold listings to archive`);

    const archivedListings = [];

    // Archive each listing
    for (const listing of listings || []) {
      const changedDate = new Date(listing.status_changed_date);
      const daysSinceSold = Math.floor((new Date().getTime() - changedDate.getTime()) / (1000 * 60 * 60 * 24));
      
      console.log(`Archiving listing ${listing.id} (${listing.title}) - sold ${daysSinceSold} days ago`);
      
      const { error: updateError } = await supabase
        .from('listings')
        .update({ archived: true })
        .eq('id', listing.id);

      if (updateError) {
        console.error(`Failed to archive listing ${listing.id}:`, updateError.message);
      } else {
        archivedListings.push({
          id: listing.id,
          title: listing.title,
          soldDate: listing.status_changed_date,
          daysSinceSold,
        });
      }
    }

    console.log(`Auto-archive complete. Archived ${archivedListings.length} listings`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Auto-archived ${archivedListings.length} sold listings`,
        archivedListings,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in auto-archive-sold-listings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
