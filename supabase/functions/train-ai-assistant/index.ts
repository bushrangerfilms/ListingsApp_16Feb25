import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'public' }
    });

    // Get auth header to identify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from auth header
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting training for user:', user.id);

    // Get user's organization
    const { data: userOrg } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!userOrg) {
      throw new Error('No organization found for user');
    }

    // Get user's config
    const { data: config } = await supabase
      .from('ai_assistant_config')
      .select('*')
      .eq('organization_id', userOrg.organization_id)
      .maybeSingle();

    if (!config) {
      throw new Error('No AI configuration found');
    }

    // Update status to training
    await supabase
      .from('ai_training_metrics')
      .upsert({
        user_id: user.id,
        training_status: 'training',
      });

    let totalTokens = 0;
    let propertiesCount = 0;
    let documentsCount = 0;

    // Count actual listings from public.listings filtered by organization
    const listingsQuery = supabase
      .from('listings')
      .select('id, address, description, price, bedrooms, bathrooms, building_type, status', { count: 'exact' })
      .eq('organization_id', userOrg.organization_id);

    // Filter by status based on config
    const statusFilters: string[] = [];
    if (config.include_active_listings) {
      statusFilters.push('New', 'Published');
    }
    if (config.include_sold_listings) {
      statusFilters.push('Sold', 'Sale Agreed', 'Let Agreed');
    }
    
    if (statusFilters.length > 0) {
      listingsQuery.in('status', statusFilters);
    }

    const { data: listings, count } = await listingsQuery;
    
    propertiesCount = count || 0;
    
    // Calculate tokens based on actual content
    if (listings) {
      listings.forEach(listing => {
        let tokens = 100; // Base tokens for structured data
        if (listing.description) {
          tokens += Math.ceil(listing.description.length / 4);
        }
        if (listing.address) {
          tokens += Math.ceil(listing.address.length / 4);
        }
        totalTokens += tokens;
      });
    }
    
    console.log('Counted listings from public.listings:', propertiesCount);

    // Get knowledge documents filtered by organization
    const { data: documents } = await supabase
      .from('knowledge_documents')
      .select('id, title, content, tokens_count')
      .eq('organization_id', config.organization_id)
      .eq('status', 'active');

    if (documents) {
      documentsCount = documents.length;
      documents.forEach(doc => {
        totalTokens += doc.tokens_count || Math.ceil((doc.content?.length || 0) / 4);
      });
      console.log('Counted documents:', documentsCount);
    }

    // Update training metrics
    await supabase
      .from('ai_training_metrics')
      .upsert({
        user_id: user.id,
        properties_count: propertiesCount,
        documents_count: documentsCount,
        total_tokens: totalTokens,
        training_status: 'ready',
        last_trained_at: new Date().toISOString(),
        error_message: null,
      });

    console.log('Training completed successfully. Listings:', propertiesCount, 'Documents:', documentsCount, 'Tokens:', totalTokens);

    return new Response(
      JSON.stringify({
        success: true,
        metrics: {
          properties_count: propertiesCount,
          documents_count: documentsCount,
          total_tokens: totalTokens,
        },
        message: 'Training completed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in train-ai-assistant:', error);
    
    // Try to update error status
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey, {
          db: { schema: 'public' }
        });
        
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        
        if (user) {
          await supabase
            .from('ai_training_metrics')
            .upsert({
              user_id: user.id,
              training_status: 'error',
              error_message: error instanceof Error ? error.message : 'Training failed',
            });
        }
      }
    } catch (updateError) {
      console.error('Error updating error status:', updateError);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
