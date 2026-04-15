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
    console.log('Received email reply webhook');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' }
    });

    // Parse webhook payload from Resend
    const payload = await req.json();
    console.log('Webhook payload:', JSON.stringify(payload, null, 2));

    // Extract email address from reply (Resend webhook format)
    // The actual structure may vary - adjust based on Resend's webhook documentation
    const replyEmail = payload.data?.to?.[0] || payload.data?.from || payload.email;

    if (!replyEmail) {
      console.error('No email address found in webhook payload');
      return new Response(
        JSON.stringify({ error: 'No email address found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Processing reply from: ${replyEmail}`);

    // Find profile by email (check both sellers and buyers)
    const { data: seller } = await supabase
      .from('seller_profiles')
      .select('id, name, email')
      .eq('email', replyEmail)
      .maybeSingle();

    const { data: buyer } = await supabase
      .from('buyer_profiles')
      .select('id, name, email')
      .eq('email', replyEmail)
      .maybeSingle();

    const profile = seller || buyer;
    const profileType = seller ? 'seller' : buyer ? 'buyer' : null;

    if (!profile) {
      console.log(`No profile found for email: ${replyEmail}`);
      return new Response(
        JSON.stringify({ success: true, message: 'No matching profile found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${profileType} profile:`, profile.id);

    // Cancel any active automation for this profile
    const queueFilter: any = { status: 'active' };
    if (profileType === 'seller') {
      queueFilter.seller_profile_id = profile.id;
    } else {
      queueFilter.buyer_profile_id = profile.id;
    }

    const { data: activeQueues, error: queueError } = await supabase
      .from('profile_email_queue')
      .select('id, sequence_id')
      .match(queueFilter);

    if (queueError) {
      console.error('Error fetching active queues:', queueError);
      throw queueError;
    }

    if (!activeQueues || activeQueues.length === 0) {
      console.log('No active automation found for this profile');
      return new Response(
        JSON.stringify({ success: true, message: 'No active automation to cancel' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Cancelling ${activeQueues.length} active automations`);

    // Update all active queue items to cancelled
    const { error: updateError } = await supabase
      .from('profile_email_queue')
      .update({
        status: 'cancelled',
        cancelled_reason: 'customer_replied'
      })
      .match(queueFilter);

    if (updateError) {
      console.error('Error updating queue:', updateError);
      throw updateError;
    }

    // Log activity for each cancelled automation
    for (const queue of activeQueues) {
      const activityData: any = {
        activity_type: 'customer_replied',
        title: 'Customer replied - automation cancelled',
        description: 'Customer responded to automated email. Automation sequence has been cancelled.',
        metadata: { 
          sequence_id: queue.sequence_id,
          reply_email: replyEmail,
          cancelled_reason: 'customer_replied'
        }
      };

      if (profileType === 'seller') {
        activityData.seller_profile_id = profile.id;
      } else {
        activityData.buyer_profile_id = profile.id;
      }

      await supabase
        .from('crm_activities')
        .insert(activityData);
    }

    // Update last_contact_at on profile
    if (profileType === 'seller') {
      await supabase
        .from('seller_profiles')
        .update({ last_contact_at: new Date().toISOString() })
        .eq('id', profile.id);
    } else {
      await supabase
        .from('buyer_profiles')
        .update({ last_contact_at: new Date().toISOString() })
        .eq('id', profile.id);
    }

    console.log('Successfully processed reply and cancelled automation');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Automation cancelled',
        profile_id: profile.id,
        profile_type: profileType,
        cancelled_count: activeQueues.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-email-replies:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
