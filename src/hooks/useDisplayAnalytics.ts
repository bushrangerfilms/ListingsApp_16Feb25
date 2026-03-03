import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DisplaySignageConfig } from '@/lib/display-signage/types';

interface AnalyticsEntry {
  listing_id: string;
  shown_at: string;
}

/**
 * Tracks which listings are shown on the display and for how long.
 * Batches inserts on slide change to minimize DB writes.
 */
export function useDisplayAnalytics(
  organizationId: string | undefined,
  config: DisplaySignageConfig,
) {
  const currentEntry = useRef<AnalyticsEntry | null>(null);
  const theme = config.display_theme || 'classic';

  const recordSlideView = useCallback((listingId: string, orientation: string) => {
    if (!organizationId) return;

    // Flush previous entry
    if (currentEntry.current && currentEntry.current.listing_id !== listingId) {
      const prev = currentEntry.current;
      const durationMs = Date.now() - new Date(prev.shown_at).getTime();
      const durationSeconds = Math.round(durationMs / 1000);

      if (durationSeconds >= 2) {
        // Fire and forget — don't block the UI
        supabase
          .from('display_analytics' as any)
          .insert({
            organization_id: organizationId,
            listing_id: prev.listing_id,
            shown_at: prev.shown_at,
            duration_seconds: durationSeconds,
            theme,
            orientation,
          })
          .then(() => {});
      }
    }

    // Start tracking new listing
    currentEntry.current = {
      listing_id: listingId,
      shown_at: new Date().toISOString(),
    };
  }, [organizationId, theme]);

  // Flush the last entry (call on unmount)
  const flush = useCallback((orientation: string) => {
    if (!organizationId || !currentEntry.current) return;
    const prev = currentEntry.current;
    const durationMs = Date.now() - new Date(prev.shown_at).getTime();
    const durationSeconds = Math.round(durationMs / 1000);

    if (durationSeconds >= 2) {
      // Use sendBeacon-style: navigator.sendBeacon isn't great for Supabase,
      // so we just fire the insert and hope it completes
      supabase
        .from('display_analytics' as any)
        .insert({
          organization_id: organizationId,
          listing_id: prev.listing_id,
          shown_at: prev.shown_at,
          duration_seconds: durationSeconds,
          theme,
          orientation,
        })
        .then(() => {});
    }
    currentEntry.current = null;
  }, [organizationId, theme]);

  return { recordSlideView, flush };
}
