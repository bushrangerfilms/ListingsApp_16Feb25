import type { RegionConfig } from '@/lib/locale/config';

/**
 * Brochure page-size helpers.  Drive the @react-pdf/renderer `<Page size>` prop
 * off the canonical `regionConfig.paperFormat` instead of branching on locale
 * ids.  IE / GB / AU / NZ default to A4 (and "A5" half-fold for booklet);
 * US / CA default to Letter (and "Half Letter" / "Statement" 5.5×8.5" for the
 * booklet equivalent).
 *
 * Dimensions in points (1 in = 72 pt).  The numeric tuples are the recognised
 * @react-pdf custom-size shape; the `'A5'` / `'A4'` strings are pdfkit's
 * built-in named sizes.
 */

/** Booklet (folded) page size — A5 in metric, Half Letter in imperial. */
export function getBookletPageSize(config: RegionConfig): 'A5' | [number, number] {
  return config.paperFormat === 'Letter' ? [396, 612] : 'A5';
}

/** Landscape "spread" page size used for print-imposed booklets. */
export function getLandscapeSpreadSize(config: RegionConfig): [number, number] {
  // A4 landscape (841.89 × 595.28 pt) for metric markets;
  // Letter landscape (792 × 612 pt) for imperial markets.
  return config.paperFormat === 'Letter' ? [792, 612] : [841.89, 595.28];
}

/**
 * Single-page brochure size — A4 in metric, Letter in imperial.  Used by the
 * non-booklet templates that render one page per "panel".
 */
export function getSinglePageSize(config: RegionConfig): 'A4' | 'LETTER' {
  return config.paperFormat === 'Letter' ? 'LETTER' : 'A4';
}
