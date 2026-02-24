import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import { MetricCard } from "../MetricCard";
import { Mail, Eye, MousePointer } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function EmailSection() {
  const { organization } = useOrganization();
  const { selectedOrganization, isOrganizationView } = useOrganizationView();

  const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;
  const organizationId = targetOrg?.id;

  const { data: metrics = { sent: 0, opened: 0, clicked: 0, openRate: 0, clickRate: 0 }, isLoading: loading } = useQuery({
    queryKey: ['email-analytics', organizationId],
    queryFn: async () => {
      // CRITICAL: Filter by organization_id for multi-tenant security
      const { data: emailQueue } = await supabase.from("profile_email_queue").select("status").eq("organization_id", organizationId!).limit(5000);
      const { data: tracking } = await supabase.from("email_tracking").select("event_type").eq("organization_id", organizationId!).limit(5000);

      const sent = (emailQueue || []).filter((e) => e.status === "sent").length;
      const opened = (tracking || []).filter((e) => e.event_type === "opened").length;
      const clicked = (tracking || []).filter((e) => e.event_type === "clicked").length;
      const openRate = sent > 0 ? (opened / sent) * 100 : 0;
      const clickRate = sent > 0 ? (clicked / sent) * 100 : 0;

      return { sent, opened, clicked, openRate, clickRate };
    },
    enabled: !!organizationId,
  });

  if (loading) return <Skeleton className="h-96" />;

  const chartData = [
    { name: "Sent", value: metrics.sent },
    { name: "Opened", value: metrics.opened },
    { name: "Clicked", value: metrics.clicked },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard title="Emails Sent" value={metrics.sent} subtitle="Total delivered" icon={Mail} />
        <MetricCard title="Open Rate" value={`${metrics.openRate.toFixed(1)}%`} subtitle={`${metrics.opened} opened`} icon={Eye} />
        <MetricCard title="Click Rate" value={`${metrics.clickRate.toFixed(1)}%`} subtitle={`${metrics.clicked} clicked`} icon={MousePointer} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
