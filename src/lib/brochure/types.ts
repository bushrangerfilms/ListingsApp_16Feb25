export interface BrochureCover {
  headline: string;
  address: string;
  price: string;
  saleMethod: string;
  heroPhotoUrl: string;
  energyRating?: string;
}

export interface BrochureDescription {
  marketingText: string;
  keyFeatures: string[];
}

export interface BrochureRoom {
  id: string;
  name: string;
  floor: string;
  dimensions?: string;
  description?: string;
  photoUrl?: string;
}

export interface BrochureFeatures {
  services: string[];
  external: string[];
  nearby: string[];
}

export interface BrochureLocation {
  text: string;
  amenities: string[];
}

export interface BrochureFloorPlan {
  id: string;
  label: string;
  imageUrl: string;
}

export interface BrochureGalleryItem {
  id: string;
  url: string;
  caption?: string;
}

export interface BrochureLegal {
  disclaimer: string;
  psrLicenceNumber?: string;
}

export interface BrochureContent {
  cover: BrochureCover;
  description: BrochureDescription;
  rooms: BrochureRoom[];
  features: BrochureFeatures;
  location: BrochureLocation;
  floorPlans: BrochureFloorPlan[];
  gallery: BrochureGalleryItem[];
  legal: BrochureLegal;
  visibleSections: Record<string, boolean>;
  sectionOrder: string[];
}

export interface BrochureBranding {
  businessName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  businessAddress: string;
  psrLicenceNumber: string | null;
  locale: string;
  currency: string;
  countryCode: string;
}

export interface ListingBrochure {
  id: string;
  listing_id: string;
  organization_id: string;
  template_id: string;
  content: BrochureContent;
  branding: BrochureBranding;
  pdf_url: string | null;
  pdf_generated_at: string | null;
  ai_generated_at: string | null;
  status: 'draft' | 'generating' | 'ready' | 'error';
  created_at: string;
  updated_at: string;
  is_archived: boolean;
}

export const DEFAULT_SECTION_ORDER = [
  'cover',
  'description',
  'rooms',
  'features',
  'location',
  'gallery',
  'floorPlans',
  'legal',
];

export const DEFAULT_VISIBLE_SECTIONS: Record<string, boolean> = {
  cover: true,
  description: true,
  rooms: true,
  features: true,
  location: true,
  gallery: true,
  floorPlans: true,
  legal: true,
};

export const DEFAULT_BROCHURE_CONTENT: BrochureContent = {
  cover: {
    headline: '',
    address: '',
    price: '',
    saleMethod: 'For Sale by Private Treaty',
    heroPhotoUrl: '',
  },
  description: {
    marketingText: '',
    keyFeatures: [],
  },
  rooms: [],
  features: {
    services: [],
    external: [],
    nearby: [],
  },
  location: {
    text: '',
    amenities: [],
  },
  floorPlans: [],
  gallery: [],
  legal: {
    disclaimer: '',
  },
  visibleSections: { ...DEFAULT_VISIBLE_SECTIONS },
  sectionOrder: [...DEFAULT_SECTION_ORDER],
};
