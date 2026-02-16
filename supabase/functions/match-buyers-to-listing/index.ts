import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MatchBuyersRequest {
  listingId: string;
  listingTitle: string;
  bedrooms: number;
  listingUrl: string;
  status: string;
  organizationId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { listingId, listingTitle, bedrooms, listingUrl, status, organizationId }: MatchBuyersRequest = await req.json();

    console.log('Matching buyers to listing:', { listingId, listingTitle, bedrooms, status, organizationId });

    // Only process if status is Published or New
    if (status !== 'Published' && status !== 'New') {
      console.log('Listing status not eligible for buyer matching:', status);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Listing status not eligible for buyer matching',
          matchCount: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (!listingId || !listingTitle || !bedrooms || !listingUrl || !organizationId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' }
    });

    // CRITICAL SECURITY: Find all active property alerts that match the bedroom count AND organization
    const { data: matchingAlerts, error: alertsError } = await supabase
      .from('property_alerts')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .contains('bedrooms', [bedrooms]);

    if (alertsError) {
      console.error('Error fetching property alerts:', alertsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch property alerts' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!matchingAlerts || matchingAlerts.length === 0) {
      console.log('No matching buyers found for', bedrooms, 'bedrooms');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No matching buyers found',
          matchCount: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${matchingAlerts.length} matching buyer(s)`);

    // Check which buyers have already been notified about this listing
    const { data: existingMatches, error: matchesError } = await supabase
      .from('buyer_listing_matches')
      .select('property_alert_id')
      .eq('listing_airtable_id', listingId);

    if (matchesError) {
      console.error('Error checking existing matches:', matchesError);
    }

    const notifiedAlertIds = new Set(existingMatches?.map(m => m.property_alert_id) || []);
    const newMatchingAlerts = matchingAlerts.filter(alert => !notifiedAlertIds.has(alert.id));

    if (newMatchingAlerts.length === 0) {
      console.log('All matching buyers have already been notified about this listing');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'All matching buyers already notified',
          matchCount: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Notifying ${newMatchingAlerts.length} new buyer(s)`);

    // Process each matching buyer
    const buyerList: string[] = [];
    const siteUrl = Deno.env.get('SITE_URL') || 'https://yoursite.com';

    for (const alert of newMatchingAlerts) {
      try {
        // Create buyer listing match record
        const { error: matchInsertError } = await supabase
          .from('buyer_listing_matches')
          .insert({
            property_alert_id: alert.id,
            listing_airtable_id: listingId,
            listing_title: listingTitle,
            email_sent_at: new Date().toISOString(),
          });

        if (matchInsertError) {
          console.error('Error creating buyer listing match:', matchInsertError);
          continue;
        }

        // Generate preferences URL
        const preferencesUrl = `${siteUrl}/alert-preferences/${alert.preferences_token}`;

        // Send email to buyer
        const buyerEmailResponse = await supabase.functions.invoke('send-email', {
          body: {
            templateKey: 'buyer_listing_match_buyer',
            to: alert.email,
            organizationId: organizationId,
            variables: {
              name: alert.name,
              listingTitle,
              listingUrl,
              preferencesUrl,
            },
          },
        });

        if (buyerEmailResponse.error) {
          console.error('Error sending email to buyer:', alert.email, buyerEmailResponse.error);
        } else {
          console.log('Email sent successfully to buyer:', alert.email);
        }

        // Update property alert stats
        await supabase
          .from('property_alerts')
          .update({
            last_notified_at: new Date().toISOString(),
            notification_count: (alert.notification_count || 0) + 1,
          })
          .eq('id', alert.id);

        // Add to buyer list for admin notification
        const bedroomsText = alert.bedrooms.map((b: number) => {
          if (b === 5) return '5+ Bedrooms';
          return `${b} Bedroom${b > 1 ? 's' : ''}`;
        }).join(', ');

        buyerList.push(`
          <div style="margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
            <strong>${alert.name}</strong><br>
            Email: ${alert.email}<br>
            Phone: ${alert.phone}<br>
            Preferences: ${bedroomsText}<br>
            ${alert.comments ? `Comments: ${alert.comments}` : ''}
          </div>
        `);

      } catch (error) {
        console.error('Error processing buyer alert:', alert.id, error);
      }
    }

    // Send admin notification if there are matches
    if (buyerList.length > 0) {
      const adminEmail = Deno.env.get('ADMIN_EMAIL');
      if (adminEmail) {
        console.log('Sending buyer match summary to admin');
        
        const adminEmailResponse = await supabase.functions.invoke('send-email', {
          body: {
            templateKey: 'buyer_listing_match_admin',
            to: adminEmail,
            organizationId: organizationId,
            variables: {
              listingTitle,
              listingUrl,
              buyerList: buyerList.join('\n'),
              matchCount: buyerList.length,
            },
          },
        });

        if (adminEmailResponse.error) {
          console.error('Error sending admin notification:', adminEmailResponse.error);
        } else {
          console.log('Admin notification sent successfully');
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully matched ${buyerList.length} buyer(s) to listing`,
        matchCount: buyerList.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in match-buyers-to-listing:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
