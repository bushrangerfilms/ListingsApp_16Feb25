import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { 
  Home, 
  LucideIcon,
  Briefcase,
  Palette,
  Share2
} from 'lucide-react';

export interface OnboardingTask {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  proOnly?: boolean;
  external?: boolean;
}

export const ONBOARDING_TASKS: OnboardingTask[] = [
  {
    id: 'configure_services',
    title: 'Configure property services',
    description: 'Sales, lettings, or holiday rentals',
    href: '/admin/settings',
    icon: Briefcase,
  },
  {
    id: 'save_end_card',
    title: 'Save End Card',
    description: 'Configure video end cards',
    href: 'https://socials.autolisting.io/organization/settings#end-card',
    icon: Palette,
    external: true,
  },
  {
    id: 'connect_social',
    title: 'Connect Social Accounts',
    description: 'Link your social media',
    href: 'https://socials.autolisting.io/accounts',
    icon: Share2,
    external: true,
  },
  {
    id: 'create_listing',
    title: 'Create first listing',
    description: 'Add a property',
    href: '/admin/create',
    icon: Home,
  },
];

interface OnboardingProgress {
  id: string;
  organization_id: string;
  tasks_completed: Record<string, boolean>;
  welcome_seen_at: string | null;
  dismissed_at: string | null;
  completed_at: string | null;
}

export function useOnboarding() {
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = organization?.id;

  const { data: progress, isLoading } = useQuery({
    queryKey: ['onboarding', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;

      const { data, error } = await (supabase as any)
        .from('onboarding_progress')
        .select('*')
        .eq('organization_id', organizationId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching onboarding progress:', error);
        throw error;
      }

      return data as OnboardingProgress | null;
    },
    enabled: !!organizationId,
  });

  const { data: hasSocialAccounts } = useQuery({
    queryKey: ['social-accounts-check', organizationId],
    queryFn: async () => {
      if (!organizationId) return false;

      const { count, error } = await (supabase as any)
        .from('organization_connected_socials')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      if (error) {
        return false;
      }

      return (count ?? 0) > 0;
    },
    enabled: !!organizationId,
  });

  const upsertProgress = useMutation({
    mutationFn: async (updates: Partial<OnboardingProgress>) => {
      if (!organizationId) throw new Error('No organization');

      const { error } = await (supabase as any)
        .from('onboarding_progress')
        .upsert(
          { organization_id: organizationId, ...updates },
          { onConflict: 'organization_id' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding', organizationId] });
    },
  });

  const markTaskComplete = async (taskId: string) => {
    const currentTasks = progress?.tasks_completed || {};
    const updatedTasks = { ...currentTasks, [taskId]: true };
    
    const allComplete = ONBOARDING_TASKS.every(
      task => updatedTasks[task.id] || task.proOnly
    );

    await upsertProgress.mutateAsync({
      tasks_completed: updatedTasks,
      completed_at: allComplete ? new Date().toISOString() : null,
    });
  };

  const markWelcomeSeen = async () => {
    await upsertProgress.mutateAsync({
      welcome_seen_at: new Date().toISOString(),
    });
  };

  const dismissOnboarding = async () => {
    await upsertProgress.mutateAsync({
      dismissed_at: new Date().toISOString(),
    });
  };

  const manualTasks = progress?.tasks_completed || {};
  const tasksCompleted: Record<string, boolean> = {
    ...manualTasks,
    ...(hasSocialAccounts ? { connect_social: true } : {}),
  };
  const completedCount = ONBOARDING_TASKS.filter(
    task => tasksCompleted[task.id]
  ).length;
  const totalCount = ONBOARDING_TASKS.length;
  const percentComplete = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return {
    tasks: ONBOARDING_TASKS,
    tasksCompleted,
    completedCount,
    totalCount,
    percentComplete,
    isLoading,
    isDismissed: !!progress?.dismissed_at,
    isComplete: !!progress?.completed_at,
    hasSeenWelcome: !!progress?.welcome_seen_at,
    markTaskComplete,
    markWelcomeSeen,
    dismissOnboarding,
    isUpdating: upsertProgress.isPending,
  };
}
