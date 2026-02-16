import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { detectOrganizationFromDomain, isPublicSite, OrganizationInfo } from "@/lib/domainDetection";

interface PublicListingsContextType {
  organization: OrganizationInfo | null;
  isPublicSite: boolean;
  loading: boolean;
}

const PublicListingsContext = createContext<PublicListingsContextType>({
  organization: null,
  isPublicSite: false,
  loading: true,
});

export function PublicListingsProvider({ children }: { children: ReactNode }) {
  const [organization, setOrganization] = useState<OrganizationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const publicSite = isPublicSite();

  useEffect(() => {
    async function loadOrganization() {
      if (!publicSite) {
        // Admin portal - no need to detect organization by domain
        setLoading(false);
        return;
      }

      try {
        const org = await detectOrganizationFromDomain();
        
        // If the organization has hidden their public site, redirect to login
        if (org?.hide_public_site) {
          console.log('[PublicListingsContext] Public site is hidden, redirecting to login');
          window.location.href = 'https://app.autolisting.io/admin/login';
          return;
        }
        
        setOrganization(org);
      } catch (error) {
        console.error('[PublicListingsContext] Failed to load organization:', error);
      } finally {
        setLoading(false);
      }
    }

    loadOrganization();
  }, [publicSite]);

  return (
    <PublicListingsContext.Provider
      value={{
        organization,
        isPublicSite: publicSite,
        loading,
      }}
    >
      {children}
    </PublicListingsContext.Provider>
  );
}

export function usePublicListings() {
  const context = useContext(PublicListingsContext);
  if (!context) {
    throw new Error("usePublicListings must be used within PublicListingsProvider");
  }
  return context;
}
