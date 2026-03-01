import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { BrochureContent, BrochureBranding } from '@/lib/brochure/types';
import { BrochureHeader } from './shared/BrochureHeader';
import { BrochureFooter } from './shared/BrochureFooter';
import { BrochureRoomBlock } from './shared/BrochureRoomBlock';
import { BrochurePhotoGrid } from './shared/BrochurePhotoGrid';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#222',
    backgroundColor: '#fff',
  },
  // ── Cover Page ──
  coverContent: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 15,
    justifyContent: 'space-between',
  },
  heroImage: {
    width: '100%',
    height: 350,
    objectFit: 'cover',
    borderRadius: 3,
  },
  coverTextBlock: {
    alignItems: 'center',
    paddingVertical: 15,
  },
  coverAddress: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 1.2,
  },
  coverSaleMethod: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginTop: 8,
  },
  coverBottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 20,
  },
  coverPrice: {
    fontSize: 26,
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
    borderColor: '#4a7c59',
    color: '#4a7c59',
    marginLeft: 20,
  },
  // ── Content Pages ──
  contentBody: {
    paddingHorizontal: 30,
    paddingTop: 12,
    paddingBottom: 50,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionTitleAccent: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textDecoration: 'underline',
  },
  descriptionText: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    lineHeight: 1.6,
    color: '#333',
    marginBottom: 8,
    textAlign: 'justify',
  },
  floorHeading: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    marginTop: 10,
    textDecoration: 'underline',
    color: '#c53030',
  },
  // ── Features ──
  featureColumns: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  featureColumn: {
    flex: 1,
    marginRight: 15,
  },
  featureTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  bulletItem: {
    fontSize: 8.5,
    fontFamily: 'Helvetica',
    color: '#444',
    marginBottom: 2.5,
    paddingLeft: 8,
  },
  keyFeatureItem: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#333',
    marginBottom: 3,
    paddingLeft: 10,
  },
  // ── Location ──
  locationText: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    lineHeight: 1.5,
    color: '#333',
    marginBottom: 8,
    textAlign: 'justify',
  },
  // ── Floor Plans ──
  floorPlanImage: {
    width: '100%',
    maxHeight: 280,
    objectFit: 'contain',
    marginBottom: 4,
  },
  floorPlanLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  floorPlanNote: {
    fontSize: 7,
    fontFamily: 'Helvetica-Oblique',
    color: '#888',
    textAlign: 'center',
    marginBottom: 8,
  },
  separator: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
    marginVertical: 10,
  },
  // ── Room grid (2 columns for rooms with photos) ──
  roomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  roomGridItem: {
    width: '48%',
    marginBottom: 8,
    marginRight: '2%',
  },
  // ── Price banner (last page) ──
  priceBanner: {
    marginTop: 'auto',
    marginBottom: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  priceBannerText: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
});

interface ClassicBrochureTemplateProps {
  content: BrochureContent;
  branding: BrochureBranding;
}

export function ClassicBrochureTemplate({ content, branding }: ClassicBrochureTemplateProps) {
  const visible = content.visibleSections || {};
  const accentColor = branding.secondaryColor || '#c53030';
  const primaryColor = branding.primaryColor || '#1a365d';
  const pageSize = ['en-US', 'en-CA'].includes(branding.locale) ? 'LETTER' as const : 'A4' as const;

  // Group rooms by floor
  const roomsByFloor: Record<string, typeof content.rooms> = {};
  for (const room of content.rooms) {
    const floor = room.floor || 'Other';
    if (!roomsByFloor[floor]) roomsByFloor[floor] = [];
    roomsByFloor[floor].push(room);
  }

  // Split description into paragraphs
  const descParagraphs = content.description.marketingText.split('\n').filter(p => p.trim());

  return (
    <Document title={content.cover.headline} author={branding.businessName}>
      {/* ═══ PAGE 1: COVER ═══ */}
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

          {/* Price + BER */}
          <View style={styles.coverBottomRow}>
            {content.cover.price && (
              <Text style={[styles.coverPrice, { color: accentColor }]}>
                Guide Price: {content.cover.price}
              </Text>
            )}
            {content.cover.energyRating && (
              <Text style={styles.berBadge}>
                {getBerLabel(branding.locale)} {content.cover.energyRating}
              </Text>
            )}
          </View>
        </View>
      </Page>

      {/* ═══ PAGE 2+: DESCRIPTION + ROOMS (auto-wrapping) ═══ */}
      <Page size={pageSize} style={styles.page} wrap>
        <BrochureHeader branding={branding} compact />
        <View style={styles.contentBody}>
          {/* Full Description */}
          {visible.description !== false && (
            <View>
              {descParagraphs.map((paragraph, i) => (
                <Text key={i} style={styles.descriptionText}>{paragraph}</Text>
              ))}

              {/* Key Features */}
              {content.description.keyFeatures.length > 0 && (
                <View style={{ marginTop: 6, marginBottom: 8 }}>
                  <Text style={styles.featureTitle}>Key Features</Text>
                  {content.description.keyFeatures.map((feature, i) => (
                    <Text key={i} style={styles.keyFeatureItem}>• {feature}</Text>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.separator} />

          {/* Accommodation (rooms by floor) */}
          {visible.rooms !== false && content.rooms.length > 0 && (
            <View>
              <Text style={styles.sectionTitleAccent}>Accommodation Comprises Of The Following</Text>
              {Object.entries(roomsByFloor).map(([floor, rooms]) => (
                <View key={floor} wrap={false}>
                  <Text style={[styles.floorHeading, { color: accentColor }]}>{floor}</Text>
                  {rooms.map((room) => (
                    <BrochureRoomBlock key={room.id} room={room} />
                  ))}
                </View>
              ))}
            </View>
          )}

          <View style={styles.separator} />

          {/* Features */}
          {visible.features !== false && (
            <View wrap={false}>
              <View style={styles.featureColumns}>
                {content.features.services.length > 0 && (
                  <View style={styles.featureColumn}>
                    <Text style={styles.featureTitle}>Services</Text>
                    {content.features.services.map((service, i) => (
                      <Text key={i} style={styles.bulletItem}>• {service}</Text>
                    ))}
                  </View>
                )}
                {content.features.external.length > 0 && (
                  <View style={styles.featureColumn}>
                    <Text style={styles.featureTitle}>Features</Text>
                    {content.features.external.map((feature, i) => (
                      <Text key={i} style={styles.bulletItem}>• {feature}</Text>
                    ))}
                  </View>
                )}
              </View>
              {content.features.nearby.length > 0 && (
                <View style={{ marginBottom: 10 }}>
                  <Text style={styles.featureTitle}>Nearby</Text>
                  {content.features.nearby.map((item, i) => (
                    <Text key={i} style={styles.bulletItem}>• {item}</Text>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.separator} />

          {/* Location */}
          {visible.location !== false && (
            <View wrap={false}>
              <Text style={styles.sectionTitle}>Location</Text>
              <Text style={styles.locationText}>{content.location.text}</Text>
              {content.location.amenities.length > 0 && (
                <View>
                  {content.location.amenities.map((amenity, i) => (
                    <Text key={i} style={styles.bulletItem}>• {amenity}</Text>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </Page>

      {/* ═══ GALLERY + FLOOR PLANS + PRICE + LEGAL ═══ */}
      {(
        (visible.gallery !== false && content.gallery.length > 0) ||
        (visible.floorPlans !== false && content.floorPlans.length > 0) ||
        content.cover.price
      ) && (
        <Page size={pageSize} style={styles.page}>
          <BrochureHeader branding={branding} compact />
          <View style={styles.contentBody}>
            {/* Gallery */}
            {visible.gallery !== false && content.gallery.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <BrochurePhotoGrid photos={content.gallery} columns={2} />
              </View>
            )}

            {/* Floor Plans */}
            {visible.floorPlans !== false && content.floorPlans.length > 0 && (
              <View>
                {content.floorPlans.map((plan) => (
                  <View key={plan.id} wrap={false}>
                    <Image src={plan.imageUrl} style={styles.floorPlanImage} />
                    <Text style={styles.floorPlanLabel}>{plan.label}</Text>
                    <Text style={styles.floorPlanNote}>For illustration purposes only. Not to scale.</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Guide Price (prominent) */}
            {content.cover.price && (
              <View style={styles.priceBanner}>
                <Text style={[styles.priceBannerText, { color: accentColor }]}>
                  Guide Price: {content.cover.price}
                </Text>
              </View>
            )}
          </View>

          {/* Legal footer */}
          {visible.legal !== false && (
            <BrochureFooter branding={branding} legal={content.legal} showContact />
          )}
        </Page>
      )}
    </Document>
  );
}

function getBerLabel(locale: string): string {
  switch (locale) {
    case 'en-GB': return 'EPC';
    case 'en-US': return 'HERS';
    case 'en-AU': return 'NatHERS';
    case 'en-CA': return 'EnerGuide';
    default: return 'BER';
  }
}
