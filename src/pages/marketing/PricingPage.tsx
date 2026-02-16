import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { SEO } from '@/components/SEO';
import { Check, Zap, Users, Building2, ArrowRight, HelpCircle } from 'lucide-react';
import { getSignupUrl } from '@/lib/appUrls';
import { useLocale } from '@/hooks/useLocale';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function PricingPage() {
  const { t, formatCurrency } = useLocale();

  const plans = [
    {
      name: t('pricing.plans.starter.name'),
      price: 29,
      currency: '\u20AC',
      period: 'month',
      description: t('pricing.plans.starter.description'),
      users: 1,
      credits: 200,
      features: [
        t('pricing.plans.starter.features.listings'),
        t('pricing.plans.starter.features.crm'),
        t('pricing.plans.starter.features.email'),
        t('pricing.plans.starter.features.chatbot'),
        t('pricing.plans.starter.features.domains'),
        t('pricing.plans.starter.features.webhooks'),
        t('pricing.plans.starter.features.credits'),
      ],
      cta: t('pricing.plans.starter.cta'),
      popular: false,
    },
    {
      name: t('pricing.plans.pro.name'),
      price: 79,
      currency: '\u20AC',
      period: 'month',
      description: t('pricing.plans.pro.description'),
      users: 10,
      credits: 500,
      features: [
        t('pricing.plans.pro.features.everything'),
        t('pricing.plans.pro.features.team'),
        t('pricing.plans.pro.features.support'),
        t('pricing.plans.pro.features.credits'),
        t('pricing.plans.pro.features.activity'),
        t('pricing.plans.pro.features.analytics'),
      ],
      cta: t('pricing.plans.pro.cta'),
      popular: true,
    },
  ];

  const creditPacks = [
    { credits: 100, price: 25, perCredit: 0.25 },
    { credits: 500, price: 110, perCredit: 0.22, popular: true },
    { credits: 2000, price: 400, perCredit: 0.20 },
    { credits: 5000, price: 900, perCredit: 0.18 },
  ];

  const creditCosts = [
    { feature: t('pricing.credits.costs.videoGeneration.name'), credits: 25, description: t('pricing.credits.costs.videoGeneration.description') },
    { feature: t('pricing.credits.costs.socialPost.name'), credits: 2, description: t('pricing.credits.costs.socialPost.description') },
    { feature: t('pricing.credits.costs.aiChat.name'), credits: 0.5, description: t('pricing.credits.costs.aiChat.description') },
    { feature: t('pricing.credits.costs.extraction.name'), credits: 10, description: t('pricing.credits.costs.extraction.description') },
    { feature: t('pricing.credits.costs.email.name'), credits: 0.2, description: t('pricing.credits.costs.email.description') },
  ];

  return (
    <MarketingLayout>
      <SEO 
        title={t('pricing.seo.title')}
        description={t('pricing.seo.description')}
      />

      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-4">
            <h1 className="text-4xl sm:text-5xl font-bold">{t('pricing.hero.title')}</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('pricing.hero.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {plans.map((plan) => (
              <Card 
                key={plan.name} 
                className={`relative ${plan.popular ? 'border-primary shadow-lg' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">{t('pricing.plans.mostPopular')}</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <span className="text-4xl font-bold">{plan.currency}{plan.price}</span>
                    <span className="text-muted-foreground">/{plan.period}</span>
                  </div>
                  
                  <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{plan.users} {plan.users > 1 ? t('pricing.plans.users') : t('pricing.plans.user')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="h-4 w-4" />
                      <span>{plan.credits} {t('pricing.plans.creditsPerMonth')}</span>
                    </div>
                  </div>
                  
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <a href={getSignupUrl(plan.name.toLowerCase())} className="block">
                    <Button 
                      className="w-full gap-2" 
                      variant={plan.popular ? 'default' : 'outline'}
                      data-testid={`button-plan-${plan.name.toLowerCase()}`}
                    >
                      {plan.cta}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-8">
            <p className="text-sm text-muted-foreground">
              {t('pricing.plans.trialNote')}
            </p>
          </div>
        </div>
      </section>

      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 space-y-4">
            <h2 className="text-3xl font-bold">{t('pricing.credits.title')}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('pricing.credits.subtitle')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {creditPacks.map((pack) => (
              <Card 
                key={pack.credits} 
                className={`text-center ${pack.popular ? 'border-primary' : ''}`}
              >
                {pack.popular && (
                  <div className="pt-4">
                    <Badge variant="secondary" className="text-xs">{t('pricing.credits.bestValue')}</Badge>
                  </div>
                )}
                <CardContent className={`space-y-4 ${pack.popular ? 'pt-4' : 'pt-6'}`}>
                  <div>
                    <p className="text-3xl font-bold">{pack.credits.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">{t('pricing.credits.credits')}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{formatCurrency(pack.price)}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(pack.perCredit)} {t('pricing.credits.perCredit')}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12 space-y-4">
              <h2 className="text-3xl font-bold">{t('pricing.credits.howItWorks.title')}</h2>
              <p className="text-lg text-muted-foreground">
                {t('pricing.credits.howItWorks.subtitle')}
              </p>
            </div>

            <Card>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-medium">{t('pricing.credits.howItWorks.feature')}</th>
                      <th className="text-right p-4 font-medium">{t('pricing.credits.howItWorks.creditsColumn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <TooltipProvider>
                      {creditCosts.map((item, index) => (
                        <tr key={item.feature} className={index !== creditCosts.length - 1 ? 'border-b' : ''}>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span>{item.feature}</span>
                              <Tooltip>
                                <TooltipTrigger>
                                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{item.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </td>
                          <td className="p-4 text-right font-medium">{item.credits}</td>
                        </tr>
                      ))}
                    </TooltipProvider>
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <div className="mt-8 p-6 bg-muted rounded-lg">
              <div className="flex items-start gap-4">
                <Building2 className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">{t('pricing.credits.example.title')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('pricing.credits.example.description')}
                    <span className="font-medium text-foreground"> {t('pricing.credits.example.creditsPerWeek')}</span>, 
                    {' '}{t('pricing.credits.example.costPerWeek')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-3xl font-bold">{t('pricing.cta.title')}</h2>
            <p className="text-lg text-muted-foreground">
              {t('pricing.cta.subtitle')}
            </p>
            <a href={getSignupUrl()}>
              <Button size="lg" className="gap-2" data-testid="button-pricing-cta">
                {t('pricing.cta.button')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
