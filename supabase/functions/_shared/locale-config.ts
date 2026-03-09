/**
 * Shared locale configuration for all edge functions.
 * Single source of truth — replaces inline getLocaleConfig() switch statements.
 */

export type MarketLocale = 'en-IE' | 'en-GB' | 'en-US' | 'en-CA' | 'en-AU' | 'en-NZ';
export type MarketCountry = 'IE' | 'GB' | 'US' | 'CA' | 'AU' | 'NZ';

export interface EdgeLocaleConfig {
  locale: MarketLocale;
  countryCode: MarketCountry;
  country: string;
  currency: { code: string; symbol: string; name: string; position: 'before' | 'after' };
  measurements: {
    area: 'sqm' | 'sqft';
    areaSymbol: string;
    areaLabel: string;
    land: string;
  };
  energyRating: {
    system: string;
    label: string;
    scale: string;
    required: boolean;
  };
  postalCode: { label: string; format: string; example: string };
  terminology: {
    apartment: string;
    terrace: string;
    groundFloor: string;
    firstFloor: string;
    estateAgent: string;
    solicitor: string;
    stampDuty: string;
  };
  spelling: 'british' | 'american';
  dateFormat: string;
  legalDisclaimer: string;
  locationExamples: { towns: string[]; priceExamples: string[] };
}

export const LOCALE_CONFIGS: Record<MarketLocale, EdgeLocaleConfig> = {
  'en-IE': {
    locale: 'en-IE',
    countryCode: 'IE',
    country: 'Ireland',
    currency: { code: 'EUR', symbol: '€', name: 'Euro', position: 'before' },
    measurements: { area: 'sqm', areaSymbol: 'm²', areaLabel: 'Square Metres', land: 'acres' },
    energyRating: { system: 'BER', label: 'BER Rating', scale: 'A1-G', required: true },
    postalCode: { label: 'Eircode', format: 'A65 F4E2', example: 'D02 RD28' },
    terminology: {
      apartment: 'apartment', terrace: 'terrace', groundFloor: 'ground floor',
      firstFloor: 'first floor', estateAgent: 'estate agent', solicitor: 'solicitor', stampDuty: 'stamp duty',
    },
    spelling: 'british',
    dateFormat: 'DD/MM/YYYY',
    legalDisclaimer: 'These particulars are issued by the selling agent on the understanding that all negotiations are conducted through them. While every care has been taken in preparing these particulars, the selling agent does not guarantee their accuracy.',
    locationExamples: { towns: ['Dublin', 'Cork', 'Galway', 'Limerick'], priceExamples: ['€275,000', '€450,000', '€1,200,000'] },
  },
  'en-GB': {
    locale: 'en-GB',
    countryCode: 'GB',
    country: 'United Kingdom',
    currency: { code: 'GBP', symbol: '£', name: 'Pound Sterling', position: 'before' },
    measurements: { area: 'sqm', areaSymbol: 'm²', areaLabel: 'Square Metres', land: 'acres' },
    energyRating: { system: 'EPC', label: 'EPC Rating', scale: 'A-G', required: true },
    postalCode: { label: 'Postcode', format: 'SW1A 1AA', example: 'EC1A 1BB' },
    terminology: {
      apartment: 'flat', terrace: 'terraced house', groundFloor: 'ground floor',
      firstFloor: 'first floor', estateAgent: 'estate agent', solicitor: 'solicitor', stampDuty: 'SDLT',
    },
    spelling: 'british',
    dateFormat: 'DD/MM/YYYY',
    legalDisclaimer: 'These particulars are set out as a general outline only for the guidance of intending purchasers and do not constitute any part of an offer or contract. The seller does not make or give, and neither the agent nor any person in their employment has any authority to make or give, any representation or warranty in relation to this property.',
    locationExamples: { towns: ['London', 'Manchester', 'Birmingham', 'Edinburgh'], priceExamples: ['£250,000', '£450,000', '£1,200,000'] },
  },
  'en-US': {
    locale: 'en-US',
    countryCode: 'US',
    country: 'United States',
    currency: { code: 'USD', symbol: '$', name: 'US Dollar', position: 'before' },
    measurements: { area: 'sqft', areaSymbol: 'sq ft', areaLabel: 'Square Feet', land: 'acres' },
    energyRating: { system: 'HERS', label: 'HERS Index', scale: '0-150+', required: false },
    postalCode: { label: 'ZIP Code', format: '10001', example: '90210' },
    terminology: {
      apartment: 'apartment', terrace: 'townhouse', groundFloor: 'first floor',
      firstFloor: 'second floor', estateAgent: 'real estate agent', solicitor: 'attorney', stampDuty: 'transfer tax',
    },
    spelling: 'american',
    dateFormat: 'MM/DD/YYYY',
    legalDisclaimer: 'The information provided is deemed reliable but not guaranteed. All measurements and square footage are approximate. Buyers should verify all information independently. This listing is subject to errors, omissions, and changes.',
    locationExamples: { towns: ['New York', 'Los Angeles', 'Chicago', 'Miami'], priceExamples: ['$350,000', '$750,000', '$1,500,000'] },
  },
  'en-CA': {
    locale: 'en-CA',
    countryCode: 'CA',
    country: 'Canada',
    currency: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', position: 'before' },
    measurements: { area: 'sqft', areaSymbol: 'sq ft', areaLabel: 'Square Feet', land: 'acres' },
    energyRating: { system: 'EnerGuide', label: 'EnerGuide Rating', scale: '0-100 GJ/year', required: false },
    postalCode: { label: 'Postal Code', format: 'K1A 0B1', example: 'M5V 2T6' },
    terminology: {
      apartment: 'condo', terrace: 'townhouse', groundFloor: 'main floor',
      firstFloor: 'second floor', estateAgent: 'real estate agent', solicitor: 'lawyer', stampDuty: 'land transfer tax',
    },
    spelling: 'british',
    dateFormat: 'DD/MM/YYYY',
    legalDisclaimer: 'The information contained herein has been provided by the listing brokerage and is believed to be reliable. The listing brokerage makes no representations as to the accuracy of the information.',
    locationExamples: { towns: ['Toronto', 'Vancouver', 'Montreal', 'Calgary'], priceExamples: ['C$500,000', 'C$850,000', 'C$1,800,000'] },
  },
  'en-AU': {
    locale: 'en-AU',
    countryCode: 'AU',
    country: 'Australia',
    currency: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', position: 'before' },
    measurements: { area: 'sqm', areaSymbol: 'm²', areaLabel: 'Square Metres', land: 'hectares' },
    energyRating: { system: 'NatHERS', label: 'NatHERS Rating', scale: '0-10 stars', required: false },
    postalCode: { label: 'Postcode', format: '2000', example: '3000' },
    terminology: {
      apartment: 'unit', terrace: 'terrace', groundFloor: 'ground floor',
      firstFloor: 'first floor', estateAgent: 'real estate agent', solicitor: 'solicitor', stampDuty: 'stamp duty',
    },
    spelling: 'british',
    dateFormat: 'DD/MM/YYYY',
    legalDisclaimer: 'All information contained herein is gathered from sources we consider to be reliable. However, we cannot guarantee or give any warranty about the information provided. Interested parties must solely rely on their own enquiries.',
    locationExamples: { towns: ['Sydney', 'Melbourne', 'Brisbane', 'Perth'], priceExamples: ['A$650,000', 'A$1,100,000', 'A$2,500,000'] },
  },
  'en-NZ': {
    locale: 'en-NZ',
    countryCode: 'NZ',
    country: 'New Zealand',
    currency: { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', position: 'before' },
    measurements: { area: 'sqm', areaSymbol: 'm²', areaLabel: 'Square Metres', land: 'hectares' },
    energyRating: { system: 'HER', label: 'Home Energy Rating', scale: '0-10 stars', required: false },
    postalCode: { label: 'Postcode', format: '6011', example: '1010' },
    terminology: {
      apartment: 'unit', terrace: 'terrace', groundFloor: 'ground floor',
      firstFloor: 'first floor', estateAgent: 'real estate agent', solicitor: 'solicitor', stampDuty: 'no transfer tax',
    },
    spelling: 'british',
    dateFormat: 'DD/MM/YYYY',
    legalDisclaimer: 'All information contained herein is gathered from sources we consider to be reliable. However, we cannot guarantee or give any warranty about the information provided.',
    locationExamples: { towns: ['Auckland', 'Wellington', 'Christchurch', 'Hamilton'], priceExamples: ['NZ$700,000', 'NZ$1,200,000', 'NZ$2,800,000'] },
  },
};

const COUNTRY_TO_LOCALE: Record<string, MarketLocale> = {
  IE: 'en-IE', GB: 'en-GB', US: 'en-US', CA: 'en-CA', AU: 'en-AU', NZ: 'en-NZ',
};

export function getEdgeLocaleConfig(locale: string): EdgeLocaleConfig {
  return LOCALE_CONFIGS[locale as MarketLocale] || LOCALE_CONFIGS['en-IE'];
}

export function countryToLocale(countryCode: string): MarketLocale {
  return COUNTRY_TO_LOCALE[countryCode] || 'en-IE';
}

export function formatEdgePrice(amount: number, config: EdgeLocaleConfig): string {
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatEdgeDate(date: Date, config: EdgeLocaleConfig): string {
  return date.toLocaleDateString(config.locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function getUnitsPromptSection(config: EdgeLocaleConfig): string {
  const lines = [
    `Measurements: Use ${config.measurements.areaLabel} (${config.measurements.areaSymbol}) for property sizes.`,
    `Land: Use ${config.measurements.land} for land areas.`,
    `Currency: Use ${config.currency.symbol} (${config.currency.code}).`,
    `Dates: Use ${config.dateFormat} format.`,
  ];
  if (config.energyRating.required) {
    lines.push(`Energy Rating: Use ${config.energyRating.system} (${config.energyRating.scale}).`);
  }
  return lines.join('\n');
}

export function getLocationExamplesPrompt(config: EdgeLocaleConfig): string {
  return `Example locations: ${config.locationExamples.towns.join(', ')}. Example prices: ${config.locationExamples.priceExamples.join(', ')}.`;
}

export function getTerminologyPrompt(config: EdgeLocaleConfig): string {
  const t = config.terminology;
  return [
    `Use "${t.apartment}" (not "flat" or "condo" unless that's the local term).`,
    `Use "${t.terrace}" for row houses.`,
    `Use "${t.groundFloor}" for the entry level.`,
    `Use "${t.estateAgent}" for the property professional.`,
    `Use "${t.solicitor}" for the legal professional.`,
    `Use ${config.spelling} English spelling.`,
  ].join('\n');
}
