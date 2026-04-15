-- Store shared i18n infrastructure files for cross-app access
-- Both AutoListing and Socials can query this table

CREATE TABLE IF NOT EXISTS public.shared_i18n_files (
  id SERIAL PRIMARY KEY,
  file_path TEXT NOT NULL UNIQUE,
  file_type TEXT NOT NULL DEFAULT 'typescript',
  content TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_i18n_files_path ON public.shared_i18n_files(file_path);

ALTER TABLE public.shared_i18n_files ENABLE ROW LEVEL SECURITY;

-- Anyone can read (both apps need access)
DROP POLICY IF EXISTS "shared_i18n_files_public_read" ON public.shared_i18n_files;
CREATE POLICY "shared_i18n_files_public_read" ON public.shared_i18n_files
  FOR SELECT USING (true);

COMMENT ON TABLE public.shared_i18n_files IS 'Shared i18n infrastructure files for AutoListing and Socials apps';

-- Insert all infrastructure files
INSERT INTO public.shared_i18n_files (file_path, file_type, content, description) VALUES

-- i18n/index.ts
('src/lib/i18n/index.ts', 'typescript', $CODE$import i18n from 'i18next';
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

// UPDATE THIS for your app's namespaces
export const NAMESPACES = [
  'common',
  'billing',
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
      interpolation: { escapeValue: false },
      backend: { loadPath: '/locales/{{lng}}/{{ns}}.json' },
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage'],
        lookupLocalStorage: 'app_locale',
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
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    defaultNS: 'common',
    ns: NAMESPACES,
    interpolation: { escapeValue: false },
    backend: { loadPath: '/locales/{{lng}}/{{ns}}.json' },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'app_locale',
    },
    react: { useSuspense: false },
  } : {
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

export function isI18nInitialized() { return initState !== 'none'; }
export function isI18nFullyInitialized() { return initState === 'full'; }

export { i18n };
export default i18n;$CODE$, 'Core i18n configuration with state machine'),

-- i18n/LocaleProvider.tsx
('src/lib/i18n/LocaleProvider.tsx', 'typescript', $CODE$import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { i18n, initI18n, DEFAULT_LOCALE, SupportedLocale, SUPPORTED_LOCALES } from './index';

interface LocaleContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  isI18nEnabled: boolean;
  isLoading: boolean;
  isReady: boolean;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  isI18nEnabled: false,
  isLoading: false,
  isReady: true,
});

interface LocaleProviderProps {
  children: ReactNode;
  enabled?: boolean;
  defaultLocale?: SupportedLocale;
}

export function LocaleProvider({ 
  children, 
  enabled = false,
  defaultLocale = DEFAULT_LOCALE 
}: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<SupportedLocale>(defaultLocale);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    initI18n(enabled)
      .then(() => {
        if (enabled) {
          const detectedLocale = i18n.language as SupportedLocale;
          if (SUPPORTED_LOCALES.includes(detectedLocale)) {
            setLocaleState(detectedLocale);
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
  }, [enabled]);

  const setLocale = (newLocale: SupportedLocale) => {
    if (!enabled) return;
    if (SUPPORTED_LOCALES.includes(newLocale)) {
      setLocaleState(newLocale);
      i18n.changeLanguage(newLocale);
      localStorage.setItem('app_locale', newLocale);
    }
  };

  const value: LocaleContextValue = {
    locale,
    setLocale,
    isI18nEnabled: enabled,
    isLoading,
    isReady,
  };

  if (!isReady) return null;

  return (
    <LocaleContext.Provider value={value}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </LocaleContext.Provider>
  );
}

export function useLocaleContext() { return useContext(LocaleContext); }
export { LocaleContext };$CODE$, 'React context provider for i18n'),

-- hooks/useLocale.ts
('src/hooks/useLocale.ts', 'typescript', $CODE$import { useMemo, useCallback } from 'react';
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
  'en-IE': { locale: 'en-IE', currency: 'EUR', currencyLocale: 'en-IE', dateLocale: 'en-IE', phoneCountry: 'IE' },
  'en-GB': { locale: 'en-GB', currency: 'GBP', currencyLocale: 'en-GB', dateLocale: 'en-GB', phoneCountry: 'GB' },
  'en-US': { locale: 'en-US', currency: 'USD', currencyLocale: 'en-US', dateLocale: 'en-US', phoneCountry: 'US' },
};

const noopT: TFunction = ((key: string) => key) as TFunction;

export function useLocale() {
  const { locale, setLocale, isI18nEnabled, isLoading, isReady } = useLocaleContext();
  const { t: i18nT, i18n } = useTranslation();

  const t = useMemo(() => isI18nEnabled ? i18nT : noopT, [isI18nEnabled, i18nT]);
  const config = useMemo(() => LOCALE_CONFIGS[locale] || LOCALE_CONFIGS[DEFAULT_LOCALE], [locale]);

  const formatCurrency = useCallback(
    (amount: number, options?: { currency?: string; showDecimals?: boolean }) => {
      const currencyToUse = options?.currency || config.currency;
      const showDecimals = options?.showDecimals !== false;
      return new Intl.NumberFormat(config.currencyLocale, {
        style: 'currency', currency: currencyToUse,
        minimumFractionDigits: showDecimals ? 2 : 0, maximumFractionDigits: showDecimals ? 2 : 0,
      }).format(amount);
    }, [config]
  );

  const formatDate = useCallback(
    (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
      const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
      const defaultOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
      return new Intl.DateTimeFormat(config.dateLocale, options || defaultOptions).format(dateObj);
    }, [config]
  );

  const formatDateTime = useCallback(
    (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
      const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
      const defaultOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
      return new Intl.DateTimeFormat(config.dateLocale, options || defaultOptions).format(dateObj);
    }, [config]
  );

  const formatNumber = useCallback(
    (num: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat(config.currencyLocale, options).format(num),
    [config]
  );

  const formatPhone = useCallback(
    (phoneNumber: string, defaultCountry?: CountryCode) => {
      const parsed = parsePhoneNumberFromString(phoneNumber, defaultCountry || config.phoneCountry);
      return parsed ? parsed.formatInternational() : phoneNumber;
    }, [config]
  );

  const validatePhone = useCallback(
    (phoneNumber: string, defaultCountry?: CountryCode) => {
      const parsed = parsePhoneNumberFromString(phoneNumber, defaultCountry || config.phoneCountry);
      return parsed?.isValid() || false;
    }, [config]
  );

  const formatArea = useCallback(
    (squareMetres: number, showUnit?: boolean) => {
      const formatted = formatNumber(squareMetres, { maximumFractionDigits: 0 });
      return showUnit !== false ? `${formatted} m²` : formatted;
    }, [formatNumber]
  );

  return {
    locale, setLocale, isI18nEnabled, isLoading, isReady, t,
    i18n: isI18nEnabled ? i18n : null, config,
    formatCurrency, formatDate, formatDateTime, formatNumber, formatPhone, validatePhone, formatArea,
  };
}$CODE$, 'Hook for locale-aware formatting'),

-- hooks/useRegionConfig.ts
('src/hooks/useRegionConfig.ts', 'typescript', $CODE$import { useMemo } from 'react';
import { useLocaleContext } from '@/lib/i18n/LocaleProvider';
import { DEFAULT_LOCALE, SupportedLocale } from '@/lib/i18n';
import { getRegionConfig, RegionConfig } from '@/lib/regionConfig';

export function useRegionConfig(): RegionConfig {
  const { locale } = useLocaleContext();
  const config = useMemo(() => getRegionConfig(locale || DEFAULT_LOCALE), [locale]);
  return config;
}

export function useEnergyRatings() { return useRegionConfig().property.energyRatings; }
export function useAddressConfig() { return useRegionConfig().address; }
export function useMeasurementConfig() { return useRegionConfig().property.measurements; }
export function useTaxConfig() { return useRegionConfig().financial.tax; }
export function useLegalTerms() { return useRegionConfig().legal.terminology; }
export function useComplianceConfig() { return useRegionConfig().legal.compliance; }$CODE$, 'Hook for region-specific configuration'),

-- regionConfig/index.ts
('src/lib/regionConfig/index.ts', 'typescript', $CODE$import { SupportedLocale } from '@/lib/i18n';
import { ieConfig } from './ie';
import { gbConfig } from './gb';
import { usConfig } from './us';

export interface EnergyRating {
  code: string;
  label: string;
  description?: string;
}

export interface EnergyRatingsConfig {
  enabled: boolean;
  label: string;
  ratings: EnergyRating[];
  required: boolean;
}

export interface AddressConfig {
  postalCodeLabel: string;
  postalCodePlaceholder: string;
  postalCodePattern: RegExp;
  postalCodeFormat: string;
  countyLabel: string;
  countyRequired: boolean;
  stateLabel?: string;
  stateRequired?: boolean;
  states?: Array<{ code: string; name: string }>;
}

export interface MeasurementsConfig {
  areaUnit: 'sqm' | 'sqft';
  areaLabel: string;
  areaSymbol: string;
  convertFromSqm: (sqm: number) => number;
  convertToSqm: (value: number) => number;
}

export interface TaxConfig {
  vatRate: number;
  vatLabel: string;
  vatEnabled: boolean;
  stampDutyLabel?: string;
}

export interface LegalTerminology {
  solicitor: string;
  conveyancing: string;
  stampDuty: string;
  freehold: string;
  leasehold: string;
  listingAgent: string;
  buyersAgent: string;
}

export interface ComplianceConfig {
  gdprEnabled: boolean;
  ccpaEnabled: boolean;
  amlRequired: boolean;
  fairHousingRequired: boolean;
  dataRetentionDays: number;
}

export interface PropertyConfig {
  energyRatings: EnergyRatingsConfig;
  measurements: MeasurementsConfig;
  floorNumberingOffset: number;
}

export interface FinancialConfig {
  currency: string;
  currencySymbol: string;
  currencyPosition: 'before' | 'after';
  thousandsSeparator: string;
  decimalSeparator: string;
  tax: TaxConfig;
}

export interface DateTimeConfig {
  dateFormat: string;
  timeFormat: '12h' | '24h';
  firstDayOfWeek: 0 | 1;
}

export interface LegalConfig {
  terminology: LegalTerminology;
  compliance: ComplianceConfig;
}

export interface RegionConfig {
  locale: SupportedLocale;
  regionName: string;
  countryCode: string;
  property: PropertyConfig;
  address: AddressConfig;
  financial: FinancialConfig;
  dateTime: DateTimeConfig;
  legal: LegalConfig;
}

const REGION_CONFIGS: Record<SupportedLocale, RegionConfig> = {
  'en-IE': ieConfig,
  'en-GB': gbConfig,
  'en-US': usConfig,
};

export function getRegionConfig(locale: SupportedLocale): RegionConfig {
  return REGION_CONFIGS[locale] || REGION_CONFIGS['en-IE'];
}

export function getAllRegionConfigs(): RegionConfig[] {
  return Object.values(REGION_CONFIGS);
}$CODE$, 'Region configuration types and exports'),

-- Translation files as JSON
('public/locales/en-IE/common.json', 'json', $CODE${
  "buttons": {
    "save": "Save", "cancel": "Cancel", "delete": "Delete", "edit": "Edit", "create": "Create",
    "add": "Add", "remove": "Remove", "close": "Close", "confirm": "Confirm", "submit": "Submit",
    "back": "Back", "next": "Next", "previous": "Previous", "search": "Search", "filter": "Filter",
    "reset": "Reset", "refresh": "Refresh", "export": "Export", "import": "Import", "download": "Download",
    "upload": "Upload", "view": "View", "viewAll": "View All", "learnMore": "Learn More",
    "getStarted": "Get Started", "signIn": "Sign In", "signUp": "Sign Up", "signOut": "Sign Out", "continue": "Continue"
  },
  "labels": {
    "name": "Name", "email": "Email", "phone": "Phone", "address": "Address", "description": "Description",
    "notes": "Notes", "status": "Status", "type": "Type", "date": "Date", "time": "Time", "actions": "Actions",
    "settings": "Settings", "preferences": "Preferences", "profile": "Profile", "account": "Account",
    "organisation": "Organisation", "user": "User", "users": "Users", "role": "Role", "permissions": "Permissions"
  },
  "status": {
    "active": "Active", "inactive": "Inactive", "pending": "Pending", "completed": "Completed",
    "cancelled": "Cancelled", "failed": "Failed", "processing": "Processing", "draft": "Draft", "archived": "Archived"
  },
  "messages": {
    "loading": "Loading...", "saving": "Saving...", "saved": "Saved successfully",
    "deleted": "Deleted successfully", "updated": "Updated successfully", "created": "Created successfully",
    "error": "An error occurred", "noResults": "No results found", "noData": "No data available",
    "confirmDelete": "Are you sure you want to delete this?", "unsavedChanges": "You have unsaved changes"
  },
  "validation": {
    "required": "This field is required", "invalidEmail": "Please enter a valid email address",
    "invalidPhone": "Please enter a valid phone number", "minLength": "Must be at least {{min}} characters",
    "maxLength": "Must be no more than {{max}} characters", "invalidFormat": "Invalid format"
  },
  "time": {
    "today": "Today", "yesterday": "Yesterday", "tomorrow": "Tomorrow", "thisWeek": "This Week",
    "lastWeek": "Last Week", "thisMonth": "This Month", "lastMonth": "Last Month",
    "ago": "{{time}} ago", "in": "in {{time}}"
  },
  "pagination": {
    "page": "Page", "of": "of", "showing": "Showing", "to": "to", "results": "results", "perPage": "per page"
  }
}$CODE$, 'Common translations - Irish English'),

('public/locales/en-IE/billing.json', 'json', $CODE${
  "credits": {
    "title": "Credits", "balance": "Credit Balance", "remaining": "{{count}} credits remaining",
    "used": "{{count}} credits used", "purchase": "Purchase Credits", "topUp": "Top Up",
    "history": "Credit History", "transaction": "Transaction", "amount": "Amount", "cost": "Cost", "description": "Description"
  },
  "subscription": {
    "title": "Subscription", "plan": "Plan", "currentPlan": "Current Plan", "upgrade": "Upgrade",
    "downgrade": "Downgrade", "cancel": "Cancel Subscription", "renews": "Renews on {{date}}",
    "expires": "Expires on {{date}}", "trial": "Free Trial", "trialEnds": "Trial ends in {{days}} days", "trialExpired": "Trial Expired"
  },
  "plans": {
    "starter": { "name": "Starter", "description": "Perfect for individual agents" },
    "pro": { "name": "Pro", "description": "For growing agencies" },
    "enterprise": { "name": "Enterprise", "description": "Custom solutions for large organisations" }
  },
  "pricing": {
    "perMonth": "per month", "perYear": "per year", "perUser": "per user",
    "includedCredits": "{{count}} credits included", "additionalCredits": "Additional credits",
    "vat": "VAT", "vatIncluded": "VAT included", "vatExcluded": "excl. VAT", "total": "Total"
  },
  "invoices": {
    "title": "Invoices", "invoice": "Invoice", "date": "Date", "amount": "Amount", "status": "Status",
    "download": "Download", "paid": "Paid", "pending": "Pending", "overdue": "Overdue"
  },
  "payment": {
    "method": "Payment Method", "card": "Card", "addCard": "Add Card", "updateCard": "Update Card",
    "removeCard": "Remove Card", "processing": "Processing payment...", "success": "Payment successful", "failed": "Payment failed"
  }
}$CODE$, 'Billing translations - shared between apps')

ON CONFLICT (file_path) DO UPDATE SET
  content = EXCLUDED.content,
  updated_at = NOW();

-- Add region config files in a separate INSERT
INSERT INTO public.shared_i18n_files (file_path, file_type, content, description) VALUES

('src/lib/regionConfig/ie.ts', 'typescript', $CODE$import { RegionConfig } from './index';

export const ieConfig: RegionConfig = {
  locale: 'en-IE',
  regionName: 'Ireland',
  countryCode: 'IE',
  property: {
    energyRatings: {
      enabled: true, label: 'BER Rating', required: true,
      ratings: [
        { code: 'A1', label: 'A1', description: 'Most energy efficient' },
        { code: 'A2', label: 'A2' }, { code: 'A3', label: 'A3' },
        { code: 'B1', label: 'B1' }, { code: 'B2', label: 'B2' }, { code: 'B3', label: 'B3' },
        { code: 'C1', label: 'C1' }, { code: 'C2', label: 'C2' }, { code: 'C3', label: 'C3' },
        { code: 'D1', label: 'D1' }, { code: 'D2', label: 'D2' },
        { code: 'E1', label: 'E1' }, { code: 'E2', label: 'E2' },
        { code: 'F', label: 'F' }, { code: 'G', label: 'G', description: 'Least energy efficient' },
        { code: 'EXEMPT', label: 'Exempt' },
      ],
    },
    measurements: { areaUnit: 'sqm', areaLabel: 'Square Metres', areaSymbol: 'm²', convertFromSqm: (sqm: number) => sqm, convertToSqm: (value: number) => value },
    floorNumberingOffset: 0,
  },
  address: { postalCodeLabel: 'Eircode', postalCodePlaceholder: 'A65 F4E2', postalCodePattern: /^[A-Z]\d{2}\s?[A-Z0-9]{4}$/i, postalCodeFormat: 'A65 F4E2', countyLabel: 'County', countyRequired: true },
  financial: { currency: 'EUR', currencySymbol: '€', currencyPosition: 'before', thousandsSeparator: ',', decimalSeparator: '.', tax: { vatRate: 0.23, vatLabel: 'VAT', vatEnabled: true, stampDutyLabel: 'Stamp Duty' } },
  dateTime: { dateFormat: 'DD/MM/YYYY', timeFormat: '24h', firstDayOfWeek: 1 },
  legal: {
    terminology: { solicitor: 'Solicitor', conveyancing: 'Conveyancing', stampDuty: 'Stamp Duty', freehold: 'Freehold', leasehold: 'Leasehold', listingAgent: 'Estate Agent', buyersAgent: 'Buyer''s Agent' },
    compliance: { gdprEnabled: true, ccpaEnabled: false, amlRequired: true, fairHousingRequired: false, dataRetentionDays: 2555 },
  },
};$CODE$, 'Ireland region configuration'),

('src/lib/regionConfig/gb.ts', 'typescript', $CODE$import { RegionConfig } from './index';

export const gbConfig: RegionConfig = {
  locale: 'en-GB',
  regionName: 'United Kingdom',
  countryCode: 'GB',
  property: {
    energyRatings: {
      enabled: true, label: 'EPC Rating', required: true,
      ratings: [
        { code: 'A', label: 'A', description: 'Most energy efficient (92-100)' },
        { code: 'B', label: 'B', description: '81-91' }, { code: 'C', label: 'C', description: '69-80' },
        { code: 'D', label: 'D', description: '55-68' }, { code: 'E', label: 'E', description: '39-54' },
        { code: 'F', label: 'F', description: '21-38' }, { code: 'G', label: 'G', description: 'Least energy efficient (1-20)' },
        { code: 'EXEMPT', label: 'Exempt' },
      ],
    },
    measurements: { areaUnit: 'sqm', areaLabel: 'Square Metres', areaSymbol: 'm²', convertFromSqm: (sqm: number) => sqm, convertToSqm: (value: number) => value },
    floorNumberingOffset: 0,
  },
  address: { postalCodeLabel: 'Postcode', postalCodePlaceholder: 'SW1A 1AA', postalCodePattern: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i, postalCodeFormat: 'SW1A 1AA', countyLabel: 'County', countyRequired: false },
  financial: { currency: 'GBP', currencySymbol: '£', currencyPosition: 'before', thousandsSeparator: ',', decimalSeparator: '.', tax: { vatRate: 0.20, vatLabel: 'VAT', vatEnabled: true, stampDutyLabel: 'Stamp Duty Land Tax' } },
  dateTime: { dateFormat: 'DD/MM/YYYY', timeFormat: '24h', firstDayOfWeek: 1 },
  legal: {
    terminology: { solicitor: 'Solicitor', conveyancing: 'Conveyancing', stampDuty: 'Stamp Duty Land Tax', freehold: 'Freehold', leasehold: 'Leasehold', listingAgent: 'Estate Agent', buyersAgent: 'Buyer''s Agent' },
    compliance: { gdprEnabled: true, ccpaEnabled: false, amlRequired: true, fairHousingRequired: false, dataRetentionDays: 2555 },
  },
};$CODE$, 'UK region configuration'),

('src/lib/regionConfig/us.ts', 'typescript', $CODE$import { RegionConfig } from './index';

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'District of Columbia' },
];

export const usConfig: RegionConfig = {
  locale: 'en-US',
  regionName: 'United States',
  countryCode: 'US',
  property: {
    energyRatings: { enabled: false, label: 'Energy Rating', required: false, ratings: [] },
    measurements: { areaUnit: 'sqft', areaLabel: 'Square Feet', areaSymbol: 'sq ft', convertFromSqm: (sqm: number) => sqm * 10.7639, convertToSqm: (sqft: number) => sqft / 10.7639 },
    floorNumberingOffset: 1,
  },
  address: { postalCodeLabel: 'ZIP Code', postalCodePlaceholder: '10001', postalCodePattern: /^\d{5}(-\d{4})?$/, postalCodeFormat: '10001 or 10001-1234', countyLabel: 'County', countyRequired: false, stateLabel: 'State', stateRequired: true, states: US_STATES },
  financial: { currency: 'USD', currencySymbol: '$', currencyPosition: 'before', thousandsSeparator: ',', decimalSeparator: '.', tax: { vatRate: 0, vatLabel: 'Sales Tax', vatEnabled: false } },
  dateTime: { dateFormat: 'MM/DD/YYYY', timeFormat: '12h', firstDayOfWeek: 0 },
  legal: {
    terminology: { solicitor: 'Attorney', conveyancing: 'Title Insurance', stampDuty: 'Transfer Tax', freehold: 'Fee Simple', leasehold: 'Leasehold', listingAgent: 'Listing Agent', buyersAgent: 'Buyer''s Agent' },
    compliance: { gdprEnabled: false, ccpaEnabled: true, amlRequired: true, fairHousingRequired: true, dataRetentionDays: 2555 },
  },
};$CODE$, 'US region configuration')

ON CONFLICT (file_path) DO UPDATE SET
  content = EXCLUDED.content,
  updated_at = NOW();
