import { View, Image, Text, StyleSheet } from '@react-pdf/renderer';
import type { BrochureGalleryItem } from '@/lib/brochure/types';

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  photoContainer: {
    width: '48%',
    marginBottom: 8,
    marginRight: '2%',
  },
  photo: {
    width: '100%',
    height: 120,
    objectFit: 'cover',
    borderRadius: 2,
  },
  caption: {
    fontSize: 7,
    fontFamily: 'Helvetica-Oblique',
    color: '#666',
    textAlign: 'center',
    marginTop: 2,
  },
  // ── Compact ──
  photoContainerCompact: {
    width: '48%',
    marginBottom: 4,
    marginRight: '2%',
  },
  photoCompact: {
    width: '100%',
    height: 80,
    objectFit: 'cover',
    borderRadius: 2,
  },
});

interface BrochurePhotoGridProps {
  photos: BrochureGalleryItem[];
  columns?: 2 | 3;
  compact?: boolean;
  maxPhotos?: number;
}

export function BrochurePhotoGrid({ photos, columns = 2, compact = false, maxPhotos }: BrochurePhotoGridProps) {
  const displayPhotos = maxPhotos ? photos.slice(0, maxPhotos) : photos;
  const photoWidth = columns === 3 ? '31%' : '48%';
  const marginRight = columns === 3 ? '2.3%' : '2%';

  if (compact) {
    const compactHeight = columns === 3 ? 65 : 80;
    return (
      <View style={styles.grid}>
        {displayPhotos.map((photo) => (
          <View key={photo.id} style={[styles.photoContainerCompact, { width: photoWidth, marginRight }]}>
            <Image src={photo.url} style={[styles.photoCompact, { height: compactHeight }]} />
          </View>
        ))}
      </View>
    );
  }

  const photoHeight = columns === 3 ? 100 : 120;
  return (
    <View style={styles.grid}>
      {displayPhotos.map((photo) => (
        <View key={photo.id} style={[styles.photoContainer, { width: photoWidth, marginRight }]}>
          <Image src={photo.url} style={[styles.photo, { height: photoHeight }]} />
          {photo.caption && (
            <Text style={styles.caption}>{photo.caption}</Text>
          )}
        </View>
      ))}
    </View>
  );
}
