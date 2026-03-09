/**
 * Shared market locale type system — single source of truth for all locale/currency/country
 * definitions across the app. Used by i18n, billing, regionConfig, and edge functions.
 */

export const MARKET_LOCALES = ['en-IE', 'en-GB', 'en-US', 'en-CA', 'en-AU', 'en-NZ'] as const;
export type MarketLocale = typeof MARKET_LOCALES[number];

export const MARKET_COUNTRIES = ['IE', 'GB', 'US', 'CA', 'AU', 'NZ'] as const;
export type MarketCountry = typeof MARKET_COUNTRIES[number];

export const MARKET_CURRENCIES = ['EUR', 'GBP', 'USD', 'CAD', 'AUD', 'NZD'] as const;
export type MarketCurrency = typeof MARKET_CURRENCIES[number];

export const LOCALE_TO_COUNTRY: Record<MarketLocale, MarketCountry> = {
  'en-IE': 'IE',
  'en-GB': 'GB',
  'en-US': 'US',
  'en-CA': 'CA',
  'en-AU': 'AU',
  'en-NZ': 'NZ',
};

export const LOCALE_TO_CURRENCY: Record<MarketLocale, MarketCurrency> = {
  'en-IE': 'EUR',
  'en-GB': 'GBP',
  'en-US': 'USD',
  'en-CA': 'CAD',
  'en-AU': 'AUD',
  'en-NZ': 'NZD',
};

export const COUNTRY_TO_LOCALE: Record<MarketCountry, MarketLocale> = {
  IE: 'en-IE',
  GB: 'en-GB',
  US: 'en-US',
  CA: 'en-CA',
  AU: 'en-AU',
  NZ: 'en-NZ',
};

export const LOCALE_NAMES: Record<MarketLocale, string> = {
  'en-IE': 'English (Ireland)',
  'en-GB': 'English (UK)',
  'en-US': 'English (US)',
  'en-CA': 'English (Canada)',
  'en-AU': 'English (Australia)',
  'en-NZ': 'English (New Zealand)',
};

export function isMarketLocale(v: string): v is MarketLocale {
  return (MARKET_LOCALES as readonly string[]).includes(v);
}

export function isMarketCountry(v: string): v is MarketCountry {
  return (MARKET_COUNTRIES as readonly string[]).includes(v);
}

export function isMarketCurrency(v: string): v is MarketCurrency {
  return (MARKET_CURRENCIES as readonly string[]).includes(v);
}
