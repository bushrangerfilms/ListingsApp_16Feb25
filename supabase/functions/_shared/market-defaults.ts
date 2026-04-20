/**
 * Cold-start fallback market research tables per country + region tier.
 *
 * Primary path: Claude does the market research per specific area.
 * These defaults are only used when:
 *   - Claude is unavailable / errors / times out
 *   - The area has no cached research AND we need to return *something*
 *
 * Each entry is `${currency}/sqm` (or /sqft for US, CA — when those ship).
 * Internal property type codes are stable: `detached | semi | terrace | apartment | bungalow`.
 */

import type { MarketCountry } from "./locale-config.ts";

export type RegionTier = "premium" | "standard" | "value";

export interface MarketDefault {
  price_per_sqm_low: number;
  price_per_sqm_high: number;
  volatility: "low" | "medium" | "high";
  trend: "Rising" | "Stable" | "Declining";
  research_confidence: "strong" | "moderate" | "weak";
}

type PropertyTypeTable = Record<string, MarketDefault>;

type TieredTable = Record<RegionTier, PropertyTypeTable>;

// Ireland: single tier for now (matches today's behaviour exactly). Numbers
// lifted verbatim from the pre-refactor getDefaultMarketResearch in
// lead-magnet-api/index.ts so IE cold-start behaviour is bit-identical.
const IE_TABLE: PropertyTypeTable = {
  detached: { price_per_sqm_low: 2600, price_per_sqm_high: 3400, volatility: "medium", trend: "Stable", research_confidence: "moderate" },
  semi: { price_per_sqm_low: 2800, price_per_sqm_high: 3600, volatility: "medium", trend: "Stable", research_confidence: "moderate" },
  terrace: { price_per_sqm_low: 3000, price_per_sqm_high: 3800, volatility: "low", trend: "Stable", research_confidence: "moderate" },
  apartment: { price_per_sqm_low: 3500, price_per_sqm_high: 4500, volatility: "medium", trend: "Stable", research_confidence: "moderate" },
  bungalow: { price_per_sqm_low: 2700, price_per_sqm_high: 3500, volatility: "low", trend: "Stable", research_confidence: "moderate" },
};

// UK: tiered by postcode area. Premium tier covers Greater London + inner
// commuter belt; value tier covers North-East / Wales / Scotland (rural);
// standard is the mainland middle. Numbers are conservative — Claude will
// refine per-area when it runs.
const GB_TIERED: TieredTable = {
  premium: {
    detached: { price_per_sqm_low: 7500, price_per_sqm_high: 11500, volatility: "medium", trend: "Stable", research_confidence: "moderate" },
    semi: { price_per_sqm_low: 6500, price_per_sqm_high: 9500, volatility: "medium", trend: "Stable", research_confidence: "moderate" },
    terrace: { price_per_sqm_low: 7000, price_per_sqm_high: 10500, volatility: "medium", trend: "Stable", research_confidence: "moderate" },
    apartment: { price_per_sqm_low: 8000, price_per_sqm_high: 13000, volatility: "medium", trend: "Stable", research_confidence: "moderate" },
    bungalow: { price_per_sqm_low: 6500, price_per_sqm_high: 9500, volatility: "low", trend: "Stable", research_confidence: "moderate" },
  },
  standard: {
    detached: { price_per_sqm_low: 3200, price_per_sqm_high: 4800, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    semi: { price_per_sqm_low: 3000, price_per_sqm_high: 4400, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    terrace: { price_per_sqm_low: 3100, price_per_sqm_high: 4600, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    apartment: { price_per_sqm_low: 3400, price_per_sqm_high: 5200, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    bungalow: { price_per_sqm_low: 2800, price_per_sqm_high: 4200, volatility: "low", trend: "Stable", research_confidence: "moderate" },
  },
  value: {
    detached: { price_per_sqm_low: 2000, price_per_sqm_high: 3000, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    semi: { price_per_sqm_low: 1800, price_per_sqm_high: 2700, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    terrace: { price_per_sqm_low: 1700, price_per_sqm_high: 2600, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    apartment: { price_per_sqm_low: 2000, price_per_sqm_high: 3000, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    bungalow: { price_per_sqm_low: 1800, price_per_sqm_high: 2700, volatility: "low", trend: "Stable", research_confidence: "moderate" },
  },
};

// US: tiered by 3-digit ZIP prefix. Figures are $/sqft (US uses imperial).
// Premium = major coastal metros + high-demand sunbelt cores, value = rust
// belt / deep rural, standard = the rest.
const US_TIERED: TieredTable = {
  premium: {
    detached: { price_per_sqm_low: 600, price_per_sqm_high: 1200, volatility: "medium", trend: "Stable", research_confidence: "moderate" },
    semi: { price_per_sqm_low: 500, price_per_sqm_high: 950, volatility: "medium", trend: "Stable", research_confidence: "moderate" },
    terrace: { price_per_sqm_low: 550, price_per_sqm_high: 1050, volatility: "medium", trend: "Stable", research_confidence: "moderate" },
    apartment: { price_per_sqm_low: 700, price_per_sqm_high: 1400, volatility: "medium", trend: "Stable", research_confidence: "moderate" },
    bungalow: { price_per_sqm_low: 500, price_per_sqm_high: 900, volatility: "low", trend: "Stable", research_confidence: "moderate" },
  },
  standard: {
    detached: { price_per_sqm_low: 180, price_per_sqm_high: 320, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    semi: { price_per_sqm_low: 160, price_per_sqm_high: 280, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    terrace: { price_per_sqm_low: 170, price_per_sqm_high: 290, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    apartment: { price_per_sqm_low: 220, price_per_sqm_high: 360, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    bungalow: { price_per_sqm_low: 160, price_per_sqm_high: 260, volatility: "low", trend: "Stable", research_confidence: "moderate" },
  },
  value: {
    detached: { price_per_sqm_low: 100, price_per_sqm_high: 180, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    semi: { price_per_sqm_low: 90, price_per_sqm_high: 160, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    terrace: { price_per_sqm_low: 95, price_per_sqm_high: 170, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    apartment: { price_per_sqm_low: 110, price_per_sqm_high: 200, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    bungalow: { price_per_sqm_low: 85, price_per_sqm_high: 150, volatility: "low", trend: "Stable", research_confidence: "moderate" },
  },
};

// US ZIP3 tier mapping. Not exhaustive — representative samples. Defaults to "standard".
const US_ZIP3_TIERS: Record<string, RegionTier> = {
  // NYC / metro (100-104, 110-119)
  "100": "premium", "101": "premium", "102": "premium", "103": "premium", "104": "premium",
  "110": "premium", "111": "premium", "112": "premium", "113": "premium", "114": "premium",
  "115": "premium", "116": "premium", "117": "premium", "118": "premium", "119": "premium",
  // NJ inner commuter (070-074)
  "070": "premium", "071": "premium", "072": "premium", "073": "premium", "074": "premium",
  // Boston (021-022)
  "021": "premium", "022": "premium", "023": "standard", "024": "standard",
  // DC / Northern VA (200-202, 220-223)
  "200": "premium", "201": "premium", "202": "premium", "220": "premium", "221": "premium", "222": "premium", "223": "premium",
  // Miami / South FL (331, 330)
  "330": "premium", "331": "premium", "332": "premium", "333": "premium",
  // SF Bay Area (940-945, 949, 947)
  "940": "premium", "941": "premium", "942": "premium", "943": "premium", "944": "premium", "945": "premium", "947": "premium", "949": "premium",
  // LA / West LA / coastal (900-902, 904-905)
  "900": "premium", "901": "premium", "902": "premium", "904": "premium", "905": "premium",
  // Seattle (981, 980)
  "980": "premium", "981": "premium",
  // Denver / Boulder (802, 803)
  "802": "premium", "803": "premium",
  // Honolulu (968)
  "968": "premium",
  // Rust belt / deep rural / Mississippi delta (value tier samples)
  "386": "value", "387": "value", "389": "value", "390": "value", "391": "value", // rural MS
  "716": "value", "717": "value", "718": "value", // rural AR
  "442": "value", "443": "value", "446": "value", // rural OH
  "248": "value", "249": "value", // rural WV
};

function getUSTier(routingKey: string): RegionTier {
  return US_ZIP3_TIERS[routingKey] || "standard";
}

// CA: tiered by Forward Sortation Area (first 3 chars). Figures are C$/sqft.
// Premium = Toronto core + Vancouver core, standard = other metros, value = rural/maritime.
const CA_TIERED: TieredTable = {
  premium: {
    detached: { price_per_sqm_low: 700, price_per_sqm_high: 1400, volatility: "medium", trend: "Stable", research_confidence: "moderate" },
    semi: { price_per_sqm_low: 650, price_per_sqm_high: 1200, volatility: "medium", trend: "Stable", research_confidence: "moderate" },
    terrace: { price_per_sqm_low: 700, price_per_sqm_high: 1300, volatility: "medium", trend: "Stable", research_confidence: "moderate" },
    apartment: { price_per_sqm_low: 800, price_per_sqm_high: 1500, volatility: "medium", trend: "Stable", research_confidence: "moderate" },
    bungalow: { price_per_sqm_low: 600, price_per_sqm_high: 1100, volatility: "low", trend: "Stable", research_confidence: "moderate" },
  },
  standard: {
    detached: { price_per_sqm_low: 280, price_per_sqm_high: 450, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    semi: { price_per_sqm_low: 260, price_per_sqm_high: 420, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    terrace: { price_per_sqm_low: 270, price_per_sqm_high: 430, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    apartment: { price_per_sqm_low: 330, price_per_sqm_high: 500, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    bungalow: { price_per_sqm_low: 250, price_per_sqm_high: 380, volatility: "low", trend: "Stable", research_confidence: "moderate" },
  },
  value: {
    detached: { price_per_sqm_low: 150, price_per_sqm_high: 260, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    semi: { price_per_sqm_low: 140, price_per_sqm_high: 240, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    terrace: { price_per_sqm_low: 145, price_per_sqm_high: 250, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    apartment: { price_per_sqm_low: 180, price_per_sqm_high: 290, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    bungalow: { price_per_sqm_low: 130, price_per_sqm_high: 220, volatility: "low", trend: "Stable", research_confidence: "moderate" },
  },
};

// CA FSA tier mapping. Toronto core (M), Vancouver core (V6), Montreal core (H) partial.
const CA_FSA_TIERS: Record<string, RegionTier> = {
  // Toronto core — M5 downtown, M4 east-central, M6 west-central (premium)
  "M5A": "premium", "M5B": "premium", "M5C": "premium", "M5E": "premium", "M5G": "premium", "M5H": "premium",
  "M5J": "premium", "M5K": "premium", "M5L": "premium", "M5M": "premium", "M5N": "premium", "M5P": "premium",
  "M5R": "premium", "M5S": "premium", "M5T": "premium", "M5V": "premium", "M5W": "premium", "M5X": "premium",
  "M4A": "premium", "M4B": "premium", "M4C": "premium", "M4E": "premium", "M4G": "premium", "M4H": "premium",
  "M4J": "premium", "M4K": "premium", "M4L": "premium", "M4M": "premium", "M4N": "premium", "M4P": "premium",
  "M4R": "premium", "M4S": "premium", "M4T": "premium", "M4V": "premium", "M4W": "premium", "M4X": "premium", "M4Y": "premium",
  "M6A": "premium", "M6B": "premium", "M6C": "premium", "M6E": "premium", "M6G": "premium", "M6H": "premium",
  "M6J": "premium", "M6K": "premium", "M6L": "premium", "M6M": "premium", "M6N": "premium", "M6P": "premium",
  "M6R": "premium", "M6S": "premium",
  // Vancouver core — V6A-V6Z
  "V6A": "premium", "V6B": "premium", "V6C": "premium", "V6E": "premium", "V6G": "premium", "V6H": "premium",
  "V6J": "premium", "V6K": "premium", "V6L": "premium", "V6M": "premium", "V6N": "premium", "V6P": "premium",
  "V6R": "premium", "V6S": "premium", "V6T": "premium", "V6V": "premium", "V6W": "premium", "V6X": "premium",
  "V6Y": "premium", "V6Z": "premium",
  // Montreal Plateau / downtown partial
  "H2W": "premium", "H2X": "premium", "H2Y": "premium", "H2Z": "premium", "H3A": "premium", "H3B": "premium",
  "H3G": "premium", "H3H": "premium",
  // Maritime rural / Newfoundland rural (value samples)
  "A0A": "value", "A0B": "value", "A0C": "value", "A0E": "value", "A0G": "value", "A0H": "value", "A0J": "value",
  "B0E": "value", "B0J": "value", "B0K": "value", "B0M": "value", "B0N": "value", "B0P": "value",
  "C0A": "value", "C0B": "value",
  // Saskatchewan rural
  "S0A": "value", "S0C": "value", "S0E": "value", "S0G": "value", "S0H": "value", "S0J": "value", "S0K": "value",
};

function getCATier(routingKey: string): RegionTier {
  return CA_FSA_TIERS[routingKey.toUpperCase()] || "standard";
}

// AU: tiered by first 2 digits of 4-digit postcode. Figures are A$/sqm.
// Premium = Sydney/Melbourne inner, standard = major metros, value = regional/rural.
const AU_TIERED: TieredTable = {
  premium: {
    detached: { price_per_sqm_low: 7000, price_per_sqm_high: 12000, volatility: "medium", trend: "Stable", research_confidence: "moderate" },
    semi: { price_per_sqm_low: 6500, price_per_sqm_high: 11000, volatility: "medium", trend: "Stable", research_confidence: "moderate" },
    terrace: { price_per_sqm_low: 7500, price_per_sqm_high: 13000, volatility: "medium", trend: "Stable", research_confidence: "moderate" },
    apartment: { price_per_sqm_low: 8000, price_per_sqm_high: 14000, volatility: "medium", trend: "Stable", research_confidence: "moderate" },
    bungalow: { price_per_sqm_low: 6000, price_per_sqm_high: 10000, volatility: "low", trend: "Stable", research_confidence: "moderate" },
  },
  standard: {
    detached: { price_per_sqm_low: 3500, price_per_sqm_high: 5500, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    semi: { price_per_sqm_low: 3300, price_per_sqm_high: 5000, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    terrace: { price_per_sqm_low: 3400, price_per_sqm_high: 5200, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    apartment: { price_per_sqm_low: 4000, price_per_sqm_high: 6000, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    bungalow: { price_per_sqm_low: 3000, price_per_sqm_high: 4500, volatility: "low", trend: "Stable", research_confidence: "moderate" },
  },
  value: {
    detached: { price_per_sqm_low: 1800, price_per_sqm_high: 3000, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    semi: { price_per_sqm_low: 1700, price_per_sqm_high: 2800, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    terrace: { price_per_sqm_low: 1800, price_per_sqm_high: 2900, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    apartment: { price_per_sqm_low: 2000, price_per_sqm_high: 3200, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    bungalow: { price_per_sqm_low: 1600, price_per_sqm_high: 2600, volatility: "low", trend: "Stable", research_confidence: "moderate" },
  },
};

// AU postcode-prefix tier mapping (first 2 digits of a 4-digit postcode).
// NSW 20xx = Sydney CBD/inner; VIC 30xx = Melbourne CBD/inner; regional = value.
const AU_POSTCODE_TIERS: Record<string, RegionTier> = {
  "20": "premium", "21": "premium", // Sydney inner
  "30": "premium", "31": "premium", // Melbourne inner
  "40": "standard", "41": "standard", // Brisbane inner
  "28": "value", "29": "value", // NSW regional
  "38": "value", "39": "value", // VIC regional
  "48": "value", "49": "value", // QLD regional
  "08": "value", // NT
  "07": "value", // TAS
};

function getAUTier(routingKey: string): RegionTier {
  return AU_POSTCODE_TIERS[routingKey] || "standard";
}

// NZ: tiered by first 2 digits of 4-digit postcode. Figures are NZ$/sqm.
// Premium = Auckland inner, standard = Auckland wider / Wellington, value = regional.
const NZ_TIERED: TieredTable = {
  premium: {
    detached: { price_per_sqm_low: 8000, price_per_sqm_high: 14000, volatility: "medium", trend: "Stable", research_confidence: "moderate" },
    semi: { price_per_sqm_low: 7500, price_per_sqm_high: 13000, volatility: "medium", trend: "Stable", research_confidence: "moderate" },
    terrace: { price_per_sqm_low: 7800, price_per_sqm_high: 13500, volatility: "medium", trend: "Stable", research_confidence: "moderate" },
    apartment: { price_per_sqm_low: 8500, price_per_sqm_high: 15000, volatility: "medium", trend: "Stable", research_confidence: "moderate" },
    bungalow: { price_per_sqm_low: 7000, price_per_sqm_high: 12000, volatility: "low", trend: "Stable", research_confidence: "moderate" },
  },
  standard: {
    detached: { price_per_sqm_low: 4500, price_per_sqm_high: 7000, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    semi: { price_per_sqm_low: 4300, price_per_sqm_high: 6500, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    terrace: { price_per_sqm_low: 4400, price_per_sqm_high: 6700, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    apartment: { price_per_sqm_low: 5000, price_per_sqm_high: 7500, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    bungalow: { price_per_sqm_low: 4000, price_per_sqm_high: 6000, volatility: "low", trend: "Stable", research_confidence: "moderate" },
  },
  value: {
    detached: { price_per_sqm_low: 2500, price_per_sqm_high: 4000, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    semi: { price_per_sqm_low: 2400, price_per_sqm_high: 3800, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    terrace: { price_per_sqm_low: 2450, price_per_sqm_high: 3900, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    apartment: { price_per_sqm_low: 2800, price_per_sqm_high: 4200, volatility: "low", trend: "Stable", research_confidence: "moderate" },
    bungalow: { price_per_sqm_low: 2200, price_per_sqm_high: 3500, volatility: "low", trend: "Stable", research_confidence: "moderate" },
  },
};

// NZ postcode-prefix tier mapping (first 2 digits).
const NZ_POSTCODE_TIERS: Record<string, RegionTier> = {
  "10": "premium", "11": "premium", // Auckland inner CBD / Remuera / Newmarket
  "06": "standard", "60": "standard", "61": "standard", // Wellington city
  "80": "standard", "81": "standard", // Christchurch
  // Everything else stays standard; remote regional postcodes drop into value
  "02": "value", "03": "value", "04": "value", "05": "value", // Northland / far North
  "39": "value", "40": "value", "41": "value", "42": "value", // Taranaki / Wanganui rural
  "93": "value", "94": "value", "95": "value", "96": "value", "97": "value", // Otago / Southland rural
};

function getNZTier(routingKey: string): RegionTier {
  return NZ_POSTCODE_TIERS[routingKey] || "standard";
}

// UK postcode area tier mapping. Areas not listed → standard.
const GB_AREA_TIERS: Record<string, RegionTier> = {
  // Greater London + core commuter belt (premium)
  E: "premium", EC: "premium", N: "premium", NW: "premium", SE: "premium", SW: "premium", W: "premium", WC: "premium",
  BR: "premium", CR: "premium", DA: "premium", EN: "premium", HA: "premium", IG: "premium", KT: "premium",
  RM: "premium", SM: "premium", TW: "premium", UB: "premium", WD: "premium",
  // Home counties / inner commuter belt (premium — high demand, close-in)
  AL: "premium", GU: "premium", RH: "premium", RG: "premium", SL: "premium",
  // Known value regions (North-East, rural Wales, rural Scotland/Highlands)
  DH: "value", SR: "value", TS: "value", HU: "value", DN: "value", BD: "value",
  DL: "value", HG: "value",
  LD: "value", SA: "value", LL: "value", SY: "value",
  IV: "value", KW: "value", PH: "value", DG: "value", TD: "value", PA: "value",
  BT: "value", // Northern Ireland — low liquidity, flag as value tier by default
};

function getGBTier(routingKey: string): RegionTier {
  return GB_AREA_TIERS[routingKey?.toUpperCase()] || "standard";
}

export function getDefaultMarketResearch(
  countryCode: MarketCountry,
  propertyType: string,
  routingKey?: string,
): MarketDefault {
  const normalizedType = (propertyType || "semi").toLowerCase();

  if (countryCode === "IE") {
    return IE_TABLE[normalizedType] || IE_TABLE.semi;
  }

  if (countryCode === "GB") {
    const tier = getGBTier(routingKey || "");
    const table = GB_TIERED[tier];
    return table[normalizedType] || table.semi;
  }

  if (countryCode === "US") {
    const tier = getUSTier(routingKey || "");
    const table = US_TIERED[tier];
    return table[normalizedType] || table.semi;
  }

  if (countryCode === "CA") {
    const tier = getCATier(routingKey || "");
    const table = CA_TIERED[tier];
    return table[normalizedType] || table.semi;
  }

  if (countryCode === "AU") {
    const tier = getAUTier(routingKey || "");
    const table = AU_TIERED[tier];
    return table[normalizedType] || table.semi;
  }

  if (countryCode === "NZ") {
    const tier = getNZTier(routingKey || "");
    const table = NZ_TIERED[tier];
    return table[normalizedType] || table.semi;
  }

  // Unknown country — fall back to IE table structure.
  return IE_TABLE[normalizedType] || IE_TABLE.semi;
}

export { GB_AREA_TIERS };
