import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, X, GripVertical, ChevronDown, ChevronRight } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { BrochureRoom } from '@/lib/brochure/types';

interface BrochureRoomsEditorProps {
  rooms: BrochureRoom[];
  onChange: (rooms: BrochureRoom[]) => void;
  photos: string[];
}

function SortableRoom({
  room,
  onUpdate,
  onRemove,
  photos,
}: {
  room: BrochureRoom;
  onUpdate: (room: BrochureRoom) => void;
  onRemove: () => void;
  photos: string[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: room.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="border rounded-md bg-background">
      <div className="flex items-center gap-1 p-2">
        <button {...attributes} {...listeners} className="cursor-grab p-0.5 text-muted-foreground hover:text-foreground">
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
        >
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <span className="text-sm font-medium truncate">{room.name || 'Untitled Room'}</span>
          {room.dimensions && (
            <span className="text-xs text-muted-foreground truncate">{room.dimensions}</span>
          )}
        </button>
        <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-destructive" onClick={onRemove}>
          <X className="h-3 w-3" />
        </Button>
      </div>
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t pt-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Room Name</Label>
              <Input
                value={room.name}
                onChange={(e) => onUpdate({ ...room, name: e.target.value })}
                className="h-7 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Floor</Label>
              <Input
                value={room.floor}
                onChange={(e) => onUpdate({ ...room, floor: e.target.value })}
                placeholder="Ground Floor"
                className="h-7 text-sm"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Dimensions</Label>
            <Input
              value={room.dimensions || ''}
              onChange={(e) => onUpdate({ ...room, dimensions: e.target.value })}
              placeholder="15'5 x 9'4 (4.7m x 2.9m)"
              className="h-7 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Input
              value={room.description || ''}
              onChange={(e) => onUpdate({ ...room, description: e.target.value })}
              placeholder="Brief room description..."
              className="h-7 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Room Photo</Label>
            <div className="flex gap-1.5 flex-wrap mt-1">
              <button
                type="button"
                onClick={() => onUpdate({ ...room, photoUrl: undefined })}
                className={`w-12 h-9 rounded border-2 flex items-center justify-center text-xs text-muted-foreground ${
                  !room.photoUrl ? 'border-primary bg-muted' : 'border-muted'
                }`}
              >
                None
              </button>
              {photos.slice(0, 10).map((photo, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onUpdate({ ...room, photoUrl: photo })}
                  className={`w-12 h-9 rounded border-2 overflow-hidden ${
                    room.photoUrl === photo ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  <img src={photo} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function BrochureRoomsEditor({ rooms, onChange, photos }: BrochureRoomsEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rooms.findIndex((r) => r.id === active.id);
    const newIndex = rooms.findIndex((r) => r.id === over.id);
    onChange(arrayMove(rooms, oldIndex, newIndex));
  };

  const addRoom = () => {
    onChange([
      ...rooms,
      {
        id: `room-${Date.now()}`,
        name: '',
        floor: 'Ground Floor',
        dimensions: '',
        description: '',
      },
    ]);
  };

  const updateRoom = (index: number, room: BrochureRoom) => {
    const updated = [...rooms];
    updated[index] = room;
    onChange(updated);
  };

  const removeRoom = (index: number) => {
    onChange(rooms.filter((_, i) => i !== index));
  };

  return (
    <div className="p-3 space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rooms.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          {rooms.map((room, index) => (
            <SortableRoom
              key={room.id}
              room={room}
              onUpdate={(r) => updateRoom(index, r)}
              onRemove={() => removeRoom(index)}
              photos={photos}
            />
          ))}
        </SortableContext>
      </DndContext>
      <Button type="button" variant="outline" size="sm" className="w-full" onClick={addRoom}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Add Room
      </Button>
    </div>
  );
}
