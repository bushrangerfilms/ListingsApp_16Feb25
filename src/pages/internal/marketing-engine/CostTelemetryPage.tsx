import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

interface RawLog {
  capability: string;
  provider_slug: string;
  success: boolean;
  latency_ms: number | null;
  cost_usd: string | null;
  created_at: string;
}

interface ProviderRoll {
  provider_slug: string;
  capability: string;
  calls: number;
  successes: number;
  total_cost: number;
  avg_latency: number;
}

export default function CostTelemetryPage() {
  const navigate = useNavigate();

  const { data: logs } = useQuery<RawLog[]>({
    queryKey: ["telemetry-30d"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("media_generation_log")
        .select("capability, provider_slug, success, latency_ms, cost_usd, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
      return (data ?? []) as RawLog[];
    },
  });

  const rolls = rollupByProvider(logs ?? []);
  const totalCost = rolls.reduce((s, r) => s + r.total_cost, 0);
  const totalCalls = rolls.reduce((s, r) => s + r.calls, 0);
  const totalSuccesses = rolls.reduce((s, r) => s + r.successes, 0);

  const dailyCost = rollupDailyCost(logs ?? []);

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
            <h1 className="text-3xl font-bold tracking-tight">Cost &amp; Telemetry</h1>
            <p className="text-muted-foreground mt-1">
              Last 30 days. Rolled up from <code>media_generation_log</code>.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">Total cost</p>
              <p className="text-2xl font-semibold mt-1">${totalCost.toFixed(4)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">Total calls</p>
              <p className="text-2xl font-semibold mt-1">{totalCalls}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">Success rate</p>
              <p className="text-2xl font-semibold mt-1">
                {totalCalls
                  ? `${((totalSuccesses / totalCalls) * 100).toFixed(1)}%`
                  : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>By provider</CardTitle>
            <CardDescription>Calls, success rate, total cost, mean latency.</CardDescription>
          </CardHeader>
          <CardContent>
            {rolls.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No router calls in last 30d.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Capability</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Success</TableHead>
                    <TableHead className="text-right">Total cost</TableHead>
                    <TableHead className="text-right">Avg latency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rolls.map((r) => (
                    <TableRow key={`${r.provider_slug}-${r.capability}`}>
                      <TableCell className="font-mono text-xs">{r.provider_slug}</TableCell>
                      <TableCell className="text-xs">{r.capability}</TableCell>
                      <TableCell className="text-right text-xs">{r.calls}</TableCell>
                      <TableCell className="text-right text-xs">
                        {r.calls
                          ? `${((r.successes / r.calls) * 100).toFixed(0)}%`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        ${r.total_cost.toFixed(6)}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {Math.round(r.avg_latency)}ms
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
            <CardTitle>Daily cost (last 14d)</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyCost.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No data.</p>
            ) : (
              <div className="space-y-1">
                {dailyCost.slice(-14).map((d) => (
                  <div key={d.date} className="flex items-center gap-3 text-xs">
                    <span className="w-24 text-muted-foreground">{d.date}</span>
                    <div className="flex-1 bg-muted h-4 rounded">
                      <div
                        className="bg-primary h-4 rounded"
                        style={{
                          width: `${Math.min(100, (d.cost / Math.max(...dailyCost.map((x) => x.cost), 0.001)) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-24 text-right font-mono">${d.cost.toFixed(6)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
}

function rollupByProvider(logs: RawLog[]): ProviderRoll[] {
  const map = new Map<string, ProviderRoll>();
  for (const l of logs) {
    const key = `${l.provider_slug}::${l.capability}`;
    let row = map.get(key);
    if (!row) {
      row = {
        provider_slug: l.provider_slug,
        capability: l.capability,
        calls: 0,
        successes: 0,
        total_cost: 0,
        avg_latency: 0,
      };
      map.set(key, row);
    }
    row.calls += 1;
    if (l.success) row.successes += 1;
    row.total_cost += Number(l.cost_usd ?? 0);
    if (l.latency_ms !== null) {
      row.avg_latency = (row.avg_latency * (row.calls - 1) + l.latency_ms) / row.calls;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total_cost - a.total_cost);
}

function rollupDailyCost(logs: RawLog[]): { date: string; cost: number }[] {
  const map = new Map<string, number>();
  for (const l of logs) {
    const date = l.created_at.slice(0, 10);
    map.set(date, (map.get(date) ?? 0) + Number(l.cost_usd ?? 0));
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, cost]) => ({ date, cost }));
}
