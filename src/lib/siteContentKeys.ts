export interface SiteCopyField {
  key: string;
  label: string;
  description: string;
  defaultValue: string;
  multiline?: boolean;
  group: 'hero' | 'search' | 'valuation' | 'alerts' | 'testimonials' | 'footer';
}

export const SITE_COPY_FIELDS: SiteCopyField[] = [
  {
    key: 'hero_headline',
    label: 'Hero Headline',
    description: 'Main heading displayed in the hero section',
    defaultValue: 'Find Your Perfect Property',
    group: 'hero',
  },
  {
    key: 'hero_cta_button',
    label: 'CTA Button Text',
    description: 'Text on the main call-to-action button',
    defaultValue: 'Sell Your Property',
    group: 'hero',
  },
  {
    key: 'search_placeholder',
    label: 'Search Placeholder',
    description: 'Placeholder text in the property search input',
    defaultValue: 'Search by location, address, or town...',
    group: 'search',
  },
  {
    key: 'filters_button',
    label: 'Filters Button Text',
    description: 'Text on the filters toggle button',
    defaultValue: 'Filters',
    group: 'search',
  },
  {
    key: 'valuation_headline',
    label: 'Valuation Section Headline',
    description: 'Heading for the property valuation CTA section',
    defaultValue: 'Thinking of Selling?',
    group: 'valuation',
  },
  {
    key: 'valuation_description',
    label: 'Valuation Section Description',
    description: 'Description text below the valuation headline',
    defaultValue: 'Get a free, no-obligation valuation of your property from our expert team.',
    multiline: true,
    group: 'valuation',
  },
  {
    key: 'valuation_button',
    label: 'Valuation Button Text',
    description: 'Text on the valuation request button',
    defaultValue: 'Request Free Valuation',
    group: 'valuation',
  },
  {
    key: 'alerts_headline',
    label: 'Property Alerts Headline',
    description: 'Heading for the property alerts section',
    defaultValue: "Can't find what you're looking for?",
    group: 'alerts',
  },
  {
    key: 'alerts_description',
    label: 'Property Alerts Description',
    description: 'Description text for the property alerts section',
    defaultValue: 'Set up a property alert and be the first to know when matching properties are listed.',
    multiline: true,
    group: 'alerts',
  },
  {
    key: 'alerts_button',
    label: 'Property Alerts Button Text',
    description: 'Text on the property alerts button',
    defaultValue: 'Set Up Alert',
    group: 'alerts',
  },
  {
    key: 'testimonials_headline',
    label: 'Testimonials Section Headline',
    description: 'Heading for the testimonials/reviews section',
    defaultValue: 'What Our Clients Say',
    group: 'testimonials',
  },
  {
    key: 'footer_tagline',
    label: 'Footer Tagline',
    description: 'Short tagline displayed in the footer',
    defaultValue: 'Your trusted property partner',
    group: 'footer',
  },
];

export const SITE_COPY_GROUPS: Record<string, { label: string; description: string }> = {
  hero: { label: 'Hero Section', description: 'Main banner and call-to-action' },
  search: { label: 'Search & Filters', description: 'Property search controls' },
  valuation: { label: 'Valuation CTA', description: 'Free valuation request section' },
  alerts: { label: 'Property Alerts', description: 'Email alert signup section' },
  testimonials: { label: 'Testimonials', description: 'Client reviews section' },
  footer: { label: 'Footer', description: 'Footer content' },
};

export const DEFAULT_LOCALE = 'en-IE';
