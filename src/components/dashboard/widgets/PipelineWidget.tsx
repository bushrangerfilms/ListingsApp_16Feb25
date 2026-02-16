import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import { Users } from "lucide-react";

interface PipelineWidgetProps {
  type: "buyer" | "seller";
}

export const PipelineWidget = ({ type }: PipelineWidgetProps) => {
  const { organization } = useOrganization();
  const { viewAsOrganizationId, selectedOrganization, isOrganizationView } = useOrganizationView();
  
  const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;

  const { data: stats } = useQuery({
    queryKey: [`dashboard-${type}-pipeline`, targetOrg?.id],
    queryFn: async () => {
      if (!targetOrg) return null;
      
      const table = type === "buyer" ? "buyer_profiles" : "seller_profiles";
      const { data } = await supabase
        .from(table)
        .select("stage")
        .eq("organization_id", targetOrg.id);

      const stages = data?.reduce((acc, profile) => {
        acc[profile.stage] = (acc[profile.stage] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      return {
        lead: stages.lead || 0,
        qualified: stages.qualified || 0,
        engaged: stages.engaged || 0,
        negotiating: stages.negotiating || 0,
        converted: stages.converted || 0,
      };
    },
  });

  const stages = [
    { label: "Lead", value: stats?.lead || 0, color: "bg-gray-200" },
    { label: "Qualified", value: stats?.qualified || 0, color: "bg-blue-200" },
    { label: "Engaged", value: stats?.engaged || 0, color: "bg-purple-200" },
    { label: "Negotiating", value: stats?.negotiating || 0, color: "bg-orange-200" },
    { label: "Converted", value: stats?.converted || 0, color: "bg-green-200" },
  ];

  const total = Object.values(stats || {}).reduce((sum, val) => sum + val, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Users className="h-4 w-4" />
        <span className="text-sm">Total: {total}</span>
      </div>
      <div className="space-y-2">
        {stages.map((stage) => (
          <div key={stage.label} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{stage.label}</span>
              <span className="font-semibold">{stage.value}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full ${stage.color}`}
                style={{ width: `${total > 0 ? (stage.value / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
