import type { MarketCountry } from './markets';
import { getDataProtectionAuthority } from '@/config/company';
import { getRegionConfig } from '@/lib/regionConfig';
import { COUNTRY_TO_LOCALE } from './markets';

const GOVERNING_LAW: Record<MarketCountry, string> = {
  IE: 'the laws of Ireland',
  GB: 'the laws of England and Wales',
  US: 'the laws of the State of Delaware, United States',
  CA: 'the laws of the Province of Ontario, Canada',
  AU: 'the laws of New South Wales, Australia',
  NZ: 'the laws of New Zealand',
};

const DISPUTE_RESOLUTION: Record<MarketCountry, string> = {
  IE: 'the courts of Ireland',
  GB: 'the courts of England and Wales',
  US: 'the courts of the State of Delaware',
  CA: 'the courts of the Province of Ontario',
  AU: 'the courts of New South Wales',
  NZ: 'the courts of New Zealand',
};

const COOKIE_LAW_REFS: Record<MarketCountry, string> = {
  IE: 'EU ePrivacy Directive (Directive 2002/58/EC) and the Irish ePrivacy Regulations',
  GB: 'UK Privacy and Electronic Communications Regulations (PECR)',
  US: 'applicable state privacy laws including the California Consumer Privacy Act (CCPA)',
  CA: 'the Personal Information Protection and Electronic Documents Act (PIPEDA)',
  AU: 'the Privacy Act 1988 (Cth)',
  NZ: 'the Privacy Act 2020',
};

const DATA_RETENTION_NOTES: Record<MarketCountry, string> = {
  IE: 'In accordance with GDPR Article 5(1)(e), we retain personal data only for as long as necessary.',
  GB: 'In accordance with UK GDPR Article 5(1)(e), we retain personal data only for as long as necessary.',
  US: 'We retain personal data in accordance with applicable state and federal requirements.',
  CA: 'We retain personal data in accordance with PIPEDA Principle 5.',
  AU: 'We retain personal data in accordance with Australian Privacy Principle 11.',
  NZ: 'We retain personal data in accordance with Information Privacy Principle 9.',
};

const TAX_RETENTION_NOTES: Record<MarketCountry, string> = {
  IE: 'Irish tax law requirement',
  GB: 'HMRC requirement',
  US: 'IRS requirement',
  CA: 'CRA requirement',
  AU: 'ATO requirement',
  NZ: 'IRD requirement',
};

const GDPR_LABELS: Record<MarketCountry, string> = {
  IE: 'GDPR',
  GB: 'UK GDPR',
  US: 'applicable privacy laws',
  CA: 'PIPEDA',
  AU: 'the Privacy Act',
  NZ: 'the Privacy Act',
};

const INTERNATIONAL_TRANSFER_SAFEGUARDS: Record<MarketCountry, string[]> = {
  IE: [
    'EU-US Data Privacy Framework certification',
    'Standard Contractual Clauses (SCCs) approved by the European Commission',
    'Binding Corporate Rules where applicable',
  ],
  GB: [
    'UK adequacy decisions',
    'International Data Transfer Agreements (IDTAs)',
    'UK Standard Contractual Clauses',
    'Binding Corporate Rules where applicable',
  ],
  US: [
    'EU-US and UK-US Data Privacy Framework certification where applicable',
    'Standard Contractual Clauses where required',
  ],
  CA: [
    'Adequacy decisions under PIPEDA',
    'Contractual safeguards ensuring equivalent protection',
  ],
  AU: [
    'Contractual safeguards under Australian Privacy Principle 8',
    'Adequacy assessments for recipient countries',
  ],
  NZ: [
    'Contractual safeguards under Information Privacy Principle 12',
    'Adequacy assessments for recipient countries',
  ],
};

const TRANSFER_CONTEXT: Record<MarketCountry, string> = {
  IE: 'Some of our service providers may transfer data outside the European Economic Area (EEA).',
  GB: 'Some of our service providers may transfer data outside the United Kingdom.',
  US: 'Some of our service providers may transfer data internationally.',
  CA: 'Some of our service providers may transfer data outside Canada.',
  AU: 'Some of our service providers may transfer data outside Australia.',
  NZ: 'Some of our service providers may transfer data outside New Zealand.',
};

const ORGANISATIONAL_SPELLING: Record<MarketCountry, string> = {
  IE: 'organisational',
  GB: 'organisational',
  US: 'organizational',
  CA: 'organizational',
  AU: 'organisational',
  NZ: 'organisational',
};

const ANONYMISED_SPELLING: Record<MarketCountry, string> = {
  IE: 'anonymised',
  GB: 'anonymised',
  US: 'anonymized',
  CA: 'anonymized',
  AU: 'anonymised',
  NZ: 'anonymised',
};

export interface LegalConfigResult {
  dataProtectionAuthority: { name: string; website: string; law: string };
  governingLaw: string;
  disputeResolution: string;
  vatLabel: string;
  vatRate: number;
  currency: string;
  currencySymbol: string;
  dataRetentionNote: string;
  cookieLawRef: string;
  taxRetentionNote: string;
  gdprLabel: string;
  internationalTransferSafeguards: string[];
  transferContext: string;
  organisationalSpelling: string;
  anonymisedSpelling: string;
}

export function getLegalConfig(countryCode: MarketCountry): LegalConfigResult {
  const dpa = getDataProtectionAuthority(countryCode);
  const locale = COUNTRY_TO_LOCALE[countryCode];
  const regionConfig = getRegionConfig(locale);

  return {
    dataProtectionAuthority: dpa,
    governingLaw: GOVERNING_LAW[countryCode] || GOVERNING_LAW.IE,
    disputeResolution: DISPUTE_RESOLUTION[countryCode] || DISPUTE_RESOLUTION.IE,
    vatLabel: regionConfig.financial.tax.vatLabel,
    vatRate: regionConfig.financial.tax.vatRate,
    currency: regionConfig.financial.currency,
    currencySymbol: regionConfig.financial.currencySymbol,
    dataRetentionNote: DATA_RETENTION_NOTES[countryCode] || DATA_RETENTION_NOTES.IE,
    cookieLawRef: COOKIE_LAW_REFS[countryCode] || COOKIE_LAW_REFS.IE,
    taxRetentionNote: TAX_RETENTION_NOTES[countryCode] || TAX_RETENTION_NOTES.IE,
    gdprLabel: GDPR_LABELS[countryCode] || GDPR_LABELS.IE,
    internationalTransferSafeguards: INTERNATIONAL_TRANSFER_SAFEGUARDS[countryCode] || INTERNATIONAL_TRANSFER_SAFEGUARDS.IE,
    transferContext: TRANSFER_CONTEXT[countryCode] || TRANSFER_CONTEXT.IE,
    organisationalSpelling: ORGANISATIONAL_SPELLING[countryCode] || ORGANISATIONAL_SPELLING.IE,
    anonymisedSpelling: ANONYMISED_SPELLING[countryCode] || ANONYMISED_SPELLING.IE,
  };
}
