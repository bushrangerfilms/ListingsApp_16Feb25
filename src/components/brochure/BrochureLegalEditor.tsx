import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { BrochureLegal } from '@/lib/brochure/types';

interface BrochureLegalEditorProps {
  legal: BrochureLegal;
  onChange: (legal: BrochureLegal) => void;
}

export function BrochureLegalEditor({ legal, onChange }: BrochureLegalEditorProps) {
  return (
    <div className="space-y-3 p-3">
      <div>
        <Label className="text-xs">PSR Licence Number</Label>
        <Input
          value={legal.psrLicenceNumber || ''}
          onChange={(e) => onChange({ ...legal, psrLicenceNumber: e.target.value })}
          placeholder="e.g. 003442"
          className="h-8 text-sm"
        />
      </div>
      <div>
        <Label className="text-xs">Legal Disclaimer</Label>
        <Textarea
          value={legal.disclaimer}
          onChange={(e) => onChange({ ...legal, disclaimer: e.target.value })}
          placeholder="Standard legal disclaimer..."
          className="min-h-[80px] text-sm"
        />
      </div>
    </div>
  );
}
