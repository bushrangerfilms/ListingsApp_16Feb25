// Research Inbox — Phase 7D-2 super-admin surface.
//
// Lists candidates surfaced by the weekly repo-discovery cron (and
// any manual fires). Lets the super-admin promote rows
// pending → queued → adopted/rejected so promising patterns flow
// into the Phase 7D backlog.
//
// Manual discovery trigger fires
// `/functions/v1/marketing-engine-repo-discover` — used to refresh
// outside the Sunday cron window when new repos are spotted.

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

type InboxStatus = "pending" | "queued" | "adopted" | "rejected";
type Classification =
  | "steal_full_pattern"
  | "steal_fragment"
  | "steal_mcp_integration"
  | "skip_multi_tenant"
  | "skip_wrong_stack"
  | "skip_low_relevance";

interface InboxRow {
  id: string;
  source_kind: string;
  source_url: string;
  title: string;
  summary_md: string;
  patterns_extracted: string[];
  classification: Classification;
  relevance_score: number;
  status: InboxStatus;
  discovery_run_id: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<InboxStatus, string> = {
  pending: "Pending",
  queued: "Queued",
  adopted: "Adopted",
  rejected: "Rejected",
};

const STATUS_BADGE_CLASS: Record<InboxStatus, string> = {
  pending: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  queued: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  adopted: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
};

const CLASSIFICATION_LABEL: Record<Classification, string> = {
  steal_full_pattern: "Steal full pattern",
  steal_fragment: "Steal fragment",
  steal_mcp_integration: "Steal MCP integration",
  skip_multi_tenant: "Skip — multi-tenant",
  skip_wrong_stack: "Skip — wrong stack",
  skip_low_relevance: "Skip — low relevance",
};

const CLASSIFICATION_BADGE_CLASS: Record<Classification, string> = {
  steal_full_pattern: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  steal_fragment: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  steal_mcp_integration: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  skip_multi_tenant: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  skip_wrong_stack: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  skip_low_relevance: "bg-slate-500/10 text-slate-500 border-slate-500/20",
};

export default function ResearchInboxPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<InboxStatus | "all">("pending");
  const [classFilter, setClassFilter] = useState<Classification | "all">("all");

  const { data: rows, isLoading } = useQuery<InboxRow[]>({
    queryKey: ["research-inbox"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_engine_research_inbox")
        .select(
          "id, source_kind, source_url, title, summary_md, patterns_extracted, classification, relevance_score, status, discovery_run_id, created_at",
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
      if (classFilter !== "all" && r.classification !== classFilter) return false;
      return true;
    });
  }, [rows, statusFilter, classFilter]);

  const counts = useMemo(() => {
    const list = rows ?? [];
    return {
      pending: list.filter((r) => r.status === "pending").length,
      queued: list.filter((r) => r.status === "queued").length,
      adopted: list.filter((r) => r.status === "adopted").length,
      rejected: list.filter((r) => r.status === "rejected").length,
    };
  }, [rows]);

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: InboxStatus }) => {
      const { error } = await supabase
        .from("marketing_engine_research_inbox")
        .update({
          status,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-inbox"] });
    },
    onError: (err: Error) =>
      toast.error("Status update failed", { description: err.message }),
  });

  const triggerDiscovery = useMutation({
    mutationFn: async () => {
      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes?.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/marketing-engine-repo-discover`;
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
      toast.success("Discovery walk started", {
        description:
          "Running in background — refresh in 1–3 minutes to see new candidates.",
      });
    },
    onError: (err: Error) =>
      toast.error("Discovery trigger failed", { description: err.message }),
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
          <h1 className="text-3xl font-bold tracking-tight">Research Inbox</h1>
          <p className="text-muted-foreground mt-1">
            Phase 7D-2. Candidate patterns surfaced by the weekly repo-discovery
            agent. Promote pending → queued → adopted as you incorporate them.
          </p>
        </div>
        <Button
          onClick={() => triggerDiscovery.mutate()}
          disabled={triggerDiscovery.isPending}
        >
          {triggerDiscovery.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4 mr-2" />
          )}
          Run discovery now
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["pending", "queued", "adopted", "rejected"] as InboxStatus[]).map((s) => (
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
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="adopted">Adopted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={classFilter}
              onValueChange={(v) => setClassFilter(v as Classification | "all")}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Classification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classifications</SelectItem>
                {(Object.keys(CLASSIFICATION_LABEL) as Classification[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {CLASSIFICATION_LABEL[c]}
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
                  Run the weekly cron or click <b>Run discovery now</b> to populate.
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
                    <h3 className="font-semibold truncate">{row.title}</h3>
                    <a
                      href={row.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 mt-0.5"
                    >
                      {row.source_url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className="font-mono">
                      {row.relevance_score}/10
                    </Badge>
                    <Badge
                      variant="outline"
                      className={CLASSIFICATION_BADGE_CLASS[row.classification]}
                    >
                      {CLASSIFICATION_LABEL[row.classification]}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={STATUS_BADGE_CLASS[row.status]}
                    >
                      {STATUS_LABEL[row.status]}
                    </Badge>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {row.summary_md}
                </p>

                {row.patterns_extracted.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
                      Patterns extracted
                    </div>
                    <ul className="text-sm space-y-1 list-disc list-inside">
                      {row.patterns_extracted.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="text-xs text-muted-foreground">
                    Surfaced {new Date(row.created_at).toLocaleString()}
                  </div>
                  <div className="flex gap-2">
                    {row.status !== "queued" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setStatus.mutate({ id: row.id, status: "queued" })
                        }
                        disabled={setStatus.isPending}
                      >
                        Queue
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
