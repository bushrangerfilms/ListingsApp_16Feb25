import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, SlidersHorizontal, ArrowUpDown, MousePointerClick, Home, Key, Palmtree, ClipboardCheck, Calculator } from 'lucide-react';
import { ListingCard } from '@/components/ListingCard';
import { PublicHeader } from '@/components/PublicHeader';
import { Footer } from '@/components/Footer';
import { CookieConsent } from '@/components/CookieConsent';
import { SEO } from '@/components/SEO';
import { Skeleton } from '@/components/ui/skeleton';
import { ReviewsSection } from '@/components/ReviewsSection';
import { PropertyAlertDialog } from '@/components/PropertyAlertDialog';
import { AIAssistantWidget } from '@/components/AIAssistantWidget';
import { AnnouncementBar } from '@/components/AnnouncementBar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePublicListings } from '@/contexts/PublicListingsContext';
import { usePropertyServices } from '@/hooks/usePropertyServices';
import { useParams } from 'react-router-dom';
import premiumHouse from '@/assets/premium-house.jpg';
import { useLocale } from '@/hooks/useLocale';
import { BrandingProvider } from '@/components/BrandingProvider';
import { useOrgContent } from '@/hooks/useOrgContent';

interface Listing {
  id: string;
  title: string;
  status: string;
  category?: string;
  price: string | null;
  priceOnApplication?: boolean;
  addressLine1: string;
  addressLine2?: string;
  addressTown: string;
  county: string;
  eircode?: string;
  bedrooms: string | number;
  bathrooms: string | number;
  buildingType: string;
  buildingSize?: string | number;
  landSize?: string | number;
  berRating?: string;
  description?: string;
  specs?: string;
  heroPhoto: string | null;
  photos?: any[];
  datePosted: string;
  statusChangedDate?: string | null;
  newStatusSetDate?: string | null;
  archived?: boolean;
}

interface MarketingContent {
  id: string;
  section_key: string;
  headline: string | null;
  subheadline: string | null;
  paragraph_1: string | null;
  paragraph_2: string | null;
  paragraph_3: string | null;
  image_url: string | null;
  is_enabled: boolean;
}

interface LeadMagnetConfig {
  id: string;
  type: "READY_TO_SELL" | "WORTH_ESTIMATE";
  is_enabled: boolean;
  brand_config: {
    show_hero_button?: boolean;
  };
}
export default function PublicListings() {
  const { t } = useLocale();
  const { orgSlug } = useParams<{ orgSlug?: string }>();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState<string>('all');
  const [bedroomFilter, setBedroomFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<string>('newest');
  const [domainError, setDomainError] = useState(false);
  const [marketingContent, setMarketingContent] = useState<MarketingContent | null>(null);
  const [leadMagnets, setLeadMagnets] = useState<LeadMagnetConfig[]>([]);
  const { organization, setOrganizationBySlug } = useOrganization();
  const { organization: domainOrg, isPublicSite: isDomainBased, loading: domainLoading } = usePublicListings();
  const { enabledCategories, salesEnabled, rentalsEnabled, holidayRentalsEnabled } = usePropertyServices();
  
  const activeOrg = isDomainBased && domainOrg ? domainOrg : organization;
  const { getCopy } = useOrgContent(activeOrg?.id || null);
  
  // Clear listings when orgSlug changes to prevent showing stale data from previous tenant
  useEffect(() => {
    setListings([]);
    setLoading(true);
  }, [orgSlug]);

  useEffect(() => {
    console.log('[PublicListings] useEffect triggered, orgSlug:', orgSlug, 'domainOrg:', domainOrg?.business_name, 'isDomainBased:', isDomainBased, 'domainLoading:', domainLoading);
    
    // Priority 1: If accessing via custom domain
    if (isDomainBased) {
      // Wait for domain detection to complete
      if (domainLoading) {
        console.log('[PublicListings] Waiting for domain detection...');
        return;
      }
      
      // If domain-based but no org found, show error (don't leak other tenant's data)
      if (!domainOrg) {
        console.error('[PublicListings] Domain not configured for this hostname');
        setDomainError(true);
        setLoading(false);
        return;
      }
      
      // Use domain-based organization
      console.log('[PublicListings] Using domain-based organization:', domainOrg.business_name);
      setDomainError(false);
      fetchPublicListings(domainOrg.slug);
      return;
    }
    
    // Priority 2: Slug-based access (admin portal/main app)
    // Default to bridge-auctioneers for dev preview when no slug provided
    const effectiveSlug = orgSlug || 'bridge-auctioneers';
    
    if (effectiveSlug && !organization) {
      console.log('[PublicListings] Loading organization by slug:', effectiveSlug);
      setOrganizationBySlug(effectiveSlug);
    }
    
    console.log('[PublicListings] Fetching listings for slug-based access:', effectiveSlug);
    setDomainError(false);
    fetchPublicListings(effectiveSlug);
  }, [orgSlug, domainOrg, isDomainBased, domainLoading]);

  // Fetch marketing content and lead magnets when organization is available
  useEffect(() => {
    const fetchMarketingContent = async () => {
      const targetSlug = isDomainBased && domainOrg ? domainOrg.slug : (orgSlug || 'bridge-auctioneers');
      if (!targetSlug) return;

      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-marketing-content`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientSlug: targetSlug }),
        });

        if (!response.ok) {
          console.log('[PublicListings] Marketing content fetch failed:', response.status);
          return;
        }

        const data = await response.json();
        if (data.success && data.content) {
          // Find the sell_property section
          const sellPropertySection = data.content.find(
            (c: MarketingContent) => c.section_key === 'sell_property' && c.is_enabled
          );
          setMarketingContent(sellPropertySection || null);
          console.log('[PublicListings] Marketing content loaded:', sellPropertySection?.headline);
        }
      } catch (error) {
        console.error('[PublicListings] Error fetching marketing content:', error);
      }
    };

    const fetchLeadMagnets = async () => {
      const targetSlug = isDomainBased && domainOrg ? domainOrg.slug : (orgSlug || 'bridge-auctioneers');
      if (!targetSlug) return;

      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lead-magnet-api`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ action: 'get_config', orgSlug: targetSlug }),
        });

        if (!response.ok) {
          console.log('[PublicListings] Lead magnet config fetch failed:', response.status);
          return;
        }

        const data = await response.json();
        if (data.success && data.configs) {
          setLeadMagnets(data.configs);
          console.log('[PublicListings] Lead magnets loaded:', data.configs.length);
        }
      } catch (error) {
        console.error('[PublicListings] Error fetching lead magnets:', error);
      }
    };

    fetchMarketingContent();
    fetchLeadMagnets();
  }, [orgSlug, domainOrg, isDomainBased]);

  // Helper to check if a lead magnet hero button should be shown
  const showLeadMagnetHeroButton = (type: "READY_TO_SELL" | "WORTH_ESTIMATE") => {
    const config = leadMagnets.find(lm => lm.type === type);
    return config?.is_enabled && config?.brand_config?.show_hero_button;
  };

  const fetchPublicListings = async (slug?: string) => {
    try {
      // Use only the explicitly provided slug (no fallback to stale context)
      const clientSlug = slug || orgSlug;
      
      if (!clientSlug) {
        console.error('[PublicListings] No client slug available for fetching listings');
        setLoading(false);
        return;
      }
      
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-listings`;
      const payload = {
        clientSlug,
        filter: null,
        isPublic: true
      };
      
      console.log('[PublicListings] Fetching from URL:', url);
      console.log('[PublicListings] Payload:', payload);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify(payload)
      });
      
      console.log('[PublicListings] Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PublicListings] ❌ HTTP Error:', response.status, errorText);
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      console.log('[PublicListings] Response data:', data);
      
      if (data.success) {
        console.log('[PublicListings] ✅ Loaded', data.listings?.length || 0, 'listings');
        setListings(data.listings || []);
      } else {
        console.error('[PublicListings] ❌ Failed to load listings:', data.error || data.message);
      }
    } catch (error) {
      console.error('[PublicListings] Exception fetching listings:', error);
    } finally {
      setLoading(false);
    }
  };
  const filteredListings = listings.filter(listing => {
    // Category filter
    if (categoryFilter !== "all") {
      const listingCategory = listing.category || 'Listing';
      if (listingCategory !== categoryFilter) return false;
    }

    // Text search
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      const matchesSearch = listing.title?.toLowerCase().includes(search) || listing.addressLine1?.toLowerCase().includes(search) || listing.addressTown?.toLowerCase().includes(search) || listing.county?.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }

    // Price filter
    if (priceRange !== "all") {
      const price = typeof listing.price === 'string' ? parseFloat(listing.price) : (listing.price || 0);
      switch (priceRange) {
        case "0-200000":
          if (price >= 200000) return false;
          break;
        case "200000-400000":
          if (price < 200000 || price >= 400000) return false;
          break;
        case "400000-600000":
          if (price < 400000 || price >= 600000) return false;
          break;
        case "600000+":
          if (price < 600000) return false;
          break;
      }
    }

    // Bedroom filter
    if (bedroomFilter !== "all") {
      const bedrooms = typeof listing.bedrooms === 'string' ? parseInt(listing.bedrooms) : (listing.bedrooms || 0);
      if (bedroomFilter === "5+") {
        if (bedrooms < 5) return false;
      } else {
        const targetBedrooms = parseInt(bedroomFilter);
        if (bedrooms !== targetBedrooms) return false;
      }
    }
    return true;
  });

  // Get count by category
  const getCategoryCount = (category: string) => {
    if (category === "all") return listings.length;
    return listings.filter(l => (l.category || 'Listing') === category).length;
  };

  // Sort listings
  const sortedListings = [...filteredListings].sort((a, b) => {
    switch (sortBy) {
      case 'price-low': {
        const priceA = typeof a.price === 'string' ? parseFloat(a.price) : (a.price || 0);
        const priceB = typeof b.price === 'string' ? parseFloat(b.price) : (b.price || 0);
        return priceA - priceB;
      }
      case 'price-high': {
        const priceA = typeof a.price === 'string' ? parseFloat(a.price) : (a.price || 0);
        const priceB = typeof b.price === 'string' ? parseFloat(b.price) : (b.price || 0);
        return priceB - priceA;
      }
      case 'oldest':
        return new Date(a.datePosted).getTime() - new Date(b.datePosted).getTime();
      case 'newest':
      default:
        return new Date(b.datePosted).getTime() - new Date(a.datePosted).getTime();
    }
  });

  // Get branding colors from the active organization (domain-based or slug-based)
  const primaryColor = activeOrg?.primary_color || null;
  const secondaryColor = activeOrg?.secondary_color || null;

  return <BrandingProvider primaryColor={primaryColor} secondaryColor={secondaryColor}>
    <div className="min-h-screen bg-background flex flex-col">
      {organization?.id && <AnnouncementBar organizationId={organization.id} />}
      <SEO />
      <PublicHeader />
      <CookieConsent />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-background pt-8 sm:pt-12 pb-4 sm:pb-6">

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 text-center">
          {/* CTA Button */}
          <div className="mb-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link to={orgSlug ? `/${orgSlug}/request-valuation` : '/request-valuation'}>
              <Button size="lg" className="text-sm px-4 py-4 sm:text-2xl sm:px-12 md:text-3xl md:px-16 md:py-[19px] animate-fade-in shadow-lg h-auto w-full sm:w-auto hover:bg-primary/70 hover:shadow-xl hover:scale-110 transition-all duration-300">
                <MousePointerClick className="!h-11 !w-11" />
                {getCopy('hero_cta_button')}
              </Button>
            </Link>
            
            {/* Lead Magnet Hero Buttons */}
            {showLeadMagnetHeroButton("READY_TO_SELL") && (
              <Link to={orgSlug ? `/lead-magnet/${orgSlug}/ready-to-sell` : '/lead-magnet/ready-to-sell'}>
                <Button 
                  size="lg" 
                  className="text-sm px-4 py-3 sm:text-lg sm:px-8 animate-fade-in shadow-lg h-auto hover:bg-primary/70 hover:shadow-xl hover:scale-105 transition-all duration-300 flex flex-col items-center gap-0"
                  data-testid="button-hero-ready-to-sell"
                >
                  <span className="flex items-center">
                    <ClipboardCheck className="h-5 w-5 mr-2" />
                    Am I Ready to Sell?
                  </span>
                  <span className="text-xs opacity-80 font-normal">Take the 2 min quiz!</span>
                </Button>
              </Link>
            )}
            
            {showLeadMagnetHeroButton("WORTH_ESTIMATE") && (
              <Link to={orgSlug ? `/lead-magnet/${orgSlug}/worth-estimate` : '/lead-magnet/worth-estimate'}>
                <Button 
                  size="lg" 
                  className="text-sm px-4 py-3 sm:text-lg sm:px-8 animate-fade-in shadow-lg h-auto hover:bg-primary/70 hover:shadow-xl hover:scale-105 transition-all duration-300 flex flex-col items-center gap-0"
                  data-testid="button-hero-worth-estimate"
                >
                  <span className="flex items-center">
                    <Calculator className="h-5 w-5 mr-2" />
                    What's My Property Worth?
                  </span>
                  <span className="text-xs opacity-80 font-normal">Free estimate in 3 minutes!</span>
                </Button>
              </Link>
            )}
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 md:text-3xl">
            {getCopy('hero_headline')}
          </h1>
          
          
          {/* Search Bar */}
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
                <Input type="text" placeholder={getCopy('search_placeholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 h-12 text-base sm:text-lg" />
              </div>
              <Button variant="outline" size="lg" onClick={() => setShowFilters(!showFilters)} className="gap-2 w-full sm:w-auto">
                <SlidersHorizontal className="h-5 w-5" />
                {getCopy('filters_button')}
              </Button>
            </div>

            {/* Advanced Filters */}
            {showFilters && <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-card rounded-lg border">
                <Select value={priceRange} onValueChange={setPriceRange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('listings.filters.priceRange')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('listings.filters.allPrices')}</SelectItem>
                    <SelectItem value="0-200000">{t('listings.filters.price0to200k')}</SelectItem>
                    <SelectItem value="200000-400000">{t('listings.filters.price200kto400k')}</SelectItem>
                    <SelectItem value="400000-600000">{t('listings.filters.price400kto600k')}</SelectItem>
                    <SelectItem value="600000+">{t('listings.filters.price600kPlus')}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={bedroomFilter} onValueChange={setBedroomFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('listings.filters.bedrooms')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('listings.filters.allBedrooms')}</SelectItem>
                    <SelectItem value="1">{t('listings.filters.bedroom1')}</SelectItem>
                    <SelectItem value="2">{t('listings.filters.bedrooms2')}</SelectItem>
                    <SelectItem value="3">{t('listings.filters.bedrooms3')}</SelectItem>
                    <SelectItem value="4">{t('listings.filters.bedrooms4')}</SelectItem>
                    <SelectItem value="5+">{t('listings.filters.bedrooms5Plus')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>}
          </div>
        </div>
      </section>

      {/* Category Tabs - Only show if more than one service is enabled */}
      {enabledCategories.length > 1 && (
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 pt-4">
          <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
            <TabsList className="w-full h-auto flex-wrap gap-1 justify-center p-1 bg-muted/50">
              <TabsTrigger value="all" className="text-sm px-4 py-2 whitespace-nowrap" data-testid="tab-public-category-all">
                All Properties <span className="ml-1 text-muted-foreground">({getCategoryCount("all")})</span>
              </TabsTrigger>
              {salesEnabled && (
                <TabsTrigger value="Listing" className="text-sm px-4 py-2 whitespace-nowrap" data-testid="tab-public-category-sales">
                  <Home className="h-4 w-4 mr-1" />
                  For Sale <span className="ml-1 text-muted-foreground">({getCategoryCount("Listing")})</span>
                </TabsTrigger>
              )}
              {rentalsEnabled && (
                <TabsTrigger value="Rental" className="text-sm px-4 py-2 whitespace-nowrap" data-testid="tab-public-category-rentals">
                  <Key className="h-4 w-4 mr-1" />
                  To Let <span className="ml-1 text-muted-foreground">({getCategoryCount("Rental")})</span>
                </TabsTrigger>
              )}
              {holidayRentalsEnabled && (
                <TabsTrigger value="Holiday Rental" className="text-sm px-4 py-2 whitespace-nowrap" data-testid="tab-public-category-holiday">
                  <Palmtree className="h-4 w-4 mr-1" />
                  Holiday Rentals <span className="ml-1 text-muted-foreground">({getCategoryCount("Holiday Rental")})</span>
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </section>
      )}

      {/* Listings Grid */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 pt-2 sm:pt-4 pb-6 sm:pb-8">

        {domainError ? <div className="text-center py-16">
            <h3 className="text-2xl font-semibold mb-2">{t('listings.public.domainNotConfigured')}</h3>
            <p className="text-lg text-muted-foreground mb-6">
              {t('listings.public.domainNotConfiguredDescription')}
            </p>
          </div> : loading ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-96" />)}
          </div> : filteredListings.length === 0 ? <div className="text-center py-16">
            <h3 className="text-2xl font-semibold mb-2">{t('listings.public.noPropertiesFound')}</h3>
            <p className="text-lg text-muted-foreground mb-6">
              {t('listings.public.tryAdjustingSearch')}
            </p>
            <Button onClick={() => {
          setSearchQuery('');
          setPriceRange('all');
          setBedroomFilter('all');
          setCategoryFilter('all');
        }}>
              {t('listings.filters.clear')}
            </Button>
          </div> : <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <p className="text-base sm:text-lg text-muted-foreground">
                {t('listings.public.propertiesAvailable', { count: filteredListings.length })}
              </p>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={t('listings.sort.label')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t('listings.sort.newest')}</SelectItem>
                  <SelectItem value="oldest">{t('listings.sort.oldest')}</SelectItem>
                  <SelectItem value="price-low">{t('listings.sort.priceLow')}</SelectItem>
                  <SelectItem value="price-high">{t('listings.sort.priceHigh')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedListings.map(listing => 
                <ListingCard 
                  key={listing.id}
                  listing={listing} 
                  onStatusChange={() => {}} 
                  onArchive={() => {}} 
                  onDelete={() => {}} 
                  isPublicView={true}
                  orgSlug={isDomainBased && domainOrg ? domainOrg.slug : (orgSlug || 'bridge-auctioneers')}
                  organizationDomain={isDomainBased && domainOrg ? domainOrg.domain : undefined}
                />
              )}
            </div>
          </>}
      </section>

      {/* Property Alerts Section */}
      <section className="bg-gradient-to-br from-accent/10 via-background to-accent/5 py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 animate-fade-in">
            {getCopy('alerts_headline')}
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground mb-8 max-w-2xl mx-auto animate-fade-in">
            {getCopy('alerts_description')}
          </p>
          <PropertyAlertDialog 
            orgSlug={isDomainBased && domainOrg ? domainOrg.slug : (orgSlug || organization?.slug)}
            trigger={<Button size="lg" className="animate-fade-in hover:scale-105 transition-transform">
                {getCopy('alerts_button')}
              </Button>} />
        </div>
      </section>

      {/* Why [Organization] Section */}
      <section className="py-12 sm:py-16 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="order-2 md:order-1">
              <h2 className="text-4xl font-bold mb-10 sm:text-4xl">
                {marketingContent?.headline 
                  ? marketingContent.headline.replace('{organization}', organization?.business_name || 'Us')
                  : `Sell For The Best Price Faster & Easier With ${organization?.business_name || 'Us'}!`}
              </h2>
              <p className="text-lg text-muted-foreground">
                {marketingContent?.paragraph_1 
                  ? marketingContent.paragraph_1.replace(/{organization}/g, organization?.business_name || 'us')
                  : `When you sell with ${organization?.business_name || 'us'}, you're not just listing your home, you're tapping into one of the most powerful buyer networks in the region.`}
                {(marketingContent?.paragraph_2 || !marketingContent) && (
                  <>
                    <br /><br />
                    {marketingContent?.paragraph_2 
                      ? marketingContent.paragraph_2.replace(/{organization}/g, organization?.business_name || 'us')
                      : 'Our forward-thinking use of technology and unrivalled social media reach mean your property gets attention fast.'}
                  </>
                )}
                {(marketingContent?.paragraph_3 || !marketingContent) && (
                  <>
                    <br /><br />
                    {marketingContent?.paragraph_3 
                      ? marketingContent.paragraph_3.replace(/{organization}/g, organization?.business_name || 'us')
                      : 'We make the process smooth, efficient, and rewarding from start to sold.'}
                  </>
                )}
              </p>
            </div>
            <div className="order-1 md:order-2">
              <img 
                src={marketingContent?.image_url || premiumHouse} 
                alt="Premium luxury house with modern architecture" 
                className="rounded-lg shadow-xl w-full h-auto" 
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-muted py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 text-center">
          <h2 className="text-3xl font-bold mb-4">{getCopy('valuation_headline')}</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            {getCopy('valuation_description')}
          </p>
          <Link to={orgSlug ? `/${orgSlug}/request-valuation` : '/request-valuation'}>
            <Button size="lg">{getCopy('valuation_button')}</Button>
          </Link>
        </div>
      </section>

      <ReviewsSection organizationSlug={isDomainBased && domainOrg ? domainOrg.slug : (orgSlug || organization?.slug)} />

      <Footer />
      
      <AIAssistantWidget />
    </div>
  </BrandingProvider>;
}