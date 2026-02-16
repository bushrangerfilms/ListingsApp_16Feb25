import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface WeeklySpendChartProps {
  organizationId: string;
  days?: number;
}

interface DailySpend {
  date: string;
  displayDate: string;
  credits: number;
}

export function WeeklySpendChart({ organizationId, days = 7 }: WeeklySpendChartProps) {
  const { data: spendData, isLoading, error } = useQuery({
    queryKey: ['weeklySpend', organizationId, days],
    queryFn: async (): Promise<DailySpend[]> => {
      const now = new Date();
      const startDate = startOfDay(subDays(now, days - 1));
      const endDate = endOfDay(now);

      const { data, error } = await (supabase as any)
        .from('credit_transactions')
        .select('amount, created_at')
        .eq('organization_id', organizationId)
        .eq('transaction_type', 'consumption')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) {
        console.error('Failed to fetch weekly spend:', error);
        throw error;
      }

      const dailyTotals: Record<string, number> = {};
      
      for (let i = 0; i < days; i++) {
        const date = subDays(now, days - 1 - i);
        const dateKey = format(date, 'yyyy-MM-dd');
        dailyTotals[dateKey] = 0;
      }

      (data || []).forEach((tx) => {
        const dateKey = format(new Date(tx.created_at), 'yyyy-MM-dd');
        if (dateKey in dailyTotals) {
          dailyTotals[dateKey] += Math.abs(Number(tx.amount));
        }
      });

      return Object.entries(dailyTotals).map(([date, credits]) => ({
        date,
        displayDate: format(new Date(date), 'EEE'),
        credits: Number(credits.toFixed(2)),
      }));
    },
    enabled: !!organizationId,
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Weekly Spending
          </CardTitle>
        </CardHeader>
        <CardContent className="h-48 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Weekly Spending
          </CardTitle>
        </CardHeader>
        <CardContent className="h-48 flex items-center justify-center text-muted-foreground">
          Failed to load spending data
        </CardContent>
      </Card>
    );
  }

  const totalSpend = (spendData || []).reduce((sum, d) => sum + d.credits, 0);

  return (
    <Card data-testid="card-weekly-spend">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Weekly Spending
        </CardTitle>
        <CardDescription>
          {totalSpend.toFixed(2)} credits used in the last {days} days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={spendData}>
              <XAxis 
                dataKey="displayDate" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip 
                formatter={(value: number) => [`${value.toFixed(2)} credits`, 'Usage']}
                labelFormatter={(label) => `${label}`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
              />
              <Bar 
                dataKey="credits" 
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
