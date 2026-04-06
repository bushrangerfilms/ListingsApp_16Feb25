import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export function useOrganizationSettings() {
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const orgId = organization?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['organization-settings', orgId],
    queryFn: async () => {
      if (!orgId) return null;

      const { data, error } = await (supabase as any)
        .from('organization_settings')
        .select('require_post_approval')
        .eq('organization_id', orgId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const updateMutation = useMutation({
    mutationFn: async (requireApproval: boolean) => {
      if (!orgId) throw new Error('No organization');

      const { error } = await (supabase as any)
        .from('organization_settings')
        .upsert(
          { organization_id: orgId, require_post_approval: requireApproval },
          { onConflict: 'organization_id' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-settings', orgId] });
    },
  });

  return {
    requirePostApproval: data?.require_post_approval ?? true,
    isLoading,
    updatePostApproval: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}
