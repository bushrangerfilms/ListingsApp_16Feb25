import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AlRole = "user" | "assistant";

export interface AlMessage {
  id: string;
  role: AlRole;
  content: string;
  streaming?: boolean;
  has_image?: boolean;
}

export interface AlConversationSummary {
  id: string;
  title: string | null;
  app: "listings" | "socials";
  last_message_at: string;
  preview: string;
}

export interface AlSendMeta {
  remaining_today?: number;
  remaining_month?: number;
  cost_usd?: number;
  latency_ms?: number;
}

export interface UseAlChatArgs {
  app: "listings" | "socials";
  getRoute: () => string;
  getOrganizationId: () => string | undefined;
}

interface SsePayload {
  event: string;
  data: any;
}

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/al-chat`;
// Shared across both subdomains — one active conversation per user, regardless
// of where they opened the panel. The user experiences AutoListing as a single
// product, so the chat thread follows them across the Socials / main-area split.
const ACTIVE_CONVERSATION_KEY = "al_chat_active_conversation";

async function* parseSse(response: Response): AsyncGenerator<SsePayload> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const block of events) {
      if (!block.trim()) continue;
      let event = "message";
      let dataStr = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7).trim();
        else if (line.startsWith("data: ")) dataStr += line.slice(6);
      }
      if (!dataStr) continue;
      try {
        yield { event, data: JSON.parse(dataStr) };
      } catch {
        // ignore malformed
      }
    }
  }
}

export function useAlChat({ app, getRoute, getOrganizationId }: UseAlChatArgs) {
  const [messages, setMessages] = useState<AlMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<AlSendMeta>({});
  const [conversationId, setConversationIdState] = useState<string | undefined>(undefined);
  const conversationIdRef = useRef<string | undefined>(undefined);

  const setConversationId = useCallback(
    (id: string | undefined) => {
      conversationIdRef.current = id;
      setConversationIdState(id);
      if (typeof window !== "undefined") {
        if (id) window.localStorage.setItem(ACTIVE_CONVERSATION_KEY, id);
        else window.localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
      }
    },
    [app]
  );

  const loadConversation = useCallback(
    async (id: string): Promise<boolean> => {
      setIsLoadingHistory(true);
      setError(null);
      try {
        const { data, error: dbError } = await supabase
          .from("al_messages")
          .select("id, role, content, created_at")
          .eq("conversation_id", id)
          .order("created_at", { ascending: true });
        if (dbError) throw dbError;
        if (!data || data.length === 0) {
          // Conversation is gone or empty — clear stored ID
          setConversationId(undefined);
          setMessages([]);
          return false;
        }
        setMessages(
          data.map((m) => ({
            id: m.id,
            role: m.role as AlRole,
            content: m.content,
          }))
        );
        setConversationId(id);
        return true;
      } catch (e: any) {
        console.warn("[al-chat] failed to load conversation history:", e?.message);
        setConversationId(undefined);
        setMessages([]);
        return false;
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [setConversationId]
  );

  // On mount, restore the active conversation. We prefer the `al_conv` URL
  // param (set by cross-subdomain links AL generates) over localStorage
  // because localStorage is scoped per-subdomain and won't have the ID after
  // a cross-subdomain navigation. The URL param strips itself after use so
  // it doesn't stick in the browser history.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const urlConvId = urlParams.get("al_conv");
    const stored = window.localStorage.getItem(ACTIVE_CONVERSATION_KEY);
    const convId = urlConvId || stored;

    if (urlConvId) {
      // Strip our param from the URL without adding a history entry.
      const cleaned = new URL(window.location.href);
      cleaned.searchParams.delete("al_conv");
      window.history.replaceState({}, "", cleaned.toString());
    }

    if (convId) {
      void loadConversation(convId);
    }
    // Deliberately only runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
    setMeta({});
    setConversationId(undefined);
  }, [setConversationId]);

  const sendMessage = useCallback(
    async (
      text: string,
      opts: { image_base64?: string; image_media_type?: string } = {}
    ) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      setError(null);
      setIsStreaming(true);

      const userMsg: AlMessage = {
        id: `local-user-${Date.now()}`,
        role: "user",
        content: trimmed,
        has_image: !!opts.image_base64,
      };
      const assistantMsgId = `local-assistant-${Date.now()}`;
      const assistantMsg: AlMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        streaming: true,
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) throw new Error("Not signed in");

        const route = getRoute();
        const organizationId = getOrganizationId();

        const response = await fetch(FUNCTION_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversation_id: conversationIdRef.current,
            message: trimmed,
            app,
            route,
            organization_id: organizationId,
            image_base64: opts.image_base64,
            image_media_type: opts.image_media_type,
          }),
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || `Request failed (${response.status})`);
        }

        for await (const { event, data } of parseSse(response)) {
          if (event === "start") {
            setConversationId(data.conversation_id);
            setMeta({
              remaining_today: data.remaining_today,
              remaining_month: data.remaining_month,
            });
          } else if (event === "delta") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: m.content + data.text } : m
              )
            );
          } else if (event === "done") {
            setMeta((prev) => ({
              ...prev,
              cost_usd: data.cost_usd,
              latency_ms: data.latency_ms,
            }));
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, streaming: false } : m))
            );
          } else if (event === "error") {
            throw new Error(data.message || "Streaming error");
          }
        }
      } catch (e: any) {
        setError(e?.message ?? "Failed to send message");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: m.content || "(error — see message above)", streaming: false }
              : m
          )
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [app, getRoute, getOrganizationId, isStreaming, setConversationId]
  );

  return {
    messages,
    isStreaming,
    isLoadingHistory,
    error,
    meta,
    conversationId,
    sendMessage,
    reset,
    loadConversation,
  };
}

// ============================================================================
// Recent conversations list — for the picker dropdown
// ============================================================================

// Lists the user's recent conversations across BOTH apps. The `app` field on
// each row tells the caller where the conversation started so it can render a
// badge, but no filter is applied here.
export async function listRecentConversations(
  limit = 15
): Promise<AlConversationSummary[]> {
  const { data: convs, error: convErr } = await supabase
    .from("al_conversations")
    .select("id, title, app, last_message_at")
    .order("last_message_at", { ascending: false })
    .limit(limit);
  if (convErr || !convs) return [];

  // Fetch the first user message of each conversation as a preview
  const ids = convs.map((c) => c.id);
  if (ids.length === 0) return [];
  const { data: previews } = await supabase
    .from("al_messages")
    .select("conversation_id, content, role, created_at")
    .in("conversation_id", ids)
    .eq("role", "user")
    .order("created_at", { ascending: true });

  const previewByConv = new Map<string, string>();
  for (const m of previews ?? []) {
    if (!previewByConv.has(m.conversation_id)) {
      previewByConv.set(m.conversation_id, m.content);
    }
  }

  return convs.map((c) => ({
    id: c.id,
    title: c.title,
    app: c.app,
    last_message_at: c.last_message_at,
    preview: previewByConv.get(c.id)?.slice(0, 80) ?? "(empty)",
  }));
}
