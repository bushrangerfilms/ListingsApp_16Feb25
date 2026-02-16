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
import { getPlanByName } from '@/lib/billing/billingClient';
import { useLocale } from '@/hooks/useLocale';
import {
  Check,
  Zap,
  Users,
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
  const [isLoading, setIsLoading] = useState(false);

  const { data: proPlan, isLoading: isLoadingPro } = useQuery({
    queryKey: ['plan-definition', 'pro'],
    queryFn: async () => getPlanByName('pro'),
  });

  const { data: starterPlan, isLoading: isLoadingStarter } = useQuery({
    queryKey: ['plan-definition', 'starter'],
    queryFn: async () => getPlanByName('starter'),
  });

  const handleUpgrade = async () => {
    if (!currentOrganization?.id || !proPlan?.stripe_price_id) {
      toast.error(t('billing.upgrade.unableToProcess'));
      return;
    }

    setIsLoading(true);
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
            priceId: proPlan.stripe_price_id,
            mode: 'subscription',
            organizationId: currentOrganization.id,
            planName: 'pro',
            successUrl: `${window.location.origin}/admin/billing?success=true&plan=pro`,
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
      setIsLoading(false);
    }
  };

  const proFeatures = [
    t('billing.upgrade.allFeatures'),
    t('billing.upgrade.creditsComparison', { pro: proPlan?.monthly_credits || 500, starter: starterPlan?.monthly_credits || 200 }),
    t('billing.upgrade.upToUsers', { count: proPlan?.max_users || 10 }),
    t('billing.upgrade.prioritySupport'),
    t('billing.upgrade.teamTracking'),
    t('billing.upgrade.advancedAnalytics'),
  ];

  const isLoadingPlan = isLoadingPro || isLoadingStarter;

  if (isLoadingPlan) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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

      <Card className="border-primary">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl">{t('billing.upgrade.proPlan')}</CardTitle>
          <CardDescription>{t('billing.upgrade.proPlanDesc')}</CardDescription>
          <div className="pt-4">
            <span className="text-4xl font-bold">{formatCurrency(proPlan?.price_cents ? Math.round(proPlan.price_cents / 100) : 79)}</span>
            <span className="text-muted-foreground">{t('billing.manage.perMonth')}</span>
          </div>
          <div className="flex items-center justify-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {t('billing.manage.users', { count: proPlan?.max_users || 10 })}
            </span>
            <span className="flex items-center gap-1">
              <Zap className="w-4 h-4" />
              {t('billing.manage.creditsPerMonth', { count: proPlan?.monthly_credits || 500 })}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="space-y-3">
            {proFeatures.map((feature, i) => (
              <li key={i} className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">{t('billing.upgrade.whatHappens')}</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>{t('billing.upgrade.upgradeImmediately')}</li>
              <li>{t('billing.upgrade.chargedDifference')}</li>
              <li>{t('billing.upgrade.newCreditsStart')}</li>
              <li>{t('billing.upgrade.inviteTeam')}</li>
            </ul>
          </div>

          <Button
            size="lg"
            className="w-full gap-2"
            onClick={handleUpgrade}
            disabled={isLoading}
            data-testid="button-confirm-upgrade"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('billing.upgrade.processing')}
              </>
            ) : (
              <>
                {t('billing.upgrade.confirmUpgrade')}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            {t('billing.upgrade.securePayment')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
