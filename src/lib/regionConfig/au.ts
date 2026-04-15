import { RegionConfig } from './index';

const AU_STATES = [
  { code: 'NSW', name: 'New South Wales' },
  { code: 'VIC', name: 'Victoria' },
  { code: 'QLD', name: 'Queensland' },
  { code: 'WA', name: 'Western Australia' },
  { code: 'SA', name: 'South Australia' },
  { code: 'TAS', name: 'Tasmania' },
  { code: 'ACT', name: 'Australian Capital Territory' },
  { code: 'NT', name: 'Northern Territory' },
];

export const auConfig: RegionConfig = {
  locale: 'en-AU',
  regionName: 'Australia',
  countryCode: 'AU',

  property: {
    energyRatings: {
      enabled: true,
      label: 'NatHERS Rating',
      required: false,
      ratings: [
        { code: 'STAR_10', label: '10 Stars', description: 'Most energy efficient' },
        { code: 'STAR_9', label: '9 Stars' },
        { code: 'STAR_8', label: '8 Stars' },
        { code: 'STAR_7', label: '7 Stars', description: 'Above average' },
        { code: 'STAR_6', label: '6 Stars', description: 'Average new home' },
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
    postalCodePlaceholder: '2000',
    postalCodePattern: /^\d{4}$/,
    postalCodeFormat: '2000',
    countyLabel: 'Suburb',
    countyRequired: false,
    stateLabel: 'State/Territory',
    stateRequired: true,
    states: AU_STATES,
  },

  financial: {
    currency: 'AUD',
    currencySymbol: 'A$',
    currencyPosition: 'before',
    thousandsSeparator: ',',
    decimalSeparator: '.',
    tax: {
      vatRate: 0.10,
      vatLabel: 'GST',
      vatEnabled: true,
      stampDutyLabel: 'Stamp Duty',
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
      stampDuty: 'Stamp Duty',
      freehold: 'Freehold (Torrens Title)',
      leasehold: 'Strata Title',
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
      regulatoryBody: 'Fair Trading',
      regulatoryBodyFull: 'State/Territory Fair Trading or Consumer Affairs',
      licenceFieldLabel: 'Agent Licence Number',
      licenceDisplayLabel: 'Licence No.',
      licencePlaceholder: '1234567',
      licenceNote: 'State-issued real estate agent licence number',
      phonePlaceholder: '+61 2 1234 5678',
    },
  },
};
