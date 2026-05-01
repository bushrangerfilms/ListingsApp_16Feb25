// Model Watch Inbox — Phase 5 super-admin surface.
//
// Lists candidate AI models surfaced by the weekly model-watch cron
// (and any manual fires). Lets the super-admin promote rows
// pending → testing → adopted/rejected as new models are evaluated
// against incumbents.
//
// Manual trigger fires `/functions/v1/marketing-engine-model-watch` —
// used to refresh outside the Sunday cron window when a vendor ships
// something newsworthy.

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Loader2, RefreshCcw } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type InboxStatus = "pending" | "testing" | "adopted" | "rejected";
type Recommendation = "adopt_now" | "a_b_test" | "evaluate" | "skip";
type Modality = "text" | "image" | "video" | "audio" | "multimodal";

interface InboxRow {
  id: string;
  vendor: string;
  model_id: string;
  display_name: string | null;
  modality: Modality;
  capability_summary_md: string;
  release_date: string | null;
  source_url: string;
  pricing_summary: string | null;
  relevance_score: number;
  recommendation: Recommendation;
  recommendation_reason: string;
  status: InboxStatus;
  created_at: string;
}

const STATUS_LABEL: Record<InboxStatus, string> = {
  pending: "Pending",
  testing: "Testing",
  adopted: "Adopted",
  rejected: "Rejected",
};

const STATUS_BADGE_CLASS: Record<InboxStatus, string> = {
  pending: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  testing: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  adopted: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
};

const RECOMMENDATION_LABEL: Record<Recommendation, string> = {
  adopt_now: "Adopt now",
  a_b_test: "A/B test",
  evaluate: "Evaluate",
  skip: "Skip",
};

const RECOMMENDATION_BADGE_CLASS: Record<Recommendation, string> = {
  adopt_now: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  a_b_test: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  evaluate: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  skip: "bg-slate-500/10 text-slate-500 border-slate-500/20",
};

const MODALITY_BADGE_CLASS: Record<Modality, string> = {
  text: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  image: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20",
  video: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  audio: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  multimodal: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
};

export default function ModelWatchInboxPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<InboxStatus | "all">("pending");
  const [recFilter, setRecFilter] = useState<Recommendation | "all">("all");

  const { data: rows, isLoading } = useQuery<InboxRow[]>({
    queryKey: ["model-watch-inbox"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_engine_model_watch_inbox")
        .select(
          "id, vendor, model_id, display_name, modality, capability_summary_md, release_date, source_url, pricing_summary, relevance_score, recommendation, recommendation_reason, status, created_at",
        )
        .order("relevance_score", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as InboxRow[];
    },
  });

  const filtered = useMemo(() => {
    const list = rows ?? [];
    return list.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (recFilter !== "all" && r.recommendation !== recFilter) return false;
      return true;
    });
  }, [rows, statusFilter, recFilter]);

  const counts = useMemo(() => {
    const list = rows ?? [];
    return {
      pending: list.filter((r) => r.status === "pending").length,
      testing: list.filter((r) => r.status === "testing").length,
      adopted: list.filter((r) => r.status === "adopted").length,
      rejected: list.filter((r) => r.status === "rejected").length,
    };
  }, [rows]);

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: InboxStatus }) => {
      const { error } = await supabase
        .from("marketing_engine_model_watch_inbox")
        .update({
          status,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["model-watch-inbox"] });
    },
    onError: (err: Error) =>
      toast.error("Status update failed", { description: err.message }),
  });

  const triggerWatch = useMutation({
    mutationFn: async () => {
      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes?.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/marketing-engine-model-watch`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      return json;
    },
    onSuccess: () => {
      toast.success("Model-watch walk started", {
        description:
          "Running in background — refresh in 1–3 minutes to see new candidates.",
      });
    },
    onError: (err: Error) =>
      toast.error("Model-watch trigger failed", { description: err.message }),
  });

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
          <h1 className="text-3xl font-bold tracking-tight">Model Watch</h1>
          <p className="text-muted-foreground mt-1">
            Phase 5. Candidate AI models surfaced by the weekly model-watch
            agent. Promote pending → testing → adopted as you A/B vs incumbent
            in the provider registry.
          </p>
        </div>
        <Button
          onClick={() => triggerWatch.mutate()}
          disabled={triggerWatch.isPending}
        >
          {triggerWatch.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4 mr-2" />
          )}
          Run model-watch now
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["pending", "testing", "adopted", "rejected"] as InboxStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-md border px-4 py-3 text-left transition ${
              statusFilter === s
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40"
            }`}
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {STATUS_LABEL[s]}
            </div>
            <div className="text-2xl font-semibold mt-1">{counts[s]}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>
              {filtered.length} candidate{filtered.length === 1 ? "" : "s"}
            </CardTitle>
            <CardDescription>
              Sorted by relevance score (highest first), then most recent.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as InboxStatus | "all")}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="testing">Testing</SelectItem>
                <SelectItem value="adopted">Adopted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={recFilter}
              onValueChange={(v) => setRecFilter(v as Recommendation | "all")}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Recommendation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All recommendations</SelectItem>
                {(Object.keys(RECOMMENDATION_LABEL) as Recommendation[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {RECOMMENDATION_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-12">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              No candidates match the current filters.
              {(rows?.length ?? 0) === 0 && (
                <>
                  <br />
                  Run the weekly cron or click <b>Run model-watch now</b> to populate.
                </>
              )}
            </div>
          ) : (
            filtered.map((row) => (
              <div
                key={row.id}
                className="border rounded-lg p-4 space-y-3 hover:border-primary/40 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate flex items-center gap-2">
                      <span className="text-muted-foreground text-sm font-mono">{row.vendor}</span>
                      <span className="text-muted-foreground">/</span>
                      <span>{row.display_name ?? row.model_id}</span>
                    </h3>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                      {row.model_id}
                      {row.release_date && (
                        <>
                          {" · "}released {row.release_date}
                        </>
                      )}
                    </div>
                    <a
                      href={row.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 mt-1 break-all"
                    >
                      {row.source_url}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    <Badge variant="outline" className="font-mono">
                      {row.relevance_score}/10
                    </Badge>
                    <Badge variant="outline" className={MODALITY_BADGE_CLASS[row.modality]}>
                      {row.modality}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={RECOMMENDATION_BADGE_CLASS[row.recommendation]}
                    >
                      {RECOMMENDATION_LABEL[row.recommendation]}
                    </Badge>
                    <Badge variant="outline" className={STATUS_BADGE_CLASS[row.status]}>
                      {STATUS_LABEL[row.status]}
                    </Badge>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {row.capability_summary_md}
                </p>

                <div className="grid gap-2 sm:grid-cols-2 text-xs">
                  <div>
                    <div className="uppercase tracking-wide text-muted-foreground mb-0.5">
                      Recommendation reason
                    </div>
                    <div>{row.recommendation_reason}</div>
                  </div>
                  {row.pricing_summary && (
                    <div>
                      <div className="uppercase tracking-wide text-muted-foreground mb-0.5">
                        Pricing
                      </div>
                      <div className="font-mono">{row.pricing_summary}</div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="text-xs text-muted-foreground">
                    Surfaced {new Date(row.created_at).toLocaleString()}
                  </div>
                  <div className="flex gap-2">
                    {row.status !== "testing" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setStatus.mutate({ id: row.id, status: "testing" })
                        }
                        disabled={setStatus.isPending}
                      >
                        Testing
                      </Button>
                    )}
                    {row.status !== "adopted" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setStatus.mutate({ id: row.id, status: "adopted" })
                        }
                        disabled={setStatus.isPending}
                      >
                        Adopted
                      </Button>
                    )}
                    {row.status !== "rejected" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setStatus.mutate({ id: row.id, status: "rejected" })
                        }
                        disabled={setStatus.isPending}
                      >
                        Reject
                      </Button>
                    )}
                    {row.status !== "pending" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setStatus.mutate({ id: row.id, status: "pending" })
                        }
                        disabled={setStatus.isPending}
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
