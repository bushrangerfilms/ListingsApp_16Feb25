import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Coins, CreditCard, TrendingUp, History, BarChart3, Users, Zap, ArrowUpRight, Calendar, Loader2, Check, Sparkles, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { PurchaseCreditsModal } from '@/components/billing/PurchaseCreditsModal';
import { BillingHistoryTable } from '@/components/billing/BillingHistoryTable';
import { UsageAnalyticsDashboard } from '@/components/billing/UsageAnalyticsDashboard';
import { AccountStatusBanner } from '@/components/billing/AccountStatusBanner';
import { getCreditBalance, getUsageRates, getBillingProfile, getPlanDefinitions } from '@/lib/billing/billingClient';
import { getBalanceStatus, getBalanceColor, getTrialDaysRemaining, type AccountStatus } from '@/lib/billing/types';
import { formatPrice, estimatePrice, type SupportedCurrency } from '@/lib/billing/pricing';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useLocale } from '@/hooks/useLocale';
import { usePlanInfo } from '@/hooks/usePlanInfo';
import { supabase } from '@/integrations/supabase/client';

export default function AdminBilling() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { t, formatCurrency, currency: detectedCurrency } = useLocale();
  const currency = detectedCurrency as SupportedCurrency;
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [isLoadingCheckout, setIsLoadingCheckout] = useState<string | null>(null);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  // Per-currency price resolution: use plan_definitions.price_cents_<currency>
  // when populated; FX-estimate from EUR canonical otherwise.
  const resolvePriceCents = (plan: { monthly_price_cents: number } & Partial<Record<`price_cents_${'gbp' | 'usd' | 'cad' | 'aud' | 'nzd'}`, number | null>>): number => {
    if (currency === 'EUR') return plan.monthly_price_cents;
    const realCents = plan[`price_cents_${currency.toLowerCase()}` as keyof typeof plan] as number | null | undefined;
    if (typeof realCents === 'number' && realCents > 0) return realCents;
    return estimatePrice(plan.monthly_price_cents, currency);
  };
  const formatLocalPrice = (cents: number) => formatPrice(cents, currency);

  const { data: planDefinitions } = useQuery({
    queryKey: ['plan-definitions-billing'],
    queryFn: getPlanDefinitions,
    staleTime: 5 * 60 * 1000,
  });

  // Filter to active paid plans (exclude free), matching the marketing page tiers
  const availablePlans = planDefinitions?.filter(p =>
    p.is_active && ['standard', 'professional'].includes(p.plan_tier)
  ) || [];

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['/api/billing/balance', organization?.id],
    queryFn: () => getCreditBalance(organization!.id),
    enabled: !!organization?.id,
    refetchInterval: 30000,
  });

  const { data: usageRates } = useQuery({
    queryKey: ['/api/billing/usage-rates'],
    queryFn: getUsageRates,
  });

  const { data: billingProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['billing-profile', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;
      return getBillingProfile(organization.id);
    },
    enabled: !!organization?.id,
  });

  const currentBalance = balance ?? 0;
  const status = getBalanceStatus(currentBalance);
  const colorClass = getBalanceColor(status);

  const { planInfo } = usePlanInfo();

  const accountStatus = (organization?.account_status || 'trial') as AccountStatus;
  const isOnTrial = accountStatus === 'trial';
  const isTrialExpired = accountStatus === 'trial_expired';
  const hasActiveSubscription = billingProfile?.subscription_status === 'active';
  // Plan display comes from v_organization_plan_summary (via usePlanInfo) —
  // the same source Super Admin writes to. `billing_profiles.subscription_plan`
  // is only set for real Stripe subscriptions, so reading it here hid
  // Super Admin comps and legacy pilot overrides behind "Free Plan".
  const currentPlan = planInfo?.planName || 'free';
  const isFreePlan = currentPlan === 'free';
  // Show the plan picker whenever the org has no active managed plan:
  // trial (haven't picked yet), trial expired, still on free, or came off
  // a Stripe sub (unsubscribed). Comped/pilot orgs (non-free plan, no
  // Stripe sub) skip the picker — admin manages their plan directly.
  const needsPlanSelection =
    isOnTrial ||
    isTrialExpired ||
    accountStatus === 'unsubscribed' ||
    (isFreePlan && !hasActiveSubscription);

  const handleSubscribe = async (planName: string) => {
    if (!organization?.id) {
      toast.error('Organization not found');
      return;
    }

    setIsLoadingCheckout(planName);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Please log in to subscribe');
        setIsLoadingCheckout(null);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            organizationId: organization.id,
            planName,
            returnUrl: window.location.href,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout');
    } finally {
      setIsLoadingCheckout(null);
    }
  };

  const handleManageSubscription = async () => {
    if (!organization?.id) return;

    setIsLoadingPortal(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Please log in to manage subscription');
        setIsLoadingPortal(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-portal`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            organizationId: organization.id,
            returnUrl: window.location.href,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to open billing portal');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error: any) {
      console.error('Portal error:', error);
      toast.error(error.message || 'Failed to open billing portal');
    } finally {
      setIsLoadingPortal(false);
    }
  };

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Billing & Subscription</h1>
          <p className="text-muted-foreground mt-1">
            Manage your plan and billing details
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {hasActiveSubscription && (
            <Button 
              onClick={handleManageSubscription}
              disabled={isLoadingPortal}
              data-testid="button-manage-subscription"
            >
              {isLoadingPortal ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Manage Subscription
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <AccountStatusBanner
        accountStatus={accountStatus}
        trialEndsAt={organization?.trial_ends_at || null}
        gracePeriodEndsAt={organization?.grace_period_ends_at || null}
        readOnlyReason={organization?.read_only_reason || null}
      />

      {needsPlanSelection && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Choose a Plan</h2>
            {isOnTrial && organization?.trial_ends_at && (
              <Badge variant="secondary">
                {getTrialDaysRemaining(organization.trial_ends_at) || 0} days left in trial
              </Badge>
            )}
          </div>
          
          <div className={`grid gap-4 ${availablePlans.length <= 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-' + Math.min(availablePlans.length, 4)}`}>
            {availablePlans.map((plan) => {
              const isPopular = plan.name === 'professional';
              return (
                <Card
                  key={plan.name}
                  className={`relative ${isPopular ? 'border-primary' : ''}`}
                  data-testid={`card-plan-${plan.name}`}
                >
                  {isPopular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                      Most Popular
                    </Badge>
                  )}
                  <CardHeader>
                    <CardTitle>{plan.display_name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="mt-2">
                      <span className="text-3xl font-bold">{formatLocalPrice(resolvePriceCents(plan))}</span>
                      <span className="text-muted-foreground">/{plan.billing_interval}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {(plan.features as string[]).map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-500 shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      variant={isPopular ? 'default' : 'outline'}
                      onClick={() => handleSubscribe(plan.name)}
                      disabled={isLoadingCheckout !== null}
                      data-testid={`button-subscribe-${plan.name}`}
                    >
                      {isLoadingCheckout === plan.name ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          Subscribe to {plan.display_name}
                          <Sparkles className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {isFreePlan && isOnTrial ? 'Free Tier' : (planInfo?.displayName || 'Free Plan')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(() => {
                if (!isFreePlan) {
                  const plan = planDefinitions?.find(p => p.name === currentPlan);
                  return plan ? `${formatLocalPrice(resolvePriceCents(plan))}/${plan.billing_interval}` : '';
                }
                if (isOnTrial && organization?.trial_ends_at) {
                  return `${getTrialDaysRemaining(organization.trial_ends_at) || 0} days remaining`;
                }
                const freeMax = planInfo?.maxListings ?? 3;
                return `${freeMax} listings included`;
              })()}
            </p>
          </CardContent>
        </Card>

        {/* Plan-derived limits. Free plan has real caps (3 listings, 1 post/
            listing/week, 2 lead magnets/week) — the previous "Unlimited"
            copy was misleading and got flagged on 2026-04-24. `null` cap
            means unlimited at that tier (multi-branch). */}
        {(() => {
          const plan = planDefinitions?.find(p => p.name === currentPlan);
          const maxListings = plan?.max_listings ?? null;
          const maxPostsPerListingPerWeek = plan?.max_posts_per_listing_per_week ?? null;
          const maxLeadMagnetsPerWeek = plan?.max_lead_magnets_per_week ?? null;
          const fmtCap = (v: number | null) => (v === null ? 'Unlimited' : `${v}`);
          return (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Listings</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {maxListings === null ? 'Unlimited' : `Up to ${maxListings}`}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">included with your plan</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Posts per Listing</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{fmtCap(maxPostsPerListingPerWeek)}</div>
                  <p className="text-xs text-muted-foreground mt-1">per listing per week</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Lead Magnets</CardTitle>
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{fmtCap(maxLeadMagnetsPerWeek)}</div>
                  <p className="text-xs text-muted-foreground mt-1">posts per week</p>
                </CardContent>
              </Card>
            </>
          );
        })()}
      </div>

      <Tabs defaultValue="history" className="space-y-4">
        <TabsList>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-4">
          <BillingHistoryTable organizationId={organization.id} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <UsageAnalyticsDashboard organizationId={organization.id} />
        </TabsContent>
      </Tabs>

    </div>
  );
}
