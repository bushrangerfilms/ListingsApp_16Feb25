import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Users, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale } from "@/hooks/useLocale";

interface PipelineStats {
  sellers: { total: number; byStage: { stageKey: string; count: number; color: string }[] };
  buyers: { total: number; byStage: { stageKey: string; count: number; color: string }[] };
}

const SELLER_STAGE_COLORS: Record<string, string> = {
  'lead': '#94a3b8',
  'valuation_scheduled': '#8b5cf6',
  'valuation_complete': '#ec4899',
  'listed': '#3b82f6',
  'under_offer': '#f59e0b',
  'sold': '#10b981',
  'lost': '#ef4444'
};

const BUYER_STAGE_COLORS: Record<string, string> = {
  'lead': '#94a3b8',
  'qualified': '#3b82f6',
  'viewing_scheduled': '#8b5cf6',
  'viewed': '#ec4899',
  'offer_made': '#f59e0b',
  'sale_agreed': '#06b6d4',
  'purchased': '#10b981',
  'lost': '#ef4444'
};

export function CRMAnalyticsSection() {
  const { t } = useLocale();
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null);
  const [activityCount, setActivityCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const { data: sellers } = await supabase
        .from('seller_profiles')
        .select('stage');

      const { data: buyers } = await supabase
        .from('buyer_profiles')
        .select('stage');

      const { data: activities } = await supabase
        .from('crm_activities')
        .select('id')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

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

        setPipelineStats({
          sellers: {
            total: sellers.length,
            byStage: Object.entries(sellersByStage).map(([stage, count]) => ({
              stageKey: stage,
              count: count as number,
              color: SELLER_STAGE_COLORS[stage] || '#94a3b8'
            }))
          },
          buyers: {
            total: buyers.length,
            byStage: Object.entries(buyersByStage).map(([stage, count]) => ({
              stageKey: stage,
              count: count as number,
              color: BUYER_STAGE_COLORS[stage] || '#94a3b8'
            }))
          }
        });
      }

      setActivityCount(activities?.length || 0);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!pipelineStats) return null;

  const translatedSellerStages = pipelineStats.sellers.byStage.map(entry => ({
    ...entry,
    stage: t(`crm.stages.seller.${entry.stageKey}`)
  }));

  const translatedBuyerStages = pipelineStats.buyers.byStage.map(entry => ({
    ...entry,
    stage: t(`crm.stages.buyer.${entry.stageKey}`)
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t('crm.analytics.totalSellers')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pipelineStats.sellers.total}</div>
            <p className="text-xs text-muted-foreground">{t('crm.analytics.activeInPipeline')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t('crm.analytics.totalBuyers')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pipelineStats.buyers.total}</div>
            <p className="text-xs text-muted-foreground">{t('crm.analytics.activeInPipeline')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t('crm.analytics.recentActivity')}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activityCount}</div>
            <p className="text-xs text-muted-foreground">{t('crm.analytics.lastSevenDays')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('crm.analytics.sellerPipeline')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={translatedSellerStages}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ stage, count }) => `${stage}: ${count}`}
                  outerRadius={100}
                  dataKey="count"
                  nameKey="stage"
                >
                  {translatedSellerStages.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('crm.analytics.buyerPipeline')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={translatedBuyerStages}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ stage, count }) => `${stage}: ${count}`}
                  outerRadius={100}
                  dataKey="count"
                  nameKey="stage"
                >
                  {translatedBuyerStages.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Stage Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>{t('crm.analytics.pipelineComparison')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[
              { name: t('crm.tabs.sellers'), count: pipelineStats.sellers.total },
              { name: t('crm.tabs.buyers'), count: pipelineStats.buyers.total }
            ]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
