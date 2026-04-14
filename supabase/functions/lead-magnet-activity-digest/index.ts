// Lead Magnet daily activity digest — anonymized counts only.
//
// For each org with quiz activity the previous day:
//   1. Aggregate lead_submissions counts (started, completed, abandoned)
//   2. Compute top utm_source
//   3. Send a counts-only summary email to org.contact_email
//
// NO personal data is sent — no eircode, no town, no property details, no
// email addresses of leads. Only aggregate counts, a source label, and the
// org's own business name.
//
// Dedup via `dunning_emails` (email_type = 'lead_magnet_activity_digest',
// metadata.digest_date = YYYY-MM-DD) — prevents double-sends on cron retry.
// Idempotent: safe to call repeatedly.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Org {
  id: string;
  business_name: string;
  contact_email: string;
}

interface DigestStats {
  quiz_starts: number;
  completed: number;
  abandoned: number;
  top_source: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    db: { schema: "public" },
  });

  const now = new Date();
  const results = { processed: 0, sent: 0, skipped_no_activity: 0, errors: [] as string[] };

  // "Yesterday" window in UTC: [start, end)
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dayStart = new Date(Date.UTC(
    yesterday.getUTCFullYear(),
    yesterday.getUTCMonth(),
    yesterday.getUTCDate(),
    0, 0, 0, 0,
  ));
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  const digestDateIso = dayStart.toISOString().slice(0, 10); // YYYY-MM-DD
  const digestDateHuman = dayStart.toLocaleDateString("en-IE", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  // Optional dry-run mode via body { "dry_run": true } — computes but doesn't send
  let dryRun = false;
  try {
    const body = await req.json();
    dryRun = !!body?.dry_run;
  } catch {
    /* no body, not dry run */
  }

  console.log(
    `[LEAD-MAGNET-DIGEST] Running for ${digestDateIso} (window ${dayStart.toISOString()} → ${dayEnd.toISOString()}), dry_run=${dryRun}`
  );

  try {
    // 1. Eligible orgs: active, has contact_email, digest enabled
    const { data: orgs, error: orgsError } = await supabase
      .from("organizations")
      .select("id, business_name, contact_email")
      .eq("is_active", true)
      .eq("lead_magnet_digest_enabled", true)
      .not("contact_email", "is", null);

    if (orgsError) {
      throw new Error(`Query orgs failed: ${orgsError.message}`);
    }

    if (!orgs || orgs.length === 0) {
      console.log("[LEAD-MAGNET-DIGEST] No eligible organizations");
      return new Response(
        JSON.stringify({ success: true, timestamp: now.toISOString(), results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Dedup — skip orgs that already got a digest for this date
    const orgIds = orgs.map((o: Org) => o.id);
    const { data: alreadySent } = await supabase
      .from("dunning_emails")
      .select("organization_id, metadata")
      .eq("email_type", "lead_magnet_activity_digest")
      .in("organization_id", orgIds);

    const sentSet = new Set(
      (alreadySent || [])
        .filter((r: any) => r.metadata?.digest_date === digestDateIso)
        .map((r: any) => r.organization_id)
    );

    for (const org of orgs as Org[]) {
      results.processed++;

      if (sentSet.has(org.id)) {
        console.log(`[LEAD-MAGNET-DIGEST] Org ${org.id} already received digest for ${digestDateIso}, skipping`);
        continue;
      }

      try {
        const stats = await aggregateOrgStats(supabase, org.id, dayStart, dayEnd);

        if (stats.quiz_starts === 0) {
          results.skipped_no_activity++;
          continue;
        }

        if (dryRun) {
          console.log(
            `[LEAD-MAGNET-DIGEST] DRY RUN — would send to ${org.contact_email}: ${JSON.stringify(stats)}`
          );
          continue;
        }

        // Insert dedup record BEFORE sending (idempotency safety)
        const { error: dedupError } = await supabase.from("dunning_emails").insert({
          organization_id: org.id,
          email_type: "lead_magnet_activity_digest",
          email_number: 1,
          recipient_email: org.contact_email,
          metadata: {
            digest_date: digestDateIso,
            quiz_starts: stats.quiz_starts,
            completed: stats.completed,
            abandoned: stats.abandoned,
            top_source: stats.top_source,
          },
        });

        if (dedupError) {
          results.errors.push(`Dedup insert failed for org ${org.id}: ${dedupError.message}`);
          continue;
        }

        // Platform-level email — no organizationId (per MEMORY.md)
        const { error: emailError } = await supabase.functions.invoke("send-email", {
          body: {
            templateKey: "lead_magnet_activity_digest",
            to: org.contact_email,
            variables: {
              business_name: org.business_name,
              digest_date: digestDateHuman,
              quiz_starts: stats.quiz_starts,
              completed: stats.completed,
              abandoned: stats.abandoned,
              top_source: stats.top_source,
              lead_magnets_url: "https://socials.autolisting.io/lead-magnets",
            },
          },
        });

        if (emailError) {
          // Roll back dedup so it retries next run
          await supabase
            .from("dunning_emails")
            .delete()
            .eq("organization_id", org.id)
            .eq("email_type", "lead_magnet_activity_digest")
            .eq("metadata->>digest_date", digestDateIso);
          results.errors.push(`Send-email failed for org ${org.id}: ${emailError.message}`);
          continue;
        }

        results.sent++;
        console.log(
          `[LEAD-MAGNET-DIGEST] Sent to ${org.business_name} (${org.contact_email}) — ${stats.quiz_starts} starts, ${stats.completed} completed, ${stats.abandoned} abandoned`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.errors.push(`Org ${org.id}: ${msg}`);
      }
    }

    console.log(
      `[LEAD-MAGNET-DIGEST] Done: processed=${results.processed}, sent=${results.sent}, skipped_no_activity=${results.skipped_no_activity}, errors=${results.errors.length}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: now.toISOString(),
        digest_date: digestDateIso,
        dry_run: dryRun,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[LEAD-MAGNET-DIGEST] Critical error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        results,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function aggregateOrgStats(
  supabase: any,
  orgId: string,
  dayStart: Date,
  dayEnd: Date
): Promise<DigestStats> {
  // Pull only the fields we need for yesterday's submissions for this org.
  // Small orgs: ≤few dozen rows/day. Aggregation in-memory is fine and
  // keeps the code simple (no raw SQL RPC needed).
  const { data, error } = await supabase
    .from("lead_submissions")
    .select("email, utm_source")
    .eq("organization_id", orgId)
    .gte("created_at", dayStart.toISOString())
    .lt("created_at", dayEnd.toISOString());

  if (error) {
    throw new Error(`Aggregate query failed: ${error.message}`);
  }

  const rows = data || [];
  const quiz_starts = rows.length;
  let completed = 0;
  let abandoned = 0;
  const sourceCounts = new Map<string, number>();

  for (const row of rows) {
    if (row.email) completed++;
    else abandoned++;
    const src = row.utm_source || "Direct";
    sourceCounts.set(src, (sourceCounts.get(src) || 0) + 1);
  }

  let top_source = "Direct";
  let topCount = 0;
  for (const [src, n] of sourceCounts.entries()) {
    if (n > topCount) {
      top_source = src;
      topCount = n;
    }
  }
  // Capitalize first char for nicer display
  top_source = top_source.charAt(0).toUpperCase() + top_source.slice(1);

  return { quiz_starts, completed, abandoned, top_source };
}
