import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import type { BrochureLocation } from '@/lib/brochure/types';

interface BrochureLocationEditorProps {
  location: BrochureLocation;
  onChange: (location: BrochureLocation) => void;
}

export function BrochureLocationEditor({ location, onChange }: BrochureLocationEditorProps) {
  return (
    <div className="space-y-3 p-3">
      <div>
        <Label className="text-xs">Location Description</Label>
        <Textarea
          value={location.text}
          onChange={(e) => onChange({ ...location, text: e.target.value })}
          placeholder="Describe the location and surroundings..."
          className="min-h-[80px] text-sm"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="text-xs">Notable Amenities</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => onChange({ ...location, amenities: [...location.amenities, ''] })}
          >
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>
        <div className="space-y-1">
          {location.amenities.map((amenity, i) => (
            <div key={i} className="flex gap-1">
              <Input
                value={amenity}
                onChange={(e) => {
                  const updated = [...location.amenities];
                  updated[i] = e.target.value;
                  onChange({ ...location, amenities: updated });
                }}
                placeholder="e.g. Train station - 5 min walk"
                className="h-7 text-sm flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-1.5 text-destructive"
                onClick={() => onChange({
                  ...location,
                  amenities: location.amenities.filter((_, idx) => idx !== i),
                })}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
