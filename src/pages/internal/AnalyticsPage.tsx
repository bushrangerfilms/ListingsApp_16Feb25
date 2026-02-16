import { useQuery } from '@tanstack/react-query';
import { adminApi, AnalyticsOverview, RecentSignup, FeatureUsage, DiscountStats, VideoAnalyticsOverview, VideoAnalyticsEvent, isCreditsRedacted } from '@/lib/admin/adminApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Loader2, 
  TrendingUp, 
  Users, 
  CreditCard, 
  Activity,
  BarChart3,
  Building2,
  Coins,
  Calendar,
  AlertCircle,
  Play,
  Monitor,
  Smartphone,
  Tablet
} from 'lucide-react';
import { format } from 'date-fns';
import { useSuperAdminPermissions } from '@/hooks/useSuperAdminPermissions';

export default function AnalyticsPage() {
  const { hasSuperAdminAccess, loading: authLoading } = useSuperAdminPermissions();

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['admin-platform-stats'],
    queryFn: () => adminApi.analytics.getOverview(),
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const { data: recentSignups, isLoading: signupsLoading } = useQuery({
    queryKey: ['admin-recent-signups'],
    queryFn: () => adminApi.analytics.getRecentSignups(10),
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const { data: topFeatures } = useQuery({
    queryKey: ['admin-feature-usage'],
    queryFn: () => adminApi.analytics.getFeatureUsage(),
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const { data: discountPerformance } = useQuery({
    queryKey: ['admin-discount-performance'],
    queryFn: () => adminApi.analytics.getDiscountStats(),
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const { data: videoAnalytics, isLoading: videoLoading } = useQuery({
    queryKey: ['admin-video-analytics'],
    queryFn: () => adminApi.analytics.getVideoAnalytics(),
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const { data: videoEvents } = useQuery({
    queryKey: ['admin-video-events'],
    queryFn: () => adminApi.analytics.getVideoEvents(20),
    enabled: !authLoading && hasSuperAdminAccess,
  });

  if (statsLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="p-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium">Failed to load analytics</p>
              <p className="text-sm text-muted-foreground">{(statsError as Error).message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Analytics</h1>
        <p className="text-muted-foreground">Platform-wide usage and performance metrics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-orgs">
              {stats?.organizations.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.organizations.active || 0} active, {stats?.organizations.trial || 0} trial
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-users">
              {stats?.users.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.users.admins || 0} admins
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credits Granted</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {stats?.credits && isCreditsRedacted(stats.credits) ? (
              <>
                <div className="text-2xl font-bold text-muted-foreground" data-testid="stat-credits-granted">
                  Restricted
                </div>
                <p className="text-xs text-muted-foreground">
                  Super admin access required
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="stat-credits-granted">
                  {(stats?.credits && !isCreditsRedacted(stats.credits) ? stats.credits.granted : 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {(stats?.credits && !isCreditsRedacted(stats.credits) ? stats.credits.used : 0).toLocaleString()} used
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Discounts</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-active-discounts">
              {stats?.discounts.active || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.discounts.totalRedemptions || 0} total redemptions
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="signups" className="space-y-4">
        <TabsList>
          <TabsTrigger value="signups" data-testid="tab-signups">
            <Calendar className="h-4 w-4 mr-2" />
            Recent Signups
          </TabsTrigger>
          <TabsTrigger value="features" data-testid="tab-features">
            <BarChart3 className="h-4 w-4 mr-2" />
            Feature Usage
          </TabsTrigger>
          <TabsTrigger value="discounts" data-testid="tab-discounts">
            <TrendingUp className="h-4 w-4 mr-2" />
            Discount Performance
          </TabsTrigger>
          <TabsTrigger value="demo-video" data-testid="tab-demo-video">
            <Play className="h-4 w-4 mr-2" />
            Demo Video
          </TabsTrigger>
        </TabsList>

        <TabsContent value="signups">
          <Card>
            <CardHeader>
              <CardTitle>Recent Signups</CardTitle>
              <CardDescription>Latest organizations to join the platform</CardDescription>
            </CardHeader>
            <CardContent>
              {signupsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : recentSignups && recentSignups.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentSignups.map((org) => (
                      <TableRow key={org.id} data-testid={`row-signup-${org.id}`}>
                        <TableCell className="font-medium">{org.name}</TableCell>
                        <TableCell>
                          <Badge variant={org.account_status === 'active' ? 'default' : 'secondary'}>
                            {org.account_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(org.created_at), 'MMM d, yyyy')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">No recent signups</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle>Feature Usage</CardTitle>
              <CardDescription>Most used features by credit consumption</CardDescription>
            </CardHeader>
            <CardContent>
              {topFeatures && topFeatures.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feature</TableHead>
                      <TableHead className="text-right">Usage Count</TableHead>
                      <TableHead className="text-right">Credits Used</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topFeatures.map((feature, index) => (
                      <TableRow key={feature.feature} data-testid={`row-feature-${index}`}>
                        <TableCell className="font-medium capitalize">
                          {feature.feature.replace(/_/g, ' ')}
                        </TableCell>
                        <TableCell className="text-right">{feature.count}</TableCell>
                        <TableCell className="text-right">{feature.totalCredits.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">No feature usage data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discounts">
          <Card>
            <CardHeader>
              <CardTitle>Discount Performance</CardTitle>
              <CardDescription>Usage statistics for discount codes</CardDescription>
            </CardHeader>
            <CardContent>
              {discountPerformance && discountPerformance.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Times Used</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discountPerformance.map((discount) => (
                      <TableRow key={discount.id} data-testid={`row-discount-${discount.id}`}>
                        <TableCell className="font-mono font-medium">{discount.code}</TableCell>
                        <TableCell className="capitalize">{discount.discount_type}</TableCell>
                        <TableCell className="text-right">
                          {discount.times_used}
                          {discount.max_uses && ` / ${discount.max_uses}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant={discount.is_active ? 'default' : 'secondary'}>
                            {discount.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">No discount codes found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demo-video" className="space-y-4">
          {videoLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                    <Play className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="stat-video-views">
                      {videoAnalytics?.totalViews || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Times video was started
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Unique Sessions</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="stat-video-sessions">
                      {videoAnalytics?.uniqueSessions || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Individual viewer sessions
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="stat-video-completion">
                      {videoAnalytics?.completionRate || 0}%
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Watched to the end
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Watch Time</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="stat-video-watchtime">
                      {Math.floor((videoAnalytics?.avgWatchTimeSeconds || 0) / 60)}:{String((videoAnalytics?.avgWatchTimeSeconds || 0) % 60).padStart(2, '0')}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Minutes watched
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Viewing Funnel</CardTitle>
                    <CardDescription>Drop-off at each progress milestone</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {videoAnalytics?.funnel && videoAnalytics.funnel.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Stage</TableHead>
                            <TableHead className="text-right">Views</TableHead>
                            <TableHead className="text-right">Drop-off</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {videoAnalytics.funnel.map((stage, index) => (
                            <TableRow key={stage.stage} data-testid={`row-funnel-${index}`}>
                              <TableCell className="font-medium">{stage.stage}</TableCell>
                              <TableCell className="text-right">{stage.count}</TableCell>
                              <TableCell className="text-right">
                                {stage.dropOff > 0 ? (
                                  <span className="text-destructive">-{stage.dropOff}%</span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No funnel data yet</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Device Breakdown</CardTitle>
                    <CardDescription>Views by device type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4 text-muted-foreground" />
                          <span>Desktop</span>
                        </div>
                        <span className="font-medium" data-testid="stat-device-desktop">
                          {videoAnalytics?.deviceBreakdown?.desktop || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4 text-muted-foreground" />
                          <span>Mobile</span>
                        </div>
                        <span className="font-medium" data-testid="stat-device-mobile">
                          {videoAnalytics?.deviceBreakdown?.mobile || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Tablet className="h-4 w-4 text-muted-foreground" />
                          <span>Tablet</span>
                        </div>
                        <span className="font-medium" data-testid="stat-device-tablet">
                          {videoAnalytics?.deviceBreakdown?.tablet || 0}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Video Events</CardTitle>
                  <CardDescription>Latest viewer activity</CardDescription>
                </CardHeader>
                <CardContent>
                  {videoEvents && videoEvents.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Event</TableHead>
                          <TableHead>Device</TableHead>
                          <TableHead className="text-right">Progress</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {videoEvents.map((event, index) => (
                          <TableRow key={event.id} data-testid={`row-video-event-${index}`}>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(event.created_at), 'MMM d, HH:mm')}
                            </TableCell>
                            <TableCell>
                              <Badge variant={event.event_type === 'complete' ? 'default' : 'secondary'}>
                                {event.event_type.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="capitalize">{event.device_type || 'unknown'}</TableCell>
                            <TableCell className="text-right">{event.max_percentage}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No video events recorded yet</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
