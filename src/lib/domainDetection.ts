import { supabase } from "@/integrations/supabase/client";

export interface OrganizationInfo {
  id: string;
  business_name: string;
  slug: string;
  domain: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  business_address: string | null;
  hide_public_site?: boolean;
  primary_color?: string | null;
  secondary_color?: string | null;
}

export type DomainType = 'marketing' | 'admin' | 'org-public';

/**
 * Determines what type of domain the current hostname represents:
 * - 'marketing': autolisting.io or www.autolisting.io (marketing/landing pages)
 * - 'admin': app.autolisting.io, localhost, replit dev domains (admin portal/dashboard)
 * - 'org-public': custom organization domains (public listings for an org)
 */
export function getDomainType(): DomainType {
  const hostname = window.location.hostname;
  
  // Marketing site: root domain autolisting.io or www.autolisting.io
  if (
    hostname === 'autolisting.io' ||
    hostname === 'www.autolisting.io'
  ) {
    console.log('[DomainDetection] Marketing domain detected');
    return 'marketing';
  }
  
  // Admin portal: app.autolisting.io, localhost, or any replit dev domain
  if (
    hostname === 'localhost' || 
    hostname === '127.0.0.1' ||
    hostname === 'app.autolisting.io' ||
    hostname.includes('.replit.') ||
    hostname.includes('.replit.dev') ||
    hostname.includes('.repl.co') ||
    hostname.includes('.spock.replit.dev') ||
    hostname.includes('.picard.replit.dev') ||
    hostname.includes('.kirk.replit.dev') ||
    hostname.includes('.janeway.replit.dev')
  ) {
    console.log('[DomainDetection] Admin portal domain detected');
    return 'admin';
  }
  
  // Any other domain is treated as a potential org custom domain
  console.log('[DomainDetection] Organization public domain detected:', hostname);
  return 'org-public';
}

/**
 * Detects the organization based on the current hostname
 * Returns the organization if a custom domain matches, otherwise null
 */
export async function detectOrganizationFromDomain(): Promise<OrganizationInfo | null> {
  try {
    const hostname = window.location.hostname;
    const domainType = getDomainType();
    
    // Only look up organization for org-public domains
    if (domainType !== 'org-public') {
      console.log('[DomainDetection] Not an org domain, skipping organization lookup');
      return null;
    }

    console.log('[DomainDetection] Checking for organization with domain:', hostname);

    // Look up organization by custom domain
    const { data, error } = await supabase
      .from('organizations')
      .select('id, business_name, slug, domain, logo_url, favicon_url, contact_email, contact_phone, business_address, hide_public_site, primary_color, secondary_color')
      .eq('domain', hostname)
      .eq('is_active', true)
      .single();

    if (error) {
      // No organization found for this domain - this is normal for admin portal
      console.log('[DomainDetection] No organization found for domain:', hostname);
      return null;
    }

    console.log('[DomainDetection] Found organization:', (data as any).business_name);
    return data as unknown as OrganizationInfo;
  } catch (error) {
    console.error('[DomainDetection] Error detecting organization:', error);
    return null;
  }
}

/**
 * Check if the current request is for a public org site (custom domain)
 * vs the admin portal or marketing site
 */
export function isPublicSite(): boolean {
  return getDomainType() === 'org-public';
}

/**
 * Check if the current request is for the marketing site
 */
export function isMarketingSite(): boolean {
  return getDomainType() === 'marketing';
}

/**
 * Check if the current request is for the admin portal
 */
export function isAdminSite(): boolean {
  return getDomainType() === 'admin';
}
