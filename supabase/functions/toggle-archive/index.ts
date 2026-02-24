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
    const { clientSlug, recordId, archived } = await req.json();

    if (!clientSlug || !recordId || archived === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: clientSlug, recordId, or archived' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[TOGGLE-ARCHIVE] Toggling archive status:', { recordId, archived });

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

    // Update archive status in Supabase
    console.log('[SUPABASE] Updating archive status in Supabase...');
    
    // Check if recordId is a UUID or CRM record ID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUUID = uuidRegex.test(recordId);
    
    // SECURITY: Find listing by recordId AND verify it belongs to the organization
    let listingQuery = supabase
      .from('listings')
      .select('id')
      .eq('organization_id', orgData.id);
    
    if (isUUID) {
      listingQuery = listingQuery.or(`id.eq.${recordId},crm_record_id.eq.${recordId}`);
    } else {
      listingQuery = listingQuery.eq('crm_record_id', recordId);
    }
    
    const { data: existingListing } = await listingQuery.single();

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
      .update({ archived })
      .eq('organization_id', orgData.id);
    
    if (isUUID) {
      updateQuery = updateQuery.or(`id.eq.${recordId},crm_record_id.eq.${recordId}`);
    } else {
      updateQuery = updateQuery.eq('crm_record_id', recordId);
    }
    
    const { error: supabaseError } = await updateQuery;

    if (supabaseError) {
      console.error('[SUPABASE] Update error:', supabaseError);
      return new Response(
        JSON.stringify({ error: 'Failed to update archive status in database', details: supabaseError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[SUPABASE] Archive status updated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Listing ${archived ? 'archived' : 'unarchived'} successfully`,
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
