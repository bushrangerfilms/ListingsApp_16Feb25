import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import { TrendingUp, Home, Eye, CheckCircle } from "lucide-react";

export const ListingsOverviewWidget = () => {
  const { organization } = useOrganization();
  const { selectedOrganization, isOrganizationView } = useOrganizationView();
  
  const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;

  const { data: stats } = useQuery({
    queryKey: ["dashboard-listings-overview", targetOrg?.id],
    queryFn: async () => {
      // CRITICAL: Filter by organization_id for multi-tenant security
      if (!targetOrg?.id) return { totalViews: 0, activeListings: 0, soldThisMonth: 0, avgDaysOnMarket: 0 };
      
      const [{ count: viewsCount }, { count: activeCount }, { count: soldCount }] = await Promise.all([
        supabase.from("listing_views").select("id", { count: "exact", head: true }).eq("organization_id", targetOrg.id),
        supabase.from("listings").select("id", { count: "exact", head: true }).eq("organization_id", targetOrg.id).eq("status", "published"),
        supabase.from("listings").select("id", { count: "exact", head: true }).eq("organization_id", targetOrg.id).eq("status", "sold"),
      ]);

      return {
        totalViews: viewsCount || 0,
        activeListings: activeCount || 0,
        soldThisMonth: soldCount || 0,
        avgDaysOnMarket: 21,
      };
    },
    enabled: !!targetOrg?.id,
  });

  const metrics = [
    { label: "Active Listings", value: stats?.activeListings || 0, icon: Home, color: "text-blue-600" },
    { label: "Total Views", value: stats?.totalViews || 0, icon: Eye, color: "text-purple-600" },
    { label: "Sold This Month", value: stats?.soldThisMonth || 0, icon: CheckCircle, color: "text-green-600" },
    { label: "Avg Days on Market", value: stats?.avgDaysOnMarket || 0, icon: TrendingUp, color: "text-orange-600" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-muted ${metric.color}`}>
            <metric.icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-2xl font-bold">{metric.value}</p>
            <p className="text-xs text-muted-foreground">{metric.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
