// Supabase client configuration for Bridge Auctioneers CRM
// Uses the 'crm' schema for multi-tenant data isolation
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

// Custom storage adapter that uses cookies with shared domain for cross-subdomain auth
// This allows seamless auth between app.autolisting.io and socials.autolisting.io
// Falls back to localStorage when cookies are blocked (e.g., in iframe/cross-site contexts)
const createCookieStorage = () => {
  // Check if we're on autolisting.io domain
  const isAutoListingDomain = typeof window !== 'undefined' && 
    window.location.hostname.endsWith('autolisting.io');
  
  const cookieDomain = isAutoListingDomain ? '.autolisting.io' : undefined;
  
  // Detect if we're in a cross-origin iframe (preview contexts block cookies)
  const isInCrossOriginIframe = (() => {
    if (typeof window === 'undefined') return false;
    try {
      // Check if we're in an iframe
      if (window.self === window.top) return false;
      // Check if parent origin is different (cross-origin)
      // This will throw if cross-origin
      const parentOrigin = window.parent.location.origin;
      return parentOrigin !== window.location.origin;
    } catch {
      // SecurityError means cross-origin iframe
      return true;
    }
  })();
  
  // Detect if we're in Replit development environment
  const isReplitDev = typeof window !== 'undefined' && (
    window.location.hostname.includes('.replit.dev') ||
    window.location.hostname.includes('.kirk.replit.dev') ||
    window.location.hostname.includes('.repl.co')
  );
  
  // Test if cookies are accessible (they may be blocked in cross-site iframe contexts)
  const cookiesAccessible = (() => {
    // Always use localStorage in cross-origin iframes or Replit dev
    if (isInCrossOriginIframe || isReplitDev) {
      console.log('[Supabase] Cross-origin iframe or Replit dev detected, using localStorage');
      return false;
    }
    if (typeof document === 'undefined') return false;
    try {
      document.cookie = '__sb_test=1; path=/';
      const hasCookie = document.cookie.includes('__sb_test=1');
      document.cookie = '__sb_test=; path=/; max-age=0';
      return hasCookie;
    } catch {
      return false;
    }
  })();
  
  // Use localStorage fallback when cookies are blocked
  if (!cookiesAccessible) {
    console.log('[Supabase] Cookies blocked, using localStorage fallback');
    return {
      getItem: (key: string): string | null => {
        if (typeof localStorage === 'undefined') return null;
        return localStorage.getItem(key);
      },
      setItem: (key: string, value: string): void => {
        if (typeof localStorage === 'undefined') return;
        localStorage.setItem(key, value);
      },
      removeItem: (key: string): void => {
        if (typeof localStorage === 'undefined') return;
        localStorage.removeItem(key);
      },
    };
  }
  
  return {
    getItem: (key: string): string | null => {
      if (typeof document === 'undefined') return null;
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === key) {
          return decodeURIComponent(value);
        }
      }
      return null;
    },
    setItem: (key: string, value: string): void => {
      if (typeof document === 'undefined') return;
      const maxAge = 60 * 60 * 24 * 365; // 1 year
      const domain = cookieDomain ? `; domain=${cookieDomain}` : '';
      const secure = window.location.protocol === 'https:' ? '; secure' : '';
      document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}${domain}${secure}; samesite=lax`;
    },
    removeItem: (key: string): void => {
      if (typeof document === 'undefined') return;
      const domain = cookieDomain ? `; domain=${cookieDomain}` : '';
      document.cookie = `${key}=; path=/; max-age=0${domain}`;
    },
  };
};

// Main client for browser/client-side operations (uses anon key + RLS)
// Multi-schema setup:
// - Shared tables (organizations, user_roles, user_organizations) are in public schema - shared with Social Media app
// - CRM-specific tables (listings, buyer_profiles, etc.) are in crm schema
// Always specify schema explicitly using .schema('public') or .schema('crm') in queries
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: createCookieStorage(),
    storageKey: 'sb-auth-token',
  }
});

// Legacy export name for backward compatibility
export const supabaseCrm = supabase;