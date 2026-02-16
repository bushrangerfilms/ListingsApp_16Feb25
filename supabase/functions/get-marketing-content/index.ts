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
    let clientSlug: string | null = null;
    let sectionKey: string | null = null;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      clientSlug = url.searchParams.get('clientSlug');
      sectionKey = url.searchParams.get('sectionKey');
    } else {
      const body = await req.json();
      clientSlug = body.clientSlug;
      sectionKey = body.sectionKey;
    }

    if (!clientSlug) {
      return new Response(
        JSON.stringify({ error: 'clientSlug is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[GET-MARKETING-CONTENT] Fetching for:', clientSlug, 'section:', sectionKey);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' }
    });

    // Get organization ID from slug
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', clientSlug)
      .eq('is_active', true)
      .single();

    if (orgError || !orgData) {
      console.error('[GET-MARKETING-CONTENT] Organization not found:', clientSlug);
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build query for marketing content
    let query = supabase
      .from('marketing_content')
      .select('*')
      .eq('organization_id', orgData.id)
      .eq('is_enabled', true)
      .order('display_order', { ascending: true });

    // Filter by section key if provided
    if (sectionKey) {
      query = query.eq('section_key', sectionKey);
    }

    const { data: content, error: contentError } = await query;

    if (contentError) {
      console.error('[GET-MARKETING-CONTENT] Error fetching content:', contentError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch marketing content' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[GET-MARKETING-CONTENT] Found', content?.length || 0, 'content sections');

    return new Response(
      JSON.stringify({ 
        success: true, 
        content: content || [] 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[GET-MARKETING-CONTENT] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
