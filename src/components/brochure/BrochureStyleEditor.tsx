import { useRef, useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Pipette, Loader2, Save } from 'lucide-react';
import type { BrochureBranding, BrochureStyleOptions } from '@/lib/brochure/types';
import { DEFAULT_STYLE_OPTIONS } from '@/lib/brochure/types';
import { BROCHURE_TEMPLATES } from './templates/templateRegistry';

const HAS_EYEDROPPER = typeof window !== 'undefined' && 'EyeDropper' in window;

function ColorPickerRow({
  value,
  onChangeColor,
}: {
  value: string;
  onChangeColor: (color: string) => void;
}) {
  const nativeRef = useRef<HTMLInputElement>(null);
  const [hex, setHex] = useState(value);

  useEffect(() => { setHex(value); }, [value]);

  const pickEyeDropper = async () => {
    try {
      // @ts-expect-error EyeDropper API not in all TS libs
      const dropper = new window.EyeDropper();
      const result = await dropper.open();
      onChangeColor(result.sRGBHex);
    } catch {
      // user cancelled
    }
  };

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <button
        type="button"
        className="w-8 h-8 rounded border border-border shrink-0 cursor-pointer"
        style={{ backgroundColor: value }}
        onClick={() => nativeRef.current?.click()}
      />
      <input
        ref={nativeRef}
        type="color"
        value={value}
        onChange={(e) => onChangeColor(e.target.value)}
        className="sr-only"
      />
      <Input
        value={hex}
        onChange={(e) => {
          const v = e.target.value;
          setHex(v);
          if (/^#[0-9a-fA-F]{6}$/.test(v)) onChangeColor(v);
        }}
        onBlur={() => {
          let v = hex.trim();
          if (!v.startsWith('#')) v = '#' + v;
          if (/^#[0-9a-fA-F]{6}$/.test(v)) onChangeColor(v);
          else setHex(value);
        }}
        placeholder="#1a365d"
        className="h-8 text-xs font-mono w-[90px]"
        maxLength={7}
      />
      {HAS_EYEDROPPER && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0 shrink-0"
          onClick={pickEyeDropper}
          title="Pick color from screen"
        >
          <Pipette className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

interface BrochureStyleEditorProps {
  branding: BrochureBranding;
  onChange: (branding: BrochureBranding) => void;
  onSaveAsDefaults?: () => void;
  isSavingDefaults?: boolean;
}

const TEMPLATE_LIST = Object.values(BROCHURE_TEMPLATES);

export function BrochureStyleEditor({ branding, onChange, onSaveAsDefaults, isSavingDefaults = false }: BrochureStyleEditorProps) {
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

      {/* Colors */}
      <div className="pt-2 border-t border-border/50">
        <Label className="text-xs font-medium text-muted-foreground">Colors</Label>
        <p className="text-[10px] text-muted-foreground mb-2">
          Use the eyedropper to pick a colour from your logo.
        </p>
      </div>

      <div>
        <Label className="text-xs font-medium">Accent Color</Label>
        <p className="text-[10px] text-muted-foreground">Headlines, price text, certification banner</p>
        <ColorPickerRow
          value={branding.primaryColor || '#1a365d'}
          onChangeColor={(color) => onChange({ ...branding, primaryColor: color })}
        />
      </div>

      <div>
        <Label className="text-xs font-medium">Highlight Color</Label>
        <p className="text-[10px] text-muted-foreground">Accent strips, underlines, sale method text</p>
        <ColorPickerRow
          value={branding.secondaryColor || '#c53030'}
          onChangeColor={(color) => onChange({ ...branding, secondaryColor: color })}
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

      {/* Save as org defaults */}
      {onSaveAsDefaults && (
        <div className="pt-2 border-t border-border/50">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs"
            onClick={onSaveAsDefaults}
            disabled={isSavingDefaults}
          >
            {isSavingDefaults ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1" />
            )}
            Save as org defaults
          </Button>
          <p className="text-[10px] text-muted-foreground mt-1 text-center">
            Saves colors and style preferences for future brochures
          </p>
        </div>
      )}
    </div>
  );
}
