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
    
    // Check if recordId is a UUID or CRM record ID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUUID = uuidRegex.test(recordId);
    
    // SECURITY: Find listing by recordId AND verify it belongs to the organization
    // Support both CRM-migrated (crm_record_id) and Supabase-native (id) listings
    let listingQuery = supabase
      .from('listings')
      .select('id, status')
      .eq('organization_id', orgData.id);
    
    if (isUUID) {
      listingQuery = listingQuery.or(`id.eq.${recordId},crm_record_id.eq.${recordId}`);
    } else {
      listingQuery = listingQuery.eq('crm_record_id', recordId);
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

    // Map request fields to Supabase columns
    const supabaseFields: any = {};
    if (fields['Listing Title']) supabaseFields.title = fields['Listing Title'];
    if (fields['Description']) supabaseFields.description = fields['Description'];
    // 'Price' (canonical) + legacy IE-flavoured key accepted for back-compat.
    if (fields['Price'] !== undefined) supabaseFields.price = fields['Price'];
    else if (fields['Price €'] !== undefined) supabaseFields.price = fields['Price €']; // locale-allowed: legacy back-compat key
    if (fields['Bedrooms']) supabaseFields.bedrooms = fields['Bedrooms'];
    if (fields['Bathrooms']) supabaseFields.bathrooms = fields['Bathrooms'];
    if (fields['Building Type']) supabaseFields.building_type = fields['Building Type'];
    // 'EnergyRating' (canonical) + legacy IE-flavoured key accepted for back-compat.
    if (fields['EnergyRating'] !== undefined) supabaseFields.ber_rating = fields['EnergyRating'];
    else if (fields['BER Rating'] !== undefined) supabaseFields.ber_rating = fields['BER Rating']; // locale-allowed: legacy back-compat key
    if (fields['Category']) supabaseFields.category = fields['Category'];
    if (fields['Furnishing Status']) supabaseFields.furnished = fields['Furnishing Status'];
    if (fields['Booking Platform Link']) supabaseFields.booking_link = fields['Booking Platform Link'];
    if (fields['Building Size sqm']) supabaseFields.floor_area_size = fields['Building Size sqm'];
    if (fields['Land Size (Acres)'] !== undefined) supabaseFields.land_size = fields['Land Size (Acres)'];
    if (fields['Address Line 1'] !== undefined) supabaseFields.address_detail = fields['Address Line 1'];
    if (fields['Address Town'] !== undefined) supabaseFields.address_town = fields['Address Town'];
    if (fields['County'] !== undefined) supabaseFields.county = fields['County'];
    // 'PostalCode' (canonical) + legacy IE-flavoured key accepted for back-compat.
    if (fields['PostalCode'] !== undefined) supabaseFields.eircode = fields['PostalCode'];
    else if (fields['Eircode'] !== undefined) supabaseFields.eircode = fields['Eircode']; // locale-allowed: legacy back-compat key
    if (fields['Folio Number'] !== undefined) supabaseFields.folio_number = fields['Folio Number'];
    if (fields['Exclude AI Motion'] !== undefined) supabaseFields.exclude_ai_motion = fields['Exclude AI Motion'];
    if (fields['Exclude from Social Media'] !== undefined) supabaseFields.automation_enabled = !fields['Exclude from Social Media'];

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
      updateQuery = updateQuery.or(`id.eq.${recordId},crm_record_id.eq.${recordId}`);
    } else {
      updateQuery = updateQuery.eq('crm_record_id', recordId);
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

    // Handle Exclude from Social Media: cancel/regenerate schedule directly
    // Both apps share the same DB, so we handle this here for reliability
    if (fields['Exclude from Social Media'] !== undefined) {
      const listingId = existingListing.id;
      if (fields['Exclude from Social Media'] === true) {
        // EXCLUDING: Cancel all scheduled posts, release slots, deactivate templates
        console.log(`[SOCIAL] Excluding listing ${listingId} from social media`);
        const { data: cancelledPosts } = await supabase
          .from('listing_posting_schedule')
          .update({
            status: 'cancelled',
            is_cancelled: true,
            error_message: 'Excluded from social media',
            updated_at: new Date().toISOString()
          })
          .eq('listing_id', listingId)
          .in('status', ['scheduled', 'pending_approval', 'pending_video'])
          .eq('is_cancelled', false)
          .select('id, slot_id');

        const cancelledCount = cancelledPosts?.length ?? 0;

        if (cancelledCount > 0) {
          const slotIds = (cancelledPosts || []).map((p: any) => p.slot_id).filter(Boolean);
          if (slotIds.length > 0) {
            await supabase
              .from('listing_schedule_slots')
              .update({ has_post: false })
              .in('id', slotIds);
          }
        }

        await supabase
          .from('recurring_schedule_templates')
          .update({ is_active: false })
          .eq('listing_id', listingId);

        console.log(`[SOCIAL] Excluded: cancelled ${cancelledCount} posts, deactivated templates`);
      } else if (fields['Exclude from Social Media'] === false) {
        // RE-INCLUDING: Trigger handle-status-change to regenerate schedule
        console.log(`[SOCIAL] Re-including listing ${listingId} in social media`);

        const { data: secretRow } = await supabase
          .from('automation_secrets')
          .select('value')
          .eq('key', 'automation_secret')
          .single();

        const automationSecret = secretRow?.value || Deno.env.get('AUTOMATION_SECRET');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (automationSecret && supabaseUrl && supabaseKey) {
          try {
            const response = await fetch(`${supabaseUrl}/functions/v1/handle-status-change`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-automation-secret': automationSecret,
                'Authorization': `Bearer ${supabaseKey}`,
                'apikey': supabaseKey
              },
              body: JSON.stringify({
                listing_id: listingId,
                old_status: 'none',
                new_status: existingListing.status || 'Published',
                force_process: true
              })
            });
            const result = await response.json();
            console.log(`[SOCIAL] Schedule regeneration triggered:`, result);
          } catch (err) {
            console.error(`[SOCIAL] Error triggering schedule regeneration:`, err);
          }
        } else {
          console.error('[SOCIAL] Missing secrets for handle-status-change call');
        }
      }
    }

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
