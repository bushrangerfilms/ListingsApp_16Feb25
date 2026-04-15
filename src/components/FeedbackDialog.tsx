import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageCircle, Paperclip, X, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";

interface Attachment {
  name: string;
  type: string;
  base64: string;
  size: number;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file
const MAX_TOTAL_SIZE = 20 * 1024 * 1024; // 20MB total

export function FeedbackDialog() {
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<string>("idea");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { user } = useAuth();
  const { organization } = useOrganization();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: Attachment[] = [];
    let totalSize = attachments.reduce((sum, a) => sum + a.size, 0);

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File "${file.name}" exceeds 5MB limit`);
        continue;
      }

      if (totalSize + file.size > MAX_TOTAL_SIZE) {
        toast.error("Total attachment size exceeds 20MB limit");
        break;
      }

      try {
        const base64 = await fileToBase64(file);
        newAttachments.push({
          name: file.name,
          type: file.type,
          base64: base64,
          size: file.size,
        });
        totalSize += file.size;
      } catch (error) {
        console.error("Failed to read file:", error);
        toast.error(`Failed to read file "${file.name}"`);
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error("Please enter your feedback message");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-feedback", {
        body: {
          type: feedbackType,
          message: message.trim(),
          attachments: attachments.map((a) => ({
            filename: a.name,
            content: a.base64,
            type: a.type,
          })),
          userEmail: user?.email || "Unknown",
          organizationName: organization?.business_name || "Unknown",
          organizationSlug: organization?.slug || "Unknown",
          userAgent: navigator.userAgent,
          url: window.location.href,
        },
      });

      if (error) {
        throw error;
      }

      toast.success("Thank you! Your feedback has been sent.");
      setOpen(false);
      setMessage("");
      setAttachments([]);
      setFeedbackType("idea");
    } catch (error) {
      console.error("Failed to send feedback:", error);
      toast.error("Failed to send feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          data-testid="button-send-feedback"
        >
          <MessageCircle className="h-4 w-4" />
          <span>Send Feedback</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>
            Share your ideas, report bugs, or let us know how we can improve.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="feedback-type">Type</Label>
            <Select value={feedbackType} onValueChange={setFeedbackType}>
              <SelectTrigger id="feedback-type" data-testid="select-feedback-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="idea">Feature Idea</SelectItem>
                <SelectItem value="bug">Bug Report</SelectItem>
                <SelectItem value="improvement">Improvement</SelectItem>
                <SelectItem value="general">General Feedback</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-message">Message</Label>
            <Textarea
              id="feedback-message"
              placeholder="Tell us what's on your mind..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px] resize-none"
              data-testid="textarea-feedback-message"
            />
          </div>

          <div className="space-y-2">
            <Label>Attachments</Label>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.txt,.doc,.docx"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-feedback-attachments"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="w-fit"
                data-testid="button-attach-files"
              >
                <Paperclip className="h-4 w-4 mr-2" />
                Attach Files
              </Button>
              <p className="text-xs text-muted-foreground">
                Images, PDFs, or documents. Max 5MB per file, 20MB total.
              </p>
            </div>

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {attachments.map((attachment, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-muted px-2 py-1 rounded-md text-sm"
                  >
                    {attachment.type.startsWith("image/") ? (
                      <ImageIcon className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <Paperclip className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="truncate max-w-[150px]">{attachment.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({formatFileSize(attachment.size)})
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="text-muted-foreground hover:text-foreground"
                      data-testid={`button-remove-attachment-${index}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
            data-testid="button-cancel-feedback"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !message.trim()}
            data-testid="button-submit-feedback"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Feedback"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
