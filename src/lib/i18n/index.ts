import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

import { MARKET_LOCALES, LOCALE_NAMES as MARKET_LOCALE_NAMES } from '@/lib/locale/markets';
import type { MarketLocale } from '@/lib/locale/markets';

export const SUPPORTED_LOCALES = MARKET_LOCALES;
export type SupportedLocale = MarketLocale;

export const DEFAULT_LOCALE: SupportedLocale = 'en-IE';

export const LOCALE_NAMES: Record<SupportedLocale, string> = MARKET_LOCALE_NAMES;

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

const ACRONYMS = ['crm', 'api', 'url', 'id', 'ui', 'ux', 'poa', 'ber', 'epc', 'ai'];
const SUFFIX_ONLY_TERMS = ['title', 'label', 'name', 'text', 'message'];
const SKIP_SEGMENTS = ['page', 'common', 'shared', 'create', 'edit', 'view', 'list', 'form', 'modal', 'dialog', 'toast', 'buttons'];
const EMPTY_FALLBACK_TERMS = ['subtitle', 'description', 'hint', 'placeholder'];
const EMPTY_FALLBACK_SUFFIXES = ['placeholder', 'subtitle', 'description', 'hint'];

const formatSegment = (segment: string): string => {
  if (ACRONYMS.includes(segment.toLowerCase())) return segment.toUpperCase();
  return segment
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\b\w/g, str => str.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Derives readable English from a translation key.
 * Used as parseMissingKeyHandler so missing keys produce readable text
 * instead of raw key paths like "listings.fields.berRating".
 */
export function extractDefaultFromKey(key: string): string {
  const parts = key.split('.');
  const lastPart = parts.pop() || key;
  const lastPartLower = lastPart.toLowerCase();
  if (EMPTY_FALLBACK_TERMS.includes(lastPartLower)) return '';
  if (EMPTY_FALLBACK_SUFFIXES.some(suffix => lastPartLower.endsWith(suffix))) return '';
  if (ACRONYMS.includes(lastPart.toLowerCase())) return lastPart.toUpperCase();
  if (SUFFIX_ONLY_TERMS.includes(lastPart.toLowerCase()) && parts.length > 0) {
    let meaningfulPart = '';
    while (parts.length > 0) {
      const part = parts.pop() || '';
      if (part && !SKIP_SEGMENTS.includes(part.toLowerCase())) { meaningfulPart = part; break; }
    }
    if (meaningfulPart) return formatSegment(meaningfulPart);
  }
  return formatSegment(lastPart);
}

const sharedI18nOptions = {
  returnNull: false as const,
  returnEmptyString: false as const,
  parseMissingKeyHandler: (key: string) => extractDefaultFromKey(key),
};

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
      ...sharedI18nOptions,
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: SUPPORTED_LOCALES,
      defaultNS: 'common',
      ns: NAMESPACES,
      interpolation: { escapeValue: false },
      backend: { loadPath: '/locales/{{lng}}/{{ns}}.json' },
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage'],
        lookupLocalStorage: 'autolisting_locale',
      },
      react: { useSuspense: false },
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
    ...sharedI18nOptions,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    defaultNS: 'common',
    ns: NAMESPACES,
    interpolation: { escapeValue: false },
    backend: { loadPath: '/locales/{{lng}}/{{ns}}.json' },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'autolisting_locale',
    },
    react: { useSuspense: false },
  } : {
    ...sharedI18nOptions,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    defaultNS: 'common',
    ns: [],
    resources: {},
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
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
