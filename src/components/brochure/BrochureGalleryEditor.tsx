import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Check, X } from 'lucide-react';
import type { BrochureGalleryItem } from '@/lib/brochure/types';

interface BrochureGalleryEditorProps {
  gallery: BrochureGalleryItem[];
  onChange: (gallery: BrochureGalleryItem[]) => void;
  availablePhotos: string[];
}

export function BrochureGalleryEditor({ gallery, onChange, availablePhotos }: BrochureGalleryEditorProps) {
  const selectedUrls = new Set(gallery.map((g) => g.url));

  const togglePhoto = (url: string) => {
    if (selectedUrls.has(url)) {
      onChange(gallery.filter((g) => g.url !== url));
    } else {
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

  return (
    <div className="p-3 space-y-3">
      <div>
        <Label className="text-xs mb-1 block">Select Photos for Gallery</Label>
        <div className="flex gap-1.5 flex-wrap">
          {availablePhotos.map((photo, i) => (
            <button
              key={i}
              type="button"
              onClick={() => togglePhoto(photo)}
              className={`relative w-16 h-12 rounded border-2 overflow-hidden ${
                selectedUrls.has(photo) ? 'border-primary' : 'border-muted'
              }`}
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
          <Label className="text-xs mb-1 block">Selected ({gallery.length})</Label>
          <p className="text-[10px] text-muted-foreground mb-1.5">
            AI-generated descriptions — not shown in the brochure.
          </p>
          <div className="space-y-1.5">
            {gallery.map((item, i) => (
              <div key={item.id} className="flex items-center gap-2">
                <img src={item.url} alt="" className="w-10 h-8 rounded object-cover shrink-0" />
                <span className="text-xs text-muted-foreground flex-1 leading-tight">
                  {item.caption || 'No description'}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-destructive shrink-0"
                  onClick={() => removePhoto(i)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
