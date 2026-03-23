import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getPlanDefinitions, getOrgPlanSummary } from '@/lib/billing/billingClient';
import { useLocale } from '@/hooks/useLocale';
import type { PlanDefinition } from '@/lib/billing/types';
import {
  Check,
  ArrowRight,
  Loader2,
  ArrowLeft,
  Sparkles,
  Home,
  Building2,
} from 'lucide-react';

export default function UpgradeToPro() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { organization } = useOrganization();
  const { formatCurrency } = useLocale();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const targetPlan = searchParams.get('plan') || 'professional';

  const { data: allPlans, isLoading: plansLoading } = useQuery({
    queryKey: ['plan-definitions'],
    queryFn: getPlanDefinitions,
  });

  const { data: planSummary } = useQuery({
    queryKey: ['plan-summary', organization?.id],
    queryFn: () => getOrgPlanSummary(organization!.id),
    enabled: !!organization?.id,
  });

  const currentPlan = planSummary?.effective_plan_name || 'free';

  // Filter to plans higher than current
  const upgradePlans = allPlans?.filter(p => {
    if (!p.is_active) return false;
    if (p.name === 'free') return false;
    if (p.name === currentPlan) return false;
    // Show plans with higher display_order than current
    const currentOrder = allPlans?.find(cp => cp.name === currentPlan)?.display_order ?? 0;
    return p.display_order > currentOrder;
  }) || [];

  const handleUpgrade = async (plan: PlanDefinition) => {
    if (!organization?.id) {
      toast.error('Organisation not found');
      return;
    }

    setIsLoading(plan.name);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in to upgrade');
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
            organizationId: organization.id,
            planName: plan.name,
            successUrl: `${window.location.origin}/admin/billing?success=true&plan=${plan.name}`,
            cancelUrl: `${window.location.origin}/admin/billing/upgrade?canceled=true`,
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
      console.error('Upgrade error:', error);
      toast.error(error.message || 'Failed to start upgrade');
    } finally {
      setIsLoading(null);
    }
  };

  if (plansLoading) {
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
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Billing
      </Button>

      <div className="text-center space-y-2">
        <Badge className="gap-1">
          <Sparkles className="w-3 h-3" />
          Upgrade
        </Badge>
        <h1 className="text-3xl font-bold">Upgrade Your Plan</h1>
        <p className="text-muted-foreground">
          Get more listings, posts, and features for your agency
        </p>
        {planSummary && (
          <p className="text-sm text-muted-foreground">
            Currently on <strong>{planSummary.plan_display_name}</strong> — {planSummary.listing_count} listings, {planSummary.hub_count} hub(s)
          </p>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {upgradePlans.map((plan) => {
          const isTarget = plan.name === targetPlan;
          const isMultiBranch = plan.plan_tier === 'multi_branch';

          return (
            <Card
              key={plan.name}
              className={`relative ${isTarget ? 'border-primary shadow-md' : ''}`}
            >
              {isTarget && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Recommended</Badge>
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
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Home className="w-4 h-4 text-muted-foreground" />
                    <span>{plan.max_listings ?? '∞'} listings</span>
                  </div>
                  {isMultiBranch && (
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span>{plan.max_social_hubs} social hubs</span>
                    </div>
                  )}
                </div>

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
                  variant={isTarget ? 'default' : 'outline'}
                  onClick={() => handleUpgrade(plan)}
                  disabled={isLoading !== null}
                >
                  {isLoading === plan.name ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Upgrade to {plan.display_name}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {upgradePlans.length === 0 && (
        <Card className="text-center p-8">
          <CardContent>
            <p className="text-muted-foreground">You're already on the highest available plan.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/billing')}>
              Back to Billing
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
