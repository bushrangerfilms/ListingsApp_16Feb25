import { View, Text, Image } from '@react-pdf/renderer';
import type { BrochureRoom } from '@/lib/brochure/types';
import type { LayoutDimensions } from '@/lib/brochure/designTokens';
import { TYPE, COLORS, SPACING, normalizeText } from '@/lib/brochure/designTokens';

interface BrochureRoomBlockProps {
  room: BrochureRoom;
  compact?: boolean;
  accentColor?: string;
  imageRadius?: number;
  imageBorder?: Record<string, unknown>;
  dims?: LayoutDimensions;
}

export function BrochureRoomBlock({
  room,
  compact = false,
  accentColor,
  imageRadius = 3,
  imageBorder = {},
  dims,
}: BrochureRoomBlockProps) {
  const compactW = dims?.roomPhotoCompact.width ?? 80;
  const compactH = dims?.roomPhotoCompact.height ?? 55;
  const stdW = dims?.roomPhotoStandard.width ?? 100;
  const stdH = dims?.roomPhotoStandard.height ?? 75;

  if (compact) {
    if (room.photoUrl) {
      return (
        <View style={{ flexDirection: 'row', marginBottom: 5 }}>
          <Image
            src={room.photoUrl}
            style={{
              width: compactW,
              height: compactH,
              objectFit: 'cover',
              borderRadius: imageRadius,
              ...imageBorder,
              marginRight: 8,
            }}
          />
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ ...TYPE.roomName, color: COLORS.textPrimary, marginBottom: 1 }}>
              {normalizeText(room.name)}
            </Text>
            {room.dimensions && (
              <Text style={{ ...TYPE.roomDimensions, color: COLORS.textSecondary, marginBottom: 1 }}>
                {normalizeText(room.dimensions)}
              </Text>
            )}
            {room.description && (
              <Text style={{ ...TYPE.roomDescription, color: COLORS.textSecondary }}>
                {normalizeText(room.description)}
              </Text>
            )}
          </View>
        </View>
      );
    }

    return (
      <View>
        <View style={{ flexDirection: 'row', marginBottom: 3, justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={{ ...TYPE.roomName, fontSize: 8.5, color: COLORS.textPrimary }}>
            {normalizeText(room.name)}
          </Text>
          {room.dimensions && (
            <Text style={{ ...TYPE.roomDimensions, color: COLORS.textSecondary }}>
              {normalizeText(room.dimensions)}
            </Text>
          )}
        </View>
        {room.description && (
          <Text style={{ ...TYPE.roomDescription, color: COLORS.textSecondary, marginBottom: 3 }}>
            {normalizeText(room.description)}
          </Text>
        )}
      </View>
    );
  }

  // Standard (non-compact) layout
  if (room.photoUrl) {
    return (
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        <Image
          src={room.photoUrl}
          style={{
            width: stdW,
            height: stdH,
            objectFit: 'cover',
            borderRadius: imageRadius,
            ...imageBorder,
            marginRight: 10,
          }}
        />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={{ ...TYPE.roomName, fontSize: 10, color: COLORS.textPrimary, marginBottom: 2 }}>
            {normalizeText(room.name)}
          </Text>
          {room.dimensions && (
            <Text style={{ ...TYPE.roomDimensions, fontSize: 9, color: COLORS.textSecondary, marginBottom: 2 }}>
              {normalizeText(room.dimensions)}
            </Text>
          )}
          {room.description && (
            <Text style={{ ...TYPE.roomDescription, color: COLORS.textSecondary, lineHeight: 1.3 }}>
              {normalizeText(room.description)}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', marginBottom: 4, justifyContent: 'space-between' }}>
        <Text style={{ ...TYPE.roomName, color: COLORS.textPrimary }}>{normalizeText(room.name)}</Text>
        {room.dimensions && (
          <Text style={{ ...TYPE.roomDimensions, fontSize: 9, color: COLORS.textSecondary }}>
            {normalizeText(room.dimensions)}
          </Text>
        )}
      </View>
      {room.description && (
        <Text style={{ ...TYPE.roomDescription, color: COLORS.textSecondary, marginBottom: 4 }}>
          {normalizeText(room.description)}
        </Text>
      )}
    </View>
  );
}
