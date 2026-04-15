import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getPlanDefinitions } from '@/lib/billing/billingClient';
import { usePlanInfo } from '@/hooks/usePlanInfo';
import { useLocale } from '@/hooks/useLocale';
import type { PlanDefinition } from '@/lib/billing/types';
import {
  Check,
  ArrowRight,
  Loader2,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';

export default function UpgradeToPro() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization: currentOrganization } = useOrganization();
  const { t, formatCurrency } = useLocale();
  const { planName: currentPlanName } = usePlanInfo();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const { data: plans, isLoading: isLoadingPlans } = useQuery({
    queryKey: ['plan-definitions-upgrade'],
    queryFn: getPlanDefinitions,
    staleTime: 5 * 60 * 1000,
  });

  // Show plans above the user's current plan tier
  const PLAN_ORDER = ['free', 'essentials', 'growth', 'professional', 'multi_branch_s', 'multi_branch_m', 'multi_branch_l'];
  const currentIndex = PLAN_ORDER.indexOf(currentPlanName || 'free');

  const upgradePlans = (plans || []).filter((p: PlanDefinition) => {
    if (!p.is_active || p.name === 'free') return false;
    const planIndex = PLAN_ORDER.indexOf(p.name);
    return planIndex > currentIndex;
  });

  const handleUpgrade = async (planName: string) => {
    if (!currentOrganization?.id) {
      toast.error(t('billing.upgrade.unableToProcess'));
      return;
    }

    setIsLoading(planName);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(t('billing.upgrade.pleaseLogIn'));
        navigate('/admin/login');
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
            planName,
            mode: 'subscription',
            organizationId: currentOrganization.id,
            successUrl: `${window.location.origin}/admin/billing/manage?success=true&plan=${planName}`,
            cancelUrl: `${window.location.origin}/admin/billing/upgrade?canceled=true`,
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
      console.error('Upgrade error:', error);
      toast.error(error.message || t('billing.errors.upgradeFailed'));
    } finally {
      setIsLoading(null);
    }
  };

  if (isLoadingPlans) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate('/admin/billing')}
        className="gap-2"
        data-testid="button-back"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('billing.upgrade.backToBilling')}
      </Button>

      <div className="text-center space-y-2">
        <Badge className="gap-1">
          <Sparkles className="w-3 h-3" />
          {t('billing.upgrade.badge')}
        </Badge>
        <h1 className="text-3xl font-bold">{t('billing.upgrade.title')}</h1>
        <p className="text-muted-foreground">
          {t('billing.upgrade.description')}
        </p>
      </div>

      {upgradePlans.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            You&apos;re on the highest available plan.
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {upgradePlans.map((plan: PlanDefinition) => {
            const isRecommended = plan.name === 'growth' || (upgradePlans.length === 1);

            return (
              <Card key={plan.name} className={isRecommended ? 'border-primary' : ''}>
                {isRecommended && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    Recommended
                  </Badge>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl">{plan.display_name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="pt-4">
                    <span className="text-4xl font-bold">{formatCurrency(plan.monthly_price_cents / 100)}</span>
                    <span className="text-muted-foreground">/{plan.billing_interval}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {(plan.features as string[]).map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    size="lg"
                    className="w-full gap-2"
                    variant={isRecommended ? 'default' : 'outline'}
                    onClick={() => handleUpgrade(plan.name)}
                    disabled={isLoading !== null}
                    data-testid={`button-upgrade-${plan.name}`}
                  >
                    {isLoading === plan.name ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('billing.upgrade.processing')}
                      </>
                    ) : (
                      <>
                        Upgrade to {plan.display_name}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-center text-muted-foreground">
        {t('billing.upgrade.securePayment')}
      </p>
    </div>
  );
}
