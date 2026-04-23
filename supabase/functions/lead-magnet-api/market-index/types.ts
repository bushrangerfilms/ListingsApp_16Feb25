export interface TrendPoint {
  year: number;
  value: number;
}

export interface RegionalIndexResult {
  source: string;
  region: string;
  points: TrendPoint[];
}

export class AdapterUnavailableError extends Error {
  constructor(public source: string, reason: string) {
    super(`[${source}] ${reason}`);
    this.name = "AdapterUnavailableError";
  }
}

export interface MarketIndexAdapter {
  countryCode: string;
  source: string;
  fetchPriceIndex(params: {
    area: string;
    years: number;
  }): Promise<RegionalIndexResult>;
}

export type VerificationStatus = "verified" | "replaced" | "unverified";

export interface VerificationOutcome {
  status: VerificationStatus;
  source?: string;
  note?: string;
}
