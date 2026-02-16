import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

interface SocialConnectionStatus {
  isLoading: boolean;
  needsConnection: boolean;
  connectedCount: number;
  error: string | null;
}

export function useSocialConnectionCheck(): SocialConnectionStatus {
  const { organization } = useOrganization();
  const [isLoading, setIsLoading] = useState(true);
  const [needsConnection, setNeedsConnection] = useState(false);
  const [connectedCount, setConnectedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkSocialConnections() {
      if (!organization?.id) {
        setIsLoading(false);
        return;
      }

      try {
        // Check social_connections table (used by Socials app)
        const { count, error: queryError } = await supabase
          .from('social_connections' as any)
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organization.id)
          .eq('is_active', true);

        console.log('[useSocialConnectionCheck] Query result:', { 
          organizationId: organization.id,
          count, 
          error: queryError?.message 
        });

        if (queryError) {
          // Table might not exist or no access - don't show banner
          console.warn('[useSocialConnectionCheck] Query error:', queryError.message);
          setError(queryError.message);
          setNeedsConnection(false);
        } else if (count === null) {
          // Null count typically means RLS blocking or table access issue
          // Don't show banner if we can't reliably determine connection status
          console.log('[useSocialConnectionCheck] Count is null (RLS or access issue), hiding banner');
          setConnectedCount(0);
          setNeedsConnection(false);
        } else {
          const activeConnections = count;
          console.log('[useSocialConnectionCheck] Active connections:', activeConnections);
          setConnectedCount(activeConnections);
          setNeedsConnection(activeConnections === 0);
        }
      } catch (err) {
        console.error('[useSocialConnectionCheck] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setNeedsConnection(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkSocialConnections();
  }, [organization?.id]);

  return { isLoading, needsConnection, connectedCount, error };
}
