import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { FEATURE_FLAGS, type FeatureFlagKey } from "@/lib/featureFlags";

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  flag_type: string;
  default_state: boolean;
  is_active: boolean;
}

interface UseFeatureFlagResult {
  isEnabled: boolean;
  isLoading: boolean;
  error: Error | null;
}

export function useFeatureFlag(flagKey: string): UseFeatureFlagResult {
  const { organization } = useOrganization();

  const { data: flag, isLoading, error } = useQuery({
    queryKey: ["feature-flag", flagKey],
    queryFn: async (): Promise<FeatureFlag | null> => {
      const { data, error } = await (supabase as any)
        .from("feature_flags")
        .select("id, key, name, description, flag_type, default_state, is_active")
        .eq("key", flagKey)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null;
        }
        throw error;
      }
      return data as FeatureFlag;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  if (isLoading) {
    return { isEnabled: false, isLoading: true, error: null };
  }

  if (!flag) {
    return { isEnabled: false, isLoading: false, error: null };
  }

  const isEnabled = flag.is_active && flag.default_state;

  return {
    isEnabled,
    isLoading: false,
    error: error as Error | null,
  };
}

export function useFeatureFlags(flagNames: string[]): Record<string, UseFeatureFlagResult> {
  const results: Record<string, UseFeatureFlagResult> = {};

  for (const name of flagNames) {
    results[name] = useFeatureFlag(name);
  }

  return results;
}

export function useUKLaunchFlag(): UseFeatureFlagResult {
  return useFeatureFlag(FEATURE_FLAGS.UK_LAUNCH);
}

export function useUSLaunchFlag(): UseFeatureFlagResult {
  return useFeatureFlag(FEATURE_FLAGS.US_LAUNCH);
}

export function useI18nFlag(): UseFeatureFlagResult {
  return useFeatureFlag(FEATURE_FLAGS.I18N_ENABLED);
}

export function usePilotModeFlag(): UseFeatureFlagResult {
  return useFeatureFlag(FEATURE_FLAGS.PILOT_MODE);
}

export function usePublicSignupFlag(): UseFeatureFlagResult {
  return useFeatureFlag(FEATURE_FLAGS.PUBLIC_SIGNUP_ENABLED);
}

export function useMarketingVisibleFlag(): UseFeatureFlagResult {
  return useFeatureFlag(FEATURE_FLAGS.MARKETING_VISIBLE);
}

export function useBillingEnforcementFlag(): UseFeatureFlagResult {
  return useFeatureFlag(FEATURE_FLAGS.BILLING_ENFORCEMENT);
}

export { FEATURE_FLAGS };
