import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOnboarding } from './useOnboarding';

interface DetectionResult {
  configure_services: boolean;
  save_end_card: boolean;
  connect_social: boolean;
  create_listing: boolean;
}

export function useOnboardingAutoDetect() {
  const { organization } = useOrganization();
  const { tasksCompleted, markTaskComplete, isLoading: onboardingLoading, isDismissed, isComplete } = useOnboarding();
  const processedTasksRef = useRef<Set<string>>(new Set());
  const lastOrgIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (organization?.id && organization.id !== lastOrgIdRef.current) {
      processedTasksRef.current.clear();
      lastOrgIdRef.current = organization.id;
    }
  }, [organization?.id]);

  const { data: detectedTasks, isLoading: detectionLoading } = useQuery({
    queryKey: ['onboarding-detection', organization?.id],
    queryFn: async (): Promise<DetectionResult> => {
      if (!organization?.id) {
        return {
          configure_services: false,
          save_end_card: false,
          connect_social: false,
          create_listing: false,
        };
      }

      const supabaseAny = supabase as any;
      
      const [listingsResult, socialConnectionsResult] = await Promise.all([
        supabaseAny
          .schema('crm')
          .from('listings')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organization.id),
        supabaseAny
          .from('social_connections')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organization.id),
      ]);

      // End card is considered saved if organization has logo and primary color set
      const hasEndCard = !!(
        organization.logo_url && 
        organization.logo_url.length > 0 &&
        organization.primary_color
      );

      return {
        configure_services: !!(organization.property_services && organization.property_services.length > 0),
        save_end_card: hasEndCard,
        connect_social: (socialConnectionsResult.count ?? 0) > 0,
        create_listing: (listingsResult.count ?? 0) > 0,
      };
    },
    enabled: !!organization?.id && !onboardingLoading && !isDismissed && !isComplete,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (
      detectionLoading || 
      onboardingLoading || 
      !detectedTasks || 
      isDismissed ||
      isComplete
    ) {
      return;
    }

    (Object.entries(detectedTasks) as [keyof DetectionResult, boolean][]).forEach(([taskId, isDetected]) => {
      if (isDetected && !tasksCompleted[taskId] && !processedTasksRef.current.has(taskId)) {
        processedTasksRef.current.add(taskId);
        markTaskComplete(taskId);
      }
    });
  }, [detectedTasks, detectionLoading, onboardingLoading, tasksCompleted, markTaskComplete, isDismissed, isComplete]);

  return {
    detectedTasks,
    isLoading: detectionLoading || onboardingLoading,
  };
}
