import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import { MetricCard } from "../MetricCard";
import { Target, TrendingUp, Users } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export default function AttributionSection() {
  const { organization } = useOrganization();
  const { selectedOrganization, isOrganizationView } = useOrganizationView();

  const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;
  const organizationId = targetOrg?.id;

  const { data: queryData, isLoading: loading } = useQuery({
    queryKey: ['attribution-analytics', organizationId],
    queryFn: async () => {
      const { data: buyers } = await supabase.from("buyer_profiles").select("source").eq("organization_id", organizationId!);
      const { data: sellers } = await supabase.from("seller_profiles").select("source").eq("organization_id", organizationId!);

      const allBuyers = buyers || [];
      const allSellers = sellers || [];
      const totalLeads = allBuyers.length + allSellers.length;

      // Group by source
      const sourceMap = new Map<string, number>();
      [...allBuyers, ...allSellers].forEach((profile) => {
        const source = profile.source || "unknown";
        sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
      });

      const sourceData = Array.from(sourceMap.entries()).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
      }));

      return { sourceData, totalLeads };
    },
    enabled: !!organizationId,
  });

  const sourceData = queryData?.sourceData ?? [];
  const totalLeads = queryData?.totalLeads ?? 0;

  if (loading) return <Skeleton className="h-96" />;

  const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "hsl(var(--muted))"];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MetricCard title="Total Leads" value={totalLeads} subtitle={`From ${sourceData.length} sources`} icon={Users} />
        <MetricCard title="Top Source" value={sourceData[0]?.name || "N/A"} subtitle={`${sourceData[0]?.value || 0} leads`} icon={Target} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lead Distribution by Source</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={sourceData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="hsl(var(--primary))"
                dataKey="value"
              >
                {sourceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
