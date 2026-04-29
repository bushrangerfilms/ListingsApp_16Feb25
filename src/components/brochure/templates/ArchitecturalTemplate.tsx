import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { BrochureContent, BrochureBranding } from '@/lib/brochure/types';
import {
  SPACING,
  TIGHT,
  PRICE_ZONE,
  COLORS,
  TYPE,
  RULE_WEIGHT,
  RULE_WEIGHT_HEAVY,
  CONTENT_CAPS,
  getPageMargins,
  getImageRadius,
  getImageBorderStyle,
  PAGE_VERTICAL,
  normalizeText,
  spaceCurrency,
  getLayoutDimensions,
  getTypeOverrides,
  type LayoutDimensions,
} from '@/lib/brochure/designTokens';
import { getRegionConfig } from '@/lib/locale/config';
import { BrochureHeader } from './shared/BrochureHeader';
import { BrochureFooter } from './shared/BrochureFooter';
import { getSinglePageSize } from './shared/pageSizes';
import {
  buildPageRenderContext,
  type PageRenderContext,
} from './ClassicBrochureTemplate';

// ── Helpers ──────────────────────────────────────────────────────────────

function BulletItem({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 2.5 }}>
      <Text style={{ fontSize: TYPE.bullet.fontSize, width: 8, color: COLORS.textSecondary }}>{'\u2022'}</Text>
      <Text style={{ fontSize: TYPE.bullet.fontSize, flex: 1, color: COLORS.textSecondary, lineHeight: TYPE.bullet.lineHeight }}>{text}</Text>
    </View>
  );
}

/** Minimal spec pill: "3 Bedrooms" / "2 Bathrooms" / "1,200 sq ft" */
function SpecItem({ label, value, primaryColor }: { label: string; value: string; primaryColor: string }) {
  return (
    <View style={{ alignItems: 'center', marginRight: 18 }}>
      <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: primaryColor }}>{value}</Text>
      <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica', color: COLORS.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 1 }}>{label}</Text>
    </View>
  );
}

/** Derive bed/bath/sqft from key features or rooms */
function deriveSpecs(ctx: PageRenderContext): { beds?: string; baths?: string; sqft?: string } {
  const features = ctx.keyFeatures.join(' ').toLowerCase();
  const rooms = ctx.content.rooms;

  // Try to extract from key features text
  const bedMatch = features.match(/(\d+)\s*bed/);
  const bathMatch = features.match(/(\d+)\s*bath/);
  const sqftMatch = features.match(/([\d,]+)\s*(?:sq\.?\s*ft|square\s*feet|sq\.?\s*m|m²)/i);

  // Fallback: count rooms with "bedroom" in name
  const beds = bedMatch?.[1] || rooms.filter(r => r.name.toLowerCase().includes('bed')).length.toString() || undefined;
  const baths = bathMatch?.[1] || rooms.filter(r => r.name.toLowerCase().includes('bath')).length.toString() || undefined;
  const sqft = sqftMatch?.[1] || undefined;

  return {
    beds: beds && beds !== '0' ? beds : undefined,
    baths: baths && baths !== '0' ? baths : undefined,
    sqft,
  };
}

// ── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: TYPE.body.fontSize,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
  },
});

// ── Page Content Components ────────────────────────────────────────────

interface PageContentProps {
  ctx: PageRenderContext;
  margins: { paddingLeft: number; paddingRight: number };
}

/** PAGE 1 — ARCHITECTURAL FRONT COVER
 *  Address at top in white band, hero below (~70%), bottom bar with specs + contact + agent
 */
export function ArchCoverPageContent({ ctx, margins }: PageContentProps) {
  const { content, branding, dims, typeOverrides, primaryColor } = ctx;
  const addressStyle = typeOverrides.coverAddress
    ? { ...TYPE.coverAddress, fontSize: typeOverrides.coverAddress.fontSize }
    : TYPE.coverAddress;
  const specs = deriveSpecs(ctx);

  return (
    <View style={{ flex: 1 }}>
      {/* Address band at top */}
      <View style={{
        ...margins,
        paddingTop: PAGE_VERTICAL.top + 6,
        paddingBottom: SPACING.S1,
        alignItems: 'center',
      }}>
        <Text style={{
          ...addressStyle,
          textAlign: 'center',
          lineHeight: 1.2,
          color: COLORS.textPrimary,
        }}>
          {content.cover.address}
        </Text>
      </View>

      {/* Hero photo — fills most of the page */}
      {content.cover.heroPhotoUrl && (
        <Image
          src={content.cover.heroPhotoUrl}
          style={{
            width: '100%',
            flex: 1,
            objectFit: 'cover',
          }}
        />
      )}

      {/* Bottom bar: specs (left) | contact (center) | agent name (right) */}
      <View style={{
        ...margins,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderTopWidth: RULE_WEIGHT,
        borderTopColor: COLORS.borderLight,
      }}>
        {/* Specs */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {specs.beds && <SpecItem label="Bedrooms" value={specs.beds} primaryColor={primaryColor} />}
          {specs.baths && <SpecItem label="Bathrooms" value={specs.baths} primaryColor={primaryColor} />}
          {specs.sqft && <SpecItem label="Sq Ft" value={specs.sqft} primaryColor={primaryColor} />}
        </View>

        {/* Contact details (center) */}
        <View style={{ alignItems: 'center' }}>
          {branding.contactEmail && (
            <Text style={{ ...TYPE.headerContact, color: COLORS.textSecondary }}>{branding.contactEmail}</Text>
          )}
          {branding.contactPhone && (
            <Text style={{ ...TYPE.headerContact, color: COLORS.textSecondary, marginTop: 1 }}>{branding.contactPhone}</Text>
          )}
        </View>

        {/* Presented by + logo */}
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 7, fontFamily: 'Helvetica', color: COLORS.textMuted, letterSpacing: 0.5 }}>
            Presented by
          </Text>
          {branding.logoUrl ? (
            <Image
              src={branding.logoUrl}
              style={{
                maxWidth: dims.logoMaxWidth * 0.6,
                maxHeight: dims.logoMaxHeight * 0.5,
                objectFit: 'contain',
                marginTop: 2,
              }}
            />
          ) : (
            <Text style={{ ...TYPE.headerBusinessNameCompact, color: primaryColor, marginTop: 1 }}>
              {branding.contactName || branding.businessName}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

/** PAGE 2 — DESCRIPTION + PRICE + SPECS + 3-PHOTO STRIP */
export function ArchDescriptionPageContent({ ctx, margins }: PageContentProps) {
  const {
    content, branding, dims, accentColor, primaryColor,
    imgRadius, imgBorder, coverParagraphs, keyFeatures, visible,
  } = ctx;
  const specs = deriveSpecs(ctx);

  // Feature photo — large, top of page (don't fall back to hero — it's on the cover)
  const featurePhoto = content.cover.backCoverPhotoUrl
    || content.gallery[0]?.url
    || null;

  // 3-photo strip at bottom
  const stripPhotos = content.gallery.slice(0, 3);

  return (
    <View style={{
      ...margins,
      paddingTop: PAGE_VERTICAL.top,
      paddingBottom: PAGE_VERTICAL.bottom,
      flex: 1,
    }}>
      {/* Address header */}
      <Text style={{
        ...TYPE.coverSaleMethod,
        color: COLORS.textMuted,
        textAlign: 'center',
        marginBottom: SPACING.HALF,
      }}>
        {content.cover.address}
      </Text>

      {/* Large feature photo */}
      {featurePhoto && (
        <Image
          src={featurePhoto}
          style={{
            width: '100%',
            height: dims.heroImageHeight * 0.45,
            objectFit: 'cover',
            borderRadius: imgRadius,
            ...imgBorder,
            marginBottom: SPACING.S1,
          }}
        />
      )}

      {/* "What's Special" description + price side-by-side */}
      <View style={{ flexDirection: 'row', marginBottom: SPACING.HALF }}>
        {/* Description (left, ~60%) */}
        <View style={{ flex: 3, paddingRight: SPACING.S1 }}>
          <Text style={{ ...TYPE.sectionTitle, color: primaryColor, marginBottom: 4 }}>
            {content.description.sectionTitle || "What\u2019s Special"}
          </Text>
          {visible.description !== false && coverParagraphs.map((paragraph, i) => (
            <Text key={i} style={{
              ...TYPE.body,
              color: COLORS.textSecondary,
              textAlign: 'justify',
              marginBottom: 3,
              lineHeight: TYPE.body.lineHeight,
            }}>
              {normalizeText(paragraph)}
            </Text>
          ))}
        </View>

        {/* Price (right, ~40%) */}
        {content.cover.price && (
          <View style={{ flex: 2, alignItems: 'flex-end', justifyContent: 'flex-start' }}>
            <Text style={{
              fontSize: 8,
              fontFamily: 'Helvetica',
              color: COLORS.textMuted,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              marginBottom: 3,
            }}>
              Guide Price
            </Text>
            <Text style={{
              ...TYPE.priceBanner,
              color: primaryColor,
            }}>
              {spaceCurrency(content.cover.price)}
            </Text>
            <View style={{
              borderBottomWidth: RULE_WEIGHT_HEAVY,
              borderBottomColor: accentColor,
              width: 50,
              marginTop: 4,
            }} />
            {content.cover.energyRating && (
              <Text style={{
                fontSize: 9,
                fontFamily: 'Helvetica-Bold',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderWidth: 1,
                borderColor: primaryColor,
                color: primaryColor,
                borderRadius: 2,
                marginTop: 8,
              }}>
                {getRegionConfig(branding.locale).property.energyRatings.system} {content.cover.energyRating}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Spec icons row */}
      {(specs.beds || specs.baths || specs.sqft) && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: SPACING.HALF,
          borderTopWidth: RULE_WEIGHT,
          borderTopColor: COLORS.borderLight,
          marginBottom: SPACING.HALF,
        }}>
          {specs.beds && <SpecItem label="Bedrooms" value={specs.beds} primaryColor={primaryColor} />}
          {specs.baths && <SpecItem label="Bathrooms" value={specs.baths} primaryColor={primaryColor} />}
          {specs.sqft && <SpecItem label="Sq Ft" value={specs.sqft} primaryColor={primaryColor} />}
        </View>
      )}

      {/* Flex spacer */}
      <View style={{ flex: 1 }} />

      {/* 3-photo strip at bottom */}
      {visible.gallery !== false && stripPhotos.length >= 2 && (
        <View style={{ flexDirection: 'row' }}>
          {stripPhotos.map((photo, idx) => {
            const count = stripPhotos.length;
            const widthPct = count === 2 ? '48%' : '31%';
            const gapPct = count === 2 ? '4%' : '3.5%';
            return (
              <View
                key={photo.id}
                style={{
                  width: widthPct,
                  marginRight: idx < count - 1 ? gapPct : 0,
                }}
              >
                <Image
                  src={photo.url}
                  style={{
                    width: '100%',
                    height: dims.accentPhotoHeight * 0.65,
                    objectFit: 'cover',
                    borderRadius: imgRadius,
                    ...imgBorder,
                  }}
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** PAGE 3 — ROOM PHOTOS + FEATURES/STATS + FLOOR PLAN + LARGE PHOTO */
export function ArchFeaturesPageContent({ ctx, margins }: PageContentProps) {
  const {
    content, dims, accentColor, primaryColor, imgRadius, imgBorder,
    visible, backCoverGallery,
    hasNearby, hasServices, hasExternal,
    cappedServices, cappedExternal, cappedNearby,
    hasFloorPlans, cappedFloorPlans, showBackCoverPrice,
  } = ctx;

  // Price at top
  const showPrice = showBackCoverPrice || true; // Architectural always shows price on page 3

  // Two room photos side-by-side
  const roomPhoto1 = backCoverGallery[0]?.url;
  const roomPhoto2 = backCoverGallery[1]?.url;
  const roomPhotoHeight = dims.backGalleryHeightLarge * 0.65;

  // Large photo at bottom
  const bottomPhoto = backCoverGallery[2]?.url || content.cover.backCoverPhotoUrl;

  return (
    <View style={{
      ...margins,
      paddingTop: PAGE_VERTICAL.top,
      paddingBottom: PAGE_VERTICAL.bottom,
      flex: 1,
    }}>
      {/* Price at top-right */}
      {content.cover.price && (
        <Text style={{
          ...TYPE.coverSaleMethod,
          color: COLORS.textMuted,
          textAlign: 'right',
          marginBottom: SPACING.HALF,
        }}>
          Guide Price {spaceCurrency(content.cover.price)}
        </Text>
      )}

      {/* Two room photos side-by-side */}
      {roomPhoto1 && roomPhoto2 && (
        <View style={{ flexDirection: 'row', marginBottom: SPACING.S1 }}>
          <View style={{ width: '48%' }}>
            <Image
              src={roomPhoto1}
              style={{
                width: '100%',
                height: roomPhotoHeight,
                objectFit: 'cover',
                borderRadius: imgRadius,
                ...imgBorder,
              }}
            />
          </View>
          <View style={{ width: '4%' }} />
          <View style={{ width: '48%' }}>
            <Image
              src={roomPhoto2}
              style={{
                width: '100%',
                height: roomPhotoHeight,
                objectFit: 'cover',
                borderRadius: imgRadius,
                ...imgBorder,
              }}
            />
          </View>
        </View>
      )}

      {/* Features / Stats + Floor Plan side-by-side */}
      <View style={{ flexDirection: 'row', marginBottom: SPACING.HALF }}>
        {/* Features (left) */}
        <View style={{ flex: 1, paddingRight: SPACING.S1 }}>
          {visible.features !== false && (hasServices || hasExternal || hasNearby) && (
            <View>
              <Text style={{ ...TYPE.sectionTitle, color: primaryColor, marginBottom: 4 }}>
                {content.features.servicesTitle || 'Property Details'}
              </Text>
              {hasServices && cappedServices.map((s, i) => (
                <BulletItem key={`s-${i}`} text={normalizeText(s)} />
              ))}
              {hasExternal && cappedExternal.map((f, i) => (
                <BulletItem key={`e-${i}`} text={normalizeText(f)} />
              ))}
              {hasNearby && cappedNearby.map((n, i) => (
                <BulletItem key={`n-${i}`} text={normalizeText(n)} />
              ))}
            </View>
          )}

          {/* Location */}
          {visible.location !== false && content.location.text && (
            <View style={{ marginTop: SPACING.HALF }}>
              <Text style={{ ...TYPE.featureTitle, color: primaryColor, marginBottom: 3 }}>
                {content.location.sectionTitle || 'Location'}
              </Text>
              <Text style={{ ...TYPE.location, color: COLORS.textSecondary }}>
                {normalizeText(content.location.text)}
              </Text>
            </View>
          )}
        </View>

        {/* Floor Plan (right) */}
        {hasFloorPlans && cappedFloorPlans[0] && (
          <View style={{ flex: 1 }}>
            <Image
              src={cappedFloorPlans[0].imageUrl}
              style={{
                width: '100%',
                maxHeight: dims.floorPlanMaxHeight * 0.7,
                objectFit: 'contain',
              }}
            />
            {cappedFloorPlans[0].label && (
              <Text style={{
                ...TYPE.floorPlanLabel,
                color: primaryColor,
                textAlign: 'center',
                marginTop: 4,
              }}>
                {normalizeText(cappedFloorPlans[0].label)}
              </Text>
            )}
            <Text style={{
              ...TYPE.floorPlanNote,
              color: COLORS.textMuted,
              textAlign: 'center',
              marginTop: 2,
            }}>
              For illustration purposes only. Not to scale.
            </Text>
          </View>
        )}
      </View>

      {/* Flex spacer */}
      <View style={{ flex: 1 }} />

      {/* Large photo at bottom */}
      {bottomPhoto && (
        <Image
          src={bottomPhoto}
          style={{
            width: '100%',
            height: dims.accentPhotoHeight,
            objectFit: 'cover',
            borderRadius: imgRadius,
            ...imgBorder,
          }}
        />
      )}
    </View>
  );
}

/** PAGE 4 — ARCHITECTURAL BACK COVER (full-bleed photo, contact card at bottom) */
export function ArchBackCoverPageContent({ ctx, margins }: PageContentProps) {
  const {
    content, branding, dims, primaryColor, accentColor,
    visible, backCoverPhoto, certLogos, showBackCoverPrice,
  } = ctx;

  const backPhotoHeight = dims.heroImageHeight * 0.85;

  return (
    <View style={{ flex: 1 }}>
      {/* Full-bleed lifestyle photo */}
      {backCoverPhoto && (
        <Image
          src={backCoverPhoto}
          style={{
            width: '100%',
            height: backPhotoHeight,
            objectFit: 'cover',
          }}
        />
      )}

      {/* Flex spacer */}
      <View style={{ flex: 1 }} />

      {/* Contact card */}
      <View style={{
        ...margins,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: SPACING.S1,
        borderTopWidth: RULE_WEIGHT,
        borderTopColor: COLORS.rule,
      }}>
        {/* Logo */}
        {branding.logoUrl && (
          <Image
            src={branding.logoUrl}
            style={{
              maxWidth: dims.logoMaxWidth * 0.7,
              maxHeight: dims.logoMaxHeight * 0.7,
              objectFit: 'contain',
              marginRight: SPACING.S2,
            }}
          />
        )}

        {/* Business + agent details */}
        <View style={{ flex: 1 }}>
          <Text style={{ ...TYPE.headerBusinessName, color: primaryColor, marginBottom: 2 }}>
            {branding.businessName}
          </Text>
          {branding.contactName && (
            <Text style={{ ...TYPE.headerContact, color: COLORS.textSecondary, fontFamily: 'Helvetica-Bold', marginBottom: 1 }}>
              {branding.contactName}
            </Text>
          )}
          <Text style={{ ...TYPE.headerContact, color: COLORS.textSecondary }}>
            {[branding.contactPhone, branding.contactEmail].filter(Boolean).join(' | ')}
          </Text>
          {branding.businessAddress && (
            <Text style={{ ...TYPE.headerContact, color: COLORS.textMuted, marginTop: 1 }}>
              {branding.businessAddress}
            </Text>
          )}
          {branding.psrLicenceNumber && (
            <Text style={{ ...TYPE.licence, color: COLORS.textMuted, marginTop: 2 }}>
              {branding.licenceDisplayLabel}: {branding.psrLicenceNumber}
            </Text>
          )}
        </View>
      </View>

      {/* Certification logos band */}
      {certLogos.length > 0 && (
        <View style={{
          ...margins,
          backgroundColor: primaryColor,
          borderRadius: 3,
          paddingVertical: 8,
          paddingHorizontal: 12,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: SPACING.HALF,
        }}>
          {certLogos.map((logo) => (
            logo.url ? (
              <Image
                key={logo.id}
                src={logo.url}
                style={{
                  height: dims.certLogoHeight,
                  maxWidth: 80,
                  objectFit: 'contain',
                  marginHorizontal: 10,
                }}
              />
            ) : (
              <View
                key={logo.id}
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 3,
                  borderWidth: 0.5,
                  borderColor: 'rgba(255,255,255,0.4)',
                  borderRadius: 2,
                  marginHorizontal: 6,
                }}
              >
                <Text style={{ fontSize: 6.5, color: COLORS.white }}>{logo.name}</Text>
              </View>
            )
          ))}
        </View>
      )}

      {/* Legal footer */}
      {visible.legal !== false && (
        <BrochureFooter
          branding={branding}
          legal={content.legal}
          showContact={false}
          margins={margins}
          inFlow
        />
      )}
    </View>
  );
}

// ── Main Template Component (A4) ─────────────────────────────────────────

export interface ArchitecturalTemplateProps {
  content: BrochureContent;
  branding: BrochureBranding;
}

export function ArchitecturalTemplate({ content, branding }: ArchitecturalTemplateProps) {
  const dims = getLayoutDimensions('a4');
  const typeOverrides = getTypeOverrides('a4');
  const ctx = buildPageRenderContext(content, branding, dims, typeOverrides);

  const pageSize = getSinglePageSize(getRegionConfig(branding.locale));

  const p1m = getPageMargins(1, dims);
  const p2m = getPageMargins(2, dims);
  const p3m = getPageMargins(3, dims);
  const p4m = getPageMargins(4, dims);

  return (
    <Document title={content.cover.headline} author={branding.businessName}>
      {/* PAGE 1 — FRONT COVER (address top, hero, specs bar) */}
      <Page size={pageSize} orientation="portrait" style={styles.page} wrap={false}>
        <ArchCoverPageContent ctx={ctx} margins={p1m} />
      </Page>

      {/* PAGE 2 — DESCRIPTION + PRICE + 3-PHOTO STRIP */}
      <Page size={pageSize} orientation="portrait" style={styles.page} wrap={false}>
        <BrochureHeader branding={branding} compact margins={p2m} dims={dims} />
        <ArchDescriptionPageContent ctx={ctx} margins={p2m} />
      </Page>

      {/* PAGE 3 — ROOM PHOTOS + STATS + FLOOR PLAN */}
      <Page size={pageSize} orientation="portrait" style={styles.page} wrap={false}>
        <BrochureHeader branding={branding} compact margins={p3m} dims={dims} />
        <ArchFeaturesPageContent ctx={ctx} margins={p3m} />
      </Page>

      {/* PAGE 4 — BACK COVER (full-bleed photo, contact card) */}
      <Page size={pageSize} orientation="portrait" style={styles.page} wrap={false}>
        <ArchBackCoverPageContent ctx={ctx} margins={p4m} />
      </Page>
    </Document>
  );
}
