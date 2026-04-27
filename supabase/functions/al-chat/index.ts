// al-chat: in-app AI assistant for AutoListing.
//
// Streams responses via SSE. Uses Claude Haiku 4.5 for text, Sonnet 4.6 when an image is attached.
// System prompt is structured for prompt caching: frozen preamble + KB are cached;
// per-request live context (route, plan, org state) sits AFTER the cache breakpoint.
//
// Request shape (POST):
//   { conversation_id?: string, message: string, app: 'listings'|'socials',
//     route?: string, image_base64?: string, image_media_type?: string }
//
// Response: SSE stream with events:
//   event: start    data: { conversation_id, user_message_id, assistant_message_id }
//   event: delta    data: { text }
//   event: done     data: { input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd, latency_ms }
//   event: error    data: { message }
//
// Feedback drafts are embedded in the assistant text using:
//   <feedback_draft type="idea|bug|improvement|general">message</feedback_draft>
// The client parses these and renders inline preview cards.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.32.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLAN_LIMITS: Record<string, { monthly: number; daily: number }> = {
  free: { monthly: 100, daily: 20 },
  essentials: { monthly: 200, daily: 30 },
  growth: { monthly: 500, daily: 60 },
  professional: { monthly: 1000, daily: 150 },
  "multi-branch-s": { monthly: 3000, daily: 400 },
  "multi-branch-m": { monthly: 3000, daily: 400 },
  "multi-branch-l": { monthly: 3000, daily: 400 },
};

// Concrete capabilities per plan, surfaced to the model so it can answer
// "what's included on my plan" / "can I do X on my plan" accurately without
// guessing.
const PLAN_DETAILS: Record<string, string> = {
  free:
    "Free tier (€0). 1 active listing. Basic video style only — VS2 and VS4 (advanced motion) are disabled. No custom domain. Solo only (no team invites). Single branch.",
  essentials:
    "Essentials (€40/week). 10 active listings. All video styles unlocked (basic + VS2 + VS4). Custom domain. Team invites. Single branch.",
  growth:
    "Growth (€70/week). 25 active listings. All video styles. Custom domain. Team invites. Single branch.",
  professional:
    "Professional (€130/week). 100 active listings. All video styles. Custom domain. Team invites. Single branch.",
  "multi-branch-s":
    "Multi-Branch S (contact sales). 200 active listings. Multiple branches with separate social accounts per branch. All video styles. Custom domain. Team invites.",
  "multi-branch-m":
    "Multi-Branch M (contact sales). 500 active listings. Multiple branches. All video styles. Custom domain. Team invites.",
  "multi-branch-l":
    "Multi-Branch L (contact sales). Unlimited active listings. Multiple branches. All video styles. Custom domain. Team invites.",
};

function describePlan(planName: string, billingOverride: any): string {
  const detail = PLAN_DETAILS[planName] ?? `Unknown plan: ${planName}`;
  if (billingOverride && typeof billingOverride === "object") {
    return `${detail} (BILLING OVERRIDE active — pilot/comp account; standard plan limits do not apply.)`;
  }
  return detail;
}

const HAIKU_MODEL = "claude-haiku-4-5";
const SONNET_MODEL = "claude-sonnet-4-6";

// Pricing per 1M tokens (USD).
const PRICING = {
  [HAIKU_MODEL]: { input: 1.0, output: 5.0, cache_read: 0.1, cache_write: 1.25 },
  [SONNET_MODEL]: { input: 3.0, output: 15.0, cache_read: 0.3, cache_write: 3.75 },
};

const HISTORY_LIMIT = 20;
const MAX_USER_MESSAGE_CHARS = 4000;
const MAX_OUTPUT_TOKENS = 1024;
const KB_STORAGE_BUCKET = "al-kb";
const KB_STORAGE_FILE = "knowledge-base.json";
// 60-second TTL keeps AL's context fresh without rebuilding prompt-cache on
// every request. When a docs PR merges, the GitHub Action rebuilds the bundle
// in ~30s and this cache expires ~60s later → ~90s end-to-end propagation.
// If the bundle bytes didn't change on refetch, Claude's prompt cache stays
// valid (prefix match on bytes, not identity).
const KB_REFRESH_MS = 60 * 1000;

interface KbBundle {
  version: string;
  built_at: string;
  section_count: number;
  estimated_tokens_total: number;
  sections: Array<{
    id: string;
    title: string;
    apps: string[];
    route_hints: string[];
    plan_gates: string[];
    content: string;
    estimated_tokens: number;
  }>;
}

let kbCache: { bundle: KbBundle; loadedAt: number } | null = null;

const SYSTEM_PREAMBLE = `You are AL, the in-app AI assistant for AutoListing — a real estate platform for agents and agencies.

# AutoListing is ONE product
Treat AutoListing as a single product for the user. NEVER refer to it as "two apps", "the Socials app", "the Listings app", "cross-app", or anything that would make the user think there are separate applications to manage. For the user, there is only AutoListing.

Internally AutoListing is organised into two areas:
- **Socials** — everything related to social media: scheduling, posting, video generation, lead magnets, social account connections. Lives at \`https://socials.autolisting.io\`.
- The main area (everything else) — property listings, CRM, billing, team management, settings, custom domains. Lives at \`https://app.autolisting.io\`.

When the user is asking about something in a different area from where they currently are, just answer and link them to the right page — never frame it as "switching apps" or "going to the other app". Treat the subdomain change as plumbing; the user should experience it as one product.

# Your role
- Help users navigate and use AutoListing
- Explain features, settings, and workflows
- Troubleshoot problems they're seeing
- Draft feedback submissions on the user's behalf when appropriate

# Scope
- ONLY answer questions about AutoListing. For unrelated questions, politely redirect.
- You are READ-ONLY for app data and actions. You cannot change settings, create listings, or take actions for the user. Guide them to do it themselves with clear steps and links.
- EXCEPTION: You may draft feedback submissions for the user to review and send. See "Feedback drafts" below.

# Linking rules
The live-context block tells you the user's current full URL origin. Decide link format by comparing:
- **Same-subdomain link** (destination is on the same subdomain the user is on) — use a relative path:
  \`[Scheduling](/scheduling)\` — renders as in-app navigation, no page reload.
- **Different-subdomain link** (destination lives on the other subdomain) — use the absolute URL:
  \`[Go to Scheduling](https://socials.autolisting.io/scheduling)\` or
  \`[Go to Billing](https://app.autolisting.io/admin/billing)\`.
  Absolute URLs open in a new tab so the user keeps their place.
- **Never name the apps in the link text.** Say \`[Scheduling]\`, not \`[Socials → Scheduling]\`. The user shouldn't have to think about which subdomain they're going to — just the feature. The label on the link should be the feature name, plain.
- If you're unsure which subdomain a feature lives on, check the knowledge base section comments (\`<!-- apps: listings,... -->\` → app.autolisting.io; \`<!-- apps: socials,... -->\` → socials.autolisting.io). Use that only to pick the URL — never expose the app names to the user.

# Tone and style
- Concise. Default to short answers; expand only if asked or if the topic genuinely requires it.
- Use markdown for lists and emphasis.
- Don't use phrases like "Great question!" or "I'd be happy to help!" — just answer.
- If you don't know the answer, say so clearly. Then offer to escalate via feedback.

# When to draft feedback
You may draft a feedback submission in two situations:
1. **The user expresses a feature wish, frustration, or improvement idea.** Offer to submit as feedback.
2. **You can't answer their question confidently** (after one clarifying question if needed). Offer to escalate as a bug report or general support question.

To draft feedback, embed a single XML block in your response:
<feedback_draft type="idea|bug|improvement|general">The full message body</feedback_draft>

Pick the type:
- **idea** — feature request or new capability
- **bug** — something is broken or behaving wrong
- **improvement** — existing feature should work differently
- **general** — support question, not clearly a bug or idea

The user will see a preview card with Send / Edit / Cancel buttons. Always introduce the draft conversationally and ask the user to confirm. Never include sensitive data (passwords, API keys, payment details) in a feedback draft.

# Important rules
- NEVER invent features that don't exist. If you're unsure, say so.
- NEVER promise specific timelines for feature requests.
- NEVER make up plan limits, prices, or quotas — refer to the knowledge base.
- If the user asks something off-topic (general coding help, weather, etc.), politely redirect: "I can only help with AutoListing — try asking about a feature or workflow."
- If the user seems frustrated, acknowledge it briefly, then help.`;

// ============================================================================
// KB loading
// ============================================================================

async function loadKb(
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<{ bundle: KbBundle | null; error?: string }> {
  if (kbCache && Date.now() - kbCache.loadedAt < KB_REFRESH_MS) {
    return { bundle: kbCache.bundle };
  }
  try {
    const url = `${supabaseUrl}/storage/v1/object/${KB_STORAGE_BUCKET}/${KB_STORAGE_FILE}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      const msg = `KB fetch ${res.status}: ${body.slice(0, 200)}`;
      console.error("[al-chat]", msg);
      return { bundle: kbCache?.bundle ?? null, error: msg };
    }
    const text = await res.text();
    const bundle = JSON.parse(text) as KbBundle;
    kbCache = { bundle, loadedAt: Date.now() };
    return { bundle };
  } catch (e: any) {
    const msg = `KB load exception: ${e?.message ?? String(e)}`;
    console.error("[al-chat]", msg);
    return { bundle: kbCache?.bundle ?? null, error: msg };
  }
}

function renderKb(bundle: KbBundle): string {
  const lines = [
    `# AutoListing knowledge base (version ${bundle.version})`,
    "",
    "AutoListing is two connected apps: **Listings** (https://app.autolisting.io) and **Socials** (https://socials.autolisting.io). They share one login. Sections below cover features from both — the HTML comment on each section tells you which app the feature lives in.",
    "",
  ];
  for (const section of bundle.sections) {
    lines.push(`## ${section.title}`);
    lines.push(`<!-- id: ${section.id} | apps: ${section.apps.join(",")} -->`);
    lines.push("");
    lines.push(section.content);
    lines.push("");
  }
  return lines.join("\n");
}

// ============================================================================
// Live context hydration
// ============================================================================

interface LiveContext {
  user_email: string;
  organization_id: string;
  organization_name: string;
  plan: string;
  plan_description: string;
  app: "listings" | "socials";
  route?: string;
  social_accounts_count: number;
  recent_failed_posts: number;
  onboarding_complete: boolean;
  is_super_admin: boolean;
}

function renderLiveContext(ctx: LiveContext): string {
  return `# Current user context (changes per request — not cached)

- User email: ${ctx.user_email}
- Organisation: ${ctx.organization_name}
- App: ${ctx.app}${ctx.is_super_admin ? " (user is super_admin viewing this org)" : ""}
- Current page: ${ctx.route ?? "unknown"}
- Connected social accounts: ${ctx.social_accounts_count}
- Recent failed posts (last 7d): ${ctx.recent_failed_posts}
- Onboarding complete: ${ctx.onboarding_complete}

## Their plan
- Plan tier: \`${ctx.plan}\`
- What this plan includes: ${ctx.plan_description}

Use these plan details when answering "what's included on my plan", "can I do X on my plan", or any feature-availability question. Do not invent limits or capabilities not listed here. If a user wants something their plan doesn't include, point them to upgrade at [Billing](/admin/billing).

Use the rest of the context to tailor your answer. For example, if connected_social_accounts is 0, posting questions should mention this as the likely cause.`;
}

interface AuthorizedOrg {
  ok: true;
  organization_id: string;
  organization_name: string;
  plan: string;
  plan_description: string;
  is_super_admin: boolean;
}
interface AuthError {
  ok: false;
  status: number;
  message: string;
}

async function authorizeOrgAccess(
  supabase: any,
  userId: string,
  requestedOrgId: string | undefined
): Promise<AuthorizedOrg | AuthError> {
  // Super admin can access any org
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["super_admin"])
    .maybeSingle();
  const isSuperAdmin = !!roleRow;

  // Resolve the org we're going to use.
  let orgId = requestedOrgId;

  if (!orgId) {
    // Fall back to the user's first membership (deterministic by created_at).
    const { data: firstMembership } = await supabase
      .from("user_organizations")
      .select("organization_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    orgId = firstMembership?.organization_id;
  }

  if (!orgId) {
    return { ok: false, status: 403, message: "User has no organisation" };
  }

  // Verify access (membership OR super_admin).
  if (!isSuperAdmin) {
    const { data: membership } = await supabase
      .from("user_organizations")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!membership) {
      return { ok: false, status: 403, message: "User is not a member of this organisation" };
    }
  }

  // Load org details.
  const { data: org } = await supabase
    .from("organizations")
    .select("business_name, current_plan_name, billing_override")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) {
    return { ok: false, status: 404, message: "Organisation not found" };
  }

  const plan = (org.current_plan_name ?? "free").toLowerCase();
  return {
    ok: true,
    organization_id: orgId,
    organization_name: org.business_name ?? "Unknown",
    plan,
    plan_description: describePlan(plan, org.billing_override),
    is_super_admin: isSuperAdmin,
  };
}

async function hydrateContext(
  supabase: any,
  userId: string,
  app: "listings" | "socials",
  route: string | undefined,
  authorized: AuthorizedOrg
): Promise<LiveContext> {
  const { data: userData } = await supabase.auth.admin.getUserById(userId);
  const userEmail = userData?.user?.email ?? "unknown";

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [socialRes, failedRes] = await Promise.all([
    supabase
      .from("organization_connected_socials")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", authorized.organization_id)
      .eq("is_active", true),
    supabase
      .from("listing_posting_schedule")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", authorized.organization_id)
      .eq("status", "failed")
      .gte("scheduled_for", sevenDaysAgo),
  ]);
  const socialCount = socialRes.count ?? 0;
  const failedCount = failedRes.count ?? 0;

  return {
    user_email: userEmail,
    organization_id: authorized.organization_id,
    organization_name: authorized.organization_name,
    plan: authorized.plan,
    plan_description: authorized.plan_description,
    app,
    route,
    social_accounts_count: socialCount,
    recent_failed_posts: failedCount,
    onboarding_complete: true,
    is_super_admin: authorized.is_super_admin,
  };
}

// ============================================================================
// Rate limiting
// ============================================================================

async function checkRateLimit(
  supabase: any,
  orgId: string,
  plan: string
): Promise<{ allowed: boolean; remaining_today: number; remaining_month: number; reason?: string }> {
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const monthStartStr = monthStart.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const { data: counter } = await supabase
    .from("al_usage_counters")
    .select("messages_this_month, messages_today, today")
    .eq("organization_id", orgId)
    .eq("month_start", monthStartStr)
    .maybeSingle();

  const monthCount = counter?.messages_this_month ?? 0;
  const dayCount = counter?.today === today ? counter?.messages_today ?? 0 : 0;

  if (monthCount >= limits.monthly) {
    return {
      allowed: false,
      remaining_today: 0,
      remaining_month: 0,
      reason: `Monthly AL message limit reached for your plan (${limits.monthly}). Resets on the 1st.`,
    };
  }
  if (dayCount >= limits.daily) {
    return {
      allowed: false,
      remaining_today: 0,
      remaining_month: limits.monthly - monthCount,
      reason: `Daily AL message limit reached for your plan (${limits.daily}). Resets at midnight UTC.`,
    };
  }

  return {
    allowed: true,
    remaining_today: limits.daily - dayCount,
    remaining_month: limits.monthly - monthCount,
  };
}

// ============================================================================
// Conversation history
// ============================================================================

async function loadOrCreateConversation(
  supabase: any,
  conversationId: string | undefined,
  userId: string,
  orgId: string,
  app: "listings" | "socials"
): Promise<string> {
  if (conversationId) {
    const { data } = await supabase
      .from("al_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (data) return data.id;
  }
  const { data, error } = await supabase
    .from("al_conversations")
    .insert({ user_id: userId, organization_id: orgId, app })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function loadHistory(supabase: any, conversationId: string) {
  const { data } = await supabase
    .from("al_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  return (data ?? []).reverse();
}

// ============================================================================
// Cost calculation
// ============================================================================

function calcCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheWriteTokens: number
): number {
  const p = PRICING[model] ?? PRICING[HAIKU_MODEL];
  const cost =
    (inputTokens * p.input +
      outputTokens * p.output +
      cacheReadTokens * p.cache_read +
      cacheWriteTokens * p.cache_write) /
    1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

// ============================================================================
// Main handler
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anthropicKey =
    Deno.env.get("ANTHROPIC_API_KEY_AUTOLISTING") ?? Deno.env.get("ANTHROPIC_API_KEY");

  if (!anthropicKey) {
    return jsonError(500, "ANTHROPIC_API_KEY_AUTOLISTING not configured");
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonError(401, "Missing Authorization header");
  }
  const userJwt = authHeader.slice(7);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await supabase.auth.getUser(userJwt);
  if (userError || !userData?.user) {
    return jsonError(401, "Invalid auth token");
  }
  const userId = userData.user.id;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const message = String(body.message ?? "").trim();
  const app = body.app === "listings" ? "listings" : "socials";
  const route = body.route ? String(body.route).slice(0, 200) : undefined;
  const conversationIdInput = body.conversation_id ? String(body.conversation_id) : undefined;
  const requestedOrgId = body.organization_id ? String(body.organization_id) : undefined;
  const imageBase64 = body.image_base64 ? String(body.image_base64) : undefined;
  const imageMediaType = body.image_media_type ? String(body.image_media_type) : undefined;

  if (!message) return jsonError(400, "message is required");
  if (message.length > MAX_USER_MESSAGE_CHARS) {
    return jsonError(400, `message exceeds ${MAX_USER_MESSAGE_CHARS} character limit`);
  }

  const authorized = await authorizeOrgAccess(supabase, userId, requestedOrgId);
  if (!authorized.ok) {
    return jsonError(authorized.status, authorized.message);
  }

  const ctx = await hydrateContext(supabase, userId, app, route, authorized);

  const rateLimit = await checkRateLimit(supabase, ctx.organization_id, ctx.plan);
  if (!rateLimit.allowed) {
    return jsonError(429, rateLimit.reason!, { remaining_today: 0, remaining_month: rateLimit.remaining_month });
  }

  const conversationId = await loadOrCreateConversation(
    supabase,
    conversationIdInput,
    userId,
    ctx.organization_id,
    app
  );
  const history = await loadHistory(supabase, conversationId);

  const kbResult = await loadKb(supabaseUrl, serviceRoleKey);
  if (!kbResult.bundle) {
    return jsonError(
      503,
      `Knowledge base unavailable. ${kbResult.error ?? "Try again shortly."}`
    );
  }
  const kbText = renderKb(kbResult.bundle);
  const liveContextText = renderLiveContext(ctx);

  const useVision = !!imageBase64 && !!imageMediaType;
  const model = useVision ? SONNET_MODEL : HAIKU_MODEL;

  // Insert the user message row up front so it's persisted even if streaming dies.
  const { data: userMsgRow } = await supabase
    .from("al_messages")
    .insert({
      conversation_id: conversationId,
      role: "user",
      content: message,
      route,
      has_image: useVision,
    })
    .select("id")
    .single();

  // Pre-create the assistant row with a placeholder; we'll fill content + tokens at end.
  const { data: assistantMsgRow } = await supabase
    .from("al_messages")
    .insert({
      conversation_id: conversationId,
      role: "assistant",
      content: "",
      model,
    })
    .select("id")
    .single();

  const startedAt = Date.now();
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  // Build content for the latest user turn.
  const userContent: any[] = [];
  if (useVision) {
    userContent.push({
      type: "image",
      source: { type: "base64", media_type: imageMediaType, data: imageBase64 },
    });
  }
  userContent.push({ type: "text", text: message });

  // Map history into Anthropic message shape.
  const messages = history.map((m: any) => ({
    role: m.role,
    content: m.content,
  }));
  messages.push({ role: "user", content: userContent });

  // System: preamble + KB (cached together) + live context (not cached, varies per request)
  const system = [
    { type: "text" as const, text: SYSTEM_PREAMBLE },
    {
      type: "text" as const,
      text: kbText,
      cache_control: { type: "ephemeral" as const },
    },
    { type: "text" as const, text: liveContextText },
  ];

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send("start", {
        conversation_id: conversationId,
        user_message_id: userMsgRow?.id,
        assistant_message_id: assistantMsgRow?.id,
        remaining_today: rateLimit.remaining_today,
        remaining_month: rateLimit.remaining_month,
      });

      let fullText = "";
      let usage = {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      };

      try {
        const response = await anthropic.messages.stream({
          model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system,
          messages: messages as any,
        });

        for await (const event of response) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            fullText += event.delta.text;
            send("delta", { text: event.delta.text });
          } else if (event.type === "message_delta" && event.usage) {
            usage.output_tokens = event.usage.output_tokens ?? usage.output_tokens;
          }
        }

        const finalMessage = await response.finalMessage();
        usage = {
          input_tokens: finalMessage.usage.input_tokens ?? 0,
          output_tokens: finalMessage.usage.output_tokens ?? 0,
          cache_read_input_tokens: (finalMessage.usage as any).cache_read_input_tokens ?? 0,
          cache_creation_input_tokens: (finalMessage.usage as any).cache_creation_input_tokens ?? 0,
        };
      } catch (e: any) {
        console.error("[al-chat] streaming error:", e);
        send("error", { message: e?.message ?? "Streaming failed" });
        controller.close();
        return;
      }

      const latency_ms = Date.now() - startedAt;
      const cost_usd = calcCost(
        model,
        usage.input_tokens,
        usage.output_tokens,
        usage.cache_read_input_tokens,
        usage.cache_creation_input_tokens
      );

      // Persist final assistant message + metrics
      await supabase
        .from("al_messages")
        .update({
          content: fullText,
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          cache_read_tokens: usage.cache_read_input_tokens,
          cache_write_tokens: usage.cache_creation_input_tokens,
          cost_usd,
          latency_ms,
        })
        .eq("id", assistantMsgRow?.id);

      await supabase
        .from("al_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId);

      await supabase.rpc("al_increment_usage", { p_org_id: ctx.organization_id });

      send("done", {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_read_tokens: usage.cache_read_input_tokens,
        cache_write_tokens: usage.cache_creation_input_tokens,
        cost_usd,
        latency_ms,
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

function jsonError(status: number, message: string, extra?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ error: message, ...(extra ?? {}) }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
