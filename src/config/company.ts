import type { MarketCountry } from '@/lib/locale/markets';

export const COMPANY_INFO = {
  name: "AutoListing.io",
  legalName: "Streamlined Digital Tech Ltd",
  croNumber: "805162",
  vatNumber: "VAT04549950FH",
  registeredAddress: {
    street: "Castleblakeney",
    city: "Ballinasloe",
    county: "Co. Galway", // locale-allowed: this is the platform company's own registered Irish address — fixed truth, not user-facing formatted output
    country: "Ireland",
    eircode: "H53 YA97",
  },
  contact: {
    email: "peter@streamlinedai.tech",
    phone: "",
    supportHours: "Monday - Friday, 9:00 AM - 5:30 PM (Irish Time)",
  },
  dpo: {
    email: "privacy@autolisting.io",
    name: "Peter Harris",
  },
  social: {
    twitter: "",
    linkedin: "",
    facebook: "",
  },
  legal: {
    jurisdiction: "Ireland",
    governingLaw: "the laws of Ireland",
    disputeResolution: "the courts of Ireland",
    dataProtectionAuthority: {
      name: "Data Protection Commission (DPC)",
      website: "https://www.dataprotection.ie",
      address: "21 Fitzwilliam Square South, Dublin 2, D02 RD28, Ireland",
    },
  },
  billing: {
    currency: "EUR",
    vatRate: 23,
    vatApplicable: true,
  },
} as const;

export const DATA_PROTECTION_AUTHORITIES: Record<MarketCountry, {
  name: string;
  website: string;
  law: string;
}> = {
  IE: { name: 'Data Protection Commission (DPC)', website: 'https://www.dataprotection.ie', law: 'Irish Data Protection Act 2018' },
  GB: { name: "Information Commissioner's Office (ICO)", website: 'https://ico.org.uk', law: 'UK Data Protection Act 2018' },
  US: { name: 'Federal Trade Commission (FTC)', website: 'https://www.ftc.gov', law: 'State privacy laws (CCPA/CPRA where applicable)' },
  CA: { name: 'Office of the Privacy Commissioner (OPC)', website: 'https://www.priv.gc.ca', law: 'Personal Information Protection and Electronic Documents Act (PIPEDA)' },
  AU: { name: 'Office of the Australian Information Commissioner (OAIC)', website: 'https://www.oaic.gov.au', law: 'Privacy Act 1988' },
  NZ: { name: 'Office of the Privacy Commissioner (OPC)', website: 'https://privacy.org.nz', law: 'Privacy Act 2020' },
};

export function getDataProtectionAuthority(countryCode: MarketCountry) {
  return DATA_PROTECTION_AUTHORITIES[countryCode] || DATA_PROTECTION_AUTHORITIES.IE;
}

export function getFormattedAddress(includeEircode = true): string {
  const { street, city, county, country, eircode } = COMPANY_INFO.registeredAddress;
  const parts: string[] = [street, city, county, country];
  if (includeEircode && eircode) {
    parts.push(eircode);
  }
  return parts.filter(Boolean).join(", ");
}

export function getCompanyRegistrationText(): string {
  return `${COMPANY_INFO.legalName}, registered in Ireland (CRO: ${COMPANY_INFO.croNumber}), VAT: ${COMPANY_INFO.vatNumber}`;
}
