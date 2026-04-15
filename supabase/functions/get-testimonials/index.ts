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

    if (req.method === 'GET') {
      const url = new URL(req.url);
      clientSlug = url.searchParams.get('clientSlug');
    } else {
      const body = await req.json();
      clientSlug = body.clientSlug;
    }

    if (!clientSlug) {
      return new Response(
        JSON.stringify({ error: 'clientSlug is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[GET-TESTIMONIALS] Fetching testimonials for:', clientSlug);

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
      console.error('[GET-TESTIMONIALS] Organization not found:', clientSlug);
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch active testimonials for this organization
    const { data: testimonials, error: testimonialsError } = await supabase
      .from('testimonials')
      .select('id, author_name, author_role, content, rating, is_featured')
      .eq('organization_id', orgData.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (testimonialsError) {
      console.error('[GET-TESTIMONIALS] Error fetching testimonials:', testimonialsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch testimonials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[GET-TESTIMONIALS] Found', testimonials?.length || 0, 'testimonials');

    return new Response(
      JSON.stringify({ 
        success: true, 
        testimonials: testimonials || [] 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[GET-TESTIMONIALS] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
