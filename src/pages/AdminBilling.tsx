import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard, TrendingUp, BarChart3, History, Loader2, Check,
  Sparkles, ExternalLink, Building2, Home, LayoutGrid, Mail, Users, Zap,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { BillingHistoryTable } from '@/components/billing/BillingHistoryTable';
import { UsageAnalyticsDashboard } from '@/components/billing/UsageAnalyticsDashboard';
import { AccountStatusBanner } from '@/components/billing/AccountStatusBanner';
import { getOrgPlanSummary, getPlanDefinitions, getBillingProfile } from '@/lib/billing/billingClient';
import type { AccountStatus, PlanDefinition, OrgPlanSummary } from '@/lib/billing/types';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useLocale } from '@/hooks/useLocale';
import { supabase } from '@/integrations/supabase/client';

function UsageMeter({ label, current, max, icon: Icon }: {
  label: string;
  current: number;
  max: number | null;
  icon: React.ElementType;
}) {
  const isUnlimited = max === null;
  const percentage = isUnlimited ? 0 : max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const isNearLimit = !isUnlimited && percentage >= 80;
  const isAtLimit = !isUnlimited && current >= (max ?? 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </div>
        <span className={`font-medium ${isAtLimit ? 'text-red-600' : isNearLimit ? 'text-orange-600' : ''}`}>
          {current} / {isUnlimited ? '∞' : max}
        </span>
      </div>
      {!isUnlimited && (
        <Progress
          value={percentage}
          className={`h-2 ${isAtLimit ? '[&>div]:bg-red-500' : isNearLimit ? '[&>div]:bg-orange-500' : ''}`}
        />
      )}
    </div>
  );
}

function PlanCard({ plan, isCurrentPlan, onSubscribe, isLoading }: {
  plan: PlanDefinition;
  isCurrentPlan: boolean;
  onSubscribe: (planName: string) => void;
  isLoading: boolean;
}) {
  const isFree = plan.plan_tier === 'free';
  const isPopular = plan.name === 'professional';
  const isMultiBranch = plan.plan_tier === 'multi_branch';

  return (
    <Card
      className={`relative ${isPopular ? 'border-primary shadow-md' : ''} ${isCurrentPlan ? 'bg-muted/30' : ''}`}
      data-testid={`card-plan-${plan.name}`}
    >
      {isPopular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
          Most Popular
        </Badge>
      )}
      {isCurrentPlan && (
        <Badge variant="secondary" className="absolute -top-3 right-4">
          Current Plan
        </Badge>
      )}
      <CardHeader className="pb-3">
        <CardTitle>{plan.display_name}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>
        <div className="mt-2">
          {isFree ? (
            <span className="text-3xl font-bold">Free</span>
          ) : (
            <>
              <span className="text-3xl font-bold">TBD</span>
              <span className="text-muted-foreground">/{plan.billing_interval}</span>
            </>
          )}
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
        {!isCurrentPlan && !isFree && (
          <Button
            className="w-full"
            variant={isPopular ? 'default' : 'outline'}
            onClick={() => onSubscribe(plan.name)}
            disabled={isLoading}
            data-testid={`button-subscribe-${plan.name}`}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Upgrade to {plan.display_name}
                <Sparkles className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        )}
        {isCurrentPlan && (
          <Button className="w-full" variant="outline" disabled>
            Current Plan
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminBilling() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { t, formatCurrency } = useLocale();
  const [isLoadingCheckout, setIsLoadingCheckout] = useState<string | null>(null);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  const { data: planSummary, isLoading: planLoading } = useQuery({
    queryKey: ['plan-summary', organization?.id],
    queryFn: () => getOrgPlanSummary(organization!.id),
    enabled: !!organization?.id,
    refetchInterval: 60000,
  });

  const { data: allPlans } = useQuery({
    queryKey: ['plan-definitions'],
    queryFn: getPlanDefinitions,
  });

  const { data: billingProfile } = useQuery({
    queryKey: ['billing-profile', organization?.id],
    queryFn: () => getBillingProfile(organization!.id),
    enabled: !!organization?.id,
  });

  const accountStatus = (organization?.account_status || 'free') as AccountStatus;
  const hasActiveSubscription = billingProfile?.subscription_status === 'active';
  const effectivePlan = planSummary?.effective_plan_name || 'free';
  const isPilot = planSummary?.has_billing_override || false;

  // Filter plans for display: show standard tiers, not multi-branch (those are shown separately)
  const standardPlans = allPlans?.filter(p =>
    p.is_active && ['free', 'standard', 'professional'].includes(p.plan_tier)
  ) || [];

  const multiBranchPlans = allPlans?.filter(p =>
    p.is_active && p.plan_tier === 'multi_branch'
  ) || [];

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
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Billing & Plan</h1>
          <p className="text-muted-foreground mt-1">
            Manage your plan and track usage
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {hasActiveSubscription && (
            <Button
              onClick={handleManageSubscription}
              disabled={isLoadingPortal}
              variant="outline"
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

      {/* Current Plan & Usage Overview */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Current Plan Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
              {isPilot && <Badge variant="secondary">Pilot</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">
              {planSummary?.plan_display_name || 'Free'}
            </div>
            <p className="text-sm text-muted-foreground">
              {effectivePlan === 'free'
                ? 'Upgrade to unlock more listings and features'
                : isPilot
                  ? 'Pilot programme — custom billing arrangement'
                  : `Billed weekly`}
            </p>
            {effectivePlan === 'free' && (
              <Button
                className="w-full mt-4"
                onClick={() => {
                  const plansSection = document.getElementById('plans-section');
                  plansSection?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                View Plans
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Usage Meters Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Usage</CardTitle>
            <CardDescription>Current usage against your plan limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {planLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : planSummary ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <UsageMeter
                  label="Listings"
                  current={planSummary.listing_count}
                  max={planSummary.max_listings}
                  icon={Home}
                />
                <UsageMeter
                  label="Social Hubs"
                  current={planSummary.hub_count}
                  max={planSummary.max_social_hubs}
                  icon={Building2}
                />
                <UsageMeter
                  label="Team Members"
                  current={0}
                  max={planSummary.max_users}
                  icon={Users}
                />
                <UsageMeter
                  label="CRM Contacts"
                  current={0}
                  max={planSummary.max_crm_contacts}
                  icon={Mail}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Unable to load usage data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan Feature Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Posts / Listing / Week</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {planSummary?.max_posts_per_listing_per_week ?? '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              per listing, per week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lead Magnets / Week</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {planSummary?.max_lead_magnets_per_week === null ? '∞' : planSummary?.max_lead_magnets_per_week ?? '0'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              quiz posts per week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Video Styles</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {planSummary?.allowed_video_styles?.length ?? 1}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {planSummary?.has_watermark ? 'With watermark' : 'No watermark'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email Campaigns</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {planSummary?.max_email_campaigns_per_month === null ? '∞' : planSummary?.max_email_campaigns_per_month ?? '0'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              per month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Plan Selection */}
      <div id="plans-section" className="space-y-4 scroll-mt-6">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Available Plans</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {standardPlans.map((plan) => (
            <PlanCard
              key={plan.name}
              plan={plan}
              isCurrentPlan={effectivePlan === plan.name}
              onSubscribe={handleSubscribe}
              isLoading={isLoadingCheckout === plan.name}
            />
          ))}
        </div>

        {multiBranchPlans.length > 0 && (
          <>
            <h3 className="text-lg font-semibold mt-6 flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Multi-Branch Plans
            </h3>
            <p className="text-sm text-muted-foreground">
              For agencies with multiple offices — each branch gets its own social accounts and posting schedules.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              {multiBranchPlans.map((plan) => (
                <PlanCard
                  key={plan.name}
                  plan={plan}
                  isCurrentPlan={effectivePlan === plan.name}
                  onSubscribe={handleSubscribe}
                  isLoading={isLoadingCheckout === plan.name}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* History & Analytics */}
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
