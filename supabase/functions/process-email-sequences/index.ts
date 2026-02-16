import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailQueueItem {
  id: string;
  seller_profile_id: string | null;
  buyer_profile_id: string | null;
  sequence_id: string;
  current_step: number;
  scheduled_for: string;
}

interface EmailSequenceStep {
  id: string;
  step_number: number;
  email_template_id: string;
  delay_days: number;
}

interface EmailTemplate {
  template_key: string;
  subject: string;
  body_html: string;
}

interface Profile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  property_address?: string;
  bedrooms_required?: string[];
  budget_min?: number;
  budget_max?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting email sequence processing...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' }
    });

    // Fetch all active queued emails that are ready to send
    const { data: queueItems, error: queueError } = await supabase
      .from('profile_email_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true });

    if (queueError) {
      console.error('Error fetching queue items:', queueError);
      throw queueError;
    }

    console.log(`Found ${queueItems?.length || 0} emails to process`);

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No emails to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processedCount = 0;
    let errorCount = 0;

    // Process each queued email
    for (const queueItem of queueItems as EmailQueueItem[]) {
      try {
        console.log(`Processing queue item ${queueItem.id}`);

        // Fetch the sequence and current step
        const { data: steps, error: stepsError } = await supabase
          .from('email_sequence_steps')
          .select('*, email_templates(*)')
          .eq('sequence_id', queueItem.sequence_id)
          .eq('step_number', queueItem.current_step)
          .eq('is_active', true)
          .maybeSingle();

        if (stepsError || !steps) {
          console.error(`Error fetching step for queue item ${queueItem.id}:`, stepsError);
          continue;
        }

        const step = steps as any;
        const template = step.email_templates as EmailTemplate;

        // Fetch profile data (seller or buyer)
        let profile: Profile | null = null;
        let profileType: 'seller' | 'buyer' | null = null;
        let preferencesToken: string | null = null;

        if (queueItem.seller_profile_id) {
          const { data } = await supabase
            .from('seller_profiles')
            .select('*, email_unsubscribed, email_preferences_token')
            .eq('id', queueItem.seller_profile_id)
            .single();
          
          // Skip if unsubscribed
          if (data?.email_unsubscribed) {
            console.log(`Profile ${queueItem.seller_profile_id} is unsubscribed, skipping`);
            await supabase
              .from('profile_email_queue')
              .update({ status: 'cancelled' })
              .eq('id', queueItem.id);
            continue;
          }
          
          profile = data;
          profileType = 'seller';
          preferencesToken = data?.email_preferences_token || null;
        } else if (queueItem.buyer_profile_id) {
          const { data } = await supabase
            .from('buyer_profiles')
            .select('*, email_unsubscribed, email_preferences_token')
            .eq('id', queueItem.buyer_profile_id)
            .single();
          
          // Skip if unsubscribed
          if (data?.email_unsubscribed) {
            console.log(`Profile ${queueItem.buyer_profile_id} is unsubscribed, skipping`);
            await supabase
              .from('profile_email_queue')
              .update({ status: 'cancelled' })
              .eq('id', queueItem.id);
            continue;
          }
          
          profile = data;
          profileType = 'buyer';
          preferencesToken = data?.email_preferences_token || null;
        }

        if (!profile) {
          console.error(`Profile not found for queue item ${queueItem.id}`);
          continue;
        }

        // Get organization_id from profile
        let organizationId: string | null = null;
        if (profileType === 'seller') {
          const { data: sellerData } = await supabase
            .from('seller_profiles')
            .select('organization_id')
            .eq('id', profile.id)
            .single();
          organizationId = sellerData?.organization_id || null;
        } else {
          const { data: buyerData } = await supabase
            .from('buyer_profiles')
            .select('organization_id')
            .eq('id', profile.id)
            .single();
          organizationId = buyerData?.organization_id || null;
        }

        if (!organizationId) {
          console.error(`Organization ID not found for profile ${profile.id}`);
          continue;
        }

        // Replace template variables
        let subject = template.subject;
        let bodyHtml = template.body_html;

        // Replace common variables
        subject = subject.replace(/{{name}}/g, profile.name || '');
        bodyHtml = bodyHtml.replace(/{{name}}/g, profile.name || '');

        if (profile.property_address) {
          subject = subject.replace(/{{property_address}}/g, profile.property_address);
          bodyHtml = bodyHtml.replace(/{{property_address}}/g, profile.property_address);
        }

        if (profile.bedrooms_required) {
          const bedrooms = Array.isArray(profile.bedrooms_required) 
            ? profile.bedrooms_required.join(', ') 
            : profile.bedrooms_required;
          subject = subject.replace(/{{bedrooms}}/g, bedrooms);
          bodyHtml = bodyHtml.replace(/{{bedrooms}}/g, bedrooms);
        }

        if (profile.budget_min && profile.budget_max) {
          const budget = `£${profile.budget_min.toLocaleString()} - £${profile.budget_max.toLocaleString()}`;
          subject = subject.replace(/{{budget}}/g, budget);
          bodyHtml = bodyHtml.replace(/{{budget}}/g, budget);
        }

        // Send email with tracking
        console.log(`Sending email to ${profile.email}`);
        const { error: emailError } = await supabase.functions.invoke('send-email', {
          body: {
            to: profile.email,
            templateKey: template.template_key,
            organizationId: organizationId,
            variables: {
              name: profile.name || '',
              property_address: profile.property_address || '',
              bedrooms: profile.bedrooms_required ? (Array.isArray(profile.bedrooms_required) ? profile.bedrooms_required.join(', ') : profile.bedrooms_required) : '',
              budget: (profile.budget_min && profile.budget_max) ? `£${profile.budget_min.toLocaleString()} - £${profile.budget_max.toLocaleString()}` : '',
              queueId: queueItem.id,
              preferencesToken: preferencesToken
            }
          }
        });

        if (emailError) {
          console.error(`Error sending email for queue item ${queueItem.id}:`, emailError);
          errorCount++;
          continue;
        }

        // Track the sent event
        await supabase.from('email_tracking').insert({
          profile_email_queue_id: queueItem.id,
          event_type: 'sent',
          event_data: {
            to: profile.email,
            template_key: template.template_key,
            sequence_id: queueItem.sequence_id,
            step_number: queueItem.current_step
          }
        });

        // Check if there are more steps in the sequence
        const { data: nextSteps } = await supabase
          .from('email_sequence_steps')
          .select('step_number, delay_days')
          .eq('sequence_id', queueItem.sequence_id)
          .eq('is_active', true)
          .gt('step_number', queueItem.current_step)
          .order('step_number', { ascending: true })
          .limit(1);

        const hasNextStep = nextSteps && nextSteps.length > 0;

        // Update queue item
        if (hasNextStep) {
          const nextStep = nextSteps[0];
          const nextSendDate = new Date();
          nextSendDate.setDate(nextSendDate.getDate() + nextStep.delay_days);

          await supabase
            .from('profile_email_queue')
            .update({
              current_step: nextStep.step_number,
              last_sent_at: new Date().toISOString(),
              scheduled_send_at: nextSendDate.toISOString()
            })
            .eq('id', queueItem.id);
        } else {
          // No more steps, mark as completed
          await supabase
            .from('profile_email_queue')
            .update({
              status: 'completed',
              last_sent_at: new Date().toISOString()
            })
            .eq('id', queueItem.id);
        }

        // Log activity
        const activityData: any = {
          activity_type: 'automation_email_sent',
          title: `Automation email sent: ${template.template_key}`,
          description: `Email sent as part of automated sequence (Step ${queueItem.current_step})`,
          metadata: { 
            template_key: template.template_key,
            sequence_id: queueItem.sequence_id,
            step_number: queueItem.current_step
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

        processedCount++;
        console.log(`Successfully processed queue item ${queueItem.id}`);

      } catch (error) {
        console.error(`Error processing queue item ${queueItem.id}:`, error);
        errorCount++;
      }
    }

    console.log(`Processing complete. Processed: ${processedCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: processedCount,
        errors: errorCount,
        total: queueItems.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-email-sequences:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
