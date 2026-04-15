import { RegionConfig } from './index';

const NZ_REGIONS = [
  { code: 'AUK', name: 'Auckland' },
  { code: 'BOP', name: 'Bay of Plenty' },
  { code: 'CAN', name: 'Canterbury' },
  { code: 'GIS', name: 'Gisborne' },
  { code: 'HKB', name: "Hawke's Bay" },
  { code: 'MWT', name: 'Manawatu-Wanganui' },
  { code: 'MBH', name: 'Marlborough' },
  { code: 'NSN', name: 'Nelson' },
  { code: 'NTL', name: 'Northland' },
  { code: 'OTA', name: 'Otago' },
  { code: 'STL', name: 'Southland' },
  { code: 'TKI', name: 'Taranaki' },
  { code: 'TAS', name: 'Tasman' },
  { code: 'WKO', name: 'Waikato' },
  { code: 'WGN', name: 'Wellington' },
  { code: 'WTC', name: 'West Coast' },
];

export const nzConfig: RegionConfig = {
  locale: 'en-NZ',
  regionName: 'New Zealand',
  countryCode: 'NZ',

  property: {
    energyRatings: {
      enabled: true,
      label: 'Home Energy Rating',
      required: false,
      ratings: [
        { code: 'STAR_10', label: '10 Stars', description: 'Most energy efficient' },
        { code: 'STAR_9', label: '9 Stars' },
        { code: 'STAR_8', label: '8 Stars' },
        { code: 'STAR_7', label: '7 Stars' },
        { code: 'STAR_6', label: '6 Stars', description: 'Above average' },
        { code: 'STAR_5', label: '5 Stars' },
        { code: 'STAR_4', label: '4 Stars' },
        { code: 'STAR_3', label: '3 Stars' },
        { code: 'STAR_2', label: '2 Stars' },
        { code: 'STAR_1', label: '1 Star' },
        { code: 'STAR_0', label: '0 Stars', description: 'Least energy efficient' },
        { code: 'NOT_RATED', label: 'Not Rated' },
      ],
    },
    measurements: {
      areaUnit: 'sqm',
      areaLabel: 'Square Metres',
      areaSymbol: 'm²',
      convertFromSqm: (sqm: number) => sqm,
      convertToSqm: (value: number) => value,
      landUnit: 'hectares',
      landLabel: 'Hectares',
      landSymbol: 'ha',
      convertFromAcres: (acres: number) => acres * 0.404686,
      convertToAcres: (hectares: number) => hectares / 0.404686,
    },
    buildingTypes: [
      { code: 'Detached', label: 'Detached' },
      { code: 'Semi-Detached', label: 'Semi-Detached' },
      { code: 'Terrace', label: 'Terrace' },
      { code: 'Unit', label: 'Unit' },
      { code: 'Commercial', label: 'Commercial' },
      { code: 'Land', label: 'Land' },
    ],
    floorNumberingOffset: 0,
  },

  address: {
    postalCodeLabel: 'Postcode',
    postalCodePlaceholder: '6011',
    postalCodePattern: /^\d{4}$/,
    postalCodeFormat: '6011',
    countyLabel: 'Suburb',
    countyRequired: false,
    stateLabel: 'Region',
    stateRequired: true,
    states: NZ_REGIONS,
  },

  financial: {
    currency: 'NZD',
    currencySymbol: 'NZ$',
    currencyPosition: 'before',
    thousandsSeparator: ',',
    decimalSeparator: '.',
    tax: {
      vatRate: 0.15,
      vatLabel: 'GST',
      vatEnabled: true,
    },
  },

  dateTime: {
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12h',
    firstDayOfWeek: 1,
  },

  legal: {
    terminology: {
      solicitor: 'Solicitor',
      conveyancing: 'Conveyancing',
      stampDuty: 'No Transfer Tax',
      freehold: 'Freehold',
      leasehold: 'Leasehold',
      listingAgent: 'Real Estate Agent',
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
      regulatoryBody: 'REA',
      regulatoryBodyFull: 'Real Estate Authority (under REAA 2008)',
      licenceFieldLabel: 'REA Licence Number',
      licenceDisplayLabel: 'REA Licence',
      licencePlaceholder: '10012345',
      licenceNote: 'Required under the Real Estate Agents Act 2008',
      phonePlaceholder: '+64 9 123 4567',
    },
  },
};
