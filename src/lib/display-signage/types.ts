export interface DisplaySignageConfig {
  orientation: 'auto' | 'landscape' | 'portrait';
  slide_duration_seconds: number;
  transition_type: 'fade' | 'slide';
  show_price: boolean;
  show_address: boolean;
  show_bedrooms_bathrooms: boolean;
  show_ber_rating: boolean;
  show_contact_info: boolean;
  listing_order: 'newest_first' | 'price_high_to_low' | 'price_low_to_high' | 'random';
  category_filter: 'all' | 'sales' | 'rentals' | 'holiday_rentals';
  max_listings: number | null;
  status_filter: string[];
  photos_per_listing: number;
  custom_message: string | null;
  show_qr_code: boolean;
  show_clock: boolean;
  excluded_listing_ids: string[];
  display_theme: 'classic' | 'modern' | 'minimal';
}

export const ALL_DISPLAY_STATUSES = ['New', 'Published', 'Sale Agreed', 'Let Agreed'] as const;

export const DEFAULT_DISPLAY_CONFIG: DisplaySignageConfig = {
  orientation: 'auto',
  slide_duration_seconds: 10,
  transition_type: 'fade',
  show_price: true,
  show_address: true,
  show_bedrooms_bathrooms: true,
  show_ber_rating: true,
  show_contact_info: true,
  listing_order: 'newest_first',
  category_filter: 'all',
  max_listings: null,
  status_filter: [...ALL_DISPLAY_STATUSES],
  photos_per_listing: 1,
  custom_message: null,
  show_qr_code: false,
  show_clock: false,
  excluded_listing_ids: [],
  display_theme: 'classic',
};

export interface DisplaySignageSettings {
  id: string;
  organization_id: string;
  display_name: string;
  is_enabled: boolean;
  config: DisplaySignageConfig;
  created_at: string;
  updated_at: string;
}

export interface DisplayListing {
  id: string;
  title: string | null;
  price: number | null;
  address: string | null;
  address_detail: string | null;
  address_town: string | null;
  county: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  building_type: string | null;
  floor_area_size: number | null;
  ber_rating: string | null;
  category: string | null;
  status: string | null;
  hero_photo: string | null;
  photos: string[] | null;
  date_posted: string | null;
}

export interface DisplayOrganization {
  business_name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  psr_licence_number: string | null;
  locale: string | null;
  currency: string | null;
  domain: string | null;
}
