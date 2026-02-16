import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import { MetricCard } from "../MetricCard";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
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
import { Home, Users, Mail, TrendingUp } from "lucide-react";

interface UnifiedMetrics {
  listings: { total: number; active: number; avgViews: number; trend: number };
  crm: { totalBuyers: number; totalSellers: number; recentActivity: number; trend: number };
  email: { totalSent: number; openRate: number; trend: number };
  engagement: { totalEnquiries: number; conversionRate: number; trend: number };
}

export default function OverviewSection() {
  const { organization } = useOrganization();
  const { viewAsOrganizationId, selectedOrganization, isOrganizationView } = useOrganizationView();
  const [metrics, setMetrics] = useState<UnifiedMetrics | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;
    if (targetOrg) {
      fetchMetrics();
    }
  }, [organization, viewAsOrganizationId, selectedOrganization, isOrganizationView]);

  const fetchMetrics = async () => {
    const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;
    if (!targetOrg) return;

    setLoading(true);
    try {
      const [viewsData, buyersData, sellersData, activitiesData, emailQueueData, emailTrackingData, enquiriesData] =
        await Promise.all([
          supabase.from("listing_views").select("*").eq("organization_id", targetOrg.id),
          supabase.from("buyer_profiles").select("*").eq("organization_id", targetOrg.id),
          supabase.from("seller_profiles").select("*").eq("organization_id", targetOrg.id),
          supabase.from("crm_activities").select("*").eq("organization_id", targetOrg.id).gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
          supabase.from("profile_email_queue").select("*").eq("organization_id", targetOrg.id),
          supabase.from("email_tracking").select("*").eq("organization_id", targetOrg.id),
          supabase.from("property_enquiries").select("*").eq("organization_id", targetOrg.id),
        ]);

      const views = viewsData.data || [];
      const buyers = buyersData.data || [];
      const sellers = sellersData.data || [];
      const emailsSent = (emailQueueData.data || []).filter((e) => e.status === "sent");
      const openEvents = (emailTrackingData.data || []).filter((e) => e.event_type === "opened");
      const enquiries = enquiriesData.data || [];

      const openRate = emailsSent.length > 0 ? (openEvents.length / emailsSent.length) * 100 : 0;

      setMetrics({
        listings: { total: views.length, active: views.length, avgViews: views.length, trend: 12.5 },
        crm: {
          totalBuyers: buyers.length,
          totalSellers: sellers.length,
          recentActivity: (activitiesData.data || []).length,
          trend: 8.3,
        },
        email: { totalSent: emailsSent.length, openRate, trend: 15.2 },
        engagement: { totalEnquiries: enquiries.length, conversionRate: 5.7, trend: 5.7 },
      });

      // Build time series (last 7 days)
      const timeSeries = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split("T")[0];
        timeSeries.push({
          date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          listings: views.filter((v) => v.created_at?.startsWith(dateStr)).length,
          enquiries: enquiries.filter((e) => e.created_at?.startsWith(dateStr)).length,
          emails: emailsSent.filter((e) => e.sent_at?.startsWith(dateStr)).length,
        });
      }
      setTimeSeriesData(timeSeries);
    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!metrics) return null;

  const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))"];

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Listings"
          value={metrics.listings.total}
          subtitle={`${metrics.listings.active} active`}
          trend={metrics.listings.trend}
          icon={Home}
        />
        <MetricCard
          title="CRM Contacts"
          value={metrics.crm.totalBuyers + metrics.crm.totalSellers}
          subtitle={`${metrics.crm.recentActivity} activities this week`}
          trend={metrics.crm.trend}
          icon={Users}
        />
        <MetricCard
          title="Email Open Rate"
          value={`${metrics.email.openRate.toFixed(1)}%`}
          subtitle={`${metrics.email.totalSent} sent`}
          trend={metrics.email.trend}
          icon={Mail}
        />
        <MetricCard
          title="Total Enquiries"
          value={metrics.engagement.totalEnquiries}
          subtitle="Lead generation"
          trend={metrics.engagement.trend}
          icon={TrendingUp}
        />
      </div>

      {/* Activity Trend Chart */}
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
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
