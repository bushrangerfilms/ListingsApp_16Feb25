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
import { Users, Clock, CheckCircle2, TrendingUp, Activity } from "lucide-react";

interface PerformanceMetrics {
  totalActivities: number;
  activitiesThisWeek: number;
  activitiesThisMonth: number;
  avgResponseTime: number;
  completionRate: number;
}

interface ActivityBreakdown {
  type: string;
  count: number;
  percentage: number;
}

interface TimeSeriesActivity {
  date: string;
  activities: number;
  emails: number;
  statusUpdates: number;
}

interface ResponseTimeMetrics {
  enquiries: number;
  valuations: number;
  avgEnquiryResponse: number;
  avgValuationResponse: number;
}

export default function AdminTeamPerformance() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [activityBreakdown, setActivityBreakdown] = useState<ActivityBreakdown[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesActivity[]>([]);
  const [responseMetrics, setResponseMetrics] = useState<ResponseTimeMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPerformanceData();
  }, []);

  const fetchPerformanceData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Fetch CRM activities
      const { data: activities } = await supabase
        .from("crm_activities")
        .select("*")
        .order("created_at", { ascending: false });

      // Fetch enquiries and valuations for response time metrics
      const { data: enquiries } = await supabase
        .from("property_enquiries")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: valuations } = await supabase
        .from("valuation_requests")
        .select("*")
        .order("created_at", { ascending: false });

      const allActivities = activities || [];
      const allEnquiries = enquiries || [];
      const allValuations = valuations || [];

      // Calculate overall metrics
      const totalActivities = allActivities.length;
      const activitiesThisWeek = allActivities.filter(
        (a) => new Date(a.created_at) >= weekAgo
      ).length;
      const activitiesThisMonth = allActivities.filter(
        (a) => new Date(a.created_at) >= monthAgo
      ).length;

      // Calculate response times
      const respondedEnquiries = allEnquiries.filter((e) => e.contacted_at);
      const respondedValuations = allValuations.filter((v) => v.contacted_at);

      const avgEnquiryResponse =
        respondedEnquiries.length > 0
          ? respondedEnquiries.reduce((sum, e) => {
              const created = new Date(e.created_at).getTime();
              const contacted = new Date(e.contacted_at!).getTime();
              return sum + (contacted - created) / (1000 * 60 * 60); // Convert to hours
            }, 0) / respondedEnquiries.length
          : 0;

      const avgValuationResponse =
        respondedValuations.length > 0
          ? respondedValuations.reduce((sum, v) => {
              const created = new Date(v.created_at).getTime();
              const contacted = new Date(v.contacted_at!).getTime();
              return sum + (contacted - created) / (1000 * 60 * 60);
            }, 0) / respondedValuations.length
          : 0;

      const avgResponseTime = (avgEnquiryResponse + avgValuationResponse) / 2;

      const completionRate =
        allEnquiries.length + allValuations.length > 0
          ? ((respondedEnquiries.length + respondedValuations.length) /
              (allEnquiries.length + allValuations.length)) *
            100
          : 0;

      setMetrics({
        totalActivities,
        activitiesThisWeek,
        activitiesThisMonth,
        avgResponseTime,
        completionRate,
      });

      setResponseMetrics({
        enquiries: allEnquiries.length,
        valuations: allValuations.length,
        avgEnquiryResponse,
        avgValuationResponse,
      });

      // Activity breakdown by type
      const activityTypes = new Map<string, number>();
      allActivities.forEach((activity) => {
        const type = activity.activity_type;
        activityTypes.set(type, (activityTypes.get(type) || 0) + 1);
      });

      const breakdown: ActivityBreakdown[] = Array.from(activityTypes.entries()).map(
        ([type, count]) => ({
          type: type
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" "),
          count,
          percentage: (count / totalActivities) * 100,
        })
      );

      setActivityBreakdown(breakdown.sort((a, b) => b.count - a.count));

      // Time series data (last 30 days)
      const timeSeries: TimeSeriesActivity[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        const dayActivities = allActivities.filter((a) =>
          a.created_at?.startsWith(dateStr)
        ).length;

        const dayEmails = allActivities.filter(
          (a) => a.created_at?.startsWith(dateStr) && a.activity_type === "email"
        ).length;

        const dayStatusUpdates = allActivities.filter(
          (a) => a.created_at?.startsWith(dateStr) && a.activity_type === "stage_change"
        ).length;

        timeSeries.push({
          date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          activities: dayActivities,
          emails: dayEmails,
          statusUpdates: dayStatusUpdates,
        });
      }

      setTimeSeriesData(timeSeries);
    } catch (error) {
      console.error("Error fetching performance data:", error);
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
            <h1 className="text-3xl font-bold">Team Performance Metrics</h1>
            <p className="text-muted-foreground">Track activity and response time metrics</p>
          </div>
          <Button onClick={fetchPerformanceData}>
            <Activity className="mr-2 h-4 w-4" />
            Refresh Data
          </Button>
        </div>

        {/* Summary Cards */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalActivities}</div>
                <p className="text-xs text-muted-foreground">
                  {metrics.activitiesThisWeek} this week
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">This Month</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.activitiesThisMonth}</div>
                <p className="text-xs text-muted-foreground">Activities completed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.avgResponseTime.toFixed(1)}h
                </div>
                <p className="text-xs text-muted-foreground">
                  Average time to first response
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.completionRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">Contacts responded to</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Analytics Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Activity Overview</TabsTrigger>
            <TabsTrigger value="response">Response Times</TabsTrigger>
            <TabsTrigger value="breakdown">Activity Breakdown</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Activity Trend (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="activities"
                      stroke="hsl(var(--primary))"
                      name="Total Activities"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="emails"
                      stroke="hsl(var(--secondary))"
                      name="Emails Sent"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="statusUpdates"
                      stroke="hsl(var(--accent))"
                      name="Status Updates"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Activity Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={activityBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ type, percentage }) =>
                          `${type} ${percentage.toFixed(0)}%`
                        }
                        outerRadius={100}
                        fill="hsl(var(--primary))"
                        dataKey="count"
                      >
                        {activityBreakdown.map((entry, index) => (
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
                  <CardTitle>Weekly Activity Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  {metrics && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="text-sm text-muted-foreground">This Week</p>
                          <p className="text-2xl font-bold">{metrics.activitiesThisWeek}</p>
                        </div>
                        <Activity className="h-8 w-8 text-primary" />
                      </div>
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="text-sm text-muted-foreground">This Month</p>
                          <p className="text-2xl font-bold">{metrics.activitiesThisMonth}</p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-secondary" />
                      </div>
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="text-sm text-muted-foreground">Daily Average</p>
                          <p className="text-2xl font-bold">
                            {(metrics.activitiesThisMonth / 30).toFixed(1)}
                          </p>
                        </div>
                        <CheckCircle2 className="h-8 w-8 text-accent" />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="response" className="space-y-6">
            {responseMetrics && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Enquiry Response Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <span className="text-sm font-medium">Total Enquiries</span>
                          <span className="text-2xl font-bold">{responseMetrics.enquiries}</span>
                        </div>
                        <div className="flex items-center justify-between p-4 border rounded-lg bg-primary/5">
                          <div>
                            <span className="text-sm font-medium">Avg Response Time</span>
                            <p className="text-xs text-muted-foreground mt-1">
                              Time to first contact
                            </p>
                          </div>
                          <span className="text-2xl font-bold text-primary">
                            {responseMetrics.avgEnquiryResponse.toFixed(1)}h
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Valuation Response Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <span className="text-sm font-medium">Total Valuations</span>
                          <span className="text-2xl font-bold">{responseMetrics.valuations}</span>
                        </div>
                        <div className="flex items-center justify-between p-4 border rounded-lg bg-secondary/5">
                          <div>
                            <span className="text-sm font-medium">Avg Response Time</span>
                            <p className="text-xs text-muted-foreground mt-1">
                              Time to first contact
                            </p>
                          </div>
                          <span className="text-2xl font-bold text-secondary">
                            {responseMetrics.avgValuationResponse.toFixed(1)}h
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Response Time Comparison</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={[
                          {
                            type: "Enquiries",
                            time: responseMetrics.avgEnquiryResponse,
                          },
                          {
                            type: "Valuations",
                            time: responseMetrics.avgValuationResponse,
                          },
                        ]}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="type" />
                        <YAxis label={{ value: "Hours", angle: -90, position: "insideLeft" }} />
                        <Tooltip />
                        <Bar dataKey="time" fill="hsl(var(--primary))" name="Avg Response Time (hours)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Response Time Insights</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="font-semibold mb-2 text-foreground">Overall Performance</p>
                        <p className="text-sm text-muted-foreground">
                          {metrics && metrics.avgResponseTime < 24
                            ? "Excellent! Your average response time is under 24 hours."
                            : metrics && metrics.avgResponseTime < 48
                            ? "Good response time. Consider reducing to under 24 hours for better engagement."
                            : "Response time could be improved. Aim for under 24 hours for optimal results."}
                        </p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="font-semibold mb-2 text-foreground">Completion Rate</p>
                        <p className="text-sm text-muted-foreground">
                          {metrics && metrics.completionRate > 80
                            ? `Outstanding! ${metrics.completionRate.toFixed(0)}% of contacts have been responded to.`
                            : metrics && metrics.completionRate > 60
                            ? `Good work. ${metrics.completionRate.toFixed(0)}% completion rate can be improved further.`
                            : `${metrics?.completionRate.toFixed(0)}% completion rate needs attention. Prioritize follow-ups.`}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="breakdown">
            <Card>
              <CardHeader>
                <CardTitle>Activity Type Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={activityBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="type" type="category" width={150} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))">
                      {activityBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-6 space-y-3">
                  {activityBreakdown.map((activity, index) => (
                    <div
                      key={activity.type}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div>
                          <p className="font-semibold">{activity.type}</p>
                          <p className="text-sm text-muted-foreground">
                            {activity.percentage.toFixed(1)}% of total
                          </p>
                        </div>
                      </div>
                      <span className="text-2xl font-bold">{activity.count}</span>
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
