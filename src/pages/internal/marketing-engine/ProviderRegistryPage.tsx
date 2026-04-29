import { useQuery, useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type ProviderStatus = "active" | "disabled" | "testing" | "quarantined";

interface MediaProvider {
  id: string;
  slug: string;
  display_name: string;
  capability: string;
  aggregator: string;
  status: ProviderStatus;
  cost_per_unit: number | null;
  cost_unit: string | null;
  consecutive_failures: number;
  last_verified_at: string | null;
}

interface LlmProvider {
  id: string;
  slug: string;
  display_name: string;
  vendor: string;
  status: ProviderStatus;
  cost_per_1m_tokens_in: number | null;
  cost_per_1m_tokens_out: number | null;
  context_length: number | null;
  consecutive_failures: number;
  last_verified_at: string | null;
}

const STATUS_TONE: Record<ProviderStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  testing: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  disabled: "bg-muted text-muted-foreground",
  quarantined: "bg-red-500/10 text-red-600 border-red-500/20",
};

export default function ProviderRegistryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: media } = useQuery<MediaProvider[]>({
    queryKey: ["media-providers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("media_providers")
        .select(
          "id, slug, display_name, capability, aggregator, status, cost_per_unit, cost_unit, consecutive_failures, last_verified_at",
        )
        .order("capability")
        .order("slug");
      return (data ?? []) as MediaProvider[];
    },
  });

  const { data: llm } = useQuery<LlmProvider[]>({
    queryKey: ["llm-providers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("llm_providers")
        .select(
          "id, slug, display_name, vendor, status, cost_per_1m_tokens_in, cost_per_1m_tokens_out, context_length, consecutive_failures, last_verified_at",
        )
        .order("vendor")
        .order("slug");
      return (data ?? []) as LlmProvider[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({
      table,
      id,
      next,
    }: {
      table: "media_providers" | "llm_providers";
      id: string;
      next: ProviderStatus;
    }) => {
      const { error } = await supabase.from(table).update({ status: next }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: [vars.table === "media_providers" ? "media-providers" : "llm-providers"],
      });
      toast.success("Status updated");
    },
    onError: (err: Error) => {
      toast.error("Update failed", { description: err.message });
    },
  });

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
            <h1 className="text-3xl font-bold tracking-tight">Provider Registry</h1>
            <p className="text-muted-foreground mt-1">
              Media + LLM providers with status, costs, and failure counts.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Media providers</CardTitle>
            <CardDescription>
              Video, image, voice, transcription, matting, social-publish.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!media ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Slug</TableHead>
                    <TableHead>Capability</TableHead>
                    <TableHead>Aggregator</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fails</TableHead>
                    <TableHead className="text-right">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {media.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-mono text-xs">{p.slug}</div>
                        <div className="text-xs text-muted-foreground">{p.display_name}</div>
                      </TableCell>
                      <TableCell className="text-xs">{p.capability}</TableCell>
                      <TableCell className="text-xs">{p.aggregator}</TableCell>
                      <TableCell className="text-xs">
                        {p.cost_per_unit !== null
                          ? `$${Number(p.cost_per_unit).toFixed(6)}/${p.cost_unit ?? "unit"}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_TONE[p.status]}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{p.consecutive_failures}</TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={p.status === "active" || p.status === "testing"}
                          onCheckedChange={(v) =>
                            toggle.mutate({
                              table: "media_providers",
                              id: p.id,
                              next: v ? "active" : "disabled",
                            })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>LLM providers</CardTitle>
            <CardDescription>
              Orchestrator, strategist, producer, scriptwriter, critic, analyst.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!llm ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Slug</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>In / Out (per 1M)</TableHead>
                    <TableHead>Context</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fails</TableHead>
                    <TableHead className="text-right">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {llm.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-mono text-xs">{p.slug}</div>
                        <div className="text-xs text-muted-foreground">{p.display_name}</div>
                      </TableCell>
                      <TableCell className="text-xs">{p.vendor}</TableCell>
                      <TableCell className="text-xs">
                        ${Number(p.cost_per_1m_tokens_in ?? 0).toFixed(2)} / $
                        {Number(p.cost_per_1m_tokens_out ?? 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {p.context_length ? `${(p.context_length / 1000).toFixed(0)}K` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_TONE[p.status]}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{p.consecutive_failures}</TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={p.status === "active" || p.status === "testing"}
                          onCheckedChange={(v) =>
                            toggle.mutate({
                              table: "llm_providers",
                              id: p.id,
                              next: v ? "active" : "disabled",
                            })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
  );
}
