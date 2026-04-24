import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getBillingProfile } from '@/lib/billing/billingClient';
import { supabase } from '@/integrations/supabase/client';
import type { AccountStatus } from '@/lib/billing/types';

export interface PlanInfo {
  planName: string | null;
  displayName: string;
  maxUsers: number;
  maxListings: number | null;
  maxSocialHubs: number;
  monthlyCredits: number;
  billingInterval: string;
  isTrialActive: boolean;
  trialEndsAt: Date | null;
  subscriptionStatus: string | null;
  accountStatus: AccountStatus;
}

const FREE_DEFAULTS = {
  maxUsers: 1,
  maxListings: 3,
  maxSocialHubs: 1,
  monthlyCredits: 0,
};

// Canonical plan source: `v_organization_plan_summary` resolves
// effective_plan_name via COALESCE(billing_override->>'plan_equivalent',
// current_plan_name, 'free') and joins plan_definitions for display + limits.
// Same view powers Super Admin's org list, so Billing/onboarding/limits
// stay in lockstep with what admins see. Stripe subscription state is
// read separately from billing_profiles (needed to decide between
// "Manage Subscription" and "Choose a Plan" CTAs).
export function usePlanInfo() {
  const { organization } = useOrganization();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['planInfo', organization?.id],
    queryFn: async (): Promise<PlanInfo> => {
      if (!organization) {
        throw new Error('No organization');
      }

      const [summaryRes, billingProfile] = await Promise.all([
        (supabase as any)
          .from('v_organization_plan_summary')
          .select(
            'effective_plan_name, plan_display_name, max_users, max_listings, max_social_hubs, monthly_credits'
          )
          .eq('organization_id', organization.id)
          .maybeSingle(),
        getBillingProfile(organization.id).catch(() => null),
      ]);

      const summary = summaryRes?.data ?? null;

      const isTrialActive =
        organization.account_status === 'trial' &&
        !!organization.trial_ends_at &&
        new Date(organization.trial_ends_at) > new Date();

      const planName: string = summary?.effective_plan_name ?? 'free';
      const displayName: string =
        summary?.plan_display_name ||
        (planName === 'free' ? (isTrialActive ? 'Free Tier' : 'Free') : planName);

      return {
        planName,
        displayName,
        maxUsers: summary?.max_users ?? FREE_DEFAULTS.maxUsers,
        maxListings: summary?.max_listings ?? FREE_DEFAULTS.maxListings,
        maxSocialHubs: summary?.max_social_hubs ?? FREE_DEFAULTS.maxSocialHubs,
        monthlyCredits: summary?.monthly_credits ?? FREE_DEFAULTS.monthlyCredits,
        billingInterval: 'week',
        isTrialActive,
        trialEndsAt: organization.trial_ends_at ? new Date(organization.trial_ends_at) : null,
        subscriptionStatus: billingProfile?.subscription_status || null,
        accountStatus: organization.account_status,
      };
    },
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    planInfo: data || null,
    isLoading,
    error,
    refetch,
    planName: data?.planName || null,
    maxUsers: data?.maxUsers ?? FREE_DEFAULTS.maxUsers,
    maxListings: data?.maxListings ?? FREE_DEFAULTS.maxListings,
    maxSocialHubs: data?.maxSocialHubs ?? FREE_DEFAULTS.maxSocialHubs,
    monthlyCredits: data?.monthlyCredits ?? 0,
    isTrialActive: data?.isTrialActive ?? false,
    trialEndsAt: data?.trialEndsAt ?? null,
  };
}
