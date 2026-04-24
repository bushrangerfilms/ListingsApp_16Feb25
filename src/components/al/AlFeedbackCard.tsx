import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, X, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import type { ParsedFeedbackDraft } from "./AlMarkdown";

const TYPE_LABELS: Record<ParsedFeedbackDraft["type"], string> = {
  idea: "Feature Idea",
  bug: "Bug Report",
  improvement: "Improvement",
  general: "General Feedback",
};

const TYPE_COLORS: Record<ParsedFeedbackDraft["type"], string> = {
  idea: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  bug: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  improvement: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  general: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

interface Props {
  draft: ParsedFeedbackDraft;
}

export function AlFeedbackCard({ draft }: Props) {
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState(draft.message);
  const [type, setType] = useState<ParsedFeedbackDraft["type"]>(draft.type);
  const [submitting, setSubmitting] = useState(false);
  const [submittedAs, setSubmittedAs] = useState<"sent" | "cancelled" | null>(null);

  const { user } = useAuth();
  const { organization } = useOrganization();

  if (submittedAs === "sent") {
    return (
      <div className="my-2 rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-3 text-sm text-green-900 dark:text-green-100">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4" />
          <span>Feedback sent to the team. Thanks!</span>
        </div>
      </div>
    );
  }
  if (submittedAs === "cancelled") {
    return (
      <div className="my-2 rounded-lg border border-muted bg-muted/30 p-3 text-xs text-muted-foreground">
        Feedback draft cancelled.
      </div>
    );
  }

  const send = async () => {
    if (!message.trim()) {
      toast.error("Message is required");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("send-feedback", {
        body: {
          type,
          message: message.trim(),
          attachments: [],
          userEmail: user?.email || "Unknown",
          organizationName: organization?.business_name || "Unknown",
          organizationSlug: organization?.slug || "Unknown",
          userAgent: navigator.userAgent,
          url: window.location.href,
        },
      });
      if (error) throw error;
      setSubmittedAs("sent");
    } catch (e: any) {
      console.error("Failed to send feedback via AL:", e);
      toast.error(e?.message ?? "Failed to send feedback");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="my-2 rounded-lg border border-border bg-card p-3 text-sm">
      <div className="flex items-center justify-between mb-2">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[type]}`}
        >
          {TYPE_LABELS[type]}
        </span>
        <span className="text-xs text-muted-foreground">Draft feedback</span>
      </div>

      {editing ? (
        <div className="space-y-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ParsedFeedbackDraft["type"])}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            {(Object.keys(TYPE_LABELS) as ParsedFeedbackDraft["type"][]).map((k) => (
              <option key={k} value={k}>
                {TYPE_LABELS[k]}
              </option>
            ))}
          </select>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[80px] text-sm"
          />
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-foreground">{message}</p>
      )}

      <div className="mt-3 flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSubmittedAs("cancelled")}
          disabled={submitting}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Cancel
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditing((v) => !v)}
          disabled={submitting}
        >
          <Pencil className="h-3.5 w-3.5 mr-1" />
          {editing ? "Done" : "Edit"}
        </Button>
        <Button size="sm" onClick={send} disabled={submitting || !message.trim()}>
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              Sending
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5 mr-1" />
              Send
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
