import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { i18n, initI18n, DEFAULT_LOCALE, SupportedLocale, SUPPORTED_LOCALES } from './index';

interface LocaleContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  isI18nEnabled: boolean;
  isLoading: boolean;
  isReady: boolean;
  isPreviewMode: boolean;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  isI18nEnabled: false,
  isLoading: false,
  isReady: true,
  isPreviewMode: false,
});

interface LocaleProviderProps {
  children: ReactNode;
  enabled?: boolean;
  defaultLocale?: SupportedLocale;
  previewLocale?: SupportedLocale | null;
}

export function LocaleProvider({ 
  children, 
  enabled = false,
  defaultLocale = DEFAULT_LOCALE,
  previewLocale = null
}: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<SupportedLocale>(defaultLocale);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);

  const isPreviewMode = previewLocale !== null;
  const effectiveLocale = previewLocale || locale;

  useEffect(() => {
    initI18n(enabled)
      .then(() => {
        if (enabled) {
          const targetLocale = previewLocale || (i18n.language as SupportedLocale);
          if (SUPPORTED_LOCALES.includes(targetLocale)) {
            setLocaleState(targetLocale);
            if (i18n.language !== targetLocale) {
              i18n.changeLanguage(targetLocale);
            }
          }
        }
        setIsLoading(false);
        setIsReady(true);
      })
      .catch((error) => {
        console.error('Failed to initialize i18n:', error);
        setIsLoading(false);
        setIsReady(true);
      });
  }, [enabled, previewLocale]);

  const setLocale = (newLocale: SupportedLocale) => {
    if (!enabled) return;
    
    if (SUPPORTED_LOCALES.includes(newLocale)) {
      setLocaleState(newLocale);
      i18n.changeLanguage(newLocale);
      localStorage.setItem('autolisting_locale', newLocale);
    }
  };

  const value: LocaleContextValue = {
    locale: effectiveLocale,
    setLocale,
    isI18nEnabled: enabled,
    isLoading,
    isReady,
    isPreviewMode,
  };

  if (!isReady) {
    return null;
  }

  return (
    <LocaleContext.Provider value={value}>
      <I18nextProvider i18n={i18n}>
        {children}
      </I18nextProvider>
    </LocaleContext.Provider>
  );
}

export function useLocaleContext() {
  return useContext(LocaleContext);
}

export { LocaleContext };
