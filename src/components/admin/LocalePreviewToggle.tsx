import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Globe, X } from 'lucide-react';
import { SUPPORTED_LOCALES, SupportedLocale, DEFAULT_LOCALE } from '@/lib/i18n';
import { useLocalePreview } from '@/hooks/useLocalePreview';

const LOCALE_LABELS: Record<SupportedLocale, { name: string; flag: string }> = {
  'en-IE': { name: 'Ireland', flag: 'IE' },
  'en-GB': { name: 'United Kingdom', flag: 'GB' },
  'en-US': { name: 'United States', flag: 'US' },
};

export function LocalePreviewToggle() {
  const { previewLocale, setPreviewLocale, isPreviewActive, clearPreview } = useLocalePreview();
  const [isOpen, setIsOpen] = useState(false);

  const handleLocaleChange = (value: string) => {
    if (value === 'none') {
      clearPreview();
    } else {
      setPreviewLocale(value as SupportedLocale);
    }
    setIsOpen(false);
  };

  if (isPreviewActive) {
    return (
      <div className="flex items-center gap-2">
        <Badge 
          variant="outline"
          className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
          data-testid="badge-preview-mode"
        >
          <Globe className="h-3 w-3 mr-1" />
          Preview: {LOCALE_LABELS[previewLocale!]?.name || previewLocale}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={clearPreview}
          data-testid="button-exit-preview"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Select
      open={isOpen}
      onOpenChange={setIsOpen}
      value=""
      onValueChange={handleLocaleChange}
    >
      <SelectTrigger 
        className="w-auto gap-2 border-dashed"
        data-testid="select-locale-preview"
      >
        <Globe className="h-4 w-4 text-muted-foreground" />
        <SelectValue placeholder="Preview Locale" />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LOCALES.filter(loc => loc !== DEFAULT_LOCALE).map((locale) => (
          <SelectItem 
            key={locale} 
            value={locale}
            data-testid={`option-preview-${locale}`}
          >
            {LOCALE_LABELS[locale]?.name || locale}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
