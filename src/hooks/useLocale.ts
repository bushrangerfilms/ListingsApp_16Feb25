import { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';
import { useLocaleContext } from '@/lib/i18n/LocaleProvider';
import { DEFAULT_LOCALE, SupportedLocale } from '@/lib/i18n';

interface LocaleConfig {
  locale: SupportedLocale;
  currency: string;
  currencyLocale: string;
  dateLocale: string;
  phoneCountry: CountryCode;
}

const LOCALE_CONFIGS: Record<SupportedLocale, LocaleConfig> = {
  'en-IE': {
    locale: 'en-IE',
    currency: 'EUR',
    currencyLocale: 'en-IE',
    dateLocale: 'en-IE',
    phoneCountry: 'IE',
  },
  'en-GB': {
    locale: 'en-GB',
    currency: 'GBP',
    currencyLocale: 'en-GB',
    dateLocale: 'en-GB',
    phoneCountry: 'GB',
  },
  'en-US': {
    locale: 'en-US',
    currency: 'USD',
    currencyLocale: 'en-US',
    dateLocale: 'en-US',
    phoneCountry: 'US',
  },
};

const ACRONYMS = ['crm', 'api', 'url', 'id', 'ui', 'ux', 'poa', 'ber', 'epc', 'ai'];
const SUFFIX_ONLY_TERMS = ['title', 'label', 'name', 'text', 'message'];
const SKIP_SEGMENTS = ['page', 'common', 'shared', 'create', 'edit', 'view', 'list', 'form', 'modal', 'dialog', 'toast', 'buttons'];

const SPECIAL_PHRASES: Record<string, string> = {
  'poa': 'Price on Application',
  'ber': 'BER',
  'epc': 'EPC',
  'ai': 'AI',
  'crm': 'CRM',
  'newListing': 'New Listing',
  'propertyListings': 'Property Listings',
  'aiExtraction': 'AI Property Extraction',
  'markAsNew': 'Mark as New',
  'holidayRental': 'Holiday Rental',
  'forSale': 'For Sale',
  'exportCsv': 'Export CSV',
  'backToDashboard': 'Back to Dashboard',
  'listings.status.update': 'Update Status',
  'listings.create.title': 'Create New Listing',
  'listings.create.details.description': 'Description',
  'listings.create.details.descriptionPlaceholder': 'e.g., Stunning 3-bed semi-detached home in a quiet cul-de-sac. Recently renovated kitchen with quartz countertops. South-facing garden with patio area. Walking distance to schools and shops.',
  'listings.create.details.specsPlaceholder': 'e.g., Living Room: 5.2m x 4.1m • Kitchen: 4.5m x 3.8m • Master Bedroom: 4.2m x 3.6m with ensuite • Garden: 15m x 8m',
  // Public listings page content
  'listings.public.sellProperty': 'Sell Your Property Quickly And Easily!',
  'listings.public.findProperty': 'Find Your Perfect Property',
  'listings.public.cantFindProperty': "Can't Find What You're Looking For?",
  'listings.public.beFirstToKnow': 'Be the first to know of new properties that suit your needs',
  'listings.public.getNotified': 'Get Notified',
  'listings.public.thinkingOfSelling': 'Thinking of Selling?',
  'listings.public.getFreeValuation': 'Get a free property valuation from our expert team',
  'listings.public.requestValuation': 'Request a Valuation',
  'listings.public.hero.sellCta': 'Sell Your Property Quickly And Easily!',
  'listings.public.hero.title': 'Find Your Perfect Property',
  'listings.public.hero.filters': 'Filters',
  'listings.public.searchPlaceholder': 'Search by location or address...',
  // Marketing page content
  'home.hero.badge': 'Real Estate Platform',
  'home.hero.title': 'Streamline Your',
  'home.hero.titleHighlight': 'Property Business',
  'home.hero.subtitle': 'The all-in-one platform for estate agents. Manage listings, automate marketing, nurture leads, and grow your business with AI-powered tools.',
  'home.hero.cta': 'Start Free Trial',
  'home.hero.ctaSecondary': 'View Features',
  'home.hero.trialNote': '14-day free trial. No credit card required.',
  'home.features.socialMedia.title': 'Social Media',
  'home.features.socialMedia.description': 'Schedule and publish property posts across all your social channels automatically.',
  'home.features.listings.title': 'Listings',
  'home.features.listings.description': 'Professional property listings with AI-enhanced descriptions and photo management.',
  'home.features.crm.title': 'CRM',
  'home.features.crm.description': 'Track leads, manage client relationships, and never miss a follow-up.',
  'home.features.email.title': 'Email',
  'home.features.email.description': 'Automated email sequences to nurture leads and keep clients informed.',
  'home.features.ai.title': 'AI',
  'home.features.ai.description': 'AI-powered chatbot for your website that answers enquiries 24/7.',
  'home.features.analytics.title': 'Analytics',
  'home.features.analytics.description': 'Track performance metrics and gain insights to grow your business.',
  'home.benefits.socialMedia': 'Automated social media posting',
  'home.benefits.listings': 'Professional property listings',
  'home.benefits.domains': 'Custom domain support',
  'home.benefits.chatbot': 'AI chatbot for enquiries',
  'home.benefits.email': 'Email automation & sequences',
  'home.benefits.multiTenant': 'Multi-agent team support',
  'home.seo.title': 'AutoListing.io - Property Management Platform for Estate Agents',
  'home.seo.description': 'All-in-one platform for estate agents. Manage listings, automate marketing, nurture leads with CRM, and grow with AI-powered tools.',
  'line1': 'Address Line 1',
  'line1Optional': 'Address Line 1 (Optional)',
  'line1Placeholder': '',
  'townPlaceholder': '',
};

const formatSegment = (segment: string): string => {
  if (SPECIAL_PHRASES[segment]) {
    return SPECIAL_PHRASES[segment];
  }
  if (ACRONYMS.includes(segment.toLowerCase())) {
    return segment.toUpperCase();
  }
  return segment
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\b\w/g, str => str.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
};

const EMPTY_FALLBACK_TERMS = ['subtitle', 'description', 'hint', 'placeholder'];
const EMPTY_FALLBACK_SUFFIXES = ['placeholder', 'subtitle', 'description', 'hint'];

const extractDefaultFromKey = (key: string): string => {
  // Check for full key match first
  if (SPECIAL_PHRASES[key]) {
    return SPECIAL_PHRASES[key];
  }
  
  const parts = key.split('.');
  const lastPart = parts.pop() || key;
  const lastPartLower = lastPart.toLowerCase();
  
  // Subtitles and descriptions should be empty - they contain prose that can't be derived
  if (EMPTY_FALLBACK_TERMS.includes(lastPartLower)) {
    return '';
  }
  
  // Keys ending with placeholder/subtitle/etc (e.g., descriptionPlaceholder) should also be empty
  if (EMPTY_FALLBACK_SUFFIXES.some(suffix => lastPartLower.endsWith(suffix))) {
    return '';
  }
  
  if (SPECIAL_PHRASES[lastPart]) {
    return SPECIAL_PHRASES[lastPart];
  }
  
  if (ACRONYMS.includes(lastPart.toLowerCase())) {
    return lastPart.toUpperCase();
  }
  
  if (SUFFIX_ONLY_TERMS.includes(lastPart.toLowerCase()) && parts.length > 0) {
    let meaningfulPart = '';
    while (parts.length > 0) {
      const part = parts.pop() || '';
      if (part && !SKIP_SEGMENTS.includes(part.toLowerCase())) {
        meaningfulPart = part;
        break;
      }
    }
    if (meaningfulPart) {
      return formatSegment(meaningfulPart);
    }
  }
  
  return formatSegment(lastPart);
};

const noopT: TFunction = ((key: string, params?: Record<string, unknown>) => {
  let result = extractDefaultFromKey(key);
  if (params && typeof params === 'object') {
    const paramEntries = Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null
    );
    if (paramEntries.length > 0) {
      const paramValues = paramEntries.map(([, value]) => String(value));
      const allParamsInResult = paramValues.every(v => result.toLowerCase().includes(v.toLowerCase()));
      if (!allParamsInResult) {
        result = `${result} (${paramValues.join(', ')})`;
      }
    }
  }
  return result;
}) as TFunction;

export function useLocale() {
  const { locale, setLocale, isI18nEnabled, isLoading, isReady, isPreviewMode } = useLocaleContext();
  const { t: i18nT, i18n } = useTranslation();

  const t = useMemo(() => {
    return isI18nEnabled ? i18nT : noopT;
  }, [isI18nEnabled, i18nT]);

  const config = useMemo(() => {
    return LOCALE_CONFIGS[locale] || LOCALE_CONFIGS[DEFAULT_LOCALE];
  }, [locale]);

  const formatCurrency = useCallback(
    (amount: number, options?: { currency?: string; showDecimals?: boolean }) => {
      const currencyToUse = options?.currency || config.currency;
      const showDecimals = options?.showDecimals !== false;
      
      return new Intl.NumberFormat(config.currencyLocale, {
        style: 'currency',
        currency: currencyToUse,
        minimumFractionDigits: showDecimals ? 2 : 0,
        maximumFractionDigits: showDecimals ? 2 : 0,
      }).format(amount);
    },
    [config]
  );

  const formatDate = useCallback(
    (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
      const dateObj = typeof date === 'string' || typeof date === 'number' 
        ? new Date(date) 
        : date;
      
      const defaultOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      };
      
      return new Intl.DateTimeFormat(config.dateLocale, options || defaultOptions).format(dateObj);
    },
    [config]
  );

  const formatDateTime = useCallback(
    (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
      const dateObj = typeof date === 'string' || typeof date === 'number' 
        ? new Date(date) 
        : date;
      
      const defaultOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      };
      
      return new Intl.DateTimeFormat(config.dateLocale, options || defaultOptions).format(dateObj);
    },
    [config]
  );

  const formatNumber = useCallback(
    (num: number, options?: Intl.NumberFormatOptions) => {
      return new Intl.NumberFormat(config.currencyLocale, options).format(num);
    },
    [config]
  );

  const formatPhone = useCallback(
    (phoneNumber: string, defaultCountry?: CountryCode) => {
      const parsed = parsePhoneNumberFromString(
        phoneNumber, 
        defaultCountry || config.phoneCountry
      );
      
      if (parsed) {
        return parsed.formatInternational();
      }
      
      return phoneNumber;
    },
    [config]
  );

  const validatePhone = useCallback(
    (phoneNumber: string, defaultCountry?: CountryCode) => {
      const parsed = parsePhoneNumberFromString(
        phoneNumber, 
        defaultCountry || config.phoneCountry
      );
      
      return parsed?.isValid() || false;
    },
    [config]
  );

  const formatArea = useCallback(
    (squareMetres: number, showUnit?: boolean) => {
      const formatted = formatNumber(squareMetres, { maximumFractionDigits: 0 });
      return showUnit !== false ? `${formatted} m²` : formatted;
    },
    [formatNumber]
  );

  return {
    locale,
    setLocale,
    isI18nEnabled,
    isLoading,
    isReady,
    isPreviewMode,
    currency: config.currency,
    t,
    i18n: isI18nEnabled ? i18n : null,
    config,
    formatCurrency,
    formatDate,
    formatDateTime,
    formatNumber,
    formatPhone,
    validatePhone,
    formatArea,
  };
}
