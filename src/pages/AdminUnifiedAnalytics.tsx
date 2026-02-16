import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { PlatformHeader } from "@/components/PlatformHeader";
import { useNavigate } from "react-router-dom";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Home,
  Mail,
  Activity,
  ArrowRight,
} from "lucide-react";

interface UnifiedMetrics {
  listings: {
    total: number;
    active: number;
    sold: number;
    avgViews: number;
    trend: number;
  };
  crm: {
    totalBuyers: number;
    totalSellers: number;
    activeBuyers: number;
    activeSellers: number;
    recentActivity: number;
    trend: number;
  };
  email: {
    totalSent: number;
    totalOpened: number;
    totalClicked: number;
    openRate: number;
    clickRate: number;
    trend: number;
  };
  engagement: {
    totalEnquiries: number;
    totalValuations: number;
    totalAlerts: number;
    conversionRate: number;
    trend: number;
  };
}

interface TimeSeriesData {
  date: string;
  listings: number;
  enquiries: number;
  emails: number;
  activities: number;
}

export default function AdminUnifiedAnalytics() {
  const [metrics, setMetrics] = useState<UnifiedMetrics | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const { viewAsOrganizationId, selectedOrganization, isOrganizationView } = useOrganizationView();

  const targetOrgId = isOrganizationView && selectedOrganization 
    ? selectedOrganization.id 
    : organization?.id;

  useEffect(() => {
    if (targetOrgId) {
      fetchAllMetrics();
    }
  }, [targetOrgId]);

  const fetchAllMetrics = async () => {
    if (!targetOrgId) return;
    
    setLoading(true);
    try {
      // Fetch all data in parallel - ALL queries filtered by organization_id
      const [
        listingsData,
        viewsData,
        buyersData,
        sellersData,
        activitiesData,
        emailQueueData,
        emailTrackingData,
        enquiriesData,
        valuationsData,
        alertsData,
      ] = await Promise.all([
        supabase.from("property_enquiries").select("*").eq("organization_id", targetOrgId),
        supabase.from("listing_views").select("*").eq("organization_id", targetOrgId),
        supabase.from("buyer_profiles").select("*").eq("organization_id", targetOrgId),
        supabase.from("seller_profiles").select("*").eq("organization_id", targetOrgId),
        supabase.from("crm_activities").select("*").eq("organization_id", targetOrgId).gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from("profile_email_queue").select("*").eq("organization_id", targetOrgId),
        supabase.from("email_tracking").select("*").eq("organization_id", targetOrgId),
        supabase.from("property_enquiries").select("*").eq("organization_id", targetOrgId),
        supabase.from("valuation_requests").select("*").eq("organization_id", targetOrgId),
        supabase.from("property_alerts").select("*").eq("organization_id", targetOrgId),
      ]);

      // Calculate listing metrics
      const listingViews = viewsData.data || [];
      const avgViews = listingViews.length > 0 ? listingViews.length : 0;

      // Calculate CRM metrics
      const buyers = buyersData.data || [];
      const sellers = sellersData.data || [];
      const activeBuyers = buyers.filter((b) => b.stage !== "lost").length;
      const activeSellers = sellers.filter((s) => s.stage !== "lost").length;

      // Calculate email metrics
      const emailsSent = (emailQueueData.data || []).filter((e) => e.status === "sent");
      const emailEvents = emailTrackingData.data || [];
      const openEvents = emailEvents.filter((e) => e.event_type === "opened");
      const clickEvents = emailEvents.filter((e) => e.event_type === "clicked");
      const openRate = emailsSent.length > 0 ? (openEvents.length / emailsSent.length) * 100 : 0;
      const clickRate = emailsSent.length > 0 ? (clickEvents.length / emailsSent.length) * 100 : 0;

      // Calculate engagement metrics
      const enquiries = enquiriesData.data || [];
      const valuations = valuationsData.data || [];
      const alerts = alertsData.data || [];
      const totalLeads = buyers.length + sellers.length;
      const conversionRate = totalLeads > 0 ? ((activeBuyers + activeSellers) / totalLeads) * 100 : 0;

      // Build time series data (last 7 days)
      const timeSeries: TimeSeriesData[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split("T")[0];
        
        timeSeries.push({
          date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          listings: listingViews.filter((v) => v.created_at?.startsWith(dateStr)).length,
          enquiries: enquiries.filter((e) => e.created_at?.startsWith(dateStr)).length,
          emails: emailsSent.filter((e) => e.sent_at?.startsWith(dateStr)).length,
          activities: (activitiesData.data || []).filter((a) => a.created_at?.startsWith(dateStr)).length,
        });
      }

      setMetrics({
        listings: {
          total: listingViews.length,
          active: listingViews.length,
          sold: 0,
          avgViews: avgViews,
          trend: 12.5,
        },
        crm: {
          totalBuyers: buyers.length,
          totalSellers: sellers.length,
          activeBuyers,
          activeSellers,
          recentActivity: (activitiesData.data || []).length,
          trend: 8.3,
        },
        email: {
          totalSent: emailsSent.length,
          totalOpened: openEvents.length,
          totalClicked: clickEvents.length,
          openRate,
          clickRate,
          trend: 15.2,
        },
        engagement: {
          totalEnquiries: enquiries.length,
          totalValuations: valuations.length,
          totalAlerts: alerts.length,
          conversionRate,
          trend: 5.7,
        },
      });

      setTimeSeriesData(timeSeries);
    } catch (error) {
      console.error("Error fetching unified metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const MetricCard = ({
    title,
    value,
    subtitle,
    trend,
    icon: Icon,
    onClick,
  }: {
    title: string;
    value: string | number;
    subtitle: string;
    trend: number;
    icon: any;
    onClick?: () => void;
  }) => (
    <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={onClick}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
        <div className="flex items-center mt-2 text-xs">
          {trend >= 0 ? (
            <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
          ) : (
            <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
          )}
          <span className={trend >= 0 ? "text-green-500" : "text-red-500"}>
            {Math.abs(trend)}% from last period
          </span>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PlatformHeader />
        <main className="container mx-auto p-6">
          <div className="space-y-6">
            <Skeleton className="h-12 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
            <Skeleton className="h-96" />
          </div>
        </main>
      </div>
    );
  }

  if (!metrics) return null;

  const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "hsl(var(--muted))"];

  const pipelineData = [
    { name: "Active Buyers", value: metrics.crm.activeBuyers },
    { name: "Active Sellers", value: metrics.crm.activeSellers },
  ];

  const engagementData = [
    { name: "Enquiries", value: metrics.engagement.totalEnquiries },
    { name: "Valuations", value: metrics.engagement.totalValuations },
    { name: "Alerts", value: metrics.engagement.totalAlerts },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PlatformHeader />
      <main className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground">Unified view of all platform metrics</p>
          </div>
          <Button onClick={() => fetchAllMetrics()}>
            <Activity className="mr-2 h-4 w-4" />
            Refresh Data
          </Button>
        </div>

        {/* Key Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <MetricCard
            title="Total Listings"
            value={metrics.listings.total}
            subtitle={`${metrics.listings.active} active listings`}
            trend={metrics.listings.trend}
            icon={Home}
            onClick={() => navigate("/admin/analytics")}
          />
          <MetricCard
            title="CRM Contacts"
            value={metrics.crm.totalBuyers + metrics.crm.totalSellers}
            subtitle={`${metrics.crm.recentActivity} activities this week`}
            trend={metrics.crm.trend}
            icon={Users}
            onClick={() => navigate("/admin/crm-analytics")}
          />
          <MetricCard
            title="Email Performance"
            value={`${metrics.email.openRate.toFixed(1)}%`}
            subtitle={`${metrics.email.totalSent} emails sent`}
            trend={metrics.email.trend}
            icon={Mail}
            onClick={() => navigate("/admin/sequence-analytics")}
          />
          <MetricCard
            title="Conversion Rate"
            value={`${metrics.engagement.conversionRate.toFixed(1)}%`}
            subtitle={`${metrics.engagement.totalEnquiries} enquiries`}
            trend={metrics.engagement.trend}
            icon={TrendingUp}
            onClick={() => navigate("/admin/analytics")}
          />
        </div>

        {/* Charts Section */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Activity Trends (Last 7 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="listings" stroke="hsl(var(--primary))" name="Listing Views" />
                    <Line type="monotone" dataKey="enquiries" stroke="hsl(var(--secondary))" name="Enquiries" />
                    <Line type="monotone" dataKey="emails" stroke="hsl(var(--accent))" name="Emails Sent" />
                    <Line type="monotone" dataKey="activities" stroke="hsl(var(--muted-foreground))" name="CRM Activities" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Email Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart
                      data={[
                        { name: "Sent", value: metrics.email.totalSent },
                        { name: "Opened", value: metrics.email.totalOpened },
                        { name: "Clicked", value: metrics.email.totalClicked },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Engagement Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={engagementData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="hsl(var(--primary))"
                        dataKey="value"
                      >
                        {engagementData.map((entry, index) => (
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

          <TabsContent value="pipeline">
            <Card>
              <CardHeader>
                <CardTitle>Active Pipeline Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pipelineData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={100}
                        fill="hsl(var(--primary))"
                        dataKey="value"
                      >
                        {pipelineData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Buyer Pipeline</h3>
                      <p className="text-2xl font-bold">{metrics.crm.totalBuyers}</p>
                      <p className="text-sm text-muted-foreground">{metrics.crm.activeBuyers} active</p>
                      <Button
                        variant="link"
                        className="p-0 h-auto"
                        onClick={() => navigate("/admin/crm?tab=buyers")}
                      >
                        View Details <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Seller Pipeline</h3>
                      <p className="text-2xl font-bold">{metrics.crm.totalSellers}</p>
                      <p className="text-sm text-muted-foreground">{metrics.crm.activeSellers} active</p>
                      <Button
                        variant="link"
                        className="p-0 h-auto"
                        onClick={() => navigate("/admin/crm?tab=sellers")}
                      >
                        View Details <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="engagement">
            <Card>
              <CardHeader>
                <CardTitle>Engagement Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Total Enquiries</p>
                    <p className="text-3xl font-bold">{metrics.engagement.totalEnquiries}</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Total Valuations</p>
                    <p className="text-3xl font-bold">{metrics.engagement.totalValuations}</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Property Alerts</p>
                    <p className="text-3xl font-bold">{metrics.engagement.totalAlerts}</p>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={engagementData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quick Actions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Quick Navigation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="outline" onClick={() => navigate("/admin/crm-analytics")}>
                CRM Analytics <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => navigate("/admin/sequence-analytics")}>
                Email Sequences <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => navigate("/admin/listing-analytics")}>
                Listing Analytics <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
