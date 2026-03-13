import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Check, X, GripVertical, ZoomIn } from 'lucide-react';
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
import type { BrochureGalleryItem } from '@/lib/brochure/types';

interface BrochureGalleryEditorProps {
  gallery: BrochureGalleryItem[];
  onChange: (gallery: BrochureGalleryItem[]) => void;
  availablePhotos: string[];
}

function SortableGalleryItem({
  item,
  index,
  onUpdateCaption,
  onRemove,
  onPreview,
}: {
  item: BrochureGalleryItem;
  index: number;
  onUpdateCaption: (caption: string) => void;
  onRemove: () => void;
  onPreview: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isAccentPhoto = index < 2;

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 py-1.5">
      <button {...attributes} {...listeners} className="cursor-grab p-0.5 text-muted-foreground hover:text-foreground shrink-0">
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <div className="relative group shrink-0">
        <img src={item.url} alt="" className="w-16 h-12 rounded object-cover" />
        <button
          type="button"
          onClick={onPreview}
          className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded"
        >
          <ZoomIn className="h-4 w-4 text-white" />
        </button>
      </div>
      <div className="flex-1 min-w-0">
        {isAccentPhoto ? (
          <Input
            value={item.caption}
            onChange={(e) => onUpdateCaption(e.target.value)}
            placeholder="Caption for accent photo..."
            className="h-7 text-xs"
          />
        ) : (
          <span className="text-[10px] text-muted-foreground italic">Back cover — no caption shown</span>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-1.5 text-destructive shrink-0"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function BrochureGalleryEditor({ gallery, onChange, availablePhotos }: BrochureGalleryEditorProps) {
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const selectedUrls = new Set(gallery.map((g) => g.url));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const togglePhoto = (url: string) => {
    if (selectedUrls.has(url)) {
      onChange(gallery.filter((g) => g.url !== url));
    } else {
      if (gallery.length >= 4) return;
      onChange([
        ...gallery,
        { id: `gallery-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, url, caption: '' },
      ]);
    }
  };

  const updateCaption = (index: number, caption: string) => {
    const updated = [...gallery];
    updated[index] = { ...updated[index], caption };
    onChange(updated);
  };

  const removePhoto = (index: number) => {
    onChange(gallery.filter((_, i) => i !== index));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = gallery.findIndex((g) => g.id === active.id);
    const newIndex = gallery.findIndex((g) => g.id === over.id);
    onChange(arrayMove(gallery, oldIndex, newIndex));
  };

  return (
    <div className="p-3 space-y-3">
      <div>
        <Label className="text-xs mb-1 block">Select Photos for Gallery (max 4)</Label>
        <div className="flex gap-1.5 flex-wrap">
          {availablePhotos.map((photo, i) => (
            <button
              key={i}
              type="button"
              onClick={() => togglePhoto(photo)}
              className={`relative w-16 h-12 rounded border-2 overflow-hidden ${
                selectedUrls.has(photo) ? 'border-primary' : gallery.length >= 4 ? 'border-muted opacity-50' : 'border-muted'
              }`}
              disabled={!selectedUrls.has(photo) && gallery.length >= 4}
            >
              <img src={photo} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              {selectedUrls.has(photo) && (
                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                  <Check className="h-4 w-4 text-primary" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
      {gallery.length > 0 && (
        <div>
          <Label className="text-xs mb-0.5 block">Selected ({gallery.length}/4)</Label>
          <p className="text-[10px] text-muted-foreground mb-1.5">
            First 2 photos appear as accent images with captions. Drag to reorder.
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={gallery.map((g) => g.id)} strategy={verticalListSortingStrategy}>
              {gallery.map((item, i) => (
                <SortableGalleryItem
                  key={item.id}
                  item={item}
                  index={i}
                  onUpdateCaption={(caption) => updateCaption(i, caption)}
                  onRemove={() => removePhoto(i)}
                  onPreview={() => setPreviewPhoto(item.url)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
      <Dialog open={!!previewPhoto} onOpenChange={() => setPreviewPhoto(null)}>
        <DialogContent className="max-w-2xl p-2">
          {previewPhoto && (
            <img src={previewPhoto} alt="Photo preview" className="w-full h-auto rounded" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
