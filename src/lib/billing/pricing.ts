/**
 * Multi-Currency Pricing Configuration
 * Maps currencies to their corresponding Stripe price IDs
 */

import type { MarketCurrency, MarketLocale } from '@/lib/locale/markets';
import { LOCALE_TO_CURRENCY } from '@/lib/locale/markets';

export type SupportedCurrency = MarketCurrency;

export interface CurrencyConfig {
  code: SupportedCurrency;
  symbol: string;
  locale: string;
  stripeCode: string;
}

export const CURRENCY_CONFIGS: Record<SupportedCurrency, CurrencyConfig> = {
  EUR: {
    code: 'EUR',
    symbol: '\u20AC',
    locale: 'en-IE',
    stripeCode: 'eur',
  },
  GBP: {
    code: 'GBP',
    symbol: '\u00A3',
    locale: 'en-GB',
    stripeCode: 'gbp',
  },
  USD: {
    code: 'USD',
    symbol: '$',
    locale: 'en-US',
    stripeCode: 'usd',
  },
  CAD: {
    code: 'CAD',
    symbol: 'C$',
    locale: 'en-CA',
    stripeCode: 'cad',
  },
  AUD: {
    code: 'AUD',
    symbol: 'A$',
    locale: 'en-AU',
    stripeCode: 'aud',
  },
  NZD: {
    code: 'NZD',
    symbol: 'NZ$',
    locale: 'en-NZ',
    stripeCode: 'nzd',
  },
};

/**
 * Stripe Price IDs by currency
 * These will be populated after running the seed scripts for each currency
 * 
 * Structure: { [productKey]: { [currency]: priceId } }
 */
export interface StripePriceMap {
  plans: {
    starter: Record<SupportedCurrency, string | null>;
    pro: Record<SupportedCurrency, string | null>;
  };
  creditPacks: {
    credits_100: Record<SupportedCurrency, string | null>;
    credits_500: Record<SupportedCurrency, string | null>;
    credits_2000: Record<SupportedCurrency, string | null>;
    credits_5000: Record<SupportedCurrency, string | null>;
  };
}

/**
 * Default pricing in cents/pence for reference
 * Used for display when Stripe data is not yet available
 */
export const DEFAULT_PRICING = {
  plans: {
    starter: {
      EUR: 2900,
      GBP: 2500,
      USD: 2900,
      CAD: 3900,
      AUD: 4500,
      NZD: 4900,
    },
    pro: {
      EUR: 7900,
      GBP: 6900,
      USD: 7900,
      CAD: 10900,
      AUD: 12500,
      NZD: 13500,
    },
  },
  creditPacks: {
    credits_100: {
      EUR: 2500,
      GBP: 2200,
      USD: 2500,
      CAD: 3500,
      AUD: 3900,
      NZD: 4200,
    },
    credits_500: {
      EUR: 11000,
      GBP: 9500,
      USD: 11000,
      CAD: 15000,
      AUD: 17000,
      NZD: 18500,
    },
    credits_2000: {
      EUR: 40000,
      GBP: 35000,
      USD: 40000,
      CAD: 55000,
      AUD: 62000,
      NZD: 67000,
    },
    credits_5000: {
      EUR: 90000,
      GBP: 79000,
      USD: 90000,
      CAD: 122000,
      AUD: 140000,
      NZD: 150000,
    },
  },
} as const;

/**
 * Timezone → currency fallback when navigator.language doesn't match a known locale.
 * Covers common cases where browser language is 'en-US' but user is physically elsewhere.
 */
const TIMEZONE_TO_CURRENCY: Record<string, SupportedCurrency> = {
  'Europe/Dublin': 'EUR',
  'Europe/London': 'GBP',
  'America/New_York': 'USD',
  'America/Chicago': 'USD',
  'America/Denver': 'USD',
  'America/Los_Angeles': 'USD',
  'America/Toronto': 'CAD',
  'America/Vancouver': 'CAD',
  'America/Edmonton': 'CAD',
  'America/Winnipeg': 'CAD',
  'America/Halifax': 'CAD',
  'Australia/Sydney': 'AUD',
  'Australia/Melbourne': 'AUD',
  'Australia/Brisbane': 'AUD',
  'Australia/Perth': 'AUD',
  'Australia/Adelaide': 'AUD',
  'Australia/Hobart': 'AUD',
  'Pacific/Auckland': 'NZD',
};

/**
 * Get currency for a locale string.
 * Checks navigator.languages array first, then falls back to timezone detection.
 */
export function getCurrencyForLocale(locale: string): SupportedCurrency {
  // Direct match
  const direct = (LOCALE_TO_CURRENCY as Record<string, SupportedCurrency>)[locale];
  if (direct) return direct;

  // Timezone-based detection — more reliable than browser language since most users
  // don't change their OS timezone, but many have en-US as default browser language
  if (typeof Intl !== 'undefined') {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const tzMatch = TIMEZONE_TO_CURRENCY[tz];
      if (tzMatch) return tzMatch;
    } catch {
      // ignore
    }
  }

  // Browser languages fallback
  if (typeof navigator !== 'undefined' && navigator.languages) {
    for (const lang of navigator.languages) {
      const match = (LOCALE_TO_CURRENCY as Record<string, SupportedCurrency>)[lang];
      if (match) return match;
    }
  }

  return 'EUR';
}

/**
 * Format price for display
 */
export function formatPrice(
  amountInCents: number, 
  currency: SupportedCurrency = 'EUR'
): string {
  const config = CURRENCY_CONFIGS[currency];
  const amount = amountInCents / 100;
  
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.code,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get the default currency for an organization based on its locale
 */
export function getOrganizationCurrency(locale?: string | null): SupportedCurrency {
  if (!locale) return 'EUR';
  return getCurrencyForLocale(locale);
}

/**
 * Approximate exchange rates from EUR for display estimates only.
 * Used when target currency prices aren't set in Stripe yet.
 */
const EUR_EXCHANGE_RATES: Record<SupportedCurrency, number> = {
  EUR: 1,
  GBP: 0.86,
  USD: 1.08,
  CAD: 1.47,
  AUD: 1.65,
  NZD: 1.78,
};

/**
 * Convert EUR price to GBP (approximate conversion)
 * Used only for display estimates when GBP prices aren't set
 */
export function estimateGBPPrice(eurCents: number): number {
  return estimatePrice(eurCents, 'GBP');
}

/**
 * Round cents to nearest 500 (i.e. nearest 5 in whole currency units).
 * e.g. 4320 → 4500 ($43.20 → $45), 7560 → 7500 ($75.60 → $75)
 */
function roundToNearest5(cents: number): number {
  return Math.round(cents / 500) * 500;
}

/**
 * Convert EUR price to target currency (approximate conversion)
 * Used only for display estimates when target currency prices aren't set.
 * Rounds to nearest 5 in whole currency units for clean display pricing.
 */
export function estimatePrice(eurCents: number, toCurrency: SupportedCurrency): number {
  if (toCurrency === 'EUR') return eurCents;
  return roundToNearest5(Math.round(eurCents * EUR_EXCHANGE_RATES[toCurrency]));
}
