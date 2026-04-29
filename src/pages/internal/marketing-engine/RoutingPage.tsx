import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface RoutingRow {
  capability: string;
  provider_kind: "media" | "llm";
  default_provider_id: string;
  fallback_provider_ids: string[];
  enabled: boolean;
}

interface ProviderLite {
  id: string;
  slug: string;
  status: string;
}

export default function RoutingPage() {
  const navigate = useNavigate();

  const { data: routes } = useQuery<RoutingRow[]>({
    queryKey: ["capability-routing"],
    queryFn: async () => {
      const { data } = await supabase
        .from("capability_routing")
        .select("capability, provider_kind, default_provider_id, fallback_provider_ids, enabled")
        .order("capability");
      return (data ?? []) as RoutingRow[];
    },
  });

  const { data: media } = useQuery<ProviderLite[]>({
    queryKey: ["media-providers-lite"],
    queryFn: async () => {
      const { data } = await supabase.from("media_providers").select("id, slug, status");
      return (data ?? []) as ProviderLite[];
    },
  });

  const { data: llm } = useQuery<ProviderLite[]>({
    queryKey: ["llm-providers-lite"],
    queryFn: async () => {
      const { data } = await supabase.from("llm_providers").select("id, slug, status");
      return (data ?? []) as ProviderLite[];
    },
  });

  const slugFor = (kind: "media" | "llm", id: string): string => {
    const list = kind === "media" ? media : llm;
    return list?.find((p) => p.id === id)?.slug ?? id.slice(0, 8);
  };

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
            <h1 className="text-3xl font-bold tracking-tight">Capability Routing</h1>
            <p className="text-muted-foreground mt-1">
              Default + ordered fallbacks per capability. Edits coming Phase 1.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Routes</CardTitle>
            <CardDescription>
              Business logic asks for a capability; the router resolves it here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!routes ? (
              <div className="text-muted-foreground text-sm">Loading…</div>
            ) : routes.length === 0 ? (
              <div className="text-muted-foreground text-sm">No routes configured.</div>
            ) : (
              routes.map((r) => (
                <div
                  key={r.capability}
                  className="flex items-center gap-3 py-2 border-b last:border-b-0"
                >
                  <Badge variant="outline" className="font-mono text-xs w-40 justify-start shrink-0">
                    {r.capability}
                  </Badge>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {r.provider_kind}
                  </Badge>
                  <code className="text-xs">{slugFor(r.provider_kind, r.default_provider_id)}</code>
                  {r.fallback_provider_ids?.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ArrowRight className="h-3 w-3" />
                      {r.fallback_provider_ids
                        .map((id) => slugFor(r.provider_kind, id))
                        .join(" → ")}
                    </div>
                  )}
                  <div className="flex-1" />
                  {r.enabled ? (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                      enabled
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-muted">
                      disabled
                    </Badge>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
  );
}
