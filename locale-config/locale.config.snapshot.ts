/**
 * locale.config.snapshot.ts — Output-level snapshot test for all 6 markets.
 *
 * Where `locale.config.check.ts` verifies internal invariants (all entries
 * present, lookup tables consistent, regexes compile), this script is the
 * complementary "is the data correct?" check.  For each market it renders
 * the user-facing values that drive emails, brochures, and on-screen
 * formatting — currency, postcode label, energy rating system, regulatory
 * licence label, paper format, sample formatPrice / formatLocation output —
 * and asserts each one against a hard-coded expectation.
 *
 * If you intentionally change a canonical value (e.g. rename
 * "BER" → "BER Cert"), the failing assertions point you at the snapshot
 * lines that need updating.  If you change a value by accident (e.g.
 * typo'd currency symbol on a `git stash pop`), the same assertions catch
 * it before it ships.
 *
 * Run: `npx tsx locale-config/locale.config.snapshot.ts`.  Exits non-zero
 * on any mismatch.  Wired into `npm run locale:check` alongside the
 * exhaustiveness checker.
 */

import {
  LOCALE_CONFIGS, formatPrice, formatLocation, formatArea,
  type MarketLocale,
} from './locale.config';

interface Snapshot {
  locale: MarketLocale;
  countryCode: string;
  regionName: string;
  spelling: 'british' | 'american';
  paperFormat: 'A4' | 'Letter';
  currency: string;
  currencySymbol: string;
  areaSymbol: string;
  energyRatingSystem: string;
  energyRatingLabel: string;
  postalCodeLabel: string;
  countyLabel: string;
  countyPrefix: string;
  estateAgent: string;
  solicitor: string;
  licenceDisplayLabel: string;
  formatPrice450k: string;
  formatLocationSample: string;
  formatArea120: string;
}

function snapshot(locale: MarketLocale): Snapshot {
  const cfg = LOCALE_CONFIGS[locale];
  const sampleLoc = locale === 'en-IE'
    ? formatLocation({ town: 'Dublin', county: 'Dublin' }, cfg)
    : locale === 'en-GB'
    ? formatLocation({ town: 'London', county: 'Greater London' }, cfg)
    : locale === 'en-US'
    ? formatLocation({ town: 'Beverly Hills', state: 'CA' }, cfg)
    : locale === 'en-CA'
    ? formatLocation({ town: 'Toronto', state: 'ON' }, cfg)
    : locale === 'en-AU'
    ? formatLocation({ town: 'Sydney', state: 'NSW' }, cfg)
    : formatLocation({ town: 'Auckland', state: 'AKL' }, cfg);

  return {
    locale,
    countryCode: cfg.countryCode,
    regionName: cfg.regionName,
    spelling: cfg.spelling,
    paperFormat: cfg.paperFormat,
    currency: cfg.financial.currency,
    currencySymbol: cfg.financial.currencySymbol,
    areaSymbol: cfg.property.measurements.areaSymbol,
    energyRatingSystem: cfg.property.energyRatings.system,
    energyRatingLabel: cfg.property.energyRatings.label,
    postalCodeLabel: cfg.address.postalCodeLabel,
    countyLabel: cfg.address.countyLabel,
    countyPrefix: cfg.address.countyPrefix,
    estateAgent: cfg.legal.terminology.estateAgent,
    solicitor: cfg.legal.terminology.solicitor,
    licenceDisplayLabel: cfg.legal.regulatory.licenceDisplayLabel,
    formatPrice450k: formatPrice(450000, cfg),
    formatLocationSample: sampleLoc,
    formatArea120: formatArea(120, cfg),
  };
}

// ─── Expected snapshots (the hard contract) ─────────────────────────────────
const EXPECTED: Record<MarketLocale, Snapshot> = {
  'en-IE': {
    locale: 'en-IE', countryCode: 'IE', regionName: 'Ireland',
    spelling: 'british', paperFormat: 'A4',
    currency: 'EUR', currencySymbol: '€', areaSymbol: 'm²',
    energyRatingSystem: 'BER', energyRatingLabel: 'BER Rating',
    postalCodeLabel: 'Eircode', countyLabel: 'County', countyPrefix: 'Co. ',
    estateAgent: 'Estate Agent', solicitor: 'Solicitor',
    licenceDisplayLabel: 'PSRA Licence',
    formatPrice450k: '€450,000', formatLocationSample: 'Dublin, Co. Dublin',
    formatArea120: '120 m²',
  },
  'en-GB': {
    locale: 'en-GB', countryCode: 'GB', regionName: 'United Kingdom',
    spelling: 'british', paperFormat: 'A4',
    currency: 'GBP', currencySymbol: '£', areaSymbol: 'm²',
    energyRatingSystem: 'EPC', energyRatingLabel: 'EPC Rating',
    postalCodeLabel: 'Postcode', countyLabel: 'County', countyPrefix: '',
    estateAgent: 'Estate Agent', solicitor: 'Solicitor',
    licenceDisplayLabel: 'Propertymark No.',
    formatPrice450k: '£450,000', formatLocationSample: 'London, Greater London',
    formatArea120: '120 m²',
  },
  'en-US': {
    locale: 'en-US', countryCode: 'US', regionName: 'United States',
    spelling: 'american', paperFormat: 'Letter',
    currency: 'USD', currencySymbol: '$', areaSymbol: 'sq ft',
    energyRatingSystem: 'HERS', energyRatingLabel: 'HERS Index',
    postalCodeLabel: 'ZIP Code', countyLabel: 'County', countyPrefix: '',
    estateAgent: 'Real Estate Agent', solicitor: 'Attorney',
    licenceDisplayLabel: 'License No.',
    formatPrice450k: '$450,000', formatLocationSample: 'Beverly Hills, CA',
    formatArea120: '1,292 sq ft',
  },
  'en-CA': {
    // Note: Canadian English officially uses British spelling (Govt. of Canada style).
    locale: 'en-CA', countryCode: 'CA', regionName: 'Canada',
    spelling: 'british', paperFormat: 'Letter',
    currency: 'CAD', currencySymbol: 'C$', areaSymbol: 'sq ft',
    energyRatingSystem: 'EnerGuide', energyRatingLabel: 'EnerGuide Rating',
    postalCodeLabel: 'Postal Code', countyLabel: 'County', countyPrefix: '',
    estateAgent: 'Real Estate Agent', solicitor: 'Lawyer',
    licenceDisplayLabel: 'Reg. No.',
    formatPrice450k: 'C$450,000', formatLocationSample: 'Toronto, ON',
    formatArea120: '1,292 sq ft',
  },
  'en-AU': {
    locale: 'en-AU', countryCode: 'AU', regionName: 'Australia',
    spelling: 'british', paperFormat: 'A4',
    currency: 'AUD', currencySymbol: 'A$', areaSymbol: 'm²',
    energyRatingSystem: 'NatHERS', energyRatingLabel: 'NatHERS Rating',
    postalCodeLabel: 'Postcode', countyLabel: 'Suburb', countyPrefix: '',
    estateAgent: 'Real Estate Agent', solicitor: 'Solicitor',
    licenceDisplayLabel: 'Licence No.',
    formatPrice450k: 'A$450,000', formatLocationSample: 'Sydney, NSW',
    formatArea120: '120 m²',
  },
  'en-NZ': {
    locale: 'en-NZ', countryCode: 'NZ', regionName: 'New Zealand',
    spelling: 'british', paperFormat: 'A4',
    currency: 'NZD', currencySymbol: 'NZ$', areaSymbol: 'm²',
    energyRatingSystem: 'HER', energyRatingLabel: 'Home Energy Rating',
    postalCodeLabel: 'Postcode', countyLabel: 'Suburb', countyPrefix: '',
    estateAgent: 'Real Estate Agent', solicitor: 'Solicitor',
    licenceDisplayLabel: 'REA Licence',
    formatPrice450k: 'NZ$450,000', formatLocationSample: 'Auckland, AKL',
    formatArea120: '120 m²',
  },
};

const ALL_LOCALES: MarketLocale[] = ['en-IE', 'en-GB', 'en-US', 'en-CA', 'en-AU', 'en-NZ'];
const failures: string[] = [];

for (const locale of ALL_LOCALES) {
  const got = snapshot(locale);
  const want = EXPECTED[locale];
  for (const key of Object.keys(want) as (keyof Snapshot)[]) {
    if (got[key] !== want[key]) {
      failures.push(`${locale}.${key}: got ${JSON.stringify(got[key])}, want ${JSON.stringify(want[key])}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`❌ locale snapshot mismatch — ${failures.length} value(s):`);
  for (const f of failures) console.error(`  ${f}`);
  console.error('');
  console.error('If the change is intentional, update EXPECTED in locale.config.snapshot.ts.');
  console.error('If unintentional, the canonical config has drifted — check the latest commit.');
  process.exit(1);
}

console.log(`✅ locale snapshot: all ${ALL_LOCALES.length} markets match expected output.`);
