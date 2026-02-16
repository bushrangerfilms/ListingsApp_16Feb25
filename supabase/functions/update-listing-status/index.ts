import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateStatusRequest {
  clientSlug: string;
  recordId: string;
  newStatus: 'Published' | 'New' | 'Sale Agreed' | 'Sold';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientSlug, recordId, newStatus }: UpdateStatusRequest = await req.json();
    
    console.log('[UPDATE-STATUS] Updating listing status:', { clientSlug, recordId, newStatus });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'public' }
    });

    // Get organization ID from clientSlug
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', clientSlug)
      .eq('is_active', true)
      .single();

    if (orgError || !orgData) {
      console.error('[SECURITY] Organization not found for slug:', clientSlug);
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date().toISOString().split('T')[0];

    // STEP 1: Update in Supabase FIRST (primary source of truth)
    console.log('[SUPABASE] Updating status in Supabase...');
    
    // Check if recordId is a UUID or Airtable ID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUUID = uuidRegex.test(recordId);
    
    // SECURITY: Find listing by recordId AND verify it belongs to the organization
    // Support both Airtable-migrated (airtable_record_id) and Supabase-native (id) listings
    let listingQuery = supabase
      .from('listings')
      .select('id')
      .eq('organization_id', orgData.id);
    
    if (isUUID) {
      // If it's a UUID, search by id OR airtable_record_id
      listingQuery = listingQuery.or(`id.eq.${recordId},airtable_record_id.eq.${recordId}`);
    } else {
      // If it's not a UUID, only search by airtable_record_id
      listingQuery = listingQuery.eq('airtable_record_id', recordId);
    }
    
    const { data: existingListing, error: listingError} = await listingQuery.maybeSingle();

    if (listingError) {
      console.error('[SECURITY] Error querying listing:', listingError);
      return new Response(
        JSON.stringify({ error: 'Database query error', details: listingError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!existingListing) {
      console.error('[SECURITY] Listing not found or does not belong to organization');
      return new Response(
        JSON.stringify({ error: 'Listing not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const updateData: any = {
      status: newStatus,
      status_changed_date: today,
    };

    // Handle "New Status Set Date" field
    if (newStatus === 'New') {
      updateData.new_status_set_date = today;
    } else {
      updateData.new_status_set_date = null;
    }

    // Update using the same identifier that was used to find the record
    // SECURITY: Must include organization_id filter to maintain tenant isolation
    let updateQuery = supabase
      .from('listings')
      .update(updateData)
      .eq('organization_id', orgData.id);
    
    if (isUUID) {
      // If it's a UUID, match by id OR airtable_record_id
      updateQuery = updateQuery.or(`id.eq.${recordId},airtable_record_id.eq.${recordId}`);
    } else {
      // If it's not a UUID, only match by airtable_record_id
      updateQuery = updateQuery.eq('airtable_record_id', recordId);
    }
    
    const { error: supabaseError } = await updateQuery;

    if (supabaseError) {
      console.error('[SUPABASE] Update error:', supabaseError);
      return new Response(
        JSON.stringify({ error: 'Failed to update status in database', details: supabaseError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[SUPABASE] Status updated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Listing status updated to ${newStatus}`,
        id: existingListing.id,
        recordId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-listing-status:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
