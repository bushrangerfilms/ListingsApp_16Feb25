/**
 * Multi-Currency Pricing Configuration
 * Maps currencies to their corresponding Stripe price IDs
 * 
 * Note: GBP prices will be created in Stripe when UK launch is enabled.
 * For now, we define the structure and use EUR as fallback.
 */

export type SupportedCurrency = 'EUR' | 'GBP' | 'USD';

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
    },
    pro: {
      EUR: 7900,
      GBP: 6900,
      USD: 7900,
    },
  },
  creditPacks: {
    credits_100: {
      EUR: 2500,
      GBP: 2200,
      USD: 2500,
    },
    credits_500: {
      EUR: 11000,
      GBP: 9500,
      USD: 11000,
    },
    credits_2000: {
      EUR: 40000,
      GBP: 35000,
      USD: 40000,
    },
    credits_5000: {
      EUR: 90000,
      GBP: 79000,
      USD: 90000,
    },
  },
} as const;

/**
 * Get currency config for a locale
 */
export function getCurrencyForLocale(locale: string): SupportedCurrency {
  const localeMap: Record<string, SupportedCurrency> = {
    'en-IE': 'EUR',
    'en-GB': 'GBP',
    'en-US': 'USD',
  };
  
  return localeMap[locale] || 'EUR';
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
 * Convert EUR price to GBP (approximate conversion)
 * Used only for display estimates when GBP prices aren't set
 */
export function estimateGBPPrice(eurCents: number): number {
  const exchangeRate = 0.86;
  return Math.round(eurCents * exchangeRate);
}
