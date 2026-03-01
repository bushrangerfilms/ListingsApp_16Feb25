import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { BrochureContent, BrochureBranding } from '@/lib/brochure/types';
import { BrochureHeader } from './shared/BrochureHeader';
import { BrochureFooter } from './shared/BrochureFooter';
import { BrochureRoomBlock } from './shared/BrochureRoomBlock';
import { BrochurePhotoGrid } from './shared/BrochurePhotoGrid';

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

  // Fallback: if everything ended up in one bucket, split roughly in half
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

// ── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#222',
    backgroundColor: '#fff',
  },

  /* ── Page 1: Cover ── */
  coverContent: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 12,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
  heroImage: {
    width: '100%',
    height: 280,
    objectFit: 'cover',
    borderRadius: 3,
  },
  coverTextBlock: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  coverAddress: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 2,
    lineHeight: 1.2,
  },
  coverSaleMethod: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginTop: 4,
  },
  coverDescriptionBlock: {
    paddingHorizontal: 6,
    marginTop: 6,
  },
  coverDescriptionText: {
    fontSize: 8.5,
    fontFamily: 'Helvetica',
    lineHeight: 1.45,
    color: '#333',
    textAlign: 'justify',
    marginBottom: 4,
  },
  coverBottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 8,
  },
  coverPrice: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
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
  contentBody: {
    paddingHorizontal: 30,
    paddingTop: 10,
    paddingBottom: 50,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionTitleAccent: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  floorHeading: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 5,
    marginTop: 8,
    textDecoration: 'underline',
  },
  separator: {
    borderBottomWidth: 0.5,
    marginVertical: 8,
  },

  /* ── Features (compact 2-col) ── */
  featureColumns: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  featureColumn: {
    flex: 1,
    marginRight: 12,
  },
  featureTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  bulletItem: {
    fontSize: 7.5,
    fontFamily: 'Helvetica',
    color: '#444',
    marginBottom: 2,
    paddingLeft: 6,
  },
  keyFeatureItem: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#333',
    marginBottom: 2,
    paddingLeft: 8,
  },

  /* ── Location ── */
  locationText: {
    fontSize: 8.5,
    fontFamily: 'Helvetica',
    lineHeight: 1.35,
    color: '#333',
    marginBottom: 6,
    textAlign: 'justify',
  },

  /* ── Photo pair (2 side-by-side on Page 3) ── */
  photoPair: {
    flexDirection: 'row',
    marginTop: 6,
    marginBottom: 6,
  },
  photoPairImage: {
    width: '48%',
    height: 95,
    objectFit: 'cover',
    borderRadius: 2,
  },
  photoPairSpacer: {
    width: '4%',
  },

  /* ── Price banner ── */
  priceBanner: {
    marginTop: 'auto',
    paddingVertical: 10,
    alignItems: 'center',
  },
  priceBannerText: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },

  /* ── Page 4: Back Cover ── */
  accentBand: {
    height: 6,
    width: '100%',
  },
  backCoverBody: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 12,
    paddingBottom: 50,
  },
  backCoverPhoto: {
    width: '100%',
    height: 220,
    objectFit: 'cover',
    borderRadius: 3,
    marginBottom: 10,
  },
  backCoverPhotoLarge: {
    width: '100%',
    height: 320,
    objectFit: 'cover',
    borderRadius: 3,
    marginBottom: 10,
  },
  floorPlanImage: {
    width: '100%',
    maxHeight: 260,
    objectFit: 'contain',
    marginBottom: 4,
  },
  floorPlanLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  floorPlanNote: {
    fontSize: 7,
    fontFamily: 'Helvetica-Oblique',
    color: '#888',
    textAlign: 'center',
    marginBottom: 8,
  },
  backPriceBanner: {
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 'auto',
  },
  backPriceText: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
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

  // Back cover photo: explicit backCoverPhotoUrl, or 3rd gallery item, or hero
  const backCoverPhoto =
    content.cover.backCoverPhotoUrl ||
    content.gallery[2]?.url ||
    content.gallery[0]?.url ||
    content.cover.heroPhotoUrl;

  // Whether we have floor plans
  const hasFloorPlans =
    visible.floorPlans !== false && content.floorPlans.length > 0;

  return (
    <Document title={content.cover.headline} author={branding.businessName}>
      {/* ═══════════════════════════════════════════════════════════════════
          PAGE 1 — FRONT COVER
          ═══════════════════════════════════════════════════════════════════ */}
      <Page size={pageSize} style={styles.page}>
        <BrochureHeader branding={branding} />

        <View style={styles.coverContent}>
          {/* Hero Image */}
          {content.cover.heroPhotoUrl && (
            <Image src={content.cover.heroPhotoUrl} style={styles.heroImage} />
          )}

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
                  {paragraph}
                </Text>
              ))}
            </View>
          )}

          {/* Price + BER */}
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
        <BrochureHeader branding={branding} compact />

        <View style={styles.contentBody}>
          {/* Key Features (moved here from old description page) */}
          {visible.description !== false && keyFeatures.length > 0 && (
            <View style={{ marginBottom: 6 }}>
              <Text style={[styles.featureTitle, { color: primaryColor }]}>
                Key Features
              </Text>
              {keyFeatures.map((feature, i) => (
                <Text key={i} style={styles.keyFeatureItem}>
                  • {feature}
                </Text>
              ))}
            </View>
          )}

          <View style={[styles.separator, { borderBottomColor: accentColor }]} />

          {/* Accommodation heading */}
          {visible.rooms !== false && page2Rooms.length > 0 && (
            <View>
              <Text
                style={[
                  styles.sectionTitleAccent,
                  { color: primaryColor, textDecoration: 'underline', textDecorationColor: accentColor },
                ]}
              >
                Accommodation Comprises Of The Following
              </Text>

              {Object.entries(page2Groups).map(([floor, rooms]) => (
                <View key={floor}>
                  <Text style={[styles.floorHeading, { color: accentColor }]}>
                    {floor}
                  </Text>
                  {rooms.map((room) => (
                    <BrochureRoomBlock
                      key={room.id}
                      room={room}
                      compact
                      accentColor={accentColor}
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
        <BrochureHeader branding={branding} compact />

        <View style={styles.contentBody}>
          {/* Remaining rooms */}
          {visible.rooms !== false && page3Rooms.length > 0 && (
            <View>
              {Object.entries(page3Groups).map(([floor, rooms]) => (
                <View key={floor}>
                  <Text style={[styles.floorHeading, { color: accentColor }]}>
                    {floor}
                  </Text>
                  {rooms.map((room) => (
                    <BrochureRoomBlock
                      key={room.id}
                      room={room}
                      compact
                      accentColor={accentColor}
                    />
                  ))}
                </View>
              ))}
            </View>
          )}

          <View style={[styles.separator, { borderBottomColor: accentColor }]} />

          {/* Features: Services | External (2-column) */}
          {visible.features !== false && (
            <View style={styles.featureColumns}>
              {content.features.services.length > 0 && (
                <View style={styles.featureColumn}>
                  <Text style={[styles.featureTitle, { color: primaryColor }]}>
                    Services
                  </Text>
                  {content.features.services.map((service, i) => (
                    <Text key={i} style={styles.bulletItem}>
                      • {service}
                    </Text>
                  ))}
                </View>
              )}
              {content.features.external.length > 0 && (
                <View style={styles.featureColumn}>
                  <Text style={[styles.featureTitle, { color: primaryColor }]}>
                    Features
                  </Text>
                  {content.features.external.map((feature, i) => (
                    <Text key={i} style={styles.bulletItem}>
                      • {feature}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Location */}
          {visible.location !== false && (
            <View>
              <Text style={[styles.sectionTitle, { color: primaryColor }]}>
                Location
              </Text>
              <Text style={styles.locationText}>{content.location.text}</Text>
            </View>
          )}

          {/* Two accent photos side-by-side */}
          {visible.gallery !== false && accentPhotos.length >= 2 && (
            <View style={styles.photoPair}>
              <Image
                src={accentPhotos[0].url}
                style={styles.photoPairImage}
              />
              <View style={styles.photoPairSpacer} />
              <Image
                src={accentPhotos[1].url}
                style={styles.photoPairImage}
              />
            </View>
          )}
          {visible.gallery !== false &&
            accentPhotos.length === 1 && (
              <View style={styles.photoPair}>
                <Image
                  src={accentPhotos[0].url}
                  style={[styles.photoPairImage, { width: '100%' }]}
                />
              </View>
            )}

          {/* Guide Price banner — pushed to bottom */}
          {content.cover.price && (
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
        {/* Accent colour band */}
        <View style={[styles.accentBand, { backgroundColor: accentColor }]} />

        <View style={styles.backCoverBody}>
          {/* Large feature photo */}
          {backCoverPhoto && (
            <Image
              src={backCoverPhoto}
              style={hasFloorPlans ? styles.backCoverPhoto : styles.backCoverPhotoLarge}
            />
          )}

          {/* Floor Plans */}
          {hasFloorPlans &&
            content.floorPlans.map((plan) => (
              <View key={plan.id}>
                <Image src={plan.imageUrl} style={styles.floorPlanImage} />
                {plan.label && (
                  <Text style={styles.floorPlanLabel}>{plan.label}</Text>
                )}
                <Text style={styles.floorPlanNote}>
                  For illustration purposes only. Not to scale.
                </Text>
              </View>
            ))}

          {/* Price echo on back cover */}
          {content.cover.price && (
            <View style={styles.backPriceBanner}>
              <Text style={[styles.backPriceText, { color: accentColor }]}>
                Guide Price: {content.cover.price}
              </Text>
            </View>
          )}
        </View>

        {/* Legal footer */}
        {visible.legal !== false && (
          <BrochureFooter
            branding={branding}
            legal={content.legal}
            showContact
          />
        )}
      </Page>
    </Document>
  );
}
