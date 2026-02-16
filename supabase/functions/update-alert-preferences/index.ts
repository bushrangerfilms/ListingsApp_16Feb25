import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdatePreferencesRequest {
  token: string;
  action: 'update' | 'cancel';
  bedrooms?: number[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, action, bedrooms }: UpdatePreferencesRequest = await req.json();

    console.log('Update alert preferences request:', { token: token?.substring(0, 8), action });

    // Validate required fields
    if (!token || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: token and action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update' && (!bedrooms || bedrooms.length === 0)) {
      return new Response(
        JSON.stringify({ error: 'Bedrooms array is required for update action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' }
    });

    // Find property alert by token
    const { data: alert, error: findError } = await supabase
      .from('property_alerts')
      .select('*')
      .eq('preferences_token', token)
      .maybeSingle();

    if (findError) {
      console.error('Error finding property alert:', findError);
      return new Response(
        JSON.stringify({ error: 'Failed to find property alert' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!alert) {
      console.error('Property alert not found for token');
      return new Response(
        JSON.stringify({ error: 'Invalid or expired preferences link' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Property alert found:', alert.id, 'Status:', alert.status);

    // Handle cancel action
    if (action === 'cancel') {
      const { error: updateError } = await supabase
        .from('property_alerts')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', alert.id);

      if (updateError) {
        console.error('Error cancelling alert:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to cancel property alert' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Property alert cancelled successfully');

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Property alerts cancelled successfully',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle update action
    if (action === 'update') {
      const { error: updateError } = await supabase
        .from('property_alerts')
        .update({ 
          bedrooms,
          status: 'active', // Reactivate if it was cancelled
          updated_at: new Date().toISOString()
        })
        .eq('id', alert.id);

      if (updateError) {
        console.error('Error updating alert:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update property alert' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Property alert updated successfully');

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Property alert preferences updated successfully',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in update-alert-preferences:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
