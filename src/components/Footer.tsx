import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useLocale } from '@/hooks/useLocale';
import { SiFacebook, SiInstagram, SiTiktok, SiYoutube } from 'react-icons/si';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SocialLink {
  platform: string;
  url: string;
  enabled: boolean;
  display_order: number;
}

export function Footer() {
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const { organization } = useOrganization();
  const { t } = useLocale();
  const orgSlug = organization?.slug;

  useEffect(() => {
    if (organization?.id) {
      fetchSocialLinks();
    }
  }, [organization?.id]);

  const fetchSocialLinks = async () => {
    if (!organization) return;
    
    const { data } = await supabase
      .from('social_links' as any)
      .select('*')
      .eq('organization_id', organization.id)
      .eq('enabled', true)
      .order('display_order');
    
    if (data) setSocialLinks(data as SocialLink[]);
  };

  const businessName = organization?.business_name;
  const contactEmail = organization?.contact_email;
  const contactPhone = organization?.contact_phone;
  const businessAddress = organization?.business_address;
  const valuationLink = orgSlug ? `/${orgSlug}/request-valuation` : '/request-valuation';

  const getSocialIcon = (platform: string) => {
    const iconClass = "h-8 w-8";
    switch (platform) {
      case 'facebook':
        return <SiFacebook className={iconClass} style={{ color: '#1877F2' }} />;
      case 'instagram':
        return <SiInstagram className={iconClass} style={{ color: '#E4405F' }} />;
      case 'tiktok':
        return <SiTiktok className={`${iconClass} text-foreground`} />;
      case 'youtube':
        return <SiYoutube className={iconClass} style={{ color: '#FF0000' }} />;
      default:
        return null;
    }
  };

  return (
    <footer className="bg-muted border-t mt-auto">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {businessName && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{businessName}</h3>
              <p className="text-sm text-muted-foreground">
                Your trusted partner in property sales and valuations across Ireland.
              </p>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Quick Links</h3>
            <nav className="flex flex-col space-y-2">
              <Link to={valuationLink} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Request Valuation
              </Link>
            </nav>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('footer.legal')}</h3>
            <nav className="flex flex-col space-y-2">
              <Link to="/privacy-policy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {t('footer.privacy')}
              </Link>
              <Link to="/terms-conditions" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {t('footer.terms')}
              </Link>
              <Link to="/cookie-policy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {t('footer.cookies')}
              </Link>
            </nav>
          </div>

          {(businessAddress || contactPhone || contactEmail) && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t('footer.contact')}</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                {businessAddress && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{businessAddress}</span>
                  </div>
                )}
                {contactPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 flex-shrink-0" />
                    <a href={`tel:${contactPhone.replace(/\s/g, '')}`} className="hover:text-primary transition-colors">
                      {contactPhone}
                    </a>
                  </div>
                )}
                {contactEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 flex-shrink-0" />
                    <a href={`mailto:${contactEmail}`} className="hover:text-primary transition-colors">
                      {contactEmail}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="border-t mt-8 pt-8">
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            {businessName && (
              <p className="text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} {businessName}. {t('footer.copyright')}
              </p>
            )}
            {socialLinks.length > 0 && (
              <TooltipProvider>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">Follow us on</span>
                  <div className="flex gap-4">
                    {socialLinks.map((link) => (
                      <Tooltip key={link.platform}>
                        <TooltipTrigger asChild>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="transition-transform hover:scale-110"
                            aria-label={`Follow us on ${link.platform}`}
                            data-testid={`link-social-${link.platform}`}
                          >
                            {getSocialIcon(link.platform)}
                          </a>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-sm capitalize">{link.platform}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
