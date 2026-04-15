import { RegionConfig } from './index';

const CA_PROVINCES = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
];

export const caConfig: RegionConfig = {
  locale: 'en-CA',
  regionName: 'Canada',
  countryCode: 'CA',

  property: {
    energyRatings: {
      enabled: true,
      label: 'EnerGuide Rating',
      required: false,
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
      areaUnit: 'sqft',
      areaLabel: 'Square Feet',
      areaSymbol: 'sq ft',
      convertFromSqm: (sqm: number) => sqm * 10.7639,
      convertToSqm: (sqft: number) => sqft / 10.7639,
      landUnit: 'acres',
      landLabel: 'Acres',
      landSymbol: 'acres',
      convertFromAcres: (acres: number) => acres,
      convertToAcres: (value: number) => value,
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
    postalCodeLabel: 'Postal Code',
    postalCodePlaceholder: 'K1A 0B1',
    postalCodePattern: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i,
    postalCodeFormat: 'K1A 0B1',
    countyLabel: 'County',
    countyRequired: false,
    stateLabel: 'Province',
    stateRequired: true,
    states: CA_PROVINCES,
  },

  financial: {
    currency: 'CAD',
    currencySymbol: 'C$',
    currencyPosition: 'before',
    thousandsSeparator: ',',
    decimalSeparator: '.',
    tax: {
      vatRate: 0.05,
      vatLabel: 'GST',
      vatEnabled: true,
      stampDutyLabel: 'Land Transfer Tax',
    },
  },

  dateTime: {
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12h',
    firstDayOfWeek: 0,
  },

  legal: {
    terminology: {
      solicitor: 'Lawyer',
      conveyancing: 'Title Insurance',
      stampDuty: 'Land Transfer Tax',
      freehold: 'Freehold',
      leasehold: 'Leasehold',
      listingAgent: 'Listing Agent',
      buyersAgent: 'Buyer\'s Agent',
    },
    compliance: {
      gdprEnabled: false,
      ccpaEnabled: false,
      amlRequired: true,
      fairHousingRequired: false,
      dataRetentionDays: 2555,
    },
    regulatory: {
      licenceRequired: true,
      regulatoryBody: 'Provincial Regulator',
      regulatoryBodyFull: 'Provincial Real Estate Regulator (e.g. RECO, BCFSA)',
      licenceFieldLabel: 'Registration Number',
      licenceDisplayLabel: 'Reg. No.',
      licencePlaceholder: '12345678',
      licenceNote: 'Provincial real estate registration number',
      phonePlaceholder: '+1 (555) 123-4567',
    },
  },
};
