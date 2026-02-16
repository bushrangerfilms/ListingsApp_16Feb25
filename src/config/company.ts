export const COMPANY_INFO = {
  name: "AutoListing.io",
  legalName: "[YOUR COMPANY NAME LTD]",
  croNumber: "[CRO NUMBER]",
  vatNumber: "[IE VAT NUMBER]",
  registeredAddress: {
    street: "[STREET ADDRESS]",
    city: "[CITY]",
    county: "[COUNTY]",
    country: "Ireland",
    eircode: "[EIRCODE]",
  },
  contact: {
    email: "support@autolisting.io",
    phone: "+353 [PHONE NUMBER]",
    supportHours: "Monday - Friday, 9:00 AM - 5:30 PM (Irish Time)",
  },
  dpo: {
    email: "privacy@autolisting.io",
    name: "[DATA PROTECTION OFFICER NAME]",
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
