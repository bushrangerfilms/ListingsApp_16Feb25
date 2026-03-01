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

// ── Gutter-Aware Margins ───────────────────────────────────────────────

const INNER_GUTTER = 51; // ~18mm (fold side)
const OUTER_TRIM = 34;   // ~12mm (trim side)

/**
 * Returns left/right padding for a given page number.
 * Pages 1,3 are recto (right-hand): gutter on LEFT.
 * Pages 2,4 are verso (left-hand): gutter on RIGHT.
 */
export function getPageMargins(pageNumber: 1 | 2 | 3 | 4) {
  const isRecto = pageNumber % 2 === 1;
  return {
    paddingLeft: isRecto ? INNER_GUTTER : OUTER_TRIM,
    paddingRight: isRecto ? OUTER_TRIM : INNER_GUTTER,
  };
}

/** Top/bottom padding for content areas */
export const PAGE_VERTICAL = {
  top: 10,
  bottom: SPACING.S4, // ~45pt — clearance for absolute footer
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
export const HERO_IMAGE_HEIGHT = 280;

/** Thin rule weight for separators */
export const RULE_WEIGHT = 0.5;

/** Heavier rule weight for section dividers */
export const RULE_WEIGHT_HEAVY = 0.75;
