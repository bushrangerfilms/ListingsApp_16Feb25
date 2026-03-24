import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Upload, X, Loader2, Save, RotateCcw } from 'lucide-react';
import type { BrochureBranding } from '@/lib/brochure/types';
import { uploadOrganizationLogo } from '@/lib/organizationHelpers';

interface BrochureHeaderEditorProps {
  branding: BrochureBranding;
  onChange: (branding: BrochureBranding) => void;
  onSaveAsDefaults: () => void;
  isSavingDefaults?: boolean;
  orgId: string;
  orgLogoUrl?: string | null;
}

export function BrochureHeaderEditor({
  branding,
  onChange,
  onSaveAsDefaults,
  isSavingDefaults = false,
  orgId,
  orgLogoUrl,
}: BrochureHeaderEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const update = (field: keyof BrochureBranding, value: string | null) => {
    onChange({ ...branding, [field]: value });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await uploadOrganizationLogo(file, orgId);
      update('logoUrl', url);
    } catch {
      // Upload failed — silently ignore, user can retry
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3 p-3">
      <p className="text-[11px] text-muted-foreground">
        Changes here only apply to this brochure and won't affect your account settings.
      </p>
      <div>
        <Label className="text-xs">Business Name</Label>
        <Input
          value={branding.businessName}
          onChange={(e) => update('businessName', e.target.value)}
          placeholder="e.g. Bridge Auctioneers"
          className="h-8 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Phone</Label>
          <Input
            value={branding.contactPhone}
            onChange={(e) => update('contactPhone', e.target.value)}
            placeholder="087 466 8664"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Email</Label>
          <Input
            value={branding.contactEmail}
            onChange={(e) => update('contactEmail', e.target.value)}
            placeholder="info@example.ie"
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">Address</Label>
        <Textarea
          value={branding.businessAddress}
          onChange={(e) => update('businessAddress', e.target.value)}
          placeholder="Castlebridge, Wexford"
          className="text-sm min-h-[56px] resize-y"
          rows={2}
        />
      </div>

      <div>
        <Label className="text-xs">{branding.licenceDisplayLabel || 'Licence Number'}</Label>
        <Input
          value={branding.psrLicenceNumber || ''}
          onChange={(e) => update('psrLicenceNumber', e.target.value || null)}
          placeholder={branding.licenceDisplayLabel === 'PSRA Licence' ? '004763' : ''}
          className="h-8 text-sm"
        />
      </div>

      {/* Logo */}
      <div>
        <Label className="text-xs">Logo</Label>
        <p className="text-[10px] text-muted-foreground mt-0.5">Only applies to this brochure — won't change your organisation logo.</p>
        <div className="flex items-center gap-2 mt-1">
          {branding.logoUrl ? (
            <div className="relative w-24 h-12 bg-muted rounded border overflow-hidden flex items-center justify-center">
              <img
                src={branding.logoUrl}
                alt="Logo"
                className="max-w-full max-h-full object-contain"
              />
              <button
                type="button"
                onClick={() => update('logoUrl', null)}
                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ) : (
            <div className="w-24 h-12 bg-muted rounded border border-dashed flex items-center justify-center text-[10px] text-muted-foreground">
              No logo
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5 mr-1" />
            )}
            {branding.logoUrl ? 'Change' : 'Upload'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoUpload}
          />
        </div>
        {orgLogoUrl && branding.logoUrl !== orgLogoUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground mt-1"
            onClick={() => update('logoUrl', orgLogoUrl)}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Revert to org logo
          </Button>
        )}
      </div>

      {/* Save as org defaults */}
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
          Updates your organisation profile for future brochures
        </p>
      </div>
    </div>
  );
}
