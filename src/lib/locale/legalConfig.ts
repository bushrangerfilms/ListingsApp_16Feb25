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
  };
}
