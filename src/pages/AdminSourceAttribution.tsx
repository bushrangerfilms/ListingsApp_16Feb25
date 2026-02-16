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
  PieChart,
  Pie,
  Cell,
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
} from "recharts";
import { Target, TrendingUp, Users, ArrowUpDown } from "lucide-react";

interface SourceMetrics {
  source: string;
  totalLeads: number;
  buyers: number;
  sellers: number;
  activeLeads: number;
  convertedLeads: number;
  conversionRate: number;
  avgTimeToConvert: number;
  recentTrend: number[];
}

interface TimeSeriesSource {
  date: string;
  [key: string]: string | number;
}

type SortKey = "totalLeads" | "conversionRate" | "activeLeads" | "buyers" | "sellers";
type SortDirection = "asc" | "desc";

export default function AdminSourceAttribution() {
  const [sourceMetrics, setSourceMetrics] = useState<SourceMetrics[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("totalLeads");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    fetchSourceAnalytics();
  }, []);

  const fetchSourceAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch all buyers and sellers
      const { data: buyers } = await supabase
        .from("buyer_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: sellers } = await supabase
        .from("seller_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      const allBuyers = buyers || [];
      const allSellers = sellers || [];

      // Group by source
      const sourceMap = new Map<string, any>();

      // Process buyers
      allBuyers.forEach((buyer) => {
        const source = buyer.source || "unknown";
        if (!sourceMap.has(source)) {
          sourceMap.set(source, {
            buyers: [],
            sellers: [],
          });
        }
        sourceMap.get(source)!.buyers.push(buyer);
      });

      // Process sellers
      allSellers.forEach((seller) => {
        const source = seller.source || "unknown";
        if (!sourceMap.has(source)) {
          sourceMap.set(source, {
            buyers: [],
            sellers: [],
          });
        }
        sourceMap.get(source)!.sellers.push(seller);
      });

      // Calculate metrics for each source
      const metrics: SourceMetrics[] = Array.from(sourceMap.entries()).map(
        ([source, data]) => {
          const buyersList = data.buyers;
          const sellersList = data.sellers;
          const totalLeads = buyersList.length + sellersList.length;

          // Active = not lost
          const activeBuyers = buyersList.filter((b: any) => b.stage !== "lost").length;
          const activeSellers = sellersList.filter((s: any) => s.stage !== "lost").length;
          const activeLeads = activeBuyers + activeSellers;

          // Converted = purchased or sold
          const convertedBuyers = buyersList.filter((b: any) => b.stage === "purchased").length;
          const convertedSellers = sellersList.filter((s: any) => s.stage === "sold").length;
          const convertedLeads = convertedBuyers + convertedSellers;

          const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

          // Get 7-day trend
          const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            return date.toISOString().split("T")[0];
          });

          const recentTrend = last7Days.map((date) => {
            const dayBuyers = buyersList.filter((b: any) => b.created_at?.startsWith(date))
              .length;
            const daySellers = sellersList.filter((s: any) => s.created_at?.startsWith(date))
              .length;
            return dayBuyers + daySellers;
          });

          return {
            source: source.charAt(0).toUpperCase() + source.slice(1),
            totalLeads,
            buyers: buyersList.length,
            sellers: sellersList.length,
            activeLeads,
            convertedLeads,
            conversionRate,
            avgTimeToConvert: 0, // Would need to track this with timestamps
            recentTrend,
          };
        }
      );

      setSourceMetrics(metrics);

      // Build time series data (last 30 days)
      const timeSeries: TimeSeriesSource[] = [];
      const sources = Array.from(sourceMap.keys());

      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        const dataPoint: TimeSeriesSource = {
          date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        };

        sources.forEach((source) => {
          const data = sourceMap.get(source);
          const dayCount =
            data.buyers.filter((b: any) => b.created_at?.startsWith(dateStr)).length +
            data.sellers.filter((s: any) => s.created_at?.startsWith(dateStr)).length;
          dataPoint[source] = dayCount;
        });

        timeSeries.push(dataPoint);
      }

      setTimeSeriesData(timeSeries);
    } catch (error) {
      console.error("Error fetching source analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  const sortedMetrics = [...sourceMetrics].sort((a, b) => {
    const aValue = a[sortKey];
    const bValue = b[sortKey];
    const multiplier = sortDirection === "asc" ? 1 : -1;
    return (aValue > bValue ? 1 : -1) * multiplier;
  });

  const totalLeads = sourceMetrics.reduce((sum, m) => sum + m.totalLeads, 0);
  const totalConverted = sourceMetrics.reduce((sum, m) => sum + m.convertedLeads, 0);
  const overallConversionRate = totalLeads > 0 ? (totalConverted / totalLeads) * 100 : 0;
  const topSource = sortedMetrics.length > 0 ? sortedMetrics[0].source : "N/A";

  const COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--secondary))",
    "hsl(var(--accent))",
    "hsl(var(--muted))",
    "#8884d8",
    "#82ca9d",
    "#ffc658",
    "#ff8042",
  ];

  const pieData = sourceMetrics.map((m) => ({
    name: m.source,
    value: m.totalLeads,
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
            <h1 className="text-3xl font-bold">Lead Source Attribution</h1>
            <p className="text-muted-foreground">Track and analyse where your leads come from</p>
          </div>
          <Button onClick={fetchSourceAnalytics}>
            <Target className="mr-2 h-4 w-4" />
            Refresh Data
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalLeads}</div>
              <p className="text-xs text-muted-foreground">
                From {sourceMetrics.length} different sources
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Overall Conversion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallConversionRate.toFixed(2)}%</div>
              <p className="text-xs text-muted-foreground">
                {totalConverted} converted leads
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Top Performing Source</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{topSource}</div>
              <p className="text-xs text-muted-foreground">
                {sortedMetrics[0]?.totalLeads || 0} leads generated
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Tables */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance Table</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Lead Distribution by Source</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={100}
                        fill="hsl(var(--primary))"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Conversion Rate by Source</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={sortedMetrics.slice(0, 5)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="source" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="conversionRate" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Source Performance Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={sortedMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="source" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="buyers" fill="hsl(var(--primary))" name="Buyers" />
                    <Bar dataKey="sellers" fill="hsl(var(--secondary))" name="Sellers" />
                    <Bar dataKey="activeLeads" fill="hsl(var(--accent))" name="Active" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance">
            <Card>
              <CardHeader>
                <CardTitle>Source Performance Table</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead
                        className="cursor-pointer"
                        onClick={() => handleSort("totalLeads")}
                      >
                        <div className="flex items-center gap-1">
                          Total Leads
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer"
                        onClick={() => handleSort("buyers")}
                      >
                        <div className="flex items-center gap-1">
                          Buyers
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer"
                        onClick={() => handleSort("sellers")}
                      >
                        <div className="flex items-center gap-1">
                          Sellers
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer"
                        onClick={() => handleSort("activeLeads")}
                      >
                        <div className="flex items-center gap-1">
                          Active
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead>Converted</TableHead>
                      <TableHead
                        className="cursor-pointer"
                        onClick={() => handleSort("conversionRate")}
                      >
                        <div className="flex items-center gap-1">
                          Conversion %
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedMetrics.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No source data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedMetrics.map((source) => (
                        <TableRow key={source.source}>
                          <TableCell className="font-medium">{source.source}</TableCell>
                          <TableCell>{source.totalLeads}</TableCell>
                          <TableCell>{source.buyers}</TableCell>
                          <TableCell>{source.sellers}</TableCell>
                          <TableCell>{source.activeLeads}</TableCell>
                          <TableCell>{source.convertedLeads}</TableCell>
                          <TableCell>
                            <span className="font-semibold text-primary">
                              {source.conversionRate.toFixed(2)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends">
            <Card>
              <CardHeader>
                <CardTitle>Lead Source Trends (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {sourceMetrics.map((source, index) => (
                      <Line
                        key={source.source}
                        type="monotone"
                        dataKey={source.source.toLowerCase()}
                        stroke={COLORS[index % COLORS.length]}
                        name={source.source}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {sortedMetrics.slice(0, 4).map((source, index) => (
                <Card key={source.source}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      {source.source}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={150}>
                      <LineChart
                        data={source.recentTrend.map((count, i) => ({
                          day: `Day ${i + 1}`,
                          leads: count,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="leads"
                          stroke={COLORS[index % COLORS.length]}
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-3 gap-2 mt-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-semibold">{source.totalLeads}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Active</p>
                        <p className="font-semibold">{source.activeLeads}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Conv. Rate</p>
                        <p className="font-semibold">{source.conversionRate.toFixed(1)}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
