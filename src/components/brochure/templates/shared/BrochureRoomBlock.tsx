import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { BrochureRoom } from '@/lib/brochure/types';

const styles = StyleSheet.create({
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
});

interface BrochureRoomBlockProps {
  room: BrochureRoom;
}

export function BrochureRoomBlock({ room }: BrochureRoomBlockProps) {
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
