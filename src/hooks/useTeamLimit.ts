import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePlanInfo } from './usePlanInfo';
import { supabase } from '@/integrations/supabase/client';

export interface TeamLimitInfo {
  canAddUser: boolean;
  currentUserCount: number;
  maxUsers: number;
  isAtLimit: boolean;
  isApproachingLimit: boolean;
  remainingSlots: number;
  isBillingExempt: boolean;
}

export function useTeamLimit() {
  const { organization } = useOrganization();
  const { maxUsers, isLoading: planLoading } = usePlanInfo();
  
  // Comped/pilot organizations have no team limits
  const isBillingExempt = organization?.is_comped === true;

  const { data: userCount, isLoading: countLoading, error, refetch } = useQuery({
    queryKey: ['teamUserCount', organization?.id],
    queryFn: async (): Promise<number> => {
      if (!organization) {
        throw new Error('No organization');
      }

      const { count, error } = await supabase
        .schema('public')
        .from('user_organizations')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .neq('role', 'super_admin')
        .neq('role', 'developer');

      if (error) {
        console.error('Failed to count team members:', error);
        throw error;
      }

      return count || 0;
    },
    enabled: !!organization?.id,
    staleTime: 30 * 1000,
  });

  const currentUserCount = userCount ?? 0;
  
  // Comped orgs bypass all limits
  const effectiveMaxUsers = isBillingExempt ? 999999 : maxUsers;
  const isAtLimit = !isBillingExempt && currentUserCount >= maxUsers;
  const isApproachingLimit = !isBillingExempt && maxUsers > 1 && currentUserCount >= maxUsers - 1 && currentUserCount < maxUsers;
  const remainingSlots = isBillingExempt ? 999999 : Math.max(0, maxUsers - currentUserCount);

  return {
    canAddUser: isBillingExempt || !isAtLimit,
    currentUserCount,
    maxUsers: effectiveMaxUsers,
    isAtLimit,
    isApproachingLimit,
    remainingSlots,
    isLoading: planLoading || countLoading,
    isBillingExempt,
    error,
    refetch,
  };
}
