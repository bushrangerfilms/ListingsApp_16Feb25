import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { PlatformHeader } from "@/components/PlatformHeader";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  FunnelChart,
  Funnel,
  LabelList,
} from "recharts";
import { TrendingDown, Clock, Users, ArrowRight } from "lucide-react";

interface StageMetrics {
  stage: string;
  count: number;
  percentage: number;
  avgDaysInStage: number;
  conversionToNext: number;
  dropOffRate: number;
}

interface FunnelData {
  name: string;
  value: number;
  fill: string;
}

const BUYER_STAGES = [
  { key: "lead", label: "Lead", color: "hsl(var(--chart-1))" },
  { key: "qualified", label: "Qualified", color: "hsl(var(--chart-2))" },
  { key: "viewing_scheduled", label: "Viewing Scheduled", color: "hsl(var(--chart-3))" },
  { key: "viewed", label: "Viewed", color: "hsl(var(--chart-4))" },
  { key: "offer_made", label: "Offer Made", color: "hsl(var(--chart-5))" },
  { key: "sale_agreed", label: "Sale Agreed", color: "hsl(210, 100%, 50%)" },
  { key: "purchased", label: "Purchased", color: "hsl(142, 76%, 36%)" },
];

const SELLER_STAGES = [
  { key: "lead", label: "Lead", color: "hsl(var(--chart-1))" },
  { key: "valuation_scheduled", label: "Valuation Scheduled", color: "hsl(var(--chart-2))" },
  { key: "valuation_complete", label: "Valuation Complete", color: "hsl(var(--chart-3))" },
  { key: "listed", label: "Listed", color: "hsl(var(--chart-4))" },
  { key: "under_offer", label: "Under Offer", color: "hsl(var(--chart-5))" },
  { key: "sold", label: "Sold", color: "hsl(142, 76%, 36%)" },
];

export default function AdminFunnelAnalytics() {
  const [buyerMetrics, setBuyerMetrics] = useState<StageMetrics[]>([]);
  const [sellerMetrics, setSellerMetrics] = useState<StageMetrics[]>([]);
  const [buyerFunnelData, setBuyerFunnelData] = useState<FunnelData[]>([]);
  const [sellerFunnelData, setSellerFunnelData] = useState<FunnelData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFunnelAnalytics();
  }, []);

  const calculateStageMetrics = (profiles: any[], stages: any[]): StageMetrics[] => {
    const totalProfiles = profiles.length;
    const stageGroups = new Map<string, any[]>();

    // Group profiles by stage
    profiles.forEach((profile) => {
      const stage = profile.stage;
      if (!stageGroups.has(stage)) {
        stageGroups.set(stage, []);
      }
      stageGroups.get(stage)!.push(profile);
    });

    // Calculate metrics for each stage
    return stages.map((stageInfo, index) => {
      const profilesInStage = stageGroups.get(stageInfo.key) || [];
      const count = profilesInStage.length;
      const percentage = totalProfiles > 0 ? (count / totalProfiles) * 100 : 0;

      // Calculate average days in stage
      const now = new Date();
      const avgDaysInStage = profilesInStage.length > 0
        ? profilesInStage.reduce((sum, profile) => {
            const createdAt = new Date(profile.created_at);
            const daysInStage = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
            return sum + daysInStage;
          }, 0) / profilesInStage.length
        : 0;

      // Calculate conversion to next stage (simplified - would need historical data for accurate calculation)
      const nextStage = stages[index + 1];
      const nextStageCount = nextStage ? (stageGroups.get(nextStage.key) || []).length : 0;
      const conversionToNext = count > 0 ? (nextStageCount / count) * 100 : 0;

      // Calculate drop-off rate
      const dropOffRate = 100 - conversionToNext;

      return {
        stage: stageInfo.label,
        count,
        percentage,
        avgDaysInStage,
        conversionToNext,
        dropOffRate,
      };
    });
  };

  const fetchFunnelAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch all buyers and sellers (excluding lost)
      const { data: buyers } = await supabase
        .from("buyer_profiles")
        .select("*")
        .neq("stage", "lost")
        .order("created_at", { ascending: false });

      const { data: sellers } = await supabase
        .from("seller_profiles")
        .select("*")
        .neq("stage", "lost")
        .order("created_at", { ascending: false });

      const allBuyers = buyers || [];
      const allSellers = sellers || [];

      // Calculate metrics
      const buyerStageMetrics = calculateStageMetrics(allBuyers, BUYER_STAGES);
      const sellerStageMetrics = calculateStageMetrics(allSellers, SELLER_STAGES);

      setBuyerMetrics(buyerStageMetrics);
      setSellerMetrics(sellerStageMetrics);

      // Prepare funnel chart data
      const buyerFunnel: FunnelData[] = BUYER_STAGES.map((stage) => {
        const metric = buyerStageMetrics.find((m) => m.stage === stage.label);
        return {
          name: stage.label,
          value: metric?.count || 0,
          fill: stage.color,
        };
      }).filter((d) => d.value > 0);

      const sellerFunnel: FunnelData[] = SELLER_STAGES.map((stage) => {
        const metric = sellerStageMetrics.find((m) => m.stage === stage.label);
        return {
          name: stage.label,
          value: metric?.count || 0,
          fill: stage.color,
        };
      }).filter((d) => d.value > 0);

      setBuyerFunnelData(buyerFunnel);
      setSellerFunnelData(sellerFunnel);
    } catch (error) {
      console.error("Error fetching funnel analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalBuyers = buyerMetrics.reduce((sum, m) => sum + m.count, 0);
  const totalSellers = sellerMetrics.reduce((sum, m) => sum + m.count, 0);
  const buyerConversionRate = buyerMetrics.length > 0
    ? (buyerMetrics[buyerMetrics.length - 1]?.count / totalBuyers) * 100
    : 0;
  const sellerConversionRate = sellerMetrics.length > 0
    ? (sellerMetrics[sellerMetrics.length - 1]?.count / totalSellers) * 100
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PlatformHeader />
        <main className="container mx-auto p-6">
          <div className="space-y-6">
            <Skeleton className="h-12 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
            <Skeleton className="h-96" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PlatformHeader />
      <main className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Sales Funnel Analytics</h1>
            <p className="text-muted-foreground">Track lead progression through pipeline stages</p>
          </div>
          <Button onClick={fetchFunnelAnalytics}>
            <TrendingDown className="mr-2 h-4 w-4" />
            Refresh Data
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Active Buyers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalBuyers}</div>
              <p className="text-xs text-muted-foreground">
                {buyerConversionRate.toFixed(1)}% conversion to purchased
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Active Sellers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSellers}</div>
              <p className="text-xs text-muted-foreground">
                {sellerConversionRate.toFixed(1)}% conversion to sold
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Time in Pipeline</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(
                  (buyerMetrics.reduce((sum, m) => sum + m.avgDaysInStage, 0) +
                    sellerMetrics.reduce((sum, m) => sum + m.avgDaysInStage, 0)) /
                  (buyerMetrics.length + sellerMetrics.length)
                ).toFixed(0)}{" "}
                days
              </div>
              <p className="text-xs text-muted-foreground">Average across all stages</p>
            </CardContent>
          </Card>
        </div>

        {/* Funnel Visualization */}
        <Tabs defaultValue="buyers" className="space-y-6">
          <TabsList>
            <TabsTrigger value="buyers">Buyer Funnel</TabsTrigger>
            <TabsTrigger value="sellers">Seller Funnel</TabsTrigger>
          </TabsList>

          <TabsContent value="buyers" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Buyer Pipeline Funnel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={buyerMetrics} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="stage" type="category" width={150} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))">
                        {buyerMetrics.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={BUYER_STAGES[index]?.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="space-y-3">
                    {buyerMetrics.map((metric, index) => (
                      <div
                        key={metric.stage}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: BUYER_STAGES[index]?.color }}
                          />
                          <div>
                            <p className="font-semibold">{metric.stage}</p>
                            <p className="text-sm text-muted-foreground">
                              {metric.count} buyers ({metric.percentage.toFixed(1)}%)
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {metric.avgDaysInStage.toFixed(0)} days
                          </p>
                          <p className="text-xs text-muted-foreground">avg time</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Stage Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {buyerMetrics.map((metric, index) => {
                    const isLastStage = index === buyerMetrics.length - 1;
                    return (
                      <div key={metric.stage} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{metric.stage}</span>
                            <span className="text-sm text-muted-foreground">
                              ({metric.count} buyers)
                            </span>
                          </div>
                          {!isLastStage && (
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        {!isLastStage && (
                          <div className="pl-4 space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Conversion to next:</span>
                              <span className="font-medium text-green-600">
                                {metric.conversionToNext.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Drop-off rate:</span>
                              <span className="font-medium text-red-600">
                                {metric.dropOffRate.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sellers" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Seller Pipeline Funnel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={sellerMetrics} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="stage" type="category" width={150} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--secondary))">
                        {sellerMetrics.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={SELLER_STAGES[index]?.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="space-y-3">
                    {sellerMetrics.map((metric, index) => (
                      <div
                        key={metric.stage}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: SELLER_STAGES[index]?.color }}
                          />
                          <div>
                            <p className="font-semibold">{metric.stage}</p>
                            <p className="text-sm text-muted-foreground">
                              {metric.count} sellers ({metric.percentage.toFixed(1)}%)
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {metric.avgDaysInStage.toFixed(0)} days
                          </p>
                          <p className="text-xs text-muted-foreground">avg time</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Stage Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sellerMetrics.map((metric, index) => {
                    const isLastStage = index === sellerMetrics.length - 1;
                    return (
                      <div key={metric.stage} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{metric.stage}</span>
                            <span className="text-sm text-muted-foreground">
                              ({metric.count} sellers)
                            </span>
                          </div>
                          {!isLastStage && (
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        {!isLastStage && (
                          <div className="pl-4 space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Conversion to next:</span>
                              <span className="font-medium text-green-600">
                                {metric.conversionToNext.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Drop-off rate:</span>
                              <span className="font-medium text-red-600">
                                {metric.dropOffRate.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
