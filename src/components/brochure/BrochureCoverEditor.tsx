import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { BrochureCover } from '@/lib/brochure/types';
import { useLocale } from '@/hooks/useLocale';

interface BrochureCoverEditorProps {
  cover: BrochureCover;
  onChange: (cover: BrochureCover) => void;
  photos: string[];
}

const SALE_METHODS = [
  'For Sale by Private Treaty',
  'For Sale by Public Auction',
  'To Let',
  'To Rent',
  'Price on Application',
];

export function BrochureCoverEditor({ cover, onChange, photos }: BrochureCoverEditorProps) {
  const { formatCurrency } = useLocale();
  const update = (field: keyof BrochureCover, value: string) => {
    onChange({ ...cover, [field]: value });
  };

  return (
    <div className="space-y-3 p-3">
      <div>
        <Label className="text-xs">Headline</Label>
        <Input
          value={cover.headline}
          onChange={(e) => update('headline', e.target.value)}
          placeholder="e.g. 3 Bed Detached House"
          className="h-8 text-sm"
        />
      </div>
      <div>
        <Label className="text-xs">Address</Label>
        <Input
          value={cover.address}
          onChange={(e) => update('address', e.target.value)}
          placeholder="Full address with Eircode"
          className="h-8 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Price</Label>
          <Input
            value={cover.price}
            onChange={(e) => update('price', e.target.value)}
            placeholder={formatCurrency(275000, { showDecimals: false })}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Energy Rating</Label>
          <Input
            value={cover.energyRating || ''}
            onChange={(e) => update('energyRating', e.target.value)}
            placeholder="e.g. B3"
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Sale Method</Label>
        <Select value={cover.saleMethod} onValueChange={(v) => update('saleMethod', v)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SALE_METHODS.map((method) => (
              <SelectItem key={method} value={method}>{method}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Hero Photo (Front Cover)</Label>
        <p className="text-[10px] text-muted-foreground mb-1">{photos.length} photos available</p>
        <div className="flex gap-2 flex-wrap mt-1 max-h-40 overflow-y-auto">
          {photos.map((photo, i) => (
            <button
              key={i}
              type="button"
              onClick={() => update('heroPhotoUrl', photo)}
              className={`w-16 h-12 rounded border-2 overflow-hidden shrink-0 ${
                cover.heroPhotoUrl === photo ? 'border-primary' : 'border-transparent'
              }`}
            >
              <img src={photo} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs">Back Cover Photo (Page 4)</Label>
        <p className="text-[10px] text-muted-foreground mb-1">
          Large feature photo for the back page. Defaults to a gallery photo if not set.
        </p>
        <div className="flex gap-2 flex-wrap mt-1 max-h-40 overflow-y-auto">
          <button
            type="button"
            onClick={() => update('backCoverPhotoUrl', '')}
            className={`w-16 h-12 rounded border-2 flex items-center justify-center text-[10px] text-muted-foreground shrink-0 ${
              !cover.backCoverPhotoUrl ? 'border-primary bg-muted' : 'border-muted'
            }`}
          >
            Auto
          </button>
          {photos.map((photo, i) => (
            <button
              key={i}
              type="button"
              onClick={() => update('backCoverPhotoUrl', photo)}
              className={`w-16 h-12 rounded border-2 overflow-hidden shrink-0 ${
                cover.backCoverPhotoUrl === photo ? 'border-primary' : 'border-transparent'
              }`}
            >
              <img src={photo} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
