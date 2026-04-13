import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOnboarding } from './useOnboarding';

interface DetectionResult {
  complete_profile: boolean;
  upload_logo: boolean;
  configure_services: boolean;
  save_end_card: boolean;
  connect_social: boolean;
  create_listing: boolean;
  set_posting_preferences: boolean;
}

export function useOnboardingAutoDetect() {
  const { organization } = useOrganization();
  const { tasksCompleted, markTasksComplete, isLoading: onboardingLoading, isDismissed, isComplete } = useOnboarding();
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
          complete_profile: false,
          upload_logo: false,
          configure_services: false,
          save_end_card: false,
          connect_social: false,
          create_listing: false,
          set_posting_preferences: false,
        };
      }

      const supabaseAny = supabase as any;

      // Fetch org data directly from DB to avoid stale React closure values
      const [orgResult, listingsResult, socialConnectionsResult, endCardResult] = await Promise.all([
        supabaseAny
          .from('organizations')
          .select('contact_name, logo_url, property_services')
          .eq('id', organization.id)
          .single(),
        supabaseAny
          .from('listings')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organization.id),
        supabaseAny
          .from('organization_connected_socials')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organization.id),
        supabaseAny
          .from('org_end_card_settings')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organization.id),
      ]);

      const orgData = orgResult.data;

      // End card is saved if user has actually configured it in Socials app
      const hasEndCard = (endCardResult.count ?? 0) > 0;

      // Profile is complete if contact name is set
      const hasProfile = !!(orgData?.contact_name && orgData.contact_name.trim().length > 0);

      // Logo is complete if logo_url is set
      const hasLogo = !!(orgData?.logo_url && orgData.logo_url.length > 0);

      return {
        complete_profile: hasProfile,
        upload_logo: hasLogo,
        configure_services: !!(orgData?.property_services && orgData.property_services.length > 0),
        save_end_card: hasEndCard,
        connect_social: (socialConnectionsResult.count ?? 0) > 0,
        create_listing: (listingsResult.count ?? 0) > 0,
        set_posting_preferences: false, // Only completed via explicit user interaction
      };
    },
    enabled: !!organization?.id && !onboardingLoading && !isDismissed && !isComplete,
    staleTime: 0,
    refetchOnMount: 'always',
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

    const toMark: string[] = [];
    (Object.entries(detectedTasks) as [keyof DetectionResult, boolean][]).forEach(([taskId, isDetected]) => {
      if (isDetected && !tasksCompleted[taskId] && !processedTasksRef.current.has(taskId)) {
        processedTasksRef.current.add(taskId);
        toMark.push(taskId);
      }
    });
    if (toMark.length > 0) {
      markTasksComplete(toMark);
    }
  }, [detectedTasks, detectionLoading, onboardingLoading, tasksCompleted, markTasksComplete, isDismissed, isComplete]);

  return {
    detectedTasks,
    isLoading: detectionLoading || onboardingLoading,
  };
}
