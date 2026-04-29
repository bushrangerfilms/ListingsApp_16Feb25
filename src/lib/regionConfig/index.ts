/**
 * regionConfig — back-compat shim over the canonical locale config.
 *
 * Historically this file (and per-locale siblings ie.ts / gb.ts / etc.) held
 * the source of truth for every locale-keyed value used by the Listings frontend.
 * As of Checkpoint A + C of the locale-architecture rollout, that role has moved
 * to /locale-config/locale.config.ts (mirrored to src/lib/locale/config.ts).
 *
 * This file remains as a thin adaptor so existing call-sites
 * (`import { getRegionConfig } from '@/lib/regionConfig'`) keep working.
 * It does two things only:
 *   1. Re-exports the canonical types and helpers under their existing names.
 *   2. Wraps `getRegionConfig` to add the four legacy shape adaptors:
 *      - `address.postalCodePattern: RegExp`        (canonical: source + flags strings)
 *      - `property.measurements.convertFromSqm/convertToSqm: function`
 *           (canonical: `sqmDisplayMultiplier: number`)
 *      - `property.measurements.convertFromAcres/convertToAcres: function`
 *           (canonical: `acresDisplayMultiplier: number`)
 *
 * Forward direction: new consumers should `import from '@/lib/locale/config'` and
 * use the canonical shape directly.  Once no consumer of this shim remains, the
 * shim can be deleted.  Until then, edit canonical, then run
 * `npx tsx locale-config/sync.ts` — never edit any file in this directory.
 *
 * The per-locale data files (ie.ts, gb.ts, us.ts, ca.ts, au.ts, nz.ts) that
 * previously sat next to this index.ts were deleted in the same PR — their
 * data now lives in canonical.  postcodes.ts (and its `getPostcodeConfig`
 * helper) is intentionally retained: it carries fields the canonical doesn't,
 * notably the lead-magnet quiz's `helperText` / `routingKey` / `resolutionHint`.
 */

import {
  LOCALE_CONFIGS as CANON_LOCALE_CONFIGS,
  type RegionConfig as CanonicalRegionConfig,
  type AddressConfig as CanonicalAddressConfig,
  type MeasurementsConfig as CanonicalMeasurementsConfig,
  type PropertyConfig as CanonicalPropertyConfig,
  type MarketLocale,
  DEFAULT_LOCALE,
  postalCodeRegex,
} from '@/lib/locale/config';

// ────────────────────────────────────────────────────────────────────────────
// Re-export canonical types under their legacy names where the shapes match.
// ────────────────────────────────────────────────────────────────────────────

export type {
  EnergyRating,
  EnergyRatingsConfig,
  BuildingType,
  TaxConfig,
  LegalTerminology,
  ComplianceConfig,
  RegulatoryConfig,
  LegalConfig,
  FinancialConfig,
  DateTimeConfig,
} from '@/lib/locale/config';

// ────────────────────────────────────────────────────────────────────────────
// Legacy-shape interfaces  —  declared here because they extend canonical
// shapes with the four back-compat fields callers still rely on.
// ────────────────────────────────────────────────────────────────────────────

export interface MeasurementsConfig extends CanonicalMeasurementsConfig {
  /** Convert a stored sqm value to the locale's display unit. */
  convertFromSqm: (sqm: number) => number;
  /** Convert a value in the locale's display unit back to sqm. */
  convertToSqm: (value: number) => number;
  /** Convert a stored acres value to the locale's display unit. */
  convertFromAcres: (acres: number) => number;
  /** Convert a value in the locale's display unit back to acres. */
  convertToAcres: (value: number) => number;
}

export interface AddressConfig extends CanonicalAddressConfig {
  /** Compiled regex from canonical's source+flags. */
  postalCodePattern: RegExp;
}

export interface PropertyConfig extends Omit<CanonicalPropertyConfig, 'measurements'> {
  measurements: MeasurementsConfig;
}

export interface RegionConfig extends Omit<CanonicalRegionConfig, 'address' | 'property'> {
  address: AddressConfig;
  property: PropertyConfig;
}

// ────────────────────────────────────────────────────────────────────────────
// Adaptor — converts canonical RegionConfig into the legacy shape (with
// derived RegExp + convert functions).  Cached per-locale so consumers
// receive a stable reference and the RegExp isn't recompiled on every call.
// ────────────────────────────────────────────────────────────────────────────

function adapt(canonical: CanonicalRegionConfig): RegionConfig {
  const m = canonical.property.measurements;
  return {
    ...canonical,
    address: {
      ...canonical.address,
      postalCodePattern: postalCodeRegex(canonical),
    },
    property: {
      ...canonical.property,
      measurements: {
        ...m,
        convertFromSqm: (sqm: number) => sqm * m.sqmDisplayMultiplier,
        convertToSqm: (value: number) => value / m.sqmDisplayMultiplier,
        convertFromAcres: (acres: number) => acres * m.acresDisplayMultiplier,
        convertToAcres: (value: number) => value / m.acresDisplayMultiplier,
      },
    },
  };
}

const ADAPTED_CONFIGS: Record<MarketLocale, RegionConfig> = {
  'en-IE': adapt(CANON_LOCALE_CONFIGS['en-IE']),
  'en-GB': adapt(CANON_LOCALE_CONFIGS['en-GB']),
  'en-US': adapt(CANON_LOCALE_CONFIGS['en-US']),
  'en-CA': adapt(CANON_LOCALE_CONFIGS['en-CA']),
  'en-AU': adapt(CANON_LOCALE_CONFIGS['en-AU']),
  'en-NZ': adapt(CANON_LOCALE_CONFIGS['en-NZ']),
};

// ────────────────────────────────────────────────────────────────────────────
// Public API  —  identical signatures to the pre-shim implementation.
// ────────────────────────────────────────────────────────────────────────────

export function getRegionConfig(locale: string | null | undefined): RegionConfig {
  if (locale && (locale as MarketLocale) in ADAPTED_CONFIGS) {
    return ADAPTED_CONFIGS[locale as MarketLocale];
  }
  return ADAPTED_CONFIGS[DEFAULT_LOCALE];
}

export function getAllRegionConfigs(): RegionConfig[] {
  return Object.values(ADAPTED_CONFIGS);
}
