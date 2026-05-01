import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Megaphone, Plus, Send, Eye, Pencil, Trash2, X, ArrowLeft, Users, Upload, FileSpreadsheet } from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { adminApi, BroadcastCampaign, BroadcastCampaignInput, BroadcastCampaignDetail } from "@/lib/admin/adminApi";
import { useSuperAdminPermissions } from '@/hooks/useSuperAdminPermissions';
import { useToast } from "@/hooks/use-toast";

const PLAN_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "essentials", label: "Essentials" },
  { value: "growth", label: "Growth" },
  { value: "professional", label: "Professional" },
  { value: "multi_branch_s", label: "Multi-Branch S" },
  { value: "multi_branch_m", label: "Multi-Branch M" },
  { value: "multi_branch_l", label: "Multi-Branch L" },
];

const COUNTRY_OPTIONS = [
  { value: "IE", label: "Ireland" },
  { value: "GB", label: "United Kingdom" },
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "AU", label: "Australia" },
  { value: "NZ", label: "New Zealand" },
];

const STATUS_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "active", label: "Active" },
  { value: "trial", label: "Trial" },
  { value: "suspended", label: "Suspended" },
];

const ENGAGEMENT_OPTIONS = [
  { value: "no_listings", label: "No listings yet" },
  { value: "onboarding_incomplete", label: "Onboarding incomplete" },
];

type View = "list" | "compose" | "detail";

type ParsedExternalRow = { email: string; name?: string };

// Parse an XLSX/CSV contact file into { email, name } rows.
//
// Two formats are supported:
//   - **Plain contact list** — one row per contact. Looked up by an "email" /
//     "email address" / "e-mail" column with optional name columns.
//   - **Inbox / thread export** (e.g. PlusVibe inbox export) — many rows per
//     thread + per message, with `Direction` (IN/OUT) and `From Email` columns.
//     We filter to `Direction = IN` rows so we only pull the lead's address
//     (the thread-header `Thread From Email` often holds OUR outbound sender).
//
// Email-column lookup also skips obvious non-address fields like "Email ID",
// "Email Date", "Email Account ID" — words that contain "email" but aren't
// the address itself.
async function parseContactFile(file: File): Promise<{ rows: ParsedExternalRow[]; rawCount: number }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) return { rows: [], rawCount: 0 };

  const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
  if (json.length === 0) return { rows: [], rawCount: 0 };

  const columns = Object.keys(json[0]).map((k) => ({ raw: k, key: k.trim().toLowerCase() }));

  const directionCol = columns.find((c) => c.key === "direction");

  // Filter out columns that contain "email" but aren't actual addresses
  // (Email ID, Email Date, Email Account ID, Email Subject, Email Status, …).
  const isAddressColumn = (key: string) => {
    if (!key.includes("email") && !key.includes("e-mail")) return false;
    return !/\b(id|date|account|subject|status|count|category|client|type|template)\b/.test(key);
  };

  // Inbox exports: per-message "From Email" is the lead's address on incoming rows.
  // Plain contact lists: just "Email" / "Email Address" / "E-mail".
  const emailCol =
    columns.find((c) => c.key === "email" || c.key === "email address" || c.key === "e-mail")
    ?? (directionCol ? columns.find((c) => c.key === "from email") : undefined)
    ?? columns.find((c) => c.key === "from email" || c.key === "thread from email")
    ?? columns.find((c) => isAddressColumn(c.key));
  if (!emailCol) return { rows: [], rawCount: json.length };

  const firstNameCol = columns.find((c) => c.key === "first name" || c.key === "firstname" || c.key === "first_name");
  const lastNameCol = columns.find((c) => c.key === "last name" || c.key === "lastname" || c.key === "last_name");
  const fullNameCol = columns.find((c) => c.key === "name" || c.key === "full name" || c.key === "fullname" || c.key === "full_name" || c.key === "contact name");
  // "From" column on inbox exports holds 'Display Name <email>'; we strip the email.
  const fromCol = columns.find((c) => c.key === "from");

  const extractDisplayName = (raw: string): string | undefined => {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const m = trimmed.match(/^"?([^<"]+?)"?\s*<[^>]+>\s*$/);
    if (m) return m[1].trim() || undefined;
    if (trimmed.includes("@")) return undefined;
    return trimmed;
  };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const out: ParsedExternalRow[] = [];
  for (const row of json) {
    if (directionCol) {
      const direction = String(row[directionCol.raw] || "").trim().toUpperCase();
      if (direction !== "IN") continue;
    }

    const email = String(row[emailCol.raw] || "").trim();
    if (!email || !emailRegex.test(email)) continue;

    let name: string | undefined;
    if (fullNameCol) name = String(row[fullNameCol.raw] || "").trim() || undefined;
    if (!name && (firstNameCol || lastNameCol)) {
      const fn = firstNameCol ? String(row[firstNameCol.raw] || "").trim() : "";
      const ln = lastNameCol ? String(row[lastNameCol.raw] || "").trim() : "";
      const composed = `${fn} ${ln}`.trim();
      name = composed || undefined;
    }
    if (!name && fromCol) {
      name = extractDisplayName(String(row[fromCol.raw] || ""));
    }

    out.push({ email, name });
  }
  return { rows: out, rawCount: json.length };
}

export default function BroadcastsPage() {
  const { hasSuperAdminAccess, loading: authLoading } = useSuperAdminPermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [view, setView] = useState<View>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Recipient review dialog state
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewCampaignId, setReviewCampaignId] = useState<string | null>(null);
  const [excludedEmails, setExcludedEmails] = useState<Set<string>>(new Set());

  // Compose form state
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [filterPlans, setFilterPlans] = useState<string[]>([]);
  const [filterCountries, setFilterCountries] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterEngagement, setFilterEngagement] = useState<string[]>([]);
  const [previewTab, setPreviewTab] = useState<string>("edit");

  // External (uploaded) recipients — for new compose, parsed rows are held in
  // local state until the draft is saved. For an existing draft, they live on
  // the server and are fetched via externalRecipients.list.
  const [pendingExternalRows, setPendingExternalRows] = useState<ParsedExternalRow[]>([]);
  const [pendingExternalFilename, setPendingExternalFilename] = useState<string | null>(null);
  const [uploadParsing, setUploadParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // List query
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["admin", "broadcasts"],
    queryFn: () => adminApi.broadcasts.list(),
    enabled: !authLoading && hasSuperAdminAccess,
  });

  // Detail query
  const { data: campaignDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["admin", "broadcasts", detailId],
    queryFn: () => adminApi.broadcasts.get(detailId!),
    enabled: !!detailId && view === "detail",
  });

  // Audience count
  const audienceFilters = {
    ...(filterPlans.length > 0 ? { plans: filterPlans } : {}),
    ...(filterCountries.length > 0 ? { countries: filterCountries } : {}),
    ...(filterStatuses.length > 0 ? { account_statuses: filterStatuses } : {}),
    ...(filterEngagement.length > 0 ? { engagement: filterEngagement } : {}),
  };

  const { data: audienceData } = useQuery({
    queryKey: ["admin", "broadcasts", "audience-count", editingId, audienceFilters],
    queryFn: () => adminApi.broadcasts.audienceCount(audienceFilters, editingId || undefined),
    enabled: view === "compose" && !authLoading && hasSuperAdminAccess,
  });

  // External (uploaded) recipients for an existing draft — fetched server-side.
  const { data: externalData } = useQuery({
    queryKey: ["admin", "broadcasts", editingId, "external-recipients"],
    queryFn: () => adminApi.broadcasts.externalRecipients.list(editingId!),
    enabled: view === "compose" && !!editingId,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: BroadcastCampaignInput) => adminApi.broadcasts.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "broadcasts"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BroadcastCampaignInput> }) =>
      adminApi.broadcasts.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "broadcasts"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: ({ id, excluded }: { id: string; excluded: string[] }) =>
      adminApi.broadcasts.send(id, excluded),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "broadcasts"] });
      toast({ title: "Broadcast sent", description: `Sent to ${result.total_sent} recipients` });
      setReviewDialogOpen(false);
      setReviewCampaignId(null);
      setExcludedEmails(new Set());
    },
    onError: (err: Error) => {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    },
  });

  const addExternalMutation = useMutation({
    mutationFn: ({ campaignId, rows }: { campaignId: string; rows: ParsedExternalRow[] }) =>
      adminApi.broadcasts.externalRecipients.add(campaignId, rows),
    onSuccess: (result, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "broadcasts", vars.campaignId, "external-recipients"],
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "broadcasts", "audience-count"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "broadcasts", "audience-preview"] });
      toast({
        title: "Upload complete",
        description: `Added ${result.inserted} contact${result.inserted === 1 ? "" : "s"}${
          result.skipped_invalid > 0 ? ` (${result.skipped_invalid} invalid email${result.skipped_invalid === 1 ? "" : "s"} skipped)` : ""
        }.`,
      });
    },
    onError: (err: Error) =>
      toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  const clearExternalMutation = useMutation({
    mutationFn: (campaignId: string) => adminApi.broadcasts.externalRecipients.clear(campaignId),
    onSuccess: (_result, campaignId) => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "broadcasts", campaignId, "external-recipients"],
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "broadcasts", "audience-count"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "broadcasts", "audience-preview"] });
      toast({ title: "Uploaded list cleared" });
    },
    onError: (err: Error) =>
      toast({ title: "Clear failed", description: err.message, variant: "destructive" }),
  });

  // Load recipient preview when review dialog opens.
  // In compose mode, use the in-flight audienceFilters; when reviewing an existing
  // campaign, use that campaign's saved filters.
  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: [
      "admin",
      "broadcasts",
      "audience-preview",
      reviewCampaignId || "compose",
      audienceFilters,
    ],
    queryFn: async () => {
      if (reviewCampaignId) {
        const campaign = campaigns?.find((c) => c.id === reviewCampaignId);
        if (campaign) {
          return adminApi.broadcasts.audiencePreview(campaign.audience_filters || {}, reviewCampaignId);
        }
      }
      return adminApi.broadcasts.audiencePreview(audienceFilters, editingId || undefined);
    },
    enabled: reviewDialogOpen,
  });

  function openReviewDialog(campaignId: string | null, keepExclusions = false) {
    setReviewCampaignId(campaignId);
    if (!keepExclusions) setExcludedEmails(new Set());
    setReviewDialogOpen(true);
  }

  function toggleExclude(email: string) {
    setExcludedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.broadcasts.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "broadcasts"] });
      toast({ title: "Broadcast deleted" });
      setConfirmDeleteId(null);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => adminApi.broadcasts.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "broadcasts"] });
      toast({ title: "Broadcast cancelled" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function resetForm() {
    setSubject("");
    setBodyHtml("");
    setPreviewText("");
    setFilterPlans([]);
    setFilterCountries([]);
    setFilterStatuses([]);
    setFilterEngagement([]);
    setExcludedEmails(new Set());
    setEditingId(null);
    setPreviewTab("edit");
    setPendingExternalRows([]);
    setPendingExternalFilename(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadParsing(true);
    try {
      const { rows, rawCount } = await parseContactFile(file);
      if (rows.length === 0) {
        toast({
          title: "No emails found",
          description: rawCount === 0
            ? "The file appears to be empty."
            : "Couldn't find an email column. The file needs a column named 'email' (or similar).",
          variant: "destructive",
        });
        return;
      }
      if (editingId) {
        // Existing draft — upload immediately to the server.
        addExternalMutation.mutate({ campaignId: editingId, rows });
      } else {
        // No draft yet — hold rows in state. They'll be flushed on Save Draft / Send.
        setPendingExternalRows(rows);
        setPendingExternalFilename(file.name);
        toast({
          title: "File parsed",
          description: `${rows.length} contact${rows.length === 1 ? "" : "s"} ready. Save the draft to upload them.`,
        });
      }
    } catch (err: any) {
      toast({ title: "Parse failed", description: err?.message || "Unable to read file", variant: "destructive" });
    } finally {
      setUploadParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleClearExternal() {
    if (editingId) {
      clearExternalMutation.mutate(editingId);
    } else {
      setPendingExternalRows([]);
      setPendingExternalFilename(null);
    }
  }

  function openCompose(campaign?: BroadcastCampaign) {
    if (campaign) {
      setEditingId(campaign.id);
      setSubject(campaign.subject);
      setBodyHtml(campaign.body_html);
      setPreviewText(campaign.preview_text || "");
      setFilterPlans(campaign.audience_filters?.plans || []);
      setFilterCountries(campaign.audience_filters?.countries || []);
      setFilterStatuses(campaign.audience_filters?.account_statuses || []);
      setFilterEngagement(campaign.audience_filters?.engagement || []);
    } else {
      resetForm();
    }
    setView("compose");
  }

  function handleSaveDraft() {
    if (!subject.trim() || !bodyHtml.trim()) {
      toast({ title: "Subject and body are required", variant: "destructive" });
      return;
    }

    const data: BroadcastCampaignInput = {
      subject,
      body_html: bodyHtml,
      preview_text: previewText || undefined,
      audience_filters: audienceFilters,
    };

    const finish = () => {
      toast({ title: editingId ? "Draft updated" : "Draft saved" });
      resetForm();
      setView("list");
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data }, { onSuccess: finish });
    } else {
      createMutation.mutate(data, {
        onSuccess: (created) => {
          if (pendingExternalRows.length > 0) {
            addExternalMutation.mutate(
              { campaignId: created.id, rows: pendingExternalRows },
              { onSuccess: finish, onError: finish },
            );
          } else {
            finish();
          }
        },
      });
    }
  }

  function handleSaveAndSend() {
    if (!subject.trim() || !bodyHtml.trim()) {
      toast({ title: "Subject and body are required", variant: "destructive" });
      return;
    }

    // If editing, save first then open review dialog
    if (editingId) {
      const data: Partial<BroadcastCampaignInput> = {
        subject,
        body_html: bodyHtml,
        preview_text: previewText || undefined,
        audience_filters: audienceFilters,
      };
      updateMutation.mutate({ id: editingId, data }, {
        onSuccess: () => {
          openReviewDialog(editingId, true);
          setView("list");
        },
      });
    } else {
      // Create then upload pending external recipients (if any) then open review dialog
      const data: BroadcastCampaignInput = {
        subject,
        body_html: bodyHtml,
        preview_text: previewText || undefined,
        audience_filters: audienceFilters,
      };
      createMutation.mutate(data, {
        onSuccess: (created) => {
          const openReview = () => {
            openReviewDialog(created.id, true);
            setView("list");
          };
          if (pendingExternalRows.length > 0) {
            addExternalMutation.mutate(
              { campaignId: created.id, rows: pendingExternalRows },
              { onSuccess: openReview, onError: openReview },
            );
          } else {
            openReview();
          }
        },
      });
    }
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      scheduled: "outline",
      sending: "default",
      sent: "default",
      failed: "destructive",
      cancelled: "secondary",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  }

  function openRate(campaign: BroadcastCampaign) {
    if (!campaign.total_sent) return "0%";
    return `${Math.round((campaign.total_opened / campaign.total_sent) * 100)}%`;
  }

  function clickRate(campaign: BroadcastCampaign) {
    if (!campaign.total_sent) return "0%";
    return `${Math.round((campaign.total_clicked / campaign.total_sent) * 100)}%`;
  }

  // Recipient review dialog — rendered in both compose and list views so it
  // mounts regardless of which view is active when the user opens it.
  const reviewDialog = (
    <Dialog
      open={reviewDialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          setReviewDialogOpen(false);
          setReviewCampaignId(null);
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {reviewCampaignId ? "Review Recipients" : "Recipient List"}
          </DialogTitle>
          <DialogDescription>
            {reviewCampaignId
              ? "Uncheck anyone you want to skip. Only checked recipients will receive this broadcast."
              : "Uncheck test accounts or anyone you want to exclude. Your choices are saved for when you send."}
          </DialogDescription>
        </DialogHeader>

        {previewLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : previewData?.recipients && previewData.recipients.length > 0 ? (
          <>
            <div className="flex items-center justify-between pb-2 border-b">
              <p className="text-sm text-muted-foreground">
                {previewData.recipients.length - excludedEmails.size} of {previewData.recipients.length} selected
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExcludedEmails(new Set())}
                >
                  Select all
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setExcludedEmails(new Set(previewData.recipients.map((r) => r.email)))
                  }
                >
                  Deselect all
                </Button>
              </div>
            </div>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-1">
                {previewData.recipients.map((r) => {
                  const isExcluded = excludedEmails.has(r.email);
                  return (
                    <label
                      key={r.email}
                      className="flex items-center gap-3 p-2 rounded hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={!isExcluded}
                        onCheckedChange={() => toggleExclude(r.email)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {r.name || r.email}
                        </p>
                        {r.name && (
                          <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                        )}
                      </div>
                      {r.source === "external" && (
                        <Badge variant="secondary" className="text-[10px] uppercase">
                          External
                        </Badge>
                      )}
                    </label>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No recipients match these filters</p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setReviewDialogOpen(false);
              setReviewCampaignId(null);
            }}
          >
            {reviewCampaignId ? "Cancel" : "Done"}
          </Button>
          {reviewCampaignId && (
            <Button
              onClick={() => {
                sendMutation.mutate({
                  id: reviewCampaignId,
                  excluded: Array.from(excludedEmails),
                });
              }}
              disabled={
                sendMutation.isPending ||
                !previewData?.recipients?.length ||
                previewData.recipients.length - excludedEmails.size === 0
              }
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send to {previewData?.recipients ? previewData.recipients.length - excludedEmails.size : 0}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Aggregate stats
  const totalCampaigns = campaigns?.length || 0;
  const totalSent = campaigns?.reduce((sum, c) => sum + c.total_sent, 0) || 0;
  const totalOpened = campaigns?.reduce((sum, c) => sum + c.total_opened, 0) || 0;
  const totalClicked = campaigns?.reduce((sum, c) => sum + c.total_clicked, 0) || 0;
  const avgOpenRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
  const avgClickRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0;

  // ==================== DETAIL VIEW ====================
  if (view === "detail" && detailId) {
    const detail = campaignDetail;
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => { setView("list"); setDetailId(null); }}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        </div>

        {detailLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : detail ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold">{detail.subject}</h1>
                <p className="text-muted-foreground">
                  {detail.sent_at ? `Sent ${format(new Date(detail.sent_at), "MMM d, yyyy 'at' HH:mm")}` : `Created ${format(new Date(detail.created_at), "MMM d, yyyy")}`}
                </p>
              </div>
              {getStatusBadge(detail.status)}
            </div>

            <div className="grid gap-4 md:grid-cols-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Sent</CardDescription>
                  <CardTitle className="text-2xl">{detail.total_sent}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Opened</CardDescription>
                  <CardTitle className="text-2xl text-blue-600">
                    {detail.total_opened}
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      ({openRate(detail)})
                    </span>
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Clicked</CardDescription>
                  <CardTitle className="text-2xl text-green-600">
                    {detail.total_clicked}
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      ({clickRate(detail)})
                    </span>
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Bounced</CardDescription>
                  <CardTitle className="text-2xl text-red-600">{detail.total_bounced}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Recipients</CardDescription>
                  <CardTitle className="text-2xl">{detail.total_recipients}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            {detail.recipients && detail.recipients.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Recipients
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Opened</TableHead>
                          <TableHead>Clicked</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.recipients.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.email}</TableCell>
                            <TableCell>{r.name || "-"}</TableCell>
                            <TableCell>{getStatusBadge(r.status)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {r.opened_at ? format(new Date(r.opened_at), "MMM d, HH:mm") : "-"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {r.clicked_at ? format(new Date(r.clicked_at), "MMM d, HH:mm") : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">Broadcast not found.</p>
        )}
      </div>
    );
  }

  // ==================== COMPOSE VIEW ====================
  if (view === "compose") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => { resetForm(); setView("list"); }}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <h1 className="text-2xl font-semibold">{editingId ? "Edit Broadcast" : "New Broadcast"}</h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Email Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject Line</Label>
                  <Input
                    id="subject"
                    placeholder="e.g. Hey {firstName}, new feature!"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Personalize with <code className="px-1 bg-muted rounded">{"{firstName}"}</code>
                    , <code className="px-1 bg-muted rounded">{"{fullName}"}</code>, or{" "}
                    <code className="px-1 bg-muted rounded">{"{email}"}</code>. Falls back to
                    "there" when no name is set.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preview-text">Preview Text (optional)</Label>
                  <Input
                    id="preview-text"
                    placeholder="Text shown in email client preview..."
                    value={previewText}
                    onChange={(e) => setPreviewText(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown next to the subject in the inbox list (Gmail, Outlook, Apple Mail).
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Body</Label>
                  <p className="text-xs text-muted-foreground">
                    Use the toolbar to format. Type{" "}
                    <code className="px-1 bg-muted rounded">{"{firstName}"}</code> anywhere to
                    personalize per recipient.
                  </p>
                  <Tabs value={previewTab} onValueChange={setPreviewTab}>
                    <TabsList>
                      <TabsTrigger value="edit">Edit</TabsTrigger>
                      <TabsTrigger value="preview">Preview</TabsTrigger>
                    </TabsList>
                    <TabsContent value="edit">
                      <RichTextEditor
                        value={bodyHtml}
                        onChange={setBodyHtml}
                        placeholder="Hello! We have some exciting updates to share..."
                      />
                    </TabsContent>
                    <TabsContent value="preview">
                      <div className="border rounded-md p-4 min-h-[300px] bg-white">
                        {bodyHtml ? (
                          <iframe
                            srcDoc={bodyHtml}
                            className="w-full min-h-[300px] border-0"
                            title="Email preview"
                            sandbox=""
                          />
                        ) : (
                          <p className="text-muted-foreground text-center py-12">
                            Start writing in the Edit tab to see a preview
                          </p>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Audience
                  <Badge variant="outline" className="text-lg px-3">
                    {audienceData?.count !== undefined
                      ? `${Math.max(0, audienceData.count + (editingId ? 0 : pendingExternalRows.length) - excludedEmails.size)} recipients`
                      : "... recipients"}
                  </Badge>
                </CardTitle>
                <CardDescription>Leave all empty to send to everyone</CardDescription>
                {(audienceData?.count ?? 0) > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full justify-center"
                    onClick={() => openReviewDialog(null, true)}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    View &amp; exclude recipients
                    {excludedEmails.size > 0 && (
                      <span className="ml-1 text-muted-foreground">
                        ({excludedEmails.size} excluded)
                      </span>
                    )}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Plan Tier</Label>
                  <div className="flex flex-wrap gap-2">
                    {PLAN_OPTIONS.map((opt) => (
                      <Badge
                        key={opt.value}
                        variant={filterPlans.includes(opt.value) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() =>
                          setFilterPlans((prev) =>
                            prev.includes(opt.value)
                              ? prev.filter((p) => p !== opt.value)
                              : [...prev, opt.value]
                          )
                        }
                      >
                        {opt.label}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <div className="flex flex-wrap gap-2">
                    {COUNTRY_OPTIONS.map((opt) => (
                      <Badge
                        key={opt.value}
                        variant={filterCountries.includes(opt.value) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() =>
                          setFilterCountries((prev) =>
                            prev.includes(opt.value)
                              ? prev.filter((c) => c !== opt.value)
                              : [...prev, opt.value]
                          )
                        }
                      >
                        {opt.label}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Account Status</Label>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((opt) => (
                      <Badge
                        key={opt.value}
                        variant={filterStatuses.includes(opt.value) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() =>
                          setFilterStatuses((prev) =>
                            prev.includes(opt.value)
                              ? prev.filter((s) => s !== opt.value)
                              : [...prev, opt.value]
                          )
                        }
                      >
                        {opt.label}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Engagement</Label>
                  <p className="text-xs text-muted-foreground">
                    Target users who need a nudge. Matches orgs meeting any selected criterion.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ENGAGEMENT_OPTIONS.map((opt) => (
                      <Badge
                        key={opt.value}
                        variant={filterEngagement.includes(opt.value) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() =>
                          setFilterEngagement((prev) =>
                            prev.includes(opt.value)
                              ? prev.filter((s) => s !== opt.value)
                              : [...prev, opt.value]
                          )
                        }
                      >
                        {opt.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t">
                  <Label className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    External Recipients (Upload)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Upload an XLSX or CSV (e.g. PlusVibe export). The file needs an{" "}
                    <code className="px-1 bg-muted rounded">email</code> column. Anyone already
                    a platform user is skipped automatically — no double-sends.
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                    className="hidden"
                    onChange={handleFilePicked}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadParsing || addExternalMutation.isPending}
                  >
                    {uploadParsing || addExternalMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {uploadParsing ? "Parsing…" : addExternalMutation.isPending ? "Uploading…" : "Upload contact list"}
                  </Button>

                  {/* Existing-draft summary (server-side stats) */}
                  {editingId && externalData && externalData.total_uploaded > 0 && (
                    <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Uploaded contacts</span>
                        <span className="font-medium">{externalData.total_uploaded}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Already platform users</span>
                        <span className="font-medium">{externalData.deduped_against_platform}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Net new external</span>
                        <span className="font-medium text-foreground">{externalData.net_new}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full mt-1 h-7 text-xs"
                        onClick={handleClearExternal}
                        disabled={clearExternalMutation.isPending}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Clear uploaded list
                      </Button>
                    </div>
                  )}

                  {/* New-draft pending summary (client-side, pre-save) */}
                  {!editingId && pendingExternalRows.length > 0 && (
                    <div className="rounded-md border bg-amber-50 border-amber-200 p-3 space-y-1 text-xs">
                      <p className="font-medium text-amber-900">
                        {pendingExternalRows.length} contact{pendingExternalRows.length === 1 ? "" : "s"} parsed from{" "}
                        <span className="font-mono">{pendingExternalFilename}</span>
                      </p>
                      <p className="text-amber-800">
                        Save the draft to upload them. Platform-user dedup runs server-side at that point.
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full mt-1 h-7 text-xs"
                        onClick={handleClearExternal}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Discard
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Sender</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-mono text-muted-foreground">
                  AutoListing &lt;noreply@autolisting.io&gt;
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-3">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Save Draft
                </Button>
                <Button
                  className="w-full"
                  onClick={handleSaveAndSend}
                  disabled={!subject.trim() || !bodyHtml.trim() || createMutation.isPending || updateMutation.isPending}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Save & Send Now
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {reviewDialog}
      </div>
    );
  }

  // ==================== LIST VIEW ====================
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Broadcasts</h1>
          <p className="text-muted-foreground">Send product updates and announcements to your users</p>
        </div>
        <Button onClick={() => openCompose()}>
          <Plus className="h-4 w-4 mr-2" />
          New Broadcast
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Campaigns</CardDescription>
            <CardTitle className="text-2xl">{totalCampaigns}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Sent</CardDescription>
            <CardTitle className="text-2xl">{totalSent}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Open Rate</CardDescription>
            <CardTitle className="text-2xl text-blue-600">{avgOpenRate}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Click Rate</CardDescription>
            <CardTitle className="text-2xl text-green-600">{avgClickRate}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Campaign History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns && campaigns.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recipients</TableHead>
                    <TableHead>Open Rate</TableHead>
                    <TableHead>Click Rate</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow
                      key={campaign.id}
                      className="cursor-pointer"
                      onClick={() => {
                        if (campaign.status === "sent" || campaign.status === "sending") {
                          setDetailId(campaign.id);
                          setView("detail");
                        }
                      }}
                    >
                      <TableCell className="font-medium max-w-xs truncate">{campaign.subject}</TableCell>
                      <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                      <TableCell>{campaign.total_sent || campaign.total_recipients || "-"}</TableCell>
                      <TableCell>{campaign.total_sent ? openRate(campaign) : "-"}</TableCell>
                      <TableCell>{campaign.total_sent ? clickRate(campaign) : "-"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {campaign.sent_at
                          ? format(new Date(campaign.sent_at), "MMM d, HH:mm")
                          : format(new Date(campaign.created_at), "MMM d, HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {campaign.status === "draft" && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => openCompose(campaign)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openReviewDialog(campaign.id)}
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmDeleteId(campaign.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                          {campaign.status === "scheduled" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cancelMutation.mutate(campaign.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                          {(campaign.status === "sent" || campaign.status === "sending") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setDetailId(campaign.id); setView("detail"); }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No broadcasts yet</p>
              <p className="text-sm mt-1">Create your first broadcast to reach your users</p>
              <Button className="mt-4" onClick={() => openCompose()}>
                <Plus className="h-4 w-4 mr-2" />
                New Broadcast
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {reviewDialog}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Broadcast?</AlertDialogTitle>
            <AlertDialogDescription>
              This draft will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteId && deleteMutation.mutate(confirmDeleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
