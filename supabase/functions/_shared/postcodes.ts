/**
 * Edge-side postcode helpers — twin of src/lib/regionConfig/postcodes.ts.
 * Deno edge functions can't import from `src/`, so this mirrors the shape
 * and data. Keep in sync manually.
 */

import type { MarketCountry } from "./locale-config.ts";

export interface PostcodeConfig {
  countryCode: MarketCountry;
  countryName: string;
  label: string;
  placeholder: string;
  helperText: string;
  regex: RegExp;
  resolutionHint: string;
  /** Length used for fallback routing if `routingKey` returns empty. */
  routingKeyLength: number;
}

function normalizeUpperNoSpace(raw: string): string {
  return (raw || "").trim().toUpperCase().replace(/\s+/g, "");
}

export function normalizePostcode(raw: string): string {
  return normalizeUpperNoSpace(raw);
}

export const POSTCODE_CONFIGS: Record<MarketCountry, PostcodeConfig> = {
  IE: {
    countryCode: "IE",
    countryName: "Ireland",
    label: "Eircode",
    placeholder: "H53 YA97",
    helperText: "Irish Eircode (routing key + unique identifier).",
    regex: /^[AC-FHKNPRTV-Y]\d{2}\s?[0-9AC-FHKNPRTV-Y]{4}$/i,
    resolutionHint:
      "Irish Eircode routing keys (first 3 chars) map to specific areas — for example, H53 = Ballinasloe, D02 = Dublin 2, T12 = Cork city centre.",
    routingKeyLength: 3,
  },
  GB: {
    countryCode: "GB",
    countryName: "United Kingdom",
    label: "Postcode",
    placeholder: "SW1A 1AA",
    helperText: "UK postcode (outward + inward code).",
    regex: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i,
    resolutionHint:
      "UK postcode areas (1–2 leading letters) map to broad regions — e.g. SW/SE/N/NW/E/EC/WC/W = Greater London, M = Manchester, B = Birmingham, EH = Edinburgh, G = Glasgow, CF = Cardiff.",
    routingKeyLength: 2,
  },
  US: {
    countryCode: "US",
    countryName: "United States",
    label: "ZIP Code",
    placeholder: "90210",
    helperText: "US ZIP Code.",
    regex: /^\d{5}(-\d{4})?$/,
    resolutionHint:
      "US ZIP Codes: the first 3 digits identify a regional sectional center — e.g. 902 = Beverly Hills / West LA, 100 = Manhattan, 606 = Chicago North.",
    routingKeyLength: 3,
  },
  CA: {
    countryCode: "CA",
    countryName: "Canada",
    label: "Postal Code",
    placeholder: "M4B 1B3",
    helperText: "Canadian postal code.",
    regex: /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\s?\d[ABCEGHJ-NPRSTV-Z]\d$/i,
    resolutionHint:
      "Canadian postal codes: the first 3 chars are the Forward Sortation Area — e.g. M4B = East Toronto, V6B = Vancouver Yaletown, H2X = Montreal Plateau.",
    routingKeyLength: 3,
  },
  AU: {
    countryCode: "AU",
    countryName: "Australia",
    label: "Postcode",
    placeholder: "2000",
    helperText: "Australian 4-digit postcode.",
    regex: /^\d{4}$/,
    resolutionHint:
      "Australian postcodes: first digit indicates state (2=NSW/ACT, 3=VIC, 4=QLD, 5=SA, 6=WA, 7=TAS, 0=NT), first 2 chars localise further.",
    routingKeyLength: 2,
  },
  NZ: {
    countryCode: "NZ",
    countryName: "New Zealand",
    label: "Postcode",
    placeholder: "6011",
    helperText: "New Zealand 4-digit postcode.",
    regex: /^\d{4}$/,
    resolutionHint:
      "NZ postcodes: first digit indicates region (0=Northland/Auckland north, 1=Auckland, 3=Bay of Plenty/Waikato, 4=Wellington region, 6=Wellington city, 7=Nelson/Marlborough/West Coast, 8=Canterbury, 9=Otago/Southland).",
    routingKeyLength: 2,
  },
};

export function getPostcodeConfig(countryCode: string): PostcodeConfig {
  const code = (countryCode || "IE").toUpperCase() as MarketCountry;
  return POSTCODE_CONFIGS[code] || POSTCODE_CONFIGS.IE;
}

export function routingKeyFor(countryCode: string, normalized: string): string {
  if (!normalized) return "";
  const config = getPostcodeConfig(countryCode);
  if (config.countryCode === "GB") {
    const match = normalized.match(/^([A-Z]{1,2})/);
    return match ? match[1] : normalized.slice(0, 2);
  }
  return normalized.slice(0, config.routingKeyLength);
}

export function buildAreaKey(
  countryCode: string,
  answers: {
    postcode?: string | null;
    eircode?: string | null;
    town?: string | null;
    county?: string | null;
  },
): string {
  const config = getPostcodeConfig(countryCode);
  const rawPostcode = answers.postcode || answers.eircode || "";
  if (rawPostcode) {
    const normalized = normalizePostcode(rawPostcode);
    if (config.regex.test(rawPostcode) || config.regex.test(normalized)) {
      const key = routingKeyFor(countryCode, normalized);
      if (key) return `${config.countryCode}:${key}`;
    }
  }
  const town = (answers.town || "").toLowerCase().replace(/\s+/g, "_");
  const county = (answers.county || "").toLowerCase().replace(/\s+/g, "_");
  return `${config.countryCode}:${town}_${county}`;
}
