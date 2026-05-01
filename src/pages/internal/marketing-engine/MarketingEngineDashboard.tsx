import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronRight,
  Package,
  Workflow,
  Palette,
  BarChart3,
  ListChecks,
  Activity,
  CheckCircle,
  XCircle,
  Calendar,
  Settings,
  Search,
  Cpu,
  AlertTriangle,
  Send,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface KpiData {
  posts_total: number;
  posts_pending: number;
  posts_posted: number;
  posts_failed: number;
  cost_last_7d: number;
  log_count_24h: number;
  failure_count_24h: number;
}

interface GoLiveStatus {
  publish_enabled: boolean;
  upload_post_profile: string | null;
  has_linkedin_id: boolean;
  has_facebook_id: boolean;
  has_instagram_id: boolean;
  approved_unsent_count: number;
}

interface FailedPost {
  id: string;
  topic: string;
  rejected_reason: string | null;
  retry_count: number;
  cost_usd_total: string | null;
  created_at: string;
  updated_at: string;
}

interface PostedPost {
  id: string;
  topic: string;
  posted_at: string | null;
  channels: string[] | null;
  // engagement_log shape: { metrics?: { <platform>: { raw?: { results?: [{ post_url, platform_post_id, success, error_message }] }, status?, post_url?, polled_at?, engagement?: { view_count?, like_count?, comment_count?, ... } } } }
  engagement_log: {
    metrics?: Record<string, {
      raw?: {
        results?: Array<{
          post_url?: string;
          platform_post_id?: string;
          success?: boolean;
          error_message?: string | null;
        }>;
      };
      post_url?: string | null;
      status?: string;
      engagement?: {
        view_count?: number;
        like_count?: number;
        comment_count?: number;
        favorite_count?: number;
        polled_at?: string;
        source?: string;
      };
    }>;
    provider_response?: Record<string, { ok: boolean; request_id?: string; error?: string; skipped?: boolean }>;
  } | null;
}

interface LogRow {
  id: string;
  capability: string;
  provider_slug: string;
  attempt_number: number;
  success: boolean;
  latency_ms: number | null;
  cost_usd: string | null;
  error_message: string | null;
  created_at: string;
}

const ENGINE_TILES = [
  {
    href: "/internal/marketing-engine/queue",
    icon: ListChecks,
    title: "Approval Queue",
    description: "Review and approve scheduled posts",
    color: "text-amber-500",
  },
  {
    href: "/internal/marketing-engine/providers",
    icon: Package,
    title: "Provider Registry",
    description: "Media + LLM providers, status, costs",
    color: "text-blue-500",
  },
  {
    href: "/internal/marketing-engine/routing",
    icon: Workflow,
    title: "Capability Routing",
    description: "Defaults + fallbacks per capability",
    color: "text-purple-500",
  },
  {
    href: "/internal/marketing-engine/social-accounts",
    icon: Users,
    title: "Social Accounts",
    description: "Connect AutoListing's own LinkedIn / IG / FB / TikTok / YouTube",
    color: "text-pink-500",
  },
  {
    href: "/internal/marketing-engine/brand-assets",
    icon: Palette,
    title: "Brand Assets",
    description: "Logo, mascot, voice, palette tokens",
    color: "text-emerald-500",
  },
  {
    href: "/internal/marketing-engine/telemetry",
    icon: BarChart3,
    title: "Cost & Telemetry",
    description: "Per-provider cost, latency, success",
    color: "text-cyan-500",
  },
  {
    href: "/internal/marketing-engine/calendar",
    icon: Calendar,
    title: "Calendar",
    description: "14-day forward view",
    color: "text-rose-500",
  },
  {
    href: "/internal/marketing-engine/analytics",
    icon: Activity,
    title: "Analytics",
    description: "Per-template performance + recent posted feed",
    color: "text-indigo-500",
  },
  {
    href: "/internal/marketing-engine/settings",
    icon: Settings,
    title: "Settings & Taste",
    description: "Reviewer flags + taste rubric editor",
    color: "text-slate-500",
  },
  {
    href: "/internal/marketing-engine/research-inbox",
    icon: Search,
    title: "Research Inbox",
    description: "Phase 7D-2 — repos + patterns to steal from",
    color: "text-fuchsia-500",
  },
  {
    href: "/internal/marketing-engine/model-watch",
    icon: Cpu,
    title: "Model Watch",
    description: "Phase 5 — newly-released AI models for triage",
    color: "text-orange-500",
  },
] as const;

// Compact engagement display for the platform pill in "Recently posted".
// Renders the most informative single number (views first, falls back to
// likes) in compact form, with the full breakdown in the tooltip. Returns
// null when no engagement data is present so the caller can skip the
// inline counts entirely.
function formatEngagement(engagement: {
  view_count?: number;
  like_count?: number;
  comment_count?: number;
}): { compact: string; tooltip: string } | null {
  const { view_count, like_count, comment_count } = engagement;
  const primary = view_count ?? like_count;
  if (primary === undefined) return null;
  const symbol = view_count !== undefined ? "👁" : "♥";
  const tooltipParts: string[] = [];
  if (view_count !== undefined) tooltipParts.push(`${view_count.toLocaleString()} views`);
  if (like_count !== undefined) tooltipParts.push(`${like_count.toLocaleString()} likes`);
  if (comment_count !== undefined) tooltipParts.push(`${comment_count.toLocaleString()} comments`);
  return {
    compact: `${symbol} ${formatCompactNumber(primary)}`,
    tooltip: tooltipParts.join(" · "),
  };
}

function formatCompactNumber(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}m`;
}

export default function MarketingEngineDashboard() {
  const navigate = useNavigate();

  const { data: kpis } = useQuery<KpiData>({
    queryKey: ["marketing-engine-kpis"],
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [postsRes, logsCostRes, logs24Res] = await Promise.all([
        supabase.from("marketing_engine_posts").select("status", { count: "exact", head: false }),
        supabase
          .from("media_generation_log")
          .select("cost_usd")
          .gte("created_at", sevenDaysAgo),
        supabase
          .from("media_generation_log")
          .select("success")
          .gte("created_at", oneDayAgo),
      ]);

      const posts = postsRes.data ?? [];
      const cost = (logsCostRes.data ?? []).reduce(
        (sum, r) => sum + Number(r.cost_usd ?? 0),
        0,
      );
      const logs24 = logs24Res.data ?? [];

      return {
        posts_total: posts.length,
        posts_pending: posts.filter((p) => p.status === "pending_approval" || p.status === "review_queue").length,
        posts_posted: posts.filter((p) => p.status === "posted").length,
        posts_failed: posts.filter((p) => p.status === "failed").length,
        cost_last_7d: cost,
        log_count_24h: logs24.length,
        failure_count_24h: logs24.filter((l) => !l.success).length,
      };
    },
  });

  // Go-live readiness — what's blocking marketing-engine-publish from
  // shipping queued posts. Default state on a fresh project is:
  // publish_enabled=false, brand_assets empty, no Upload Post profile
  // configured. Surface each gate as a single clear pass/fail so the
  // super-admin doesn't have to hunt for "why aren't posts shipping".
  const { data: goLive } = useQuery<GoLiveStatus>({
    queryKey: ["marketing-engine-go-live"],
    queryFn: async () => {
      const [enabledRes, assetsRes, approvedRes] = await Promise.all([
        supabase
          .from("marketing_engine_settings")
          .select("value")
          .eq("key", "publish_enabled")
          .maybeSingle(),
        supabase
          .from("brand_assets")
          .select("key, asset_value")
          .in("key", ["upload_post_profile", "linkedin_page_id", "facebook_page_id", "instagram_business_id"]),
        supabase
          .from("marketing_engine_posts")
          .select("id", { count: "exact", head: true })
          .in("status", ["approved", "scheduled"])
          .lte("scheduled_for", new Date().toISOString()),
      ]);

      const assetMap = new Map<string, string>();
      for (const r of assetsRes.data ?? []) {
        if (r.asset_value && r.asset_value.length > 0) assetMap.set(r.key, r.asset_value);
      }

      return {
        publish_enabled: enabledRes.data?.value === true,
        upload_post_profile: assetMap.get("upload_post_profile") ?? null,
        has_linkedin_id: assetMap.has("linkedin_page_id"),
        has_facebook_id: assetMap.has("facebook_page_id"),
        has_instagram_id: assetMap.has("instagram_business_id"),
        approved_unsent_count: approvedRes.count ?? 0,
      };
    },
    refetchInterval: 30_000,
  });

  const isReadyToShip =
    !!goLive?.publish_enabled && !!goLive?.upload_post_profile;

  // Engagement-collector status. Each platform has two states the operator
  // cares about: did the post URL land in engagement_log (= analyst polled
  // upload-post status) and did real engagement counts land
  // (= per-platform analytics ran). The two diverge when a platform's
  // collector is missing (e.g. YouTube Data API not enabled, or TikTok /
  // LinkedIn / Meta OAuth not wired yet). Computed from the same `posted`
  // query below — no extra round-trip.

  // Recent posts that landed publicly. Surfaces the actual platform
  // URLs so the operator can click straight to the live post on
  // TikTok / YouTube / etc. Pulled from engagement_log.metrics
  // (populated by marketing-engine-analyst-cron).
  const { data: posted } = useQuery<PostedPost[]>({
    queryKey: ["marketing-engine-recent-posted"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_engine_posts")
        .select("id, topic, posted_at, channels, engagement_log")
        .eq("status", "posted")
        .order("posted_at", { ascending: false })
        .limit(10);
      return (data ?? []) as PostedPost[];
    },
    refetchInterval: 60_000,
  });

  // Failed posts in last 7d. Surfaces the actual reject_reason so the
  // operator sees the failure mode at a glance — most informative when
  // multiple posts are failing for the same reason (provider down, bad
  // brand_assets value, etc).
  const { data: failures } = useQuery<FailedPost[]>({
    queryKey: ["marketing-engine-recent-failures"],
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("marketing_engine_posts")
        .select("id, topic, rejected_reason, retry_count, cost_usd_total, created_at, updated_at")
        .eq("status", "failed")
        .gte("updated_at", sevenDaysAgo)
        .order("updated_at", { ascending: false })
        .limit(10);
      return (data ?? []) as FailedPost[];
    },
    refetchInterval: 60_000,
  });

  // Publisher safety state — daily cap usage + circuit breaker + run lock.
  // Lets the operator tell at a glance whether the publisher is gated
  // (cap reached / breaker tripped) without digging into settings or
  // edge-function logs.
  const { data: safety } = useQuery<{
    publishEnabled: boolean;
    maxPostsPerDay: number;
    todayPostedCount: number;
    breakerEnabled: boolean;
    breakerFailureRate: number;
    breakerWindowMin: number;
    recentAttempts: number;
    recentFailures: number;
    runLockHeld: boolean;
    runLockExpiresAt: string | null;
  }>({
    queryKey: ["marketing-engine-publisher-safety"],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      const [settingsR, postedR, lockR, recentR] = await Promise.all([
        supabase
          .from("marketing_engine_settings")
          .select("key, value")
          .in("key", [
            "publish_enabled",
            "max_posts_per_day",
            "circuit_breaker_enabled",
            "circuit_breaker_failure_rate",
            "circuit_breaker_window_min",
          ]),
        supabase
          .from("marketing_engine_posts")
          .select("id", { count: "exact", head: true })
          .eq("status", "posted")
          .gte("posted_at", todayStart.toISOString()),
        supabase
          .from("marketing_engine_run_locks")
          .select("expires_at")
          .eq("name", "publish_due")
          .maybeSingle(),
        // Use the same window the breaker reads. Default 60 if setting absent.
        supabase
          .from("media_generation_log")
          .select("success")
          .eq("capability", "social-publish")
          .gte("created_at", new Date(Date.now() - 60 * 60_000).toISOString()),
      ]);

      const map = new Map<string, unknown>();
      for (const r of settingsR.data ?? []) map.set(r.key, r.value);
      const recent = recentR.data ?? [];
      const lockRow = lockR.data as { expires_at?: string | null } | null;

      return {
        publishEnabled: map.get("publish_enabled") === true,
        maxPostsPerDay:
          typeof map.get("max_posts_per_day") === "number"
            ? (map.get("max_posts_per_day") as number)
            : 10,
        todayPostedCount: postedR.count ?? 0,
        breakerEnabled: map.get("circuit_breaker_enabled") !== false,
        breakerFailureRate:
          typeof map.get("circuit_breaker_failure_rate") === "number"
            ? (map.get("circuit_breaker_failure_rate") as number)
            : 0.6,
        breakerWindowMin:
          typeof map.get("circuit_breaker_window_min") === "number"
            ? (map.get("circuit_breaker_window_min") as number)
            : 60,
        recentAttempts: recent.length,
        recentFailures: recent.filter((r) => r.success === false).length,
        runLockHeld: !!(
          lockRow?.expires_at &&
          new Date(lockRow.expires_at).getTime() > Date.now()
        ),
        runLockExpiresAt: lockRow?.expires_at ?? null,
      };
    },
    refetchInterval: 30_000,
  });

  const { data: recentLogs } = useQuery<LogRow[]>({
    queryKey: ["marketing-engine-recent-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("media_generation_log")
        .select(
          "id, capability, provider_slug, attempt_number, success, latency_ms, cost_usd, error_message, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []) as LogRow[];
    },
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/internal")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Marketing Engine</h1>
            <p className="text-muted-foreground mt-1">
              Superadmin-only social media automation for AutoListing.
            </p>
          </div>
          <Badge variant="outline">Phase 0</Badge>
        </div>

        {/* Go-live readiness — only renders when something's blocking. */}
        {goLive && !isReadyToShip && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                Go-live readiness
              </CardTitle>
              <CardDescription>
                Posts approved past their scheduled time aren't publishing yet.
                Each gate below must be green before <code>marketing-engine-publish-due</code> will ship them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <ReadinessRow
                label="publish_enabled flag"
                ok={goLive.publish_enabled}
                hint={!goLive.publish_enabled ? "Set in marketing_engine_settings to true once below are green" : undefined}
              />
              <ReadinessRow
                label="brand_assets.upload_post_profile"
                ok={!!goLive.upload_post_profile}
                hint={!goLive.upload_post_profile ? "Create Upload Post profile + connect socials via OAuth" : undefined}
              />
              <ReadinessRow
                label="brand_assets.linkedin_page_id"
                ok={goLive.has_linkedin_id}
                hint={!goLive.has_linkedin_id ? "Required for LinkedIn channel" : undefined}
                optional
              />
              <ReadinessRow
                label="brand_assets.facebook_page_id"
                ok={goLive.has_facebook_id}
                hint={!goLive.has_facebook_id ? "Required for Facebook channel" : undefined}
                optional
              />
              <ReadinessRow
                label="brand_assets.instagram_business_id"
                ok={goLive.has_instagram_id}
                hint={!goLive.has_instagram_id ? "Required for Instagram channel" : undefined}
                optional
              />
              {goLive.approved_unsent_count > 0 && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-amber-500/20 text-sm">
                  <Send className="h-4 w-4 text-amber-600" />
                  <span>
                    <b>{goLive.approved_unsent_count}</b> approved post
                    {goLive.approved_unsent_count === 1 ? "" : "s"} waiting to ship.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-7">
          <KpiCard label="Posts (all)" value={kpis?.posts_total ?? "—"} />
          <KpiCard label="In review" value={kpis?.posts_pending ?? "—"} />
          <KpiCard
            label="Posted"
            value={kpis?.posts_posted ?? "—"}
            tone={kpis && kpis.posts_posted > 0 ? "ok" : "default"}
          />
          <KpiCard label="Failed" value={kpis?.posts_failed ?? "—"} />
          <KpiCard
            label="Cost (7d)"
            value={kpis ? `$${kpis.cost_last_7d.toFixed(4)}` : "—"}
          />
          <KpiCard label="Calls (24h)" value={kpis?.log_count_24h ?? "—"} />
          <KpiCard
            label="Failures (24h)"
            value={kpis?.failure_count_24h ?? "—"}
            tone={kpis && kpis.failure_count_24h > 0 ? "warn" : "default"}
          />
        </div>

        {/* Publisher safety net — daily cap usage, circuit breaker
            state, run lock. Makes "why didn't anything ship?" answerable
            without going into edge logs. */}
        {safety && safety.publishEnabled && (() => {
          const capRatio = safety.todayPostedCount / safety.maxPostsPerDay;
          const breakerActive =
            safety.breakerEnabled &&
            safety.recentAttempts >= 5 &&
            safety.recentFailures / safety.recentAttempts >= safety.breakerFailureRate;
          const breakerRate =
            safety.recentAttempts > 0
              ? safety.recentFailures / safety.recentAttempts
              : 0;
          const capTone =
            capRatio >= 1
              ? "border-red-500/40 bg-red-500/5"
              : capRatio >= 0.8
                ? "border-amber-500/40 bg-amber-500/5"
                : "border-emerald-500/30 bg-emerald-500/5";
          const breakerTone = breakerActive
            ? "border-red-500/40 bg-red-500/5"
            : "border-emerald-500/30 bg-emerald-500/5";
          const lockTone = safety.runLockHeld
            ? "border-blue-500/40 bg-blue-500/5"
            : "border-muted bg-muted/20";
          return (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Publisher safety</CardTitle>
                <CardDescription>
                  Live state of run-lock, daily cap, and circuit breaker.
                  Each of these can pause publishing without flipping <code>publish_enabled</code>.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className={`rounded border p-3 ${capTone}`}>
                    <div className="text-xs text-muted-foreground">Daily cap</div>
                    <div className="text-2xl font-bold tabular-nums">
                      {safety.todayPostedCount}
                      <span className="text-base text-muted-foreground"> / {safety.maxPostsPerDay}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {capRatio >= 1
                        ? "cap hit — cron skipping until UTC midnight"
                        : `${safety.maxPostsPerDay - safety.todayPostedCount} remaining today`}
                    </div>
                  </div>
                  <div className={`rounded border p-3 ${breakerTone}`}>
                    <div className="text-xs text-muted-foreground">Circuit breaker</div>
                    <div className="text-2xl font-bold tabular-nums">
                      {breakerActive ? "TRIPPED" : "closed"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {safety.breakerEnabled ? (
                        <>
                          {safety.recentFailures}/{safety.recentAttempts} fail (last {safety.breakerWindowMin}m)
                          {" · "}
                          trip at ≥{(safety.breakerFailureRate * 100).toFixed(0)}%
                          {breakerActive && ` · current ${(breakerRate * 100).toFixed(0)}%`}
                        </>
                      ) : (
                        "disabled"
                      )}
                    </div>
                  </div>
                  <div className={`rounded border p-3 ${lockTone}`}>
                    <div className="text-xs text-muted-foreground">Run lock</div>
                    <div className="text-2xl font-bold tabular-nums">
                      {safety.runLockHeld ? "held" : "free"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {safety.runLockHeld && safety.runLockExpiresAt
                        ? `expires ${new Date(safety.runLockExpiresAt).toLocaleTimeString()}`
                        : "available for next cron tick"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Engine areas</CardTitle>
            <CardDescription>Configuration + monitoring surfaces</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {ENGINE_TILES.map((t) => (
                <Link key={t.href} to={t.href}>
                  <Button
                    variant="outline"
                    className="w-full justify-start h-auto py-3"
                    data-testid={`link-${t.href.split("/").pop()}`}
                  >
                    <t.icon className={`h-4 w-4 mr-3 ${t.color}`} />
                    <div className="text-left flex-1">
                      <div className="font-medium">{t.title}</div>
                      <div className="text-xs text-muted-foreground">{t.description}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Engagement-collector status. Renders only when at least one post
            has shipped, so a fresh project doesn't see a confusing empty
            panel. Each row is one platform across the last 10 posted
            posts: shipped count + measured count + state. */}
        {posted && posted.length > 0 && (() => {
          const PLATFORMS = ["youtube", "tiktok", "linkedin", "facebook", "instagram"] as const;
          const COLLECTOR_STATE: Record<
            string,
            { live: boolean; note: string; stalled_hint?: string }
          > = {
            youtube: {
              live: true,
              note: "YouTube Data API v3 (no OAuth required, just enable on Cloud project)",
              stalled_hint:
                "Enable YouTube Data API v3 on Cloud project 1040360008866 (one click), then re-fire marketing-engine-analyst-cron — the next analyst run populates view/like/comment counts here.",
            },
            tiktok:    { live: false, note: "Pending TikTok for Developers OAuth" },
            linkedin:  { live: false, note: "Pending LinkedIn Marketing Developer Platform OAuth" },
            facebook:  { live: false, note: "Pending Meta Graph API page-access token" },
            instagram: { live: false, note: "Pending Meta Graph API page-access token" },
          };
          const stats = PLATFORMS.map((ch) => {
            let shipped = 0;
            let measured = 0;
            for (const p of posted) {
              const m = p.engagement_log?.metrics?.[ch];
              const url = m?.raw?.results?.[0]?.post_url ?? m?.post_url;
              if (url) shipped += 1;
              const e = (m as { engagement?: { source?: string } } | undefined)?.engagement;
              if (e?.source) measured += 1;
            }
            return { ch, shipped, measured, ...COLLECTOR_STATE[ch] };
          }).filter((s) => s.shipped > 0); // hide platforms not in use
          if (stats.length === 0) return null;
          return (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5 text-cyan-500" />
                  Engagement collectors
                </CardTitle>
                <CardDescription>
                  Per-platform analytics state across the last {posted.length} posted post{posted.length === 1 ? "" : "s"}.
                  &quot;Measured&quot; means real view/like/comment counts have been polled (currently YouTube only).
                  Other platforms ship through Upload Post but their analytics need separate per-platform OAuth.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {stats.map((s) => {
                    const ratio = s.shipped > 0 ? s.measured / s.shipped : 0;
                    const ok = s.live && s.measured > 0 && s.measured === s.shipped;
                    const partial = s.live && s.measured > 0 && s.measured < s.shipped;
                    const stalled = s.live && s.shipped > 0 && s.measured === 0;
                    return (
                      <div
                        key={s.ch}
                        className="flex items-center gap-3 py-1.5 text-sm border-b last:border-b-0"
                      >
                        <code className="text-xs w-20 shrink-0">{s.ch}</code>
                        <span className="text-xs text-muted-foreground w-32 shrink-0">
                          {s.measured} / {s.shipped} measured
                        </span>
                        <div className="flex-1 text-xs">
                          {ok && <span className="text-emerald-600 dark:text-emerald-400">live ✓</span>}
                          {partial && <span className="text-amber-600">partial — {Math.round(ratio * 100)}%</span>}
                          {stalled && (
                            <span className="text-amber-600">
                              shipped but not measured — {s.stalled_hint ?? "collector misconfigured?"}
                            </span>
                          )}
                          {!s.live && <span className="text-muted-foreground">{s.note}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {posted && posted.length > 0 && (
          <Card className="border-emerald-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle className="h-5 w-5" />
                Recently posted
              </CardTitle>
              <CardDescription>
                Last 10 posts that landed publicly. Click a platform pill to open the live post.
                Per-platform URLs come from <code>marketing-engine-analyst-cron</code> (daily Sun 05:00 UTC) — fire it manually if you want fresh URLs immediately.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {posted.map((p) => {
                  const metrics = p.engagement_log?.metrics ?? {};
                  const providerResp = p.engagement_log?.provider_response ?? {};
                  return (
                    <div
                      key={p.id}
                      className="flex items-start gap-3 py-1.5 text-sm border-b last:border-b-0"
                    >
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <code className="text-xs text-muted-foreground w-32 shrink-0 truncate">
                        {p.topic}
                      </code>
                      <div className="flex-1 flex items-center gap-1.5 flex-wrap">
                        {(p.channels ?? []).map((ch) => {
                          const m = metrics[ch];
                          const channelOutcome = providerResp[ch] as
                            | { ok?: boolean; skipped?: boolean; error?: string }
                            | undefined;
                          const url = m?.raw?.results?.[0]?.post_url ?? m?.post_url ?? null;
                          const success = m?.raw?.results?.[0]?.success;
                          const engagement = m?.engagement;
                          // Four states: live URL (success + url), succeeded-no-url
                          // (request_id only), skipped (channel not connected /
                          // content-type mismatch), missing (no log entry).
                          if (url) {
                            const stats = engagement
                              ? formatEngagement(engagement)
                              : null;
                            return (
                              <a
                                key={ch}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 transition-colors inline-flex items-center gap-1"
                                title={stats?.tooltip ?? undefined}
                              >
                                {ch}
                                {stats && (
                                  <span className="text-[10px] opacity-80 font-mono">
                                    {stats.compact}
                                  </span>
                                )}
                                <ChevronRight className="h-3 w-3" />
                              </a>
                            );
                          }
                          if (success === true) {
                            return (
                              <span
                                key={ch}
                                className="text-xs px-2 py-0.5 rounded border bg-blue-500/10 text-blue-600 border-blue-500/20"
                                title="posted but URL not polled yet"
                              >
                                {ch} ⏳
                              </span>
                            );
                          }
                          if (channelOutcome?.skipped) {
                            return (
                              <span
                                key={ch}
                                className="text-xs px-2 py-0.5 rounded border bg-muted/40 text-muted-foreground border-muted-foreground/20"
                                title={channelOutcome.error ?? "skipped — channel not connected"}
                              >
                                {ch} <span className="opacity-60">skipped</span>
                              </span>
                            );
                          }
                          if (channelOutcome && channelOutcome.ok === false) {
                            return (
                              <span
                                key={ch}
                                className="text-xs px-2 py-0.5 rounded border bg-red-500/10 text-red-600 border-red-500/20"
                                title={channelOutcome.error ?? "publish failed"}
                              >
                                {ch} ✕
                              </span>
                            );
                          }
                          return null;
                        })}
                      </div>
                      <span className="text-xs text-muted-foreground w-32 shrink-0 text-right">
                        {p.posted_at ? new Date(p.posted_at).toLocaleString() : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {failures && failures.length > 0 && (
          <Card className="border-red-500/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-red-700 dark:text-red-400">
                <XCircle className="h-5 w-5" />
                Recent failures (7d)
              </CardTitle>
              <CardDescription>
                Posts that hit terminal failure. Most informative when
                multiple share the same reject reason — that's usually a
                provider issue or a misconfigured brand_assets value.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {failures.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-start gap-3 py-1.5 text-sm border-b last:border-b-0"
                  >
                    <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <code className="text-xs text-muted-foreground w-32 shrink-0 truncate">
                      {f.topic}
                    </code>
                    <span className="text-xs flex-1 break-words">
                      {f.rejected_reason ?? "(no reason recorded)"}
                    </span>
                    <span className="text-xs text-muted-foreground w-12 shrink-0 text-right" title="retry count">
                      ↻{f.retry_count}
                    </span>
                    <span className="text-xs text-muted-foreground w-32 shrink-0 text-right">
                      {new Date(f.updated_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent generation log
            </CardTitle>
            <CardDescription>Last 20 router calls (any capability)</CardDescription>
          </CardHeader>
          <CardContent>
            {!recentLogs || recentLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No router calls yet. Use{" "}
                <code className="px-1 py-0.5 rounded bg-muted">marketing-engine-test</code>{" "}
                to fire one.
              </p>
            ) : (
              <div className="space-y-1">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="py-1.5 text-sm border-b last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      {log.success ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                      )}
                      <code className="text-xs text-muted-foreground w-20 shrink-0">
                        {log.capability}
                      </code>
                      <code className="text-xs flex-1 truncate">{log.provider_slug}</code>
                      <span className="text-xs text-muted-foreground w-20 shrink-0 text-right">
                        {log.latency_ms ? `${log.latency_ms}ms` : "—"}
                      </span>
                      <span className="text-xs text-muted-foreground w-20 shrink-0 text-right">
                        ${Number(log.cost_usd ?? 0).toFixed(6)}
                      </span>
                      <span className="text-xs text-muted-foreground w-32 shrink-0 text-right">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    {!log.success && log.error_message && (
                      <p
                        className="text-xs text-red-600 dark:text-red-400 mt-1 ml-7 font-mono break-all"
                        title={log.error_message}
                      >
                        {log.error_message.length > 200
                          ? `${log.error_message.slice(0, 200)}…`
                          : log.error_message}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "default" | "warn" | "ok";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p
          className={`text-2xl font-semibold mt-1 ${
            tone === "warn" ? "text-amber-500" : tone === "ok" ? "text-emerald-500" : ""
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function ReadinessRow({
  label,
  ok,
  hint,
  optional,
}: {
  label: string;
  ok: boolean;
  hint?: string;
  optional?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {ok ? (
        <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
      ) : (
        <XCircle className={`h-4 w-4 mt-0.5 shrink-0 ${optional ? "text-muted-foreground" : "text-amber-600"}`} />
      )}
      <div className="flex-1 min-w-0">
        <code className="text-xs">{label}</code>
        {optional && <span className="text-xs text-muted-foreground ml-2">(per channel)</span>}
        {hint && !ok && (
          <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
        )}
      </div>
    </div>
  );
}
