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
    const { clientSlug } = await req.json();
    
    if (!clientSlug) {
      return new Response(
        JSON.stringify({ error: 'Client slug is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client IP from headers
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                      req.headers.get('x-real-ip') || 
                      'unknown';

    console.log(`Rate limit check for client: ${clientSlug}, IP: ${ipAddress}`);

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' }
    });

    // Check for existing rate limit record within the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: existingLimit, error: fetchError } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('client_slug', clientSlug)
      .eq('ip_address', ipAddress)
      .gte('window_start', oneHourAgo)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching rate limit:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to check rate limit' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const MAX_SUBMISSIONS = 10;
    let remaining = MAX_SUBMISSIONS;
    let resetTime = new Date(Date.now() + 60 * 60 * 1000);

    if (existingLimit) {
      // Check if limit is exceeded
      if (existingLimit.submission_count >= MAX_SUBMISSIONS) {
        const windowStart = new Date(existingLimit.window_start);
        resetTime = new Date(windowStart.getTime() + 60 * 60 * 1000);
        
        return new Response(
          JSON.stringify({
            allowed: false,
            remaining: 0,
            resetTime: resetTime.toISOString(),
            message: `Rate limit exceeded. You can submit ${MAX_SUBMISSIONS} listings per hour. Try again after ${resetTime.toLocaleTimeString()}.`
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update existing record
      const { error: updateError } = await supabase
        .from('rate_limits')
        .update({ submission_count: existingLimit.submission_count + 1 })
        .eq('id', existingLimit.id);

      if (updateError) {
        console.error('Error updating rate limit:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update rate limit' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      remaining = MAX_SUBMISSIONS - (existingLimit.submission_count + 1);
      resetTime = new Date(new Date(existingLimit.window_start).getTime() + 60 * 60 * 1000);
    } else {
      // Create new rate limit record
      const { error: insertError } = await supabase
        .from('rate_limits')
        .insert({
          client_slug: clientSlug,
          ip_address: ipAddress,
          submission_count: 1,
          window_start: new Date().toISOString()
        });

      if (insertError) {
        console.error('Error creating rate limit:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to create rate limit' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      remaining = MAX_SUBMISSIONS - 1;
    }

    console.log(`Rate limit check passed. Remaining: ${remaining}`);

    return new Response(
      JSON.stringify({
        allowed: true,
        remaining,
        resetTime: resetTime.toISOString(),
        message: `${remaining} submissions remaining in this hour.`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-rate-limit:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});