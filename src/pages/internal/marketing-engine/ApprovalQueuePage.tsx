import { useQuery, useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  X,
  Loader2,
  Sparkles,
  AlertCircle,
  Calendar,
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MarketingPost {
  id: string;
  template_id: string;
  topic: string;
  topic_category: string;
  status: string;
  storyboard: {
    slides?: Array<{
      layout: string;
      headline: string;
      body?: string;
      image_url?: string;
    }>;
    copy?: Record<string, { caption?: string }>;
  } | null;
  output_assets: Record<string, string[]> | null;
  copy_variants: Record<string, { caption: string }> | null;
  channels: string[] | null;
  scheduled_for: string | null;
  variation_axes: Record<string, string> | null;
  cost_usd_total: string | null;
  rejected_reason: string | null;
  reviewer_decision: string | null;
  reviewer_score: number | null;
  reviewer_feedback: string | null;
  created_at: string;
}

const STATUS_TONE: Record<string, string> = {
  review_queue: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  pending_approval: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  scheduled: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
  failed: "bg-red-500/10 text-red-600 border-red-500/20",
  posted: "bg-muted text-muted-foreground",
};

export default function ApprovalQueuePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);

  const { data: posts, refetch } = useQuery<MarketingPost[]>({
    queryKey: ["marketing-engine-queue"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_engine_posts")
        .select("*")
        .in("status", ["review_queue", "pending_approval", "approved", "rejected", "failed"])
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as MarketingPost[];
    },
  });

  const pendingCount = (posts ?? []).filter(
    (p) => p.status === "review_queue" || p.status === "pending_approval",
  ).length;

  // After generate, scroll the freshly created card into view once the
  // refetch lands. The parent layout uses an inner scroll container
  // (<main overflow-y-auto>), so window-level scroll won't reach the
  // new card — scrollIntoView on the card itself does.
  useEffect(() => {
    if (!pendingScrollId) return;
    if (!posts?.some((p) => p.id === pendingScrollId)) return;
    const el = document.getElementById(`me-post-${pendingScrollId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("ring-2", "ring-primary");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 2000);
    }
    setPendingScrollId(null);
  }, [pendingScrollId, posts]);

  const generate = useMutation({
    mutationFn: async () => {
      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes?.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/marketing-engine-pipeline`;
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
    onSuccess: (data) => {
      toast.success("Draft generated", {
        description: `Topic: ${data.topic}. Cost: $${Number(data.cost_usd).toFixed(4)}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["marketing-engine-queue"] });
      if (data.post_id) setPendingScrollId(data.post_id);
    },
    onError: (err: Error) =>
      toast.error("Generation failed", { description: err.message }),
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
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              Approval Queue
              {posts && posts.length > 0 && (
                <Badge variant="secondary" className="text-sm font-normal">
                  {pendingCount} pending
                  {posts.length > pendingCount ? ` · ${posts.length} total` : ""}
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground mt-1">
              Review drafted posts. Approve to schedule for the assigned time.
            </p>
          </div>
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Generate draft
          </Button>
        </div>

        {!posts || posts.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-muted-foreground">
                No drafts yet. Click <b>Generate draft</b> to fire the pipeline manually,
                or wait for the daily cron.
              </p>
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => (
            <div
              key={post.id}
              id={`me-post-${post.id}`}
              className="scroll-mt-4 rounded-lg transition-shadow"
            >
              <PostCard post={post} onChange={() => refetch()} />
            </div>
          ))
        )}
      </div>
  );
}

function PostCard({ post, onChange }: { post: MarketingPost; onChange: () => void }) {
  const queryClient = useQueryClient();
  const [editingChannel, setEditingChannel] = useState<string | null>(null);
  const [draftCaption, setDraftCaption] = useState<string>("");
  const [scheduleEdit, setScheduleEdit] = useState<string>(
    post.scheduled_for ? post.scheduled_for.slice(0, 16) : "",
  );

  const channels = post.channels ?? [];
  const slides = post.storyboard?.slides ?? [];

  const updateStatus = useMutation({
    mutationFn: async (next: { status: string; rejected_reason?: string | null; scheduled_for?: string }) => {
      const updates: Record<string, unknown> = {
        status: next.status,
        updated_at: new Date().toISOString(),
      };
      if (next.status === "approved") updates.approved_at = new Date().toISOString();
      if ("rejected_reason" in next) updates.rejected_reason = next.rejected_reason ?? null;
      if (next.scheduled_for) updates.scheduled_for = next.scheduled_for;
      const { error } = await supabase
        .from("marketing_engine_posts")
        .update(updates)
        .eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      onChange();
      queryClient.invalidateQueries({ queryKey: ["marketing-engine-queue"] });
    },
    onError: (err: Error) =>
      toast.error("Update failed", { description: err.message }),
  });

  const saveCaption = useMutation({
    mutationFn: async (channel: string) => {
      const next = { ...(post.copy_variants ?? {}), [channel]: { caption: draftCaption } };
      const { error } = await supabase
        .from("marketing_engine_posts")
        .update({ copy_variants: next, updated_at: new Date().toISOString() })
        .eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Caption saved");
      setEditingChannel(null);
      onChange();
    },
    onError: (err: Error) =>
      toast.error("Save failed", { description: err.message }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Badge variant="outline" className={STATUS_TONE[post.status] ?? ""}>
                {post.status}
              </Badge>
              <span className="font-mono text-sm text-muted-foreground">{post.topic}</span>
              <Badge variant="secondary" className="text-xs">
                {post.topic_category}
              </Badge>
            </CardTitle>
            <CardDescription className="mt-2 flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {post.scheduled_for ? new Date(post.scheduled_for).toLocaleString() : "no schedule"}
              </span>
              <span>·</span>
              <span>channels: {channels.join(", ") || "—"}</span>
              <span>·</span>
              <span>cost: ${Number(post.cost_usd_total ?? 0).toFixed(4)}</span>
              {post.variation_axes && (
                <>
                  <span>·</span>
                  <span className="text-xs">
                    tone={post.variation_axes.tone}, hook={post.variation_axes.hook_style}, cta=
                    {post.variation_axes.cta_style}
                  </span>
                </>
              )}
            </CardDescription>
          </div>
          {(post.status === "review_queue" || post.status === "pending_approval") && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => updateStatus.mutate({ status: "approved" })}
                disabled={updateStatus.isPending}
              >
                <Check className="h-4 w-4 mr-1" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  updateStatus.mutate({
                    status: "rejected",
                    rejected_reason: "manual reject",
                  })
                }
                disabled={updateStatus.isPending}
              >
                <X className="h-4 w-4 mr-1" /> Reject
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {post.rejected_reason && post.status === "failed" && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-red-500/5 border border-red-500/20 text-sm">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div className="text-red-700 dark:text-red-400">{post.rejected_reason}</div>
          </div>
        )}

        {post.reviewer_decision && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-blue-500/5 border border-blue-500/20 text-sm">
            <Sparkles className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">Reviewer:</span>
                <Badge variant="outline" className="text-xs">
                  {post.reviewer_decision}
                </Badge>
                {post.reviewer_score != null && (
                  <span className="text-xs text-muted-foreground">
                    score {post.reviewer_score}/10
                  </span>
                )}
              </div>
              {post.reviewer_feedback && (
                <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {post.reviewer_feedback}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Slide thumbnails */}
        {slides.length > 0 && (
          <div className="grid grid-cols-5 gap-2">
            {slides.map((slide, idx) => {
              const url = post.output_assets?.[channels[0] ?? "linkedin"]?.[idx];
              return (
                <div
                  key={idx}
                  className="aspect-square rounded-md border bg-muted overflow-hidden relative"
                >
                  {url ? (
                    <img
                      src={url}
                      alt={slide.headline}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.opacity = "0.4";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground p-2 text-center">
                      Slide {idx + 1}<br />
                      {slide.layout}
                    </div>
                  )}
                  <div className="absolute bottom-1 right-1 bg-background/80 backdrop-blur rounded px-1 text-xs">
                    {idx + 1}/{slides.length}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Per-channel captions */}
        {channels.map((channel) => {
          const caption = post.copy_variants?.[channel]?.caption ?? "";
          const isEditing = editingChannel === channel;
          return (
            <div key={channel} className="border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide">{channel} caption</Label>
                {!isEditing ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingChannel(channel);
                      setDraftCaption(caption);
                    }}
                  >
                    edit
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={() => saveCaption.mutate(channel)}
                      disabled={saveCaption.isPending}
                    >
                      save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingChannel(null)}>
                      cancel
                    </Button>
                  </div>
                )}
              </div>
              {isEditing ? (
                <Textarea
                  value={draftCaption}
                  onChange={(e) => setDraftCaption(e.target.value)}
                  rows={5}
                />
              ) : (
                <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {caption || <em>(no caption)</em>}
                </div>
              )}
            </div>
          );
        })}

        {/* Schedule editor */}
        <div className="border rounded-md p-3 space-y-2">
          <Label className="text-xs uppercase tracking-wide">Scheduled for</Label>
          <div className="flex items-center gap-2">
            <Input
              type="datetime-local"
              value={scheduleEdit}
              onChange={(e) => setScheduleEdit(e.target.value)}
              className="max-w-xs"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                updateStatus.mutate({
                  status: post.status,
                  scheduled_for: new Date(scheduleEdit).toISOString(),
                })
              }
              disabled={updateStatus.isPending}
            >
              save time
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
