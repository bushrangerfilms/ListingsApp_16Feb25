import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export function useOrganizationSettings() {
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const orgId = organization?.id;

  // Fetch default branch for this org (needed for organization_settings unique constraint)
  const { data: defaultBranch } = useQuery({
    queryKey: ['default-branch', orgId],
    queryFn: async () => {
      if (!orgId) return null;

      const { data, error } = await (supabase as any)
        .from('branches')
        .select('id')
        .eq('organization_id', orgId)
        .eq('is_default', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const branchId = defaultBranch?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['organization-settings', orgId, branchId],
    queryFn: async () => {
      if (!orgId || !branchId) return null;

      const { data, error } = await (supabase as any)
        .from('organization_settings')
        .select('require_post_approval')
        .eq('organization_id', orgId)
        .eq('branch_id', branchId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!orgId && !!branchId,
  });

  const updateMutation = useMutation({
    mutationFn: async (requireApproval: boolean) => {
      if (!orgId) throw new Error('No organization');
      if (!branchId) throw new Error('No default branch found');

      const { error } = await (supabase as any)
        .from('organization_settings')
        .upsert(
          { organization_id: orgId, branch_id: branchId, require_post_approval: requireApproval },
          { onConflict: 'organization_id,branch_id' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-settings', orgId, branchId] });
    },
  });

  return {
    requirePostApproval: data?.require_post_approval ?? true,
    isLoading,
    updatePostApproval: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}
