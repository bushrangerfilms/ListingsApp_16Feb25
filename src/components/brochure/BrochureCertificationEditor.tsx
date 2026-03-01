import { useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { BrochureBranding, CertificationLogo, BrochureStyleOptions } from '@/lib/brochure/types';
import { DEFAULT_STYLE_OPTIONS } from '@/lib/brochure/types';
import { getLogosForLocale } from '@/lib/brochure/certificationLogos';

interface BrochureCertificationEditorProps {
  branding: BrochureBranding;
  onChange: (branding: BrochureBranding) => void;
}

export function BrochureCertificationEditor({ branding, onChange }: BrochureCertificationEditorProps) {
  const opts = branding.styleOptions || DEFAULT_STYLE_OPTIONS;
  const selectedLogos = opts.certificationLogos || [];
  const builtInLogos = getLogosForLocale(branding.locale || 'en-IE');

  const toggleLogo = useCallback((builtIn: typeof builtInLogos[number]) => {
    const existing = selectedLogos.find(l => l.id === builtIn.id);
    let updated: CertificationLogo[];

    if (existing) {
      // Toggle enabled state
      updated = selectedLogos.map(l =>
        l.id === builtIn.id ? { ...l, enabled: !l.enabled } : l
      );
    } else {
      // Add new logo
      updated = [
        ...selectedLogos,
        { id: builtIn.id, name: builtIn.name, url: builtIn.url, enabled: true },
      ];
    }

    onChange({
      ...branding,
      styleOptions: { ...opts, certificationLogos: updated },
    });
  }, [branding, onChange, opts, selectedLogos]);

  const isEnabled = (id: string) => {
    const logo = selectedLogos.find(l => l.id === id);
    return logo?.enabled ?? false;
  };

  const enabledCount = selectedLogos.filter(l => l.enabled).length;

  return (
    <div className="space-y-2 px-3 py-2">
      <p className="text-[10px] text-muted-foreground">
        Select industry certifications to display on the back cover.
        {enabledCount > 0 && ` (${enabledCount} selected)`}
      </p>

      {builtInLogos.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No built-in logos available for this locale ({branding.locale}).
        </p>
      )}

      <div className="space-y-1.5">
        {builtInLogos.map((logo) => (
          <div
            key={logo.id}
            className="flex items-center gap-2 py-1"
          >
            <Checkbox
              id={`cert-${logo.id}`}
              checked={isEnabled(logo.id)}
              onCheckedChange={() => toggleLogo(logo)}
            />
            <label htmlFor={`cert-${logo.id}`} className="flex-1 cursor-pointer">
              <span className="text-xs font-medium">{logo.name}</span>
              <span className="text-[10px] text-muted-foreground ml-1.5">{logo.description}</span>
            </label>
          </div>
        ))}
      </div>

      {/* Preview strip — dark background to match PDF rendering */}
      {enabledCount > 0 && (
        <div className="mt-3 pt-2 border-t">
          <Label className="text-[10px] text-muted-foreground mb-1 block">Preview (as shown on back cover)</Label>
          <div
            className="flex items-center justify-center gap-4 py-2 px-3 rounded"
            style={{ backgroundColor: branding.primaryColor || '#1a365d' }}
          >
            {selectedLogos.filter(l => l.enabled).map((logo) => (
              logo.url ? (
                <img
                  key={logo.id}
                  src={logo.url}
                  alt={logo.name}
                  className="h-5 max-w-[60px] object-contain"
                />
              ) : (
                <span
                  key={logo.id}
                  className="text-[9px] px-2 py-0.5 border border-white/40 rounded text-white/80"
                >
                  {logo.name}
                </span>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
