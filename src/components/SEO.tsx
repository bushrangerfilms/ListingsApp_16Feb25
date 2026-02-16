import { useEffect } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';

interface SEOProps {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  canonical?: string;
}

export function SEO({
  title,
  description,
  ogTitle,
  ogDescription,
  ogImage = '/autolisting-logo.png',
  ogUrl,
  canonical,
}: SEOProps) {
  const { organization } = useOrganization();
  
  // Generate dynamic defaults based on organization
  const businessName = organization?.business_name || 'Property Services';
  const defaultTitle = `${businessName} - Premium Property Sales & Valuations in Ireland`;
  const defaultDescription = `Find your perfect property with ${businessName}. Expert property sales, valuations, and auctioneering services across Ireland. Browse our curated selection of residential and commercial properties.`;
  
  const finalTitle = title || defaultTitle;
  const finalDescription = description || defaultDescription;
  
  useEffect(() => {
    // Update title
    document.title = finalTitle;

    // Update or create meta tags
    const updateMetaTag = (name: string, content: string, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      let element = document.querySelector(`meta[${attribute}="${name}"]`);
      
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      
      element.setAttribute('content', content);
    };

    // Standard meta tags
    updateMetaTag('description', finalDescription);

    // Open Graph tags
    updateMetaTag('og:title', ogTitle || finalTitle, true);
    updateMetaTag('og:description', ogDescription || finalDescription, true);
    updateMetaTag('og:image', ogImage, true);
    updateMetaTag('og:type', 'website', true);
    if (ogUrl) updateMetaTag('og:url', ogUrl, true);

    // Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', ogTitle || finalTitle);
    updateMetaTag('twitter:description', ogDescription || finalDescription);
    updateMetaTag('twitter:image', ogImage);

    // Canonical link
    if (canonical) {
      let linkElement = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!linkElement) {
        linkElement = document.createElement('link');
        linkElement.setAttribute('rel', 'canonical');
        document.head.appendChild(linkElement);
      }
      linkElement.setAttribute('href', canonical);
    }
  }, [finalTitle, finalDescription, ogTitle, ogDescription, ogImage, ogUrl, canonical, organization]);

  return null;
}
