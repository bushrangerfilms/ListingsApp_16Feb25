// al-kb-rebuild-trigger: super-admin-only endpoint that fires the
// `al-kb-rebuild` GitHub Action workflow via the `workflow_dispatch` API.
// The Action rebuilds the KB bundle from docs/user/*.md and uploads to
// Supabase Storage. al-chat's in-memory cache (60s TTL) picks it up on the
// next expiry.
//
// Request: POST { reason?: string }
// Auth: bearer JWT must belong to a super_admin (checked against user_roles)
// Env: GITHUB_PAT — fine-grained PAT with actions:write on the target repo

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GITHUB_OWNER = "bushrangerfilms";
const GITHUB_REPO = "ListingsApp_16Feb25";
const WORKFLOW_FILE = "al-kb-rebuild.yml";
const WORKFLOW_REF = "main";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST")
    return jsonResponse(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const githubPat = Deno.env.get("GITHUB_PAT");

  if (!githubPat) {
    return jsonResponse(500, {
      error: "GITHUB_PAT not configured. Set it in Supabase secrets.",
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse(401, { error: "Missing Authorization header" });
  }
  const userJwt = authHeader.slice(7);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await supabase.auth.getUser(userJwt);
  if (userError || !userData?.user) {
    return jsonResponse(401, { error: "Invalid auth token" });
  }
  const userId = userData.user.id;

  // Super admin only
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!roleRow) {
    return jsonResponse(403, { error: "Super admin access required" });
  }

  let reason = "manual";
  try {
    const body = await req.json();
    if (body?.reason) reason = String(body.reason).slice(0, 200);
  } catch {
    /* no body is fine */
  }

  const dispatchUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
  const res = await fetch(dispatchUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${githubPat}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ref: WORKFLOW_REF,
      inputs: { reason: `${reason} (by ${userData.user.email ?? userId})` },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[al-kb-rebuild-trigger] GitHub dispatch failed:", res.status, text);
    return jsonResponse(502, {
      error: `GitHub Action dispatch failed (${res.status})`,
      details: text.slice(0, 500),
    });
  }

  return jsonResponse(200, {
    ok: true,
    message:
      "Rebuild triggered. GitHub Action will run in ~5s, complete in ~30s, and AL will pick up changes within ~60s after that.",
  });
});
