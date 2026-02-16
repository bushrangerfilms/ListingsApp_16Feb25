import { useMemo, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SITE_COPY_FIELDS, DEFAULT_LOCALE } from '@/lib/siteContentKeys';
import { useLocale } from '@/hooks/useLocale';

interface SiteCopyEntry {
  copy_key: string;
  copy_value: string;
}

const CONTENT_KEY_TO_LOCALE_KEY: Record<string, string> = {
  hero_headline: 'listings.public.findProperty',
  hero_cta_button: 'listings.public.sellProperty',
  search_placeholder: 'listings.public.searchPlaceholder',
  filters_button: 'listings.filters.label',
  valuation_headline: 'listings.public.thinkingOfSelling',
  valuation_description: 'listings.public.getFreeValuation',
  valuation_button: 'listings.public.requestValuation',
  alerts_headline: 'listings.public.cantFindProperty',
  alerts_description: 'listings.public.beFirstToKnow',
  alerts_button: 'listings.public.getNotified',
  testimonials_headline: 'reviews.title',
  footer_tagline: 'footer.tagline',
};

export function useOrgContent(organizationId: string | null) {
  const { t } = useLocale();
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!organizationId) {
      setOverrides({});
      return;
    }

    const fetchContent = async () => {
      setIsLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.rpc as any)('get_organization_site_copy', {
          org_id: organizationId,
          loc: DEFAULT_LOCALE,
        });

        if (error) {
          console.log('[useOrgContent] Content not available:', error.message);
          setOverrides({});
          return;
        }

        const contentMap: Record<string, string> = {};
        ((data as SiteCopyEntry[]) || []).forEach((entry: SiteCopyEntry) => {
          contentMap[entry.copy_key] = entry.copy_value;
        });
        setOverrides(contentMap);
      } catch (err) {
        console.log('[useOrgContent] Unexpected error:', err);
        setOverrides({});
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, [organizationId]);

  const getCopy = useCallback((contentKey: string): string => {
    if (overrides[contentKey]) {
      return overrides[contentKey];
    }
    const localeKey = CONTENT_KEY_TO_LOCALE_KEY[contentKey];
    if (localeKey) {
      return t(localeKey);
    }
    const fieldDef = SITE_COPY_FIELDS.find(f => f.key === contentKey);
    return fieldDef?.defaultValue || contentKey;
  }, [overrides, t]);

  return useMemo(() => ({
    getCopy,
    overrides,
    isLoading,
  }), [getCopy, overrides, isLoading]);
}
