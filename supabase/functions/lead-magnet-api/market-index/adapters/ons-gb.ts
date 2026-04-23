import { AdapterUnavailableError, MarketIndexAdapter, RegionalIndexResult, TrendPoint } from "../types.ts";

const SOURCE = "ONS UK House Price Index";
const SERIES_ID = "chaw";
const DATASET_ID = "mm23";
const FETCH_TIMEOUT_MS = 6000;

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const onsGbAdapter: MarketIndexAdapter = {
  countryCode: "GB",
  source: SOURCE,

  async fetchPriceIndex({ years }): Promise<RegionalIndexResult> {
    const endYear = new Date().getUTCFullYear();
    const startYear = endYear - years;

    const url = `https://api.ons.gov.uk/timeseries/${SERIES_ID}/dataset/${DATASET_ID}/data`;

    let json: any;
    try {
      const resp = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
      if (!resp.ok) {
        throw new AdapterUnavailableError(SOURCE, `HTTP ${resp.status}`);
      }
      json = await resp.json();
    } catch (err) {
      if (err instanceof AdapterUnavailableError) throw err;
      throw new AdapterUnavailableError(SOURCE, `fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    const yearData = json?.years;
    if (!Array.isArray(yearData)) {
      throw new AdapterUnavailableError(SOURCE, "missing years array in response");
    }

    const points: TrendPoint[] = [];
    for (const entry of yearData) {
      const year = Number(entry?.year);
      const value = Number(entry?.value);
      if (!Number.isFinite(year) || !Number.isFinite(value)) continue;
      if (year < startYear || year > endYear) continue;
      points.push({ year, value });
    }

    if (points.length < 2) {
      throw new AdapterUnavailableError(SOURCE, "insufficient data points returned");
    }

    return {
      source: SOURCE,
      region: "United Kingdom (national)",
      points: points.sort((a, b) => a.year - b.year),
    };
  },
};
