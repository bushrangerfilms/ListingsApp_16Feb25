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
  getLayoutDimensions,
  getTypeOverrides,
  type LayoutDimensions,
} from '@/lib/brochure/designTokens';
import { BrochureHeader } from './shared/BrochureHeader';
import { BrochureFooter } from './shared/BrochureFooter';
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

/** PAGE 1 — ELEGANT FRONT COVER
 *  Top section: sale method (italic) + address (bold), logo top-right
 *  Hero photo fills remaining page
 */
export function ElegantCoverPageContent({ ctx, margins }: PageContentProps) {
  const { content, branding, dims, typeOverrides, accentColor, primaryColor, imgRadius } = ctx;
  const addressStyle = typeOverrides.coverAddress
    ? { ...TYPE.coverAddress, fontSize: typeOverrides.coverAddress.fontSize }
    : TYPE.coverAddress;

  return (
    <View style={{ flex: 1 }}>
      {/* Top banner: sale method + address + logo */}
      <View style={{
        ...margins,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingTop: PAGE_VERTICAL.top + 4,
        paddingBottom: SPACING.S1,
      }}>
        {/* Sale method + address (left side) */}
        <View style={{ flex: 1, paddingRight: SPACING.S2 }}>
          <Text style={{
            fontFamily: 'Helvetica-Oblique',
            fontSize: 14,
            color: accentColor,
            marginBottom: 4,
          }}>
            {content.cover.saleMethod}
          </Text>
          <Text style={{
            ...addressStyle,
            lineHeight: 1.2,
            color: COLORS.textPrimary,
          }}>
            {content.cover.address}
          </Text>
        </View>

        {/* Logo (top-right) */}
        {branding.logoUrl && (
          <Image
            src={branding.logoUrl}
            style={{
              maxWidth: dims.logoMaxWidth,
              maxHeight: dims.logoMaxHeight,
              objectFit: 'contain',
            }}
          />
        )}
      </View>

      {/* Thin accent rule */}
      <View style={{
        borderBottomWidth: RULE_WEIGHT_HEAVY,
        borderBottomColor: accentColor,
        marginHorizontal: margins.paddingLeft,
        marginBottom: 0,
      }} />

      {/* Hero photo — fills remaining space */}
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
    </View>
  );
}

/** PAGE 2 — DESCRIPTION + KEY FEATURES (2 columns) + PRICE + PHOTO */
export function ElegantAccommodationPageContent({ ctx, margins }: PageContentProps) {
  const {
    content, branding, dims, accentColor, primaryColor,
    imgRadius, imgBorder, coverParagraphs, keyFeatures, visible,
  } = ctx;

  // Split features into 2 columns
  const mid = Math.ceil(keyFeatures.length / 2);
  const leftFeatures = keyFeatures.slice(0, mid);
  const rightFeatures = keyFeatures.slice(mid);

  // Feature photo for bottom of page (don't fall back to hero — it's on the cover)
  const featurePhoto = content.gallery[0]?.url
    || content.cover.backCoverPhotoUrl
    || null;

  return (
    <View style={{
      ...margins,
      paddingTop: PAGE_VERTICAL.top,
      paddingBottom: PAGE_VERTICAL.bottom,
      flex: 1,
    }}>
      {/* Address heading */}
      <Text style={{
        ...TYPE.coverSaleMethod,
        color: COLORS.textMuted,
        textAlign: 'center',
        marginBottom: SPACING.S1,
      }}>
        {content.cover.address}
      </Text>

      {/* Description */}
      {visible.description !== false && coverParagraphs.length > 0 && (
        <View style={{ marginBottom: SPACING.S1 }}>
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

      {/* Key Features in 2 columns */}
      {visible.description !== false && keyFeatures.length > 0 && (
        <View style={{ marginBottom: SPACING.S1 }}>
          <Text style={{
            ...TYPE.featureTitle,
            color: primaryColor,
            marginBottom: 4,
          }}>
            Home Features
          </Text>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              {leftFeatures.map((feature, i) => (
                <BulletItem key={i} text={normalizeText(feature)} style="keyFeature" />
              ))}
            </View>
            <View style={{ flex: 1 }}>
              {rightFeatures.map((feature, i) => (
                <BulletItem key={i} text={normalizeText(feature)} style="keyFeature" />
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Price — right-aligned with accent underline */}
      {content.cover.price && (
        <View style={{
          alignItems: 'flex-end',
          marginBottom: SPACING.S1,
        }}>
          <Text style={{
            fontFamily: 'Helvetica',
            fontSize: 9,
            color: COLORS.textMuted,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            marginBottom: 2,
          }}>
            Guide Price
          </Text>
          <Text style={{
            ...TYPE.priceBanner,
            color: primaryColor,
          }}>
            {content.cover.price}
          </Text>
          <View style={{
            borderBottomWidth: RULE_WEIGHT_HEAVY,
            borderBottomColor: accentColor,
            width: 50,
            marginTop: 3,
          }} />
        </View>
      )}

      {/* BER badge */}
      {content.cover.energyRating && (
        <View style={{ alignItems: 'flex-end', marginBottom: SPACING.HALF }}>
          <Text style={{
            fontSize: 9,
            fontFamily: 'Helvetica-Bold',
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderWidth: 1,
            borderColor: primaryColor,
            color: primaryColor,
            borderRadius: 2,
          }}>
            {getBerLabel(branding.locale)} {content.cover.energyRating}
          </Text>
        </View>
      )}

      {/* Flex spacer */}
      <View style={{ flex: 1 }} />

      {/* Feature photo at bottom */}
      {featurePhoto && (
        <Image
          src={featurePhoto}
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

/** PAGE 3 — PHOTO MOSAIC + FEATURES + LOCATION */
export function ElegantFeaturesPageContent({ ctx, margins }: PageContentProps) {
  const {
    content, dims, accentColor, primaryColor, imgRadius, imgBorder,
    visible, backCoverGallery, accentPhotos,
    hasNearby, hasServices, hasExternal,
    cappedServices, cappedExternal, cappedNearby,
    hasFloorPlans, cappedFloorPlans,
  } = ctx;

  // Photo mosaic: 1 large photo top + row of 2-4 smaller below
  // Deduplicate back cover gallery against accent photos to avoid repeats
  const seenUrls = new Set(accentPhotos.map(p => p.url));
  const uniqueBackCover = backCoverGallery.filter(p => !seenUrls.has(p.url));
  const allPhotos = [...accentPhotos, ...uniqueBackCover];
  const largePhoto = allPhotos[0];
  const smallPhotos = allPhotos.slice(1, 5);

  return (
    <View style={{
      ...margins,
      paddingTop: PAGE_VERTICAL.top,
      paddingBottom: PAGE_VERTICAL.bottom,
      flex: 1,
    }}>
      {/* Large feature photo */}
      {visible.gallery !== false && largePhoto && (
        <View style={{ marginBottom: SPACING.HALF }}>
          <Image
            src={largePhoto.url}
            style={{
              width: '100%',
              height: dims.heroImageHeight * 0.45,
              objectFit: 'cover',
              borderRadius: imgRadius,
              ...imgBorder,
            }}
          />
          {largePhoto.caption && (
            <Text style={{ ...TYPE.caption, color: COLORS.textMuted, textAlign: 'center', marginTop: 2 }}>
              {normalizeText(largePhoto.caption)}
            </Text>
          )}
        </View>
      )}

      {/* Row of smaller photos (2-4 in a row) */}
      {visible.gallery !== false && smallPhotos.length >= 2 && (
        <View style={{
          flexDirection: 'row',
          marginBottom: SPACING.S1,
        }}>
          {smallPhotos.map((photo, idx) => {
            const count = smallPhotos.length;
            const widthPct = count <= 2 ? '48%' : count === 3 ? '31%' : '23%';
            const gapPct = count <= 2 ? '4%' : count === 3 ? '3.5%' : '2.66%';
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
                    height: dims.accentPhotoHeight * 0.7,
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
        <View style={{ marginBottom: SPACING.HALF }}>
          <View style={{ marginBottom: SPACING.HALF }}>
            <Text style={{ ...TYPE.sectionTitle, color: primaryColor, marginBottom: 3 }}>
              Location
            </Text>
            <View style={{
              borderBottomWidth: RULE_WEIGHT_HEAVY,
              borderBottomColor: accentColor,
              width: '25%',
            }} />
          </View>
          <Text style={{ ...TYPE.location, color: COLORS.textSecondary, textAlign: 'justify' }}>
            {normalizeText(content.location.text)}
          </Text>
        </View>
      )}

      {/* Floor Plan */}
      {hasFloorPlans && cappedFloorPlans.map((plan) => (
        <View
          key={plan.id}
          style={{
            backgroundColor: COLORS.subtleBg,
            borderWidth: RULE_WEIGHT,
            borderColor: COLORS.borderLight,
            borderRadius: imgRadius,
            padding: 10,
            alignItems: 'center',
          }}
        >
          <Image
            src={plan.imageUrl}
            style={{
              width: '85%',
              maxHeight: dims.floorPlanMaxHeight * 0.8,
              objectFit: 'contain',
            }}
          />
          {plan.label && (
            <Text style={{
              ...TYPE.floorPlanLabel,
              color: primaryColor,
              textAlign: 'center',
              marginTop: 4,
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

/** PAGE 4 — ELEGANT BACK COVER (two photos, contact + logo, certs, legal) */
export function ElegantBackCoverPageContent({ ctx, margins }: PageContentProps) {
  const {
    content, branding, dims, primaryColor, accentColor, imgRadius, imgBorder,
    visible, backCoverPhoto, backCoverGallery, certLogos, showBackCoverPrice,
  } = ctx;

  // Two photos side-by-side at top
  const photo1 = backCoverPhoto || backCoverGallery[0]?.url;
  const photo2 = backCoverGallery[1]?.url || content.gallery[1]?.url;
  const twoPhotoHeight = dims.heroImageHeight * 0.5;

  return (
    <View style={{
      flex: 1,
      ...margins,
      paddingTop: PAGE_VERTICAL.top,
      paddingBottom: PAGE_VERTICAL.bottom,
    }}>
      {/* Two photos side-by-side */}
      {photo1 && photo2 ? (
        <View style={{ flexDirection: 'row', marginBottom: SPACING.S1 }}>
          <View style={{ width: '48%' }}>
            <Image
              src={photo1}
              style={{
                width: '100%',
                height: twoPhotoHeight,
                objectFit: 'cover',
                borderRadius: imgRadius,
                ...imgBorder,
              }}
            />
          </View>
          <View style={{ width: '4%' }} />
          <View style={{ width: '48%' }}>
            <Image
              src={photo2}
              style={{
                width: '100%',
                height: twoPhotoHeight,
                objectFit: 'cover',
                borderRadius: imgRadius,
                ...imgBorder,
              }}
            />
          </View>
        </View>
      ) : photo1 ? (
        <Image
          src={photo1}
          style={{
            width: '100%',
            height: twoPhotoHeight,
            objectFit: 'cover',
            borderRadius: imgRadius,
            ...imgBorder,
            marginBottom: SPACING.S1,
          }}
        />
      ) : null}

      {/* Flex spacer */}
      <View style={{ flex: 1 }} />

      {/* Contact + logo row */}
      <View style={{
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
          <Text style={{ ...TYPE.headerContact, color: COLORS.textSecondary, marginBottom: 1 }}>
            {[branding.contactPhone, branding.contactEmail].filter(Boolean).join(' | ')}
          </Text>
          {branding.businessAddress && (
            <Text style={{ ...TYPE.headerContact, color: COLORS.textMuted, marginTop: 1 }}>
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
        <View style={{ alignItems: 'center', paddingVertical: 4 }}>
          <Text style={{ ...TYPE.backPrice, color: accentColor, textAlign: 'center' }}>
            Guide Price: {content.cover.price}
          </Text>
        </View>
      )}

      {/* Certification logos band */}
      {certLogos.length > 0 && (
        <View style={{
          backgroundColor: primaryColor,
          borderRadius: 3,
          paddingVertical: 8,
          paddingHorizontal: 12,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          marginVertical: SPACING.HALF,
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

export interface ElegantTraditionalTemplateProps {
  content: BrochureContent;
  branding: BrochureBranding;
}

export function ElegantTraditionalTemplate({ content, branding }: ElegantTraditionalTemplateProps) {
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
      {/* PAGE 1 — FRONT COVER (elegant: sale method + address at top, hero below) */}
      <Page size={pageSize} orientation="portrait" style={styles.page} wrap={false}>
        <ElegantCoverPageContent ctx={ctx} margins={p1m} />
      </Page>

      {/* PAGE 2 — DESCRIPTION + KEY FEATURES + PRICE */}
      <Page size={pageSize} orientation="portrait" style={styles.page} wrap={false}>
        <BrochureHeader branding={branding} compact margins={p2m} dims={dims} />
        <ElegantAccommodationPageContent ctx={ctx} margins={p2m} />
      </Page>

      {/* PAGE 3 — PHOTO MOSAIC + FEATURES + LOCATION */}
      <Page size={pageSize} orientation="portrait" style={styles.page} wrap={false}>
        <BrochureHeader branding={branding} compact margins={p3m} dims={dims} />
        <ElegantFeaturesPageContent ctx={ctx} margins={p3m} />
      </Page>

      {/* PAGE 4 — BACK COVER */}
      <Page size={pageSize} orientation="portrait" style={styles.page} wrap={false}>
        <ElegantBackCoverPageContent ctx={ctx} margins={p4m} />
      </Page>
    </Document>
  );
}
