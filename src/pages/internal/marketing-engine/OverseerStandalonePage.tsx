// Standalone Overseer page — cross-post strategy chat + setting-change history.
//
// Distinct from the per-post chat panel on the Approval Queue:
//   - No post_id sent to the edge function → cross-post mode (recent
//     posts + engagement summary loaded into system prompt)
//   - Persistent chat history per super-admin user (localStorage keyed
//     by 'me-overseer-standalone-chat-v1' so it's the same across page
//     loads but distinct from per-post chats)
//   - Side panel listing recent setting_changes (audit trail) so the
//     operator can see the cumulative effect of past Overseer sessions
//
// Same propose_setting_change tool-use flow as the per-post chat:
//   - Overseer calls tool → renders inline approve/reject card
//   - Approve → marketing-engine-overseer-apply-change → audit row
//
// Phase 3 successor candidates (TBD):
//   - Stream responses via SSE (currently non-streaming)
//   - Persist chat to DB (currently localStorage only)
//   - "Re-trigger producer for post X" tool (regenerate based on
//     conversation context)

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  Send,
  Loader2,
  Check,
  X,
  History,
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "me-overseer-standalone-chat-v1";

type ChatBlock =
  | { type: "text"; text: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
      _decision?: "pending" | "approved" | "rejected";
      _appliedAt?: string;
    }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

interface ChatMsg {
  role: "user" | "assistant";
  content: string | ChatBlock[];
}

interface SettingChange {
  id: string;
  setting_key: string;
  applied_at: string;
  rationale: string | null;
  source: string;
  related_post_id: string | null;
  applied_by: string | null;
}

export default function OverseerStandalonePage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as ChatMsg[];
      }
    } catch { /* ignore */ }
    return [];
  });
  const [draft, setDraft] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch { /* ignore quota */ }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const { data: changeHistory, refetch: refetchHistory } = useQuery<SettingChange[]>({
    queryKey: ["me-setting-change-history"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_engine_setting_changes")
        .select("id, setting_key, applied_at, rationale, source, related_post_id, applied_by")
        .order("applied_at", { ascending: false })
        .limit(30);
      return (data ?? []) as SettingChange[];
    },
    refetchInterval: 30_000,
  });

  const sendMessages = async (next: ChatMsg[]) => {
    setMessages(next);
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "marketing-engine-overseer-chat",
        { body: { messages: next } }, // post_id omitted = cross-post mode
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

  const approveProposal = async (
    msgIdx: number,
    blockIdx: number,
    block: Extract<ChatBlock, { type: "tool_use" }>,
  ) => {
    if (sending || block.name !== "propose_setting_change") return;
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
            source: "overseer",
          },
        },
      );
      if (error) throw error;
      if (!(data as { ok?: boolean }).ok) {
        throw new Error((data as { error?: string }).error ?? "apply failed");
      }
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
      refetchHistory();
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
    if (!confirm("Clear chat history? Setting changes already applied are not reverted.")) {
      return;
    }
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

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
            <Sparkles className="h-7 w-7 text-purple-700 dark:text-purple-400" />
            Overseer
            <Badge variant="outline">cross-post strategy</Badge>
          </h1>
          <p className="text-muted-foreground mt-1">
            Discuss patterns across recent posts. Propose changes to taste rubric, banned phrases, hook seed library, reviewer thresholds. Approve to apply (audit-logged).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Chat</CardTitle>
              {messages.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  clear
                </button>
              )}
            </div>
            <CardDescription>
              Examples: "captions all start the same way lately", "ban 'unlock'", "the promise hook isn't landing — try more stat hooks", "we should push self-serve harder, not demos"
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 flex-1">
            <div
              ref={scrollRef}
              className="flex-1 max-h-[60vh] overflow-y-auto space-y-3 text-sm border rounded p-3 bg-muted/10"
            >
              {messages.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-12">
                  <Sparkles className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  Ask the Overseer about engine-wide patterns. It loads the last 30 days of posts plus the current rubric and proposes settings changes inline.
                </div>
              ) : (
                messages.map((m, i) => {
                  if (typeof m.content === "string") {
                    return (
                      <MessageBubble key={i} role={m.role} text={m.content} />
                    );
                  }
                  return (
                    <div key={i} className="space-y-2">
                      {m.content.map((block, j) => {
                        if (block.type === "text") {
                          return (
                            <MessageBubble key={j} role={m.role} text={block.text} />
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
                placeholder="What pattern have you noticed?"
                className="min-h-[80px] text-sm flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    send();
                  }
                }}
                disabled={sending}
              />
              <Button onClick={send} disabled={sending || !draft.trim()}>
                <Send className="h-4 w-4 mr-1" /> Send
              </Button>
            </div>
            <div className="text-[10px] text-muted-foreground">
              Cmd/Ctrl+Enter to send. Tool-use approve cards appear inline; approving applies the change immediately and writes an audit row.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              Recent setting changes
            </CardTitle>
            <CardDescription>
              Audit trail of every Overseer-applied + manual change.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!changeHistory || changeHistory.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-6">
                No changes yet.
              </div>
            ) : (
              <div className="space-y-2">
                {changeHistory.map((c) => (
                  <div
                    key={c.id}
                    className="border rounded p-2 text-xs space-y-1"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-[11px]">{c.setting_key}</code>
                      <Badge
                        variant="outline"
                        className={
                          c.source === "overseer"
                            ? "text-[10px] h-4 px-1 text-purple-700 dark:text-purple-400 border-purple-500/30"
                            : "text-[10px] h-4 px-1"
                        }
                      >
                        {c.source}
                      </Badge>
                      {c.related_post_id && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                          post-scoped
                        </Badge>
                      )}
                    </div>
                    {c.rationale && (
                      <div className="text-muted-foreground italic line-clamp-2">
                        {c.rationale}
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(c.applied_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MessageBubble({
  role,
  text,
}: {
  role: "user" | "assistant";
  text: string;
}) {
  return (
    <div
      className={role === "user" ? "flex justify-end" : "flex justify-start"}
    >
      <div
        className={
          role === "user"
            ? "max-w-[80%] rounded-lg px-3 py-2 bg-primary text-primary-foreground text-xs whitespace-pre-wrap"
            : "max-w-[90%] rounded-lg px-3 py-2 bg-background border text-xs whitespace-pre-wrap"
        }
      >
        {text}
      </div>
    </div>
  );
}

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
  const previewLines = describeNewValue(input.new_value);

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

function describeNewValue(value: unknown): string {
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
}
