import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // L3: Authenticate — only allow service_role or shared secret
  const authHeader = req.headers.get('authorization') || '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const cronSecret = Deno.env.get('CRON_SECRET');
  const providedToken = authHeader.replace('Bearer ', '');

  if (providedToken !== supabaseKey && (!cronSecret || providedToken !== cronSecret)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const now = new Date();
  const results = {
    expired_trials: 0,
    archived_accounts: 0,
    card_expiry_warnings: 0,
    errors: [] as string[],
  };

  console.log(`[LIFECYCLE] Running daily account lifecycle check at ${now.toISOString()}`);

  try {
    // 1. Expire trials that have passed trial_ends_at
    const { data: expiredTrials, error: trialError } = await supabase
      .from('organizations')
      .select('id, business_name, contact_email, trial_ends_at')
      .eq('account_status', 'trial')
      .lt('trial_ends_at', now.toISOString());

    if (trialError) {
      results.errors.push(`Trial expiration check failed: ${trialError.message}`);
    } else if (expiredTrials && expiredTrials.length > 0) {
      const graceEnds = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14-day grace

      for (const org of expiredTrials) {
        // M8: Conditional update — only if STILL in trial status (prevents race with Stripe webhook)
        const { error: updateError, count } = await supabase
          .from('organizations')
          .update({
            account_status: 'trial_expired',
            credit_spending_enabled: false,
            read_only_reason: 'Your 14-day trial has ended. Subscribe to a plan to continue using all features.',
            grace_period_ends_at: graceEnds.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('id', org.id)
          .eq('account_status', 'trial');

        if (updateError) {
          results.errors.push(`Failed to expire trial for org ${org.id}: ${updateError.message}`);
          continue;
        }

        // Log the transition
        await supabase
          .from('account_lifecycle_log')
          .insert({
            organization_id: org.id,
            previous_status: 'trial',
            new_status: 'trial_expired',
            reason: 'Trial period ended',
            triggered_by: 'cron',
            metadata: {
              trial_ended_at: org.trial_ends_at,
              grace_period_ends_at: graceEnds.toISOString(),
              grace_period_days: 14,
            },
          });

        // Queue dunning email for trial expiration
        await supabase
          .from('dunning_emails')
          .insert({
            organization_id: org.id,
            email_type: 'trial_expired',
            recipient_email: org.contact_email,
            email_number: 1,
            metadata: {
              business_name: org.business_name,
              grace_period_ends_at: graceEnds.toISOString(),
            },
          });

        results.expired_trials++;
        console.log(`[LIFECYCLE] Trial expired for org ${org.id} (${org.business_name})`);
      }
    }

    // 2. Archive accounts whose grace period has ended
    const statusesToArchive = ['trial_expired', 'payment_failed', 'unsubscribed'];
    
    for (const status of statusesToArchive) {
      const { data: graceExpired, error: graceError } = await supabase
        .from('organizations')
        .select('id, business_name, contact_email, grace_period_ends_at')
        .eq('account_status', status)
        .lt('grace_period_ends_at', now.toISOString());

      if (graceError) {
        results.errors.push(`Grace period check for ${status} failed: ${graceError.message}`);
        continue;
      }

      if (graceExpired && graceExpired.length > 0) {
        for (const org of graceExpired) {
          const { error: updateError } = await supabase
            .from('organizations')
            .update({
              account_status: 'archived',
              is_active: false,
              credit_spending_enabled: false,
              read_only_reason: 'Account archived. Contact support to restore your account.',
              archived_at: now.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq('id', org.id);

          if (updateError) {
            results.errors.push(`Failed to archive org ${org.id}: ${updateError.message}`);
            continue;
          }

          // Log the transition
          await supabase
            .from('account_lifecycle_log')
            .insert({
              organization_id: org.id,
              previous_status: status,
              new_status: 'archived',
              reason: `Grace period ended after ${status}`,
              triggered_by: 'cron',
              metadata: {
                previous_status: status,
                grace_period_ended_at: org.grace_period_ends_at,
                archived_at: now.toISOString(),
              },
            });

          // Queue archived notification email
          await supabase
            .from('dunning_emails')
            .insert({
              organization_id: org.id,
              email_type: 'account_archived',
              recipient_email: org.contact_email,
              email_number: 1,
              metadata: {
                business_name: org.business_name,
                previous_status: status,
              },
            });

          results.archived_accounts++;
          console.log(`[LIFECYCLE] Archived org ${org.id} (${org.business_name}) - was ${status}`);
        }
      }
    }

    // 3. Check for cards expiring soon (within 30 days)
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const { data: expiringCards, error: cardError } = await supabase
      .from('billing_profiles')
      .select('organization_id, card_expires_at, organizations(business_name, contact_email)')
      .eq('subscription_status', 'active')
      .lt('card_expires_at', thirtyDaysFromNow.toISOString())
      .gt('card_expires_at', now.toISOString());

    if (cardError) {
      results.errors.push(`Card expiry check failed: ${cardError.message}`);
    } else if (expiringCards && expiringCards.length > 0) {
      for (const profile of expiringCards) {
        const org = profile.organizations as { business_name: string; contact_email: string };
        
        // Check if we already sent a warning recently (within last 7 days)
        const { data: recentEmail } = await supabase
          .from('dunning_emails')
          .select('id')
          .eq('organization_id', profile.organization_id)
          .eq('email_type', 'card_expiring')
          .gte('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .maybeSingle();

        if (!recentEmail) {
          await supabase
            .from('dunning_emails')
            .insert({
              organization_id: profile.organization_id,
              email_type: 'card_expiring',
              recipient_email: org.contact_email,
              email_number: 1,
              metadata: {
                business_name: org.business_name,
                card_expires_at: profile.card_expires_at,
              },
            });

          results.card_expiry_warnings++;
          console.log(`[LIFECYCLE] Card expiry warning for org ${profile.organization_id}`);
        }
      }
    }

    console.log(`[LIFECYCLE] Completed: ${results.expired_trials} trials expired, ${results.archived_accounts} accounts archived, ${results.card_expiry_warnings} card warnings sent`);
    
    if (results.errors.length > 0) {
      console.error(`[LIFECYCLE] Errors encountered:`, results.errors);
    }

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: now.toISOString(),
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[LIFECYCLE] Critical error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        results,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
