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
  photoLarge: {
    width: '100%',
    height: 160,
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
});

interface BrochurePhotoGridProps {
  photos: BrochureGalleryItem[];
  columns?: 2 | 3;
}

export function BrochurePhotoGrid({ photos, columns = 2 }: BrochurePhotoGridProps) {
  const photoWidth = columns === 3 ? '31%' : '48%';
  const photoHeight = columns === 3 ? 100 : 120;

  return (
    <View style={styles.grid}>
      {photos.map((photo) => (
        <View key={photo.id} style={[styles.photoContainer, { width: photoWidth }]}>
          <Image src={photo.url} style={[styles.photo, { height: photoHeight }]} />
          {photo.caption && (
            <Text style={styles.caption}>{photo.caption}</Text>
          )}
        </View>
      ))}
    </View>
  );
}
