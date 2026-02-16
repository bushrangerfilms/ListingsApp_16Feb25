import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import { Mail, MailOpen, MousePointerClick, Ban } from "lucide-react";

export const EmailPerformanceWidget = () => {
  const { organization } = useOrganization();
  const { selectedOrganization, isOrganizationView } = useOrganizationView();
  
  const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;

  const { data: stats } = useQuery({
    queryKey: ["dashboard-email-performance", targetOrg?.id],
    queryFn: async () => {
      // CRITICAL: Filter by organization_id for multi-tenant security
      if (!targetOrg?.id) return { sent: 0, opens: 0, clicks: 0, bounces: 0, openRate: "0", clickRate: "0" };
      
      const { data: tracking } = await supabase
        .from("email_tracking")
        .select("event_type")
        .eq("organization_id", targetOrg.id);

      const opens = tracking?.filter((t) => t.event_type === "opened").length || 0;
      const clicks = tracking?.filter((t) => t.event_type === "clicked").length || 0;
      const total = tracking?.length || 0;

      return {
        sent: total,
        opens,
        clicks,
        bounces: 0,
        openRate: total > 0 ? ((opens / total) * 100).toFixed(1) : "0",
        clickRate: total > 0 ? ((clicks / total) * 100).toFixed(1) : "0",
      };
    },
    enabled: !!targetOrg?.id,
  });

  const metrics = [
    { label: "Sent", value: stats?.sent || 0, icon: Mail, color: "text-blue-600" },
    { label: "Opens", value: stats?.opens || 0, icon: MailOpen, color: "text-green-600" },
    { label: "Clicks", value: stats?.clicks || 0, icon: MousePointerClick, color: "text-purple-600" },
    { label: "Bounces", value: stats?.bounces || 0, icon: Ban, color: "text-red-600" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex items-center gap-2">
            <metric.icon className={`h-4 w-4 ${metric.color}`} />
            <div>
              <p className="text-lg font-bold">{metric.value}</p>
              <p className="text-xs text-muted-foreground">{metric.label}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="pt-3 border-t">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Open Rate</span>
          <span className="font-semibold text-green-600">{stats?.openRate}%</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-muted-foreground">Click Rate</span>
          <span className="font-semibold text-purple-600">{stats?.clickRate}%</span>
        </div>
      </div>
    </div>
  );
};
