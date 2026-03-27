import { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Activity, BarChart3, PieChart, Mail, Users, Target, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

import OverviewSection from "@/components/analytics/sections/OverviewSection";
import ListingsSection from "@/components/analytics/sections/ListingsSection";
import AttributionSection from "@/components/analytics/sections/AttributionSection";
import EmailSection from "@/components/analytics/sections/EmailSection";
import TeamSection from "@/components/analytics/sections/TeamSection";
import MatchingSection from "@/components/analytics/sections/MatchingSection";

export default function AdminAnalyticsHub() {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState("overview");
  const { organization } = useOrganization();

  const { data: listingCount = 0 } = useQuery({
    queryKey: ['listing-count', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return 0;
      const { count } = await supabase
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organization.id);
      return count ?? 0;
    },
    enabled: !!organization?.id,
  });

  useEffect(() => {
    const path = location.pathname;
    if (path.includes("listing-analytics")) {
      setActiveSection("listings");
    } else if (path.includes("source-attribution")) {
      setActiveSection("attribution");
    } else if (path.includes("email-campaign-analytics")) {
      setActiveSection("email");
    } else if (path.includes("team-performance") || path.includes("predictive-analytics")) {
      setActiveSection("team");
    } else if (path.includes("matching-analytics")) {
      setActiveSection("matching");
    } else {
      setActiveSection("overview");
    }
  }, [location.pathname]);

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Analytics Hub</h1>
          <p className="text-muted-foreground">Unified view of all platform metrics</p>
        </div>
        <Button onClick={handleRefresh} variant="outline">
          <Activity className="mr-2 h-4 w-4" />
          Refresh Data
        </Button>
      </div>

      {listingCount === 0 ? (
        <div className="text-center py-20">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Analytics Yet</h3>
          <p className="text-muted-foreground mb-6">
            Add your first listing to start seeing analytics.
          </p>
          <Button asChild>
            <Link to="/admin/create">
              <Plus className="mr-2 h-4 w-4" />
              Create Listing
            </Link>
          </Button>
        </div>
      ) : (
        <Tabs value={activeSection} onValueChange={setActiveSection} className="w-full">
          <TabsList className="w-full h-auto flex-wrap gap-1 justify-start p-1 mb-6">
            <TabsTrigger value="overview" className="gap-2" data-testid="tab-overview">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="listings" className="gap-2" data-testid="tab-listings">
              <PieChart className="h-4 w-4" />
              <span className="hidden sm:inline">Listings</span>
            </TabsTrigger>
            <TabsTrigger value="attribution" className="gap-2" data-testid="tab-attribution">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Attribution</span>
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2" data-testid="tab-email">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Email</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2" data-testid="tab-team">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Team</span>
            </TabsTrigger>
            <TabsTrigger value="matching" className="gap-2" data-testid="tab-matching">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Matching</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            <OverviewSection />
          </TabsContent>
          <TabsContent value="listings" className="mt-0">
            <ListingsSection />
          </TabsContent>
          <TabsContent value="attribution" className="mt-0">
            <AttributionSection />
          </TabsContent>
          <TabsContent value="email" className="mt-0">
            <EmailSection />
          </TabsContent>
          <TabsContent value="team" className="mt-0">
            <TeamSection />
          </TabsContent>
          <TabsContent value="matching" className="mt-0">
            <MatchingSection />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
