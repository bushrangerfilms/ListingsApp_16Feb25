import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { SEO } from '@/components/SEO';
import { getSignupUrl } from '@/lib/appUrls';
import { useLocale } from '@/hooks/useLocale';
import { 
  Building2, 
  Users, 
  Mail, 
  Bot, 
  Webhook, 
  BarChart3, 
  Globe,
  Camera,
  FileText,
  Bell,
  Search,
  Calendar,
  Palette,
  Lock,
  Zap,
  ArrowRight,
  Share2,
  Target,
  Clock,
  MessageSquare,
  Sparkles,
  Video,
  TrendingUp
} from 'lucide-react';

export default function FeaturesPage() {
  const { t } = useLocale();

  const featureCategories = [
    {
      title: t('features.categories.socialMedia.title'),
      description: t('features.categories.socialMedia.description'),
      icon: Share2,
      comingSoon: true,
      features: [
        {
          title: t('features.categories.socialMedia.features.posting.title'),
          description: t('features.categories.socialMedia.features.posting.description'),
          icon: Share2,
          comingSoon: true,
        },
        {
          title: t('features.categories.socialMedia.features.content.title'),
          description: t('features.categories.socialMedia.features.content.description'),
          icon: Sparkles,
          comingSoon: true,
        },
        {
          title: t('features.categories.socialMedia.features.media.title'),
          description: t('features.categories.socialMedia.features.media.description'),
          icon: Video,
          comingSoon: true,
        },
        {
          title: t('features.categories.socialMedia.features.analytics.title'),
          description: t('features.categories.socialMedia.features.analytics.description'),
          icon: TrendingUp,
          comingSoon: true,
        },
      ],
    },
    {
      title: t('features.categories.property.title'),
      description: t('features.categories.property.description'),
      icon: Building2,
      features: [
        {
          title: t('features.categories.property.features.types.title'),
          description: t('features.categories.property.features.types.description'),
          icon: Building2,
          comingSoon: true,
        },
        {
          title: t('features.categories.property.features.extraction.title'),
          description: t('features.categories.property.features.extraction.description'),
          icon: Zap,
        },
        {
          title: t('features.categories.property.features.photos.title'),
          description: t('features.categories.property.features.photos.description'),
          icon: Camera,
        },
        {
          title: t('features.categories.property.features.workflow.title'),
          description: t('features.categories.property.features.workflow.description'),
          icon: Clock,
        },
      ],
    },
    {
      title: t('features.categories.crm.title'),
      description: t('features.categories.crm.description'),
      icon: Users,
      features: [
        {
          title: t('features.categories.crm.features.profiles.title'),
          description: t('features.categories.crm.features.profiles.description'),
          icon: Users,
        },
        {
          title: t('features.categories.crm.features.matching.title'),
          description: t('features.categories.crm.features.matching.description'),
          icon: Target,
        },
        {
          title: t('features.categories.crm.features.timeline.title'),
          description: t('features.categories.crm.features.timeline.description'),
          icon: Calendar,
        },
        {
          title: t('features.categories.crm.features.leads.title'),
          description: t('features.categories.crm.features.leads.description'),
          icon: Search,
        },
      ],
    },
    {
      title: t('features.categories.email.title'),
      description: t('features.categories.email.description'),
      icon: Mail,
      features: [
        {
          title: t('features.categories.email.features.campaigns.title'),
          description: t('features.categories.email.features.campaigns.description'),
          icon: Mail,
        },
        {
          title: t('features.categories.email.features.templates.title'),
          description: t('features.categories.email.features.templates.description'),
          icon: FileText,
        },
        {
          title: t('features.categories.email.features.tracking.title'),
          description: t('features.categories.email.features.tracking.description'),
          icon: BarChart3,
        },
        {
          title: t('features.categories.email.features.cancellation.title'),
          description: t('features.categories.email.features.cancellation.description'),
          icon: Bell,
        },
      ],
    },
    {
      title: t('features.categories.ai.title'),
      description: t('features.categories.ai.description'),
      icon: Bot,
      features: [
        {
          title: t('features.categories.ai.features.chatbot.title'),
          description: t('features.categories.ai.features.chatbot.description'),
          icon: MessageSquare,
        },
        {
          title: t('features.categories.ai.features.knowledge.title'),
          description: t('features.categories.ai.features.knowledge.description'),
          icon: FileText,
        },
        {
          title: t('features.categories.ai.features.leads.title'),
          description: t('features.categories.ai.features.leads.description'),
          icon: Target,
        },
        {
          title: t('features.categories.ai.features.context.title'),
          description: t('features.categories.ai.features.context.description'),
          icon: Zap,
        },
      ],
    },
    {
      title: t('features.categories.integrations.title'),
      description: t('features.categories.integrations.description'),
      icon: Webhook,
      features: [
        {
          title: t('features.categories.integrations.features.webhooks.title'),
          description: t('features.categories.integrations.features.webhooks.description'),
          icon: Bell,
        },
        {
          title: t('features.categories.integrations.features.security.title'),
          description: t('features.categories.integrations.features.security.description'),
          icon: Lock,
        },
        {
          title: t('features.categories.integrations.features.retries.title'),
          description: t('features.categories.integrations.features.retries.description'),
          icon: Clock,
        },
        {
          title: t('features.categories.integrations.features.logs.title'),
          description: t('features.categories.integrations.features.logs.description'),
          icon: FileText,
        },
      ],
    },
    {
      title: t('features.categories.branding.title'),
      description: t('features.categories.branding.description'),
      icon: Palette,
      features: [
        {
          title: t('features.categories.branding.features.domains.title'),
          description: t('features.categories.branding.features.domains.description'),
          icon: Globe,
        },
        {
          title: t('features.categories.branding.features.logo.title'),
          description: t('features.categories.branding.features.logo.description'),
          icon: Palette,
        },
        {
          title: t('features.categories.branding.features.site.title'),
          description: t('features.categories.branding.features.site.description'),
          icon: Building2,
        },
        {
          title: t('features.categories.branding.features.sharing.title'),
          description: t('features.categories.branding.features.sharing.description'),
          icon: Share2,
        },
      ],
    },
  ];

  return (
    <MarketingLayout>
      <SEO 
        title={t('features.seo.title')}
        description={t('features.seo.description')}
      />

      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-4">
            <h1 className="text-4xl sm:text-5xl font-bold">{t('features.hero.title')}</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('features.hero.subtitle')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto mb-16">
            {featureCategories.map((category) => (
              <a
                key={category.title}
                href={`#${category.title.toLowerCase().replace(/\s+/g, '-')}`}
                className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors"
                data-testid={`link-category-${category.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <category.icon className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{category.title}</p>
                    {'comingSoon' in category && category.comingSoon && (
                      <Badge variant="secondary" className="text-xs">{t('features.comingSoon')}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {featureCategories.map((category, categoryIndex) => (
        <section 
          key={category.title}
          id={category.title.toLowerCase().replace(/\s+/g, '-')}
          className={`py-20 ${categoryIndex % 2 === 1 ? 'bg-muted/50' : ''}`}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4 mb-12">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <category.icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-3xl font-bold">{category.title}</h2>
                  {'comingSoon' in category && category.comingSoon && (
                    <Badge variant="secondary">{t('features.comingSoon')}</Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{category.description}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {category.features.map((feature) => (
                <Card key={feature.title} className="border-0 shadow-none bg-background">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <feature.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{feature.title}</h3>
                          {'comingSoon' in feature && feature.comingSoon && (
                            <Badge variant="secondary" className="text-xs">{t('features.comingSoon')}</Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground text-sm">{feature.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-3xl font-bold">{t('features.cta.title')}</h2>
            <p className="text-lg opacity-90">
              {t('features.cta.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href={getSignupUrl()}>
                <Button 
                  size="lg" 
                  variant="secondary" 
                  className="gap-2"
                  data-testid="button-features-cta-signup"
                >
                  {t('features.cta.button')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
              <Link to="/pricing">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="gap-2 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10"
                  data-testid="button-features-cta-pricing"
                >
                  {t('features.cta.viewPricing')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
