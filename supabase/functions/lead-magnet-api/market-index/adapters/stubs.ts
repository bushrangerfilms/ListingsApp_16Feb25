import { AdapterUnavailableError, MarketIndexAdapter } from "../types.ts";

function makeStub(countryCode: string, source: string): MarketIndexAdapter {
  return {
    countryCode,
    source,
    fetchPriceIndex() {
      throw new AdapterUnavailableError(source, "adapter not yet implemented");
    },
  };
}

export const fredUsAdapter = makeStub("US", "FRED Case-Shiller HPI");
export const statCanAdapter = makeStub("CA", "StatCan New Housing Price Index");
export const absAuAdapter = makeStub("AU", "ABS Residential Property Price Index");
export const statsNzAdapter = makeStub("NZ", "Stats NZ House Price Index");
