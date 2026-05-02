import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Mail,
  Sparkles,
  Wand2,
  Send,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Copy,
  ExternalLink,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Mirrors the email-writer.ts shape — kept inline so we don't depend on
// importing TS files from the Socials repo. If the schema there changes,
// update both.
interface SpamHit {
  word: string;
  index: number;
  context: string;
}

interface Variation {
  variation: "A" | "B" | "C" | "D";
  name: string;
  subject: string;
  body: string;
  angle_key: string;
  utm_content: string;
}

interface SequenceStep {
  step: number;
  wait_time: number;
  intent: string;
  variations: Variation[];
}

interface CampaignDraft {
  camp_name: string;
  sequences: SequenceStep[];
  generation_notes: string;
  spam_warnings: SpamHit[];
}

interface ImproveResult {
  improved: {
    subject: string;
    body: string;
    name: string;
    angle_key: string;
  };
  diff_summary: string;
  spam_warnings: SpamHit[];
}

interface PlusVibeCampaign {
  _id: string;
  name: string;
  status: string;
  last_lead_sent?: string;
  last_lead_replied?: string;
}

const ANGLE_LABELS: Record<string, string> = {
  all_in_one: "All-In-One",
  time_saved: "Time Saved",
  consistency: "Consistency",
  lead_capture: "Lead Capture",
  first_listing_easy: "First Listing Easy",
  ai_does_marketing: "AI Does Marketing",
  social_proof: "Social Proof",
  specificity: "Specificity",
};

export default function EmailCopyPage() {
  const navigate = useNavigate();

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
            <Mail className="h-7 w-7" />
            Email Copy
          </h1>
          <p className="text-muted-foreground mt-1">
            Draft and improve PlusVibe campaign copy. Push directly to
            PlusVibe via API. Per-angle attribution via UTM tags.
          </p>
        </div>
      </div>

      <Tabs defaultValue="generate" className="space-y-4">
        <TabsList>
          <TabsTrigger value="generate" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Generate New Campaign
          </TabsTrigger>
          <TabsTrigger value="improve" className="gap-2">
            <Wand2 className="h-4 w-4" />
            Improve Existing
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-2">
            <Send className="h-4 w-4" />
            PlusVibe Campaigns
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4">
          <GenerateTab />
        </TabsContent>

        <TabsContent value="improve" className="space-y-4">
          <ImproveTab />
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <CampaignsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Generate tab ─────────────────────────────────────────────────────

function GenerateTab() {
  const { toast } = useToast();
  const [campaignName, setCampaignName] = useState("");
  const [icpBrief, setIcpBrief] = useState("");
  const [locale, setLocale] = useState<"UK" | "IE" | "US" | "CA" | "AU" | "NZ">("UK");
  const [draft, setDraft] = useState<CampaignDraft | null>(null);

  const generate = useMutation({
    mutationFn: async (): Promise<CampaignDraft> => {
      const slug = campaignName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
      const { data, error } = await supabase.functions.invoke(
        "marketing-engine-email-writer",
        {
          body: {
            mode: "generate",
            campaign_name: campaignName,
            icp_brief: icpBrief,
            locale_hint: locale,
            utm_campaign_slug: slug || "campaign",
          },
        },
      );
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "generation failed");
      return data.draft as CampaignDraft;
    },
    onSuccess: (d) => {
      setDraft(d);
      toast({ title: "Generated", description: `${d.sequences.length} steps × ${d.sequences[0]?.variations.length ?? 0} variations` });
    },
    onError: (e: Error) => {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Brief</CardTitle>
          <CardDescription>
            The model produces 4 sequence steps × 4 angle variations (16 emails).
            Sentence-level spintax with 3 alternates per slot. Soft opt-out only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="campaign-name">Campaign name</Label>
              <Input
                id="campaign-name"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. UK Launch v2"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="locale">Locale (drives schedule timezone)</Label>
              <Select
                value={locale}
                onValueChange={(v) => setLocale(v as typeof locale)}
              >
                <SelectTrigger id="locale" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UK">UK (Europe/London)</SelectItem>
                  <SelectItem value="IE">Ireland (Europe/Dublin)</SelectItem>
                  <SelectItem value="US">US (America/New_York)</SelectItem>
                  <SelectItem value="CA">Canada (America/Toronto)</SelectItem>
                  <SelectItem value="AU">Australia (Australia/Sydney)</SelectItem>
                  <SelectItem value="NZ">New Zealand (Pacific/Auckland)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="icp">ICP brief</Label>
            <Textarea
              id="icp"
              value={icpBrief}
              onChange={(e) => setIcpBrief(e.target.value)}
              placeholder="Solo or small-team residential auctioneers in the UK, 50-300 listings/year, currently posting manually to Instagram and Facebook only. Pain: time, inconsistency, no lead capture."
              rows={5}
              className="mt-1 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              The more specific, the better. Mention pain points, current tools they use,
              region quirks, anything to make the copy feel addressed to them.
            </p>
          </div>
          <Button
            onClick={() => generate.mutate()}
            disabled={!campaignName || !icpBrief || generate.isPending}
            className="gap-2"
          >
            {generate.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate 4 × 4 campaign
          </Button>
        </CardContent>
      </Card>

      {draft && <DraftReview draft={draft} locale={locale} setDraft={setDraft} />}
    </div>
  );
}

function DraftReview({
  draft,
  locale,
  setDraft,
}: {
  draft: CampaignDraft;
  locale: "UK" | "IE" | "US" | "CA" | "AU" | "NZ";
  setDraft: (d: CampaignDraft | null) => void;
}) {
  const { toast } = useToast();

  const push = useMutation({
    mutationFn: async (): Promise<{ campaign_id: string; created: boolean }> => {
      const { data, error } = await supabase.functions.invoke(
        "marketing-engine-plusvibe-proxy",
        {
          body: { action: "push_draft", draft, locale },
        },
      );
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "push failed");
      return { campaign_id: data.campaign_id, created: data.created };
    },
    onSuccess: (r) => {
      toast({
        title: r.created ? "Pushed to PlusVibe" : "Updated PlusVibe campaign",
        description: `Campaign ${r.campaign_id}. Review in PlusVibe before activating.`,
      });
    },
    onError: (e: Error) => {
      toast({ title: "Push failed", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Draft: {draft.camp_name}</CardTitle>
            <CardDescription className="mt-1">
              {draft.generation_notes}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setDraft(null)}>
              Discard
            </Button>
            <Button
              size="sm"
              onClick={() => push.mutate()}
              disabled={push.isPending}
              className="gap-2"
            >
              {push.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Push to PlusVibe
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {draft.spam_warnings.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {draft.spam_warnings.length} spam-trigger word
              {draft.spam_warnings.length > 1 ? "s" : ""} detected. Review and rewrite
              before pushing — or push and edit in PlusVibe.
              <ul className="mt-2 text-xs list-disc list-inside">
                {draft.spam_warnings.slice(0, 5).map((h, i) => (
                  <li key={i}>
                    <code>{h.word}</code> in {h.context}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        {draft.sequences.map((s) => (
          <div key={s.step} className="border rounded-md p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Badge variant="default">Step {s.step}</Badge>
              <span className="font-medium">{s.intent}</span>
              <span className="text-xs text-muted-foreground">
                wait {s.wait_time}d after this step
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {s.variations.map((v) => (
                <VariationCard key={v.variation} step={s.step} variation={v} />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function VariationCard({ step: _step, variation: v }: { step: number; variation: Variation }) {
  const { toast } = useToast();
  const copyAll = () => {
    const text = `Subject: ${v.subject}\n\n${v.body}`;
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: v.name });
  };
  return (
    <div className="border rounded-sm p-3 bg-muted/30 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="outline" className="font-mono text-xs">
            {v.variation}
          </Badge>
          <span className="font-medium text-sm truncate">{v.name}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={copyAll}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
      <Badge variant="secondary" className="text-xs">
        {ANGLE_LABELS[v.angle_key] ?? v.angle_key}
      </Badge>
      {v.subject && (
        <div className="text-xs">
          <span className="text-muted-foreground">Subject: </span>
          <span className="font-medium">{v.subject}</span>
        </div>
      )}
      <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed bg-background p-2 rounded max-h-48 overflow-y-auto">
        {v.body}
      </pre>
      <div className="text-[10px] text-muted-foreground font-mono truncate">
        utm_content={v.utm_content}
      </div>
    </div>
  );
}

// ── Improve tab ──────────────────────────────────────────────────────

function ImproveTab() {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [step, setStep] = useState<number>(1);
  const [angleHint, setAngleHint] = useState<string>("");
  const [result, setResult] = useState<ImproveResult | null>(null);

  const improve = useMutation({
    mutationFn: async (): Promise<ImproveResult> => {
      const { data, error } = await supabase.functions.invoke(
        "marketing-engine-email-writer",
        {
          body: {
            mode: "improve",
            subject,
            body,
            step,
            angle_hint: angleHint || undefined,
          },
        },
      );
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "improve failed");
      return data.result as ImproveResult;
    },
    onSuccess: (r) => {
      setResult(r);
      toast({ title: "Improved", description: r.diff_summary.slice(0, 80) });
    },
    onError: (e: Error) => {
      toast({ title: "Improve failed", description: e.message, variant: "destructive" });
    },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Source</CardTitle>
          <CardDescription>
            Paste the existing variation from PlusVibe — subject and body with
            spintax intact.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Step</Label>
              <Select value={String(step)} onValueChange={(v) => setStep(Number(v))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 — Overview</SelectItem>
                  <SelectItem value="2">2 — Quick prompt</SelectItem>
                  <SelectItem value="3">3 — Specific pain</SelectItem>
                  <SelectItem value="4">4 — Pain/benefit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Target angle (optional)</Label>
              <Select
                value={angleHint || "_auto"}
                onValueChange={(v) => setAngleHint(v === "_auto" ? "" : v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_auto">Auto-detect</SelectItem>
                  {Object.entries(ANGLE_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1"
              placeholder="Swap Canva, freelancers, and manual posting for one tool"
            />
          </div>
          <div>
            <Label>Body (with spintax)</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={18}
              className="mt-1 font-mono text-xs"
              placeholder="Hi {{first_name}},&#10;&#10;{{random|...|...|...}} ..."
            />
          </div>
          <Button
            onClick={() => improve.mutate()}
            disabled={!subject || !body || improve.isPending}
            className="gap-2"
          >
            {improve.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Improve
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Improved</CardTitle>
          <CardDescription>
            {result
              ? result.diff_summary
              : "Run Improve to see the rewritten copy here."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!result ? (
            <div className="text-sm text-muted-foreground italic">No result yet.</div>
          ) : (
            <>
              {result.spam_warnings.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Spam-trigger words still present:{" "}
                    {result.spam_warnings.map((h) => h.word).join(", ")}
                  </AlertDescription>
                </Alert>
              )}
              <div className="text-xs">
                <span className="text-muted-foreground">Name: </span>
                <span className="font-medium">{result.improved.name}</span>
                <Badge variant="secondary" className="text-xs ml-2">
                  {ANGLE_LABELS[result.improved.angle_key] ?? result.improved.angle_key}
                </Badge>
              </div>
              <div>
                <Label className="text-xs">Subject</Label>
                <Input value={result.improved.subject} readOnly className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Body</Label>
                <Textarea
                  value={result.improved.body}
                  readOnly
                  rows={18}
                  className="mt-1 font-mono text-xs"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Subject: ${result.improved.subject}\n\n${result.improved.body}`,
                  );
                }}
                className="gap-2"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy subject + body
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Campaigns tab ────────────────────────────────────────────────────

function CampaignsTab() {
  const { toast } = useToast();

  const campaigns = useQuery<PlusVibeCampaign[]>({
    queryKey: ["plusvibe-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "marketing-engine-plusvibe-proxy",
        { body: { action: "list_campaigns" } },
      );
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "list failed");
      return data.campaigns as PlusVibeCampaign[];
    },
  });

  const fetchStats = useMutation({
    mutationFn: async (campaign_id: string) => {
      const { data, error } = await supabase.functions.invoke(
        "marketing-engine-plusvibe-proxy",
        { body: { action: "get_stats", campaign_id } },
      );
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "stats failed");
      return data.stats;
    },
    onSuccess: (stats, campaign_id) => {
      toast({
        title: `Stats for ${campaign_id.slice(0, 8)}...`,
        description: JSON.stringify(stats, null, 2).slice(0, 200),
      });
      console.log("[email-copy] variation stats:", stats);
    },
    onError: (e: Error) => {
      toast({ title: "Stats failed", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Existing PlusVibe Campaigns</CardTitle>
        <CardDescription>
          Pulled live from your workspace via the API. Click Stats to see
          per-variation performance (open / click / reply rates).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {campaigns.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : campaigns.error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {(campaigns.error as Error).message}
            </AlertDescription>
          </Alert>
        ) : !campaigns.data || campaigns.data.length === 0 ? (
          <div className="text-sm text-muted-foreground">No campaigns found.</div>
        ) : (
          <div className="space-y-2">
            {campaigns.data.map((c) => (
              <div
                key={c._id}
                className="flex items-center gap-3 py-2 border-b last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {c._id}
                    {c.last_lead_sent && (
                      <span className="ml-2">
                        · last sent{" "}
                        {new Date(c.last_lead_sent).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    c.status === "ACTIVE"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : "bg-muted"
                  }
                >
                  {c.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchStats.mutate(c._id)}
                  disabled={fetchStats.isPending}
                  className="gap-2"
                >
                  {fetchStats.isPending && fetchStats.variables === c._id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Stats
                </Button>
                <a
                  href={`https://app.plusvibe.ai/v2/campaigns/${c._id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </a>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
