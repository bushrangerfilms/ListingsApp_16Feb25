import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { COMPANY_INFO, getFormattedAddress } from '@/config/company';

export function MarketingFooter() {
  return (
    <footer className="bg-muted border-t mt-auto">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">{COMPANY_INFO.name}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              The all-in-one platform for real estate professionals. Manage listings, automate marketing, and grow your business.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Product</h3>
            <nav className="flex flex-col space-y-2">
              <Link to="/features" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-features">
                Features
              </Link>
              <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-pricing">
                Pricing
              </Link>
              <Link to="/support" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-support">
                Support
              </Link>
            </nav>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Legal</h3>
            <nav className="flex flex-col space-y-2">
              <Link to="/privacy-policy" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-privacy">
                Privacy Policy
              </Link>
              <Link to="/terms-conditions" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-terms">
                Terms & Conditions
              </Link>
              <Link to="/cookie-policy" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-cookies">
                Cookie Policy
              </Link>
            </nav>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Get Started</h3>
            <nav className="flex flex-col space-y-2">
              <Link to="/signup" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-signup">
                Start Free Trial
              </Link>
              <Link to="/admin/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-login">
                Log in
              </Link>
            </nav>
          </div>
        </div>

        <div className="border-t mt-8 pt-8 space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            &copy; {new Date().getFullYear()} {COMPANY_INFO.name}. All rights reserved.
          </p>
          
          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p>
              {COMPANY_INFO.legalName} | Registered in Ireland (CRO: {COMPANY_INFO.croNumber})
            </p>
            <p>
              VAT: {COMPANY_INFO.vatNumber} | {getFormattedAddress()}
            </p>
            <p>
              Contact: {COMPANY_INFO.contact.email}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
