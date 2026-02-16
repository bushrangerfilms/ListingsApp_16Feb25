import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { BarChart3, Coins, TrendingUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getCreditBalance } from '@/lib/billing/billingClient';
import { usePlanInfo } from '@/hooks/usePlanInfo';
import { WeeklySpendChart } from './WeeklySpendChart';
import { format, subDays } from 'date-fns';

interface UsageAnalyticsDashboardProps {
  organizationId: string;
}

interface FeatureUsage {
  feature: string;
  credits: number;
  displayName: string;
}

const FEATURE_DISPLAY_NAMES: Record<string, string> = {
  video_generation: 'Video Generation',
  post_generation: 'Post Generation',
  ai_assistant: 'AI Assistant',
  property_extraction: 'Property Extraction',
  email_send: 'Email Sends',
  image_enhancement: 'Image Enhancement',
};

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(217, 91%, 60%)',
];

export function UsageAnalyticsDashboard({ organizationId }: UsageAnalyticsDashboardProps) {
  const { monthlyCredits, isLoading: planLoading } = usePlanInfo();

  const { data: balance, isLoading: balanceLoading, error: balanceError } = useQuery({
    queryKey: ['/api/billing/balance', organizationId],
    queryFn: () => getCreditBalance(organizationId),
    refetchInterval: 30000,
  });

  const { data: usageByFeature, isLoading: usageLoading, error: usageError } = useQuery({
    queryKey: ['usageByFeature', organizationId],
    queryFn: async (): Promise<FeatureUsage[]> => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      
      const { data, error } = await (supabase as any)
        .from('credit_usage_events')
        .select('feature_type, credits_consumed')
        .eq('organization_id', organizationId)
        .gte('created_at', thirtyDaysAgo);

      if (error) {
        console.error('Failed to fetch usage by feature:', error);
        throw error;
      }

      const featureTotals: Record<string, number> = {};
      
      (data || []).forEach((event: { feature_type: string; credits_consumed: number }) => {
        const feature = event.feature_type;
        featureTotals[feature] = (featureTotals[feature] || 0) + Number(event.credits_consumed);
      });

      return Object.entries(featureTotals)
        .map(([feature, credits]) => ({
          feature,
          credits: Number(credits.toFixed(2)),
          displayName: FEATURE_DISPLAY_NAMES[feature] || feature,
        }))
        .sort((a, b) => b.credits - a.credits);
    },
    enabled: !!organizationId,
    staleTime: 60 * 1000,
  });

  const isLoading = planLoading || balanceLoading || usageLoading;
  const hasError = !!balanceError || !!usageError;
  const currentBalance = balance ?? 0;
  const totalUsed = (usageByFeature || []).reduce((sum, f) => sum + f.credits, 0);
  const usagePercentage = monthlyCredits > 0 ? Math.round((totalUsed / monthlyCredits) * 100) : 0;

  if (hasError) {
    return (
      <Card data-testid="card-usage-dashboard-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Usage Analytics
          </CardTitle>
          <CardDescription>
            Visualize your credit usage patterns and trends
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <div className="text-center space-y-2">
              <BarChart3 className="h-12 w-12 mx-auto opacity-20" />
              <p className="text-destructive">Failed to load usage data</p>
              <p className="text-sm">
                Please try refreshing the page or contact support if the issue persists
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card data-testid="card-usage-dashboard">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Usage Analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="section-usage-dashboard">
      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-current-balance">
          <CardHeader className="pb-2">
            <CardDescription>Current Balance</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              {currentBalance.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              of {monthlyCredits} monthly credits
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-monthly-usage">
          <CardHeader className="pb-2">
            <CardDescription>Used This Month</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              {totalUsed.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {usagePercentage}% of monthly allocation
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-top-feature">
          <CardHeader className="pb-2">
            <CardDescription>Top Feature</CardDescription>
            <CardTitle className="text-2xl">
              {usageByFeature && usageByFeature.length > 0 
                ? usageByFeature[0].displayName 
                : 'No usage yet'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {usageByFeature && usageByFeature.length > 0 
                ? `${usageByFeature[0].credits.toFixed(2)} credits consumed`
                : 'Start using features to see analytics'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <WeeklySpendChart organizationId={organizationId} days={7} />

        <Card data-testid="card-usage-by-feature">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Usage by Feature
            </CardTitle>
            <CardDescription>
              Credit consumption by feature type (last 30 days)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usageByFeature && usageByFeature.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={usageByFeature}
                      dataKey="credits"
                      nameKey="displayName"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ displayName, percent }) => 
                        `${displayName} (${(percent * 100).toFixed(0)}%)`
                      }
                      labelLine={false}
                    >
                      {usageByFeature.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={CHART_COLORS[index % CHART_COLORS.length]} 
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(2)} credits`, 'Usage']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-2">
                  <BarChart3 className="h-12 w-12 mx-auto opacity-20" />
                  <p>No usage data yet</p>
                  <p className="text-sm">Start using features to see your breakdown</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {usageByFeature && usageByFeature.length > 0 && (
        <Card data-testid="card-feature-breakdown">
          <CardHeader>
            <CardTitle>Feature Breakdown</CardTitle>
            <CardDescription>
              Detailed credit consumption by feature (last 30 days)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usageByFeature} layout="vertical">
                  <XAxis type="number" />
                  <YAxis 
                    dataKey="displayName" 
                    type="category" 
                    width={120}
                    fontSize={12}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toFixed(2)} credits`, 'Usage']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Bar 
                    dataKey="credits" 
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
