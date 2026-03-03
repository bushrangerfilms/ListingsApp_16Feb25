import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DisplayAnalyticsSummary {
  listing_id: string;
  listing_title: string | null;
  listing_address: string | null;
  hero_photo: string | null;
  total_views: number;
  total_duration_seconds: number;
  last_shown: string;
}

async function fetchDisplayAnalytics(organizationId: string): Promise<DisplayAnalyticsSummary[]> {
  // Fetch raw analytics for last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: analytics, error } = await supabase
    .from('display_analytics' as any)
    .select('listing_id, duration_seconds, shown_at')
    .eq('organization_id', organizationId)
    .gte('shown_at', thirtyDaysAgo.toISOString())
    .order('shown_at', { ascending: false });

  if (error) throw error;
  if (!analytics || analytics.length === 0) return [];

  // Aggregate by listing
  const byListing = new Map<string, { views: number; duration: number; lastShown: string }>();
  for (const row of analytics as any[]) {
    const existing = byListing.get(row.listing_id);
    if (existing) {
      existing.views++;
      existing.duration += row.duration_seconds;
      if (row.shown_at > existing.lastShown) existing.lastShown = row.shown_at;
    } else {
      byListing.set(row.listing_id, {
        views: 1,
        duration: row.duration_seconds,
        lastShown: row.shown_at,
      });
    }
  }

  // Fetch listing details for the IDs we have
  const listingIds = Array.from(byListing.keys());
  const { data: listings } = await supabase
    .from('listings')
    .select('id, title, address_town, hero_photo')
    .in('id', listingIds);

  const listingMap = new Map((listings || []).map(l => [l.id, l]));

  return Array.from(byListing.entries())
    .map(([listingId, stats]) => {
      const listing = listingMap.get(listingId);
      return {
        listing_id: listingId,
        listing_title: listing?.title || null,
        listing_address: listing?.address_town || null,
        hero_photo: listing?.hero_photo || null,
        total_views: stats.views,
        total_duration_seconds: stats.duration,
        last_shown: stats.lastShown,
      };
    })
    .sort((a, b) => b.total_views - a.total_views);
}

export function useDisplayAnalyticsQuery(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['display-analytics', organizationId],
    queryFn: () => fetchDisplayAnalytics(organizationId!),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });
}
