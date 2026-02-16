import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Building2, Menu, X } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isMarketingSite } from '@/lib/domainDetection';

const navItems = [
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Support', href: '/support' },
];

import { getLoginUrl, getSignupUrl, getDashboardUrl } from '@/lib/appUrls';

export function MarketingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const isMarketing = useMemo(() => isMarketingSite(), []);
  
  const handleLogin = () => {
    if (isMarketing) {
      window.location.href = getLoginUrl();
    } else {
      navigate('/admin/login');
    }
  };
  
  const handleSignup = () => {
    if (isMarketing) {
      window.location.href = getSignupUrl();
    } else {
      navigate('/signup');
    }
  };
  
  const handleDashboard = () => {
    if (isMarketing) {
      window.location.href = getDashboardUrl();
    } else {
      navigate('/admin/listings');
    }
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link to="/" className="flex items-center gap-2 flex-shrink-0" data-testid="link-home">
            <Building2 className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">AutoListing.io</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                data-testid={`link-nav-${item.label.toLowerCase()}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {user && isAdmin ? (
              <Button 
                onClick={handleDashboard}
                data-testid="button-dashboard"
              >
                Dashboard
              </Button>
            ) : (
              <>
                <Button 
                  variant="ghost" 
                  onClick={handleLogin}
                  data-testid="button-login"
                >
                  Log in
                </Button>
                <Button 
                  onClick={handleSignup}
                  data-testid="button-signup"
                >
                  Start Free Trial
                </Button>
              </>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="button-mobile-menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid={`link-mobile-nav-${item.label.toLowerCase()}`}
                >
                  {item.label}
                </Link>
              ))}
              <div className="flex flex-col gap-2 mt-4 pt-4 border-t">
                {user && isAdmin ? (
                  <Button 
                    onClick={() => {
                      handleDashboard();
                      setMobileMenuOpen(false);
                    }}
                    data-testid="button-mobile-dashboard"
                  >
                    Dashboard
                  </Button>
                ) : (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        handleLogin();
                        setMobileMenuOpen(false);
                      }}
                      data-testid="button-mobile-login"
                    >
                      Log in
                    </Button>
                    <Button 
                      onClick={() => {
                        handleSignup();
                        setMobileMenuOpen(false);
                      }}
                      data-testid="button-mobile-signup"
                    >
                      Start Free Trial
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
