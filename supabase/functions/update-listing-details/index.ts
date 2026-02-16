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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'public' }
    });

    // SECURITY: Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[SECURITY] Invalid token:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[AUTH] Authenticated user:', user.id);

    const { clientSlug, recordId, fields } = await req.json();

    if (!clientSlug || !recordId || !fields) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: clientSlug, recordId, or fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[UPDATE] Updating listing details:', recordId);

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

    // SECURITY: Check if user is a super_admin or belongs to the organization with appropriate role
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isSuperAdmin = userRoles?.some(r => r.role === 'super_admin' || r.role === 'developer');

    if (!isSuperAdmin) {
      // Check organization membership and role
      const { data: userOrg, error: userOrgError } = await supabase
        .from('user_organizations')
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', orgData.id)
        .single();

      if (userOrgError || !userOrg) {
        console.error('[SECURITY] User not a member of organization');
        return new Response(
          JSON.stringify({ error: 'Permission denied. You must be a member of this organization.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (userOrg.role !== 'admin') {
        console.error('[SECURITY] User is not an admin in organization');
        return new Response(
          JSON.stringify({ error: 'Permission denied. Admin role required to update listings.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('[AUTH] User authorized for organization:', clientSlug);

    // STEP 1: Update in Supabase FIRST (primary source of truth)
    console.log('[SUPABASE] Updating listing in Supabase...');
    
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

    // Map Airtable fields to Supabase columns (basic mapping)
    const supabaseFields: any = {};
    if (fields['Listing Title']) supabaseFields.title = fields['Listing Title'];
    if (fields['Description']) supabaseFields.description = fields['Description'];
    if (fields['Price €']) supabaseFields.price = fields['Price €'];
    if (fields['Bedrooms']) supabaseFields.bedrooms = fields['Bedrooms'];
    if (fields['Bathrooms']) supabaseFields.bathrooms = fields['Bathrooms'];
    if (fields['Building Type']) supabaseFields.building_type = fields['Building Type'];
    if (fields['BER Rating']) supabaseFields.ber_rating = fields['BER Rating'];
    if (fields['Category']) supabaseFields.category = fields['Category'];
    if (fields['Furnishing Status']) supabaseFields.furnished = fields['Furnishing Status'];
    if (fields['Booking Platform Link']) supabaseFields.booking_link = fields['Booking Platform Link'];
    if (fields['Building Size sqm']) supabaseFields.floor_area_size = fields['Building Size sqm'];
    
    // Handle photo fields
    if (fields['photos'] !== undefined) supabaseFields.photos = fields['photos'];
    if (fields['hero_photo'] !== undefined) supabaseFields.hero_photo = fields['hero_photo'];
    if (fields['social_media_photos'] !== undefined) supabaseFields.social_media_photos = fields['social_media_photos'];

    // Update using the same identifier that was used to find the record
    // SECURITY: Must include organization_id filter to maintain tenant isolation
    let updateQuery = supabase
      .from('listings')
      .update(supabaseFields)
      .eq('organization_id', orgData.id);
    
    if (isUUID) {
      updateQuery = updateQuery.or(`id.eq.${recordId},airtable_record_id.eq.${recordId}`);
    } else {
      updateQuery = updateQuery.eq('airtable_record_id', recordId);
    }
    
    const { error: supabaseError } = await updateQuery;

    if (supabaseError) {
      console.error('[SUPABASE] Update error:', supabaseError);
      return new Response(
        JSON.stringify({ error: 'Failed to update listing in database', details: supabaseError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[SUPABASE] Updated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Listing updated successfully',
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
