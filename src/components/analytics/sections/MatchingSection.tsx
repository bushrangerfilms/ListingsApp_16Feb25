import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import { MetricCard } from "../MetricCard";
import { Target, Eye, MousePointer } from "lucide-react";

export default function MatchingSection() {
  const { organization } = useOrganization();
  const { viewAsOrganizationId, selectedOrganization, isOrganizationView } = useOrganizationView();
  const [metrics, setMetrics] = useState({ totalMatches: 0, emailedMatches: 0, openRate: 0, clickRate: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;
    if (targetOrg) {
      fetchData();
    }
  }, [organization, viewAsOrganizationId, selectedOrganization, isOrganizationView]);

  const fetchData = async () => {
    const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;
    const organizationId = targetOrg?.id;
    if (!organizationId) return;
    
    try {
      // CRITICAL: Filter by organization_id for multi-tenant security
      const { data: matches } = await supabase.from("buyer_listing_matches").select("*").eq("organization_id", organizationId);

      const total = (matches || []).length;
      const emailed = (matches || []).filter((m) => m.email_sent_at).length;
      const opened = (matches || []).filter((m) => m.email_opened_at).length;
      const clicked = (matches || []).filter((m) => m.buyer_clicked_at).length;
      const openRate = emailed > 0 ? (opened / emailed) * 100 : 0;
      const clickRate = emailed > 0 ? (clicked / emailed) * 100 : 0;

      setMetrics({ totalMatches: total, emailedMatches: emailed, openRate, clickRate });
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard title="Total Matches" value={metrics.totalMatches} subtitle={`${metrics.emailedMatches} notified`} icon={Target} />
        <MetricCard title="Open Rate" value={`${metrics.openRate.toFixed(1)}%`} subtitle="Email opened" icon={Eye} />
        <MetricCard title="Click Rate" value={`${metrics.clickRate.toFixed(1)}%`} subtitle="Buyers engaged" icon={MousePointer} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buyer-Listing Matching Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Detailed matching analytics and criteria effectiveness coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}
