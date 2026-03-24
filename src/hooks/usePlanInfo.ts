import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getBillingProfile, getPlanByName } from '@/lib/billing/billingClient';
import type { PlanDefinition, AccountStatus } from '@/lib/billing/types';

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

export function usePlanInfo() {
  const { organization } = useOrganization();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['planInfo', organization?.id],
    queryFn: async (): Promise<PlanInfo> => {
      if (!organization) {
        throw new Error('No organization');
      }

      const isTrialActive = organization.account_status === 'trial' &&
        organization.trial_ends_at &&
        new Date(organization.trial_ends_at) > new Date();

      if (isTrialActive || organization.account_status === 'trial') {
        return {
          planName: 'free',
          displayName: 'Free Trial',
          maxUsers: FREE_DEFAULTS.maxUsers,
          maxListings: FREE_DEFAULTS.maxListings,
          maxSocialHubs: FREE_DEFAULTS.maxSocialHubs,
          monthlyCredits: FREE_DEFAULTS.monthlyCredits,
          billingInterval: 'week',
          isTrialActive: !!isTrialActive,
          trialEndsAt: organization.trial_ends_at ? new Date(organization.trial_ends_at) : null,
          subscriptionStatus: null,
          accountStatus: organization.account_status,
        };
      }

      const billingProfile = await getBillingProfile(organization.id);

      if (!billingProfile?.subscription_plan) {
        return {
          planName: null,
          displayName: 'No Plan',
          maxUsers: FREE_DEFAULTS.maxUsers,
          maxListings: FREE_DEFAULTS.maxListings,
          maxSocialHubs: FREE_DEFAULTS.maxSocialHubs,
          monthlyCredits: 0,
          billingInterval: 'week',
          isTrialActive: false,
          trialEndsAt: organization.trial_ends_at ? new Date(organization.trial_ends_at) : null,
          subscriptionStatus: billingProfile?.subscription_status || null,
          accountStatus: organization.account_status,
        };
      }

      const planName = billingProfile.subscription_plan;
      let planDefinition: PlanDefinition | null = null;

      try {
        planDefinition = await getPlanByName(planName as any);
      } catch (e) {
        console.warn('Could not fetch plan definition, using defaults');
      }

      return {
        planName,
        displayName: planDefinition?.display_name || planName,
        maxUsers: planDefinition?.max_users ?? FREE_DEFAULTS.maxUsers,
        maxListings: planDefinition?.max_listings ?? null,
        maxSocialHubs: planDefinition?.max_social_hubs ?? FREE_DEFAULTS.maxSocialHubs,
        monthlyCredits: planDefinition?.monthly_credits ?? 0,
        billingInterval: planDefinition?.billing_interval ?? 'week',
        isTrialActive: false,
        trialEndsAt: organization.trial_ends_at ? new Date(organization.trial_ends_at) : null,
        subscriptionStatus: billingProfile.subscription_status || null,
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
