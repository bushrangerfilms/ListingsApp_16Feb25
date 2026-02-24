import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, MousePointer, Eye, TrendingUp } from 'lucide-react';

interface EmailAnalyticsProps {
  profileId: string;
  profileType: 'buyer' | 'seller';
}

interface AnalyticsData {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  openRate: number;
  clickRate: number;
  lastEngagement?: string;
}

export function EmailAnalytics({ profileId, profileType }: EmailAnalyticsProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalSent: 0,
    totalOpened: 0,
    totalClicked: 0,
    openRate: 0,
    clickRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
    
    // Subscribe to real-time tracking updates
    const channel = supabase
      .channel('email-tracking-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_tracking',
        },
        () => {
          fetchAnalytics();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, profileType]);

  const fetchAnalytics = async () => {
    try {
      const profileColumn = profileType === 'buyer' ? 'buyer_profile_id' : 'seller_profile_id';
      
      // Get all sent emails for this profile
      const { data: queueItems, error: queueError } = await supabase
        .from('profile_email_queue')
        .select('id, sent_at')
        .eq(profileColumn, profileId)
        .eq('status', 'sent');

      if (queueError) throw queueError;

      const queueIds = queueItems?.map(item => item.id) || [];
      
      if (queueIds.length === 0) {
        setAnalytics({
          totalSent: 0,
          totalOpened: 0,
          totalClicked: 0,
          openRate: 0,
          clickRate: 0,
        });
        setLoading(false);
        return;
      }

      // Get tracking events for these emails
      const { data: trackingEvents, error: trackingError } = await supabase
        .from('email_tracking')
        .select('id, event_type, profile_email_queue_id, created_at')
        .in('profile_email_queue_id', queueIds)
        .order('created_at', { ascending: false });

      if (trackingError) throw trackingError;

      // Calculate analytics
      const totalSent = queueIds.length;
      const uniqueOpens = new Set(
        trackingEvents?.filter(e => e.event_type === 'opened').map(e => e.profile_email_queue_id)
      ).size;
      const uniqueClicks = new Set(
        trackingEvents?.filter(e => e.event_type === 'clicked').map(e => e.profile_email_queue_id)
      ).size;

      const lastEngagementEvent = trackingEvents?.[0];

      setAnalytics({
        totalSent,
        totalOpened: uniqueOpens,
        totalClicked: uniqueClicks,
        openRate: totalSent > 0 ? Math.round((uniqueOpens / totalSent) * 100) : 0,
        clickRate: uniqueOpens > 0 ? Math.round((uniqueClicks / uniqueOpens) * 100) : 0,
        lastEngagement: lastEngagementEvent?.created_at,
      });
    } catch (error) {
      console.error('Error fetching email analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Email Analytics</CardTitle>
          <CardDescription>Loading analytics...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (analytics.totalSent === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Email Analytics</CardTitle>
          <CardDescription>No emails sent yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Email Analytics</CardTitle>
        <CardDescription>
          Last engagement: {formatDate(analytics.lastEngagement)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{analytics.totalSent}</div>
              <div className="text-xs text-muted-foreground">Emails Sent</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Eye className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{analytics.openRate}%</div>
              <div className="text-xs text-muted-foreground">Open Rate</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <MousePointer className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{analytics.clickRate}%</div>
              <div className="text-xs text-muted-foreground">Click Rate</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
              <TrendingUp className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{analytics.totalClicked}</div>
              <div className="text-xs text-muted-foreground">Total Clicks</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}