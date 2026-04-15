import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' }
    });

    // Authenticate user and get their organization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's organization ID
    const { data: orgData, error: orgError } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (orgError || !orgData) {
      console.error('[ORG] Error getting organization:', orgError);
      return new Response(
        JSON.stringify({ error: 'No organization found for user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organizationId = orgData.organization_id;
    console.log('[ORG] Using organization ID:', organizationId);

    const { listingTitle, imageData } = await req.json();

    if (!listingTitle || !imageData) {
      return new Response(
        JSON.stringify({ error: 'Missing listingTitle or imageData' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing hero photo for listing: ${listingTitle} in organization: ${organizationId}`);

    // Decode base64 image data
    const imageBuffer = Uint8Array.from(atob(imageData), c => c.charCodeAt(0));

    // Generate a unique filename
    const timestamp = Date.now();
    const sanitizedTitle = listingTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const fileName = `${sanitizedTitle}-hero-${timestamp}.jpg`;

    console.log(`Uploading to storage as: ${fileName}`);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('listing-photos')
      .upload(fileName, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('listing-photos')
      .getPublicUrl(fileName);

    console.log(`Image uploaded successfully: ${publicUrl}`);

    // Find the listing by title - MUST filter by organization_id for multi-tenant security
    const { data: listings, error: searchError } = await supabase
      .from('listings')
      .select('id, title')
      .eq('organization_id', organizationId)
      .ilike('title', `%${listingTitle}%`)
      .limit(5);

    if (searchError) {
      console.error('Search error:', searchError);
      throw searchError;
    }

    if (!listings || listings.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No listing found matching that title',
          imageUrl: publicUrl,
          message: 'Image uploaded but no matching listing found'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If multiple matches, try exact match first
    let targetListing = listings.find(l => 
      l.title.toLowerCase() === listingTitle.toLowerCase()
    ) || listings[0];

    console.log(`Updating listing: ${targetListing.id} - ${targetListing.title}`);

    // Update the listing with the hero photo
    const { error: updateError } = await supabase
      .from('listings')
      .update({ hero_photo: publicUrl })
      .eq('id', targetListing.id);

    if (updateError) {
      console.error('Update error:', updateError);
      throw updateError;
    }

    console.log('Hero photo updated successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        listingId: targetListing.id,
        listingTitle: targetListing.title,
        heroPhotoUrl: publicUrl,
        message: 'Hero photo uploaded and listing updated'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
