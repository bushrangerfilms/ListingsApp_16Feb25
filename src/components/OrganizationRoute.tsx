import { useEffect, ReactNode, useState } from 'react';
import { useParams, Navigate, useLocation } from 'react-router-dom';
import { useOrganization } from '@/contexts/OrganizationContext';
import { isPublicSite, detectOrganizationFromDomain } from '@/lib/domainDetection';

interface OrganizationRouteProps {
  children: ReactNode;
}

const DEFAULT_FAVICON = '/favicon.png';

function setFavicon(url: string) {
  const faviconUrl = url.includes('?') 
    ? `${url}&_cb=${Date.now()}`
    : `${url}?v=${Date.now()}`;
  
  const existingLink = document.querySelector("link[rel='icon']") as HTMLLinkElement;
  if (existingLink) {
    existingLink.remove();
  }
  
  const newLink = document.createElement('link');
  newLink.rel = 'icon';
  newLink.type = 'image/png';
  newLink.href = faviconUrl;
  document.head.appendChild(newLink);
}

export function OrganizationRoute({ children }: OrganizationRouteProps) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { organization, loading, setOrganizationBySlug } = useOrganization();
  const [isLoadingOrg, setIsLoadingOrg] = useState(true);
  const [shouldRedirectToLogin, setShouldRedirectToLogin] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const isAdminRoute = location.pathname.startsWith('/admin');
    if (isAdminRoute) return;
    
    if (organization) {
      const faviconUrl = organization.favicon_url || organization.logo_url || DEFAULT_FAVICON;
      setFavicon(faviconUrl);
    } else if (!loading && !isLoadingOrg) {
      setFavicon(DEFAULT_FAVICON);
    }
  }, [organization, loading, isLoadingOrg, location.pathname]);

  useEffect(() => {
    const loadOrg = async () => {
      setIsLoadingOrg(true);
      const isAdminRoute = location.pathname.startsWith('/admin');
      
      // If orgSlug is provided in URL, use it
      if (orgSlug) {
        try {
          const loadedOrg = await setOrganizationBySlug(orgSlug);
          // Set favicon immediately with the returned org (don't wait for context to propagate)
          if (loadedOrg && !isAdminRoute) {
            const faviconUrl = loadedOrg.favicon_url || loadedOrg.logo_url || DEFAULT_FAVICON;
            console.log('[OrganizationRoute] Setting favicon immediately after load:', faviconUrl);
            setFavicon(faviconUrl);
          }
          setIsLoadingOrg(false);
        } catch (error) {
          console.error('[OrganizationRoute] Error loading organization:', error);
          setIsLoadingOrg(false);
        }
        return;
      }
      
      // No slug provided - check if we're on a custom domain
      const isCustomDomain = isPublicSite();
      
      if (isCustomDomain) {
        // On custom domain - try to detect organization from domain
        console.log('[OrganizationRoute] Custom domain detected, looking up organization');
        const domainOrg = await detectOrganizationFromDomain();
        if (domainOrg) {
          console.log('[OrganizationRoute] Found organization for domain:', domainOrg.business_name);
          const loadedOrg = await setOrganizationBySlug(domainOrg.slug);
          // Set favicon immediately with the returned org
          if (loadedOrg && !isAdminRoute) {
            const faviconUrl = loadedOrg.favicon_url || loadedOrg.logo_url || DEFAULT_FAVICON;
            console.log('[OrganizationRoute] Setting favicon immediately after domain load:', faviconUrl);
            setFavicon(faviconUrl);
          }
          setIsLoadingOrg(false);
          return;
        }
      }
      
      // On admin domain (app.autolisting.io, localhost, replit) with no slug
      // Redirect to login instead of defaulting to bridge-auctioneers
      console.log('[OrganizationRoute] Admin domain with no slug, redirecting to login');
      setShouldRedirectToLogin(true);
      setIsLoadingOrg(false);
    };
    
    loadOrg();
  }, [orgSlug, setOrganizationBySlug, location.pathname]);

  // Redirect to login for admin domain without slug
  if (shouldRedirectToLogin) {
    return <Navigate to="/admin/login" replace />;
  }

  if (loading || isLoadingOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // If organization not found after loading, redirect to not found
  if (!loading && !isLoadingOrg && !organization) {
    console.log('[OrganizationRoute] Organization not found, redirecting to /not-found');
    return <Navigate to="/not-found" replace />;
  }

  return <>{children}</>;
}
