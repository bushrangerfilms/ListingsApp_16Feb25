/**
 * locale.config.check.ts — Exhaustiveness + invariant checks for the canonical
 * locale config.  Run via `npx tsx locale-config/locale.config.check.ts`.
 *
 * Pure logic, zero external deps — runnable in any environment that can run
 * tsx (CI, pre-commit, local dev).  Exits non-zero on any failure.
 *
 * What it verifies:
 *   1. Every market in `MarketLocale` has a `LOCALE_CONFIGS` entry.
 *   2. Every entry's `locale` and `countryCode` self-match.
 *   3. The currency-by-locale lookup matches the financial.currency in each entry.
 *   4. Every postcode pattern compiles to a valid RegExp.
 *   5. Every licence pattern (if set) compiles.
 *   6. `formatPrice`, `formatLocation`, `formatArea` produce expected idioms
 *      for each market.
 *   7. `resolveLocaleFromOrg` handles all reasonable inputs deterministically.
 */

import {
  LOCALE_CONFIGS, COUNTRY_TO_LOCALE, LOCALE_TO_COUNTRY, LOCALE_TO_CURRENCY,
  DEFAULT_LOCALE, getRegionConfig, countryToLocale, resolveLocaleFromOrg,
  formatPrice, formatLocation, formatArea, postalCodeRegex, licenceRegex,
  type MarketLocale, type MarketCountry, type MarketCurrency,
} from './locale.config';

const ALL_LOCALES: MarketLocale[] = ['en-IE', 'en-GB', 'en-US', 'en-CA', 'en-AU', 'en-NZ'];
const ALL_COUNTRIES: MarketCountry[] = ['IE', 'GB', 'US', 'CA', 'AU', 'NZ'];
const ALL_CURRENCIES: MarketCurrency[] = ['EUR', 'GBP', 'USD', 'CAD', 'AUD', 'NZD'];

const failures: string[] = [];
function check(condition: boolean, message: string) {
  if (!condition) failures.push(message);
}
function eq<T>(got: T, want: T, label: string) {
  if (got !== want) failures.push(`${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

// 1. Every locale present in the config map.
for (const locale of ALL_LOCALES) {
  check(locale in LOCALE_CONFIGS, `LOCALE_CONFIGS missing entry for ${locale}`);
}

// 2. Every entry self-consistent + lookup tables agree.
for (const locale of ALL_LOCALES) {
  const cfg = LOCALE_CONFIGS[locale];
  eq(cfg.locale, locale, `LOCALE_CONFIGS[${locale}].locale`);
  eq(LOCALE_TO_COUNTRY[locale], cfg.countryCode, `LOCALE_TO_COUNTRY[${locale}]`);
  eq(COUNTRY_TO_LOCALE[cfg.countryCode], locale, `COUNTRY_TO_LOCALE[${cfg.countryCode}]`);
  eq(LOCALE_TO_CURRENCY[locale], cfg.financial.currency, `LOCALE_TO_CURRENCY[${locale}]`);
}

// 3. All countries / currencies covered.
for (const country of ALL_COUNTRIES) {
  check(country in COUNTRY_TO_LOCALE, `COUNTRY_TO_LOCALE missing ${country}`);
}
for (const currency of ALL_CURRENCIES) {
  check(
    Object.values(LOCALE_TO_CURRENCY).includes(currency),
    `LOCALE_TO_CURRENCY missing currency ${currency}`,
  );
}

// 4. Postcode and licence regexes compile.
for (const locale of ALL_LOCALES) {
  const cfg = LOCALE_CONFIGS[locale];
  try {
    postalCodeRegex(cfg);
  } catch (e) {
    failures.push(`postalCodeRegex(${locale}) failed: ${(e as Error).message}`);
  }
  try {
    licenceRegex(cfg); // returns null if not set, otherwise compiles
  } catch (e) {
    failures.push(`licenceRegex(${locale}) failed: ${(e as Error).message}`);
  }
}

// 5. Formatting smoke tests — each locale produces locale-idiomatic output.
const SMOKE: Record<MarketLocale, { priceContains: string; locationContains: string; locationLacks?: string }> = {
  'en-IE': { priceContains: '€', locationContains: 'Co. Galway' },
  'en-GB': { priceContains: '£', locationContains: 'Surrey', locationLacks: 'Co.' },
  'en-US': { priceContains: '$', locationContains: 'California', locationLacks: 'Co.' },
  'en-CA': { priceContains: 'C$', locationContains: 'Ontario', locationLacks: 'Co.' },
  'en-AU': { priceContains: 'A$', locationContains: 'NSW', locationLacks: 'Co.' },
  'en-NZ': { priceContains: 'NZ$', locationContains: 'Auckland', locationLacks: 'Co.' },
};

for (const [locale, expect] of Object.entries(SMOKE) as Array<[MarketLocale, typeof SMOKE['en-IE']]>) {
  const cfg = LOCALE_CONFIGS[locale];
  const price = formatPrice(450000, cfg);
  check(
    price.includes(expect.priceContains),
    `formatPrice(450000, ${locale}) = "${price}" should contain "${expect.priceContains}"`,
  );

  const fakeRegion = locale === 'en-IE' ? { county: 'Galway' }
                   : locale === 'en-GB' ? { county: 'Surrey' }
                   : locale === 'en-US' ? { state: 'California' }
                   : locale === 'en-CA' ? { state: 'Ontario' }
                   : locale === 'en-AU' ? { state: 'NSW' }
                   : { state: 'Auckland' };
  const town = locale === 'en-IE' ? 'Dublin' : 'Town';
  const loc = formatLocation({ town, ...fakeRegion }, cfg);
  check(
    loc.includes(expect.locationContains),
    `formatLocation(${locale}) = "${loc}" should contain "${expect.locationContains}"`,
  );
  if (expect.locationLacks) {
    check(
      !loc.includes(expect.locationLacks),
      `formatLocation(${locale}) = "${loc}" should NOT contain "${expect.locationLacks}"`,
    );
  }

  const area = formatArea(120, cfg);
  const expectedSymbol = cfg.property.measurements.areaSymbol;
  check(area.includes(expectedSymbol), `formatArea(120, ${locale}) = "${area}" should contain "${expectedSymbol}"`);
}

// 6. resolveLocaleFromOrg robustness.
eq(resolveLocaleFromOrg(null).locale, DEFAULT_LOCALE, 'resolveLocaleFromOrg(null)');
eq(resolveLocaleFromOrg(undefined).locale, DEFAULT_LOCALE, 'resolveLocaleFromOrg(undefined)');
eq(resolveLocaleFromOrg({}).locale, DEFAULT_LOCALE, 'resolveLocaleFromOrg({})');
eq(resolveLocaleFromOrg({ country_code: 'US' }).locale, 'en-US', 'resolveLocaleFromOrg(country=US)');
eq(resolveLocaleFromOrg({ country_code: 'us' }).locale, 'en-US', 'resolveLocaleFromOrg(country=us — case)');
eq(resolveLocaleFromOrg({ locale: 'en-NZ' }).locale, 'en-NZ', 'resolveLocaleFromOrg(locale=en-NZ)');
eq(
  resolveLocaleFromOrg({ country_code: 'US', locale: 'en-GB' }).locale,
  'en-GB',
  'resolveLocaleFromOrg: locale wins over country_code',
);
eq(
  resolveLocaleFromOrg({ country_code: 'XX', locale: undefined }).locale,
  DEFAULT_LOCALE,
  'resolveLocaleFromOrg: unknown country falls back to default',
);

// 7. countryToLocale + getRegionConfig fallback paths.
eq(countryToLocale(null).valueOf(), DEFAULT_LOCALE, 'countryToLocale(null)');
eq(countryToLocale('XX').valueOf(), DEFAULT_LOCALE, 'countryToLocale(XX)');
eq(getRegionConfig('not-a-locale').locale, DEFAULT_LOCALE, 'getRegionConfig(unknown)');

// 8. Specific spot-checks for known-correct values.
eq(LOCALE_CONFIGS['en-US'].financial.tax.vatRate, 0, 'US vatRate');
eq(LOCALE_CONFIGS['en-IE'].financial.tax.vatRate, 0.23, 'IE vatRate');
eq(LOCALE_CONFIGS['en-GB'].financial.tax.vatRate, 0.20, 'GB vatRate');
eq(LOCALE_CONFIGS['en-IE'].address.countyPrefix, 'Co. ', 'IE countyPrefix');
eq(LOCALE_CONFIGS['en-US'].address.countyPrefix, '', 'US countyPrefix');
eq(LOCALE_CONFIGS['en-US'].dateTime.firstDayOfWeek, 0, 'US firstDayOfWeek');
eq(LOCALE_CONFIGS['en-IE'].dateTime.firstDayOfWeek, 1, 'IE firstDayOfWeek');

// ────────────────────────────────────────────────────────────────────────────
// Result
// ────────────────────────────────────────────────────────────────────────────

if (failures.length > 0) {
  console.error(`❌ ${failures.length} locale-config check(s) failed:\n`);
  for (const msg of failures) console.error(`  • ${msg}`);
  process.exit(1);
}

console.log(`✅ locale.config.ts: all ${ALL_LOCALES.length} markets exhaustive and self-consistent.`);
