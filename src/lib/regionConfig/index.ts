import { SupportedLocale } from '@/lib/i18n';
import { ieConfig } from './ie';
import { gbConfig } from './gb';
import { usConfig } from './us';

export interface EnergyRating {
  code: string;
  label: string;
  description?: string;
}

export interface EnergyRatingsConfig {
  enabled: boolean;
  label: string;
  ratings: EnergyRating[];
  required: boolean;
}

export interface AddressConfig {
  postalCodeLabel: string;
  postalCodePlaceholder: string;
  postalCodePattern: RegExp;
  postalCodeFormat: string;
  countyLabel: string;
  countyRequired: boolean;
  stateLabel?: string;
  stateRequired?: boolean;
  states?: Array<{ code: string; name: string }>;
}

export interface MeasurementsConfig {
  areaUnit: 'sqm' | 'sqft';
  areaLabel: string;
  areaSymbol: string;
  convertFromSqm: (sqm: number) => number;
  convertToSqm: (value: number) => number;
  landUnit: 'acres' | 'hectares';
  landLabel: string;
  landSymbol: string;
  convertFromAcres: (acres: number) => number;
  convertToAcres: (value: number) => number;
}

export interface BuildingType {
  code: string;
  label: string;
}

export interface TaxConfig {
  vatRate: number;
  vatLabel: string;
  vatEnabled: boolean;
  stampDutyLabel?: string;
}

export interface LegalTerminology {
  solicitor: string;
  conveyancing: string;
  stampDuty: string;
  freehold: string;
  leasehold: string;
  listingAgent: string;
  buyersAgent: string;
}

export interface ComplianceConfig {
  gdprEnabled: boolean;
  ccpaEnabled: boolean;
  amlRequired: boolean;
  fairHousingRequired: boolean;
  dataRetentionDays: number;
}

export interface PropertyConfig {
  energyRatings: EnergyRatingsConfig;
  measurements: MeasurementsConfig;
  buildingTypes: BuildingType[];
  floorNumberingOffset: number;
}

export interface FinancialConfig {
  currency: string;
  currencySymbol: string;
  currencyPosition: 'before' | 'after';
  thousandsSeparator: string;
  decimalSeparator: string;
  tax: TaxConfig;
}

export interface DateTimeConfig {
  dateFormat: string;
  timeFormat: '12h' | '24h';
  firstDayOfWeek: 0 | 1;
}

export interface LegalConfig {
  terminology: LegalTerminology;
  compliance: ComplianceConfig;
}

export interface RegionConfig {
  locale: SupportedLocale;
  regionName: string;
  countryCode: string;
  property: PropertyConfig;
  address: AddressConfig;
  financial: FinancialConfig;
  dateTime: DateTimeConfig;
  legal: LegalConfig;
}

const REGION_CONFIGS: Record<SupportedLocale, RegionConfig> = {
  'en-IE': ieConfig,
  'en-GB': gbConfig,
  'en-US': usConfig,
};

export function getRegionConfig(locale: SupportedLocale): RegionConfig {
  return REGION_CONFIGS[locale] || REGION_CONFIGS['en-IE'];
}

export function getAllRegionConfigs(): RegionConfig[] {
  return Object.values(REGION_CONFIGS);
}
