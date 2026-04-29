import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { BrochureLegal } from '@/lib/brochure/types';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getRegionConfig } from '@/lib/regionConfig';
import { DEFAULT_LOCALE } from '@/lib/locale/config';
import type { SupportedLocale } from '@/lib/i18n';

interface BrochureLegalEditorProps {
  legal: BrochureLegal;
  onChange: (legal: BrochureLegal) => void;
}

export function BrochureLegalEditor({ legal, onChange }: BrochureLegalEditorProps) {
  const { organization } = useOrganization();
  const regulatory = getRegionConfig((organization?.locale || DEFAULT_LOCALE) as SupportedLocale).legal.regulatory;

  return (
    <div className="space-y-3 p-3">
      <div>
        <Label className="text-xs">{regulatory.licenceFieldLabel}</Label>
        <Input
          value={legal.psrLicenceNumber || ''}
          onChange={(e) => onChange({ ...legal, psrLicenceNumber: e.target.value })}
          placeholder={regulatory.licencePlaceholder}
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
