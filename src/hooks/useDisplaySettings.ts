import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DisplaySignageSettings, DisplaySignageConfig } from '@/lib/display-signage/types';

// Fetch all displays for an org (5.1)
export function useDisplaySettingsListQuery(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['display-settings-list', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('display_signage_settings' as any)
        .select('*')
        .eq('organization_id', organizationId!)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as DisplaySignageSettings[];
    },
    enabled: !!organizationId,
  });
}

// Backwards-compatible: fetch single display (first one) for an org
export function useDisplaySettingsQuery(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['display-settings', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('display_signage_settings' as any)
        .select('*')
        .eq('organization_id', organizationId!)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as DisplaySignageSettings | null;
    },
    enabled: !!organizationId,
  });
}

export function useCreateDisplaySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, displayName }: { organizationId: string; displayName?: string }) => {
      const { data, error } = await supabase
        .from('display_signage_settings' as any)
        .insert({
          organization_id: organizationId,
          display_name: displayName || 'New Display',
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as DisplaySignageSettings;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['display-settings', data.organization_id] });
      queryClient.invalidateQueries({ queryKey: ['display-settings-list', data.organization_id] });
    },
  });
}

export function useUpdateDisplaySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      displayId,
      organizationId,
      updates,
    }: {
      displayId: string;
      organizationId: string;
      updates: { is_enabled?: boolean; config?: DisplaySignageConfig; display_name?: string };
    }) => {
      const { data, error } = await supabase
        .from('display_signage_settings' as any)
        .update(updates as any)
        .eq('id', displayId)
        .select()
        .single();

      if (error) throw error;
      return { ...(data as unknown as DisplaySignageSettings), organization_id: organizationId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['display-settings', data.organization_id] });
      queryClient.invalidateQueries({ queryKey: ['display-settings-list', data.organization_id] });
    },
  });
}

export function useDeleteDisplaySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ displayId, organizationId }: { displayId: string; organizationId: string }) => {
      const { error } = await supabase
        .from('display_signage_settings' as any)
        .delete()
        .eq('id', displayId);

      if (error) throw error;
      return { organizationId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['display-settings', data.organizationId] });
      queryClient.invalidateQueries({ queryKey: ['display-settings-list', data.organizationId] });
    },
  });
}
