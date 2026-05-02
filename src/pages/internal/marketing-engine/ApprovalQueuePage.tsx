import { useQuery, useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  X,
  Loader2,
  Sparkles,
  AlertCircle,
  Calendar,
  MessageCircle,
  Send,
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
    shots?: Array<{
      duration_s: number;
      voice_segment?: string;
      asset_id?: string;
    }>;
    voice_script?: string;
    copy?: Record<string, { caption?: string }>;
  } | null;
  output_assets: Record<string, string[]> | null;
  copy_variants: Record<string, { caption: string }> | null;
  render_thumbnails: string[] | null;
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

// Detect a video post by output_assets URL extension OR by storyboard.shots
// presence. Either signal is sufficient — output_assets is empty during
// 'planning' but shots[] is set as soon as the producer LLM returns,
// while in some failure modes shots[] may be empty but output_assets has
// MP4s from a partial render.
function isVideoPost(post: MarketingPost): boolean {
  if ((post.storyboard?.shots?.length ?? 0) > 0) return true;
  const assets = post.output_assets ?? {};
  for (const urls of Object.values(assets)) {
    if (Array.isArray(urls) && urls.some((u) => typeof u === "string" && /\.(mp4|webm|mov)(\?|$)/i.test(u))) {
      return true;
    }
  }
  return false;
}

// Pick the first MP4/webm URL from any channel. Producer renders
// per-aspect (1:1, 9:16) and assigns per channel — for an "is this good
// to ship?" preview, the first one is enough.
function getFirstVideoUrl(post: MarketingPost): string | null {
  const assets = post.output_assets ?? {};
  for (const urls of Object.values(assets)) {
    if (!Array.isArray(urls)) continue;
    for (const u of urls) {
      if (typeof u === "string" && /\.(mp4|webm|mov)(\?|$)/i.test(u)) return u;
    }
  }
  return null;
}

const STATUS_TONE: Record<string, string> = {
  planning: "bg-slate-500/10 text-slate-600 border-slate-500/20",
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
        .in("status", ["planning", "review_queue", "pending_approval", "approved", "rejected", "failed"])
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as MarketingPost[];
    },
    refetchInterval: (query) => {
      const data = query.state.data as MarketingPost[] | undefined;
      return (data ?? []).some((p) => p.status === "planning") ? 5000 : false;
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
      toast.success("Draft started", {
        description: `Topic: ${data.topic}. Producer running in background — the card will populate when ready (~30s for static, ~3min for video).`,
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
      if (next.status === "approved") {
        // Hard human-approval gate. The publisher (Socials side) refuses
        // to ship any post with approved_by IS NULL — defense against
        // AI auto-approval bypass. Capture the authenticated user id so
        // the row is audit-traceable to a real human click.
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId) {
          throw new Error(
            "approve: not authenticated — sign in again before approving",
          );
        }
        updates.approved_at = new Date().toISOString();
        updates.approved_by = userId;
      }
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

        {/* Render preview — video player for video posts, slide grid for static, fallback otherwise */}
        {isVideoPost(post) ? (
          <VideoPreview post={post} />
        ) : slides.length > 0 ? (
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
        ) : post.status === "planning" || post.status === "review_queue" ? (
          <div className="text-xs text-muted-foreground py-6 text-center border rounded-md border-dashed">
            No render yet — producer may still be processing.
          </div>
        ) : null}

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
        <OverseerChatPanel postId={post.id} />
      </CardContent>
    </Card>
  );
}

// Per-post chat with the Overseer agent. Phase 1: read-only conversation
// — Overseer reads the post + relevant settings (taste rubric, banned
// phrases, hook seeds, product framing) and returns concrete diagnoses
// + suggested rubric edits. The operator copies suggestions into the
// Settings page manually; no auto-apply yet (Phase 2 will add propose-
// approve cards). History persists per-post in localStorage so the
// conversation survives a page reload.
// Anthropic content block shapes. Plain string user messages get
// promoted to a single text block on send.
type ChatBlock =
  | { type: "text"; text: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
      // Local-only — tracks whether the operator has approved/rejected
      // this proposal. Persisted in localStorage so refreshes preserve it.
      _decision?: "pending" | "approved" | "rejected";
      _appliedAt?: string;
    }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

interface ChatMsg {
  role: "user" | "assistant";
  content: string | ChatBlock[];
}

function OverseerChatPanel({ postId }: { postId: string }) {
  const storageKey = `me-overseer-chat-${postId}`;
  const [open, setOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as ChatMsg[];
      }
    } catch {/* ignore */}
    return [];
  });
  const [draft, setDraft] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {/* ignore quota */}
  }, [messages, storageKey]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  // Send the next user turn (either fresh text or follow-up tool_results
  // after the operator has approved/rejected proposals).
  const sendMessages = async (next: ChatMsg[]) => {
    setMessages(next);
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "marketing-engine-overseer-chat",
        { body: { post_id: postId, messages: next } },
      );
      if (error) throw error;
      const ok = (data as { ok?: boolean }).ok;
      if (!ok) {
        throw new Error(
          (data as { error?: string }).error ?? "Overseer call failed",
        );
      }
      const responseContent = (data as { content?: ChatBlock[] }).content;
      const newAssistant: ChatMsg = {
        role: "assistant",
        content: Array.isArray(responseContent) ? responseContent : [],
      };
      setMessages([...next, newAssistant]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Overseer", { description: msg });
      setMessages([
        ...next,
        {
          role: "assistant",
          content: [{ type: "text", text: `*Error: ${msg}*` }],
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setDraft("");
    await sendMessages(next);
  };

  // Approve a proposed setting change: hit the apply endpoint, mark the
  // tool_use block as approved, append a tool_result block as the user's
  // next turn so Overseer knows the proposal was accepted.
  const approveProposal = async (
    msgIdx: number,
    blockIdx: number,
    block: Extract<ChatBlock, { type: "tool_use" }>,
  ) => {
    if (sending) return;
    if (block.name !== "propose_setting_change") {
      toast.error(`unknown tool: ${block.name}`);
      return;
    }
    const input = block.input as {
      setting_key?: string;
      new_value?: unknown;
      rationale?: string;
    };
    if (!input.setting_key || input.new_value === undefined) {
      toast.error("Invalid proposal");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "marketing-engine-overseer-apply-change",
        {
          body: {
            setting_key: input.setting_key,
            new_value: input.new_value,
            rationale: input.rationale ?? "(no rationale)",
            related_post_id: postId,
            source: "overseer",
          },
        },
      );
      if (error) throw error;
      if (!(data as { ok?: boolean }).ok) {
        throw new Error(
          (data as { error?: string }).error ?? "apply failed",
        );
      }
      // Mark the block as approved.
      const updated = messages.map((m, i): ChatMsg => {
        if (i !== msgIdx) return m;
        if (typeof m.content === "string") return m;
        return {
          ...m,
          content: m.content.map((b, j): ChatBlock => {
            if (j !== blockIdx) return b;
            if (b.type !== "tool_use") return b;
            return { ...b, _decision: "approved", _appliedAt: new Date().toISOString() };
          }),
        };
      });
      // Send tool_result as next user turn so Overseer can follow up.
      const next: ChatMsg[] = [
        ...updated,
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: block.id,
              content: `Applied. setting_key=${input.setting_key} updated successfully.`,
            },
          ],
        },
      ];
      toast.success(`Applied: ${input.setting_key}`);
      await sendMessages(next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Apply failed", { description: msg });
      setSending(false);
    }
  };

  const rejectProposal = (
    msgIdx: number,
    blockIdx: number,
    block: Extract<ChatBlock, { type: "tool_use" }>,
  ) => {
    const updated = messages.map((m, i): ChatMsg => {
      if (i !== msgIdx) return m;
      if (typeof m.content === "string") return m;
      return {
        ...m,
        content: m.content.map((b, j): ChatBlock => {
          if (j !== blockIdx) return b;
          if (b.type !== "tool_use") return b;
          return { ...b, _decision: "rejected" };
        }),
      };
    });
    // Optionally send a tool_result with is_error so Overseer knows
    // the operator rejected; let them follow up with another proposal.
    const next: ChatMsg[] = [
      ...updated,
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: block.id,
            content: "Rejected by operator. Suggest a different approach.",
            is_error: true,
          },
        ],
      },
    ];
    sendMessages(next);
  };

  const clearHistory = () => {
    setMessages([]);
    try { localStorage.removeItem(storageKey); } catch {/* ignore */}
  };

  return (
    <div className="border-t pt-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setOpen(!open)}
          className="text-xs flex items-center gap-1.5 text-purple-700 dark:text-purple-400 hover:underline"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {open ? "Hide" : "Discuss with"} Overseer
          {messages.length > 0 && (
            <Badge variant="outline" className="text-[10px] h-4 px-1 ml-1">
              {messages.length}
            </Badge>
          )}
        </button>
        {open && messages.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            clear history
          </button>
        )}
      </div>
      {open && (
        <div className="rounded border bg-muted/20 p-3 space-y-3">
          <div
            ref={scrollRef}
            className="max-h-[400px] overflow-y-auto space-y-3 text-sm"
          >
            {messages.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-6">
                Ask the Overseer about this post. Examples:
                <ul className="list-disc list-inside mt-2 text-left max-w-md mx-auto space-y-0.5">
                  <li>"the headline is generic — too similar to last week"</li>
                  <li>"caption uses 'unlock' which feels off-brand"</li>
                  <li>"hook is buried, the AutoListing pitch lands first"</li>
                  <li>"the visual is washed out / no contrast"</li>
                </ul>
              </div>
            ) : (
              messages.map((m, i) => {
                // Plain string user messages.
                if (typeof m.content === "string") {
                  return (
                    <div
                      key={i}
                      className={
                        m.role === "user"
                          ? "flex justify-end"
                          : "flex justify-start"
                      }
                    >
                      <div
                        className={
                          m.role === "user"
                            ? "max-w-[80%] rounded-lg px-3 py-2 bg-primary text-primary-foreground text-xs whitespace-pre-wrap"
                            : "max-w-[90%] rounded-lg px-3 py-2 bg-background border text-xs whitespace-pre-wrap"
                        }
                      >
                        {m.content}
                      </div>
                    </div>
                  );
                }
                // Content-block array (assistant + tool_result).
                return (
                  <div key={i} className="space-y-2">
                    {m.content.map((block, j) => {
                      if (block.type === "text") {
                        return (
                          <div
                            key={j}
                            className={
                              m.role === "user"
                                ? "flex justify-end"
                                : "flex justify-start"
                            }
                          >
                            <div
                              className={
                                m.role === "user"
                                  ? "max-w-[80%] rounded-lg px-3 py-2 bg-primary text-primary-foreground text-xs whitespace-pre-wrap"
                                  : "max-w-[90%] rounded-lg px-3 py-2 bg-background border text-xs whitespace-pre-wrap"
                              }
                            >
                              {block.text}
                            </div>
                          </div>
                        );
                      }
                      if (block.type === "tool_use") {
                        return (
                          <ProposalCard
                            key={j}
                            block={block}
                            onApprove={() => approveProposal(i, j, block)}
                            onReject={() => rejectProposal(i, j, block)}
                            disabled={sending}
                          />
                        );
                      }
                      if (block.type === "tool_result") {
                        // Confirmation that a tool ran. Don't show inline —
                        // the approve card already shows the decision.
                        return null;
                      }
                      return null;
                    })}
                  </div>
                );
              })
            )}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-lg px-3 py-2 bg-background border text-xs text-muted-foreground inline-flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Overseer thinking…
                </div>
              </div>
            )}
          </div>
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="What's wrong with this post?"
              className="min-h-[60px] text-sm flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={sending}
            />
            <Button
              size="sm"
              onClick={send}
              disabled={sending || !draft.trim()}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Phase 2: Overseer can propose settings changes inline — review the
            diff, click Approve to apply (audit-logged), or Reject to ask for
            something different. Cmd/Ctrl+Enter to send.
          </div>
        </div>
      )}
    </div>
  );
}

function VideoPreview({ post }: { post: MarketingPost }) {
  const videoUrl = getFirstVideoUrl(post);
  const thumbnails = post.render_thumbnails ?? [];
  const shots = post.storyboard?.shots ?? [];
  const voiceScript = post.storyboard?.voice_script;
  const totalDuration = shots.reduce((s, sh) => s + (sh.duration_s ?? 0), 0);

  // Detect aspect ratio from URL hint when possible — Remotion writes the
  // composition + aspect into the path. Falls back to landscape player
  // otherwise. Width capped so vertical 9:16 video doesn't blow out the
  // card layout.
  const isVertical = !!videoUrl && /9x16|9-16|vertical/i.test(videoUrl);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
        {videoUrl ? (
          <video
            controls
            preload="metadata"
            poster={thumbnails[0] ?? undefined}
            src={videoUrl}
            className={`rounded-md border bg-black ${isVertical ? "max-h-[480px]" : "max-h-[320px]"}`}
            style={{ aspectRatio: isVertical ? "9 / 16" : "16 / 9" }}
          />
        ) : (
          <div className="rounded-md border bg-muted aspect-video w-full max-w-md flex items-center justify-center text-xs text-muted-foreground">
            No rendered video URL yet
          </div>
        )}

        <div className="space-y-2 min-w-0">
          {totalDuration > 0 && (
            <div className="text-xs text-muted-foreground">
              {shots.length} shot{shots.length === 1 ? "" : "s"} · {totalDuration.toFixed(0)}s total
            </div>
          )}
          {voiceScript && (
            <div className="text-xs">
              <Label className="uppercase tracking-wide text-[10px]">Voice script</Label>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground line-clamp-6">
                {voiceScript}
              </p>
            </div>
          )}
        </div>
      </div>

      {thumbnails.length > 0 && (
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Thumbnails ({thumbnails.length})
          </Label>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {thumbnails.map((thumb, i) => (
              <img
                key={i}
                src={thumb}
                alt={`thumb ${i + 1}`}
                loading="lazy"
                className={`shrink-0 rounded border object-cover ${
                  isVertical ? "h-20 w-auto" : "h-16 w-auto"
                }`}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.opacity = "0.3";
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Renders a propose_setting_change tool_use block as an inline approve-
// reject card. Shows a compact diff so the operator can verify the
// change before applying. Approval invokes the apply edge function;
// rejection sends a tool_result back to Overseer so it can suggest
// something different.
function ProposalCard({
  block,
  onApprove,
  onReject,
  disabled,
}: {
  block: {
    id: string;
    name: string;
    input: Record<string, unknown>;
    _decision?: "pending" | "approved" | "rejected";
    _appliedAt?: string;
  };
  onApprove: () => void;
  onReject: () => void;
  disabled: boolean;
}) {
  const decision = block._decision ?? "pending";
  const input = block.input as {
    setting_key?: string;
    new_value?: unknown;
    rationale?: string;
  };
  const settingKey = input.setting_key ?? "(unknown)";
  const rationale = input.rationale ?? "";
  const newValue = input.new_value;
  const previewLines = describeNewValue(settingKey, newValue);

  if (decision === "approved") {
    return (
      <div className="rounded border border-emerald-500/40 bg-emerald-500/5 p-2 text-xs">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <Check className="h-3.5 w-3.5" />
          <span className="font-semibold">Applied:</span>
          <code>{settingKey}</code>
          {block._appliedAt && (
            <span className="text-muted-foreground ml-auto">
              {new Date(block._appliedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        {rationale && (
          <div className="mt-1 text-muted-foreground italic">{rationale}</div>
        )}
      </div>
    );
  }

  if (decision === "rejected") {
    return (
      <div className="rounded border border-rose-500/40 bg-rose-500/5 p-2 text-xs text-rose-700 dark:text-rose-400">
        <div className="flex items-center gap-2">
          <X className="h-3.5 w-3.5" />
          <span className="font-semibold">Rejected:</span>
          <code>{settingKey}</code>
        </div>
      </div>
    );
  }

  // Pending — render the approve/reject card.
  return (
    <div className="rounded border border-purple-500/40 bg-purple-500/5 p-3 text-xs">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-3.5 w-3.5 text-purple-700 dark:text-purple-400" />
        <span className="font-semibold text-purple-700 dark:text-purple-400">
          Proposed change:
        </span>
        <code className="text-[11px]">{settingKey}</code>
      </div>
      {rationale && (
        <div className="text-muted-foreground italic mb-2">{rationale}</div>
      )}
      <div className="rounded bg-muted/40 p-2 font-mono text-[10px] max-h-48 overflow-y-auto whitespace-pre-wrap break-words">
        {previewLines}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <Button
          size="sm"
          onClick={onApprove}
          disabled={disabled}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Check className="h-3.5 w-3.5 mr-1" /> Apply change
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onReject}
          disabled={disabled}
        >
          <X className="h-3.5 w-3.5 mr-1" /> Reject
        </Button>
      </div>
    </div>
  );
}

// Compact preview of the proposed new_value. Strings shown verbatim;
// arrays shown as numbered list with first-line preview.
function describeNewValue(key: string, value: unknown): string {
  if (value === undefined || value === null) return "(empty)";
  if (typeof value === "string") {
    if (value.length > 600) return value.slice(0, 600) + "…";
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "(empty array)";
    const lines: string[] = [`array · ${value.length} items`];
    for (const [i, item] of value.entries()) {
      if (i >= 30) {
        lines.push(`… and ${value.length - 30} more`);
        break;
      }
      if (typeof item === "string") {
        lines.push(`${i + 1}. ${item.slice(0, 200)}`);
      } else if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const text = String(o.text ?? "").slice(0, 120);
        const theme = o.theme ?? "";
        const kind = o.kind ?? "";
        lines.push(`${i + 1}. [${kind} · ${theme}] ${text}`);
      } else {
        lines.push(`${i + 1}. ${String(item).slice(0, 120)}`);
      }
    }
    return lines.join("\n");
  }
  try {
    return JSON.stringify(value, null, 2).slice(0, 1000);
  } catch {
    return "(unserializable)";
  }
  void key;
}
