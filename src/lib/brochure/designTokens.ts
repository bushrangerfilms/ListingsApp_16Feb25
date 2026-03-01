/**
 * Brochure Design Tokens
 *
 * Centralised spacing, typography, and layout constants for the PDF brochure template.
 * All values are in points (1mm ≈ 2.835pt).
 */

// ── Spacing Scale (4mm base unit) ──────────────────────────────────────

const UNIT = 11.34; // ~4mm in points

export const SPACING = {
  /** ~4mm — minimum gap (heading→content, image→caption) */
  S1: UNIT,
  /** ~8mm — between sections */
  S2: UNIT * 2,
  /** ~12mm — major section breaks */
  S3: UNIT * 3,
  /** ~16mm — page-level padding / footer clearance */
  S4: UNIT * 4,
  /** Half unit — tight internal gaps */
  HALF: UNIT / 2,
} as const;

/** Tighter spacing variant (10-15% reduction for refined vertical rhythm) */
export const TIGHT = {
  S1: UNIT * 0.85,   // ~9.6pt (vs 11.34pt)
  S2: UNIT * 1.7,    // ~19.3pt (vs 22.68pt)
  HALF: UNIT * 0.42, // ~4.8pt (vs 5.67pt)
} as const;

/** Price zone spacing — min clearance above/below price elements */
export const PRICE_ZONE = {
  /** Space above price: 2× body line height (~27pt) */
  above: UNIT * 2.4,
  /** Space below price: 1.5× body line height (~20pt) */
  below: UNIT * 1.8,
  /** Min distance from bottom trim (~15mm = ~42pt) */
  minFromTrim: 42,
} as const;

// ── Page Format & Layout Dimensions ──────────────────────────────────

export type BrochurePageFormat = 'a4' | 'a5';

export interface LayoutDimensions {
  heroImageHeight: number;
  accentPhotoHeight: number;
  backGalleryHeight: number;          // 2x2 grid photo height (with floor plans)
  backGalleryHeightLarge: number;     // 2x2 grid photo height (no floor plans)
  backSinglePhotoHeight: number;      // single large photo (with floor plans)
  backSinglePhotoHeightLarge: number; // single large photo (no floor plans)
  roomPhotoCompact: { width: number; height: number };
  roomPhotoStandard: { width: number; height: number };
  innerGutter: number;
  outerTrim: number;
  floorPlanMaxHeight: number;
  logoMaxWidth: number;
  logoMaxHeight: number;
  certLogoHeight: number;
}

/** Returns all layout-variable dimensions scaled for the target page format */
export function getLayoutDimensions(format: BrochurePageFormat): LayoutDimensions {
  if (format === 'a5') {
    return {
      heroImageHeight: 275,              // 400 * 0.69
      accentPhotoHeight: 90,             // 130 * 0.69
      backGalleryHeight: 62,             // 90 * 0.69
      backGalleryHeightLarge: 155,       // 220 * 0.70
      backSinglePhotoHeight: 150,        // 220 * 0.68
      backSinglePhotoHeightLarge: 265,   // 380 * 0.70
      roomPhotoCompact: { width: 84, height: 56 },
      roomPhotoStandard: { width: 70, height: 52 },
      innerGutter: 36,                   // 51 * 0.71
      outerTrim: 24,                     // 34 * 0.71
      floorPlanMaxHeight: 155,
      logoMaxWidth: 70,
      logoMaxHeight: 35,
      certLogoHeight: 18,
    };
  }
  // A4 defaults (current values)
  return {
    heroImageHeight: HERO_IMAGE_HEIGHT,  // 400
    accentPhotoHeight: 130,
    backGalleryHeight: 90,
    backGalleryHeightLarge: 220,
    backSinglePhotoHeight: 220,
    backSinglePhotoHeightLarge: 380,
    roomPhotoCompact: { width: 120, height: 80 },
    roomPhotoStandard: { width: 100, height: 75 },
    innerGutter: INNER_GUTTER,           // 51
    outerTrim: OUTER_TRIM,               // 34
    floorPlanMaxHeight: 220,
    logoMaxWidth: 100,
    logoMaxHeight: 50,
    certLogoHeight: 24,
  };
}

/** Font size overrides for display-level text at A5 (body text stays the same) */
export function getTypeOverrides(format: BrochurePageFormat): Record<string, { fontSize: number }> {
  if (format === 'a5') {
    return {
      coverAddress: { fontSize: 14 },
      coverPrice: { fontSize: 17 },
      priceBanner: { fontSize: 18 },
      backPrice: { fontSize: 14 },
      headerBusinessName: { fontSize: 10 },
    };
  }
  return {};
}

// ── Gutter-Aware Margins ───────────────────────────────────────────────

const INNER_GUTTER = 51; // ~18mm (fold side)
const OUTER_TRIM = 34;   // ~12mm (trim side)

/**
 * Returns left/right padding for a given page number.
 * Pages 1,3 are recto (right-hand): gutter on LEFT.
 * Pages 2,4 are verso (left-hand): gutter on RIGHT.
 */
export function getPageMargins(pageNumber: 1 | 2 | 3 | 4, dims?: LayoutDimensions) {
  const gutter = dims?.innerGutter ?? INNER_GUTTER;
  const trim = dims?.outerTrim ?? OUTER_TRIM;
  const isRecto = pageNumber % 2 === 1;
  return {
    paddingLeft: isRecto ? gutter : trim,
    paddingRight: isRecto ? trim : gutter,
  };
}

/** Top/bottom padding for content areas */
export const PAGE_VERTICAL = {
  top: 10,
  bottom: SPACING.S2, // ~23pt — standard bottom padding (footer is in-flow)
} as const;

// ── Typography Scale ───────────────────────────────────────────────────

export const TYPE = {
  coverAddress: { fontSize: 18, fontFamily: 'Helvetica-Bold' as const, letterSpacing: 1.5, textTransform: 'uppercase' as const },
  coverSaleMethod: { fontSize: 9, fontFamily: 'Helvetica' as const, letterSpacing: 2, textTransform: 'uppercase' as const },
  coverPrice: { fontSize: 22, fontFamily: 'Helvetica-Bold' as const },
  coverDescription: { fontSize: 9, fontFamily: 'Helvetica' as const, lineHeight: 1.5 },

  sectionTitle: { fontSize: 10.5, fontFamily: 'Helvetica-Bold' as const, letterSpacing: 1.0, textTransform: 'uppercase' as const },
  floorHeading: { fontSize: 9.5, fontFamily: 'Helvetica-Bold' as const },

  body: { fontSize: 9, fontFamily: 'Helvetica' as const, lineHeight: 1.5 },
  bodySmall: { fontSize: 8, fontFamily: 'Helvetica' as const },
  bullet: { fontSize: 8, fontFamily: 'Helvetica' as const, lineHeight: 1.35 },
  keyFeature: { fontSize: 8.5, fontFamily: 'Helvetica' as const },
  featureTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold' as const, letterSpacing: 0.5, textTransform: 'uppercase' as const },

  roomName: { fontSize: 9, fontFamily: 'Helvetica-Bold' as const },
  roomDimensions: { fontSize: 8, fontFamily: 'Helvetica' as const },
  roomDescription: { fontSize: 8, fontFamily: 'Helvetica' as const, lineHeight: 1.35 },

  location: { fontSize: 9, fontFamily: 'Helvetica' as const, lineHeight: 1.45 },

  caption: { fontSize: 7, fontFamily: 'Helvetica-Oblique' as const },
  disclaimer: { fontSize: 6.5, fontFamily: 'Helvetica' as const, lineHeight: 1.5 },
  licence: { fontSize: 6.5, fontFamily: 'Helvetica' as const },

  headerBusinessName: { fontSize: 12, fontFamily: 'Helvetica-Bold' as const },
  headerBusinessNameCompact: { fontSize: 9, fontFamily: 'Helvetica-Bold' as const },
  headerContact: { fontSize: 7.5, fontFamily: 'Helvetica' as const },
  headerLicence: { fontSize: 6.5, fontFamily: 'Helvetica' as const },

  backPrice: { fontSize: 18, fontFamily: 'Helvetica-Bold' as const },
  priceBanner: { fontSize: 24, fontFamily: 'Helvetica-Bold' as const },

  floorPlanLabel: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' as const, letterSpacing: 0.5, textTransform: 'uppercase' as const },
  floorPlanNote: { fontSize: 6.5, fontFamily: 'Helvetica-Oblique' as const },
} as const;

// ── Colour Tokens ──────────────────────────────────────────────────────

export const COLORS = {
  textPrimary: '#1a1a1a',
  textSecondary: '#555',
  textMuted: '#888',
  border: '#e5e5e5',
  borderLight: '#e0e0e0',
  rule: '#ddd',
  subtleBg: '#fafbfc',
  white: '#fff',
} as const;

// ── Image Helpers ──────────────────────────────────────────────────────

import type { BrochureStyleOptions } from './types';

export function getImageRadius(styleOptions?: BrochureStyleOptions): number {
  return styleOptions?.imageCornerRadius === 'square' ? 0 : 3;
}

export function getImageBorderStyle(styleOptions?: BrochureStyleOptions) {
  if (styleOptions?.imageBorder === false) return {};
  return {
    borderWidth: 0.5,
    borderColor: COLORS.border,
  };
}

// ── Layout Constants ───────────────────────────────────────────────────

/** Height of the thin accent strip at top of framed headers */
export const ACCENT_STRIP_HEIGHT = 4;

/** Height of the hero image on the cover */
export const HERO_IMAGE_HEIGHT = 400;

/** Thin rule weight for separators */
export const RULE_WEIGHT = 0.5;

/** Heavier rule weight for section dividers */
export const RULE_WEIGHT_HEAVY = 0.75;

// ── Text Normalization ────────────────────────────────────────────────

/** Strip soft hyphens, zero-width chars, fix encoding artifacts before PDF rendering */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\u00AD/g, '')                // soft hyphens
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width spaces, joiners, BOM
    .replace(/\u201C/g, '"')               // left curly double quote → straight
    .replace(/\u201D/g, '"')               // right curly double quote → straight
    .trim();
}
