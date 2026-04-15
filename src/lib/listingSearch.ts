/**
 * Strip currency symbols, commas, and whitespace from a string to get a raw numeric form.
 * e.g. "€350,000" → "350000", "$1,200,000" → "1200000"
 */
function stripCurrency(str: string): string {
  return str.replace(/[€£$,\s]/g, '');
}

/**
 * Multi-term search across listing fields.
 * Splits query into words; ALL words must match at least one field (AND logic).
 * Price-aware: strips currency symbols/commas so "€350,000" matches price 350000.
 */
export function matchesListingSearch(
  listing: {
    title?: string;
    addressLine1?: string;
    addressLine2?: string;
    addressTown?: string;
    county?: string;
    eircode?: string;
    description?: string;
    specs?: string;
    buildingType?: string;
    bedrooms?: string | number;
    bathrooms?: string | number;
    price?: string | number;
  },
  searchQuery: string
): boolean {
  if (!searchQuery.trim()) return true;

  const searchableText = [
    listing.title,
    listing.addressLine1,
    listing.addressLine2,
    listing.addressTown,
    listing.county,
    listing.eircode,
    listing.description,
    listing.specs,
    listing.buildingType,
    listing.bedrooms != null ? String(listing.bedrooms) : undefined,
    listing.bathrooms != null ? String(listing.bathrooms) : undefined,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Price as plain digits for numeric matching
  const priceStr = listing.price != null ? String(listing.price) : '';

  const words = searchQuery.toLowerCase().trim().split(/\s+/);
  return words.every(word => {
    // Check text fields first
    if (searchableText.includes(word)) return true;

    // If the word looks like it could be a price (has digits, possibly with currency/commas),
    // strip formatting and check against the listing price
    const stripped = stripCurrency(word);
    if (stripped && /^\d+$/.test(stripped) && priceStr) {
      return priceStr.includes(stripped);
    }

    return false;
  });
}
