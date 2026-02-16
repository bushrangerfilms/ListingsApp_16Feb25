import { MarketingHeader } from './MarketingHeader';
import { MarketingFooter } from './MarketingFooter';
import { CookieConsent } from '@/components/CookieConsent';

interface MarketingLayoutProps {
  children: React.ReactNode;
  hideHeader?: boolean;
  hideFooter?: boolean;
}

export function MarketingLayout({ children, hideHeader, hideFooter }: MarketingLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {!hideHeader && <MarketingHeader />}
      <main className="flex-1">
        {children}
      </main>
      {!hideFooter && <MarketingFooter />}
      <CookieConsent />
    </div>
  );
}
