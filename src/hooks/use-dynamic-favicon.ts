import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface UseDynamicFaviconOptions {
  organizationFaviconUrl?: string | null;
  organizationLogoUrl?: string | null;
}

const AUTOLISTING_FAVICON = '/favicon.png';

export function useDynamicFavicon(options: UseDynamicFaviconOptions = {}) {
  const location = useLocation();
  const { organizationFaviconUrl, organizationLogoUrl } = options;

  useEffect(() => {
    const isAdminRoute = location.pathname.startsWith('/admin');
    
    let baseFaviconUrl: string;
    
    if (isAdminRoute) {
      baseFaviconUrl = AUTOLISTING_FAVICON;
    } else {
      baseFaviconUrl = organizationFaviconUrl || organizationLogoUrl || AUTOLISTING_FAVICON;
    }
    
    const faviconUrl = baseFaviconUrl.includes('?') 
      ? `${baseFaviconUrl}&_cb=${Date.now()}`
      : `${baseFaviconUrl}?v=${Date.now()}`;

    const existingLink = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (existingLink) {
      existingLink.remove();
    }
    
    const newLink = document.createElement('link');
    newLink.rel = 'icon';
    newLink.type = 'image/png';
    newLink.href = faviconUrl;
    document.head.appendChild(newLink);
  }, [location.pathname, organizationFaviconUrl, organizationLogoUrl]);
}
