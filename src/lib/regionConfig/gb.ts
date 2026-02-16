import { RegionConfig } from './index';

export const gbConfig: RegionConfig = {
  locale: 'en-GB',
  regionName: 'United Kingdom',
  countryCode: 'GB',
  
  property: {
    energyRatings: {
      enabled: true,
      label: 'EPC Rating',
      required: true,
      ratings: [
        { code: 'A', label: 'A', description: 'Most energy efficient (92-100)' },
        { code: 'B', label: 'B', description: '81-91' },
        { code: 'C', label: 'C', description: '69-80' },
        { code: 'D', label: 'D', description: '55-68' },
        { code: 'E', label: 'E', description: '39-54' },
        { code: 'F', label: 'F', description: '21-38' },
        { code: 'G', label: 'G', description: 'Least energy efficient (1-20)' },
        { code: 'EXEMPT', label: 'Exempt' },
      ],
    },
    measurements: {
      areaUnit: 'sqm',
      areaLabel: 'Square Metres',
      areaSymbol: 'm²',
      convertFromSqm: (sqm: number) => sqm,
      convertToSqm: (value: number) => value,
      landUnit: 'acres',
      landLabel: 'Acres',
      landSymbol: 'acres',
      convertFromAcres: (acres: number) => acres,
      convertToAcres: (value: number) => value,
    },
    buildingTypes: [
      { code: 'Detached', label: 'Detached' },
      { code: 'Semi-Detached', label: 'Semi-Detached' },
      { code: 'Terraced', label: 'Terraced' },
      { code: 'Flat', label: 'Flat' },
      { code: 'Commercial', label: 'Commercial' },
      { code: 'Land', label: 'Land' },
    ],
    floorNumberingOffset: 0,
  },
  
  address: {
    postalCodeLabel: 'Postcode',
    postalCodePlaceholder: 'SW1A 1AA',
    postalCodePattern: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i,
    postalCodeFormat: 'SW1A 1AA',
    countyLabel: 'County',
    countyRequired: false,
  },
  
  financial: {
    currency: 'GBP',
    currencySymbol: '£',
    currencyPosition: 'before',
    thousandsSeparator: ',',
    decimalSeparator: '.',
    tax: {
      vatRate: 0.20,
      vatLabel: 'VAT',
      vatEnabled: true,
      stampDutyLabel: 'Stamp Duty Land Tax',
    },
  },
  
  dateTime: {
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    firstDayOfWeek: 1,
  },
  
  legal: {
    terminology: {
      solicitor: 'Solicitor',
      conveyancing: 'Conveyancing',
      stampDuty: 'Stamp Duty Land Tax',
      freehold: 'Freehold',
      leasehold: 'Leasehold',
      listingAgent: 'Estate Agent',
      buyersAgent: 'Buyer\'s Agent',
    },
    compliance: {
      gdprEnabled: true,
      ccpaEnabled: false,
      amlRequired: true,
      fairHousingRequired: false,
      dataRetentionDays: 2555,
    },
  },
};
