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
      // Single RPC call replaces 7 parallel unbounded queries
      const { data, error } = await supabase.rpc("sp_get_analytics_overview", {
        p_org_id: targetOrg.id,
        p_days: 7,
      });

      if (error) throw error;

      const totalSent = data.email?.total_sent ?? 0;
      const totalOpened = data.email?.total_opened ?? 0;
      const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;

      setMetrics({
        listings: {
          total: data.listings?.total_views ?? 0,
          active: data.listings?.active_listings ?? 0,
          avgViews: data.listings?.total_views ?? 0,
          trend: 12.5,
        },
        crm: {
          totalBuyers: data.crm?.total_buyers ?? 0,
          totalSellers: data.crm?.total_sellers ?? 0,
          recentActivity: data.crm?.recent_activities ?? 0,
          trend: 8.3,
        },
        email: { totalSent, openRate, trend: 15.2 },
        engagement: {
          totalEnquiries: data.engagement?.total_enquiries ?? 0,
          conversionRate: 5.7,
          trend: 5.7,
        },
      });

      // Time series comes pre-built from the RPC
      const timeSeries = (data.time_series || []).map((day: any) => ({
        date: new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        listings: day.views ?? 0,
        enquiries: day.enquiries ?? 0,
        emails: day.emails ?? 0,
      }));
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
