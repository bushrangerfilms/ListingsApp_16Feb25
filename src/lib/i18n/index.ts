import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

export const SUPPORTED_LOCALES = ['en-IE', 'en-GB', 'en-US'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en-IE';

export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  'en-IE': 'English (Ireland)',
  'en-GB': 'English (UK)',
  'en-US': 'English (US)',
};

export const NAMESPACES = [
  'common',
  'billing',
  'listings',
  'crm',
  'marketing',
  'glossary',
  'admin',
] as const;

export type Namespace = typeof NAMESPACES[number];

let initState: 'none' | 'minimal' | 'full' = 'none';

export function initI18n(loadTranslations = true): Promise<typeof i18n> {
  if (initState === 'full') {
    return Promise.resolve(i18n);
  }
  
  if (initState === 'minimal' && !loadTranslations) {
    return Promise.resolve(i18n);
  }
  
  if (initState === 'minimal' && loadTranslations) {
    i18n.use(Backend).use(LanguageDetector);
    
    return i18n.init({
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: SUPPORTED_LOCALES,
      defaultNS: 'common',
      ns: NAMESPACES,
      
      interpolation: {
        escapeValue: false,
      },
      
      backend: {
        loadPath: '/locales/{{lng}}/{{ns}}.json',
      },
      
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage'],
        lookupLocalStorage: 'autolisting_locale',
      },
      
      react: {
        useSuspense: false,
      },
    }).then(() => {
      initState = 'full';
      return i18n;
    });
  }
  
  i18n.use(initReactI18next);
  
  if (loadTranslations) {
    i18n.use(Backend).use(LanguageDetector);
  }
  
  const initOptions = loadTranslations ? {
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    defaultNS: 'common',
    ns: NAMESPACES,
    
    interpolation: {
      escapeValue: false,
    },
    
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'autolisting_locale',
    },
    
    react: {
      useSuspense: false,
    },
  } : {
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    defaultNS: 'common',
    ns: [],
    resources: {},
    
    interpolation: {
      escapeValue: false,
    },
    
    react: {
      useSuspense: false,
    },
  };
  
  return i18n.init(initOptions).then(() => {
    initState = loadTranslations ? 'full' : 'minimal';
    return i18n;
  });
}

export function isI18nInitialized() {
  return initState !== 'none';
}

export function isI18nFullyInitialized() {
  return initState === 'full';
}

export { i18n };
export default i18n;
