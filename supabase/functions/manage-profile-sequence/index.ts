import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ManageSequenceRequest {
  profileId: string;
  profileType: 'buyer' | 'seller';
  action: 'start' | 'pause' | 'stop';
  sequenceId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        db: { schema: 'public' }
      }
    );

    const { profileId, profileType, action, sequenceId }: ManageSequenceRequest = await req.json();

    console.log(`Managing sequence: ${action} for ${profileType} profile ${profileId}`);

    if (action === 'start') {
      if (!sequenceId) {
        return new Response(
          JSON.stringify({ error: 'sequenceId required for start action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if already enrolled
      const profileIdColumn = profileType === 'buyer' ? 'buyer_profile_id' : 'seller_profile_id';
      const { data: existing } = await supabase
        .from('profile_email_queue')
        .select('id')
        .eq(profileIdColumn, profileId)
        .in('status', ['pending', 'sent'])
        .limit(1);

      if (existing && existing.length > 0) {
        return new Response(
          JSON.stringify({ error: 'Profile already enrolled in a sequence' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get sequence details
      const { data: sequence } = await supabase
        .from('email_sequences')
        .select('name')
        .eq('id', sequenceId)
        .single();

      // Get sequence steps
      const { data: steps } = await supabase
        .from('email_sequence_steps')
        .select('*')
        .eq('sequence_id', sequenceId)
        .order('step_number');

      if (!steps || steps.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No steps found for sequence' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create queue entries for all steps
      const queueEntries = steps.map((step) => ({
        [profileIdColumn]: profileId,
        sequence_id: sequenceId,
        step_number: step.step_number,
        template_key: step.template_key,
        scheduled_for: new Date(Date.now() + step.delay_hours * 60 * 60 * 1000).toISOString(),
        status: 'pending',
      }));

      const { error: insertError } = await supabase
        .from('profile_email_queue')
        .insert(queueEntries);

      if (insertError) throw insertError;

      // Log activity
      await supabase.from('crm_activities').insert({
        [profileIdColumn]: profileId,
        activity_type: 'email_sent',
        title: 'Manually Started Email Sequence',
        description: `Manually enrolled in "${sequence?.name || 'Unknown'}" sequence`,
        metadata: {
          sequence_id: sequenceId,
          sequence_name: sequence?.name,
          manual_enrollment: true,
        },
      });

      console.log(`Started sequence for ${profileType} profile ${profileId}`);

    } else if (action === 'pause') {
      const profileIdColumn = profileType === 'buyer' ? 'buyer_profile_id' : 'seller_profile_id';
      
      // Update pending queue items to paused
      const { error: updateError } = await supabase
        .from('profile_email_queue')
        .update({ status: 'paused' })
        .eq(profileIdColumn, profileId)
        .eq('status', 'pending');

      if (updateError) throw updateError;

      // Log activity
      await supabase.from('crm_activities').insert({
        [profileIdColumn]: profileId,
        activity_type: 'note_added',
        title: 'Paused Email Sequence',
        description: 'Email sequence paused manually',
        metadata: { manual_action: true },
      });

      console.log(`Paused sequence for ${profileType} profile ${profileId}`);

    } else if (action === 'stop') {
      const profileIdColumn = profileType === 'buyer' ? 'buyer_profile_id' : 'seller_profile_id';
      
      // Delete pending and paused queue items
      const { error: deleteError } = await supabase
        .from('profile_email_queue')
        .delete()
        .eq(profileIdColumn, profileId)
        .in('status', ['pending', 'paused']);

      if (deleteError) throw deleteError;

      // Log activity
      await supabase.from('crm_activities').insert({
        [profileIdColumn]: profileId,
        activity_type: 'note_added',
        title: 'Stopped Email Sequence',
        description: 'Email sequence stopped and removed from queue',
        metadata: { manual_action: true },
      });

      console.log(`Stopped sequence for ${profileType} profile ${profileId}`);
    }

    return new Response(
      JSON.stringify({ success: true, action }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error managing sequence:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
