import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { SEO } from '@/components/SEO';
import { getSignupUrl } from '@/lib/appUrls';
import { useLocale } from '@/hooks/useLocale';
import { usePublicSignupFlag } from '@/hooks/useFeatureFlag';
import { WaitlistDialog } from '@/components/marketing/WaitlistDialog';
import { 
  Building2, 
  Users, 
  Mail, 
  Bot, 
  BarChart3, 
  Globe,
  Zap,
  Shield,
  ArrowRight,
  Check,
  Share2
} from 'lucide-react';

export default function MarketingHome() {
  const { t } = useLocale();
  const { isEnabled: isPublicSignupEnabled, isLoading: signupFlagLoading } = usePublicSignupFlag();
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  const features = [
    {
      icon: Share2,
      title: t('home.features.socialMedia.title'),
      description: t('home.features.socialMedia.description'),
      comingSoon: true,
    },
    {
      icon: Building2,
      title: t('home.features.listings.title'),
      description: t('home.features.listings.description'),
    },
    {
      icon: Users,
      title: t('home.features.crm.title'),
      description: t('home.features.crm.description'),
    },
    {
      icon: Mail,
      title: t('home.features.email.title'),
      description: t('home.features.email.description'),
    },
    {
      icon: Bot,
      title: t('home.features.ai.title'),
      description: t('home.features.ai.description'),
    },
    {
      icon: BarChart3,
      title: t('home.features.analytics.title'),
      description: t('home.features.analytics.description'),
    },
  ];

  const benefits = [
    t('home.benefits.socialMedia'),
    t('home.benefits.listings'),
    t('home.benefits.domains'),
    t('home.benefits.chatbot'),
    t('home.benefits.email'),
    t('home.benefits.multiTenant'),
  ];

  return (
    <MarketingLayout>
      <SEO 
        title={t('home.seo.title')}
        description={t('home.seo.description')}
      />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32 relative">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Zap className="h-4 w-4" />
              <span>{t('home.hero.badge')}</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
              {t('home.hero.title')}{' '}
              <span className="text-primary">{t('home.hero.titleHighlight')}</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('home.hero.subtitle')}
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {isPublicSignupEnabled ? (
                <a href={getSignupUrl()}>
                  <Button size="lg" className="gap-2" data-testid="button-hero-signup">
                    {t('home.hero.cta')}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </a>
              ) : (
                <Button 
                  size="lg" 
                  className="gap-2" 
                  onClick={() => setWaitlistOpen(true)}
                  data-testid="button-hero-waitlist"
                >
                  Join the Waitlist
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              <Link to="/features">
                <Button size="lg" variant="outline" data-testid="button-hero-features">
                  {t('home.hero.ctaSecondary')}
                </Button>
              </Link>
            </div>
            
            <p className="text-sm text-muted-foreground">
              {isPublicSignupEnabled ? t('home.hero.trialNote') : 'We are currently in private beta. Join the waitlist to get early access.'}
            </p>
            
            <WaitlistDialog open={waitlistOpen} onOpenChange={setWaitlistOpen} />
          </div>
        </div>
      </section>

      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">{t('home.features.title')}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('home.features.subtitle')}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="border-0 shadow-none bg-background">
                <CardContent className="p-6 space-y-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold">{feature.title}</h3>
                    {'comingSoon' in feature && feature.comingSoon && (
                      <Badge variant="secondary" className="text-xs">{t('common.comingSoon')}</Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <Link to="/features">
              <Button variant="outline" className="gap-2" data-testid="button-view-all-features">
                {t('home.features.viewAll')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold">{t('home.pricing.title')}</h2>
              <p className="text-lg text-muted-foreground">
                {t('home.pricing.subtitle')}
              </p>
              
              <ul className="space-y-3">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-3">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
              
              <Link to="/pricing" className="mt-4 inline-block">
                <Button className="gap-2" data-testid="button-view-pricing">
                  {t('home.pricing.viewPricing')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-6 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">{t('home.pricing.starter.name')}</p>
                <p className="text-3xl font-bold">${t('home.pricing.starter.price')}<span className="text-lg font-normal text-muted-foreground">/{t('home.pricing.starter.period')}</span></p>
                <p className="text-sm text-muted-foreground">{t('home.pricing.starter.description')}</p>
              </Card>
              <Card className="p-6 space-y-2 border-primary">
                <p className="text-sm font-medium text-primary">{t('home.pricing.pro.name')}</p>
                <p className="text-3xl font-bold">${t('home.pricing.pro.price')}<span className="text-lg font-normal text-muted-foreground">/{t('home.pricing.pro.period')}</span></p>
                <p className="text-sm text-muted-foreground">{t('home.pricing.pro.description')}</p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-2">
              <Globe className="h-8 w-8 text-primary mx-auto" />
              <h3 className="text-lg font-semibold">{t('home.trust.multiTenant.title')}</h3>
              <p className="text-muted-foreground text-sm">
                {t('home.trust.multiTenant.description')}
              </p>
            </div>
            <div className="text-center space-y-2">
              <Shield className="h-8 w-8 text-primary mx-auto" />
              <h3 className="text-lg font-semibold">{t('home.trust.secure.title')}</h3>
              <p className="text-muted-foreground text-sm">
                {t('home.trust.secure.description')}
              </p>
            </div>
            <div className="text-center space-y-2">
              <Zap className="h-8 w-8 text-primary mx-auto" />
              <h3 className="text-lg font-semibold">{t('home.trust.ai.title')}</h3>
              <p className="text-muted-foreground text-sm">
                {t('home.trust.ai.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-3xl font-bold">{t('home.cta.title')}</h2>
            <p className="text-lg text-muted-foreground">
              {t('home.cta.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href={getSignupUrl()}>
                <Button size="lg" className="gap-2" data-testid="button-cta-signup">
                  {t('home.cta.button')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
              <Link to="/pricing">
                <Button size="lg" variant="outline" data-testid="button-cta-pricing">
                  {t('home.cta.viewPricing')}
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('home.cta.trialNote')}
            </p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
