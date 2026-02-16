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
import { getCreditBalance, getUsageRates, getBillingProfile } from '@/lib/billing/billingClient';
import { getBalanceStatus, getBalanceColor, getTrialDaysRemaining, type AccountStatus } from '@/lib/billing/types';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useLocale } from '@/hooks/useLocale';
import { supabase } from '@/integrations/supabase/client';

interface PlanConfig {
  name: string;
  priceEur: number;
  monthlyCredits: number;
  maxUsers: number;
  features: string[];
  popular?: boolean;
}

const PLAN_CONFIGS: PlanConfig[] = [
  {
    name: 'starter',
    priceEur: 29,
    monthlyCredits: 200,
    maxUsers: 1,
    features: ['All platform features', '200 credits/month', '1 user'],
  },
  {
    name: 'pro',
    priceEur: 79,
    monthlyCredits: 500,
    maxUsers: 10,
    features: ['All platform features', '500 credits/month', 'Up to 10 users', 'Priority support'],
    popular: true,
  },
];

export default function AdminBilling() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { t, formatCurrency } = useLocale();
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [isLoadingCheckout, setIsLoadingCheckout] = useState<string | null>(null);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

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

  const accountStatus = (organization?.account_status || 'trial') as AccountStatus;
  const isOnTrial = accountStatus === 'trial';
  const isTrialExpired = accountStatus === 'trial_expired';
  const hasActiveSubscription = billingProfile?.subscription_status === 'active';
  const needsPlanSelection = isOnTrial || isTrialExpired || !hasActiveSubscription;
  const currentPlan = billingProfile?.subscription_plan || 'starter';

  const handleSubscribe = async (planName: string) => {
    if (!organization?.id) {
      toast.error('Organisation not found');
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
            Manage your plan, credits, and billing details
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={() => setShowPurchaseModal(true)}
            variant="outline"
            data-testid="button-purchase-credits"
          >
            <Coins className="h-4 w-4 mr-2" />
            Buy Credits
          </Button>
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
          
          <div className="grid md:grid-cols-2 gap-4">
            {PLAN_CONFIGS.map((planConfig) => (
              <Card 
                key={planConfig.name}
                className={`relative ${planConfig.popular ? 'border-primary' : ''}`}
                data-testid={`card-plan-${planConfig.name}`}
              >
                {planConfig.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle className="capitalize">{planConfig.name}</CardTitle>
                  <CardDescription>
                    {planConfig.name === 'starter' ? 'Perfect for solo agents' : 'For growing teams'}
                  </CardDescription>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">{formatCurrency(planConfig.priceEur)}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {planConfig.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={planConfig.popular ? 'default' : 'outline'}
                    onClick={() => handleSubscribe(planConfig.name)}
                    disabled={isLoadingCheckout !== null}
                    data-testid={`button-subscribe-${planConfig.name}`}
                  >
                    {isLoadingCheckout === planConfig.name ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Subscribe to {planConfig.name.charAt(0).toUpperCase() + planConfig.name.slice(1)}
                        <Sparkles className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
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
              {hasActiveSubscription ? currentPlan : isOnTrial ? 'Free Trial' : 'No Plan'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {hasActiveSubscription 
                ? `${formatCurrency(currentPlan === 'pro' ? 79 : 29)}/month`
                : isOnTrial && organization?.trial_ends_at
                  ? `${getTrialDaysRemaining(organization.trial_ends_at) || 0} days remaining`
                  : 'Subscribe to get started'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credit Balance</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {balanceLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className={`text-2xl font-bold ${colorClass}`}>
                  {currentBalance}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  credits available
                </p>
                {(status === 'low' || status === 'critical') && (
                  <Badge variant="destructive" className="mt-2">
                    {status === 'critical' ? 'Critical - Top up now' : 'Low balance'}
                  </Badge>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Posts</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usageRates?.find(r => r.feature_type === 'post_generation')?.credits_per_use || 7}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              credits per platform
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              ≈ {Math.floor(currentBalance / 7)} posts remaining
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Video Generation</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usageRates?.find(r => r.feature_type === 'video_generation')?.credits_per_use || 14}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              credits (both 16:9 + 9:16)
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              ≈ {Math.floor(currentBalance / 14)} video sets remaining
            </p>
          </CardContent>
        </Card>
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

      <PurchaseCreditsModal
        open={showPurchaseModal}
        onOpenChange={setShowPurchaseModal}
        organizationId={organization.id}
        currentBalance={currentBalance}
      />
    </div>
  );
}
