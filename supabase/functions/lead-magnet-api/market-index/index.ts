import {
  AdapterUnavailableError,
  MarketIndexAdapter,
  RegionalIndexResult,
  TrendPoint,
  VerificationOutcome,
} from "./types.ts";
import { csoIeAdapter } from "./adapters/cso-ie.ts";
import { onsGbAdapter } from "./adapters/ons-gb.ts";
import {
  absAuAdapter,
  fredUsAdapter,
  statCanAdapter,
  statsNzAdapter,
} from "./adapters/stubs.ts";
import { crossCheckPriceSeries } from "./cross-check.ts";
import { getCachedIndex, normalizeRegion, setCachedIndex } from "./cache.ts";

const ADAPTERS: Record<string, MarketIndexAdapter> = {
  IE: csoIeAdapter,
  GB: onsGbAdapter,
  US: fredUsAdapter,
  CA: statCanAdapter,
  AU: absAuAdapter,
  NZ: statsNzAdapter,
};

function getAdapter(countryCode: string): MarketIndexAdapter | null {
  return ADAPTERS[countryCode?.toUpperCase()] ?? null;
}

export interface VerifyTrendInput {
  supabase: any;
  countryCode: string;
  area: string;
  llmSeries: TrendPoint[] | undefined;
  years: number;
}

export interface VerifyTrendOutput {
  series: TrendPoint[] | undefined;
  verification: VerificationOutcome;
}

export async function verifyPriceTrend({
  supabase,
  countryCode,
  area,
  llmSeries,
  years,
}: VerifyTrendInput): Promise<VerifyTrendOutput> {
  if (!llmSeries || llmSeries.length < 2) {
    return {
      series: llmSeries,
      verification: { status: "unverified", note: "LLM series missing; nothing to verify." },
    };
  }

  const adapter = getAdapter(countryCode);
  if (!adapter) {
    return {
      series: llmSeries,
      verification: {
        status: "unverified",
        note: `No regional index adapter configured for ${countryCode}.`,
      },
    };
  }

  const regionKey = normalizeRegion(area);
  let regional: RegionalIndexResult | null = null;
  try {
    regional = await getCachedIndex(supabase, adapter.countryCode, regionKey);
    if (!regional) {
      regional = await adapter.fetchPriceIndex({ area, years });
      if (regional) {
        await setCachedIndex(supabase, adapter.countryCode, regionKey, regional);
      }
    }
  } catch (err) {
    if (err instanceof AdapterUnavailableError) {
      console.warn(`[market-index] ${err.message}`);
    } else {
      console.error(`[market-index] unexpected error`, err);
    }
    regional = null;
  }

  const outcome = crossCheckPriceSeries({ llmSeries, regional });
  return { series: outcome.series, verification: outcome.verification };
}
