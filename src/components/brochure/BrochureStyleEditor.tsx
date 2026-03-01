import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { BrochureBranding, BrochureStyleOptions } from '@/lib/brochure/types';
import { DEFAULT_STYLE_OPTIONS } from '@/lib/brochure/types';

interface BrochureStyleEditorProps {
  branding: BrochureBranding;
  onChange: (branding: BrochureBranding) => void;
}

export function BrochureStyleEditor({ branding, onChange }: BrochureStyleEditorProps) {
  const opts = branding.styleOptions || DEFAULT_STYLE_OPTIONS;

  const update = (patch: Partial<BrochureStyleOptions>) => {
    onChange({
      ...branding,
      styleOptions: { ...opts, ...patch },
    });
  };

  return (
    <div className="space-y-3 px-3 py-2">
      {/* Frame Style */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs font-medium">Frame Style</Label>
          <p className="text-[10px] text-muted-foreground">
            {opts.frameStyle === 'classic' ? 'Accent strip + rules' : 'Thin rules only'}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            className={`text-xs px-2.5 py-1 rounded ${opts.frameStyle === 'classic' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            onClick={() => update({ frameStyle: 'classic' })}
          >
            Classic
          </button>
          <button
            className={`text-xs px-2.5 py-1 rounded ${opts.frameStyle === 'minimal' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            onClick={() => update({ frameStyle: 'minimal' })}
          >
            Minimal
          </button>
        </div>
      </div>

      {/* Image Corners */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs font-medium">Image Corners</Label>
          <p className="text-[10px] text-muted-foreground">
            {opts.imageCornerRadius === 'rounded' ? 'Subtle rounded corners' : 'Sharp square corners'}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            className={`text-xs px-2.5 py-1 rounded ${opts.imageCornerRadius === 'rounded' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            onClick={() => update({ imageCornerRadius: 'rounded' })}
          >
            Rounded
          </button>
          <button
            className={`text-xs px-2.5 py-1 rounded ${opts.imageCornerRadius === 'square' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            onClick={() => update({ imageCornerRadius: 'square' })}
          >
            Square
          </button>
        </div>
      </div>

      {/* Image Border */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs font-medium">Image Border</Label>
          <p className="text-[10px] text-muted-foreground">Subtle border around photos</p>
        </div>
        <Switch
          checked={opts.imageBorder}
          onCheckedChange={(checked) => update({ imageBorder: checked })}
        />
      </div>
    </div>
  );
}
