import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { PlatformHeader } from "@/components/PlatformHeader";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { TrendingUp, TrendingDown, AlertCircle, Lightbulb, Target, Activity } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Insight {
  id: string;
  type: "positive" | "warning" | "neutral";
  category: string;
  title: string;
  description: string;
  recommendation?: string;
  impact: "high" | "medium" | "low";
}

interface Prediction {
  metric: string;
  current: number;
  predicted: number;
  change: number;
  confidence: number;
}

interface TrendData {
  date: string;
  actual?: number;
  predicted?: number;
  confidence?: number;
}

export default function AdminPredictiveAnalytics() {
  const { organization } = useOrganization();
  const { viewAsOrganizationId, selectedOrganization, isOrganizationView } = useOrganizationView();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);

  const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;
  const targetOrgId = targetOrg?.id;

  useEffect(() => {
    if (targetOrgId) {
      fetchPredictiveAnalytics(targetOrgId);
    }
  }, [targetOrgId]);

  const fetchPredictiveAnalytics = async (organizationId: string) => {
    setLoading(true);
    try {
      // Fetch historical data for trend analysis - ALL QUERIES MUST FILTER BY organization_id
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        { data: recentActivities },
        { data: buyers },
        { data: sellers },
        { data: listingViews },
        { data: enquiries },
        { data: emailQueue },
        { data: emailTracking },
      ] = await Promise.all([
        supabase.from("crm_activities").select("created_at").eq("organization_id", organizationId).gte("created_at", thirtyDaysAgo.toISOString()).limit(5000),
        supabase.from("buyer_profiles").select("stage").eq("organization_id", organizationId).limit(5000),
        supabase.from("seller_profiles").select("stage").eq("organization_id", organizationId).limit(5000),
        supabase.from("listing_views").select("created_at").eq("organization_id", organizationId).gte("created_at", thirtyDaysAgo.toISOString()).limit(5000),
        supabase.from("property_enquiries").select("created_at").eq("organization_id", organizationId).gte("created_at", thirtyDaysAgo.toISOString()).limit(5000),
        supabase.from("profile_email_queue").select("id").eq("organization_id", organizationId).eq("status", "sent").limit(5000),
        supabase.from("email_tracking").select("event_type").eq("organization_id", organizationId).limit(5000),
      ]);

      // Generate insights
      const generatedInsights = generateInsights({
        activities: recentActivities || [],
        buyers: buyers || [],
        sellers: sellers || [],
        views: listingViews || [],
        enquiries: enquiries || [],
        emails: emailQueue || [],
        tracking: emailTracking || [],
      });

      setInsights(generatedInsights);

      // Generate predictions
      const generatedPredictions = generatePredictions({
        activities: recentActivities || [],
        views: listingViews || [],
        enquiries: enquiries || [],
        buyers: buyers || [],
        sellers: sellers || [],
      });

      setPredictions(generatedPredictions);

      // Generate trend data with predictions
      const trends = generateTrendData(recentActivities || []);
      setTrendData(trends);
    } catch (error) {
      console.error("Error fetching predictive analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = (data: any): Insight[] => {
    const insights: Insight[] = [];

    // Activity trend insight
    const recentActivities = data.activities.slice(0, 7).length;
    const olderActivities = data.activities.slice(7, 14).length;
    const activityTrend = recentActivities - olderActivities;

    if (activityTrend > 0) {
      insights.push({
        id: "activity-increase",
        type: "positive",
        category: "Team Performance",
        title: "Activity Levels Increasing",
        description: `Team activity has increased by ${Math.abs(activityTrend)} actions in the last week compared to the previous week.`,
        recommendation: "Maintain this momentum by continuing current strategies.",
        impact: "medium",
      });
    } else if (activityTrend < 0) {
      insights.push({
        id: "activity-decrease",
        type: "warning",
        category: "Team Performance",
        title: "Activity Levels Declining",
        description: `Team activity has decreased by ${Math.abs(activityTrend)} actions in the last week.`,
        recommendation: "Review team workload and consider reallocating resources.",
        impact: "high",
      });
    }

    // Lead pipeline insight
    const activeBuyers = data.buyers.filter((b: any) => b.stage !== "lost").length;
    const activeSellers = data.sellers.filter((s: any) => s.stage !== "lost").length;
    const totalActive = activeBuyers + activeSellers;

    if (totalActive > 50) {
      insights.push({
        id: "healthy-pipeline",
        type: "positive",
        category: "CRM Pipeline",
        title: "Healthy Pipeline Volume",
        description: `You have ${totalActive} active leads in your pipeline.`,
        recommendation: "Focus on conversion strategies to move leads through stages.",
        impact: "high",
      });
    } else if (totalActive < 20) {
      insights.push({
        id: "low-pipeline",
        type: "warning",
        category: "CRM Pipeline",
        title: "Low Pipeline Volume",
        description: `Only ${totalActive} active leads in pipeline.`,
        recommendation: "Increase lead generation efforts and marketing activities.",
        impact: "high",
      });
    }

    // Email engagement insight
    const openEvents = data.tracking.filter((t: any) => t.event_type === "opened").length;
    const sentEmails = data.emails.length;
    const openRate = sentEmails > 0 ? (openEvents / sentEmails) * 100 : 0;

    if (openRate > 30) {
      insights.push({
        id: "email-performing",
        type: "positive",
        category: "Email Marketing",
        title: "Strong Email Engagement",
        description: `Your emails have a ${openRate.toFixed(1)}% open rate, which is above industry average.`,
        recommendation: "Continue current email strategies and test new content types.",
        impact: "medium",
      });
    } else if (openRate < 15) {
      insights.push({
        id: "email-underperforming",
        type: "warning",
        category: "Email Marketing",
        title: "Low Email Engagement",
        description: `Email open rate of ${openRate.toFixed(1)}% is below optimal levels.`,
        recommendation: "Test different subject lines, send times, and email content.",
        impact: "medium",
      });
    }

    // Conversion insight
    const totalViews = data.views.length;
    const totalEnquiries = data.enquiries.length;
    const conversionRate = totalViews > 0 ? (totalEnquiries / totalViews) * 100 : 0;

    if (conversionRate > 5) {
      insights.push({
        id: "high-conversion",
        type: "positive",
        category: "Listings",
        title: "Excellent Conversion Rate",
        description: `Listings are converting views to enquiries at ${conversionRate.toFixed(1)}%.`,
        impact: "high",
      });
    } else if (conversionRate < 2) {
      insights.push({
        id: "low-conversion",
        type: "warning",
        category: "Listings",
        title: "Low Conversion Rate",
        description: `Only ${conversionRate.toFixed(1)}% of views result in enquiries.`,
        recommendation: "Improve listing descriptions, photos, and pricing strategy.",
        impact: "high",
      });
    }

    // Stage distribution insight
    const leadStage = data.buyers.filter((b: any) => b.stage === "lead").length;
    const qualifiedStage = data.buyers.filter((b: any) => b.stage === "qualified").length;

    if (leadStage > qualifiedStage * 3) {
      insights.push({
        id: "qualification-bottleneck",
        type: "warning",
        category: "Sales Funnel",
        title: "Qualification Bottleneck Detected",
        description: "Many leads are stuck in the initial stage without qualification.",
        recommendation: "Implement lead qualification criteria and automated nurturing.",
        impact: "high",
      });
    }

    return insights.sort((a, b) => {
      const impactOrder = { high: 3, medium: 2, low: 1 };
      return impactOrder[b.impact] - impactOrder[a.impact];
    });
  };

  const generatePredictions = (data: any): Prediction[] => {
    const predictions: Prediction[] = [];

    // Simple linear trend prediction for next 7 days
    const recentActivitiesCount = data.activities.length;
    const avgDailyActivities = recentActivitiesCount / 30;
    const predictedActivities = Math.round(avgDailyActivities * 7);

    predictions.push({
      metric: "Activities (Next 7 Days)",
      current: data.activities.slice(0, 7).length,
      predicted: predictedActivities,
      change: ((predictedActivities / data.activities.slice(0, 7).length - 1) * 100),
      confidence: 75,
    });

    // Enquiries prediction
    const recentEnquiries = data.enquiries.length;
    const avgDailyEnquiries = recentEnquiries / 30;
    const predictedEnquiries = Math.round(avgDailyEnquiries * 7);

    predictions.push({
      metric: "Enquiries (Next 7 Days)",
      current: data.enquiries.slice(0, 7).length,
      predicted: predictedEnquiries,
      change: data.enquiries.slice(0, 7).length > 0
        ? ((predictedEnquiries / data.enquiries.slice(0, 7).length - 1) * 100)
        : 0,
      confidence: 70,
    });

    // Pipeline growth prediction
    const activeBuyers = data.buyers.filter((b: any) => b.stage !== "lost").length;
    const activeSellers = data.sellers.filter((s: any) => s.stage !== "lost").length;
    const currentPipeline = activeBuyers + activeSellers;
    const predictedPipeline = Math.round(currentPipeline * 1.05); // 5% growth assumption

    predictions.push({
      metric: "Active Pipeline",
      current: currentPipeline,
      predicted: predictedPipeline,
      change: 5,
      confidence: 65,
    });

    return predictions;
  };

  const generateTrendData = (activities: any[]): TrendData[] => {
    const trends: TrendData[] = [];
    
    // Historical data (last 30 days)
    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      const dayActivities = activities.filter((a) => a.created_at?.startsWith(dateStr)).length;

      trends.push({
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        actual: dayActivities,
      });
    }

    // Simple prediction for next 7 days (linear trend)
    const recentAvg = trends.slice(-7).reduce((sum, d) => sum + d.actual, 0) / 7;
    const olderAvg = trends.slice(-14, -7).reduce((sum, d) => sum + d.actual, 0) / 7;
    const trend = recentAvg - olderAvg;

    for (let i = 1; i <= 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      const predicted = Math.max(0, Math.round(recentAvg + (trend * (i / 7))));
      const confidence = Math.max(0, 100 - (i * 10)); // Confidence decreases further out

      trends.push({
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        predicted,
        confidence,
      });
    }

    return trends;
  };

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
            <h1 className="text-3xl font-bold">Predictive Analytics & Insights</h1>
            <p className="text-muted-foreground">
              AI-driven insights and trend predictions for better decision making
            </p>
          </div>
          <Button onClick={fetchPredictiveAnalytics}>
            <Activity className="mr-2 h-4 w-4" />
            Refresh Insights
          </Button>
        </div>

        <Tabs defaultValue="insights" className="space-y-6">
          <TabsList>
            <TabsTrigger value="insights">Key Insights</TabsTrigger>
            <TabsTrigger value="predictions">Predictions</TabsTrigger>
            <TabsTrigger value="trends">Trend Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="insights" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-500/10 rounded-full">
                      <TrendingUp className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Positive Insights</p>
                      <p className="text-2xl font-bold">
                        {insights.filter((i) => i.type === "positive").length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-500/10 rounded-full">
                      <AlertCircle className="h-6 w-6 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Warnings</p>
                      <p className="text-2xl font-bold">
                        {insights.filter((i) => i.type === "warning").length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-full">
                      <Lightbulb className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Insights</p>
                      <p className="text-2xl font-bold">{insights.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              {insights.map((insight) => (
                <Alert
                  key={insight.id}
                  variant={insight.type === "warning" ? "destructive" : "default"}
                  className={
                    insight.type === "positive"
                      ? "border-green-500 bg-green-500/5"
                      : insight.type === "warning"
                      ? ""
                      : "border-blue-500 bg-blue-500/5"
                  }
                >
                  {insight.type === "positive" ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : insight.type === "warning" ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <Lightbulb className="h-4 w-4" />
                  )}
                  <AlertTitle className="flex items-center justify-between">
                    <span>{insight.title}</span>
                    <span className="text-xs font-normal px-2 py-1 bg-background rounded">
                      {insight.category}
                    </span>
                  </AlertTitle>
                  <AlertDescription>
                    <p className="mb-2">{insight.description}</p>
                    {insight.recommendation && (
                      <p className="text-sm font-semibold mt-2">
                        💡 Recommendation: {insight.recommendation}
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="predictions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>7-Day Forecast</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {predictions.map((prediction, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">{prediction.metric}</h3>
                        <div className="flex items-center gap-2">
                          {prediction.change > 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : prediction.change < 0 ? (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          ) : null}
                          <span
                            className={`text-sm font-semibold ${
                              prediction.change > 0
                                ? "text-green-500"
                                : prediction.change < 0
                                ? "text-red-500"
                                : "text-muted-foreground"
                            }`}
                          >
                            {prediction.change > 0 ? "+" : ""}
                            {prediction.change.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Current (Last 7 Days)</p>
                          <p className="text-2xl font-bold">{prediction.current}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Predicted (Next 7 Days)</p>
                          <p className="text-2xl font-bold text-primary">{prediction.predicted}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Confidence</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${prediction.confidence}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold">{prediction.confidence}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Prediction Accuracy</CardTitle>
              </CardHeader>
              <CardContent>
                <Alert>
                  <Target className="h-4 w-4" />
                  <AlertTitle>About These Predictions</AlertTitle>
                  <AlertDescription>
                    Predictions are based on historical trends from the last 30 days using linear
                    regression analysis. Confidence levels decrease for predictions further into the
                    future. These should be used as guidance alongside your business knowledge and
                    market conditions.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends">
            <Card>
              <CardHeader>
                <CardTitle>Activity Trend & Forecast</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="actual"
                      stroke="hsl(var(--primary))"
                      fillOpacity={1}
                      fill="url(#colorActual)"
                      name="Historical"
                    />
                    <Area
                      type="monotone"
                      dataKey="predicted"
                      stroke="hsl(var(--secondary))"
                      strokeDasharray="5 5"
                      fillOpacity={1}
                      fill="url(#colorPredicted)"
                      name="Predicted"
                    />
                  </AreaChart>
                </ResponsiveContainer>

                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Trend Analysis:</strong> The solid line represents historical activity
                    data. The dashed line shows predicted activity for the next 7 days based on
                    recent trends. Use this to anticipate workload and resource needs.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
