/**
 * UK Rollout Hook
 * Provides centralized access to UK launch status and rollout controls
 * 
 * This hook combines:
 * - Feature flag status (uk_launch)
 * - Preview mode status for Super Admins
 * - Organization locale detection
 */

import { useMemo, useState, useEffect } from 'react';
import { UK_LAUNCH_FLAG, isFeatureEnabled } from '@/lib/featureFlags';
import { useLocale } from '@/hooks/useLocale';
import { supabase } from '@/integrations/supabase/client';

export interface UKRolloutStatus {
  isUKLaunchEnabled: boolean;
  isPreviewMode: boolean;
  isUKOrganization: boolean;
  canAccessUKFeatures: boolean;
  currentLocale: string;
  currentCurrency: string;
  isLoading: boolean;
}

/**
 * Hook to check UK rollout status and feature availability
 */
export function useUKRollout(organizationId?: string): UKRolloutStatus {
  const [isUKLaunchEnabled, setIsUKLaunchEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { locale, currency, isPreviewMode } = useLocale();
  
  useEffect(() => {
    async function checkFlag() {
      try {
        const enabled = await isFeatureEnabled(supabase, UK_LAUNCH_FLAG, organizationId);
        setIsUKLaunchEnabled(enabled);
      } catch (error) {
        console.warn('[useUKRollout] Failed to check feature flag:', error);
        setIsUKLaunchEnabled(false);
      } finally {
        setIsLoading(false);
      }
    }
    
    checkFlag();
  }, [organizationId]);
  
  const status = useMemo(() => {
    const isUKLocale = locale === 'en-GB';
    const isGBPCurrency = currency === 'GBP';
    const isUKOrganization = isUKLocale || isGBPCurrency;
    
    const canAccessUKFeatures = 
      (isUKLaunchEnabled && isUKOrganization) || 
      isPreviewMode;
    
    return {
      isUKLaunchEnabled,
      isPreviewMode,
      isUKOrganization,
      canAccessUKFeatures,
      currentLocale: locale,
      currentCurrency: currency,
      isLoading,
    };
  }, [isUKLaunchEnabled, locale, currency, isPreviewMode, isLoading]);
  
  return status;
}

/**
 * Check if UK-specific features should be shown
 * This is a simple check for conditionally rendering UK-only content
 */
export function useShowUKFeatures(organizationId?: string): boolean {
  const { canAccessUKFeatures } = useUKRollout(organizationId);
  return canAccessUKFeatures;
}

/**
 * Get appropriate region config based on UK rollout status
 */
export function useRegionForRollout(organizationId?: string): {
  region: 'IE' | 'GB' | 'US';
  isUKEnabled: boolean;
} {
  const { currentLocale, canAccessUKFeatures } = useUKRollout(organizationId);
  
  const region = useMemo(() => {
    if (currentLocale === 'en-GB' && canAccessUKFeatures) {
      return 'GB';
    }
    if (currentLocale === 'en-US') {
      return 'US';
    }
    return 'IE';
  }, [currentLocale, canAccessUKFeatures]);
  
  return {
    region,
    isUKEnabled: canAccessUKFeatures,
  };
}

export default useUKRollout;
