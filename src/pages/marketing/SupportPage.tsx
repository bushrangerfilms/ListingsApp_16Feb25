import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Clock, FileText, Shield, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { COMPANY_INFO, getFormattedAddress } from '@/config/company';
import { getLoginUrl } from '@/lib/appUrls';
import { useLocale } from '@/hooks/useLocale';

export default function SupportPage() {
  const { t } = useLocale();

  return (
    <MarketingLayout>
      <SEO 
        title={t('support.seo.title')}
        description={t('support.seo.description')}
      />
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">{t('support.hero.title')}</h1>
            <p className="text-xl text-muted-foreground">
              {t('support.hero.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  {t('support.email.title')}
                </CardTitle>
                <CardDescription>
                  {t('support.email.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t('support.email.intro')}
                </p>
                <a 
                  href={`mailto:${COMPANY_INFO.contact.email}`}
                  className="text-primary hover:underline font-medium block"
                  data-testid="link-support-email"
                >
                  {COMPANY_INFO.contact.email}
                </a>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{COMPANY_INFO.contact.supportHours}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('support.email.response')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  {t('support.chat.title')}
                </CardTitle>
                <CardDescription>
                  {t('support.chat.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t('support.chat.intro')}
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>{t('support.chat.features.listings')}</li>
                  <li>{t('support.chat.features.platform')}</li>
                  <li>{t('support.chat.features.billing')}</li>
                </ul>
                <a href={getLoginUrl()}>
                  <Button variant="outline" className="mt-2" data-testid="button-login-support">
                    {t('support.chat.button')}
                  </Button>
                </a>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-12">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                {t('support.gdpr.title')}
              </CardTitle>
              <CardDescription>
                {t('support.gdpr.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('support.gdpr.intro')}
              </p>
              
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">{t('support.gdpr.howTo.title')}</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>{t('support.gdpr.howTo.step1')} <a href={`mailto:${COMPANY_INFO.dpo.email}`} className="text-primary hover:underline">{COMPANY_INFO.dpo.email}</a></li>
                  <li>{t('support.gdpr.howTo.step2')}</li>
                  <li>{t('support.gdpr.howTo.step3')}</li>
                  <li>{t('support.gdpr.howTo.step4')}</li>
                </ol>
              </div>

              <p className="text-sm text-muted-foreground">
                {t('support.gdpr.response')}
              </p>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">{t('support.gdpr.rights.title')}</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>{t('support.gdpr.rights.access')}</li>
                  <li>{t('support.gdpr.rights.rectification')}</li>
                  <li>{t('support.gdpr.rights.erasure')}</li>
                  <li>{t('support.gdpr.rights.restriction')}</li>
                  <li>{t('support.gdpr.rights.portability')}</li>
                  <li>{t('support.gdpr.rights.object')}</li>
                </ul>
              </div>

              <p className="text-sm text-muted-foreground">
                {t('support.gdpr.complaint')}{' '}
                <a 
                  href={COMPANY_INFO.legal.dataProtectionAuthority.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {t('support.gdpr.dpa')}
                </a>.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {t('support.legal.title')}
              </CardTitle>
              <CardDescription>
                {t('support.legal.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-3 gap-4">
                <Link to="/terms-conditions" className="block">
                  <Button variant="outline" className="w-full" data-testid="link-terms">
                    {t('footer.terms')}
                  </Button>
                </Link>
                <Link to="/privacy-policy" className="block">
                  <Button variant="outline" className="w-full" data-testid="link-privacy">
                    {t('footer.privacy')}
                  </Button>
                </Link>
                <Link to="/cookie-policy" className="block">
                  <Button variant="outline" className="w-full" data-testid="link-cookies">
                    {t('footer.cookies')}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <div className="mt-12 text-center text-sm text-muted-foreground">
            <p className="mb-2">
              <strong>{COMPANY_INFO.legalName}</strong>
            </p>
            <p>
              {getFormattedAddress()} | CRO: {COMPANY_INFO.croNumber} | VAT: {COMPANY_INFO.vatNumber}
            </p>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
