import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { SEO } from '@/components/SEO';
import { Check, ArrowRight } from 'lucide-react';
import { getSignupUrl } from '@/lib/appUrls';
import { useQuery } from '@tanstack/react-query';
import { getPlanDefinitions } from '@/lib/billing/billingClient';
import { formatPrice, estimatePrice, type SupportedCurrency } from '@/lib/billing/pricing';
import { useLocale } from '@/hooks/useLocale';

export default function PricingPage() {
  const { currency: detectedCurrency } = useLocale();
  const currency = detectedCurrency as SupportedCurrency;

  // Per-currency price resolution.  If the plan has price_cents_<currency>
  // populated (seeded via scripts/seed-stripe-prices.ts), show that real
  // amount.  Otherwise FX-estimate from EUR canonical (legacy fallback).
  // The estimated path also returns `estimated: true` so the UI can label.
  const resolvePriceForPlan = (plan: { monthly_price_cents: number } & Partial<Record<`price_cents_${'gbp' | 'usd' | 'cad' | 'aud' | 'nzd'}`, number | null>>): { cents: number; estimated: boolean } => {
    if (currency === 'EUR') return { cents: plan.monthly_price_cents, estimated: false };
    const realCents = plan[`price_cents_${currency.toLowerCase()}` as keyof typeof plan] as number | null | undefined;
    if (typeof realCents === 'number' && realCents > 0) {
      return { cents: realCents, estimated: false };
    }
    return { cents: estimatePrice(plan.monthly_price_cents, currency), estimated: true };
  };
  const formatLocalPrice = (cents: number) => formatPrice(cents, currency);

  const { data: plans } = useQuery({
    queryKey: ['plan-definitions-pricing'],
    queryFn: getPlanDefinitions,
    staleTime: 5 * 60 * 1000,
  });

  const allPlans = plans?.filter(p => p.is_active && ['free', 'standard', 'professional', 'multi_branch'].includes(p.plan_tier)) || [];

  return (
    <MarketingLayout>
      <SEO
        title="Pricing — AutoListing.io"
        description="Simple weekly pricing for estate agents. Start free with 3 listings. Upgrade as you grow. No credit card required."
      />

      {/* Header */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl font-bold">Simple, Weekly Pricing</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start free with 3 listings. Upgrade as your portfolio grows. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Standard Plans */}
      <section className="pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {allPlans.map((plan) => {
              const isFree = plan.plan_tier === 'free';
              const isPopular = plan.name === 'professional';

              return (
                <Card key={plan.name} className={`relative flex flex-col ${isPopular ? 'border-primary shadow-lg scale-[1.02]' : ''}`}>
                  {isPopular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">Most Popular</Badge>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-lg">{plan.display_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                    <div className="mt-4">
                      {isFree ? (
                        <span className="text-4xl font-bold">Free</span>
                      ) : (() => {
                        const { cents, estimated } = resolvePriceForPlan(plan);
                        return (
                          <>
                            <span className="text-4xl font-bold">{formatLocalPrice(cents)}</span>
                            <span className="text-muted-foreground">/{plan.billing_interval}</span>
                            {estimated && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Approximate — billed in EUR until local pricing is activated
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <ul className="space-y-2 flex-1">
                      {(plan.features as string[]).map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <a href={getSignupUrl()} className="mt-6 block">
                      <Button className="w-full" variant={isPopular || isFree ? 'default' : 'outline'}>
                        {isFree ? 'Start Free' : `Get ${plan.display_name}`}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </a>
                    {isFree && (
                      <p className="text-xs text-center text-muted-foreground mt-2">No credit card required</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Billing FAQ</h2>
            <div className="space-y-6">
              {[
                { q: 'How does weekly billing work?', a: 'You are charged once per week. Upgrade or downgrade at any time — changes take effect at the start of your next billing week.' },
                { q: 'Is the free plan really free?', a: 'Yes. No credit card required. You get 3 listings with automated posting and a property website. Use it as long as you like.' },
                { q: 'What happens if I exceed my listing limit?', a: 'You won\'t be able to add new listings until you upgrade or remove existing ones. Your current listings continue to post normally.' },
                { q: 'Can I switch plans?', a: 'Yes. Upgrade instantly to a higher plan. Downgrade takes effect at the end of your current billing period.' },
                { q: 'Can I use my own domain for my listings website?', a: 'Yes — on any paid plan you can connect your own domain (like youragency.com). We guide you through the DNS setup step by step with instructions for Cloudflare, GoDaddy, Namecheap and more. Free plans use an AutoListing subdomain.' },
                { q: 'What is a Social Hub?', a: 'Multi-Branch plans let agencies run separate social media operations per branch. Each hub has its own social accounts, posting schedules, and up to 40 listings.' },
              ].map((faq) => (
                <div key={faq.q} className="space-y-2">
                  <h3 className="font-semibold text-lg">{faq.q}</h3>
                  <p className="text-muted-foreground">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-3xl font-bold">Ready to automate your social media?</h2>
          <p className="text-lg text-muted-foreground">Start free today. No credit card required.</p>
          <a href={getSignupUrl()}>
            <Button size="lg" className="gap-2 text-base px-8">
              Start Free Now
              <ArrowRight className="h-4 w-4" />
            </Button>
          </a>
        </div>
      </section>
    </MarketingLayout>
  );
}
