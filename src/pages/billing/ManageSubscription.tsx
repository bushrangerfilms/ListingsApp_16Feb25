import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCreditBalance, getBillingProfile, CREDIT_COSTS } from '@/lib/billing/billingClient';
import { AccountStatusBanner } from '@/components/billing/AccountStatusBanner';
import { TrialCountdown } from '@/components/billing/TrialCountdown';
import { useLocale } from '@/hooks/useLocale';
import { 
  getTrialDaysRemaining,
  type AccountStatus 
} from '@/lib/billing/types';
import {
  CreditCard,
  Zap,
  Users,
  ArrowUpRight,
  Calendar,
  Loader2,
  ExternalLink,
  AlertCircle,
  Check,
  Sparkles,
} from 'lucide-react';

interface PlanConfig {
  name: string;
  priceEur: number;
  monthlyCredits: number;
  maxUsers: number;
  featureKeys: string[];
  popular?: boolean;
}

const PLAN_CONFIGS: PlanConfig[] = [
  {
    name: 'starter',
    priceEur: 29,
    monthlyCredits: 200,
    maxUsers: 1,
    featureKeys: ['allPlatform', 'credits', 'users'],
  },
  {
    name: 'pro',
    priceEur: 79,
    monthlyCredits: 500,
    maxUsers: 10,
    featureKeys: ['allPlatform', 'credits', 'users', 'priority'],
    popular: true,
  },
];

function getAccountStatusLabelTranslated(status: AccountStatus, t: (key: string) => string): string {
  const labels: Record<AccountStatus, string> = {
    active: t('billing.accountStatus.active'),
    trial: t('billing.accountStatus.trial'),
    trial_expired: t('billing.accountStatus.trialExpired'),
    payment_failed: t('billing.accountStatus.paymentFailed'),
    unsubscribed: t('billing.accountStatus.unsubscribed'),
    archived: t('billing.accountStatus.archived'),
  };
  return labels[status] || status;
}

export default function ManageSubscription() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization: currentOrganization } = useOrganization();
  const { t, formatCurrency, formatDate: formatLocaleDate } = useLocale();
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [isLoadingCheckout, setIsLoadingCheckout] = useState<string | null>(null);

  const { data: billingProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['billing-profile', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return null;
      return getBillingProfile(currentOrganization.id);
    },
    enabled: !!currentOrganization?.id,
  });

  const { data: creditBalance, isLoading: isLoadingCredits } = useQuery({
    queryKey: ['credit-balance', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return 0;
      return getCreditBalance(currentOrganization.id);
    },
    enabled: !!currentOrganization?.id,
  });

  const handleSubscribe = async (planName: string) => {
    if (!currentOrganization?.id) {
      toast.error(t('billing.manage.organizationNotFound'));
      return;
    }

    setIsLoadingCheckout(planName);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(t('billing.manage.pleaseLogIn'));
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
            organizationId: currentOrganization.id,
            planName: planName,
            successUrl: `${window.location.origin}/admin/billing/manage?success=true`,
            cancelUrl: `${window.location.origin}/admin/billing/manage?canceled=true`,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('billing.errors.checkoutFailed'));
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || t('billing.errors.checkoutFailed'));
    } finally {
      setIsLoadingCheckout(null);
    }
  };

  const handleManageBilling = async () => {
    if (!currentOrganization?.id || !billingProfile?.stripe_customer_id) {
      toast.error(t('billing.manage.noBillingAccount'));
      return;
    }

    setIsLoadingPortal(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(t('billing.manage.pleaseLogInManage'));
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
            organizationId: currentOrganization.id,
            returnUrl: window.location.href,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('billing.errors.portalFailed'));
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error: any) {
      console.error('Portal error:', error);
      toast.error(error.message || t('billing.errors.portalFailed'));
    } finally {
      setIsLoadingPortal(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getPlanDetails = (planName: string | null | undefined) => {
    if (planName === 'pro') {
      return { name: 'Pro', price: 79, credits: 500, users: 10 };
    }
    return { name: 'Starter', price: 29, credits: 200, users: 1 };
  };

  const isLoading = isLoadingProfile || isLoadingCredits;
  const plan = getPlanDetails(billingProfile?.subscription_plan);
  const balance = creditBalance || 0;

  const accountStatus = (currentOrganization?.account_status || 'trial') as AccountStatus;
  const isOnTrial = accountStatus === 'trial';
  const isTrialExpired = accountStatus === 'trial_expired';
  const hasActiveSubscription = billingProfile?.subscription_status === 'active';
  const needsPlanSelection = isOnTrial || isTrialExpired || !hasActiveSubscription;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('billing.manage.title')}</h1>
        <p className="text-muted-foreground">
          {t('billing.manage.description')}
        </p>
      </div>

      <AccountStatusBanner
        accountStatus={accountStatus}
        trialEndsAt={currentOrganization?.trial_ends_at || null}
        gracePeriodEndsAt={currentOrganization?.grace_period_ends_at || null}
        readOnlyReason={currentOrganization?.read_only_reason || null}
      />

      {needsPlanSelection && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{t('billing.manage.choosePlan')}</h2>
            {isOnTrial && currentOrganization?.trial_ends_at && (
              <Badge variant="secondary">
                {t('billing.manage.daysLeftInTrial', { days: getTrialDaysRemaining(currentOrganization.trial_ends_at) })}
              </Badge>
            )}
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            {PLAN_CONFIGS.map((planConfig) => {
              const planName = t(`billing.plans.${planConfig.name}.name`);
              const planDescription = t(`billing.plans.${planConfig.name}.description`);
              return (
                <Card 
                  key={planConfig.name}
                  className={`relative ${planConfig.popular ? 'border-primary' : ''}`}
                  data-testid={`card-plan-${planConfig.name}`}
                >
                  {planConfig.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                      {t('billing.manage.mostPopular')}
                    </Badge>
                  )}
                  <CardHeader>
                    <CardTitle>{planName}</CardTitle>
                    <CardDescription>{planDescription}</CardDescription>
                    <div className="mt-2">
                      <span className="text-3xl font-bold">{formatCurrency(planConfig.priceEur)}</span>
                      <span className="text-muted-foreground">{t('billing.manage.perMonth')}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {planConfig.featureKeys.map((featureKey, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-500 shrink-0" />
                          <span>{t(`billing.plans.${planConfig.name}.features.${featureKey}`)}</span>
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
                          {t('billing.manage.subscribeTo', { plan: planName })}
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-lg">{t('billing.manage.currentPlan')}</CardTitle>
              <CardDescription>
                {hasActiveSubscription 
                  ? t('billing.manage.planDetails', { plan: plan.name, price: formatCurrency(plan.price) })
                  : isOnTrial 
                    ? t('billing.manage.freeTrial')
                    : t('billing.manage.noActiveSubscription')}
              </CardDescription>
            </div>
            <Badge variant={hasActiveSubscription ? 'default' : 'secondary'}>
              {getAccountStatusLabelTranslated(accountStatus, t)}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasActiveSubscription && (
              <>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{plan.users > 1 ? t('billing.manage.users', { count: plan.users }) : t('billing.manage.user', { count: plan.users })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="w-4 h-4" />
                    <span>{t('billing.manage.creditsPerMonth', { count: plan.credits })}</span>
                  </div>
                </div>

                {billingProfile?.subscription_ends_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>{t('billing.manage.nextBilling', { date: formatDate(billingProfile.subscription_ends_at) })}</span>
                  </div>
                )}

                <Separator />

                <div className="flex flex-col gap-2">
                  {billingProfile?.subscription_plan === 'starter' && (
                    <Button
                      onClick={() => navigate('/admin/billing/upgrade')}
                      className="gap-2"
                      data-testid="button-upgrade-plan"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      {t('billing.team.upgradeToPro')}
                    </Button>
                  )}
                  
                  {billingProfile?.stripe_customer_id && (
                    <Button
                      variant="outline"
                      onClick={handleManageBilling}
                      disabled={isLoadingPortal}
                      className="gap-2"
                      data-testid="button-manage-billing"
                    >
                      {isLoadingPortal ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ExternalLink className="w-4 h-4" />
                      )}
                      {t('billing.manage.manageBilling')}
                    </Button>
                  )}
                </div>
              </>
            )}

            {isOnTrial && (
              <TrialCountdown
                accountStatus={accountStatus}
                trialEndsAt={currentOrganization?.trial_ends_at || null}
                trialStartedAt={currentOrganization?.trial_started_at || null}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-lg">{t('billing.manage.creditBalance')}</CardTitle>
              <CardDescription>
                {t('billing.manage.creditsForAI')}
              </CardDescription>
            </div>
            <Zap className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-4xl font-bold">
              {balance.toLocaleString()}
              <span className="text-lg font-normal text-muted-foreground ml-2">{t('billing.manage.credits')}</span>
            </div>

            {balance < 50 && (
              <div className="flex items-start gap-2 p-3 text-sm bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-lg">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{t('billing.manage.lowBalanceWarning')}</span>
              </div>
            )}

            <Separator />

            <Button
              variant="outline"
              onClick={() => navigate('/admin/billing/credits')}
              className="w-full gap-2"
              data-testid="button-buy-credits"
            >
              <CreditCard className="w-4 h-4" />
              {t('billing.manage.buyMoreCredits')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('billing.manage.creditUsage')}</CardTitle>
          <CardDescription>
            {t('billing.manage.creditUsageDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm">{t('billing.manage.videoGeneration')}</span>
              <Badge variant="secondary">{CREDIT_COSTS.video_generation} {t('billing.manage.credits')}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm">{t('billing.manage.socialPost')}</span>
              <Badge variant="secondary">{CREDIT_COSTS.post_generation} {t('billing.manage.credits')}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm">{t('billing.manage.aiChat')}</span>
              <Badge variant="secondary">{CREDIT_COSTS.ai_assistant} {t('billing.manage.credits')}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm">{t('billing.manage.propertyExtraction')}</span>
              <Badge variant="secondary">{CREDIT_COSTS.property_extraction} {t('billing.manage.credits')}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm">{t('billing.manage.emailSend')}</span>
              <Badge variant="secondary">{CREDIT_COSTS.email_send} {t('billing.manage.credits')}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
