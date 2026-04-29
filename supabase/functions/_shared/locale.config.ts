// ⚠️  AUTO-GENERATED FROM /locale-config/locale.config.ts — DO NOT EDIT.
// Edit the canonical file at locale-config/locale.config.ts in the Listings
// repo, then run `npx tsx locale-config/sync.ts` to regenerate every mirror.
// Drift between mirrors is detected at CI time via the SHA below — a mirror
// is in-sync iff sha256(content-after-banner) === canonical-sha256.
// canonical-sha256: 6a722901689faa73ef7560517d2dafde38ac9bebc14ea419ccfdc8f75ca6a346

/**
 * locale.config.ts — CANONICAL SOURCE OF TRUTH FOR ALL LOCALE-SPECIFIC BEHAVIOUR.
 *
 * This file is the single, hand-edited source for every locale-keyed value used
 * across both the Listings and Socials apps (frontend, server, edge functions).
 *
 * ⚠️  Do NOT edit copies of this file in any other path — they are mechanically
 *     mirrored from this one by `locale-config/sync.ts`.  See README.md.
 *
 * Adding a new market:
 *   1. Extend `MarketLocale`, `MarketCountry`, `MarketCurrency`.  TypeScript will
 *      then error in every config map until you fill in values for the new market.
 *   2. Add the new entry to `LOCALE_CONFIGS`.  Running `locale.config.check.ts`
 *      will refuse to pass until every required field is present.
 *   3. Run `npx tsx locale-config/sync.ts` to regenerate the mirror files.
 *
 * Removing a field, renaming a field, changing a shape:
 *   1. Edit the `RegionConfig` interface and the six entries in `LOCALE_CONFIGS`.
 *   2. Run `locale.config.check.ts` to verify exhaustiveness.
 *   3. Run `sync.ts` to regenerate mirrors.
 *   4. Update consumers in Listings/Socials in a follow-up commit.
 */

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type MarketLocale = 'en-IE' | 'en-GB' | 'en-US' | 'en-CA' | 'en-AU' | 'en-NZ';
export type MarketCountry = 'IE' | 'GB' | 'US' | 'CA' | 'AU' | 'NZ';
export type MarketCurrency = 'EUR' | 'GBP' | 'USD' | 'CAD' | 'AUD' | 'NZD';

export interface EnergyRating {
  code: string;
  label: string;
  description?: string;
}

export interface EnergyRatingsConfig {
  /** Whether the energy-rating field should be shown in listing forms. */
  enabled: boolean;
  /** Human label for the field (e.g. "BER Rating", "EPC Rating", "HERS Index"). */
  label: string;
  /**
   * Short code for the energy-rating system, suitable for compact UI like
   * brochure badges. e.g. "BER", "EPC", "HERS", "EnerGuide", "NatHERS", "HER".
   */
  system: string;
  /** Whether the field is required at validation time. */
  required: boolean;
  /** The full set of ratings users can pick from. */
  ratings: EnergyRating[];
}

export interface MeasurementsConfig {
  /** Internal storage unit for floor area in this region. */
  areaUnit: 'sqm' | 'sqft';
  /** Display label (e.g. "Square Metres"). */
  areaLabel: string;
  /** Display symbol (e.g. "m²", "sq ft"). */
  areaSymbol: string;
  /** Multiplier when reading a stored sqm value into the user's display unit. */
  sqmDisplayMultiplier: number;
  /** Land unit (acres or hectares). */
  landUnit: 'acres' | 'hectares';
  /** Land display label. */
  landLabel: string;
  /** Land display symbol. */
  landSymbol: string;
  /** Multiplier when reading a stored acres value into the user's display unit. */
  acresDisplayMultiplier: number;
}

export interface BuildingType {
  /** Stable code stored in the DB (DO NOT change codes lightly — they're persisted). */
  code: string;
  /** Locale-appropriate display label. */
  label: string;
}

export interface AddressConfig {
  postalCodeLabel: string;
  postalCodePlaceholder: string;
  /** Source pattern (string, not RegExp, so the canonical file stays JSON-safe). */
  postalCodePatternSource: string;
  postalCodePatternFlags: string;
  postalCodeFormat: string;
  countyLabel: string;
  countyRequired: boolean;
  /**
   * Optional prefix prepended to county/state when rendering a location line.
   * IE uses "Co. ", everywhere else is empty.  Used by `formatLocation()`.
   */
  countyPrefix: string;
  /** Optional state/province/region picker. */
  stateLabel?: string;
  stateRequired?: boolean;
  states?: ReadonlyArray<{ code: string; name: string }>;
}

export interface TaxConfig {
  /** Decimal rate (0.20 = 20%).  0 if not applicable. */
  vatRate: number;
  /** Display label (e.g. "VAT", "GST", "Sales Tax"). */
  vatLabel: string;
  /** Whether tax fields should be shown in forms. */
  vatEnabled: boolean;
  /** Optional label for property transfer tax (e.g. "Stamp Duty", "Transfer Tax"). */
  stampDutyLabel?: string;
}

export interface FinancialConfig {
  currency: MarketCurrency;
  currencySymbol: string;
  currencyPosition: 'before' | 'after';
  thousandsSeparator: string;
  decimalSeparator: string;
  tax: TaxConfig;
}

export interface DateTimeConfig {
  /** Display format using Unix-style placeholders (DD/MM/YYYY, MM/DD/YYYY etc.). */
  dateFormat: string;
  timeFormat: '12h' | '24h';
  /** 0 = Sunday, 1 = Monday. */
  firstDayOfWeek: 0 | 1;
  /** IANA timezone (e.g. "Europe/Dublin"). */
  defaultTimezone: string;
}

export interface LegalTerminology {
  /** Property professional handling sales (Estate Agent / Real Estate Agent). */
  estateAgent: string;
  /** Listing-side professional. */
  listingAgent: string;
  /** Buyer-side professional. */
  buyersAgent: string;
  /** Legal professional handling property transactions. */
  solicitor: string;
  /** Process of legal title transfer. */
  conveyancing: string;
  /** Property transfer tax (locale-appropriate name). */
  stampDuty: string;
  freehold: string;
  leasehold: string;
  /** What a multi-unit residential property is called. */
  apartment: string;
  /** What a row house is called. */
  terrace: string;
  /** What the entry-level floor is called. */
  groundFloor: string;
  /** What the floor above the entry level is called. */
  firstFloor: string;
}

export interface ComplianceConfig {
  gdprEnabled: boolean;
  ccpaEnabled: boolean;
  amlRequired: boolean;
  fairHousingRequired: boolean;
  dataRetentionDays: number;
}

export interface RegulatoryConfig {
  /** Whether agents are required to display a licence/registration number. */
  licenceRequired: boolean;
  /** Short regulatory body name (e.g. "PSRA", "Propertymark"). */
  regulatoryBody: string;
  /** Full regulatory body name. */
  regulatoryBodyFull: string;
  /** Form-field label (e.g. "PSR Licence Number"). */
  licenceFieldLabel: string;
  /** Compact display label (e.g. "PSRA Licence", "License No."). */
  licenceDisplayLabel: string;
  /** Placeholder example for the form field. */
  licencePlaceholder: string;
  /** Optional regex pattern source for format validation. */
  licencePatternSource?: string;
  licencePatternFlags?: string;
  /** Note shown below the field. */
  licenceNote?: string;
  /** Phone number format placeholder. */
  phonePlaceholder: string;
}

export interface LegalConfig {
  terminology: LegalTerminology;
  compliance: ComplianceConfig;
  regulatory: RegulatoryConfig;
}

export interface PropertyConfig {
  energyRatings: EnergyRatingsConfig;
  measurements: MeasurementsConfig;
  buildingTypes: ReadonlyArray<BuildingType>;
  /**
   * 0 = "ground floor / first floor / second floor" (IE/UK/AU/NZ).
   * 1 = "first floor / second floor / third floor" (US/CA).
   */
  floorNumberingOffset: 0 | 1;
}

export interface AiPromptHints {
  /** Country name for AI prompts (e.g. "Ireland", "United States"). */
  countryName: string;
  /** Locale-appropriate legal disclaimer for property listings. */
  legalDisclaimer: string;
  /** Example towns and prices for AI prompt few-shot examples. */
  locationExamples: {
    towns: ReadonlyArray<string>;
    priceExamples: ReadonlyArray<string>;
  };
}

export interface RegionConfig {
  locale: MarketLocale;
  countryCode: MarketCountry;
  regionName: string;
  /** Spelling convention used in user-facing copy. */
  spelling: 'british' | 'american';
  /**
   * Default paper format used for printable artefacts (brochures, valuation
   * letters).  IE / GB / AU / NZ default to A4; US / CA default to Letter.
   * Templates that need exact dimensions key off this value rather than
   * branching on locale ids.
   */
  paperFormat: 'A4' | 'Letter';
  property: PropertyConfig;
  address: AddressConfig;
  financial: FinancialConfig;
  dateTime: DateTimeConfig;
  legal: LegalConfig;
  aiPromptHints: AiPromptHints;
}

// ────────────────────────────────────────────────────────────────────────────
// State / province / region tables
// ────────────────────────────────────────────────────────────────────────────

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'District of Columbia' },
] as const;

const CA_PROVINCES = [
  { code: 'AB', name: 'Alberta' }, { code: 'BC', name: 'British Columbia' }, { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' }, { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' }, { code: 'NT', name: 'Northwest Territories' }, { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' }, { code: 'PE', name: 'Prince Edward Island' }, { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' }, { code: 'YT', name: 'Yukon' },
] as const;

const AU_STATES = [
  { code: 'NSW', name: 'New South Wales' }, { code: 'VIC', name: 'Victoria' }, { code: 'QLD', name: 'Queensland' },
  { code: 'WA', name: 'Western Australia' }, { code: 'SA', name: 'South Australia' }, { code: 'TAS', name: 'Tasmania' },
  { code: 'ACT', name: 'Australian Capital Territory' }, { code: 'NT', name: 'Northern Territory' },
] as const;

const NZ_REGIONS = [
  { code: 'AUK', name: 'Auckland' }, { code: 'BOP', name: 'Bay of Plenty' }, { code: 'CAN', name: 'Canterbury' },
  { code: 'GIS', name: 'Gisborne' }, { code: 'HKB', name: "Hawke's Bay" }, { code: 'MWT', name: 'Manawatu-Wanganui' },
  { code: 'MBH', name: 'Marlborough' }, { code: 'NSN', name: 'Nelson' }, { code: 'NTL', name: 'Northland' },
  { code: 'OTA', name: 'Otago' }, { code: 'STL', name: 'Southland' }, { code: 'TKI', name: 'Taranaki' },
  { code: 'TAS', name: 'Tasman' }, { code: 'WKO', name: 'Waikato' }, { code: 'WGN', name: 'Wellington' },
  { code: 'WTC', name: 'West Coast' },
] as const;

// ────────────────────────────────────────────────────────────────────────────
// Canonical config map  —  Record<MarketLocale, RegionConfig> enforces
// exhaustiveness at compile time.  Adding a new locale to the union above
// turns this into a compile error until the new entry is added below.
// ────────────────────────────────────────────────────────────────────────────

export const LOCALE_CONFIGS: Record<MarketLocale, RegionConfig> = {
  'en-IE': {
    locale: 'en-IE',
    countryCode: 'IE',
    regionName: 'Ireland',
    spelling: 'british',
    paperFormat: 'A4',
    property: {
      energyRatings: {
        enabled: true, label: 'BER Rating', system: 'BER', required: true,
        ratings: [
          { code: 'A1', label: 'A1', description: 'Most energy efficient' },
          { code: 'A2', label: 'A2' }, { code: 'A3', label: 'A3' },
          { code: 'B1', label: 'B1' }, { code: 'B2', label: 'B2' }, { code: 'B3', label: 'B3' },
          { code: 'C1', label: 'C1' }, { code: 'C2', label: 'C2' }, { code: 'C3', label: 'C3' },
          { code: 'D1', label: 'D1' }, { code: 'D2', label: 'D2' },
          { code: 'E1', label: 'E1' }, { code: 'E2', label: 'E2' },
          { code: 'F', label: 'F' },
          { code: 'G', label: 'G', description: 'Least energy efficient' },
          { code: 'EXEMPT', label: 'Exempt' },
        ],
      },
      measurements: {
        areaUnit: 'sqm', areaLabel: 'Square Metres', areaSymbol: 'm²', sqmDisplayMultiplier: 1,
        landUnit: 'acres', landLabel: 'Acres', landSymbol: 'acres', acresDisplayMultiplier: 1,
      },
      buildingTypes: [
        { code: 'Detached', label: 'Detached' },
        { code: 'Semi-Detached', label: 'Semi-Detached' },
        { code: 'Terrace', label: 'Terrace' },
        { code: 'Apartment', label: 'Apartment' },
        { code: 'Commercial', label: 'Commercial' },
        { code: 'Land', label: 'Land' },
      ],
      floorNumberingOffset: 0,
    },
    address: {
      postalCodeLabel: 'Eircode', postalCodePlaceholder: 'A65 F4E2',
      postalCodePatternSource: '^[A-Z]\\d{2}\\s?[A-Z0-9]{4}$', postalCodePatternFlags: 'i',
      postalCodeFormat: 'A65 F4E2',
      countyLabel: 'County', countyRequired: true,
      countyPrefix: 'Co. ',
    },
    financial: {
      currency: 'EUR', currencySymbol: '€', currencyPosition: 'before',
      thousandsSeparator: ',', decimalSeparator: '.',
      tax: { vatRate: 0.23, vatLabel: 'VAT', vatEnabled: true, stampDutyLabel: 'Stamp Duty' },
    },
    dateTime: { dateFormat: 'DD/MM/YYYY', timeFormat: '24h', firstDayOfWeek: 1, defaultTimezone: 'Europe/Dublin' },
    legal: {
      terminology: {
        estateAgent: 'Estate Agent', listingAgent: 'Estate Agent', buyersAgent: "Buyer's Agent",
        solicitor: 'Solicitor', conveyancing: 'Conveyancing', stampDuty: 'Stamp Duty',
        freehold: 'Freehold', leasehold: 'Leasehold',
        apartment: 'apartment', terrace: 'terrace', groundFloor: 'ground floor', firstFloor: 'first floor',
      },
      compliance: { gdprEnabled: true, ccpaEnabled: false, amlRequired: true, fairHousingRequired: false, dataRetentionDays: 2555 },
      regulatory: {
        licenceRequired: true, regulatoryBody: 'PSRA', regulatoryBodyFull: 'Property Services Regulatory Authority',
        licenceFieldLabel: 'PSR Licence Number', licenceDisplayLabel: 'PSRA Licence',
        licencePlaceholder: '002179', licencePatternSource: '^\\d{6}$',
        licenceNote: 'Required by PSRA for all property service providers in Ireland',
        phonePlaceholder: '+353 1 234 5678',
      },
    },
    aiPromptHints: {
      countryName: 'Ireland',
      legalDisclaimer: 'These particulars are issued by the selling agent on the understanding that all negotiations are conducted through them. While every care has been taken in preparing these particulars, the selling agent does not guarantee their accuracy.',
      locationExamples: { towns: ['Dublin', 'Cork', 'Galway', 'Limerick'], priceExamples: ['€275,000', '€450,000', '€1,200,000'] },
    },
  },

  'en-GB': {
    locale: 'en-GB',
    countryCode: 'GB',
    regionName: 'United Kingdom',
    spelling: 'british',
    paperFormat: 'A4',
    property: {
      energyRatings: {
        enabled: true, label: 'EPC Rating', system: 'EPC', required: true,
        ratings: [
          { code: 'A', label: 'A', description: 'Most energy efficient (92-100)' },
          { code: 'B', label: 'B', description: '81-91' }, { code: 'C', label: 'C', description: '69-80' },
          { code: 'D', label: 'D', description: '55-68' }, { code: 'E', label: 'E', description: '39-54' },
          { code: 'F', label: 'F', description: '21-38' },
          { code: 'G', label: 'G', description: 'Least energy efficient (1-20)' },
          { code: 'EXEMPT', label: 'Exempt' },
        ],
      },
      measurements: {
        areaUnit: 'sqm', areaLabel: 'Square Metres', areaSymbol: 'm²', sqmDisplayMultiplier: 1,
        landUnit: 'acres', landLabel: 'Acres', landSymbol: 'acres', acresDisplayMultiplier: 1,
      },
      buildingTypes: [
        { code: 'Detached', label: 'Detached' },
        { code: 'Semi-Detached', label: 'Semi-Detached' },
        { code: 'Terraced', label: 'Terraced' },
        { code: 'End of Terrace', label: 'End of Terrace' },
        { code: 'Flat', label: 'Flat' },
        { code: 'Maisonette', label: 'Maisonette' },
        { code: 'Bungalow', label: 'Bungalow' },
        { code: 'Cottage', label: 'Cottage' },
        { code: 'Town House', label: 'Town House' },
        { code: 'Studio', label: 'Studio' },
        { code: 'Commercial', label: 'Commercial' },
        { code: 'Land', label: 'Land' },
      ],
      floorNumberingOffset: 0,
    },
    address: {
      postalCodeLabel: 'Postcode', postalCodePlaceholder: 'SW1A 1AA',
      postalCodePatternSource: '^[A-Z]{1,2}\\d[A-Z\\d]?\\s?\\d[A-Z]{2}$', postalCodePatternFlags: 'i',
      postalCodeFormat: 'SW1A 1AA',
      countyLabel: 'County', countyRequired: false, countyPrefix: '',
    },
    financial: {
      currency: 'GBP', currencySymbol: '£', currencyPosition: 'before',
      thousandsSeparator: ',', decimalSeparator: '.',
      tax: { vatRate: 0.20, vatLabel: 'VAT', vatEnabled: true, stampDutyLabel: 'Stamp Duty Land Tax' },
    },
    dateTime: { dateFormat: 'DD/MM/YYYY', timeFormat: '24h', firstDayOfWeek: 1, defaultTimezone: 'Europe/London' },
    legal: {
      terminology: {
        estateAgent: 'Estate Agent', listingAgent: 'Estate Agent', buyersAgent: "Buyer's Agent",
        solicitor: 'Solicitor', conveyancing: 'Conveyancing', stampDuty: 'Stamp Duty Land Tax',
        freehold: 'Freehold', leasehold: 'Leasehold',
        apartment: 'flat', terrace: 'terraced house', groundFloor: 'ground floor', firstFloor: 'first floor',
      },
      compliance: { gdprEnabled: true, ccpaEnabled: false, amlRequired: true, fairHousingRequired: false, dataRetentionDays: 2555 },
      regulatory: {
        licenceRequired: false, regulatoryBody: 'Propertymark', regulatoryBodyFull: 'Propertymark (ARLA / NAEA)',
        licenceFieldLabel: 'Membership Number', licenceDisplayLabel: 'Propertymark No.',
        licencePlaceholder: 'ARLA-12345', licenceNote: 'Optional — Propertymark, RICS, or NAEA membership number',
        phonePlaceholder: '+44 20 1234 5678',
      },
    },
    aiPromptHints: {
      countryName: 'United Kingdom',
      legalDisclaimer: 'These particulars are set out as a general outline only for the guidance of intending purchasers and do not constitute any part of an offer or contract. The seller does not make or give, and neither the agent nor any person in their employment has any authority to make or give, any representation or warranty in relation to this property.',
      locationExamples: { towns: ['London', 'Manchester', 'Birmingham', 'Edinburgh'], priceExamples: ['£250,000', '£450,000', '£1,200,000'] },
    },
  },

  'en-US': {
    locale: 'en-US',
    countryCode: 'US',
    regionName: 'United States',
    spelling: 'american',
    paperFormat: 'Letter',
    property: {
      energyRatings: {
        enabled: false, label: 'HERS Index', system: 'HERS', required: false,
        ratings: [
          { code: 'HERS_0_50', label: 'HERS 0-50', description: 'Very efficient' },
          { code: 'HERS_51_100', label: 'HERS 51-100', description: 'Standard new home' },
          { code: 'HERS_101_130', label: 'HERS 101-130', description: 'Typical existing home' },
          { code: 'HERS_131_PLUS', label: 'HERS 131+', description: 'Less efficient' },
          { code: 'NOT_RATED', label: 'Not Rated' },
        ],
      },
      measurements: {
        areaUnit: 'sqft', areaLabel: 'Square Feet', areaSymbol: 'sq ft', sqmDisplayMultiplier: 10.7639,
        landUnit: 'acres', landLabel: 'Acres', landSymbol: 'acres', acresDisplayMultiplier: 1,
      },
      buildingTypes: [
        { code: 'Detached', label: 'Single Family' },
        { code: 'Semi-Detached', label: 'Duplex' },
        { code: 'Townhouse', label: 'Townhouse' },
        { code: 'Condo', label: 'Condo' },
        { code: 'Commercial', label: 'Commercial' },
        { code: 'Land', label: 'Land' },
      ],
      floorNumberingOffset: 1,
    },
    address: {
      postalCodeLabel: 'ZIP Code', postalCodePlaceholder: '10001',
      postalCodePatternSource: '^\\d{5}(-\\d{4})?$', postalCodePatternFlags: '',
      postalCodeFormat: '10001 or 10001-1234',
      countyLabel: 'County', countyRequired: false, countyPrefix: '',
      stateLabel: 'State', stateRequired: true, states: US_STATES,
    },
    financial: {
      currency: 'USD', currencySymbol: '$', currencyPosition: 'before',
      thousandsSeparator: ',', decimalSeparator: '.',
      tax: { vatRate: 0, vatLabel: 'Sales Tax', vatEnabled: false, stampDutyLabel: 'Transfer Tax' },
    },
    dateTime: { dateFormat: 'MM/DD/YYYY', timeFormat: '12h', firstDayOfWeek: 0, defaultTimezone: 'America/New_York' },
    legal: {
      terminology: {
        estateAgent: 'Real Estate Agent', listingAgent: 'Listing Agent', buyersAgent: "Buyer's Agent",
        solicitor: 'Attorney', conveyancing: 'Title Insurance', stampDuty: 'Transfer Tax',
        freehold: 'Fee Simple', leasehold: 'Leasehold',
        apartment: 'apartment', terrace: 'townhouse', groundFloor: 'first floor', firstFloor: 'second floor',
      },
      compliance: { gdprEnabled: false, ccpaEnabled: true, amlRequired: true, fairHousingRequired: true, dataRetentionDays: 2555 },
      regulatory: {
        licenceRequired: true,
        regulatoryBody: 'State Real Estate Commission',
        regulatoryBodyFull: 'State Real Estate Commission (varies by state)',
        licenceFieldLabel: 'Real Estate License Number', licenceDisplayLabel: 'License No.',
        licencePlaceholder: '01234567', licenceNote: 'State-issued real estate license number',
        phonePlaceholder: '+1 (555) 123-4567',
      },
    },
    aiPromptHints: {
      countryName: 'United States',
      legalDisclaimer: 'The information provided is deemed reliable but not guaranteed. All measurements and square footage are approximate. Buyers should verify all information independently. This listing is subject to errors, omissions, and changes.',
      locationExamples: { towns: ['New York', 'Los Angeles', 'Chicago', 'Miami'], priceExamples: ['$350,000', '$750,000', '$1,500,000'] },
    },
  },

  'en-CA': {
    locale: 'en-CA',
    countryCode: 'CA',
    regionName: 'Canada',
    spelling: 'british',
    paperFormat: 'Letter',
    property: {
      energyRatings: {
        enabled: true, label: 'EnerGuide Rating', system: 'EnerGuide', required: false,
        ratings: [
          { code: 'ENER_0_50', label: '0-50 GJ/year', description: 'Very efficient' },
          { code: 'ENER_51_100', label: '51-100 GJ/year', description: 'Efficient' },
          { code: 'ENER_101_150', label: '101-150 GJ/year', description: 'Average' },
          { code: 'ENER_151_200', label: '151-200 GJ/year', description: 'Below average' },
          { code: 'ENER_200_PLUS', label: '200+ GJ/year', description: 'Less efficient' },
          { code: 'NOT_RATED', label: 'Not Rated' },
        ],
      },
      measurements: {
        areaUnit: 'sqft', areaLabel: 'Square Feet', areaSymbol: 'sq ft', sqmDisplayMultiplier: 10.7639,
        landUnit: 'acres', landLabel: 'Acres', landSymbol: 'acres', acresDisplayMultiplier: 1,
      },
      buildingTypes: [
        { code: 'Detached', label: 'Detached' },
        { code: 'Semi-Detached', label: 'Semi-Detached' },
        { code: 'Townhouse', label: 'Townhouse' },
        { code: 'Condo', label: 'Condo' },
        { code: 'Commercial', label: 'Commercial' },
        { code: 'Land', label: 'Land' },
      ],
      floorNumberingOffset: 1,
    },
    address: {
      postalCodeLabel: 'Postal Code', postalCodePlaceholder: 'K1A 0B1',
      postalCodePatternSource: '^[A-Z]\\d[A-Z]\\s?\\d[A-Z]\\d$', postalCodePatternFlags: 'i',
      postalCodeFormat: 'K1A 0B1',
      countyLabel: 'County', countyRequired: false, countyPrefix: '',
      stateLabel: 'Province', stateRequired: true, states: CA_PROVINCES,
    },
    financial: {
      currency: 'CAD', currencySymbol: 'C$', currencyPosition: 'before',
      thousandsSeparator: ',', decimalSeparator: '.',
      tax: { vatRate: 0.05, vatLabel: 'GST', vatEnabled: true, stampDutyLabel: 'Land Transfer Tax' },
    },
    dateTime: { dateFormat: 'DD/MM/YYYY', timeFormat: '12h', firstDayOfWeek: 0, defaultTimezone: 'America/Toronto' },
    legal: {
      terminology: {
        estateAgent: 'Real Estate Agent', listingAgent: 'Listing Agent', buyersAgent: "Buyer's Agent",
        solicitor: 'Lawyer', conveyancing: 'Title Insurance', stampDuty: 'Land Transfer Tax',
        freehold: 'Freehold', leasehold: 'Leasehold',
        apartment: 'condo', terrace: 'townhouse', groundFloor: 'main floor', firstFloor: 'second floor',
      },
      compliance: { gdprEnabled: false, ccpaEnabled: false, amlRequired: true, fairHousingRequired: false, dataRetentionDays: 2555 },
      regulatory: {
        licenceRequired: true, regulatoryBody: 'Provincial Regulator',
        regulatoryBodyFull: 'Provincial Real Estate Regulator (e.g. RECO, BCFSA)',
        licenceFieldLabel: 'Registration Number', licenceDisplayLabel: 'Reg. No.',
        licencePlaceholder: '12345678', licenceNote: 'Provincial real estate registration number',
        phonePlaceholder: '+1 (555) 123-4567',
      },
    },
    aiPromptHints: {
      countryName: 'Canada',
      legalDisclaimer: 'The information contained herein has been provided by the listing brokerage and is believed to be reliable. The listing brokerage makes no representations as to the accuracy of the information.',
      locationExamples: { towns: ['Toronto', 'Vancouver', 'Montreal', 'Calgary'], priceExamples: ['C$500,000', 'C$850,000', 'C$1,800,000'] },
    },
  },

  'en-AU': {
    locale: 'en-AU',
    countryCode: 'AU',
    regionName: 'Australia',
    spelling: 'british',
    paperFormat: 'A4',
    property: {
      energyRatings: {
        enabled: true, label: 'NatHERS Rating', system: 'NatHERS', required: false,
        ratings: [
          { code: 'STAR_10', label: '10 Stars', description: 'Most energy efficient' },
          { code: 'STAR_9', label: '9 Stars' }, { code: 'STAR_8', label: '8 Stars' },
          { code: 'STAR_7', label: '7 Stars', description: 'Above average' },
          { code: 'STAR_6', label: '6 Stars', description: 'Average new home' },
          { code: 'STAR_5', label: '5 Stars' }, { code: 'STAR_4', label: '4 Stars' },
          { code: 'STAR_3', label: '3 Stars' }, { code: 'STAR_2', label: '2 Stars' }, { code: 'STAR_1', label: '1 Star' },
          { code: 'STAR_0', label: '0 Stars', description: 'Least energy efficient' },
          { code: 'NOT_RATED', label: 'Not Rated' },
        ],
      },
      measurements: {
        areaUnit: 'sqm', areaLabel: 'Square Metres', areaSymbol: 'm²', sqmDisplayMultiplier: 1,
        landUnit: 'hectares', landLabel: 'Hectares', landSymbol: 'ha', acresDisplayMultiplier: 0.404686,
      },
      buildingTypes: [
        { code: 'Detached', label: 'House' },
        { code: 'Semi-Detached', label: 'Semi-Detached' },
        { code: 'Terrace', label: 'Terrace' },
        { code: 'Townhouse', label: 'Townhouse' },
        { code: 'Unit', label: 'Unit' },
        { code: 'Apartment', label: 'Apartment' },
        { code: 'Villa', label: 'Villa' },
        { code: 'Commercial', label: 'Commercial' },
        { code: 'Land', label: 'Land' },
      ],
      floorNumberingOffset: 0,
    },
    address: {
      postalCodeLabel: 'Postcode', postalCodePlaceholder: '2000',
      postalCodePatternSource: '^\\d{4}$', postalCodePatternFlags: '',
      postalCodeFormat: '2000',
      countyLabel: 'Suburb', countyRequired: false, countyPrefix: '',
      stateLabel: 'State/Territory', stateRequired: true, states: AU_STATES,
    },
    financial: {
      currency: 'AUD', currencySymbol: 'A$', currencyPosition: 'before',
      thousandsSeparator: ',', decimalSeparator: '.',
      tax: { vatRate: 0.10, vatLabel: 'GST', vatEnabled: true, stampDutyLabel: 'Stamp Duty' },
    },
    dateTime: { dateFormat: 'DD/MM/YYYY', timeFormat: '12h', firstDayOfWeek: 1, defaultTimezone: 'Australia/Sydney' },
    legal: {
      terminology: {
        estateAgent: 'Real Estate Agent', listingAgent: 'Real Estate Agent', buyersAgent: "Buyer's Agent",
        solicitor: 'Solicitor', conveyancing: 'Conveyancing', stampDuty: 'Stamp Duty',
        freehold: 'Freehold (Torrens Title)', leasehold: 'Strata Title',
        apartment: 'unit', terrace: 'terrace', groundFloor: 'ground floor', firstFloor: 'first floor',
      },
      compliance: { gdprEnabled: false, ccpaEnabled: false, amlRequired: true, fairHousingRequired: false, dataRetentionDays: 2555 },
      regulatory: {
        licenceRequired: true, regulatoryBody: 'Fair Trading',
        regulatoryBodyFull: 'State/Territory Fair Trading or Consumer Affairs',
        licenceFieldLabel: 'Agent Licence Number', licenceDisplayLabel: 'Licence No.',
        licencePlaceholder: '1234567', licenceNote: 'State-issued real estate agent licence number',
        phonePlaceholder: '+61 2 1234 5678',
      },
    },
    aiPromptHints: {
      countryName: 'Australia',
      legalDisclaimer: 'All information contained herein is gathered from sources we consider to be reliable. However, we cannot guarantee or give any warranty about the information provided. Interested parties must solely rely on their own enquiries.',
      locationExamples: { towns: ['Sydney', 'Melbourne', 'Brisbane', 'Perth'], priceExamples: ['A$650,000', 'A$1,100,000', 'A$2,500,000'] },
    },
  },

  'en-NZ': {
    locale: 'en-NZ',
    countryCode: 'NZ',
    regionName: 'New Zealand',
    spelling: 'british',
    paperFormat: 'A4',
    property: {
      energyRatings: {
        enabled: true, label: 'Home Energy Rating', system: 'HER', required: false,
        ratings: [
          { code: 'STAR_10', label: '10 Stars', description: 'Most energy efficient' },
          { code: 'STAR_9', label: '9 Stars' }, { code: 'STAR_8', label: '8 Stars' },
          { code: 'STAR_7', label: '7 Stars' },
          { code: 'STAR_6', label: '6 Stars', description: 'Above average' },
          { code: 'STAR_5', label: '5 Stars' }, { code: 'STAR_4', label: '4 Stars' },
          { code: 'STAR_3', label: '3 Stars' }, { code: 'STAR_2', label: '2 Stars' }, { code: 'STAR_1', label: '1 Star' },
          { code: 'STAR_0', label: '0 Stars', description: 'Least energy efficient' },
          { code: 'NOT_RATED', label: 'Not Rated' },
        ],
      },
      measurements: {
        areaUnit: 'sqm', areaLabel: 'Square Metres', areaSymbol: 'm²', sqmDisplayMultiplier: 1,
        landUnit: 'hectares', landLabel: 'Hectares', landSymbol: 'ha', acresDisplayMultiplier: 0.404686,
      },
      buildingTypes: [
        { code: 'Detached', label: 'House' },
        { code: 'Semi-Detached', label: 'Semi-Detached' },
        { code: 'Terrace', label: 'Terrace' },
        { code: 'Townhouse', label: 'Townhouse' },
        { code: 'Unit', label: 'Unit' },
        { code: 'Apartment', label: 'Apartment' },
        { code: 'Lifestyle', label: 'Lifestyle' },
        { code: 'Commercial', label: 'Commercial' },
        { code: 'Land', label: 'Land' },
      ],
      floorNumberingOffset: 0,
    },
    address: {
      postalCodeLabel: 'Postcode', postalCodePlaceholder: '6011',
      postalCodePatternSource: '^\\d{4}$', postalCodePatternFlags: '',
      postalCodeFormat: '6011',
      countyLabel: 'Suburb', countyRequired: false, countyPrefix: '',
      stateLabel: 'Region', stateRequired: true, states: NZ_REGIONS,
    },
    financial: {
      currency: 'NZD', currencySymbol: 'NZ$', currencyPosition: 'before',
      thousandsSeparator: ',', decimalSeparator: '.',
      tax: { vatRate: 0.15, vatLabel: 'GST', vatEnabled: true },
    },
    dateTime: { dateFormat: 'DD/MM/YYYY', timeFormat: '12h', firstDayOfWeek: 1, defaultTimezone: 'Pacific/Auckland' },
    legal: {
      terminology: {
        estateAgent: 'Real Estate Agent', listingAgent: 'Real Estate Agent', buyersAgent: "Buyer's Agent",
        solicitor: 'Solicitor', conveyancing: 'Conveyancing', stampDuty: 'No Transfer Tax',
        freehold: 'Freehold', leasehold: 'Leasehold',
        apartment: 'unit', terrace: 'terrace', groundFloor: 'ground floor', firstFloor: 'first floor',
      },
      compliance: { gdprEnabled: false, ccpaEnabled: false, amlRequired: true, fairHousingRequired: false, dataRetentionDays: 2555 },
      regulatory: {
        licenceRequired: true, regulatoryBody: 'REA', regulatoryBodyFull: 'Real Estate Authority (under REAA 2008)',
        licenceFieldLabel: 'REA Licence Number', licenceDisplayLabel: 'REA Licence',
        licencePlaceholder: '10012345', licenceNote: 'Required under the Real Estate Agents Act 2008',
        phonePlaceholder: '+64 9 123 4567',
      },
    },
    aiPromptHints: {
      countryName: 'New Zealand',
      legalDisclaimer: 'All information contained herein is gathered from sources we consider to be reliable. However, we cannot guarantee or give any warranty about the information provided.',
      locationExamples: { towns: ['Auckland', 'Wellington', 'Christchurch', 'Hamilton'], priceExamples: ['NZ$700,000', 'NZ$1,200,000', 'NZ$2,800,000'] },
    },
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Lookup tables  (also Record<...> for compile-time exhaustiveness)
// ────────────────────────────────────────────────────────────────────────────

export const COUNTRY_TO_LOCALE: Record<MarketCountry, MarketLocale> = {
  IE: 'en-IE', GB: 'en-GB', US: 'en-US', CA: 'en-CA', AU: 'en-AU', NZ: 'en-NZ',
};

export const LOCALE_TO_COUNTRY: Record<MarketLocale, MarketCountry> = {
  'en-IE': 'IE', 'en-GB': 'GB', 'en-US': 'US', 'en-CA': 'CA', 'en-AU': 'AU', 'en-NZ': 'NZ',
};

export const LOCALE_TO_CURRENCY: Record<MarketLocale, MarketCurrency> = {
  'en-IE': 'EUR', 'en-GB': 'GBP', 'en-US': 'USD', 'en-CA': 'CAD', 'en-AU': 'AUD', 'en-NZ': 'NZD',
};

/** Default fallback locale when country/locale resolution fails. */
export const DEFAULT_LOCALE: MarketLocale = 'en-IE';

// ────────────────────────────────────────────────────────────────────────────
// Resolvers  —  THE single doorway for turning an org into a config.
// ────────────────────────────────────────────────────────────────────────────

export function getRegionConfig(locale: string | null | undefined): RegionConfig {
  if (locale && (locale as MarketLocale) in LOCALE_CONFIGS) {
    return LOCALE_CONFIGS[locale as MarketLocale];
  }
  return LOCALE_CONFIGS[DEFAULT_LOCALE];
}

export function countryToLocale(countryCode: string | null | undefined): MarketLocale {
  if (countryCode && (countryCode.toUpperCase() as MarketCountry) in COUNTRY_TO_LOCALE) {
    return COUNTRY_TO_LOCALE[countryCode.toUpperCase() as MarketCountry];
  }
  return DEFAULT_LOCALE;
}

/**
 * Resolve a RegionConfig from an org row.  Use this everywhere — never index
 * into LOCALE_CONFIGS by raw country_code or locale.  Single doorway = single
 * place to fix when resolution rules change.
 */
export function resolveLocaleFromOrg(
  org: { country_code?: string | null; locale?: string | null } | null | undefined
): RegionConfig {
  if (!org) return LOCALE_CONFIGS[DEFAULT_LOCALE];
  const locale = (org.locale as MarketLocale | undefined) ?? countryToLocale(org.country_code);
  return getRegionConfig(locale);
}

// ────────────────────────────────────────────────────────────────────────────
// Formatting helpers  —  use these instead of inline Intl.* / template strings.
//
// Lint rule `no-hardcoded-currency-symbol` (Checkpoint D) bans `€`/`£`/`$` etc.
// outside of this file.  Always route through `formatPrice` / `formatLocation`.
// ────────────────────────────────────────────────────────────────────────────

export function formatPrice(
  amount: number | null | undefined,
  config: RegionConfig,
  options: { showDecimals?: boolean } = {}
): string {
  if (amount == null) return '';
  // We use Intl.NumberFormat for the *number* (locale-correct grouping &
  // decimal separators) and our own `currencySymbol` for the prefix.
  // Reason: Intl with `style: 'currency'` renders a bare "$" for CAD/AUD/NZD
  // when paired with their native locales, which is ambiguous next to USD.
  // Always emitting `C$` / `A$` / `NZ$` matches what users see elsewhere
  // in the product and removes the ambiguity.
  const formatted = new Intl.NumberFormat(config.locale, {
    style: 'decimal',
    minimumFractionDigits: options.showDecimals ? 2 : 0,
    maximumFractionDigits: options.showDecimals ? 2 : 0,
  }).format(amount);
  const { currencySymbol, currencyPosition } = config.financial;
  return currencyPosition === 'before' ? `${currencySymbol}${formatted}` : `${formatted} ${currencySymbol}`;
}

/**
 * Render a town/county/state line in the locale's idiom.
 *
 * - IE:  `"Dublin, Co. Galway"`  (county prefix `"Co. "`)
 * - GB:  `"Manchester, Surrey"`  (no prefix)
 * - US:  `"Beverly Hills, California"`  (state, no prefix)
 * - CA / AU / NZ: same as US (province / state / region, no prefix)
 *
 * Pass either `county` (IE/GB) or `state` (US/CA/AU/NZ) — whichever the org has.
 * Empty parts are omitted; never produces a leading or trailing comma.
 */
export function formatLocation(
  parts: { town?: string | null; county?: string | null; state?: string | null },
  config: RegionConfig
): string {
  const town = parts.town?.trim() || '';
  const region = (parts.county ?? parts.state ?? '').trim();
  const prefix = config.address.countyPrefix;
  const regionFormatted = region ? `${prefix}${region}` : '';
  return [town, regionFormatted].filter(Boolean).join(', ');
}

export function formatArea(amount: number | null | undefined, config: RegionConfig): string {
  if (amount == null) return '';
  const display = amount * config.property.measurements.sqmDisplayMultiplier;
  return `${Math.round(display).toLocaleString(config.locale)} ${config.property.measurements.areaSymbol}`;
}

export function postalCodeRegex(config: RegionConfig): RegExp {
  return new RegExp(config.address.postalCodePatternSource, config.address.postalCodePatternFlags);
}

export function licenceRegex(config: RegionConfig): RegExp | null {
  const src = config.legal.regulatory.licencePatternSource;
  if (!src) return null;
  return new RegExp(src, config.legal.regulatory.licencePatternFlags ?? '');
}

// ────────────────────────────────────────────────────────────────────────────
// AI prompt fragment helpers — used by edge functions that send region-aware
// prompts to Claude / Gemini.  Each helper returns a small chunk of text that
// can be concatenated into a system prompt; they all read from RegionConfig
// so a region-specific prompt is built mechanically rather than hand-rolled.
// ────────────────────────────────────────────────────────────────────────────

/** Format a date using a region's locale.  Long-form ("Friday, 5 April 2026"). */
export function formatEdgeDate(date: Date, config: RegionConfig): string {
  return date.toLocaleDateString(config.locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** AI prompt fragment describing the region's measurement / currency / energy units. */
export function getUnitsPromptSection(config: RegionConfig): string {
  const m = config.property.measurements;
  const e = config.property.energyRatings;
  const lines = [
    `Measurements: Use ${m.areaLabel} (${m.areaSymbol}) for property sizes.`,
    `Land: Use ${m.landUnit} for land areas.`,
    `Currency: Use ${config.financial.currencySymbol} (${config.financial.currency}).`,
    `Dates: Use ${config.dateTime.dateFormat} format.`,
  ];
  if (e.enabled) {
    lines.push(`Energy Rating: Use ${e.system} (${e.label}).`);
  }
  return lines.join('\n');
}

/** AI prompt fragment with example towns + price examples for the region. */
export function getLocationExamplesPrompt(config: RegionConfig): string {
  const ex = config.aiPromptHints.locationExamples;
  return `Example locations: ${ex.towns.join(', ')}. Example prices: ${ex.priceExamples.join(', ')}.`;
}

/** AI prompt fragment describing the region's property / legal terminology. */
export function getTerminologyPrompt(config: RegionConfig): string {
  const t = config.legal.terminology;
  return [
    `Use "${t.apartment}" (not "flat" or "condo" unless that's the local term).`,
    `Use "${t.terrace}" for row houses.`,
    `Use "${t.groundFloor}" for the entry level.`,
    `Use "${t.estateAgent}" for the property professional.`,
    `Use "${t.solicitor}" for the legal professional.`,
    `Use ${config.spelling} English spelling.`,
  ].join('\n');
}
