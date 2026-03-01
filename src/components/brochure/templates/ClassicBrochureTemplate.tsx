import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { BrochureContent, BrochureBranding } from '@/lib/brochure/types';
import {
  SPACING,
  TIGHT,
  PRICE_ZONE,
  COLORS,
  TYPE,
  HERO_IMAGE_HEIGHT,
  ACCENT_STRIP_HEIGHT,
  RULE_WEIGHT,
  RULE_WEIGHT_HEAVY,
  getPageMargins,
  getImageRadius,
  getImageBorderStyle,
  PAGE_VERTICAL,
  normalizeText,
} from '@/lib/brochure/designTokens';
import { BrochureHeader } from './shared/BrochureHeader';
import { BrochureFooter } from './shared/BrochureFooter';
import { BrochureRoomBlock } from './shared/BrochureRoomBlock';

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

/** Split rooms into ground-floor and upper-floor groups */
function splitRoomsByFloor(rooms: BrochureContent['rooms']) {
  const ground = rooms.filter(
    (r) =>
      r.floor?.toLowerCase().includes('ground') ||
      r.floor?.toLowerCase().includes('main'),
  );
  const upper = rooms.filter((r) => !ground.includes(r));

  if (upper.length === 0 && ground.length > 5) {
    const mid = Math.ceil(ground.length / 2);
    return { page2Rooms: ground.slice(0, mid), page3Rooms: ground.slice(mid) };
  }
  if (ground.length === 0 && upper.length > 5) {
    const mid = Math.ceil(upper.length / 2);
    return { page2Rooms: upper.slice(0, mid), page3Rooms: upper.slice(mid) };
  }

  return { page2Rooms: ground, page3Rooms: upper };
}

/** Group rooms by floor label for rendering headings */
function groupByFloor(rooms: BrochureContent['rooms']) {
  const groups: Record<string, typeof rooms> = {};
  for (const room of rooms) {
    const floor = room.floor || 'Other';
    if (!groups[floor]) groups[floor] = [];
    groups[floor].push(room);
  }
  return groups;
}

/** Render a bullet item with proper two-part layout */
function BulletItem({ text, style }: { text: string; style?: 'feature' | 'keyFeature' | 'default' }) {
  const fontSize = style === 'keyFeature' ? TYPE.keyFeature.fontSize : TYPE.bullet.fontSize;
  const color = style === 'keyFeature' ? COLORS.textPrimary : COLORS.textSecondary;
  return (
    <View style={{ flexDirection: 'row', marginBottom: 2.5 }}>
      <Text style={{ fontSize, width: 8, color: COLORS.textSecondary }}>{'\u2022'}</Text>
      <Text style={{ fontSize, flex: 1, color, lineHeight: TYPE.bullet.lineHeight }}>{text}</Text>
    </View>
  );
}

/** Render a section title with accent-color underline rule */
function SectionTitle({ title, primaryColor, accentColor, ruleWidth }: {
  title: string;
  primaryColor: string;
  accentColor?: string;
  ruleWidth?: string;
}) {
  return (
    <View style={{ marginBottom: SPACING.HALF, marginTop: SPACING.S1 }}>
      <Text style={{ ...TYPE.sectionTitle, color: primaryColor, marginBottom: 3 }}>
        {title}
      </Text>
      {accentColor && (
        <View style={{
          borderBottomWidth: RULE_WEIGHT_HEAVY,
          borderBottomColor: accentColor,
          width: ruleWidth || '40%',
        }} />
      )}
    </View>
  );
}

/** Render a floor heading with accent-color bottom rule */
function FloorHeading({ floor, accentColor }: { floor: string; accentColor: string }) {
  return (
    <View style={{ marginBottom: 4, marginTop: SPACING.HALF }}>
      <Text style={{ ...TYPE.floorHeading, color: accentColor, marginBottom: 2 }}>
        {floor}
      </Text>
      <View style={{
        borderBottomWidth: RULE_WEIGHT_HEAVY,
        borderBottomColor: accentColor,
        width: '30%',
      }} />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────

const p1Margins = getPageMargins(1);
const p2Margins = getPageMargins(2);
const p3Margins = getPageMargins(3);
const p4Margins = getPageMargins(4);

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: TYPE.body.fontSize,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
  },

  /* ── Page 1: Cover ── */
  coverContent: {
    flex: 1,
    ...p1Margins,
    paddingTop: PAGE_VERTICAL.top,
    paddingBottom: PRICE_ZONE.minFromTrim,
  },
  coverTextBlock: {
    alignItems: 'center',
    paddingTop: SPACING.HALF,
    paddingBottom: 2,
  },
  coverAddress: {
    ...TYPE.coverAddress,
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 1.2,
    color: COLORS.textPrimary,
  },
  coverSaleMethod: {
    ...TYPE.coverSaleMethod,
    textAlign: 'center',
    marginTop: 3,
  },
  coverDivider: {
    borderBottomWidth: RULE_WEIGHT,
    alignSelf: 'center',
    width: '60%',
    marginVertical: SPACING.HALF,
  },
  coverDescriptionBlock: {
    paddingHorizontal: 6,
    marginTop: 4,
  },
  coverDescriptionText: {
    ...TYPE.coverDescription,
    color: COLORS.textSecondary,
    textAlign: 'justify',
    marginBottom: 4,
  },
  coverBottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: PRICE_ZONE.above,
    paddingTop: TIGHT.HALF,
    paddingBottom: TIGHT.HALF,
  },
  coverPrice: {
    ...TYPE.coverPrice,
    textAlign: 'center',
  },
  berBadge: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderRadius: 3,
    marginLeft: 18,
  },

  /* ── Pages 2–3: Content ── */
  contentBodyP2: {
    ...p2Margins,
    paddingTop: PAGE_VERTICAL.top,
    paddingBottom: PAGE_VERTICAL.bottom,
    flex: 1,
  },
  contentBodyP3: {
    ...p3Margins,
    paddingTop: PAGE_VERTICAL.top,
    paddingBottom: PAGE_VERTICAL.bottom,
    flex: 1,
  },
  separator: {
    borderBottomWidth: RULE_WEIGHT,
    marginVertical: SPACING.HALF,
  },

  /* ── Features (compact columns) ── */
  featureColumns: {
    flexDirection: 'row',
    marginBottom: SPACING.HALF,
  },
  featureColumn: {
    flex: 1,
    marginRight: 10,
  },

  /* ── Photo pair (2 side-by-side on Page 3) ── */
  photoPair: {
    flexDirection: 'row',
    marginTop: TIGHT.HALF,
    marginBottom: TIGHT.HALF,
  },
  photoPairSpacer: {
    width: '4%',
  },

  /* ── Price banner ── */
  priceBanner: {
    marginTop: PRICE_ZONE.above,
    paddingVertical: TIGHT.HALF,
    paddingBottom: PRICE_ZONE.below,
    alignItems: 'center',
  },
  priceBannerText: {
    ...TYPE.priceBanner,
    textAlign: 'center',
  },

  /* ── Page 4: Back Cover ── */
  backCoverBody: {
    flex: 1,
    ...p4Margins,
    paddingTop: PAGE_VERTICAL.top,
    paddingBottom: PAGE_VERTICAL.bottom,
  },

  backPriceBanner: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  backPriceText: {
    ...TYPE.backPrice,
    textAlign: 'center',
  },

  /* ── Contact block on back cover ── */
  contactBlock: {
    alignItems: 'center',
    paddingVertical: SPACING.HALF,
  },
});

// ── Component ────────────────────────────────────────────────────────────

interface ClassicBrochureTemplateProps {
  content: BrochureContent;
  branding: BrochureBranding;
}

export function ClassicBrochureTemplate({ content, branding }: ClassicBrochureTemplateProps) {
  const visible = content.visibleSections || {};
  const accentColor = branding.secondaryColor || '#c53030';
  const primaryColor = branding.primaryColor || '#1a365d';
  const styleOptions = branding.styleOptions;
  const imgRadius = getImageRadius(styleOptions);
  const imgBorder = getImageBorderStyle(styleOptions);
  const showInnerPrice = styleOptions?.showInnerPrice ?? false;
  const showBackCoverPrice = styleOptions?.showBackCoverPrice ?? false;
  const pageSize = ['en-US', 'en-CA'].includes(branding.locale)
    ? ('LETTER' as const)
    : ('A4' as const);

  // Split description into paragraphs — cap at 2 for cover fit
  const allParagraphs = content.description.marketingText
    .split('\n')
    .filter((p) => p.trim());
  const coverParagraphs = allParagraphs.slice(0, 2);

  // Key features — cap at 6
  const keyFeatures = content.description.keyFeatures.slice(0, 6);

  // Room splitting
  const { page2Rooms, page3Rooms } = splitRoomsByFloor(content.rooms);
  const page2Groups = groupByFloor(page2Rooms);
  const page3Groups = groupByFloor(page3Rooms);

  // Gallery photos for Page 3 accent pair (pick first 2 gallery items)
  const accentPhotos = content.gallery.slice(0, 2);

  // Back cover: use up to 4 gallery photos for the grid
  const backCoverGallery = content.gallery.slice(0, 4);

  // Back cover photo fallback (used if fewer than 2 gallery photos)
  const backCoverPhoto =
    content.cover.backCoverPhotoUrl ||
    content.gallery[2]?.url ||
    content.gallery[0]?.url ||
    content.cover.heroPhotoUrl;

  // Whether we have floor plans
  const hasFloorPlans =
    visible.floorPlans !== false && content.floorPlans.length > 0;

  // Certification logos
  const certLogos = styleOptions?.certificationLogos?.filter(l => l.enabled) || [];

  // Whether "nearby" column has content
  const hasNearby = content.features.nearby && content.features.nearby.length > 0;
  const hasServices = content.features.services.length > 0;
  const hasExternal = content.features.external.length > 0;

  return (
    <Document title={content.cover.headline} author={branding.businessName}>
      {/* ═══════════════════════════════════════════════════════════════════
          PAGE 1 — FRONT COVER
          ═══════════════════════════════════════════════════════════════════ */}
      <Page size={pageSize} style={styles.page}>
        <BrochureHeader branding={branding} margins={p1Margins} />

        <View style={styles.coverContent}>
          {/* Hero Image */}
          {content.cover.heroPhotoUrl && (
            <Image
              src={content.cover.heroPhotoUrl}
              style={{
                width: '100%',
                height: HERO_IMAGE_HEIGHT,
                objectFit: 'cover',
                borderRadius: imgRadius,
                ...imgBorder,
              }}
            />
          )}

          {/* Thin divider rule */}
          <View style={[styles.coverDivider, { borderBottomColor: accentColor }]} />

          {/* Address + Sale Method */}
          <View style={styles.coverTextBlock}>
            <Text style={styles.coverAddress}>{content.cover.address}</Text>
            <Text style={[styles.coverSaleMethod, { color: accentColor }]}>
              {content.cover.saleMethod}
            </Text>
          </View>

          {/* Marketing Description on cover */}
          {visible.description !== false && coverParagraphs.length > 0 && (
            <View style={styles.coverDescriptionBlock}>
              {coverParagraphs.map((paragraph, i) => (
                <Text key={i} style={styles.coverDescriptionText}>
                  {normalizeText(paragraph)}
                </Text>
              ))}
            </View>
          )}

          {/* Price + BER — anchored to bottom */}
          <View style={styles.coverBottomRow}>
            {content.cover.price && (
              <Text style={[styles.coverPrice, { color: accentColor }]}>
                Guide Price: {content.cover.price}
              </Text>
            )}
            {content.cover.energyRating && (
              <Text
                style={[
                  styles.berBadge,
                  { borderColor: accentColor, color: accentColor },
                ]}
              >
                {getBerLabel(branding.locale)} {content.cover.energyRating}
              </Text>
            )}
          </View>
        </View>
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════
          PAGE 2 — ACCOMMODATION (Ground Floor)
          ═══════════════════════════════════════════════════════════════════ */}
      <Page size={pageSize} style={styles.page}>
        <BrochureHeader branding={branding} compact margins={p2Margins} />

        <View style={styles.contentBodyP2}>
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

          <View style={[styles.separator, { borderBottomColor: accentColor, marginVertical: TIGHT.HALF }]} />

          {/* Accommodation heading */}
          {visible.rooms !== false && page2Rooms.length > 0 && (
            <View>
              <SectionTitle
                title="Accommodation Comprises Of The Following"
                primaryColor={primaryColor}
                accentColor={accentColor}
                ruleWidth="50%"
              />

              {Object.entries(page2Groups).map(([floor, rooms]) => (
                <View key={floor}>
                  <FloorHeading floor={floor} accentColor={accentColor} />
                  {rooms.map((room) => (
                    <BrochureRoomBlock
                      key={room.id}
                      room={room}
                      compact
                      accentColor={accentColor}
                      imageRadius={imgRadius}
                      imageBorder={imgBorder}
                    />
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════
          PAGE 3 — UPPER FLOOR + FEATURES + LOCATION + PRICE
          ═══════════════════════════════════════════════════════════════════ */}
      <Page size={pageSize} style={styles.page}>
        <BrochureHeader branding={branding} compact margins={p3Margins} />

        <View style={styles.contentBodyP3}>
          {/* Remaining rooms */}
          {visible.rooms !== false && page3Rooms.length > 0 && (
            <View>
              {Object.entries(page3Groups).map(([floor, rooms]) => (
                <View key={floor}>
                  <FloorHeading floor={floor} accentColor={accentColor} />
                  {rooms.map((room) => (
                    <BrochureRoomBlock
                      key={room.id}
                      room={room}
                      compact
                      accentColor={accentColor}
                      imageRadius={imgRadius}
                      imageBorder={imgBorder}
                    />
                  ))}
                </View>
              ))}
            </View>
          )}

          <View style={[styles.separator, { borderBottomColor: accentColor }]} />

          {/* Features: Services | External | Nearby (2 or 3 columns) */}
          {visible.features !== false && (hasServices || hasExternal) && (
            <View style={styles.featureColumns}>
              {hasServices && (
                <View style={styles.featureColumn}>
                  <Text style={{ ...TYPE.featureTitle, color: primaryColor, marginBottom: 3 }}>
                    Services
                  </Text>
                  {content.features.services.map((service, i) => (
                    <BulletItem key={i} text={normalizeText(service)} />
                  ))}
                </View>
              )}
              {hasExternal && (
                <View style={styles.featureColumn}>
                  <Text style={{ ...TYPE.featureTitle, color: primaryColor, marginBottom: 3 }}>
                    Features
                  </Text>
                  {content.features.external.map((feature, i) => (
                    <BulletItem key={i} text={normalizeText(feature)} />
                  ))}
                </View>
              )}
              {hasNearby && (
                <View style={styles.featureColumn}>
                  <Text style={{ ...TYPE.featureTitle, color: primaryColor, marginBottom: 3 }}>
                    Nearby
                  </Text>
                  {content.features.nearby.map((item, i) => (
                    <BulletItem key={i} text={normalizeText(item)} />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Location */}
          {visible.location !== false && content.location.text && (
            <View>
              <SectionTitle title="Location" primaryColor={primaryColor} accentColor={accentColor} ruleWidth="25%" />
              <Text style={{ ...TYPE.location, color: COLORS.textSecondary, textAlign: 'justify' }}>
                {normalizeText(content.location.text)}
              </Text>
            </View>
          )}

          {/* Two accent photos side-by-side with captions */}
          {visible.gallery !== false && accentPhotos.length >= 2 && (
            <View style={styles.photoPair}>
              <View style={{ width: '48%' }}>
                <Image
                  src={accentPhotos[0].url}
                  style={{
                    width: '100%',
                    height: 95,
                    objectFit: 'cover',
                    borderRadius: imgRadius,
                    ...imgBorder,
                  }}
                />
                {accentPhotos[0].caption && (
                  <Text style={{ ...TYPE.caption, color: COLORS.textMuted, textAlign: 'center', marginTop: 2 }}>
                    {normalizeText(accentPhotos[0].caption)}
                  </Text>
                )}
              </View>
              <View style={styles.photoPairSpacer} />
              <View style={{ width: '48%' }}>
                <Image
                  src={accentPhotos[1].url}
                  style={{
                    width: '100%',
                    height: 95,
                    objectFit: 'cover',
                    borderRadius: imgRadius,
                    ...imgBorder,
                  }}
                />
                {accentPhotos[1].caption && (
                  <Text style={{ ...TYPE.caption, color: COLORS.textMuted, textAlign: 'center', marginTop: 2 }}>
                    {normalizeText(accentPhotos[1].caption)}
                  </Text>
                )}
              </View>
            </View>
          )}
          {visible.gallery !== false && accentPhotos.length === 1 && (
            <View style={styles.photoPair}>
              <View style={{ width: '100%' }}>
                <Image
                  src={accentPhotos[0].url}
                  style={{
                    width: '100%',
                    height: 95,
                    objectFit: 'cover',
                    borderRadius: imgRadius,
                    ...imgBorder,
                  }}
                />
                {accentPhotos[0].caption && (
                  <Text style={{ ...TYPE.caption, color: COLORS.textMuted, textAlign: 'center', marginTop: 2 }}>
                    {normalizeText(accentPhotos[0].caption)}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Guide Price banner — shown only if toggled on */}
          {showInnerPrice && content.cover.price && (
            <View style={styles.priceBanner}>
              <Text style={[styles.priceBannerText, { color: accentColor }]}>
                Guide Price: {content.cover.price}
              </Text>
            </View>
          )}
        </View>
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════
          PAGE 4 — BACK COVER
          ═══════════════════════════════════════════════════════════════════ */}
      <Page size={pageSize} style={styles.page}>
        <BrochureHeader branding={branding} compact margins={p4Margins} />

        <View style={styles.backCoverBody}>
          {/* Gallery photos — 2x2 captioned grid or single large photo */}
          {backCoverGallery.length >= 2 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: SPACING.S1 }}>
              {backCoverGallery.map((photo, idx) => (
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
                      height: hasFloorPlans ? 90 : 180,
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
          ) : backCoverPhoto ? (
            <Image
              src={backCoverPhoto}
              style={{
                width: '100%',
                height: hasFloorPlans ? 220 : 320,
                objectFit: 'cover',
                borderRadius: imgRadius,
                ...imgBorder,
                marginBottom: SPACING.S1,
              }}
            />
          ) : null}

          {/* Floor Plans — framed container */}
          {hasFloorPlans &&
            content.floorPlans.map((plan) => (
              <View
                key={plan.id}
                style={{
                  backgroundColor: COLORS.subtleBg,
                  borderWidth: RULE_WEIGHT,
                  borderColor: COLORS.borderLight,
                  borderRadius: imgRadius,
                  padding: 12,
                  marginBottom: SPACING.HALF,
                  alignItems: 'center',
                }}
              >
                <Image
                  src={plan.imageUrl}
                  style={{
                    width: '90%',
                    maxHeight: 220,
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

          {/* Flexible space pushes everything below to the bottom */}
          <View style={{ flex: 1 }} />

          {/* Thin separator rule */}
          <View style={{
            borderBottomWidth: RULE_WEIGHT,
            borderBottomColor: COLORS.rule,
            marginBottom: SPACING.HALF,
          }} />

          {/* Contact block */}
          <View style={styles.contactBlock}>
            <Text style={{
              ...TYPE.headerContact,
              color: COLORS.textSecondary,
            }}>
              {[
                branding.contactPhone ? `Tel: ${branding.contactPhone}` : null,
                branding.contactEmail,
              ].filter(Boolean).join('  \u00B7  ')}
            </Text>
          </View>

          {/* Certification logos band — dark background for white logos */}
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
                      height: 24,
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

          {/* Price echo on back cover — shown only if toggled on */}
          {showBackCoverPrice && content.cover.price && (
            <View style={styles.backPriceBanner}>
              <Text style={[styles.backPriceText, { color: accentColor }]}>
                Guide Price: {content.cover.price}
              </Text>
            </View>
          )}

          {/* Legal footer — in document flow */}
          {visible.legal !== false && (
            <BrochureFooter
              branding={branding}
              legal={content.legal}
              showContact={false}
              margins={p4Margins}
              inFlow
            />
          )}
        </View>
      </Page>
    </Document>
  );
}
