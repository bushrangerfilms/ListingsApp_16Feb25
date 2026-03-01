import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import type { BrochureFeatures } from '@/lib/brochure/types';

interface BrochureFeaturesEditorProps {
  features: BrochureFeatures;
  onChange: (features: BrochureFeatures) => void;
}

function EditableList({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs">{label}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2"
          onClick={() => onChange([...items, ''])}
        >
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex gap-1">
            <Input
              value={item}
              onChange={(e) => {
                const updated = [...items];
                updated[i] = e.target.value;
                onChange(updated);
              }}
              placeholder={placeholder}
              className="h-7 text-sm flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-1.5 text-destructive"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BrochureFeaturesEditor({ features, onChange }: BrochureFeaturesEditorProps) {
  return (
    <div className="space-y-3 p-3">
      <EditableList
        label="Services"
        items={features.services}
        onChange={(services) => onChange({ ...features, services })}
        placeholder="e.g. Gas Central Heating"
      />
      <EditableList
        label="Features"
        items={features.external}
        onChange={(external) => onChange({ ...features, external })}
        placeholder="e.g. Private Rear Garden"
      />
      <EditableList
        label="Nearby"
        items={features.nearby}
        onChange={(nearby) => onChange({ ...features, nearby })}
        placeholder="e.g. Schools within 500m"
      />
    </div>
  );
}
