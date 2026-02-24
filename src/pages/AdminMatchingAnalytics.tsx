import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { PlatformHeader } from "@/components/PlatformHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Target, TrendingUp, Users, CheckCircle2, AlertCircle } from "lucide-react";

interface MatchMetrics {
  totalMatches: number;
  emailedMatches: number;
  openedMatches: number;
  clickedMatches: number;
  emailOpenRate: number;
  clickThroughRate: number;
  conversionRate: number;
}

interface CriteriaEffectiveness {
  criteria: string;
  matchCount: number;
  successRate: number;
  avgEngagement: number;
}

interface BuyerMatchHistory {
  buyerId: string;
  buyerName: string;
  totalMatches: number;
  emailedMatches: number;
  engagedMatches: number;
  stage: string;
  matchSuccessRate: number;
}

interface TimeSeriesMatch {
  date: string;
  matches: number;
  engaged: number;
}

export default function AdminMatchingAnalytics() {
  const [matchMetrics, setMatchMetrics] = useState<MatchMetrics | null>(null);
  const [criteriaData, setCriteriaData] = useState<CriteriaEffectiveness[]>([]);
  const [buyerHistory, setBuyerHistory] = useState<BuyerMatchHistory[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatchingAnalytics();
  }, []);

  const fetchMatchingAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch all buyer-listing matches
      const { data: matches } = await supabase
        .from("buyer_listing_matches")
        .select("email_sent_at, email_opened_at, buyer_clicked_at, created_at, property_alert_id")
        .order("created_at", { ascending: false })
        .limit(5000);

      // Fetch buyer profiles
      const { data: buyers } = await supabase
        .from("buyer_profiles")
        .select("id, name, bedrooms_required, budget_min, budget_max, stage, property_alert_id")
        .limit(5000);

      // Fetch property alerts (alternative matching mechanism)
      const { data: alerts } = await supabase
        .from("property_alerts")
        .select("id")
        .limit(5000);

      const allMatches = matches || [];
      const allBuyers = buyers || [];
      const allAlerts = alerts || [];

      // Calculate overall match metrics
      const totalMatches = allMatches.length;
      const emailedMatches = allMatches.filter((m) => m.email_sent_at).length;
      const openedMatches = allMatches.filter((m) => m.email_opened_at).length;
      const clickedMatches = allMatches.filter((m) => m.buyer_clicked_at).length;

      const emailOpenRate = emailedMatches > 0 ? (openedMatches / emailedMatches) * 100 : 0;
      const clickThroughRate = emailedMatches > 0 ? (clickedMatches / emailedMatches) * 100 : 0;
      const conversionRate = totalMatches > 0 ? (clickedMatches / totalMatches) * 100 : 0;

      setMatchMetrics({
        totalMatches,
        emailedMatches,
        openedMatches,
        clickedMatches,
        emailOpenRate,
        clickThroughRate,
        conversionRate,
      });

      // Analyze criteria effectiveness
      const criteriaMap = new Map<string, { total: number; engaged: number }>();

      // Analyze bedroom requirements
      allBuyers.forEach((buyer) => {
        if (buyer.bedrooms_required && Array.isArray(buyer.bedrooms_required)) {
          const bedroomStr = buyer.bedrooms_required.join(",");
          const key = `${bedroomStr} bedrooms`;
          if (!criteriaMap.has(key)) {
            criteriaMap.set(key, { total: 0, engaged: 0 });
          }
          const data = criteriaMap.get(key)!;
          data.total++;

          // Check if buyer has engaged with matches
          const buyerMatches = allMatches.filter((m) => {
            const alert = allAlerts.find((a) => a.id === m.property_alert_id);
            return alert && allBuyers.find((b) => b.property_alert_id === alert.id)?.id === buyer.id;
          });
          if (buyerMatches.some((m) => m.buyer_clicked_at)) {
            data.engaged++;
          }
        }
      });

      // Budget ranges
      const budgetRanges = [
        { min: 0, max: 200000, label: "Under €200k" },
        { min: 200000, max: 300000, label: "€200k-€300k" },
        { min: 300000, max: 500000, label: "€300k-€500k" },
        { min: 500000, max: 1000000, label: "€500k-€1M" },
        { min: 1000000, max: Infinity, label: "Over €1M" },
      ];

      budgetRanges.forEach((range) => {
        const buyersInRange = allBuyers.filter(
          (b) =>
            b.budget_min !== null &&
            b.budget_max !== null &&
            b.budget_min >= range.min &&
            b.budget_max <= range.max
        );
        if (buyersInRange.length > 0) {
          const engaged = buyersInRange.filter((buyer) => {
            const buyerMatches = allMatches.filter((m) => {
              const alert = allAlerts.find((a) => a.id === m.property_alert_id);
              return alert && allBuyers.find((b) => b.property_alert_id === alert.id)?.id === buyer.id;
            });
            return buyerMatches.some((m) => m.buyer_clicked_at);
          }).length;

          criteriaMap.set(range.label, { total: buyersInRange.length, engaged });
        }
      });

      const criteriaEffectiveness: CriteriaEffectiveness[] = Array.from(
        criteriaMap.entries()
      ).map(([criteria, data]) => ({
        criteria,
        matchCount: data.total,
        successRate: data.total > 0 ? (data.engaged / data.total) * 100 : 0,
        avgEngagement: data.total > 0 ? (data.engaged / data.total) * 100 : 0,
      }));

      setCriteriaData(criteriaEffectiveness.sort((a, b) => b.matchCount - a.matchCount));

      // Build buyer match history
      const buyerMatchHistoryData: BuyerMatchHistory[] = allBuyers.map((buyer) => {
        const alert = allAlerts.find((a) => a.id === buyer.property_alert_id);
        const buyerMatches = allMatches.filter((m) => m.property_alert_id === alert?.id);
        
        const totalMatches = buyerMatches.length;
        const emailedMatches = buyerMatches.filter((m) => m.email_sent_at).length;
        const engagedMatches = buyerMatches.filter(
          (m) => m.email_opened_at || m.buyer_clicked_at
        ).length;
        const matchSuccessRate = totalMatches > 0 ? (engagedMatches / totalMatches) * 100 : 0;

        return {
          buyerId: buyer.id,
          buyerName: buyer.name,
          totalMatches,
          emailedMatches,
          engagedMatches,
          stage: buyer.stage,
          matchSuccessRate,
        };
      }).filter((b) => b.totalMatches > 0);

      setBuyerHistory(buyerMatchHistoryData.sort((a, b) => b.totalMatches - a.totalMatches));

      // Build time series data (last 30 days)
      const timeSeries: TimeSeriesMatch[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        const dayMatches = allMatches.filter((m) => m.created_at?.startsWith(dateStr)).length;
        const dayEngaged = allMatches.filter(
          (m) =>
            (m.email_opened_at?.startsWith(dateStr) || m.buyer_clicked_at?.startsWith(dateStr))
        ).length;

        timeSeries.push({
          date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          matches: dayMatches,
          engaged: dayEngaged,
        });
      }

      setTimeSeriesData(timeSeries);
    } catch (error) {
      console.error("Error fetching matching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--secondary))",
    "hsl(var(--accent))",
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
  ];

  const stageDistribution = buyerHistory.reduce((acc, buyer) => {
    const stage = buyer.stage;
    if (!acc[stage]) {
      acc[stage] = 0;
    }
    acc[stage]++;
    return acc;
  }, {} as Record<string, number>);

  const stageData = Object.entries(stageDistribution).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, " "),
    value,
  }));

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
            <h1 className="text-3xl font-bold">Buyer-Seller Matching Analytics</h1>
            <p className="text-muted-foreground">
              Track match quality and buyer engagement with listings
            </p>
          </div>
          <Button onClick={fetchMatchingAnalytics}>
            <Target className="mr-2 h-4 w-4" />
            Refresh Data
          </Button>
        </div>

        {/* Summary Cards */}
        {matchMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Matches Created</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{matchMetrics.totalMatches}</div>
                <p className="text-xs text-muted-foreground">
                  {matchMetrics.emailedMatches} notified via email
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Email Open Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{matchMetrics.emailOpenRate.toFixed(2)}%</div>
                <p className="text-xs text-muted-foreground">
                  {matchMetrics.openedMatches} emails opened
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Click-Through Rate</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {matchMetrics.clickThroughRate.toFixed(2)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {matchMetrics.clickedMatches} buyers engaged
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Analytics Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="criteria">Criteria Effectiveness</TabsTrigger>
            <TabsTrigger value="buyers">Buyer Engagement</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Matching Activity Trend (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="matches"
                      stroke="hsl(var(--primary))"
                      name="Matches Created"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="engaged"
                      stroke="hsl(var(--secondary))"
                      name="Buyer Engaged"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Match Funnel</CardTitle>
                </CardHeader>
                <CardContent>
                  {matchMetrics && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <span className="font-semibold">Matches Created</span>
                        <span className="text-2xl font-bold">{matchMetrics.totalMatches}</span>
                      </div>
                      <div className="flex items-center justify-center">↓</div>
                      <div className="flex items-center justify-between p-4 border rounded-lg bg-primary/5">
                        <span className="font-semibold">Emails Sent</span>
                        <span className="text-2xl font-bold">{matchMetrics.emailedMatches}</span>
                      </div>
                      <div className="flex items-center justify-center">↓</div>
                      <div className="flex items-center justify-between p-4 border rounded-lg bg-secondary/5">
                        <span className="font-semibold">Emails Opened</span>
                        <span className="text-2xl font-bold">{matchMetrics.openedMatches}</span>
                      </div>
                      <div className="flex items-center justify-center">↓</div>
                      <div className="flex items-center justify-between p-4 border rounded-lg bg-accent/10">
                        <span className="font-semibold">Buyers Clicked</span>
                        <span className="text-2xl font-bold text-accent">
                          {matchMetrics.clickedMatches}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Buyers by Stage</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={stageData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={100}
                        fill="hsl(var(--primary))"
                        dataKey="value"
                      >
                        {stageData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="criteria">
            <Card>
              <CardHeader>
                <CardTitle>Matching Criteria Effectiveness</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Criteria</TableHead>
                      <TableHead>Total Buyers</TableHead>
                      <TableHead>Success Rate</TableHead>
                      <TableHead>Avg Engagement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {criteriaData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No criteria data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      criteriaData.map((criteria) => (
                        <TableRow key={criteria.criteria}>
                          <TableCell className="font-medium">{criteria.criteria}</TableCell>
                          <TableCell>{criteria.matchCount}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-primary">
                                {criteria.successRate.toFixed(1)}%
                              </span>
                              {criteria.successRate > 50 ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-amber-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{criteria.avgEngagement.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                <div className="mt-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={criteriaData.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="criteria" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="matchCount" fill="hsl(var(--primary))" name="Buyers" />
                      <Bar dataKey="successRate" fill="hsl(var(--secondary))" name="Success Rate %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="buyers">
            <Card>
              <CardHeader>
                <CardTitle>Buyer Match Engagement History</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Buyer Name</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Total Matches</TableHead>
                      <TableHead>Emailed</TableHead>
                      <TableHead>Engaged</TableHead>
                      <TableHead>Success Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {buyerHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No buyer match history available
                        </TableCell>
                      </TableRow>
                    ) : (
                      buyerHistory.slice(0, 20).map((buyer) => (
                        <TableRow key={buyer.buyerId}>
                          <TableCell className="font-medium">{buyer.buyerName}</TableCell>
                          <TableCell>
                            <span className="capitalize">
                              {buyer.stage.replace(/_/g, " ")}
                            </span>
                          </TableCell>
                          <TableCell>{buyer.totalMatches}</TableCell>
                          <TableCell>{buyer.emailedMatches}</TableCell>
                          <TableCell>{buyer.engagedMatches}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-primary">
                                {buyer.matchSuccessRate.toFixed(1)}%
                              </span>
                              {buyer.matchSuccessRate > 30 ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : buyer.matchSuccessRate > 0 ? (
                                <AlertCircle className="h-4 w-4 text-amber-500" />
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Top Engaged Buyers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {buyerHistory
                    .filter((b) => b.engagedMatches > 0)
                    .sort((a, b) => b.matchSuccessRate - a.matchSuccessRate)
                    .slice(0, 5)
                    .map((buyer) => (
                      <div
                        key={buyer.buyerId}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div>
                          <p className="font-semibold">{buyer.buyerName}</p>
                          <p className="text-sm text-muted-foreground">
                            {buyer.engagedMatches} of {buyer.totalMatches} matches engaged
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">
                            {buyer.matchSuccessRate.toFixed(0)}%
                          </p>
                          <p className="text-xs text-muted-foreground">success rate</p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
