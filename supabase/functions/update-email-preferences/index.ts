import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdatePreferencesRequest {
  token: string;
  action: 'unsubscribe' | 'resubscribe' | 'pause';
  profileType?: 'buyer' | 'seller';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, action, profileType }: UpdatePreferencesRequest = await req.json();

    console.log('Update email preferences request:', { token: token?.substring(0, 8) + '...', action, profileType });

    if (!token || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: token and action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' }
    });

    // Find the profile by token
    let profile: any = null;
    let foundProfileType: 'buyer' | 'seller' | null = null;

    // Try buyer profiles first
    if (!profileType || profileType === 'buyer') {
      const { data: buyerProfile } = await supabase
        .from('buyer_profiles')
        .select('*')
        .eq('email_preferences_token', token)
        .maybeSingle();

      if (buyerProfile) {
        profile = buyerProfile;
        foundProfileType = 'buyer';
      }
    }

    // Try seller profiles if not found
    if (!profile && (!profileType || profileType === 'seller')) {
      const { data: sellerProfile } = await supabase
        .from('seller_profiles')
        .select('*')
        .eq('email_preferences_token', token)
        .maybeSingle();

      if (sellerProfile) {
        profile = sellerProfile;
        foundProfileType = 'seller';
      }
    }

    if (!profile || !foundProfileType) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired preferences token' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tableName = foundProfileType === 'buyer' ? 'buyer_profiles' : 'seller_profiles';

    // Handle the action
    if (action === 'unsubscribe') {
      // Mark as unsubscribed
      const { error: updateError } = await supabase
        .from(tableName)
        .update({
          email_unsubscribed: true,
          unsubscribed_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      // Cancel any pending email sequences
      const { error: queueError } = await supabase
        .from('profile_email_queue')
        .update({ status: 'cancelled' })
        .eq(foundProfileType === 'buyer' ? 'buyer_profile_id' : 'seller_profile_id', profile.id)
        .eq('status', 'pending');

      if (queueError) throw queueError;

      // Log activity
      const activityData: any = {
        activity_type: 'note',
        title: 'Unsubscribed from email communications',
        description: 'User unsubscribed via preferences link',
      };

      if (foundProfileType === 'buyer') {
        activityData.buyer_profile_id = profile.id;
      } else {
        activityData.seller_profile_id = profile.id;
      }

      await supabase.from('crm_activities').insert(activityData);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Successfully unsubscribed from email communications',
          profile: {
            name: profile.name,
            email: profile.email,
            email_unsubscribed: true,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'resubscribe') {
      // Mark as subscribed
      const { error: updateError } = await supabase
        .from(tableName)
        .update({
          email_unsubscribed: false,
          unsubscribed_at: null,
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      // Log activity
      const activityData: any = {
        activity_type: 'note',
        title: 'Resubscribed to email communications',
        description: 'User resubscribed via preferences link',
      };

      if (foundProfileType === 'buyer') {
        activityData.buyer_profile_id = profile.id;
      } else {
        activityData.seller_profile_id = profile.id;
      }

      await supabase.from('crm_activities').insert(activityData);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Successfully resubscribed to email communications',
          profile: {
            name: profile.name,
            email: profile.email,
            email_unsubscribed: false,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'pause') {
      // Pause pending sequences
      const { error: queueError } = await supabase
        .from('profile_email_queue')
        .update({ status: 'paused' })
        .eq(foundProfileType === 'buyer' ? 'buyer_profile_id' : 'seller_profile_id', profile.id)
        .eq('status', 'pending');

      if (queueError) throw queueError;

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email sequences paused',
          profile: {
            name: profile.name,
            email: profile.email,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-email-preferences:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});