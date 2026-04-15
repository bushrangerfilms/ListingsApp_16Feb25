import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SITE_COPY_FIELDS, DEFAULT_LOCALE } from '@/lib/siteContentKeys';

interface SiteCopyEntry {
  copy_key: string;
  copy_value: string;
}

interface ContentContextType {
  getCopy: (key: string, fallback?: string) => string;
  overrides: Record<string, string>;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const ContentContext = createContext<ContentContextType>({
  getCopy: (key, fallback) => fallback || '',
  overrides: {},
  isLoading: false,
  refetch: async () => {},
});

export const useContent = () => {
  const context = useContext(ContentContext);
  if (!context) {
    throw new Error('useContent must be used within ContentProvider');
  }
  return context;
};

interface ContentProviderProps {
  children: ReactNode;
  organizationId: string | null;
  locale?: string;
}

export function ContentProvider({ children, organizationId, locale = DEFAULT_LOCALE }: ContentProviderProps) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const fetchContent = useCallback(async () => {
    if (!organizationId) {
      setOverrides({});
      return;
    }

    setIsLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_organization_site_copy', {
        org_id: organizationId,
        loc: locale,
      });

      if (error) {
        // Table might not exist yet, silently fail
        console.log('[ContentProvider] Site copy not available:', error.message);
        setOverrides({});
        return;
      }

      const contentMap: Record<string, string> = {};
      ((data as SiteCopyEntry[]) || []).forEach((entry: SiteCopyEntry) => {
        contentMap[entry.copy_key] = entry.copy_value;
      });
      setOverrides(contentMap);
    } catch (err) {
      console.log('[ContentProvider] Unexpected error:', err);
      setOverrides({});
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, locale]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const getCopy = useCallback((key: string, fallback?: string): string => {
    if (overrides[key]) {
      return overrides[key];
    }
    if (fallback) {
      return fallback;
    }
    const fieldDef = SITE_COPY_FIELDS.find(f => f.key === key);
    return fieldDef?.defaultValue || key;
  }, [overrides]);

  return (
    <ContentContext.Provider value={{ getCopy, overrides, isLoading, refetch: fetchContent }}>
      {children}
    </ContentContext.Provider>
  );
}
