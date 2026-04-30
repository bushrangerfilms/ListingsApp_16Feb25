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
  posts_failed: number;
  cost_last_7d: number;
  log_count_24h: number;
  failure_count_24h: number;
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
] as const;

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
        posts_pending: posts.filter((p) => p.status === "pending_approval").length,
        posts_failed: posts.filter((p) => p.status === "failed").length,
        cost_last_7d: cost,
        log_count_24h: logs24.length,
        failure_count_24h: logs24.filter((l) => !l.success).length,
      };
    },
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

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Posts (all)" value={kpis?.posts_total ?? "—"} />
          <KpiCard label="Pending approval" value={kpis?.posts_pending ?? "—"} />
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
                    className="flex items-center gap-3 py-1.5 text-sm border-b last:border-b-0"
                  >
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
  tone?: "default" | "warn";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p
          className={`text-2xl font-semibold mt-1 ${
            tone === "warn" ? "text-amber-500" : ""
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
