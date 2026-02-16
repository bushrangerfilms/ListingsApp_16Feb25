import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Mail, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import { OrganizationViewSelector } from "@/components/OrganizationViewSelector";
import { OrganizationLogo } from "@/components/OrganizationLogo";

export const PublicHeader = () => {
  const { isAdmin } = useAuth();
  const { organization } = useOrganization();
  
  // Defensive access to OrganizationView context
  let isSuperAdmin = false;
  try {
    const orgViewContext = useOrganizationView();
    isSuperAdmin = orgViewContext?.isSuperAdmin || false;
  } catch (error) {
    console.warn('OrganizationView context not available:', error);
  }
  
  const navigate = useNavigate();
  const orgSlug = organization?.slug;

  const businessName = organization?.business_name;
  const psrLicence = organization?.psr_licence_number;
  const homeLink = orgSlug ? `/${orgSlug}` : '/';
  const valuationLink = orgSlug ? `/${orgSlug}/request-valuation` : '/request-valuation';

  return (
    <header className="border-b bg-card sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link to={homeLink} className="flex items-center gap-3 flex-shrink-0">
            <OrganizationLogo
              logoUrl={organization?.logo_url}
              businessName={businessName}
              className="h-10 sm:h-12 w-auto"
            />
            {businessName && (
              <div className="hidden sm:block">
                <h1 className="text-lg sm:text-xl font-bold">{businessName}</h1>
                <p className="text-xs text-muted-foreground">Premium Property Services</p>
                {psrLicence && (
                  <p className="text-xs text-muted-foreground font-medium">PSRA Licence {psrLicence}</p>
                )}
              </div>
            )}
          </Link>

          <nav className="flex items-center gap-2 flex-wrap justify-end">
            {isAdmin && (
              <>
                <span className="hidden sm:inline-flex text-xs sm:text-sm font-medium text-muted-foreground border border-border px-2 sm:px-3 py-1 rounded-md bg-muted/50">
                  Viewing as admin
                </span>
                {isSuperAdmin && (
                  <div className="hidden lg:flex">
                    <OrganizationViewSelector />
                  </div>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  className="gap-2"
                  onClick={() => navigate('/admin/listings')}
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back to Dashboard</span>
                  <span className="sm:hidden">Dashboard</span>
                </Button>
              </>
            )}
            <Link to={valuationLink}>
              <Button variant="default" size="sm" className="gap-2">
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">Request Valuation</span>
                <span className="sm:hidden">Valuation</span>
              </Button>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};
