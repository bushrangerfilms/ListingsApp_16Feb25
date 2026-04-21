import { useEffect } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { isMarketingSite, isAdminSite } from '@/lib/domainDetection';

const DEFAULT_MARKETING_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'AutoListing.io',
      url: 'https://autolisting.io',
      logo: 'https://autolisting.io/autolisting-logo.png',
      description:
        'Automated real estate lead generation and social media system for property professionals.',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'AutoListing.io',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: 'https://autolisting.io',
      description:
        'Automated real estate lead generation and social media system for property professionals in Ireland, the UK, and beyond.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'EUR',
      },
    },
  ],
};

interface SEOProps {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  canonical?: string;
  /**
   * Optional per-route structured data (JSON-LD). Injected ONLY on the
   * marketing domain — never on admin or custom org-public domains, where
   * declaring AutoListing.io as the entity would leak onto customer sites.
   */
  structuredData?: object | object[];
}

export function SEO({
  title,
  description,
  ogTitle,
  ogDescription,
  ogImage = '/autolisting-logo.png',
  ogUrl,
  canonical,
  structuredData,
}: SEOProps) {
  const { organization } = useOrganization();

  // Defaults used on org-public pages where no explicit title/description is passed.
  const businessName = organization?.business_name || 'Property Services';
  const regionName = (organization as any)?.country || 'your area';
  const defaultTitle = `${businessName} - Premium Property Sales & Valuations`;
  const defaultDescription = `Find your perfect property with ${businessName}. Expert property sales, valuations, and property services across ${regionName}. Browse our curated selection of residential and commercial properties.`;

  const finalTitle = title || defaultTitle;
  const finalDescription = description || defaultDescription;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const marketing = isMarketingSite();
    const admin = isAdminSite();

    // During build-time prerender the headless browser serves from localhost,
    // so window.location.origin is e.g. `http://127.0.0.1:8000`. We must NOT
    // bake that into canonical/og:url — use the real production marketing
    // origin instead. Never used at runtime in production.
    const isPrerender = !!(
      window as unknown as { __PRERENDER_INJECTED?: unknown }
    ).__PRERENDER_INJECTED;
    const marketingOrigin = isPrerender
      ? 'https://autolisting.io'
      : window.location.origin;

    document.title = finalTitle;

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

    const removeMetaTag = (name: string, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      const element = document.querySelector(`meta[${attribute}="${name}"]`);
      if (element) element.remove();
    };

    // Standard meta tags
    updateMetaTag('description', finalDescription);

    // og:image / twitter:image must be ABSOLUTE URLs for LinkedIn, Facebook,
    // Slack, iMessage, email preview renderers etc. to fetch them. On the
    // marketing domain the logo lives at https://autolisting.io/autolisting-logo.png;
    // elsewhere we leave the relative path alone (org-public pages serve their
    // own branding and don't want autolisting.io's logo URL baked in).
    const absolutiseImage = (src: string) => {
      if (/^https?:\/\//i.test(src) || src.startsWith('//')) return src;
      if (marketing && src.startsWith('/')) return marketingOrigin + src;
      return src;
    };
    const absoluteOgImage = absolutiseImage(ogImage);

    // Open Graph tags
    updateMetaTag('og:title', ogTitle || finalTitle, true);
    updateMetaTag('og:description', ogDescription || finalDescription, true);
    updateMetaTag('og:image', absoluteOgImage, true);
    updateMetaTag('og:type', 'website', true);

    // og:url — explicit prop wins; otherwise auto-inject on marketing only.
    // On admin / org-public, remove any leftover so we never leak autolisting.io
    // as the canonical URL for a customer's custom-domain page.
    if (ogUrl) {
      updateMetaTag('og:url', ogUrl, true);
    } else if (marketing) {
      updateMetaTag(
        'og:url',
        marketingOrigin + window.location.pathname,
        true,
      );
    } else {
      removeMetaTag('og:url', true);
    }

    // Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', ogTitle || finalTitle);
    updateMetaTag('twitter:description', ogDescription || finalDescription);
    updateMetaTag('twitter:image', absoluteOgImage);

    // Canonical link — explicit prop wins; otherwise auto-inject on marketing.
    // Removed on admin / org-public so custom domains never declare
    // autolisting.io as their canonical.
    const desiredCanonical =
      canonical ||
      (marketing ? marketingOrigin + window.location.pathname : null);

    let canonicalEl = document.querySelector(
      'link[rel="canonical"]',
    ) as HTMLLinkElement | null;
    if (desiredCanonical) {
      if (!canonicalEl) {
        canonicalEl = document.createElement('link');
        canonicalEl.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalEl);
      }
      canonicalEl.setAttribute('href', desiredCanonical);
    } else if (canonicalEl) {
      canonicalEl.remove();
    }

    // Admin portal: noindex, nofollow. Nothing under app.autolisting.io belongs
    // in a search index — it's all login-gated.
    if (admin) {
      updateMetaTag('robots', 'noindex, nofollow');
    } else {
      removeMetaTag('robots');
    }

    // JSON-LD structured data — marketing domain only.
    // Managed as a single <script data-seo-jsonld> element so SPA navigation
    // can update/remove it cleanly.
    const existingJsonLd = document.querySelector('script[data-seo-jsonld]');
    if (marketing) {
      const payload = structuredData ?? DEFAULT_MARKETING_JSON_LD;
      const jsonText = JSON.stringify(payload);
      if (existingJsonLd) {
        if (existingJsonLd.textContent !== jsonText) {
          existingJsonLd.textContent = jsonText;
        }
      } else {
        const script = document.createElement('script');
        script.setAttribute('type', 'application/ld+json');
        script.setAttribute('data-seo-jsonld', 'true');
        script.textContent = jsonText;
        document.head.appendChild(script);
      }
    } else if (existingJsonLd) {
      existingJsonLd.remove();
    }
  }, [
    finalTitle,
    finalDescription,
    ogTitle,
    ogDescription,
    ogImage,
    ogUrl,
    canonical,
    structuredData,
    organization,
  ]);

  return null;
}
