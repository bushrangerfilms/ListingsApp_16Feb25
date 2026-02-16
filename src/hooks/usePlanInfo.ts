import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getBillingProfile, getPlanByName } from '@/lib/billing/billingClient';
import type { PlanName, PlanDefinition, AccountStatus } from '@/lib/billing/types';

export interface PlanInfo {
  planName: PlanName | 'trial' | null;
  displayName: string;
  maxUsers: number;
  monthlyCredits: number;
  isTrialActive: boolean;
  trialEndsAt: Date | null;
  subscriptionStatus: string | null;
  accountStatus: AccountStatus;
}

const DEFAULT_TRIAL_LIMITS = {
  maxUsers: 10,
  monthlyCredits: 100,
};

const PLAN_DEFAULTS: Record<PlanName, { maxUsers: number; monthlyCredits: number }> = {
  starter: { maxUsers: 10, monthlyCredits: 200 },
  pro: { maxUsers: 10, monthlyCredits: 500 },
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
          planName: 'trial',
          displayName: 'Trial',
          maxUsers: DEFAULT_TRIAL_LIMITS.maxUsers,
          monthlyCredits: DEFAULT_TRIAL_LIMITS.monthlyCredits,
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
          maxUsers: 10,
          monthlyCredits: 0,
          isTrialActive: false,
          trialEndsAt: organization.trial_ends_at ? new Date(organization.trial_ends_at) : null,
          subscriptionStatus: billingProfile?.subscription_status || null,
          accountStatus: organization.account_status,
        };
      }

      const planName = billingProfile.subscription_plan as PlanName;
      let planDefinition: PlanDefinition | null = null;
      
      try {
        planDefinition = await getPlanByName(planName);
      } catch (e) {
        console.warn('Could not fetch plan definition, using defaults');
      }

      const defaults = PLAN_DEFAULTS[planName] || { maxUsers: 1, monthlyCredits: 0 };

      return {
        planName,
        displayName: planDefinition?.display_name || (planName === 'starter' ? 'Starter' : 'Pro'),
        maxUsers: planDefinition?.max_users ?? defaults.maxUsers,
        monthlyCredits: planDefinition?.monthly_credits ?? defaults.monthlyCredits,
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
    maxUsers: data?.maxUsers ?? 10,
    monthlyCredits: data?.monthlyCredits ?? 0,
    isTrialActive: data?.isTrialActive ?? false,
    trialEndsAt: data?.trialEndsAt ?? null,
  };
}
