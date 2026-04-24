import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAlChat, AlMessage } from "./useAlChat";
import { Markdown, parseAssistantMessage } from "./AlMarkdown";
import { AlFeedbackCard } from "./AlFeedbackCard";

const SUGGESTIONS_BY_ROUTE: Array<{ match: (path: string) => boolean; prompts: string[] }> = [
  {
    match: (p) => p.startsWith("/admin/listings"),
    prompts: [
      "How do I add a new listing?",
      "What's the difference between listing statuses?",
      "Why is my listing showing 'Awaiting Setup'?",
    ],
  },
  {
    match: (p) => p.startsWith("/admin/crm"),
    prompts: [
      "How do leads end up in my CRM?",
      "How do I move a lead through stages?",
      "Can I add notes to a lead?",
    ],
  },
  {
    match: (p) => p.startsWith("/admin/billing"),
    prompts: [
      "What's included in my plan?",
      "How do I upgrade?",
      "Why was I charged this amount?",
    ],
  },
  {
    match: (p) => p.startsWith("/admin/settings"),
    prompts: [
      "How do I set up a custom domain?",
      "How do I change my logo and colors?",
      "Where do I edit my service areas?",
    ],
  },
  {
    match: (p) => p.startsWith("/admin"),
    prompts: [
      "What can I do with Al?",
      "How do I add my first listing?",
      "What does the onboarding checklist do?",
    ],
  },
];

const DEFAULT_PROMPTS = [
  "What can I do with Al?",
  "How do I get started?",
  "Where do I find my leads?",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AlChatModal({ open, onOpenChange }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, isStreaming, error, meta, sendMessage, reset } = useAlChat({
    app: "listings",
    getRoute: () => location.pathname,
  });

  const suggestions =
    SUGGESTIONS_BY_ROUTE.find((s) => s.match(location.pathname))?.prompts ?? DEFAULT_PROMPTS;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const text = input;
    setInput("");
    await sendMessage(text);
  };

  const handleSuggestion = async (prompt: string) => {
    if (isStreaming) return;
    await sendMessage(prompt);
  };

  const handleNavigate = (path: string) => {
    // Don't auto-close — user can verify the navigation while panel stays open
    navigate(path);
  };

  return (
    <aside
      aria-label="Al chat panel"
      aria-hidden={!open}
      className={`fixed top-0 right-0 bottom-0 w-full sm:w-[420px] z-40 bg-background border-l shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
        open ? "translate-x-0" : "translate-x-full pointer-events-none"
      }`}
      data-testid="al-chat-panel"
    >
      <header className="px-4 py-3 border-b flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <h2 className="font-semibold text-sm truncate">Al — your AutoListing assistant</h2>
            {meta.remaining_month !== undefined && (
              <p className="text-[10px] text-muted-foreground">
                {meta.remaining_month} left this month
                {meta.remaining_today !== undefined && ` · ${meta.remaining_today} today`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={reset}
              disabled={isStreaming}
              title="New chat"
              className="h-8 w-8"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            title="Close"
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && (
          <EmptyState suggestions={suggestions} onPick={handleSuggestion} />
        )}
        {messages.map((m) => (
          <MessageRow key={m.id} message={m} onNavigate={handleNavigate} />
        ))}
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>

      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask Al anything about AutoListing…"
            className="min-h-[44px] max-h-[140px] resize-none text-sm"
            disabled={isStreaming}
          />
          <Button onClick={handleSend} disabled={!input.trim() || isStreaming} size="icon">
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
          Al may make mistakes. For sensitive issues, use Send Feedback in the sidebar.
        </p>
      </div>
    </aside>
  );
}

function EmptyState({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (s: string) => void;
}) {
  return (
    <div className="space-y-4 pt-4">
      <div className="text-center">
        <Sparkles className="h-8 w-8 text-primary mx-auto mb-2 opacity-60" />
        <h3 className="font-medium text-sm">Hi, I'm Al.</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Ask me about features, troubleshooting, or what's on your screen.
        </p>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground px-1">Try:</p>
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="block w-full text-left text-sm rounded-md border border-border bg-card hover:bg-accent px-3 py-2 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageRow({
  message,
  onNavigate,
}: {
  message: AlMessage;
  onNavigate: (path: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-3 py-2 text-sm whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  const parsed = parseAssistantMessage(message.content);
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-2">
        {parsed.segments.map((seg, i) => {
          if (seg.kind === "text") {
            const text = seg.text.trim();
            if (!text && !message.streaming) return null;
            return <Markdown key={i} text={text} onLinkClick={onNavigate} />;
          }
          return <AlFeedbackCard key={i} draft={seg.draft} />;
        })}
        {message.streaming && message.content.length === 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Thinking…
          </div>
        )}
      </div>
    </div>
  );
}
