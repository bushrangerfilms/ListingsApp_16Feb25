import { createContext, useContext } from 'react';
import { SupportedLocale } from '@/lib/i18n';

export interface LocalePreviewContextValue {
  previewLocale: SupportedLocale | null;
  setPreviewLocale: (locale: SupportedLocale) => void;
  clearPreview: () => void;
  isPreviewActive: boolean;
}

export const LocalePreviewContext = createContext<LocalePreviewContextValue>({
  previewLocale: null,
  setPreviewLocale: () => {},
  clearPreview: () => {},
  isPreviewActive: false,
});

export function useLocalePreview(): LocalePreviewContextValue {
  return useContext(LocalePreviewContext);
}
