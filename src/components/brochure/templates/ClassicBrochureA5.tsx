import { Document, Page, View, StyleSheet } from '@react-pdf/renderer';
import type { BrochureContent, BrochureBranding } from '@/lib/brochure/types';
import {
  getLayoutDimensions,
  getTypeOverrides,
  getPageMargins,
  COLORS,
  TYPE,
} from '@/lib/brochure/designTokens';
import { BrochureHeader } from './shared/BrochureHeader';
import {
  buildPageRenderContext,
  CoverPageContent,
  AccommodationPageContent,
  FeaturesPageContent,
  BackCoverPageContent,
} from './ClassicBrochureTemplate';

// ── Shared ──────────────────────────────────────────────────────────────

interface A5Props {
  content: BrochureContent;
  branding: BrochureBranding;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: TYPE.body.fontSize,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
  },
  landscapePage: {
    fontFamily: 'Helvetica',
    fontSize: TYPE.body.fontSize,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
  },
  imposedRow: {
    flexDirection: 'row',
    flex: 1,
  },
  imposedHalf: {
    width: '50%',
    height: '100%',
    overflow: 'hidden',
  },
});

function getA5PageSize(locale: string): 'A5' | [number, number] {
  // US/CA use Half-Letter (5.5" × 8.5" = 396pt × 612pt)
  if (['en-US', 'en-CA'].includes(locale)) {
    return [396, 612];
  }
  return 'A5';
}

function getLandscapePageSize(locale: string): [number, number] {
  // US/CA: Letter landscape (11" × 8.5" = 792pt × 612pt)
  if (['en-US', 'en-CA'].includes(locale)) {
    return [792, 612];
  }
  // A4 landscape (297mm × 210mm = 841.89pt × 595.28pt)
  return [841.89, 595.28];
}

// ── A5 Reader ─────────────────────────────────────────────────────────
// 4 individual A5 pages in reading order (1, 2, 3, 4)

export function ClassicBrochureA5Reader({ content, branding }: A5Props) {
  const dims = getLayoutDimensions('a5');
  const typeOverrides = getTypeOverrides('a5');
  const ctx = buildPageRenderContext(content, branding, dims, typeOverrides);
  const pageSize = getA5PageSize(branding.locale);

  const p1m = getPageMargins(1, dims);
  const p2m = getPageMargins(2, dims);
  const p3m = getPageMargins(3, dims);
  const p4m = getPageMargins(4, dims);

  return (
    <Document title={content.cover.headline} author={branding.businessName}>
      <Page size={pageSize} style={styles.page}>
        <BrochureHeader branding={branding} margins={p1m} dims={dims} />
        <CoverPageContent ctx={ctx} margins={p1m} />
      </Page>

      <Page size={pageSize} style={styles.page}>
        <BrochureHeader branding={branding} compact margins={p2m} dims={dims} />
        <AccommodationPageContent ctx={ctx} margins={p2m} />
      </Page>

      <Page size={pageSize} style={styles.page}>
        <BrochureHeader branding={branding} compact margins={p3m} dims={dims} />
        <FeaturesPageContent ctx={ctx} margins={p3m} />
      </Page>

      <Page size={pageSize} style={styles.page}>
        <BrochureHeader branding={branding} compact margins={p4m} dims={dims} />
        <BackCoverPageContent ctx={ctx} margins={p4m} />
      </Page>
    </Document>
  );
}

// ── A5 Print-Ready (Imposed) ──────────────────────────────────────────
// 2 A4/Letter landscape sheets for duplex printing → fold to A5 booklet
//
// Sheet 1 (front):  Left = Page 4 (Back Cover),  Right = Page 1 (Cover)
// Sheet 2 (back):   Left = Page 2 (Accommodation), Right = Page 3 (Features)
//
// Print duplex, flip on short edge → fold → reads 1, 2, 3, 4

export function ClassicBrochureA5PrintReady({ content, branding }: A5Props) {
  const dims = getLayoutDimensions('a5');
  const typeOverrides = getTypeOverrides('a5');
  const ctx = buildPageRenderContext(content, branding, dims, typeOverrides);
  const landscapeSize = getLandscapePageSize(branding.locale);

  const p1m = getPageMargins(1, dims);
  const p2m = getPageMargins(2, dims);
  const p3m = getPageMargins(3, dims);
  const p4m = getPageMargins(4, dims);

  return (
    <Document title={`${content.cover.headline} (Print)`} author={branding.businessName}>
      {/* Sheet 1: Page 4 (left) + Page 1 (right) */}
      <Page size={landscapeSize} style={styles.landscapePage}>
        <View style={styles.imposedRow}>
          <View style={styles.imposedHalf}>
            <BrochureHeader branding={branding} compact margins={p4m} dims={dims} />
            <BackCoverPageContent ctx={ctx} margins={p4m} />
          </View>
          <View style={styles.imposedHalf}>
            <BrochureHeader branding={branding} margins={p1m} dims={dims} />
            <CoverPageContent ctx={ctx} margins={p1m} />
          </View>
        </View>
      </Page>

      {/* Sheet 2: Page 2 (left) + Page 3 (right) */}
      <Page size={landscapeSize} style={styles.landscapePage}>
        <View style={styles.imposedRow}>
          <View style={styles.imposedHalf}>
            <BrochureHeader branding={branding} compact margins={p2m} dims={dims} />
            <AccommodationPageContent ctx={ctx} margins={p2m} />
          </View>
          <View style={styles.imposedHalf}>
            <BrochureHeader branding={branding} compact margins={p3m} dims={dims} />
            <FeaturesPageContent ctx={ctx} margins={p3m} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
