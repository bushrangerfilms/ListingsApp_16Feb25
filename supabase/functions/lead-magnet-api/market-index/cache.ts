import { RegionalIndexResult } from "./types.ts";

const CACHE_TTL_HOURS = 24;

export async function getCachedIndex(
  supabase: any,
  country: string,
  region: string,
): Promise<RegionalIndexResult | null> {
  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 3600 * 1000).toISOString();

  const { data } = await supabase
    .from("market_index_cache")
    .select("payload, fetched_at")
    .eq("country_code", country)
    .eq("region_key", region)
    .gte("fetched_at", cutoff)
    .maybeSingle();

  if (data?.payload) {
    return data.payload as RegionalIndexResult;
  }
  return null;
}

export async function setCachedIndex(
  supabase: any,
  country: string,
  region: string,
  payload: RegionalIndexResult,
): Promise<void> {
  await supabase
    .from("market_index_cache")
    .upsert(
      {
        country_code: country,
        region_key: region,
        payload,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "country_code,region_key" },
    );
}

export function normalizeRegion(area: string): string {
  return (area || "national")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "national";
}
