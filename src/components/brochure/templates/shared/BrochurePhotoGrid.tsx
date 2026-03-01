import { View, Image, Text } from '@react-pdf/renderer';
import type { BrochureGalleryItem } from '@/lib/brochure/types';
import { TYPE, COLORS } from '@/lib/brochure/designTokens';

interface BrochurePhotoGridProps {
  photos: BrochureGalleryItem[];
  columns?: 2 | 3;
  compact?: boolean;
  maxPhotos?: number;
  imageRadius?: number;
  imageBorder?: Record<string, unknown>;
}

export function BrochurePhotoGrid({
  photos,
  columns = 2,
  compact = false,
  maxPhotos,
  imageRadius = 3,
  imageBorder = {},
}: BrochurePhotoGridProps) {
  const displayPhotos = maxPhotos ? photos.slice(0, maxPhotos) : photos;
  const photoWidth = columns === 3 ? '31%' : '48%';
  const marginRight = columns === 3 ? '2.3%' : '2%';

  if (compact) {
    const compactHeight = columns === 3 ? 65 : 80;
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {displayPhotos.map((photo) => (
          <View key={photo.id} style={{ width: photoWidth, marginBottom: 4, marginRight }}>
            <Image
              src={photo.url}
              style={{
                width: '100%',
                height: compactHeight,
                objectFit: 'cover',
                borderRadius: imageRadius,
                ...imageBorder,
              }}
            />
            {photo.caption && (
              <Text style={{ ...TYPE.caption, color: COLORS.textMuted, textAlign: 'center', marginTop: 2 }}>
                {photo.caption}
              </Text>
            )}
          </View>
        ))}
      </View>
    );
  }

  const photoHeight = columns === 3 ? 100 : 120;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {displayPhotos.map((photo) => (
        <View key={photo.id} style={{ width: photoWidth, marginBottom: 8, marginRight }}>
          <Image
            src={photo.url}
            style={{
              width: '100%',
              height: photoHeight,
              objectFit: 'cover',
              borderRadius: imageRadius,
              ...imageBorder,
            }}
          />
          {photo.caption && (
            <Text style={{ ...TYPE.caption, color: COLORS.textMuted, textAlign: 'center', marginTop: 2 }}>
              {photo.caption}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}
