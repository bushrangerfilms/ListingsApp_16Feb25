import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

interface PostRow {
  id: string;
  topic: string;
  topic_category: string;
  status: string;
  channels: string[] | null;
  scheduled_for: string | null;
  posted_at: string | null;
  cost_usd_total: string | null;
  reviewer_decision: string | null;
  reviewer_score: number | null;
  reviewer_feedback: string | null;
  engagement_log: {
    metrics?: Record<
      string,
      { status?: string; post_url?: string; polled_at?: string }
    >;
  } | null;
  template_id: string;
}

interface TemplateRow {
  id: string;
  slug: string;
  display_name: string;
  format: string;
}

interface AggRow {
  template_slug: string;
  posts: number;
  posted: number;
  avg_score: number | null;
  avg_cost: number;
  rejection_rate: number;
}

const STATUS_TONE: Record<string, string> = {
  posted: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  approved: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  scheduled: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  review_queue: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
  failed: "bg-red-500/10 text-red-600 border-red-500/20",
  planning: "bg-muted text-muted-foreground",
};

export default function AnalyticsDashboardPage() {
  const navigate = useNavigate();

  const { data: posts } = useQuery<PostRow[]>({
    queryKey: ["marketing-engine-analytics-posts"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("marketing_engine_posts")
        .select(
          "id, topic, topic_category, status, channels, scheduled_for, posted_at, cost_usd_total, reviewer_decision, reviewer_score, reviewer_feedback, engagement_log, template_id",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200);
      return (data ?? []) as PostRow[];
    },
  });

  const { data: templates } = useQuery<TemplateRow[]>({
    queryKey: ["marketing-engine-analytics-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_engine_templates")
        .select("id, slug, display_name, format");
      return (data ?? []) as TemplateRow[];
    },
  });

  const allPosts = posts ?? [];
  const tmplById = new Map((templates ?? []).map((t) => [t.id, t]));

  const totalPosts = allPosts.length;
  const totalPosted = allPosts.filter((p) => p.status === "posted").length;
  const totalRejected = allPosts.filter(
    (p) => p.status === "rejected" || p.reviewer_decision === "rejected",
  ).length;
  const totalCost = allPosts.reduce(
    (s, p) => s + Number(p.cost_usd_total ?? 0),
    0,
  );
  const reviewerScores = allPosts
    .map((p) => p.reviewer_score)
    .filter((n): n is number => typeof n === "number");
  const avgReviewerScore = reviewerScores.length
    ? reviewerScores.reduce((s, n) => s + n, 0) / reviewerScores.length
    : null;
  const autoRejectionRate =
    totalPosts > 0 ? (totalRejected / totalPosts) * 100 : 0;

  // Per-template aggregates
  const aggByTmpl = new Map<string, AggRow>();
  for (const p of allPosts) {
    const tmpl = tmplById.get(p.template_id);
    const slug = tmpl?.slug ?? p.template_id.slice(0, 8);
    let row = aggByTmpl.get(slug);
    if (!row) {
      row = {
        template_slug: slug,
        posts: 0,
        posted: 0,
        avg_score: null,
        avg_cost: 0,
        rejection_rate: 0,
      };
      aggByTmpl.set(slug, row);
    }
    row.posts += 1;
    if (p.status === "posted") row.posted += 1;
    if (p.status === "rejected" || p.reviewer_decision === "rejected") {
      row.rejection_rate += 1;
    }
    row.avg_cost += Number(p.cost_usd_total ?? 0);
    if (typeof p.reviewer_score === "number") {
      row.avg_score = ((row.avg_score ?? 0) * (row.posts - 1) + p.reviewer_score) / row.posts;
    }
  }
  const aggs = Array.from(aggByTmpl.values())
    .map((r) => ({
      ...r,
      avg_cost: r.posts ? r.avg_cost / r.posts : 0,
      rejection_rate: r.posts ? (r.rejection_rate / r.posts) * 100 : 0,
    }))
    .sort((a, b) => b.posts - a.posts);

  const recentPosted = allPosts.filter((p) => p.status === "posted").slice(0, 20);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/internal/marketing-engine")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground mt-1">
              Last 30 days. Per-template aggregates + recent posted feed.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <KpiCard label="Posts (30d)" value={totalPosts} />
          <KpiCard label="Posted" value={totalPosted} />
          <KpiCard label="Rejected" value={totalRejected} tone={totalRejected > 0 ? "warn" : undefined} />
          <KpiCard
            label="Auto-reject %"
            value={`${autoRejectionRate.toFixed(0)}%`}
            tone={autoRejectionRate > 30 ? "warn" : undefined}
          />
          <KpiCard
            label="Avg reviewer score"
            value={avgReviewerScore != null ? avgReviewerScore.toFixed(1) : "—"}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>By template</CardTitle>
            <CardDescription>
              Posts in last 30d, % posted, average reviewer score, average cost.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {aggs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No posts in window.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead className="text-right">Posts</TableHead>
                    <TableHead className="text-right">Posted</TableHead>
                    <TableHead className="text-right">Reject %</TableHead>
                    <TableHead className="text-right">Avg score</TableHead>
                    <TableHead className="text-right">Avg cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aggs.map((r) => (
                    <TableRow key={r.template_slug}>
                      <TableCell className="font-mono text-xs">{r.template_slug}</TableCell>
                      <TableCell className="text-right text-xs">{r.posts}</TableCell>
                      <TableCell className="text-right text-xs">{r.posted}</TableCell>
                      <TableCell className="text-right text-xs">
                        {r.rejection_rate.toFixed(0)}%
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {r.avg_score != null ? r.avg_score.toFixed(1) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        ${r.avg_cost.toFixed(4)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                    <TableCell className="font-medium text-xs">Total</TableCell>
                    <TableCell className="text-right text-xs">{totalPosts}</TableCell>
                    <TableCell className="text-right text-xs">{totalPosted}</TableCell>
                    <TableCell className="text-right text-xs">
                      {autoRejectionRate.toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {avgReviewerScore != null ? avgReviewerScore.toFixed(1) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">
                      ${totalCost.toFixed(4)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent posted</CardTitle>
            <CardDescription>
              Posts published in last 30d. Engagement metrics arrive once
              the Analyst cron polls Upload Post.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentPosted.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nothing posted yet in the window.
              </p>
            ) : (
              <div className="space-y-1">
                {recentPosted.map((p) => {
                  const metrics = p.engagement_log?.metrics ?? {};
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 py-2 text-sm border-b last:border-b-0"
                    >
                      <Badge
                        variant="outline"
                        className={`text-xs shrink-0 ${STATUS_TONE[p.status] ?? ""}`}
                      >
                        {p.status}
                      </Badge>
                      <code className="text-xs w-40 truncate">{p.topic}</code>
                      <span className="text-xs text-muted-foreground w-32 shrink-0">
                        {p.posted_at ? new Date(p.posted_at).toLocaleString() : "—"}
                      </span>
                      <div className="flex-1 flex items-center gap-2 flex-wrap">
                        {(p.channels ?? []).map((ch) => {
                          const m = metrics[ch];
                          return (
                            <Badge key={ch} variant="secondary" className="text-xs">
                              {ch}
                              {m?.post_url ? (
                                <a
                                  href={m.post_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="ml-1 inline-flex"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : null}
                            </Badge>
                          );
                        })}
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        ${Number(p.cost_usd_total ?? 0).toFixed(4)}
                      </span>
                    </div>
                  );
                })}
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
  tone?: "warn";
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
