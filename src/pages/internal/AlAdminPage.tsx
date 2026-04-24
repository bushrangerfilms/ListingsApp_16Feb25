import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, RefreshCw, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface KbBundleMeta {
  version: string;
  built_at: string;
  section_count: number;
  estimated_tokens_total: number;
  sections: Array<{ id: string; title: string; apps: string[]; estimated_tokens: number }>;
}

export default function AlAdminPage() {
  const [bundle, setBundle] = useState<KbBundleMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

  const loadBundle = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/al-kb/knowledge-base.json?t=${Date.now()}`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      // Bucket is private, so fall back to authenticated fetch via supabase client
      if (!res.ok) {
        const { data, error } = await supabase.storage
          .from("al-kb")
          .download("knowledge-base.json");
        if (error) throw error;
        const text = await data.text();
        setBundle(JSON.parse(text));
      } else {
        setBundle(await res.json());
      }
    } catch (e: any) {
      toast.error(`Failed to load KB: ${e?.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBundle();
  }, []);

  const handleTrigger = async () => {
    setTriggering(true);
    setTriggerMessage(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Not signed in");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/al-kb-rebuild-trigger`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: "super-admin UI" }),
        }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setTriggerMessage(body.message);
      toast.success("Rebuild triggered");
      // Poll the bundle every 10s for the next minute to show the new version
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 10_000));
        await loadBundle();
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to trigger rebuild");
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-primary" />
          AL knowledge base
        </h1>
        <p className="text-muted-foreground mt-1">
          AL's knowledge comes from Markdown files in <code>docs/user/</code>. They're bundled
          into a single JSON file on every push to <code>main</code>, uploaded to Supabase Storage,
          and the AL chat edge function reloads its cache every 60 seconds. End-to-end propagation
          from merge → AL sees change is ~90 seconds.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>Current bundle</CardTitle>
              <CardDescription>Live in production right now</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadBundle}
              disabled={loading}
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && !bundle && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          )}
          {bundle && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Version</p>
                  <p className="font-mono">{bundle.version}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Built</p>
                  <p>{formatDistanceToNow(new Date(bundle.built_at), { addSuffix: true })}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sections</p>
                  <p>{bundle.section_count}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tokens (est.)</p>
                  <p>~{bundle.estimated_tokens_total.toLocaleString()}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2">Sections included:</p>
                <ul className="text-sm space-y-1">
                  {bundle.sections.map((s) => (
                    <li key={s.id} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      <span className="font-medium">{s.title}</span>
                      <span className="text-xs text-muted-foreground">
                        · ~{s.estimated_tokens.toLocaleString()} tokens · {s.apps.join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rebuild from latest docs</CardTitle>
          <CardDescription>
            Triggers the <code>al-kb-rebuild</code> GitHub Action, which reads the current
            state of <code>docs/user/</code> on <code>main</code> and uploads a fresh bundle.
            Use this if you edited a doc and want AL to see it before the next 60s cache expiry,
            or if auto-rebuild didn't fire for some reason.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleTrigger} disabled={triggering}>
            {triggering ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Triggering…
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Rebuild now
              </>
            )}
          </Button>

          {triggerMessage && (
            <div className="rounded-md border border-green-200 bg-green-50 dark:bg-green-950/30 p-3 text-sm text-green-900 dark:text-green-100 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{triggerMessage}</span>
            </div>
          )}

          <div className="rounded-md border border-muted-foreground/20 bg-muted/30 p-3 text-xs text-muted-foreground flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Note: the Action takes ~30 seconds to run. The edge function's cache refreshes
              every 60 seconds. So worst-case delay from clicking this button to AL seeing
              new content is ~90 seconds. You'll see the Version field above tick up once
              the new bundle is live.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
