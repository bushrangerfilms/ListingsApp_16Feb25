import type { MarketCountry, MarketLocale } from './markets';
import { COUNTRY_TO_LOCALE } from './markets';

const PATTERNS: Array<{ country: MarketCountry; regex: RegExp }> = [
  // Eircodes are unambiguous: routing key is one letter + two digits.
  { country: 'IE', regex: /\b[A-Z]\d{2}\s?[A-Z0-9]{4}\b/i },
  // Canadian postal: A1A 1A1 — letter/digit alternating, distinct from any other.
  { country: 'CA', regex: /\b[A-CEGHJ-NPR-TV-Z]\d[A-CEGHJ-NPR-TV-Z]\s?\d[A-CEGHJ-NPR-TV-Z]\d\b/i },
  // UK postcodes (incl. NI BT*) — must come before the looser US/AU/NZ digit-only patterns.
  { country: 'GB', regex: /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i },
  // US ZIP — 5 digits, optionally +4. Must run before AU/NZ (which match a bare 4-digit run).
  { country: 'US', regex: /\b\d{5}(?:-\d{4})?\b/ },
  // AU/NZ both use 4 digits. Default to AU; users in NZ can correct via the prompt.
  { country: 'AU', regex: /\b\d{4}\b/ },
];

export interface AddressLocaleHit {
  country: MarketCountry;
  locale: MarketLocale;
  currency: 'EUR' | 'GBP' | 'USD' | 'CAD' | 'AUD' | 'NZD';
  timezone: string;
}

const COUNTRY_DEFAULTS: Record<MarketCountry, Omit<AddressLocaleHit, 'country' | 'locale'>> = {
  IE: { currency: 'EUR', timezone: 'Europe/Dublin' },
  GB: { currency: 'GBP', timezone: 'Europe/London' },
  US: { currency: 'USD', timezone: 'America/New_York' },
  CA: { currency: 'CAD', timezone: 'America/Toronto' },
  AU: { currency: 'AUD', timezone: 'Australia/Sydney' },
  NZ: { currency: 'NZD', timezone: 'Pacific/Auckland' },
};

export function detectLocaleFromAddress(address: string | null | undefined): AddressLocaleHit | null {
  if (!address) return null;
  const cleaned = address.trim();
  if (cleaned.length < 3) return null;

  for (const { country, regex } of PATTERNS) {
    if (regex.test(cleaned)) {
      return {
        country,
        locale: COUNTRY_TO_LOCALE[country],
        ...COUNTRY_DEFAULTS[country],
      };
    }
  }
  return null;
}
