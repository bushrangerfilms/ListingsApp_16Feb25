/**
 * IP-based country detection with sessionStorage caching.
 * Same approach as Stripe/Netflix — detect country from IP address.
 * Uses api.country.is (free, HTTPS, CORS-enabled, no API key).
 */

import { COUNTRY_TO_LOCALE, isMarketCountry, type MarketLocale } from '@/lib/locale/markets';

const CACHE_KEY = 'al_geo_country';

/** Timezone → locale mapping for synchronous fallback. */
const TIMEZONE_TO_LOCALE: Record<string, MarketLocale> = {
  'Europe/Dublin': 'en-IE',
  'Europe/London': 'en-GB',
  'Europe/Belfast': 'en-GB',
  'America/New_York': 'en-US',
  'America/Chicago': 'en-US',
  'America/Denver': 'en-US',
  'America/Los_Angeles': 'en-US',
  'America/Phoenix': 'en-US',
  'America/Anchorage': 'en-US',
  'America/Boise': 'en-US',
  'America/Detroit': 'en-US',
  'America/Indiana/Indianapolis': 'en-US',
  'Pacific/Honolulu': 'en-US',
  'America/Toronto': 'en-CA',
  'America/Vancouver': 'en-CA',
  'America/Edmonton': 'en-CA',
  'America/Winnipeg': 'en-CA',
  'America/Halifax': 'en-CA',
  'America/St_Johns': 'en-CA',
  'America/Regina': 'en-CA',
  'Australia/Sydney': 'en-AU',
  'Australia/Melbourne': 'en-AU',
  'Australia/Brisbane': 'en-AU',
  'Australia/Perth': 'en-AU',
  'Australia/Adelaide': 'en-AU',
  'Australia/Hobart': 'en-AU',
  'Australia/Darwin': 'en-AU',
  'Pacific/Auckland': 'en-NZ',
  'Pacific/Chatham': 'en-NZ',
};

/** Returns locale from IANA timezone (synchronous, no network). */
export function getTimezoneLocale(): MarketLocale | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_TO_LOCALE[tz] ?? null;
  } catch {
    return null;
  }
}

/** Returns cached country code from sessionStorage, or null. */
export function getCachedCountry(): string | null {
  try {
    return sessionStorage.getItem(CACHE_KEY);
  } catch {
    return null;
  }
}

/** Maps a 2-letter country code to a MarketLocale, or null if not a supported market. */
export function countryToLocale(country: string): MarketLocale | null {
  const upper = country.toUpperCase();
  if (!isMarketCountry(upper)) return null;
  return COUNTRY_TO_LOCALE[upper as keyof typeof COUNTRY_TO_LOCALE];
}

/**
 * Fetches country from IP via api.country.is.
 * Caches result in sessionStorage. Returns country code or null.
 */
export async function fetchCountryFromIP(): Promise<string | null> {
  try {
    const res = await fetch('https://api.country.is', {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const country = data?.country;
    if (typeof country === 'string' && country.length === 2) {
      try { sessionStorage.setItem(CACHE_KEY, country); } catch { /* ignore */ }
      return country;
    }
    return null;
  } catch {
    return null;
  }
}
