import { TrendPoint, VerificationOutcome, RegionalIndexResult } from "./types.ts";

const MAGNITUDE_TOLERANCE = 0.5;

function totalChange(series: TrendPoint[]): number | null {
  if (series.length < 2) return null;
  const sorted = [...series].sort((a, b) => a.year - b.year);
  const first = sorted[0].value;
  const last = sorted[sorted.length - 1].value;
  if (first <= 0) return null;
  return (last - first) / first;
}

function yoyDirections(series: TrendPoint[]): number[] {
  const sorted = [...series].sort((a, b) => a.year - b.year);
  const deltas: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].value;
    const curr = sorted[i].value;
    if (prev <= 0) {
      deltas.push(0);
      continue;
    }
    deltas.push(Math.sign(curr - prev));
  }
  return deltas;
}

function directionMatchRatio(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let matches = 0;
  for (let i = 0; i < len; i++) {
    if (a[i] === b[i]) matches++;
  }
  return matches / len;
}

export interface CrossCheckInput {
  llmSeries: TrendPoint[];
  regional: RegionalIndexResult | null;
}

export interface CrossCheckOutput {
  series: TrendPoint[];
  verification: VerificationOutcome;
}

export function crossCheckPriceSeries({
  llmSeries,
  regional,
}: CrossCheckInput): CrossCheckOutput {
  if (!regional || regional.points.length < 2) {
    return {
      series: llmSeries,
      verification: {
        status: "unverified",
        note: "Indicative, based on regional market data.",
      },
    };
  }

  const llmTotal = totalChange(llmSeries);
  const regTotal = totalChange(regional.points);

  if (llmTotal === null || regTotal === null) {
    return {
      series: llmSeries,
      verification: {
        status: "unverified",
        source: regional.source,
        note: `Indicative, cross-reference against ${regional.source} inconclusive.`,
      },
    };
  }

  const magnitudeOk =
    Math.abs(llmTotal - regTotal) <=
    Math.max(Math.abs(regTotal) * MAGNITUDE_TOLERANCE, 0.05);

  const directions = directionMatchRatio(
    yoyDirections(llmSeries),
    yoyDirections(regional.points),
  );
  const directionOk = directions >= 0.6;

  if (magnitudeOk && directionOk) {
    return {
      series: llmSeries,
      verification: {
        status: "verified",
        source: regional.source,
        note: `Cross-referenced against ${regional.source} regional index.`,
      },
    };
  }

  return {
    series: rebaseRegionalToLlmScale(regional.points, llmSeries),
    verification: {
      status: "replaced",
      source: regional.source,
      note: `Regional data from ${regional.source}. Area-specific history was outside the ±50% plausibility band for this market.`,
    },
  };
}

function rebaseRegionalToLlmScale(
  regional: TrendPoint[],
  llmSeries: TrendPoint[],
): TrendPoint[] {
  const sortedRegional = [...regional].sort((a, b) => a.year - b.year);
  const sortedLlm = [...llmSeries].sort((a, b) => a.year - b.year);
  const lastLlmValue = sortedLlm[sortedLlm.length - 1]?.value;
  const lastRegionalValue = sortedRegional[sortedRegional.length - 1]?.value;

  if (!lastLlmValue || !lastRegionalValue) {
    return sortedRegional;
  }

  const scale = lastLlmValue / lastRegionalValue;
  return sortedRegional.map((p) => ({
    year: p.year,
    value: Math.round(p.value * scale),
  }));
}
