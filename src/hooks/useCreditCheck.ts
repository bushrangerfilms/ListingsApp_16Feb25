import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getCreditBalance, getFeatureCost } from '@/lib/billing/billingClient';
import type { FeatureType } from '@/lib/billing/types';

export interface CreditCheckResult {
  hasEnoughCredits: boolean;
  currentBalance: number;
  requiredCredits: number;
  shortfall: number;
  costPerUnit: number;
}

export function useCreditCheck(featureType: FeatureType, quantity: number = 1) {
  const { organization } = useOrganization();

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['creditBalance', organization?.id],
    queryFn: async () => {
      if (!organization) throw new Error('No organization');
      return getCreditBalance(organization.id);
    },
    enabled: !!organization?.id,
    staleTime: 10 * 1000,
  });

  const { data: costPerUnit, isLoading: costLoading } = useQuery({
    queryKey: ['featureCost', featureType],
    queryFn: async () => {
      return getFeatureCost(featureType);
    },
    enabled: !!featureType,
    staleTime: 5 * 60 * 1000,
  });

  const currentBalance = balance ?? 0;
  const unitCost = costPerUnit ?? 0;
  const requiredCredits = unitCost * quantity;
  const hasEnoughCredits = currentBalance >= requiredCredits;
  const shortfall = hasEnoughCredits ? 0 : requiredCredits - currentBalance;

  return {
    hasEnoughCredits,
    currentBalance,
    requiredCredits,
    shortfall,
    costPerUnit: unitCost,
    isLoading: balanceLoading || costLoading,
  };
}

export function useMultiCreditCheck(checks: Array<{ featureType: FeatureType; quantity: number }>) {
  const { organization } = useOrganization();

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['creditBalance', organization?.id],
    queryFn: async () => {
      if (!organization) throw new Error('No organization');
      return getCreditBalance(organization.id);
    },
    enabled: !!organization?.id,
    staleTime: 10 * 1000,
  });

  const featureTypes = [...new Set(checks.map(c => c.featureType))];
  
  const { data: costs, isLoading: costsLoading } = useQuery({
    queryKey: ['featureCosts', featureTypes.sort().join(',')],
    queryFn: async () => {
      const costMap: Record<string, number> = {};
      for (const ft of featureTypes) {
        costMap[ft] = await getFeatureCost(ft);
      }
      return costMap;
    },
    enabled: featureTypes.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const currentBalance = balance ?? 0;
  const costMap = costs ?? {};
  
  let totalRequired = 0;
  for (const check of checks) {
    const unitCost = costMap[check.featureType] ?? 0;
    totalRequired += unitCost * check.quantity;
  }

  const hasEnoughCredits = currentBalance >= totalRequired;
  const shortfall = hasEnoughCredits ? 0 : totalRequired - currentBalance;

  return {
    hasEnoughCredits,
    currentBalance,
    totalRequired,
    shortfall,
    costMap,
    isLoading: balanceLoading || costsLoading,
  };
}
