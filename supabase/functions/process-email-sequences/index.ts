import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const STALE_LOCK_MINUTES = 10;

interface EmailQueueItem {
  id: string;
  seller_profile_id: string | null;
  buyer_profile_id: string | null;
  sequence_id: string;
  current_step: number;
  scheduled_for: string;
  retry_count: number;
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
  organization_id: string;
  email_unsubscribed?: boolean;
  email_preferences_token?: string;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting email sequence processing...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' },
    });

    const now = new Date().toISOString();
    const staleCutoff = new Date(Date.now() - STALE_LOCK_MINUTES * 60 * 1000).toISOString();

    // 1. Fetch batch of pending items + stale processing items (crash recovery)
    const { data: queueItems, error: queueError } = await supabase
      .from('profile_email_queue')
      .select('*')
      .lte('scheduled_for', now)
      .or(`status.eq.pending,and(status.eq.processing,processing_started_at.lt.${staleCutoff})`)
      .order('scheduled_for', { ascending: true })
      .limit(BATCH_SIZE);

    if (queueError) {
      console.error('Error fetching queue items:', queueError);
      throw queueError;
    }

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No emails to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${queueItems.length} emails to process`);

    // 2. Lock entire batch atomically — prevents concurrent invocations from double-processing
    const itemIds = queueItems.map((item) => item.id);
    await supabase
      .from('profile_email_queue')
      .update({ status: 'processing', processing_started_at: now })
      .in('id', itemIds);

    // 3. Batch-fetch all profiles (eliminates N+1 profile queries)
    const sellerIds = queueItems
      .filter((i) => i.seller_profile_id)
      .map((i) => i.seller_profile_id!);
    const buyerIds = queueItems
      .filter((i) => i.buyer_profile_id)
      .map((i) => i.buyer_profile_id!);

    const [sellersResult, buyersResult] = await Promise.all([
      sellerIds.length
        ? supabase
            .from('seller_profiles')
            .select('id, name, email, phone, property_address, organization_id, email_unsubscribed, email_preferences_token')
            .in('id', sellerIds)
        : { data: [] },
      buyerIds.length
        ? supabase
            .from('buyer_profiles')
            .select('id, name, email, phone, property_address, bedrooms_required, budget_min, budget_max, organization_id, email_unsubscribed, email_preferences_token')
            .in('id', buyerIds)
        : { data: [] },
    ]);

    const sellerMap = new Map(
      (sellersResult.data || []).map((p: any) => [p.id, p as Profile])
    );
    const buyerMap = new Map(
      (buyersResult.data || []).map((p: any) => [p.id, p as Profile])
    );

    let processedCount = 0;
    let errorCount = 0;

    // 4. Process each item
    for (const queueItem of queueItems as EmailQueueItem[]) {
      try {
        console.log(`Processing queue item ${queueItem.id}`);

        // Get profile from pre-fetched map (no extra query needed)
        let profile: Profile | undefined;
        let profileType: 'seller' | 'buyer';

        if (queueItem.seller_profile_id) {
          profile = sellerMap.get(queueItem.seller_profile_id);
          profileType = 'seller';
        } else if (queueItem.buyer_profile_id) {
          profile = buyerMap.get(queueItem.buyer_profile_id);
          profileType = 'buyer';
        } else {
          await markFailed(supabase, queueItem, 'No profile ID on queue item');
          errorCount++;
          continue;
        }

        if (!profile) {
          await markFailed(supabase, queueItem, 'Profile not found');
          errorCount++;
          continue;
        }

        // Skip unsubscribed profiles
        if (profile.email_unsubscribed) {
          console.log(`Profile ${profile.id} is unsubscribed, skipping`);
          await supabase
            .from('profile_email_queue')
            .update({ status: 'cancelled' })
            .eq('id', queueItem.id);
          continue;
        }

        // organization_id is already on the profile — no extra query needed
        const organizationId = profile.organization_id;
        if (!organizationId) {
          await markFailed(supabase, queueItem, 'Organization ID not found on profile');
          errorCount++;
          continue;
        }

        // Fetch sequence step + template
        const { data: step, error: stepsError } = await supabase
          .from('email_sequence_steps')
          .select('*, email_templates(*)')
          .eq('sequence_id', queueItem.sequence_id)
          .eq('step_number', queueItem.current_step)
          .eq('is_active', true)
          .maybeSingle();

        if (stepsError || !step) {
          await markRetry(supabase, queueItem, `Step not found: ${stepsError?.message || 'no active step'}`);
          errorCount++;
          continue;
        }

        const template = (step as any).email_templates;
        if (!template) {
          await markRetry(supabase, queueItem, 'Template not found for step');
          errorCount++;
          continue;
        }

        // Send email via send-email function
        console.log(`Sending email to ${profile.email}`);
        const { error: emailError } = await supabase.functions.invoke('send-email', {
          body: {
            to: profile.email,
            templateKey: template.template_key,
            organizationId: organizationId,
            variables: {
              name: profile.name || '',
              property_address: profile.property_address || '',
              bedrooms: profile.bedrooms_required
                ? Array.isArray(profile.bedrooms_required)
                  ? profile.bedrooms_required.join(', ')
                  : profile.bedrooms_required
                : '',
              budget:
                profile.budget_min && profile.budget_max
                  ? `£${profile.budget_min.toLocaleString()} - £${profile.budget_max.toLocaleString()}`
                  : '',
              queueId: queueItem.id,
              preferencesToken: profile.email_preferences_token || null,
            },
          },
        });

        if (emailError) {
          await markRetry(supabase, queueItem, `Email send failed: ${emailError.message}`);
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
            step_number: queueItem.current_step,
          },
          organization_id: organizationId,
        });

        // Check for next step in sequence
        const { data: nextSteps } = await supabase
          .from('email_sequence_steps')
          .select('step_number, delay_days')
          .eq('sequence_id', queueItem.sequence_id)
          .eq('is_active', true)
          .gt('step_number', queueItem.current_step)
          .order('step_number', { ascending: true })
          .limit(1);

        const hasNextStep = nextSteps && nextSteps.length > 0;

        if (hasNextStep) {
          const nextStep = nextSteps[0];
          const nextSendDate = new Date();
          nextSendDate.setDate(nextSendDate.getDate() + nextStep.delay_days);

          await supabase
            .from('profile_email_queue')
            .update({
              status: 'pending',
              current_step: nextStep.step_number,
              last_sent_at: new Date().toISOString(),
              scheduled_send_at: nextSendDate.toISOString(),
              processing_started_at: null,
              error_message: null,
            })
            .eq('id', queueItem.id);
        } else {
          await supabase
            .from('profile_email_queue')
            .update({
              status: 'completed',
              last_sent_at: new Date().toISOString(),
              processing_started_at: null,
            })
            .eq('id', queueItem.id);
        }

        // Log CRM activity
        const activityData: Record<string, any> = {
          activity_type: 'automation_email_sent',
          title: `Automation email sent: ${template.template_key}`,
          description: `Email sent as part of automated sequence (Step ${queueItem.current_step})`,
          metadata: {
            template_key: template.template_key,
            sequence_id: queueItem.sequence_id,
            step_number: queueItem.current_step,
          },
        };

        if (profileType === 'seller') {
          activityData.seller_profile_id = profile.id;
        } else {
          activityData.buyer_profile_id = profile.id;
        }

        await supabase.from('crm_activities').insert(activityData);

        // Update last_contact_at on profile
        const profileTable = profileType === 'seller' ? 'seller_profiles' : 'buyer_profiles';
        await supabase
          .from(profileTable)
          .update({ last_contact_at: new Date().toISOString() })
          .eq('id', profile.id);

        processedCount++;
        console.log(`Successfully processed queue item ${queueItem.id}`);
      } catch (error) {
        console.error(`Error processing queue item ${queueItem.id}:`, error);
        await markRetry(supabase, queueItem, error instanceof Error ? error.message : 'Unknown error');
        errorCount++;
      }
    }

    console.log(`Processing complete. Processed: ${processedCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        errors: errorCount,
        total: queueItems.length,
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

/**
 * Mark a queue item as failed (dead-letter) after exceeding max retries,
 * or increment retry count and return to pending.
 */
async function markRetry(
  supabase: any,
  queueItem: EmailQueueItem,
  errorMessage: string
) {
  const newRetryCount = (queueItem.retry_count || 0) + 1;

  if (newRetryCount >= MAX_RETRIES) {
    console.error(`Queue item ${queueItem.id} exceeded max retries, marking as failed`);
    await supabase
      .from('profile_email_queue')
      .update({
        status: 'failed',
        retry_count: newRetryCount,
        error_message: errorMessage,
        processing_started_at: null,
      })
      .eq('id', queueItem.id);
  } else {
    console.warn(`Queue item ${queueItem.id} retry ${newRetryCount}/${MAX_RETRIES}: ${errorMessage}`);
    await supabase
      .from('profile_email_queue')
      .update({
        status: 'pending',
        retry_count: newRetryCount,
        error_message: errorMessage,
        processing_started_at: null,
      })
      .eq('id', queueItem.id);
  }
}

/**
 * Mark a queue item as permanently failed (non-retryable error like missing profile).
 */
async function markFailed(
  supabase: any,
  queueItem: EmailQueueItem,
  errorMessage: string
) {
  console.error(`Queue item ${queueItem.id} permanently failed: ${errorMessage}`);
  await supabase
    .from('profile_email_queue')
    .update({
      status: 'failed',
      error_message: errorMessage,
      processing_started_at: null,
    })
    .eq('id', queueItem.id);
}
