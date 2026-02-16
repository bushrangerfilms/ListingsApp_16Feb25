import { useState, ReactNode, useMemo, useEffect } from 'react';
import { SupportedLocale, SUPPORTED_LOCALES } from '@/lib/i18n';
import { LocaleProvider } from '@/lib/i18n/LocaleProvider';
import { LocalePreviewContext, LocalePreviewContextValue } from '@/hooks/useLocalePreview';

const PREVIEW_STORAGE_KEY = 'autolisting_locale_preview';

interface LocalePreviewProviderProps {
  children: ReactNode;
}

export function LocalePreviewProvider({ children }: LocalePreviewProviderProps) {
  const [previewLocale, setPreviewLocaleState] = useState<SupportedLocale | null>(() => {
    try {
      const stored = sessionStorage.getItem(PREVIEW_STORAGE_KEY);
      if (stored && SUPPORTED_LOCALES.includes(stored as SupportedLocale)) {
        return stored as SupportedLocale;
      }
    } catch {}
    return null;
  });

  useEffect(() => {
    try {
      if (previewLocale) {
        sessionStorage.setItem(PREVIEW_STORAGE_KEY, previewLocale);
      } else {
        sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
      }
    } catch {}
  }, [previewLocale]);

  const setPreviewLocale = (locale: SupportedLocale) => {
    setPreviewLocaleState(locale);
  };

  const clearPreview = () => {
    setPreviewLocaleState(null);
  };

  const value: LocalePreviewContextValue = useMemo(() => ({
    previewLocale,
    setPreviewLocale,
    clearPreview,
    isPreviewActive: previewLocale !== null,
  }), [previewLocale]);

  return (
    <LocalePreviewContext.Provider value={value}>
      <LocaleProvider enabled={false} previewLocale={previewLocale || undefined}>
        {children}
      </LocaleProvider>
    </LocalePreviewContext.Provider>
  );
}
