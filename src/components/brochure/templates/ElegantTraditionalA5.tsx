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
import { buildPageRenderContext } from './ClassicBrochureTemplate';
import {
  ElegantCoverPageContent,
  ElegantAccommodationPageContent,
  ElegantFeaturesPageContent,
  ElegantBackCoverPageContent,
} from './ElegantTraditionalTemplate';

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
  if (['en-US', 'en-CA'].includes(locale)) {
    return [396, 612]; // Half-Letter
  }
  return 'A5';
}

function getLandscapePageSize(locale: string): [number, number] {
  if (['en-US', 'en-CA'].includes(locale)) {
    return [792, 612]; // Letter landscape
  }
  return [841.89, 595.28]; // A4 landscape
}

// ── A5 Reader ─────────────────────────────────────────────────────────

export function ElegantTraditionalA5Reader({ content, branding }: A5Props) {
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
      <Page size={pageSize} orientation="portrait" style={styles.page} wrap={false}>
        <ElegantCoverPageContent ctx={ctx} margins={p1m} />
      </Page>

      <Page size={pageSize} orientation="portrait" style={styles.page} wrap={false}>
        <BrochureHeader branding={branding} compact margins={p2m} dims={dims} />
        <ElegantAccommodationPageContent ctx={ctx} margins={p2m} />
      </Page>

      <Page size={pageSize} orientation="portrait" style={styles.page} wrap={false}>
        <BrochureHeader branding={branding} compact margins={p3m} dims={dims} />
        <ElegantFeaturesPageContent ctx={ctx} margins={p3m} />
      </Page>

      <Page size={pageSize} orientation="portrait" style={styles.page} wrap={false}>
        <ElegantBackCoverPageContent ctx={ctx} margins={p4m} />
      </Page>
    </Document>
  );
}

// ── A5 Print-Ready (Imposed) ──────────────────────────────────────────

export function ElegantTraditionalA5PrintReady({ content, branding }: A5Props) {
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
      <Page size={landscapeSize} style={styles.landscapePage} wrap={false}>
        <View style={styles.imposedRow}>
          <View style={styles.imposedHalf}>
            <ElegantBackCoverPageContent ctx={ctx} margins={p4m} />
          </View>
          <View style={styles.imposedHalf}>
            <ElegantCoverPageContent ctx={ctx} margins={p1m} />
          </View>
        </View>
      </Page>

      {/* Sheet 2: Page 2 (left) + Page 3 (right) */}
      <Page size={landscapeSize} style={styles.landscapePage} wrap={false}>
        <View style={styles.imposedRow}>
          <View style={styles.imposedHalf}>
            <BrochureHeader branding={branding} compact margins={p2m} dims={dims} />
            <ElegantAccommodationPageContent ctx={ctx} margins={p2m} />
          </View>
          <View style={styles.imposedHalf}>
            <BrochureHeader branding={branding} compact margins={p3m} dims={dims} />
            <ElegantFeaturesPageContent ctx={ctx} margins={p3m} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
