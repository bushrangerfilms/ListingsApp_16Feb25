/**
 * Custom i18next-browser-languagedetector plugin that detects locale from IANA timezone.
 * More reliable than navigator.language since most users don't change their OS timezone,
 * but many have en-US as their default browser language regardless of country.
 */

import type { MarketLocale } from '@/lib/locale/markets';

const TIMEZONE_TO_LOCALE: Record<string, MarketLocale> = {
  // Ireland
  'Europe/Dublin': 'en-IE',

  // United Kingdom
  'Europe/London': 'en-GB',
  'Europe/Belfast': 'en-GB',

  // United States
  'America/New_York': 'en-US',
  'America/Chicago': 'en-US',
  'America/Denver': 'en-US',
  'America/Los_Angeles': 'en-US',
  'America/Phoenix': 'en-US',
  'America/Anchorage': 'en-US',
  'Pacific/Honolulu': 'en-US',
  'America/Boise': 'en-US',
  'America/Indiana/Indianapolis': 'en-US',
  'America/Detroit': 'en-US',

  // Canada
  'America/Toronto': 'en-CA',
  'America/Vancouver': 'en-CA',
  'America/Edmonton': 'en-CA',
  'America/Winnipeg': 'en-CA',
  'America/Halifax': 'en-CA',
  'America/St_Johns': 'en-CA',
  'America/Regina': 'en-CA',

  // Australia
  'Australia/Sydney': 'en-AU',
  'Australia/Melbourne': 'en-AU',
  'Australia/Brisbane': 'en-AU',
  'Australia/Perth': 'en-AU',
  'Australia/Adelaide': 'en-AU',
  'Australia/Hobart': 'en-AU',
  'Australia/Darwin': 'en-AU',
  'Australia/Lord_Howe': 'en-AU',

  // New Zealand
  'Pacific/Auckland': 'en-NZ',
  'Pacific/Chatham': 'en-NZ',
};

/**
 * Custom detector for i18next-browser-languagedetector.
 * Register via: LanguageDetector.addDetector(timezoneDetector)
 * Then include 'timezone' in the detection order.
 */
export const timezoneDetector = {
  name: 'timezone',

  lookup(): string | undefined {
    if (typeof Intl === 'undefined') return undefined;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return TIMEZONE_TO_LOCALE[tz];
    } catch {
      return undefined;
    }
  },

  cacheUserLanguage(): void {
    // No-op — timezone is a read-only signal, not a user preference to cache
  },
};
