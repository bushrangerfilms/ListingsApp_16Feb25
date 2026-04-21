import type { MarketCountry } from "@/lib/locale/markets";

export interface PostcodeConfig {
  countryCode: MarketCountry;
  countryName: string;
  label: string;
  placeholder: string;
  helperText: string;
  regex: RegExp;
  normalize: (raw: string) => string;
  routingKey: (normalized: string) => string;
  /** Short human-readable hint passed to Claude to explain this country's postcode→area mapping. */
  resolutionHint: string;
}

function normalizeUpperNoSpace(raw: string): string {
  return (raw || "").trim().toUpperCase().replace(/\s+/g, "");
}

export const POSTCODE_CONFIGS: Record<MarketCountry, PostcodeConfig> = {
  IE: {
    countryCode: "IE",
    countryName: "Ireland",
    label: "Eircode",
    placeholder: "e.g., D01 F5P2",
    helperText: "Your Eircode pinpoints your exact location for a more accurate estimate.",
    regex: /^[AC-FHKNPRTV-Y]\d{2}\s?[0-9AC-FHKNPRTV-Y]{4}$/i,
    normalize: (raw) => normalizeUpperNoSpace(raw),
    routingKey: (normalized) => {
      if (!normalized) return "";
      return normalized.slice(0, 3);
    },
    resolutionHint:
      "Irish Eircode routing keys (first 3 chars) map to specific areas — for example, H53 = Ballinasloe, D02 = Dublin 2, T12 = Cork city centre.",
  },
  GB: {
    countryCode: "GB",
    countryName: "United Kingdom",
    label: "Postcode",
    placeholder: "e.g., SW1A 1AA",
    helperText: "Your Postcode lets us give you an estimate anchored to your local area, not a national average.",
    regex: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i,
    normalize: (raw) => normalizeUpperNoSpace(raw),
    routingKey: (normalized) => {
      if (!normalized) return "";
      // UK postcode "area" = 1–2 leading letters (the bit before any digit).
      const match = normalized.match(/^([A-Z]{1,2})/);
      return match ? match[1] : normalized.slice(0, 2);
    },
    resolutionHint:
      "UK postcode areas (1–2 leading letters) map to broad regions — e.g. SW/SE/N/NW/E/EC/WC/W = Greater London, M = Manchester, B = Birmingham, EH = Edinburgh, G = Glasgow, CF = Cardiff.",
  },
  // TODO(Phase 2): populate real configs when we activate these markets.
  US: {
    countryCode: "US",
    countryName: "United States",
    label: "ZIP Code",
    placeholder: "e.g., 90210",
    helperText: "Your ZIP Code anchors the estimate to your local area.",
    regex: /^\d{5}(-\d{4})?$/,
    normalize: (raw) => normalizeUpperNoSpace(raw),
    routingKey: (normalized) => normalized.slice(0, 3),
    resolutionHint:
      "US ZIP Codes: the first 3 digits identify a regional sectional center — e.g. 902 = Beverly Hills / West LA, 100 = Manhattan, 606 = Chicago North.",
  },
  CA: {
    countryCode: "CA",
    countryName: "Canada",
    label: "Postal Code",
    placeholder: "e.g., M4B 1B3",
    helperText: "Your Postal Code's Forward Sortation Area anchors the estimate to your local area.",
    regex: /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\s?\d[ABCEGHJ-NPRSTV-Z]\d$/i,
    normalize: (raw) => normalizeUpperNoSpace(raw),
    routingKey: (normalized) => normalized.slice(0, 3),
    resolutionHint:
      "Canadian postal codes: the first 3 chars are the Forward Sortation Area — e.g. M4B = East Toronto, V6B = Vancouver Yaletown, H2X = Montreal Plateau.",
  },
  AU: {
    countryCode: "AU",
    countryName: "Australia",
    label: "Postcode",
    placeholder: "e.g., 2000",
    helperText: "Your Postcode anchors the estimate to your local area.",
    regex: /^\d{4}$/,
    normalize: (raw) => normalizeUpperNoSpace(raw),
    routingKey: (normalized) => normalized.slice(0, 2),
    resolutionHint:
      "Australian postcodes: first digit indicates state (2=NSW/ACT, 3=VIC, 4=QLD, 5=SA, 6=WA, 7=TAS, 0=NT), first 2 chars localise further (e.g. 20 = Sydney CBD / inner, 30 = Melbourne CBD / inner).",
  },
  NZ: {
    countryCode: "NZ",
    countryName: "New Zealand",
    label: "Postcode",
    placeholder: "e.g., 6011",
    helperText: "Your Postcode anchors the estimate to your local area.",
    regex: /^\d{4}$/,
    normalize: (raw) => normalizeUpperNoSpace(raw),
    routingKey: (normalized) => normalized.slice(0, 2),
    resolutionHint:
      "NZ postcodes: first digit indicates region (0=Northland/Auckland north, 1=Auckland, 3=Bay of Plenty/Waikato, 4=Wellington region, 6=Wellington city, 7=Nelson/Marlborough/West Coast, 8=Canterbury, 9=Otago/Southland).",
  },
};

export function getPostcodeConfig(countryCode: string): PostcodeConfig {
  const code = (countryCode || "IE").toUpperCase() as MarketCountry;
  return POSTCODE_CONFIGS[code] || POSTCODE_CONFIGS.IE;
}

export function buildAreaKey(
  countryCode: string,
  answers: { postcode?: string | null; eircode?: string | null; town?: string | null; county?: string | null },
): string {
  const config = getPostcodeConfig(countryCode);
  const rawPostcode = answers.postcode || answers.eircode || "";
  if (rawPostcode) {
    const normalized = config.normalize(rawPostcode);
    if (config.regex.test(normalized) || config.regex.test(rawPostcode)) {
      const key = config.routingKey(normalized);
      if (key) return `${config.countryCode}:${key}`;
    }
  }
  const town = (answers.town || "").toLowerCase().replace(/\s+/g, "_");
  const county = (answers.county || "").toLowerCase().replace(/\s+/g, "_");
  return `${config.countryCode}:${town}_${county}`;
}
