import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Building2, 
  Users, 
  CreditCard, 
  TrendingUp, 
  AlertCircle,
  ArrowRight,
  Activity,
  Loader2,
  RefreshCw
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAdminPermissions } from "@/hooks/admin/useAdminPermissions";
import { useQuery } from "@tanstack/react-query";
import { adminApi, isCreditsRedacted, AnalyticsOverview } from "@/lib/admin/adminApi";

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { isSuperAdmin, isDeveloper, hasPermission, hasSuperAdminAccess, loading: authLoading } = useAdminPermissions();

  const { data: analytics, isLoading, refetch, isRefetching, isError, error } = useQuery<AnalyticsOverview>({
    queryKey: ['admin', 'analytics', 'overview'],
    queryFn: () => adminApi.analytics.getOverview(),
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 2,
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const { data: recentSignups } = useQuery({
    queryKey: ['admin', 'analytics', 'recent-signups'],
    queryFn: () => adminApi.analytics.getRecentSignups(5),
    staleTime: 60000,
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const formatNumber = (num: number | undefined) => {
    if (num === undefined) return "--";
    return num.toLocaleString();
  };

  const formatCurrency = (num: number | undefined) => {
    if (num === undefined) return "--";
    return new Intl.NumberFormat('en-IE', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  const getCreditsValue = () => {
    if (!analytics?.credits) return "--";
    if (isCreditsRedacted(analytics.credits)) return "Restricted";
    return formatCurrency(analytics.credits.balance);
  };

  const safePercentage = (numerator?: number, denominator?: number) => {
    const num = numerator ?? 0;
    const denom = denominator ?? 0;
    if (denom === 0) return '--';
    return `${Math.round((num / denom) * 100)}%`;
  };

  const kpiCards = [
    {
      title: "Total Organizations",
      value: (isLoading || isRefetching) ? null : formatNumber(analytics?.organizations?.total),
      subValue: analytics?.organizations ? `${analytics.organizations.active ?? 0} active, ${analytics.organizations.trial ?? 0} trial` : null,
      icon: Building2,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      title: "Active Users",
      value: (isLoading || isRefetching) ? null : formatNumber(analytics?.users?.total),
      subValue: analytics?.users ? `${analytics.users.admins ?? 0} admins` : null,
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-900/20",
    },
    {
      title: "Credit Balance",
      value: (isLoading || isRefetching) ? null : getCreditsValue(),
      subValue: analytics?.credits && !isCreditsRedacted(analytics.credits) 
        ? `${formatCurrency(analytics.credits.granted ?? 0)} granted, ${formatCurrency(analytics.credits.used ?? 0)} used` 
        : (isCreditsRedacted(analytics?.credits) ? "Revenue data restricted" : null),
      icon: CreditCard,
      color: "text-violet-600",
      bgColor: "bg-violet-50 dark:bg-violet-900/20",
      permission: 'canAccessBilling' as const,
    },
    {
      title: "Active Discounts",
      value: (isLoading || isRefetching) ? null : formatNumber(analytics?.discounts?.active),
      subValue: analytics?.discounts ? `${analytics.discounts.totalRedemptions ?? 0} total redemptions` : null,
      icon: TrendingUp,
      color: "text-amber-600",
      bgColor: "bg-amber-50 dark:bg-amber-900/20",
    },
  ];

  const quickActions = [
    {
      label: "View Organizations",
      description: "Browse all tenant organizations",
      path: "/internal/organizations",
      icon: Building2,
    },
    {
      label: "Manage Users",
      description: "Search and manage users",
      path: "/internal/users",
      icon: Users,
    },
    {
      label: "Feature Flags",
      description: "Toggle features on/off",
      path: "/internal/feature-flags",
      icon: Activity,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="heading-super-admin-dashboard">
            Super Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Platform overview and quick actions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isRefetching}
            data-testid="button-refresh-dashboard"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Badge 
            variant="outline" 
            className={isSuperAdmin 
              ? "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400" 
              : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400"
            }
            data-testid="badge-role"
          >
            {isSuperAdmin ? 'Super Admin' : isDeveloper ? 'Developer' : 'Unknown Role'}
          </Badge>
        </div>
      </div>

      {isError && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-destructive">Failed to load analytics</p>
              <p className="text-sm text-muted-foreground">{(error as Error)?.message || 'Unknown error'}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards
          .filter(card => !card.permission || hasPermission(card.permission))
          .map((card, index) => (
            <Card key={index} data-testid={`card-kpi-${card.title.toLowerCase().replace(/\s+/g, '-')}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                {card.value === null ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold text-foreground">{card.value}</div>
                )}
                {card.subValue === null ? (
                  <Skeleton className="h-4 w-32 mt-1" />
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    {card.subValue}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="card-quick-actions">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                className="w-full justify-between h-auto py-3"
                onClick={() => navigate(action.path)}
                data-testid={`button-quick-action-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="flex items-center gap-3">
                  <action.icon className="h-4 w-4 text-muted-foreground" />
                  <div className="text-left">
                    <div className="font-medium">{action.label}</div>
                    <div className="text-xs text-muted-foreground">{action.description}</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card data-testid="card-recent-signups">
          <CardHeader>
            <CardTitle>Recent Signups</CardTitle>
            <CardDescription>Latest organization registrations</CardDescription>
          </CardHeader>
          <CardContent>
            {!recentSignups || recentSignups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="p-3 rounded-full bg-muted mb-3">
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No recent signups to display
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentSignups.map((signup) => (
                  <div 
                    key={signup.id} 
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    data-testid={`row-signup-${signup.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{signup.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(signup.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={
                        signup.account_status === 'trial' 
                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400'
                          : signup.account_status === 'active'
                          ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-muted'
                      }
                    >
                      {signup.account_status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {analytics?.organizations && analytics?.users && (
        <Card data-testid="card-predictive-analytics">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Platform Insights
            </CardTitle>
            <CardDescription>Key metrics and growth indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                  <span className="text-sm font-medium text-foreground">Trial Conversion Rate</span>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {safePercentage(analytics.organizations.active, analytics.organizations.total)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.organizations.active ?? 0} of {analytics.organizations.total ?? 0} converted
                </p>
              </div>
              
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  <span className="text-sm font-medium text-foreground">Trials in Progress</span>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {analytics.organizations.trial ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Potential conversions pending
                </p>
              </div>
              
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span className="text-sm font-medium text-foreground">Admin Density</span>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {safePercentage(analytics.users.admins, analytics.users.total)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.users.admins ?? 0} admins of {analytics.users.total ?? 0} users
                </p>
              </div>
            </div>
            
            {analytics.discounts && (analytics.discounts.totalRedemptions ?? 0) > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Discount program active</span>
                  </div>
                  <Badge variant="outline">
                    {analytics.discounts.totalRedemptions ?? 0} redemptions across {analytics.discounts.active ?? 0} active codes
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-system-status">
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>Platform health overview</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <div className="h-3 w-3 rounded-full bg-green-500"></div>
              <div>
                <div className="text-sm font-medium text-foreground">Database</div>
                <div className="text-xs text-muted-foreground">Operational</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <div className="h-3 w-3 rounded-full bg-green-500"></div>
              <div>
                <div className="text-sm font-medium text-foreground">Auth Service</div>
                <div className="text-xs text-muted-foreground">Operational</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <div className="h-3 w-3 rounded-full bg-green-500"></div>
              <div>
                <div className="text-sm font-medium text-foreground">Stripe</div>
                <div className="text-xs text-muted-foreground">Connected</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
