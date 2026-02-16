import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { Home, TrendingUp, Eye, Mail, MessageSquare, Bell, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface AnalyticsData {
  totalListings: number;
  valuationRequests: number;
  pendingEnquiries: number;
  totalViews: number;
  activityTrend: { date: string; enquiries: number; valuations: number; views: number }[];
}

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (organization) {
      fetchAnalytics();
    }
  }, [organization]);

  const fetchAnalytics = async () => {
    if (!organization) return;
    
    try {
      setLoading(true);

      // Fetch all listings
      const { data: listingsData } = await supabase.functions.invoke('get-listings', {
        body: { clientSlug: organization.slug, filter: null, archived: false }
      });

      // Fetch valuation requests
      const { data: valuationData } = await supabase
        .from('valuation_requests')
        .select('created_at');

      // Fetch property enquiries
      const { data: enquiriesData } = await supabase
        .from('property_enquiries')
        .select('created_at, status, property_title');

      // Fetch listing views
      const { data: viewsData } = await supabase
        .from('listing_views')
        .select('viewed_at, listing_id');

      if (listingsData?.success) {
        const listings = listingsData.listings;
        const pendingEnquiries = enquiriesData?.filter((e: any) => e.status === 'new').length || 0;

        // Calculate activity trend (last 30 days)
        const last30Days = Array.from({ length: 30 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (29 - i));
          return date.toISOString().split('T')[0];
        });

        const activityTrend = last30Days.map(date => {
          const enquiriesCount = enquiriesData?.filter((e: any) => 
            e.created_at?.startsWith(date)
          ).length || 0;
          const valuationsCount = valuationData?.filter((v: any) => 
            v.created_at?.startsWith(date)
          ).length || 0;
          const viewsCount = viewsData?.filter((v: any) => 
            v.viewed_at?.startsWith(date)
          ).length || 0;

          return {
            date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            enquiries: enquiriesCount,
            valuations: valuationsCount,
            views: viewsCount
          };
        });

        setAnalytics({
          totalListings: listings.length,
          valuationRequests: valuationData?.length || 0,
          pendingEnquiries,
          totalViews: viewsData?.length || 0,
          activityTrend
        });
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-8">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-3xl font-bold">Analytics Dashboard</h1>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Listings</CardTitle>
              <Home className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalListings}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Listing Views</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalViews}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Enquiries</CardTitle>
              <Bell className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.pendingEnquiries}</div>
              {analytics.pendingEnquiries > 0 && (
                <p className="text-xs text-amber-500 mt-1">Needs attention</p>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 w-full"
                onClick={() => navigate('/admin/communications')}
              >
                View Enquiries
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valuation Requests</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.valuationRequests}</div>
            </CardContent>
          </Card>
        </div>

      {/* Activity Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Trend (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.activityTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="enquiries" stroke="#10b981" name="Enquiries" strokeWidth={2} />
              <Line type="monotone" dataKey="valuations" stroke="#3b82f6" name="Valuations" strokeWidth={2} />
              <Line type="monotone" dataKey="views" stroke="#f97316" name="Views" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
