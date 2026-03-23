import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getOrgPlanSummary, getPlanDefinitions, getBillingProfile } from '@/lib/billing/billingClient';
import { AccountStatusBanner } from '@/components/billing/AccountStatusBanner';
import { useLocale } from '@/hooks/useLocale';
import type { AccountStatus, PlanDefinition } from '@/lib/billing/types';
import {
  Loader2,
  ExternalLink,
  Check,
  Sparkles,
  Home,
  Building2,
  Users,
  ArrowRight,
} from 'lucide-react';

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

export default function ManageSubscription() {
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const { t, formatCurrency } = useLocale();
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [isLoadingCheckout, setIsLoadingCheckout] = useState<string | null>(null);

  const { data: planSummary, isLoading: planLoading } = useQuery({
    queryKey: ['plan-summary', organization?.id],
    queryFn: () => getOrgPlanSummary(organization!.id),
    enabled: !!organization?.id,
  });

  const { data: allPlans } = useQuery({
    queryKey: ['plan-definitions'],
    queryFn: getPlanDefinitions,
  });

  const { data: billingProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['billing-profile', organization?.id],
    queryFn: () => getBillingProfile(organization!.id),
    enabled: !!organization?.id,
  });

  const accountStatus = (organization?.account_status || 'free') as AccountStatus;
  const hasActiveSubscription = billingProfile?.subscription_status === 'active';
  const effectivePlan = planSummary?.effective_plan_name || 'free';
  const isPilot = planSummary?.has_billing_override || false;

  const standardPlans = allPlans?.filter(p =>
    p.is_active && ['free', 'standard', 'professional'].includes(p.plan_tier)
  ) || [];

  const handleSubscribe = async (planName: string) => {
    if (!organization?.id) {
      toast.error('Organisation not found');
      return;
    }

    setIsLoadingCheckout(planName);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in to subscribe');
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
            successUrl: `${window.location.origin}/admin/billing/manage?success=true`,
            cancelUrl: `${window.location.origin}/admin/billing/manage?canceled=true`,
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

  const handleManageBilling = async () => {
    if (!organization?.id || !billingProfile?.stripe_customer_id) {
      toast.error('No billing account found');
      return;
    }

    setIsLoadingPortal(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in to manage billing');
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

  if (planLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Manage Subscription</h1>
          <p className="text-muted-foreground">
            View your plan, usage, and manage billing
          </p>
        </div>
        {billingProfile?.stripe_customer_id && (
          <Button
            variant="outline"
            onClick={handleManageBilling}
            disabled={isLoadingPortal}
          >
            {isLoadingPortal ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ExternalLink className="w-4 h-4 mr-2" />
            )}
            Manage Billing
          </Button>
        )}
      </div>

      <AccountStatusBanner
        accountStatus={accountStatus}
        trialEndsAt={organization?.trial_ends_at || null}
        gracePeriodEndsAt={organization?.grace_period_ends_at || null}
        readOnlyReason={organization?.read_only_reason || null}
      />

      {/* Current Plan + Usage */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Current Plan</CardTitle>
              {isPilot && <Badge variant="secondary">Pilot</Badge>}
            </div>
            <CardDescription>
              {planSummary?.plan_display_name || 'Free'}
              {effectivePlan !== 'free' && !isPilot && ' — billed weekly'}
              {isPilot && ' — pilot programme'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {planSummary && (
              <div className="space-y-3">
                <UsageMeter label="Listings" current={planSummary.listing_count} max={planSummary.max_listings} icon={Home} />
                <UsageMeter label="Social Hubs" current={planSummary.hub_count} max={planSummary.max_social_hubs} icon={Building2} />
                <UsageMeter label="Team Members" current={0} max={planSummary.max_users} icon={Users} />
              </div>
            )}
            {effectivePlan === 'free' && (
              <>
                <Separator />
                <Button className="w-full" onClick={() => navigate('/admin/billing')}>
                  View Plans & Upgrade
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan Includes</CardTitle>
            <CardDescription>Features on your {planSummary?.plan_display_name || 'Free'} plan</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {planSummary && (
                <>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 shrink-0" />
                    {planSummary.max_posts_per_listing_per_week} posts per listing per week
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 shrink-0" />
                    {planSummary.max_lead_magnets_per_week === null ? 'Unlimited' : planSummary.max_lead_magnets_per_week} lead magnets per week
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 shrink-0" />
                    {planSummary.allowed_video_styles?.length === 1 ? 'Basic video style' : 'All video styles'}
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 shrink-0" />
                    {planSummary.max_email_campaigns_per_month === null ? 'Unlimited' : planSummary.max_email_campaigns_per_month} email campaigns/month
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 shrink-0" />
                    {planSummary.has_watermark ? 'Videos with watermark' : 'No watermark on videos'}
                  </li>
                </>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade options for non-top-tier users */}
      {effectivePlan === 'free' && standardPlans.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Upgrade Your Plan</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {standardPlans.filter(p => p.name !== 'free').map((plan) => (
              <Card
                key={plan.name}
                className={`relative ${plan.name === 'professional' ? 'border-primary shadow-md' : ''}`}
              >
                {plan.name === 'professional' && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</Badge>
                )}
                <CardHeader className="pb-3">
                  <CardTitle>{plan.display_name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">TBD</span>
                    <span className="text-muted-foreground">/week</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {(plan.features as string[]).map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.name === 'professional' ? 'default' : 'outline'}
                    onClick={() => handleSubscribe(plan.name)}
                    disabled={isLoadingCheckout !== null}
                  >
                    {isLoadingCheckout === plan.name ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Upgrade to {plan.display_name}
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
    </div>
  );
}
