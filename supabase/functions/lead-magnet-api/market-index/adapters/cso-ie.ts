import { AdapterUnavailableError, MarketIndexAdapter, RegionalIndexResult, TrendPoint } from "../types.ts";

const SOURCE = "Eurostat HPI (prc_hpi_a)";
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

export const csoIeAdapter: MarketIndexAdapter = {
  countryCode: "IE",
  source: SOURCE,

  async fetchPriceIndex({ years }): Promise<RegionalIndexResult> {
    const endYear = new Date().getUTCFullYear();
    const startYear = endYear - years;

    const url =
      `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hpi_a` +
      `?format=JSON&lang=EN&geo=IE&unit=INX_A_AVG&purchase=TOTAL` +
      `&sinceTimePeriod=${startYear}`;

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

    const timeDim = json?.dimension?.time?.category;
    const timeIndex = timeDim?.index;
    const values = json?.value;

    if (!timeIndex || !values) {
      throw new AdapterUnavailableError(SOURCE, "malformed JSON-stat response");
    }

    const labels: string[] = Array.isArray(timeIndex)
      ? timeIndex
      : Object.keys(timeIndex).sort((a, b) => (timeIndex[a] as number) - (timeIndex[b] as number));

    const points: TrendPoint[] = [];
    for (let i = 0; i < labels.length; i++) {
      const year = Number(labels[i]);
      if (!Number.isFinite(year)) continue;
      const rawValue = Array.isArray(values) ? values[i] : values[String(i)];
      if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) continue;
      if (year < startYear || year > endYear) continue;
      points.push({ year, value: rawValue });
    }

    if (points.length < 2) {
      throw new AdapterUnavailableError(SOURCE, "insufficient data points returned");
    }

    return {
      source: SOURCE,
      region: "Ireland (national)",
      points: points.sort((a, b) => a.year - b.year),
    };
  },
};
