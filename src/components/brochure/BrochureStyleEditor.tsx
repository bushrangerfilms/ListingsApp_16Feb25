import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { BrochureBranding, BrochureStyleOptions } from '@/lib/brochure/types';
import { DEFAULT_STYLE_OPTIONS } from '@/lib/brochure/types';
import { BROCHURE_TEMPLATES } from './templates/templateRegistry';

interface BrochureStyleEditorProps {
  branding: BrochureBranding;
  onChange: (branding: BrochureBranding) => void;
}

const TEMPLATE_LIST = Object.values(BROCHURE_TEMPLATES);

export function BrochureStyleEditor({ branding, onChange }: BrochureStyleEditorProps) {
  const opts = branding.styleOptions || DEFAULT_STYLE_OPTIONS;
  const currentTemplateId = opts.templateId || 'classic-1';

  const update = (patch: Partial<BrochureStyleOptions>) => {
    onChange({
      ...branding,
      styleOptions: { ...opts, ...patch },
    });
  };

  return (
    <div className="space-y-3 px-3 py-2">
      {/* Template Selection */}
      <div>
        <Label className="text-xs font-medium">Template</Label>
        <p className="text-[10px] text-muted-foreground mb-1.5">
          Choose a layout style for your brochure
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {TEMPLATE_LIST.map((tmpl) => (
            <button
              key={tmpl.id}
              className={`text-left px-2.5 py-2 rounded border text-xs transition-colors ${
                currentTemplateId === tmpl.id
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border bg-background hover:bg-muted/50'
              }`}
              onClick={() => update({ templateId: tmpl.id })}
            >
              <span className="font-medium block">{tmpl.name}</span>
              <span className="text-[10px] text-muted-foreground leading-tight block mt-0.5">
                {tmpl.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-border/50 pt-2" />

      {/* Page Format */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs font-medium">Page Format</Label>
          <p className="text-[10px] text-muted-foreground">
            {opts.pageFormat === 'a5' ? 'Booklet (folds from a single sheet)' : 'A4 full page (standard)'}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            className={`text-xs px-2.5 py-1 rounded ${opts.pageFormat !== 'a5' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            onClick={() => update({ pageFormat: 'a4' })}
          >
            A4
          </button>
          <button
            className={`text-xs px-2.5 py-1 rounded ${opts.pageFormat === 'a5' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            onClick={() => update({ pageFormat: 'a5' })}
          >
            Booklet
          </button>
        </div>
      </div>

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

      {/* Price Display */}
      <div className="pt-2 border-t border-border/50">
        <Label className="text-xs font-medium text-muted-foreground">Price Display</Label>
        <p className="text-[10px] text-muted-foreground mb-2">
          Price always shown on front cover. Optionally repeat on inner pages.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs font-medium">Inner Page Price</Label>
          <p className="text-[10px] text-muted-foreground">Price banner on accommodation page</p>
        </div>
        <Switch
          checked={opts.showInnerPrice ?? false}
          onCheckedChange={(checked) => update({ showInnerPrice: checked })}
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs font-medium">Back Cover Price</Label>
          <p className="text-[10px] text-muted-foreground">Price echo on back cover</p>
        </div>
        <Switch
          checked={opts.showBackCoverPrice ?? false}
          onCheckedChange={(checked) => update({ showBackCoverPrice: checked })}
        />
      </div>
    </div>
  );
}
