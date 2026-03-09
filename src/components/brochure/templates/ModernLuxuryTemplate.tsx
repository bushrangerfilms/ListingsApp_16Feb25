import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { BrochureContent, BrochureBranding, CertificationLogo } from '@/lib/brochure/types';
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
  getLayoutDimensions,
  getTypeOverrides,
  type LayoutDimensions,
} from '@/lib/brochure/designTokens';
import { BrochureHeader } from './shared/BrochureHeader';
import { BrochureFooter } from './shared/BrochureFooter';
import { BrochureRoomBlock } from './shared/BrochureRoomBlock';
import {
  buildPageRenderContext,
  type PageRenderContext,
} from './ClassicBrochureTemplate';

// ── Helpers ──────────────────────────────────────────────────────────────

function getBerLabel(locale: string): string {
  switch (locale) {
    case 'en-GB': return 'EPC';
    case 'en-US': return 'HERS';
    case 'en-AU': return 'NatHERS';
    case 'en-CA': return 'EnerGuide';
    default: return 'BER';
  }
}

function BulletItem({ text, style }: { text: string; style?: 'keyFeature' | 'default' }) {
  const fontSize = style === 'keyFeature' ? TYPE.keyFeature.fontSize : TYPE.bullet.fontSize;
  const color = style === 'keyFeature' ? COLORS.textPrimary : COLORS.textSecondary;
  return (
    <View style={{ flexDirection: 'row', marginBottom: 2.5 }}>
      <Text style={{ fontSize, width: 8, color: COLORS.textSecondary }}>{'\u2022'}</Text>
      <Text style={{ fontSize, flex: 1, color, lineHeight: TYPE.bullet.lineHeight }}>{text}</Text>
    </View>
  );
}

function SectionTitle({ title, primaryColor }: { title: string; primaryColor: string }) {
  return (
    <View style={{ marginBottom: SPACING.HALF, marginTop: SPACING.S1 }}>
      <Text style={{ ...TYPE.sectionTitle, color: primaryColor, marginBottom: 3 }}>
        {title}
      </Text>
      <View style={{
        borderBottomWidth: RULE_WEIGHT_HEAVY,
        borderBottomColor: primaryColor,
        width: '40%',
      }} />
    </View>
  );
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

/** PAGE 1 — MODERN FRONT COVER (no header, full-bleed hero, overlay address) */
export function ModernCoverPageContent({ ctx, margins }: PageContentProps) {
  const { content, branding, dims, typeOverrides, accentColor, primaryColor, imgRadius } = ctx;
  const priceStyle = typeOverrides.coverPrice
    ? { ...TYPE.coverPrice, fontSize: typeOverrides.coverPrice.fontSize }
    : TYPE.coverPrice;
  const addressStyle = typeOverrides.coverAddress
    ? { ...TYPE.coverAddress, fontSize: typeOverrides.coverAddress.fontSize }
    : TYPE.coverAddress;

  // Hero takes most of the page
  const heroHeight = dims.heroImageHeight * 1.15;

  return (
    <View style={{ flex: 1 }}>
      {/* Hero Photo — near full-bleed (edge-to-edge horizontally, generous height) */}
      {content.cover.heroPhotoUrl && (
        <View style={{ position: 'relative' }}>
          <Image
            src={content.cover.heroPhotoUrl}
            style={{
              width: '100%',
              height: heroHeight,
              objectFit: 'cover',
            }}
          />
          {/* White overlay band at bottom of hero with address */}
          <View style={{
            position: 'absolute',
            bottom: 0,
            left: '10%',
            right: '10%',
            backgroundColor: 'rgba(255,255,255,0.92)',
            paddingVertical: 10,
            paddingHorizontal: 16,
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
        </View>
      )}

      {/* Flex spacer above */}
      <View style={{ flex: 1 }} />

      {/* Sale method + logo centered as a group */}
      <View style={{ alignItems: 'center' }}>
        <Text style={{
          ...TYPE.coverSaleMethod,
          color: accentColor,
          textAlign: 'center',
        }}>
          {content.cover.saleMethod}
        </Text>
        {branding.logoUrl && (
          <View style={{ alignItems: 'center', marginTop: SPACING.S2 }}>
            <Image
              src={branding.logoUrl}
              style={{
                maxWidth: dims.logoMaxWidth * 1.2,
                maxHeight: dims.logoMaxHeight * 1.2,
                objectFit: 'contain',
              }}
            />
          </View>
        )}
      </View>

      {/* Flex spacer below */}
      <View style={{ flex: 1 }} />

      {/* Price + BER at bottom */}
      <View style={{
        ...margins,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: PRICE_ZONE.minFromTrim,
      }}>
        {content.cover.price && (
          <Text style={{ ...priceStyle, color: primaryColor, textAlign: 'center' }}>
            Guide Price: {content.cover.price}
          </Text>
        )}
        {content.cover.energyRating && (
          <Text style={{
            fontSize: 10,
            fontFamily: 'Helvetica-Bold',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderWidth: 1.5,
            borderColor: primaryColor,
            color: primaryColor,
            borderRadius: 3,
            marginLeft: 18,
          }}>
            {getBerLabel(branding.locale)} {content.cover.energyRating}
          </Text>
        )}
      </View>
    </View>
  );
}

/** PAGE 2 — DESCRIPTION + KEY FEATURES + PRICE */
export function ModernAccommodationPageContent({ ctx, margins }: PageContentProps) {
  const {
    content, branding, dims, accentColor, primaryColor,
    imgRadius, imgBorder, coverParagraphs, keyFeatures, visible,
  } = ctx;

  // Use first gallery item or back cover photo (don't fall back to hero — it's on the cover)
  const featurePhoto = content.cover.backCoverPhotoUrl
    || content.gallery[0]?.url
    || null;

  return (
    <View style={{
      ...margins,
      paddingTop: PAGE_VERTICAL.top,
      paddingBottom: PAGE_VERTICAL.bottom,
      flex: 1,
    }}>
      {/* Large feature photo */}
      {featurePhoto && (
        <Image
          src={featurePhoto}
          style={{
            width: '100%',
            height: dims.heroImageHeight * 0.55,
            objectFit: 'cover',
            borderRadius: imgRadius,
            ...imgBorder,
            marginBottom: SPACING.S1,
          }}
        />
      )}

      {/* Description */}
      {visible.description !== false && coverParagraphs.length > 0 && (
        <View style={{ marginBottom: SPACING.HALF }}>
          <SectionTitle title="About This Property" primaryColor={primaryColor} />
          {coverParagraphs.map((paragraph, i) => (
            <Text key={i} style={{
              ...TYPE.body,
              color: COLORS.textSecondary,
              textAlign: 'justify',
              marginBottom: 4,
              lineHeight: TYPE.body.lineHeight,
            }}>
              {normalizeText(paragraph)}
            </Text>
          ))}
        </View>
      )}

      {/* Key Features */}
      {visible.description !== false && keyFeatures.length > 0 && (
        <View style={{ marginBottom: SPACING.HALF }}>
          <Text style={{ ...TYPE.featureTitle, color: primaryColor, marginBottom: 3 }}>
            Key Features
          </Text>
          {keyFeatures.map((feature, i) => (
            <BulletItem key={i} text={normalizeText(feature)} style="keyFeature" />
          ))}
        </View>
      )}

      {/* Flex spacer */}
      <View style={{ flex: 1 }} />

      {/* Price — right-aligned at bottom */}
      {content.cover.price && (
        <View style={{
          alignItems: 'flex-end',
          paddingTop: SPACING.S1,
          borderTopWidth: RULE_WEIGHT,
          borderTopColor: COLORS.rule,
        }}>
          <Text style={{
            ...TYPE.priceBanner,
            color: primaryColor,
          }}>
            {content.cover.price}
          </Text>
          <View style={{
            borderBottomWidth: RULE_WEIGHT_HEAVY,
            borderBottomColor: accentColor,
            width: 60,
            marginTop: 3,
          }} />
        </View>
      )}
    </View>
  );
}

/** PAGE 3 — PHOTO GRID + FEATURES + LOCATION */
export function ModernFeaturesPageContent({ ctx, margins }: PageContentProps) {
  const {
    content, dims, accentColor, primaryColor, imgRadius, imgBorder,
    visible, backCoverGallery, hasFloorPlans,
    hasNearby, hasServices, hasExternal,
    cappedServices, cappedExternal, cappedNearby, cappedFloorPlans,
  } = ctx;

  // Use gallery items for the 2x2 grid (deduped from page 2)
  const gridPhotos = backCoverGallery.slice(0, 4);

  return (
    <View style={{
      ...margins,
      paddingTop: PAGE_VERTICAL.top,
      paddingBottom: PAGE_VERTICAL.bottom,
      flex: 1,
    }}>
      {/* Address header (thin) */}
      <Text style={{
        ...TYPE.coverSaleMethod,
        color: COLORS.textMuted,
        textAlign: 'center',
        marginBottom: SPACING.S1,
      }}>
        {content.cover.address}
      </Text>

      {/* Photo grid: 2x2 */}
      {visible.gallery !== false && gridPhotos.length >= 2 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: SPACING.S1 }}>
          {gridPhotos.map((photo, idx) => (
            <View
              key={photo.id}
              style={{
                width: '48%',
                marginRight: idx % 2 === 0 ? '4%' : 0,
                marginBottom: SPACING.HALF,
              }}
            >
              <Image
                src={photo.url}
                style={{
                  width: '100%',
                  height: hasFloorPlans ? dims.backGalleryHeight : dims.backGalleryHeightLarge,
                  objectFit: 'cover',
                  borderRadius: imgRadius,
                  ...imgBorder,
                }}
              />
              {photo.caption && (
                <Text style={{ ...TYPE.caption, color: COLORS.textMuted, textAlign: 'center', marginTop: 2 }}>
                  {normalizeText(photo.caption)}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Features: Services | External | Nearby */}
      {visible.features !== false && (hasServices || hasExternal) && (
        <View style={{ flexDirection: 'row', marginBottom: SPACING.HALF }}>
          {hasServices && (
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ ...TYPE.featureTitle, color: primaryColor, marginBottom: 3 }}>
                Services
              </Text>
              {cappedServices.map((service, i) => (
                <BulletItem key={i} text={normalizeText(service)} />
              ))}
            </View>
          )}
          {hasExternal && (
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ ...TYPE.featureTitle, color: primaryColor, marginBottom: 3 }}>
                Features
              </Text>
              {cappedExternal.map((feature, i) => (
                <BulletItem key={i} text={normalizeText(feature)} />
              ))}
            </View>
          )}
          {hasNearby && (
            <View style={{ flex: 1 }}>
              <Text style={{ ...TYPE.featureTitle, color: primaryColor, marginBottom: 3 }}>
                Nearby
              </Text>
              {cappedNearby.map((item, i) => (
                <BulletItem key={i} text={normalizeText(item)} />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Location */}
      {visible.location !== false && content.location.text && (
        <View>
          <SectionTitle title="Location" primaryColor={primaryColor} />
          <Text style={{ ...TYPE.location, color: COLORS.textSecondary, textAlign: 'justify' }}>
            {normalizeText(content.location.text)}
          </Text>
        </View>
      )}

      {/* Floor Plans */}
      {hasFloorPlans && cappedFloorPlans.map((plan) => (
        <View
          key={plan.id}
          style={{
            backgroundColor: COLORS.subtleBg,
            borderWidth: RULE_WEIGHT,
            borderColor: COLORS.borderLight,
            borderRadius: imgRadius,
            padding: 12,
            marginTop: SPACING.HALF,
            alignItems: 'center',
          }}
        >
          <Image
            src={plan.imageUrl}
            style={{
              width: '90%',
              maxHeight: dims.floorPlanMaxHeight,
              objectFit: 'contain',
            }}
          />
          {plan.label && (
            <Text style={{
              ...TYPE.floorPlanLabel,
              color: primaryColor,
              textAlign: 'center',
              marginTop: 6,
            }}>
              {normalizeText(plan.label)}
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
      ))}
    </View>
  );
}

/** PAGE 4 — MODERN BACK COVER (large photo, contact card, cert logos, legal) */
export function ModernBackCoverPageContent({ ctx, margins }: PageContentProps) {
  const {
    content, branding, dims, primaryColor, imgRadius, imgBorder,
    visible, backCoverPhoto, certLogos, showBackCoverPrice, accentColor,
  } = ctx;

  // Back cover photo height — generous
  const backPhotoHeight = dims.heroImageHeight * 0.75;

  return (
    <View style={{ flex: 1 }}>
      {/* Large photo — full width, no side margins */}
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

      {/* Contact card + logo row */}
      <View style={{
        ...margins,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: SPACING.S1,
        borderTopWidth: RULE_WEIGHT,
        borderTopColor: COLORS.rule,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...TYPE.headerBusinessName, color: primaryColor, marginBottom: 3 }}>
            {branding.businessName}
          </Text>
          {branding.contactName && (
            <Text style={{ ...TYPE.headerContact, color: COLORS.textSecondary, marginBottom: 1 }}>
              {branding.contactName}
            </Text>
          )}
          {branding.contactPhone && (
            <Text style={{ ...TYPE.headerContact, color: COLORS.textSecondary, marginBottom: 1 }}>
              {branding.contactPhone}
            </Text>
          )}
          {branding.contactEmail && (
            <Text style={{ ...TYPE.headerContact, color: COLORS.textSecondary, marginBottom: 1 }}>
              {branding.contactEmail}
            </Text>
          )}
          {branding.businessAddress && (
            <Text style={{ ...TYPE.headerContact, color: COLORS.textMuted, marginTop: 2 }}>
              {branding.businessAddress}
            </Text>
          )}
          {branding.psrLicenceNumber && (
            <Text style={{ ...TYPE.licence, color: COLORS.textMuted, marginTop: 2 }}>
              Licence No: {branding.psrLicenceNumber}
            </Text>
          )}
        </View>
        {branding.logoUrl && (
          <Image
            src={branding.logoUrl}
            style={{
              maxWidth: dims.logoMaxWidth,
              maxHeight: dims.logoMaxHeight,
              objectFit: 'contain',
              marginLeft: SPACING.S2,
            }}
          />
        )}
      </View>

      {/* Price echo */}
      {showBackCoverPrice && content.cover.price && (
        <View style={{ ...margins, alignItems: 'center', paddingVertical: 4 }}>
          <Text style={{ ...TYPE.backPrice, color: accentColor, textAlign: 'center' }}>
            Guide Price: {content.cover.price}
          </Text>
        </View>
      )}

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

export interface ModernLuxuryTemplateProps {
  content: BrochureContent;
  branding: BrochureBranding;
}

export function ModernLuxuryTemplate({ content, branding }: ModernLuxuryTemplateProps) {
  const dims = getLayoutDimensions('a4');
  const typeOverrides = getTypeOverrides('a4');
  const ctx = buildPageRenderContext(content, branding, dims, typeOverrides);

  const pageSize = ['en-US', 'en-CA'].includes(branding.locale)
    ? ('LETTER' as const)
    : ('A4' as const);

  const p1m = getPageMargins(1, dims);
  const p2m = getPageMargins(2, dims);
  const p3m = getPageMargins(3, dims);
  const p4m = getPageMargins(4, dims);

  return (
    <Document title={content.cover.headline} author={branding.businessName}>
      {/* PAGE 1 — FRONT COVER (no header) */}
      <Page size={pageSize} orientation="portrait" style={styles.page} wrap={false}>
        <ModernCoverPageContent ctx={ctx} margins={p1m} />
      </Page>

      {/* PAGE 2 — DESCRIPTION + FEATURES */}
      <Page size={pageSize} orientation="portrait" style={styles.page} wrap={false}>
        <BrochureHeader branding={branding} compact margins={p2m} dims={dims} />
        <ModernAccommodationPageContent ctx={ctx} margins={p2m} />
      </Page>

      {/* PAGE 3 — PHOTO GRID + FEATURES + LOCATION */}
      <Page size={pageSize} orientation="portrait" style={styles.page} wrap={false}>
        <BrochureHeader branding={branding} compact margins={p3m} dims={dims} />
        <ModernFeaturesPageContent ctx={ctx} margins={p3m} />
      </Page>

      {/* PAGE 4 — BACK COVER (no header) */}
      <Page size={pageSize} orientation="portrait" style={styles.page} wrap={false}>
        <ModernBackCoverPageContent ctx={ctx} margins={p4m} />
      </Page>
    </Document>
  );
}
