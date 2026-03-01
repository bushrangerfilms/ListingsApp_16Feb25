import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { BrochureRoom } from '@/lib/brochure/types';

const styles = StyleSheet.create({
  // ── Standard (non-compact) ──
  roomRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  roomPhoto: {
    width: 100,
    height: 75,
    objectFit: 'cover',
    borderRadius: 2,
    marginRight: 10,
  },
  roomDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  roomName: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  roomDimensions: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#333',
    marginBottom: 2,
  },
  roomDescription: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#555',
    lineHeight: 1.3,
  },
  roomRowNoPhoto: {
    flexDirection: 'row',
    marginBottom: 4,
    justifyContent: 'space-between',
  },
  roomNameInline: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  roomDimensionsInline: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#333',
  },
  roomDescriptionFull: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#555',
    marginBottom: 4,
    marginLeft: 0,
  },
  // ── Compact ──
  roomRowCompact: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  roomPhotoCompact: {
    width: 80,
    height: 55,
    objectFit: 'cover',
    borderRadius: 2,
    marginRight: 8,
  },
  roomNameCompact: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 1,
  },
  roomDimensionsCompact: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#333',
    marginBottom: 1,
  },
  roomDescriptionCompact: {
    fontSize: 7.5,
    fontFamily: 'Helvetica',
    color: '#555',
    lineHeight: 1.2,
  },
  roomRowNoPhotoCompact: {
    flexDirection: 'row',
    marginBottom: 3,
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  roomNameInlineCompact: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
  },
  roomDimensionsInlineCompact: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#333',
  },
  roomDescriptionFullCompact: {
    fontSize: 7.5,
    fontFamily: 'Helvetica',
    color: '#555',
    marginBottom: 3,
  },
});

interface BrochureRoomBlockProps {
  room: BrochureRoom;
  compact?: boolean;
  accentColor?: string;
}

export function BrochureRoomBlock({ room, compact = false, accentColor }: BrochureRoomBlockProps) {
  if (compact) {
    if (room.photoUrl) {
      return (
        <View style={styles.roomRowCompact}>
          <Image src={room.photoUrl} style={styles.roomPhotoCompact} />
          <View style={styles.roomDetails}>
            <Text style={styles.roomNameCompact}>{room.name}</Text>
            {room.dimensions && (
              <Text style={styles.roomDimensionsCompact}>{room.dimensions}</Text>
            )}
            {room.description && (
              <Text style={styles.roomDescriptionCompact}>{room.description}</Text>
            )}
          </View>
        </View>
      );
    }

    return (
      <View>
        <View style={styles.roomRowNoPhotoCompact}>
          <Text style={styles.roomNameInlineCompact}>{room.name}</Text>
          {room.dimensions && (
            <Text style={styles.roomDimensionsInlineCompact}>{room.dimensions}</Text>
          )}
        </View>
        {room.description && (
          <Text style={styles.roomDescriptionFullCompact}>{room.description}</Text>
        )}
      </View>
    );
  }

  // Standard (non-compact) layout
  if (room.photoUrl) {
    return (
      <View style={styles.roomRow}>
        <Image src={room.photoUrl} style={styles.roomPhoto} />
        <View style={styles.roomDetails}>
          <Text style={styles.roomName}>{room.name}</Text>
          {room.dimensions && (
            <Text style={styles.roomDimensions}>{room.dimensions}</Text>
          )}
          {room.description && (
            <Text style={styles.roomDescription}>{room.description}</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.roomRowNoPhoto}>
        <Text style={styles.roomNameInline}>{room.name}</Text>
        {room.dimensions && (
          <Text style={styles.roomDimensionsInline}>{room.dimensions}</Text>
        )}
      </View>
      {room.description && (
        <Text style={styles.roomDescriptionFull}>{room.description}</Text>
      )}
    </View>
  );
}
