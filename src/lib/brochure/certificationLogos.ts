/**
 * Built-in certification / industry logo registry for brochure back cover.
 * Filtered by locale to show relevant logos per market.
 */

export interface BuiltInCertificationLogo {
  id: string;
  name: string;
  /** Short description of the organization */
  description: string;
  /** Logo URL — local path (public/logos/), Supabase storage URL, or empty */
  url: string;
  /** Which locales this logo is relevant for */
  locales: string[];
  category: 'regulatory' | 'professional' | 'quality';
}

export const BUILT_IN_LOGOS: BuiltInCertificationLogo[] = [
  // Ireland
  { id: 'ipav', name: 'IPAV', description: 'Institute of Professional Auctioneers & Valuers', url: '/logos/ipav.png', locales: ['en-IE'], category: 'professional' },
  { id: 'scsi', name: 'SCSI', description: 'Society of Chartered Surveyors Ireland', url: '/logos/scsi.png', locales: ['en-IE'], category: 'professional' },
  { id: 'psra', name: 'PSRA', description: 'Property Services Regulatory Authority', url: '/logos/psra.png', locales: ['en-IE'], category: 'regulatory' },
  { id: 'tegova', name: 'TEGoVA', description: 'The European Group of Valuers\u2019 Associations', url: '/logos/tegova.png', locales: ['en-IE', 'en-GB'], category: 'professional' },

  // UK
  { id: 'rics', name: 'RICS', description: 'Royal Institution of Chartered Surveyors', url: '/logos/rics.png', locales: ['en-GB', 'en-IE'], category: 'professional' },
  { id: 'naea', name: 'NAEA Propertymark', description: 'National Association of Estate Agents', url: '', locales: ['en-GB'], category: 'professional' },
  { id: 'tpo', name: 'TPO', description: 'The Property Ombudsman', url: '', locales: ['en-GB'], category: 'regulatory' },

  // US
  { id: 'nar', name: 'NAR', description: 'National Association of REALTORS', url: '', locales: ['en-US'], category: 'professional' },
  { id: 'realtor', name: 'REALTOR\u00AE', description: 'REALTOR\u00AE Trademark', url: '', locales: ['en-US'], category: 'professional' },

  // Australia
  { id: 'reia', name: 'REIA', description: 'Real Estate Institute of Australia', url: '', locales: ['en-AU'], category: 'professional' },

  // Canada
  { id: 'crea', name: 'CREA', description: 'Canadian Real Estate Association', url: '', locales: ['en-CA'], category: 'professional' },
];

/** Get built-in logos relevant to a given locale */
export function getLogosForLocale(locale: string): BuiltInCertificationLogo[] {
  return BUILT_IN_LOGOS.filter((logo) => logo.locales.includes(locale));
}
