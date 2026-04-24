import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
  Paperclip,
  Image as ImageIcon,
  History,
  ChevronLeft,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  useAlChat,
  AlMessage,
  AlConversationSummary,
  listRecentConversations,
} from "./useAlChat";
import { Markdown, parseAssistantMessage } from "./AlMarkdown";
import { AlFeedbackCard } from "./AlFeedbackCard";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

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

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

interface AttachedImage {
  base64: string;
  media_type: string;
  preview_url: string;
  filename: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AlChatModal({ open, onOpenChange }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const [input, setInput] = useState("");
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [recentConversations, setRecentConversations] = useState<AlConversationSummary[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    messages,
    isStreaming,
    isLoadingHistory,
    error,
    meta,
    sendMessage,
    reset,
    loadConversation,
  } = useAlChat({
    app: "listings",
    getRoute: () => location.pathname,
    getOrganizationId: () => organization?.id,
  });

  const suggestions =
    SUGGESTIONS_BY_ROUTE.find((s) => s.match(location.pathname))?.prompts ?? DEFAULT_PROMPTS;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const refreshRecent = async () => {
    const list = await listRecentConversations(15);
    setRecentConversations(list);
  };

  useEffect(() => {
    if (showHistory) void refreshRecent();
  }, [showHistory]);

  const handleSend = async () => {
    if ((!input.trim() && !attachedImage) || isStreaming) return;
    const text = input.trim() || (attachedImage ? "What do you see in this screenshot?" : "");
    const imagePayload = attachedImage
      ? { image_base64: attachedImage.base64, image_media_type: attachedImage.media_type }
      : {};
    setInput("");
    clearAttachedImage();
    await sendMessage(text, imagePayload);
  };

  const handleSuggestion = async (prompt: string) => {
    if (isStreaming) return;
    await sendMessage(prompt);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const handleImageFile = async (file: File) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Only PNG, JPEG, GIF or WebP images are supported");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error("Image must be under 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      setAttachedImage({
        base64,
        media_type: file.type,
        preview_url: dataUrl,
        filename: file.name,
      });
    };
    reader.onerror = () => toast.error("Failed to read image");
    reader.readAsDataURL(file);
  };

  const clearAttachedImage = () => {
    setAttachedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          void handleImageFile(file);
          return;
        }
      }
    }
  };

  const handlePickConversation = async (id: string) => {
    setShowHistory(false);
    await loadConversation(id);
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
        {showHistory ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowHistory(false)}
              className="h-8 w-8"
              title="Back"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="font-semibold text-sm flex-1 text-center">Recent chats</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              title="Close"
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowHistory(true)}
                title="Recent chats"
                className="h-8 w-8"
              >
                <History className="h-3.5 w-3.5" />
              </Button>
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
          </>
        )}
      </header>

      {showHistory ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {recentConversations.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No previous chats yet.
            </p>
          )}
          {recentConversations.map((c) => (
            <button
              key={c.id}
              onClick={() => handlePickConversation(c.id)}
              className="block w-full text-left rounded-md border border-border bg-card hover:bg-accent px-3 py-2 transition-colors"
            >
              <p className="text-sm truncate">{c.preview}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {isLoadingHistory && messages.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoadingHistory && messages.length === 0 && (
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
      )}

      {!showHistory && (
        <div className="border-t p-3">
          {attachedImage && (
            <div className="mb-2 flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
              <img
                src={attachedImage.preview_url}
                alt="attachment"
                className="h-12 w-12 object-cover rounded"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{attachedImage.filename}</p>
                <p className="text-[10px] text-muted-foreground">
                  Will use enhanced model for image understanding
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={clearAttachedImage}
                className="h-6 w-6 shrink-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImageFile(file);
              }}
              className="hidden"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              title="Attach screenshot"
              disabled={isStreaming || !!attachedImage}
              className="shrink-0"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                attachedImage
                  ? "Add a question (or send to ask 'what do you see?')"
                  : "Ask Al anything about AutoListing… (paste an image to attach)"
              }
              className="min-h-[44px] max-h-[140px] resize-none text-sm"
              disabled={isStreaming}
            />
            <Button
              onClick={handleSend}
              disabled={(!input.trim() && !attachedImage) || isStreaming}
              size="icon"
              className="shrink-0"
            >
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
      )}
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
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-3 py-2 text-sm">
          {message.has_image && (
            <div className="flex items-center gap-1 text-[10px] opacity-80 mb-1">
              <Paperclip className="h-3 w-3" />
              <span>Image attached</span>
            </div>
          )}
          <span className="whitespace-pre-wrap">{message.content}</span>
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
