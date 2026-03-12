import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DisplaySignageConfig, DisplaySignageSettings, DisplayListing, DisplayOrganization } from '@/lib/display-signage/types';
import { DEFAULT_DISPLAY_CONFIG, ALL_DISPLAY_STATUSES } from '@/lib/display-signage/types';

const CATEGORY_MAP: Record<string, string> = {
  sales: 'Listing',
  rentals: 'Rental',
  holiday_rentals: 'Holiday Rental',
};

const LISTING_SELECT = 'id, title, price, address, address_detail, address_town, county, bedrooms, bathrooms, building_type, floor_area_size, land_size, ber_rating, category, status, hero_photo, photos, date_posted, description, ensuite, furnished';

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function fetchDisplayData(organizationId: string, displayId?: string) {
  // Fetch settings — by display ID if provided, otherwise first display for org
  let settingsQuery = supabase
    .from('display_signage_settings' as any)
    .select('*');

  if (displayId) {
    settingsQuery = settingsQuery.eq('id', displayId);
  } else {
    settingsQuery = settingsQuery.eq('organization_id', organizationId).order('created_at', { ascending: true }).limit(1);
  }

  const { data: settings } = await settingsQuery.maybeSingle();

  const config: DisplaySignageConfig = {
    ...DEFAULT_DISPLAY_CONFIG,
    ...((settings as any)?.config || {}),
  };

  // Fetch org branding
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('business_name, logo_url, primary_color, secondary_color, contact_phone, contact_email, psr_licence_number, locale, currency, domain')
    .eq('id', organizationId)
    .single();

  if (orgError) throw orgError;

  // Build listings query
  let query = supabase
    .from('listings')
    .select(LISTING_SELECT)
    .eq('organization_id', organizationId)
    .eq('archived', false)
    .in('status', config.status_filter?.length ? config.status_filter : [...ALL_DISPLAY_STATUSES]);

  // Category filter
  if (config.category_filter && config.category_filter !== 'all') {
    const category = CATEGORY_MAP[config.category_filter];
    if (category) {
      query = query.eq('category', category);
    }
  }

  // Ordering
  switch (config.listing_order) {
    case 'price_high_to_low':
      query = query.order('price', { ascending: false, nullsFirst: false });
      break;
    case 'price_low_to_high':
      query = query.order('price', { ascending: true, nullsFirst: false });
      break;
    default:
      query = query.order('date_posted', { ascending: false });
      break;
  }

  // Limit
  query = query.limit(config.max_listings || 50);

  const { data: listings, error: listingsError } = await query;
  if (listingsError) throw listingsError;

  let processedListings = (listings || []) as unknown as DisplayListing[];

  // Client-side exclusion filter (4.5)
  if (config.excluded_listing_ids?.length) {
    const excluded = new Set(config.excluded_listing_ids);
    processedListings = processedListings.filter(l => !excluded.has(l.id));
  }

  // Client-side shuffle for random order
  if (config.listing_order === 'random') {
    processedListings = shuffleArray(processedListings);
  }

  return {
    organization: org as unknown as DisplayOrganization,
    config,
    listings: processedListings,
    isEnabled: (settings as any)?.is_enabled ?? true,
  };
}

export function useDisplayListings(organizationId: string | undefined, displayId?: string) {
  const queryClient = useQueryClient();

  // Live settings sync via Supabase realtime (3.3)
  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel(`display-settings-${organizationId}`)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'display_signage_settings',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['display-listings', organizationId, displayId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, displayId, queryClient]);

  return useQuery({
    queryKey: ['display-listings', organizationId, displayId],
    queryFn: () => fetchDisplayData(organizationId!, displayId),
    enabled: !!organizationId,
    refetchInterval: 5 * 60 * 1000, // Poll every 5 minutes (fallback)
    staleTime: 60 * 1000,
  });
}
