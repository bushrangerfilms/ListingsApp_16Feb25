/**
 * Seeds localStorage with geo-detected locale BEFORE React/i18n initialize.
 * Called synchronously from main.tsx. i18n reads localStorage('autolisting_locale')
 * first in its detection order, so this makes geo-detection apply app-wide.
 *
 * Priority: existing localStorage > sessionStorage cached country > timezone > async IP fetch
 * Org locale from DB overrides everything after login (via OrgLocaleSync in App.tsx).
 */

import { getCachedCountry, countryToLocale, getTimezoneLocale, fetchCountryFromIP } from './detectCountry';

const LOCALE_KEY = 'autolisting_locale';

export function seedLocaleFromGeo(): void {
  // If user/org already set a locale preference, respect it
  try {
    if (localStorage.getItem(LOCALE_KEY)) return;
  } catch {
    return; // localStorage unavailable
  }

  // Check sessionStorage for a previously fetched country
  const cachedCountry = getCachedCountry();
  if (cachedCountry) {
    const locale = countryToLocale(cachedCountry);
    if (locale) {
      try { localStorage.setItem(LOCALE_KEY, locale); } catch { /* ignore */ }
      return;
    }
  }

  // Synchronous timezone fallback — write immediately so i18n picks it up
  const tzLocale = getTimezoneLocale();
  if (tzLocale) {
    try { localStorage.setItem(LOCALE_KEY, tzLocale); } catch { /* ignore */ }
  }

  // Fire async IP lookup — if result differs from timezone, update for next page load
  fetchCountryFromIP().then((country) => {
    if (!country) return;
    const ipLocale = countryToLocale(country);
    if (!ipLocale) return;

    try {
      const current = localStorage.getItem(LOCALE_KEY);
      if (current !== ipLocale) {
        localStorage.setItem(LOCALE_KEY, ipLocale);
        // Locale changed after initial load — reload to apply cleanly
        // This only happens on first-ever visit when timezone guess was wrong
        window.location.reload();
      }
    } catch { /* ignore */ }
  });
}
