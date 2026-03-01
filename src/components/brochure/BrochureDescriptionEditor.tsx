import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import type { BrochureDescription } from '@/lib/brochure/types';

interface BrochureDescriptionEditorProps {
  description: BrochureDescription;
  onChange: (description: BrochureDescription) => void;
}

export function BrochureDescriptionEditor({ description, onChange }: BrochureDescriptionEditorProps) {
  const wordCount = description.marketingText.trim().split(/\s+/).filter(Boolean).length;
  const addFeature = () => {
    onChange({
      ...description,
      keyFeatures: [...description.keyFeatures, ''],
    });
  };

  const updateFeature = (index: number, value: string) => {
    const features = [...description.keyFeatures];
    features[index] = value;
    onChange({ ...description, keyFeatures: features });
  };

  const removeFeature = (index: number) => {
    onChange({
      ...description,
      keyFeatures: description.keyFeatures.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-3 p-3">
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Marketing Description</Label>
          <span className={`text-[10px] ${wordCount > 160 ? 'text-destructive' : 'text-muted-foreground'}`}>
            {wordCount} words {wordCount > 160 ? '(may overflow page)' : ''}
          </span>
        </div>
        <Textarea
          value={description.marketingText}
          onChange={(e) => onChange({ ...description, marketingText: e.target.value })}
          placeholder="Property marketing description..."
          className="min-h-[120px] text-sm"
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">
          ~120-150 words / 2 paragraphs recommended
        </p>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="text-xs">Key Features</Label>
          <Button type="button" variant="ghost" size="sm" className="h-6 px-2" onClick={addFeature}>
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>
        <div className="space-y-1.5">
          {description.keyFeatures.map((feature, i) => (
            <div key={i} className="flex gap-1">
              <Input
                value={feature}
                onChange={(e) => updateFeature(i, e.target.value)}
                placeholder="Key feature..."
                className="h-7 text-sm flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-1.5 text-destructive"
                onClick={() => removeFeature(i)}
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
