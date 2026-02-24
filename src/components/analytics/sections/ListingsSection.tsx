import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import { MetricCard } from "../MetricCard";
import { Eye, MessageSquare, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function ListingsSection() {
  const { organization } = useOrganization();
  const { selectedOrganization, isOrganizationView } = useOrganizationView();

  const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;
  const targetOrgId = targetOrg?.id;

  const { data: queryData, isLoading: loading } = useQuery({
    queryKey: ['listings-analytics', targetOrgId],
    queryFn: async () => {
      // CRITICAL: Filter by organization_id for multi-tenant security
      const { data: views } = await supabase.from("listing_views").select("viewed_at").eq("organization_id", targetOrgId!).limit(5000);
      const { data: enquiries } = await supabase.from("property_enquiries").select("created_at").eq("organization_id", targetOrgId!).limit(5000);

      const totalViews = (views || []).length;
      const totalEnquiries = (enquiries || []).length;
      const avgConversion = totalViews > 0 ? (totalEnquiries / totalViews) * 100 : 0;

      // Time series (last 30 days)
      const timeSeries = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split("T")[0];
        timeSeries.push({
          date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          views: (views || []).filter((v) => v.viewed_at?.startsWith(dateStr)).length,
          enquiries: (enquiries || []).filter((e) => e.created_at?.startsWith(dateStr)).length,
        });
      }

      return {
        metrics: { totalViews, totalEnquiries, avgConversion },
        timeSeriesData: timeSeries,
      };
    },
    enabled: !!targetOrgId,
  });

  const metrics = queryData?.metrics ?? { totalViews: 0, totalEnquiries: 0, avgConversion: 0 };
  const timeSeriesData = queryData?.timeSeriesData ?? [];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard title="Total Views" value={metrics.totalViews} subtitle="All listings" icon={Eye} />
        <MetricCard title="Total Enquiries" value={metrics.totalEnquiries} subtitle="From all pages" icon={MessageSquare} />
        <MetricCard title="Avg Conversion" value={`${metrics.avgConversion.toFixed(2)}%`} subtitle="Views to enquiries" icon={TrendingUp} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Views vs Enquiries (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="views" stroke="hsl(var(--primary))" name="Views" strokeWidth={2} />
              <Line type="monotone" dataKey="enquiries" stroke="hsl(var(--secondary))" name="Enquiries" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
