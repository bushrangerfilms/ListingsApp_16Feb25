import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";
import { Users, TrendingUp, Activity, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformHeader } from "@/components/PlatformHeader";

interface PipelineStats {
  sellers: {
    total: number;
    byStage: { stage: string; count: number; color: string }[];
    bySource: { source: string; count: number }[];
  };
  buyers: {
    total: number;
    byStage: { stage: string; count: number; color: string }[];
    bySource: { source: string; count: number }[];
  };
}

interface ActivityMetrics {
  total7Days: number;
  total30Days: number;
  total90Days: number;
  byType: { type: string; count: number }[];
  timeline: { date: string; count: number }[];
  mostActive: { name: string; profileType: string; activityCount: number }[];
}

interface EngagementMetrics {
  dormantProfiles: number;
  successfulSales: number;
  successfulPurchases: number;
}

const SELLER_STAGE_COLORS: Record<string, string> = {
  'lead': '#94a3b8',
  'qualified': '#3b82f6',
  'valuation_scheduled': '#8b5cf6',
  'valuation_completed': '#ec4899',
  'under_offer': '#f59e0b',
  'sold': '#10b981',
  'lost': '#ef4444'
};

const BUYER_STAGE_COLORS: Record<string, string> = {
  'lead': '#94a3b8',
  'active_searching': '#3b82f6',
  'viewing_scheduled': '#8b5cf6',
  'offer_made': '#f59e0b',
  'purchased': '#10b981',
  'inactive': '#ef4444'
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  'stage_change': 'Stage Changes',
  'note_added': 'Notes Added',
  'email_sent': 'Emails Sent',
  'call_made': 'Calls Made',
  'viewing_scheduled': 'Viewings Scheduled',
  'follow_up': 'Follow-ups'
};

export default function AdminCRMAnalytics() {
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null);
  const [activityMetrics, setActivityMetrics] = useState<ActivityMetrics | null>(null);
  const [engagementMetrics, setEngagementMetrics] = useState<EngagementMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Fetch seller profiles
      const { data: sellers } = await supabase
        .from('seller_profiles')
        .select('id, name, stage, source, created_at, last_contact_at');

      // Fetch buyer profiles
      const { data: buyers } = await supabase
        .from('buyer_profiles')
        .select('id, name, stage, source, created_at, last_contact_at');

      // Fetch activities
      const { data: activities } = await supabase
        .from('crm_activities')
        .select('id, activity_type, created_at, seller_profile_id, buyer_profile_id')
        .order('created_at', { ascending: false });

      // Calculate pipeline stats
      if (sellers && buyers) {
        const sellersByStage = sellers.reduce((acc: any, seller) => {
          const stage = seller.stage || 'lead';
          acc[stage] = (acc[stage] || 0) + 1;
          return acc;
        }, {});

        const buyersByStage = buyers.reduce((acc: any, buyer) => {
          const stage = buyer.stage || 'lead';
          acc[stage] = (acc[stage] || 0) + 1;
          return acc;
        }, {});

        const sellersBySource = sellers.reduce((acc: any, seller) => {
          const source = seller.source || 'manual';
          acc[source] = (acc[source] || 0) + 1;
          return acc;
        }, {});

        const buyersBySource = buyers.reduce((acc: any, buyer) => {
          const source = buyer.source || 'manual';
          acc[source] = (acc[source] || 0) + 1;
          return acc;
        }, {});

        setPipelineStats({
          sellers: {
            total: sellers.length,
            byStage: Object.entries(sellersByStage).map(([stage, count]) => ({
              stage: stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              count: count as number,
              color: SELLER_STAGE_COLORS[stage] || '#94a3b8'
            })),
            bySource: Object.entries(sellersBySource).map(([source, count]) => ({
              source: source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              count: count as number
            }))
          },
          buyers: {
            total: buyers.length,
            byStage: Object.entries(buyersByStage).map(([stage, count]) => ({
              stage: stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              count: count as number,
              color: BUYER_STAGE_COLORS[stage] || '#94a3b8'
            })),
            bySource: Object.entries(buyersBySource).map(([source, count]) => ({
              source: source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              count: count as number
            }))
          }
        });

        // Calculate engagement metrics
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const dormantSellers = sellers.filter(s => 
          !s.last_contact_at || new Date(s.last_contact_at) < thirtyDaysAgo
        ).length;
        
        const dormantBuyers = buyers.filter(b => 
          !b.last_contact_at || new Date(b.last_contact_at) < thirtyDaysAgo
        ).length;

        const successfulSales = sellers.filter(s => s.stage === 'sold').length;
        const successfulPurchases = buyers.filter(b => b.stage === 'purchased').length;

        setEngagementMetrics({
          dormantProfiles: dormantSellers + dormantBuyers,
          successfulSales,
          successfulPurchases
        });
      }

      // Calculate activity metrics
      if (activities) {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

        const total7Days = activities.filter(a => new Date(a.created_at) >= sevenDaysAgo).length;
        const total30Days = activities.filter(a => new Date(a.created_at) >= thirtyDaysAgo).length;
        const total90Days = activities.filter(a => new Date(a.created_at) >= ninetyDaysAgo).length;

        const byType = activities.reduce((acc: any, activity) => {
          const type = activity.activity_type || 'other';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {});

        // Activity timeline (last 30 days)
        const last30Days = Array.from({ length: 30 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (29 - i));
          return date.toISOString().split('T')[0];
        });

        const timeline = last30Days.map(date => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          count: activities.filter(a => a.created_at?.startsWith(date)).length
        }));

        // Most active profiles
        const profileActivity = activities.reduce((acc: any, activity) => {
          const profileId = activity.seller_profile_id || activity.buyer_profile_id;
          if (profileId) {
            acc[profileId] = (acc[profileId] || 0) + 1;
          }
          return acc;
        }, {});

        const sortedProfiles = Object.entries(profileActivity)
          .sort((a: any, b: any) => b[1] - a[1])
          .slice(0, 10);

        const mostActive = await Promise.all(
          sortedProfiles.map(async ([profileId, count]) => {
            const { data: seller } = await supabase
              .from('seller_profiles')
              .select('name')
              .eq('id', profileId)
              .maybeSingle();
            
            if (seller) {
              return { name: seller.name, profileType: 'Seller', activityCount: count as number };
            }

            const { data: buyer } = await supabase
              .from('buyer_profiles')
              .select('name')
              .eq('id', profileId)
              .maybeSingle();
            
            return { name: buyer?.name || 'Unknown', profileType: 'Buyer', activityCount: count as number };
          })
        );

        setActivityMetrics({
          total7Days,
          total30Days,
          total90Days,
          byType: Object.entries(byType).map(([type, count]) => ({
            type: ACTIVITY_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            count: count as number
          })),
          timeline,
          mostActive: mostActive.filter(p => p !== null)
        });
      }
    } catch (error) {
      console.error('Error fetching CRM analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PlatformHeader />
        <div className="container mx-auto px-4 py-8 space-y-8">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!pipelineStats || !activityMetrics || !engagementMetrics) return null;

  return (
    <div className="min-h-screen bg-background">
      <PlatformHeader />
      <div className="container mx-auto px-4 py-8 space-y-8">
        <h1 className="text-4xl font-bold">CRM Analytics Dashboard</h1>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sellers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pipelineStats.sellers.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {pipelineStats.sellers.byStage.find(s => s.stage === 'Sold')?.count || 0} successful sales
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Buyers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pipelineStats.buyers.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {pipelineStats.buyers.byStage.find(s => s.stage === 'Purchased')?.count || 0} successful purchases
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Activity (30 Days)</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activityMetrics.total30Days}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {activityMetrics.total7Days} in last 7 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Dormant Profiles</CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{engagementMetrics.dormantProfiles}</div>
              <p className="text-xs text-amber-500 mt-1">No contact in 30+ days</p>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Overview */}
        <Tabs defaultValue="sellers" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="sellers">Seller Pipeline</TabsTrigger>
            <TabsTrigger value="buyers">Buyer Pipeline</TabsTrigger>
          </TabsList>

          <TabsContent value="sellers" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Sellers by Stage</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pipelineStats.sellers.byStage}
                        dataKey="count"
                        nameKey="stage"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ stage, count, percent }) => 
                          `${stage}: ${count} (${(percent * 100).toFixed(0)}%)`
                        }
                      >
                        {pipelineStats.sellers.byStage.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sellers by Source</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={pipelineStats.sellers.bySource}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="source" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="buyers" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Buyers by Stage</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pipelineStats.buyers.byStage}
                        dataKey="count"
                        nameKey="stage"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ stage, count, percent }) => 
                          `${stage}: ${count} (${(percent * 100).toFixed(0)}%)`
                        }
                      >
                        {pipelineStats.buyers.byStage.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Buyers by Source</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={pipelineStats.buyers.bySource}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="source" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Activity Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={activityMetrics.timeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity by Type</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={activityMetrics.byType} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="type" type="category" width={120} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Most Active Profiles */}
        <Card>
          <CardHeader>
            <CardTitle>Most Active Profiles (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activityMetrics.mostActive.map((profile, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{profile.name}</p>
                      <p className="text-xs text-muted-foreground">{profile.profileType}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{profile.activityCount}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
