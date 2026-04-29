import { useQuery, useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft, Save, Sparkles, Loader2 } from "lucide-react";
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
  "reviewer_enabled",
  "reviewer_threshold",
  "reviewer_max_retries",
  "analyst_enabled",
  "ab_testing_enabled",
  "taste_rubric",
] as const;

type SettingKey = (typeof KEYS)[number];

interface DraftState {
  reviewer_enabled: boolean;
  reviewer_threshold: number;
  reviewer_max_retries: number;
  analyst_enabled: boolean;
  ab_testing_enabled: boolean;
  taste_rubric: string;
}

const DEFAULT_DRAFT: DraftState = {
  reviewer_enabled: false,
  reviewer_threshold: 7,
  reviewer_max_retries: 2,
  analyst_enabled: true,
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
      switch (s.key as SettingKey) {
        case "reviewer_enabled":
          next.reviewer_enabled = !!s.value;
          break;
        case "analyst_enabled":
          next.analyst_enabled = !!s.value;
          break;
        case "ab_testing_enabled":
          next.ab_testing_enabled = !!s.value;
          break;
        case "reviewer_threshold":
          next.reviewer_threshold = Number(s.value);
          break;
        case "reviewer_max_retries":
          next.reviewer_max_retries = Number(s.value);
          break;
        case "taste_rubric":
          next.taste_rubric = String(s.value);
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
              Reviewer flags, analyst flags, and the taste rubric the Reviewer
              critic rereads every run.
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              Reviewer
            </CardTitle>
            <CardDescription>
              The vision LLM critic that scores rendered posts against the taste
              rubric. Default off during soak — flip on once auto-rejection rate
              stabilises &lt;30%.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ToggleRow
              label="Reviewer enabled"
              description="When ON, the Producer fires the Reviewer at the end of every render. Approved posts auto-promote past 'review_queue'."
              checked={draft.reviewer_enabled}
              onChange={(v) => setKey("reviewer_enabled", v)}
              dirty={dirty.has("reviewer_enabled")}
            />
            <NumberRow
              label="Threshold score"
              description="Score (0-10) at or above which a post auto-approves. Below this it kicks back to the Producer for re-draft."
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
