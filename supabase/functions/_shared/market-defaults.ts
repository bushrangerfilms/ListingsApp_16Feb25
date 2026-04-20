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

  // Phase 2+ markets: fall back to IE table structure until their seed lands.
  // The launch-flag gate in handleGetConfig prevents reaching this for now.
  return IE_TABLE[normalizedType] || IE_TABLE.semi;
}

export { GB_AREA_TIERS };
