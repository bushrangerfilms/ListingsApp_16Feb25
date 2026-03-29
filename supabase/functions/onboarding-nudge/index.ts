import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Nudge schedule: [email_number, minDaysAfterSignup, templateKey]
const NUDGE_SCHEDULE: [number, number, string][] = [
  [1, 1, 'onboarding_nudge_1'],   // Day 1 (24h+ after signup)
  [2, 3, 'onboarding_nudge_2'],   // Day 3
  [3, 7, 'onboarding_nudge_3'],   // Day 7
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    db: { schema: 'public' },
  });

  const now = new Date();
  const results = { sent: 0, skipped: 0, errors: [] as string[] };

  console.log(`[ONBOARDING-NUDGE] Running at ${now.toISOString()}`);

  try {
    // Find orgs that signed up but haven't created a listing and haven't completed onboarding
    const { data: eligibleOrgs, error: queryError } = await supabase
      .from('organizations')
      .select(`
        id,
        business_name,
        contact_email,
        contact_name,
        created_at,
        onboarding_progress!inner (
          tasks_completed,
          completed_at,
          dismissed_at
        )
      `)
      .in('account_status', ['free', 'active', 'trial'])
      .not('contact_email', 'is', null)
      .is('onboarding_progress.completed_at', null);

    if (queryError) {
      throw new Error(`Query failed: ${queryError.message}`);
    }

    if (!eligibleOrgs || eligibleOrgs.length === 0) {
      console.log('[ONBOARDING-NUDGE] No eligible organizations found');
      return new Response(
        JSON.stringify({ success: true, results }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ONBOARDING-NUDGE] Found ${eligibleOrgs.length} orgs with incomplete onboarding`);

    // Filter to orgs that haven't created a listing
    const orgIds = eligibleOrgs.map((o) => o.id);
    const { data: orgsWithListings } = await supabase
      .from('listings')
      .select('organization_id')
      .in('organization_id', orgIds);

    const orgsWithListingSet = new Set(
      (orgsWithListings || []).map((l) => l.organization_id)
    );

    // Also check tasks_completed.create_listing
    const noListingOrgs = eligibleOrgs.filter((org) => {
      if (orgsWithListingSet.has(org.id)) return false;
      const onboarding = Array.isArray(org.onboarding_progress)
        ? org.onboarding_progress[0]
        : org.onboarding_progress;
      if (!onboarding) return true;
      if (onboarding.tasks_completed?.create_listing === true) return false;
      return true;
    });

    if (noListingOrgs.length === 0) {
      console.log('[ONBOARDING-NUDGE] All eligible orgs already have listings');
      return new Response(
        JSON.stringify({ success: true, results }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ONBOARDING-NUDGE] ${noListingOrgs.length} orgs without listings`);

    // Get already-sent nudges for these orgs
    const noListingOrgIds = noListingOrgs.map((o) => o.id);
    const { data: sentNudges } = await supabase
      .from('dunning_emails')
      .select('organization_id, email_number')
      .eq('email_type', 'onboarding_nudge')
      .in('organization_id', noListingOrgIds);

    // Build a set of "orgId:emailNumber" for quick dedup lookup
    const sentSet = new Set(
      (sentNudges || []).map((s) => `${s.organization_id}:${s.email_number}`)
    );

    for (const org of noListingOrgs) {
      const signupAge = (now.getTime() - new Date(org.created_at).getTime()) / (1000 * 60 * 60 * 24);

      // Find the highest eligible nudge that hasn't been sent yet
      let nudgeToSend: (typeof NUDGE_SCHEDULE)[number] | null = null;

      for (const nudge of NUDGE_SCHEDULE) {
        const [emailNumber, minDays] = nudge;
        if (signupAge >= minDays && !sentSet.has(`${org.id}:${emailNumber}`)) {
          nudgeToSend = nudge;
          // Don't break — keep looking for higher nudges
        }
      }

      if (!nudgeToSend) {
        results.skipped++;
        continue;
      }

      const [emailNumber, , templateKey] = nudgeToSend;
      const firstName = org.contact_name?.split(' ')[0] || 'there';

      console.log(
        `[ONBOARDING-NUDGE] Sending nudge ${emailNumber} to ${org.business_name} (${org.contact_email})`
      );

      try {
        // Insert dedup record FIRST — prevents duplicate sends if email succeeds but record fails
        const { error: dedupError } = await supabase.from('dunning_emails').insert({
          organization_id: org.id,
          email_type: 'onboarding_nudge',
          email_number: emailNumber,
          recipient_email: org.contact_email,
          metadata: {
            business_name: org.business_name,
            template_key: templateKey,
            signup_age_days: Math.floor(signupAge),
          },
        });

        if (dedupError) {
          results.errors.push(`Failed to record dedup for nudge ${emailNumber} to org ${org.id}: ${dedupError.message}`);
          continue;
        }

        // No organizationId — these are platform-level emails, not org-branded
        const { error: emailError } = await supabase.functions.invoke('send-email', {
          body: {
            templateKey,
            to: org.contact_email,
            variables: {
              first_name: firstName,
              business_name: org.business_name,
              login_url: 'https://app.autolisting.io/admin',
              create_listing_url: 'https://app.autolisting.io/admin/create',
            },
          },
        });

        if (emailError) {
          // Delete dedup record so it retries next run
          await supabase.from('dunning_emails')
            .delete()
            .eq('organization_id', org.id)
            .eq('email_type', 'onboarding_nudge')
            .eq('email_number', emailNumber);
          results.errors.push(`Failed to send nudge ${emailNumber} to org ${org.id}: ${emailError.message}`);
          continue;
        }

        results.sent++;
      } catch (sendErr) {
        const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
        results.errors.push(`Error sending nudge ${emailNumber} to org ${org.id}: ${msg}`);
      }
    }

    console.log(
      `[ONBOARDING-NUDGE] Done: ${results.sent} sent, ${results.skipped} skipped, ${results.errors.length} errors`
    );

    return new Response(
      JSON.stringify({ success: true, timestamp: now.toISOString(), results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[ONBOARDING-NUDGE] Critical error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        results,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
