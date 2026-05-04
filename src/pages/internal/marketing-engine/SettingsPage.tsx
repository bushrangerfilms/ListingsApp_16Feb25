import { useQuery, useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft, Save, Sparkles, Loader2, Send, Eye, GitFork, Search, Cpu, Beaker } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SettingRow {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

const KEYS = [
  // Publishing — load-bearing for go-live
  "publish_enabled",
  // Slot generation (lazy post-time content)
  "slot_generation_active",
  "slot_frequency_per_week",
  "slot_default_hour_utc",
  "slot_horizon_days",
  "slot_render_ahead_minutes",
  "slot_processor_max_per_run",
  // Taste reviewer (copy)
  "reviewer_enabled",
  "reviewer_threshold",
  "reviewer_max_retries",
  // Visual reviewer
  "visual_reviewer_enabled",
  "visual_reviewer_threshold",
  // Generation strategy
  "multi_variant_count",
  "auto_iterate_on_kickback",
  "iteration_variant_count",
  // Background agents
  "analyst_enabled",
  "research_enabled",
  "research_max_briefs_per_post",
  "repo_discovery_enabled",
  "repo_discovery_min_relevance_score",
  "repo_discovery_max_candidates_per_run",
  "model_watch_enabled",
  "model_watch_min_relevance",
  "model_watch_max_candidates_per_run",
  "model_watch_pushed_within_days",
  // Future
  "ab_testing_enabled",
  // Free-form
  "taste_rubric",
] as const;

type SettingKey = (typeof KEYS)[number];

interface DraftState {
  publish_enabled: boolean;
  slot_generation_active: boolean;
  slot_frequency_per_week: number;
  slot_default_hour_utc: number;
  slot_horizon_days: number;
  slot_render_ahead_minutes: number;
  slot_processor_max_per_run: number;
  reviewer_enabled: boolean;
  reviewer_threshold: number;
  reviewer_max_retries: number;
  visual_reviewer_enabled: boolean;
  visual_reviewer_threshold: number;
  multi_variant_count: number;
  auto_iterate_on_kickback: boolean;
  iteration_variant_count: number;
  analyst_enabled: boolean;
  research_enabled: boolean;
  research_max_briefs_per_post: number;
  repo_discovery_enabled: boolean;
  repo_discovery_min_relevance_score: number;
  repo_discovery_max_candidates_per_run: number;
  model_watch_enabled: boolean;
  model_watch_min_relevance: number;
  model_watch_max_candidates_per_run: number;
  model_watch_pushed_within_days: number;
  ab_testing_enabled: boolean;
  taste_rubric: string;
}

const DEFAULT_DRAFT: DraftState = {
  publish_enabled: false,
  slot_generation_active: true,
  slot_frequency_per_week: 7,
  slot_default_hour_utc: 9,
  slot_horizon_days: 14,
  slot_render_ahead_minutes: 30,
  slot_processor_max_per_run: 3,
  reviewer_enabled: false,
  reviewer_threshold: 7,
  reviewer_max_retries: 2,
  visual_reviewer_enabled: true,
  visual_reviewer_threshold: 7,
  multi_variant_count: 1,
  auto_iterate_on_kickback: false,
  iteration_variant_count: 3,
  analyst_enabled: true,
  research_enabled: true,
  research_max_briefs_per_post: 2,
  repo_discovery_enabled: true,
  repo_discovery_min_relevance_score: 6,
  repo_discovery_max_candidates_per_run: 12,
  model_watch_enabled: true,
  model_watch_min_relevance: 6,
  model_watch_max_candidates_per_run: 12,
  model_watch_pushed_within_days: 7,
  ab_testing_enabled: false,
  taste_rubric: "",
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<DraftState>(DEFAULT_DRAFT);
  const [dirty, setDirty] = useState<Set<SettingKey>>(new Set());

  const { data: settings } = useQuery<SettingRow[]>({
    queryKey: ["marketing-engine-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_engine_settings")
        .select("key, value, description, updated_at")
        .in("key", KEYS as unknown as string[]);
      return (data ?? []) as SettingRow[];
    },
  });

  // Hydrate draft from server values
  useEffect(() => {
    if (!settings) return;
    const next: DraftState = { ...DEFAULT_DRAFT };
    for (const s of settings) {
      const k = s.key as SettingKey;
      // Booleans + numbers + the one freeform string. Switch by key
      // because the JSON value type is unknown — defensive Boolean(s)
      // / Number(s) coercions guard against null / "false" / etc.
      switch (k) {
        case "publish_enabled":
        case "slot_generation_active":
        case "reviewer_enabled":
        case "visual_reviewer_enabled":
        case "auto_iterate_on_kickback":
        case "analyst_enabled":
        case "research_enabled":
        case "repo_discovery_enabled":
        case "model_watch_enabled":
        case "ab_testing_enabled":
          next[k] = s.value === true;
          break;
        case "slot_frequency_per_week":
        case "slot_default_hour_utc":
        case "slot_horizon_days":
        case "slot_render_ahead_minutes":
        case "slot_processor_max_per_run":
        case "reviewer_threshold":
        case "reviewer_max_retries":
        case "visual_reviewer_threshold":
        case "multi_variant_count":
        case "iteration_variant_count":
        case "research_max_briefs_per_post":
        case "repo_discovery_min_relevance_score":
        case "repo_discovery_max_candidates_per_run":
        case "model_watch_min_relevance":
        case "model_watch_max_candidates_per_run":
        case "model_watch_pushed_within_days": {
          const n = Number(s.value);
          if (Number.isFinite(n)) next[k] = n;
          break;
        }
        case "taste_rubric":
          next.taste_rubric = String(s.value ?? "");
          break;
      }
    }
    setDraft(next);
    setDirty(new Set());
  }, [settings]);

  const setKey = <K extends SettingKey>(key: K, value: DraftState[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty((s) => new Set(s).add(key));
  };

  const save = useMutation({
    mutationFn: async () => {
      const updates: Array<{ key: string; value: unknown }> = [];
      for (const key of dirty) {
        updates.push({ key, value: draft[key] });
      }
      if (updates.length === 0) return;
      // Update each key — upsert by primary key.
      for (const u of updates) {
        const { error } = await supabase
          .from("marketing_engine_settings")
          .update({ value: u.value, updated_at: new Date().toISOString() })
          .eq("key", u.key);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Settings saved", { description: `${dirty.size} value(s) updated` });
      setDirty(new Set());
      queryClient.invalidateQueries({ queryKey: ["marketing-engine-settings"] });
    },
    onError: (err: Error) =>
      toast.error("Save failed", { description: err.message }),
  });

  const settingByKey = new Map((settings ?? []).map((s) => [s.key, s]));

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/internal/marketing-engine")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Engine Settings</h1>
            <p className="text-muted-foreground mt-1">
              Publishing gate, reviewers, generation strategy, background
              agents (analyst / research / repo discovery / model watch),
              and the taste rubric.
            </p>
          </div>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || dirty.size === 0}
            data-testid="button-save-settings"
          >
            {save.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save{dirty.size > 0 ? ` (${dirty.size})` : ""}
          </Button>
        </div>

        <Card className={!draft.publish_enabled ? "border-amber-500/40" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-amber-500" />
              Publishing
            </CardTitle>
            <CardDescription>
              Master gate for the publish-due cron. While this is OFF, the
              cron fires every 15 min and no-ops cleanly without writing post
              state. Flip ON only once <code>brand_assets.upload_post_profile</code>
              + per-channel page IDs are configured (see the Go-live readiness
              card on the engine dashboard).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ToggleRow
              label="Publish enabled"
              description="When ON, marketing-engine-publish-due actually publishes approved posts that are past their scheduled_for time. The single-post manual publish path bypasses this gate."
              checked={draft.publish_enabled}
              onChange={(v) => setKey("publish_enabled", v)}
              dirty={dirty.has("publish_enabled")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Posting cadence (lazy generation)</CardTitle>
            <CardDescription>
              Posts are NO LONGER pre-generated at strategist time. The slot
              generator (daily 02:00 UTC) creates empty slots in the calendar.
              The slot processor (every 15 min) fires the producer when a slot
              is within <code>slot_render_ahead_minutes</code> of its anchor —
              content is generated using the CURRENT taste rubric so Overseer
              edits propagate immediately.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ToggleRow
              label="Slot generation active"
              description="Master switch for the slot generator + processor crons. Turn OFF to pause all auto-generation while tuning the rubric."
              checked={draft.slot_generation_active}
              onChange={(v) => setKey("slot_generation_active", v)}
              dirty={dirty.has("slot_generation_active")}
            />
            <NumberRow
              label="Slot frequency (per week)"
              description="Total post slots per week. 7 = daily; 14 = 2x/day; 21 = 3x/day. Slots stagger evenly across the week. Min 1, max 21."
              value={draft.slot_frequency_per_week}
              onChange={(v) => setKey("slot_frequency_per_week", v)}
              dirty={dirty.has("slot_frequency_per_week")}
              min={1}
              max={21}
            />
            <NumberRow
              label="Default slot hour (UTC)"
              description="UTC hour for the daily slot anchor (rounds DOWN to nearest 2h boundary). 9 = 09:00 UTC = 10:00 BST. For multiple slots/day, others stagger from this anchor."
              value={draft.slot_default_hour_utc}
              onChange={(v) => setKey("slot_default_hour_utc", v)}
              dirty={dirty.has("slot_default_hour_utc")}
              min={0}
              max={22}
            />
            <NumberRow
              label="Horizon (days)"
              description="How far ahead the slot generator maintains slots. 14 = two weeks of upcoming slots visible in calendar."
              value={draft.slot_horizon_days}
              onChange={(v) => setKey("slot_horizon_days", v)}
              dirty={dirty.has("slot_horizon_days")}
              min={1}
              max={60}
            />
            <NumberRow
              label="Render-ahead (minutes)"
              description="Minutes before slot_anchor that the processor fires the producer. 30 = generate content 30 min before publish time."
              value={draft.slot_render_ahead_minutes}
              onChange={(v) => setKey("slot_render_ahead_minutes", v)}
              dirty={dirty.has("slot_render_ahead_minutes")}
              min={0}
              max={1440}
            />
            <NumberRow
              label="Max generations per cron tick"
              description="Hard cap on slots fired by one processor run. Defends against credit storms if producer hangs. 3 fits comfortably in the 15-min cron window."
              value={draft.slot_processor_max_per_run}
              onChange={(v) => setKey("slot_processor_max_per_run", v)}
              dirty={dirty.has("slot_processor_max_per_run")}
              min={1}
              max={10}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              Taste Reviewer
            </CardTitle>
            <CardDescription>
              The copy-only LLM critic that scores draft storyboards against
              the taste rubric. Pure logger — never mutates the post directly;
              the Producer reads its decision and applies combined precedence
              with the Visual Reviewer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ToggleRow
              label="Taste Reviewer enabled"
              description="When ON, the Producer fires the Taste Reviewer at the end of every render. Approved posts auto-promote past 'review_queue'."
              checked={draft.reviewer_enabled}
              onChange={(v) => setKey("reviewer_enabled", v)}
              dirty={dirty.has("reviewer_enabled")}
            />
            <NumberRow
              label="Threshold score"
              description="Score (0-10) at or above which a post auto-approves. Below this it kicks back to the Producer for re-draft (when auto-iterate is on)."
              value={draft.reviewer_threshold}
              min={0}
              max={10}
              step={1}
              onChange={(v) => setKey("reviewer_threshold", v)}
              dirty={dirty.has("reviewer_threshold")}
            />
            <NumberRow
              label="Max retries"
              description="Max times the Reviewer kicks a post back before falling through to manual review."
              value={draft.reviewer_max_retries}
              min={0}
              max={5}
              step={1}
              onChange={(v) => setKey("reviewer_max_retries", v)}
              dirty={dirty.has("reviewer_max_retries")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-violet-500" />
              Visual Reviewer
            </CardTitle>
            <CardDescription>
              Vision-capable LLM critic. Scores rendered post images against
              the visual rubric (composition, hierarchy, white space, brand
              consistency, contrast, type). Pure logger; combined with Taste
              Reviewer via precedence in the Producer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ToggleRow
              label="Visual Reviewer enabled"
              description="Default ON — composition redesign hits ≥7 on first pass for static templates."
              checked={draft.visual_reviewer_enabled}
              onChange={(v) => setKey("visual_reviewer_enabled", v)}
              dirty={dirty.has("visual_reviewer_enabled")}
            />
            <NumberRow
              label="Threshold score"
              description="Score (0-10) at or above which the Visual Reviewer approves. Below this kicks back."
              value={draft.visual_reviewer_threshold}
              min={0}
              max={10}
              step={1}
              onChange={(v) => setKey("visual_reviewer_threshold", v)}
              dirty={dirty.has("visual_reviewer_threshold")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitFork className="h-5 w-5 text-emerald-500" />
              Generation strategy
            </CardTitle>
            <CardDescription>
              How the Producer drafts each post — single shot vs multi-variant
              parallel, and whether to re-draft on reviewer kick-back.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <NumberRow
              label="Multi-variant count"
              description="N variants drafted in parallel, scored, best shipped. 1 = single shot. 3 adds roughly USD 0.30 per post on stat-card."
              value={draft.multi_variant_count}
              min={1}
              max={5}
              step={1}
              onChange={(v) => setKey("multi_variant_count", v)}
              dirty={dirty.has("multi_variant_count")}
            />
            <ToggleRow
              label="Auto-iterate on kick-back"
              description="When ON and either reviewer kicks a post back, Producer redrafts with the feedback threaded into the prompt. Static-path only — video iteration is too expensive."
              checked={draft.auto_iterate_on_kickback}
              onChange={(v) => setKey("auto_iterate_on_kickback", v)}
              dirty={dirty.has("auto_iterate_on_kickback")}
            />
            <NumberRow
              label="Iteration variant count"
              description="When auto-iterate is on, how many redrafts to score on each retry."
              value={draft.iteration_variant_count}
              min={1}
              max={5}
              step={1}
              onChange={(v) => setKey("iteration_variant_count", v)}
              dirty={dirty.has("iteration_variant_count")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analyst</CardTitle>
            <CardDescription>
              Daily cron that polls Upload Post for status and writes back to{" "}
              <code className="px-1 py-0.5 rounded bg-muted">engagement_log</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ToggleRow
              label="Analyst enabled"
              description="When ON, the daily cron pulls Upload Post status. Disable if you're rate-limited or auditing the polled values."
              checked={draft.analyst_enabled}
              onChange={(v) => setKey("analyst_enabled", v)}
              dirty={dirty.has("analyst_enabled")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Beaker className="h-5 w-5 text-cyan-500" />
              Research agent
            </CardTitle>
            <CardDescription>
              Per-decision web_search brief threaded into the Producer's
              system prompt. 30-day cache; roughly USD 0.18 per cache miss.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ToggleRow
              label="Research enabled"
              description="When ON, the Producer calls the research agent before drafting. Cached briefs are free."
              checked={draft.research_enabled}
              onChange={(v) => setKey("research_enabled", v)}
              dirty={dirty.has("research_enabled")}
            />
            <NumberRow
              label="Max briefs per post"
              description="Hard cap on research calls per post (cost rail)."
              value={draft.research_max_briefs_per_post}
              min={0}
              max={5}
              step={1}
              onChange={(v) => setKey("research_max_briefs_per_post", v)}
              dirty={dirty.has("research_max_briefs_per_post")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-fuchsia-500" />
              Repo discovery
            </CardTitle>
            <CardDescription>
              Phase 7D-2 weekly cron. Scans curated GitHub topics for repos
              worth stealing patterns from. Surfaces to{" "}
              <code className="px-1 py-0.5 rounded bg-muted">/internal/marketing-engine/research-inbox</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ToggleRow
              label="Repo discovery enabled"
              description="When ON, Sun 04:00 UTC cron walks the watch list. Roughly USD 0.30-1.50 per run."
              checked={draft.repo_discovery_enabled}
              onChange={(v) => setKey("repo_discovery_enabled", v)}
              dirty={dirty.has("repo_discovery_enabled")}
            />
            <NumberRow
              label="Min relevance score"
              description="Candidates below this 0-10 score are skipped (not inserted to inbox)."
              value={draft.repo_discovery_min_relevance_score}
              min={0}
              max={10}
              step={1}
              onChange={(v) => setKey("repo_discovery_min_relevance_score", v)}
              dirty={dirty.has("repo_discovery_min_relevance_score")}
            />
            <NumberRow
              label="Max candidates per run"
              description="Hard cap on inserted rows per cron run."
              value={draft.repo_discovery_max_candidates_per_run}
              min={1}
              max={50}
              step={1}
              onChange={(v) => setKey("repo_discovery_max_candidates_per_run", v)}
              dirty={dirty.has("repo_discovery_max_candidates_per_run")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-orange-500" />
              Model watch
            </CardTitle>
            <CardDescription>
              Phase 5 weekly cron. Scans Anthropic / OpenAI / Google / Kie /
              fal / Replicate / xAI / ElevenLabs / Cartesia for new
              generation models. Surfaces to{" "}
              <code className="px-1 py-0.5 rounded bg-muted">/internal/marketing-engine/model-watch</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ToggleRow
              label="Model watch enabled"
              description="When ON, Sun 04:30 UTC cron walks the vendor list. Roughly USD 0.45-1.80 per run."
              checked={draft.model_watch_enabled}
              onChange={(v) => setKey("model_watch_enabled", v)}
              dirty={dirty.has("model_watch_enabled")}
            />
            <NumberRow
              label="Min relevance score"
              description="Candidates below this 0-10 score are skipped."
              value={draft.model_watch_min_relevance}
              min={0}
              max={10}
              step={1}
              onChange={(v) => setKey("model_watch_min_relevance", v)}
              dirty={dirty.has("model_watch_min_relevance")}
            />
            <NumberRow
              label="Max candidates per run"
              description="Hard cap on inserted rows per cron run."
              value={draft.model_watch_max_candidates_per_run}
              min={1}
              max={50}
              step={1}
              onChange={(v) => setKey("model_watch_max_candidates_per_run", v)}
              dirty={dirty.has("model_watch_max_candidates_per_run")}
            />
            <NumberRow
              label="Recency window (days)"
              description="Pass to web_search: surface models released within last N days."
              value={draft.model_watch_pushed_within_days}
              min={1}
              max={30}
              step={1}
              onChange={(v) => setKey("model_watch_pushed_within_days", v)}
              dirty={dirty.has("model_watch_pushed_within_days")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>A/B testing</CardTitle>
            <CardDescription>
              When ON, the Producer drafts two caption variants per topic and
              the Analyst compares engagement after 72h. Phase 5+ — wiring is
              deferred; flag is here as the contract.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ToggleRow
              label="A/B testing enabled"
              description="No-op until the Producer A/B path lands. Safe to leave off."
              checked={draft.ab_testing_enabled}
              onChange={(v) => setKey("ab_testing_enabled", v)}
              dirty={dirty.has("ab_testing_enabled")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Taste rubric</CardTitle>
            <CardDescription>
              The voice + visual rules the Reviewer rereads on every run.
              Plain text — markdown light. Last updated{" "}
              {settingByKey.get("taste_rubric")?.updated_at
                ? new Date(settingByKey.get("taste_rubric")!.updated_at).toLocaleString()
                : "—"}
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs uppercase tracking-wide">
                Rubric body
                {dirty.has("taste_rubric") && (
                  <Badge variant="outline" className="ml-2 text-xs">unsaved</Badge>
                )}
              </Label>
              <span className="text-xs text-muted-foreground">
                {draft.taste_rubric.length} chars
              </span>
            </div>
            <Textarea
              value={draft.taste_rubric}
              onChange={(e) => setKey("taste_rubric", e.target.value)}
              rows={20}
              className="font-mono text-xs"
              data-testid="textarea-taste-rubric"
            />
            <p className="text-xs text-muted-foreground mt-3">
              Tip: keep numbered rules + a small visual checklist. Reviewer
              treats violations as automatic score &le;4. Avoid prose
              paragraphs — bullet lists score better.
            </p>
          </CardContent>
        </Card>
      </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  dirty,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  dirty: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">{label}</Label>
          {dirty && <Badge variant="outline" className="text-xs">unsaved</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function NumberRow({
  label,
  description,
  value,
  min,
  max,
  step,
  onChange,
  dirty,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  dirty: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">{label}</Label>
          {dirty && <Badge variant="outline" className="text-xs">unsaved</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(n);
        }}
        className="w-24"
      />
    </div>
  );
}
