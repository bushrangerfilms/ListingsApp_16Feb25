import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AlRole = "user" | "assistant";

export interface AlMessage {
  id: string;
  role: AlRole;
  content: string;
  streaming?: boolean;
  has_image?: boolean;
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
}

interface SsePayload {
  event: string;
  data: any;
}

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/al-chat`;

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

export function useAlChat({ app, getRoute }: UseAlChatArgs) {
  const [messages, setMessages] = useState<AlMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<AlSendMeta>({});
  const conversationIdRef = useRef<string | undefined>(undefined);

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
    setMeta({});
    conversationIdRef.current = undefined;
  }, []);

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
            conversationIdRef.current = data.conversation_id;
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
    [app, getRoute, isStreaming]
  );

  return { messages, isStreaming, error, meta, sendMessage, reset };
}
