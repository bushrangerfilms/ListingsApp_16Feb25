import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getOrgPlanSummary } from '@/lib/billing/billingClient';
import type { PlanName, AccountStatus, OrgPlanSummary } from '@/lib/billing/types';

export interface PlanInfo {
  planName: PlanName | 'trial' | null;
  displayName: string;
  maxUsers: number;
  monthlyCredits: number;
  maxListings: number | null;
  maxSocialHubs: number | null;
  maxPostsPerListingPerWeek: number | null;
  maxLeadMagnetsPerWeek: number | null;
  maxCrmContacts: number | null;
  hasWatermark: boolean;
  allowedVideoStyles: string[];
  isTrialActive: boolean;
  trialEndsAt: Date | null;
  subscriptionStatus: string | null;
  accountStatus: AccountStatus;
  isPilot: boolean;
  listingCount: number;
  hubCount: number;
}

export function usePlanInfo() {
  const { organization } = useOrganization();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['planInfo', organization?.id],
    queryFn: async (): Promise<PlanInfo> => {
      if (!organization) {
        throw new Error('No organization');
      }

      const summary = await getOrgPlanSummary(organization.id);

      const isTrialActive = organization.account_status === 'trial' &&
        organization.trial_ends_at &&
        new Date(organization.trial_ends_at) > new Date();

      if (!summary) {
        return {
          planName: organization.account_status === 'trial' ? 'trial' : 'free',
          displayName: organization.account_status === 'trial' ? 'Trial' : 'Free',
          maxUsers: 2,
          monthlyCredits: 50,
          maxListings: 2,
          maxSocialHubs: 1,
          maxPostsPerListingPerWeek: 1,
          maxLeadMagnetsPerWeek: 0,
          maxCrmContacts: 50,
          hasWatermark: true,
          allowedVideoStyles: ['video_style_1'],
          isTrialActive: !!isTrialActive,
          trialEndsAt: organization.trial_ends_at ? new Date(organization.trial_ends_at) : null,
          subscriptionStatus: null,
          accountStatus: organization.account_status,
          isPilot: false,
          listingCount: 0,
          hubCount: 1,
        };
      }

      return {
        planName: summary.effective_plan_name,
        displayName: summary.plan_display_name,
        maxUsers: summary.max_users,
        monthlyCredits: summary.monthly_credits,
        maxListings: summary.max_listings,
        maxSocialHubs: summary.max_social_hubs,
        maxPostsPerListingPerWeek: summary.max_posts_per_listing_per_week,
        maxLeadMagnetsPerWeek: summary.max_lead_magnets_per_week,
        maxCrmContacts: summary.max_crm_contacts,
        hasWatermark: summary.has_watermark,
        allowedVideoStyles: summary.allowed_video_styles || ['video_style_1'],
        isTrialActive: !!isTrialActive,
        trialEndsAt: organization.trial_ends_at ? new Date(organization.trial_ends_at) : null,
        subscriptionStatus: null,
        accountStatus: summary.account_status,
        isPilot: summary.has_billing_override,
        listingCount: summary.listing_count,
        hubCount: summary.hub_count,
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
    maxUsers: data?.maxUsers ?? 2,
    monthlyCredits: data?.monthlyCredits ?? 0,
    maxListings: data?.maxListings ?? 2,
    isTrialActive: data?.isTrialActive ?? false,
    trialEndsAt: data?.trialEndsAt ?? null,
    isPilot: data?.isPilot ?? false,
    listingCount: data?.listingCount ?? 0,
    hubCount: data?.hubCount ?? 1,
  };
}
