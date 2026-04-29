import { Document, Page, View, StyleSheet } from '@react-pdf/renderer';
import type { BrochureContent, BrochureBranding } from '@/lib/brochure/types';
import {
  getLayoutDimensions,
  getTypeOverrides,
  getPageMargins,
  COLORS,
  TYPE,
} from '@/lib/brochure/designTokens';
import { getRegionConfig } from '@/lib/locale/config';
import { BrochureHeader } from './shared/BrochureHeader';
import { getBookletPageSize, getLandscapeSpreadSize } from './shared/pageSizes';
import { buildPageRenderContext } from './ClassicBrochureTemplate';
import {
  ArchCoverPageContent,
  ArchDescriptionPageContent,
  ArchFeaturesPageContent,
  ArchBackCoverPageContent,
} from './ArchitecturalTemplate';

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

// ── A5 Reader ─────────────────────────────────────────────────────────

export function ArchitecturalA5Reader({ content, branding }: A5Props) {
  const dims = getLayoutDimensions('a5');
  const typeOverrides = getTypeOverrides('a5');
  const ctx = buildPageRenderContext(content, branding, dims, typeOverrides);
  const pageSize = getBookletPageSize(getRegionConfig(branding.locale));

  const p1m = getPageMargins(1, dims);
  const p2m = getPageMargins(2, dims);
  const p3m = getPageMargins(3, dims);
  const p4m = getPageMargins(4, dims);

  return (
    <Document title={content.cover.headline} author={branding.businessName}>
      <Page size={pageSize} orientation="portrait" style={styles.page} wrap={false}>
        <ArchCoverPageContent ctx={ctx} margins={p1m} />
      </Page>

      <Page size={pageSize} orientation="portrait" style={styles.page} wrap={false}>
        <BrochureHeader branding={branding} compact margins={p2m} dims={dims} />
        <ArchDescriptionPageContent ctx={ctx} margins={p2m} />
      </Page>

      <Page size={pageSize} orientation="portrait" style={styles.page} wrap={false}>
        <BrochureHeader branding={branding} compact margins={p3m} dims={dims} />
        <ArchFeaturesPageContent ctx={ctx} margins={p3m} />
      </Page>

      <Page size={pageSize} orientation="portrait" style={styles.page} wrap={false}>
        <ArchBackCoverPageContent ctx={ctx} margins={p4m} />
      </Page>
    </Document>
  );
}

// ── A5 Print-Ready (Imposed) ──────────────────────────────────────────

export function ArchitecturalA5PrintReady({ content, branding }: A5Props) {
  const dims = getLayoutDimensions('a5');
  const typeOverrides = getTypeOverrides('a5');
  const ctx = buildPageRenderContext(content, branding, dims, typeOverrides);
  const landscapeSize = getLandscapeSpreadSize(getRegionConfig(branding.locale));

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
            <ArchBackCoverPageContent ctx={ctx} margins={p4m} />
          </View>
          <View style={styles.imposedHalf}>
            <ArchCoverPageContent ctx={ctx} margins={p1m} />
          </View>
        </View>
      </Page>

      {/* Sheet 2: Page 2 (left) + Page 3 (right) */}
      <Page size={landscapeSize} style={styles.landscapePage} wrap={false}>
        <View style={styles.imposedRow}>
          <View style={styles.imposedHalf}>
            <BrochureHeader branding={branding} compact margins={p2m} dims={dims} />
            <ArchDescriptionPageContent ctx={ctx} margins={p2m} />
          </View>
          <View style={styles.imposedHalf}>
            <BrochureHeader branding={branding} compact margins={p3m} dims={dims} />
            <ArchFeaturesPageContent ctx={ctx} margins={p3m} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
