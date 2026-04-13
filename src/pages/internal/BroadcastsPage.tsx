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
import { Loader2, Megaphone, Plus, Send, Eye, Pencil, Trash2, X, ArrowLeft, Users } from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
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
    queryKey: ["admin", "broadcasts", "audience-count", audienceFilters],
    queryFn: () => adminApi.broadcasts.audienceCount(audienceFilters),
    enabled: view === "compose" && !authLoading && hasSuperAdminAccess,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: BroadcastCampaignInput) => adminApi.broadcasts.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "broadcasts"] });
      toast({ title: "Draft saved" });
      resetForm();
      setView("list");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BroadcastCampaignInput> }) =>
      adminApi.broadcasts.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "broadcasts"] });
      toast({ title: "Draft updated" });
      resetForm();
      setView("list");
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

  // Load recipient preview when review dialog opens
  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ["admin", "broadcasts", "audience-preview", reviewCampaignId],
    queryFn: async () => {
      // Get filters from the campaign being reviewed
      const campaign = campaigns?.find((c) => c.id === reviewCampaignId);
      if (!campaign) return { recipients: [] };
      return adminApi.broadcasts.audiencePreview(campaign.audience_filters || {});
    },
    enabled: reviewDialogOpen && !!reviewCampaignId,
  });

  function openReviewDialog(campaignId: string) {
    setReviewCampaignId(campaignId);
    setExcludedEmails(new Set());
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
    setEditingId(null);
    setPreviewTab("edit");
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

    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
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
          openReviewDialog(editingId);
          setView("list");
        },
      });
    } else {
      // Create then open review dialog
      const data: BroadcastCampaignInput = {
        subject,
        body_html: bodyHtml,
        preview_text: previewText || undefined,
        audience_filters: audienceFilters,
      };
      createMutation.mutate(data, {
        onSuccess: (created) => {
          openReviewDialog(created.id);
          setView("list");
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
                    placeholder="e.g. New Feature: Broadcast Emails"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preview-text">Preview Text (optional)</Label>
                  <Input
                    id="preview-text"
                    placeholder="Text shown in email client preview..."
                    value={previewText}
                    onChange={(e) => setPreviewText(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Body (HTML)</Label>
                  <Tabs value={previewTab} onValueChange={setPreviewTab}>
                    <TabsList>
                      <TabsTrigger value="edit">Edit</TabsTrigger>
                      <TabsTrigger value="preview">Preview</TabsTrigger>
                    </TabsList>
                    <TabsContent value="edit">
                      <Textarea
                        placeholder="<h2>Hello!</h2><p>We have some exciting updates...</p>"
                        value={bodyHtml}
                        onChange={(e) => setBodyHtml(e.target.value)}
                        className="font-mono text-sm min-h-[300px]"
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
                            Enter HTML content in the Edit tab to see a preview
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
                    {audienceData?.count ?? "..."} recipients
                  </Badge>
                </CardTitle>
                <CardDescription>Leave all empty to send to everyone</CardDescription>
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

      {/* Recipient Review Dialog */}
      <Dialog
        open={reviewDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setReviewDialogOpen(false);
            setReviewCampaignId(null);
            setExcludedEmails(new Set());
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Review Recipients</DialogTitle>
            <DialogDescription>
              Uncheck anyone you want to skip. Only checked recipients will receive this broadcast.
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
              <ScrollArea className="flex-1 max-h-[400px]">
                <div className="space-y-1 pr-4">
                  {previewData.recipients.map((r) => {
                    const isExcluded = excludedEmails.has(r.email);
                    return (
                      <label
                        key={r.user_id}
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
                setExcludedEmails(new Set());
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!reviewCampaignId) return;
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
