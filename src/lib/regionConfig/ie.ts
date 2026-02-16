import { RegionConfig } from './index';

export const ieConfig: RegionConfig = {
  locale: 'en-IE',
  regionName: 'Ireland',
  countryCode: 'IE',
  
  property: {
    energyRatings: {
      enabled: true,
      label: 'BER Rating',
      required: true,
      ratings: [
        { code: 'A1', label: 'A1', description: 'Most energy efficient' },
        { code: 'A2', label: 'A2' },
        { code: 'A3', label: 'A3' },
        { code: 'B1', label: 'B1' },
        { code: 'B2', label: 'B2' },
        { code: 'B3', label: 'B3' },
        { code: 'C1', label: 'C1' },
        { code: 'C2', label: 'C2' },
        { code: 'C3', label: 'C3' },
        { code: 'D1', label: 'D1' },
        { code: 'D2', label: 'D2' },
        { code: 'E1', label: 'E1' },
        { code: 'E2', label: 'E2' },
        { code: 'F', label: 'F' },
        { code: 'G', label: 'G', description: 'Least energy efficient' },
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
      { code: 'Terrace', label: 'Terrace' },
      { code: 'Apartment', label: 'Apartment' },
      { code: 'Commercial', label: 'Commercial' },
      { code: 'Land', label: 'Land' },
    ],
    floorNumberingOffset: 0,
  },
  
  address: {
    postalCodeLabel: 'Eircode',
    postalCodePlaceholder: 'A65 F4E2',
    postalCodePattern: /^[A-Z]\d{2}\s?[A-Z0-9]{4}$/i,
    postalCodeFormat: 'A65 F4E2',
    countyLabel: 'County',
    countyRequired: true,
  },
  
  financial: {
    currency: 'EUR',
    currencySymbol: '€',
    currencyPosition: 'before',
    thousandsSeparator: ',',
    decimalSeparator: '.',
    tax: {
      vatRate: 0.23,
      vatLabel: 'VAT',
      vatEnabled: true,
      stampDutyLabel: 'Stamp Duty',
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
      stampDuty: 'Stamp Duty',
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
