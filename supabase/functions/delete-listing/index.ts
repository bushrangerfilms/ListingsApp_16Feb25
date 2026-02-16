import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientSlug, recordId } = await req.json();

    if (!clientSlug || !recordId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: clientSlug or recordId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[DELETE] Deleting listing (soft delete):', recordId);

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

    // Soft delete in Supabase (set archived=true)
    console.log('[SUPABASE] Soft deleting in Supabase (setting archived=true)...');
    
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
      listingQuery = listingQuery.or(`id.eq.${recordId},airtable_record_id.eq.${recordId}`);
    } else {
      listingQuery = listingQuery.eq('airtable_record_id', recordId);
    }
    
    const { data: existingListing, error: listingError } = await listingQuery.maybeSingle();

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

    // Update using the same identifier that was used to find the record
    // SECURITY: Must include organization_id filter to maintain tenant isolation
    let updateQuery = supabase
      .from('listings')
      .update({ archived: true })
      .eq('organization_id', orgData.id);
    
    if (isUUID) {
      updateQuery = updateQuery.or(`id.eq.${recordId},airtable_record_id.eq.${recordId}`);
    } else {
      updateQuery = updateQuery.eq('airtable_record_id', recordId);
    }
    
    const { error: supabaseError } = await updateQuery;

    if (supabaseError) {
      console.error('[SUPABASE] Soft delete error:', supabaseError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete listing in database', details: supabaseError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[SUPABASE] Soft deleted successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Listing archived successfully',
        id: existingListing.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
