import { View, Text, Image } from '@react-pdf/renderer';
import type { BrochureRoom } from '@/lib/brochure/types';
import { TYPE, COLORS, SPACING } from '@/lib/brochure/designTokens';

interface BrochureRoomBlockProps {
  room: BrochureRoom;
  compact?: boolean;
  accentColor?: string;
  imageRadius?: number;
  imageBorder?: Record<string, unknown>;
}

export function BrochureRoomBlock({
  room,
  compact = false,
  accentColor,
  imageRadius = 3,
  imageBorder = {},
}: BrochureRoomBlockProps) {
  if (compact) {
    if (room.photoUrl) {
      return (
        <View style={{ flexDirection: 'row', marginBottom: 5 }}>
          <Image
            src={room.photoUrl}
            style={{
              width: 80,
              height: 55,
              objectFit: 'cover',
              borderRadius: imageRadius,
              ...imageBorder,
              marginRight: 8,
            }}
          />
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ ...TYPE.roomName, color: COLORS.textPrimary, marginBottom: 1 }}>
              {room.name}
            </Text>
            {room.dimensions && (
              <Text style={{ ...TYPE.roomDimensions, color: COLORS.textSecondary, marginBottom: 1 }}>
                {room.dimensions}
              </Text>
            )}
            {room.description && (
              <Text style={{ ...TYPE.roomDescription, color: COLORS.textSecondary }}>
                {room.description}
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
            {room.name}
          </Text>
          {room.dimensions && (
            <Text style={{ ...TYPE.roomDimensions, color: COLORS.textSecondary }}>
              {room.dimensions}
            </Text>
          )}
        </View>
        {room.description && (
          <Text style={{ ...TYPE.roomDescription, color: COLORS.textSecondary, marginBottom: 3 }}>
            {room.description}
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
            width: 100,
            height: 75,
            objectFit: 'cover',
            borderRadius: imageRadius,
            ...imageBorder,
            marginRight: 10,
          }}
        />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={{ ...TYPE.roomName, fontSize: 10, color: COLORS.textPrimary, marginBottom: 2 }}>
            {room.name}
          </Text>
          {room.dimensions && (
            <Text style={{ ...TYPE.roomDimensions, fontSize: 9, color: COLORS.textSecondary, marginBottom: 2 }}>
              {room.dimensions}
            </Text>
          )}
          {room.description && (
            <Text style={{ ...TYPE.roomDescription, color: COLORS.textSecondary, lineHeight: 1.3 }}>
              {room.description}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', marginBottom: 4, justifyContent: 'space-between' }}>
        <Text style={{ ...TYPE.roomName, color: COLORS.textPrimary }}>{room.name}</Text>
        {room.dimensions && (
          <Text style={{ ...TYPE.roomDimensions, fontSize: 9, color: COLORS.textSecondary }}>
            {room.dimensions}
          </Text>
        )}
      </View>
      {room.description && (
        <Text style={{ ...TYPE.roomDescription, color: COLORS.textSecondary, marginBottom: 4 }}>
          {room.description}
        </Text>
      )}
    </View>
  );
}
