import { useState, useEffect } from 'react';
import { COUNTRY_TO_LOCALE, LOCALE_TO_CURRENCY, isMarketCountry } from '@/lib/locale/markets';
import { getCurrencyForLocale, type SupportedCurrency } from '@/lib/billing/pricing';
import { i18n } from '@/lib/i18n';

const CACHE_KEY = 'autolisting_geo_country';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedGeo {
  country: string;
  ts: number;
}

function getCachedCountry(): string | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedGeo = JSON.parse(raw);
    if (Date.now() - cached.ts > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached.country;
  } catch {
    return null;
  }
}

function cacheCountry(country: string) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ country, ts: Date.now() }));
  } catch {
    // localStorage full or disabled — ignore
  }
}

function countryToCurrency(countryCode: string): SupportedCurrency | null {
  const upper = countryCode.toUpperCase();
  if (!isMarketCountry(upper)) return null;
  const locale = COUNTRY_TO_LOCALE[upper];
  return LOCALE_TO_CURRENCY[locale];
}

/**
 * Fetches country via free IP geolocation API.
 * Uses api.country.is (free, HTTPS, no key needed).
 * ipapi.co was blocked by Cloudflare bot protection.
 */
async function fetchCountryFromIP(): Promise<string | null> {
  try {
    const res = await fetch('https://api.country.is', {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const country = data?.country;
    return typeof country === 'string' && country.length === 2 ? country : null;
  } catch {
    return null;
  }
}

/**
 * Returns the best-guess currency for the visitor.
 *
 * Detection chain:
 * 1. localStorage cache (from a previous IP lookup)
 * 2. IP geolocation (ipapi.co — async, cached for 7 days)
 * 3. Timezone fallback (synchronous)
 * 4. EUR default
 *
 * Returns immediately with timezone-based guess, then upgrades to IP-based
 * result once the fetch resolves (usually <200ms, max 3s timeout).
 */
export function useGeolocatedCurrency(): { currency: SupportedCurrency; isResolved: boolean } {
  // Synchronous fallback while IP lookup is in flight
  const timezoneFallback = getCurrencyForLocale(i18n.language || 'en-IE');

  // Check cache synchronously — if we have a cached country, use it immediately
  const cachedCountry = getCachedCountry();
  const cachedCurrency = cachedCountry ? countryToCurrency(cachedCountry) : null;

  const [currency, setCurrency] = useState<SupportedCurrency>(cachedCurrency || timezoneFallback);
  const [isResolved, setIsResolved] = useState(!!cachedCurrency);

  useEffect(() => {
    // Already have a cached result — no fetch needed
    if (cachedCurrency) return;

    let cancelled = false;

    fetchCountryFromIP().then((country) => {
      if (cancelled) return;
      if (country) {
        cacheCountry(country);
        const geo = countryToCurrency(country);
        if (geo) setCurrency(geo);
      }
      setIsResolved(true);
    });

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { currency, isResolved };
}
