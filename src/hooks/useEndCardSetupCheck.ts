import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

interface EndCardSetupStatus {
  isLoading: boolean;
  needsSetup: boolean;
  error: string | null;
}

export function useEndCardSetupCheck(): EndCardSetupStatus {
  const { organization } = useOrganization();
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkEndCardSetup() {
      if (!organization?.id) {
        setIsLoading(false);
        return;
      }

      try {
        // Check org_end_card_settings table (used by Socials app)
        // Using type assertion since this table is managed by Socials app
        const { data, error: queryError } = await supabase
          .from('org_end_card_settings' as any)
          .select('endcard_16x9_path')
          .eq('organization_id', organization.id)
          .maybeSingle();

        if (queryError) {
          console.warn('[useEndCardSetupCheck] Query error:', queryError.message);
          setError(queryError.message);
          setNeedsSetup(false);
        } else {
          const hasEndCard = (data as any)?.endcard_16x9_path != null;
          setNeedsSetup(!hasEndCard);
        }
      } catch (err) {
        console.error('[useEndCardSetupCheck] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setNeedsSetup(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkEndCardSetup();
  }, [organization?.id]);

  return { isLoading, needsSetup, error };
}
