import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrganizationView } from '@/contexts/OrganizationViewContext';
import { useDisplayListings } from '@/hooks/useDisplayListings';
import type { DisplayListing, DisplayOrganization, DisplaySignageConfig } from '@/lib/display-signage/types';
import { DEFAULT_DISPLAY_CONFIG } from '@/lib/display-signage/types';
import { X, Play, Monitor } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getLogosForLocale } from '@/lib/brochure/certificationLogos';
import { useDisplayAnalytics } from '@/hooks/useDisplayAnalytics';
import { getRegionConfig } from '@/lib/regionConfig';
import type { SupportedLocale } from '@/lib/i18n';

// ── Status badge colors ──────────────────────────────────────────────

const STATUS_BADGE_COLORS: Record<string, string> = {
  'New': '#16a34a',
  'Sale Agreed': '#d97706',
  'Let Agreed': '#d97706',
  'Sold': '#dc2626',
};

function getStatusBadge(status: string | null) {
  if (!status || status === 'Published') return null;
  return {
    label: status,
    color: STATUS_BADGE_COLORS[status] || '#6b7280',
  };
}

// ── Price formatting ─────────────────────────────────────────────────

function formatDisplayPrice(
  price: number,
  locale: string | null,
  currency: string | null,
  category: string | null,
): string {
  if (price === 0) return 'Price on Application';
  let formatted: string;
  try {
    formatted = new Intl.NumberFormat(locale || 'en-IE', {
      style: 'currency',
      currency: currency || 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    const currencySymbols: Record<string, string> = { EUR: '\u20AC', GBP: '\u00A3', USD: '$', CAD: 'C$', AUD: 'A$', NZD: 'NZ$' };
    const sym = currencySymbols[currency || 'EUR'] || currency || '\u20AC';
    formatted = `${sym}${price.toLocaleString()}`;
  }
  if (category === 'Rental') return `${formatted} /month`;
  if (category === 'Holiday Rental') return `${formatted} /night`;
  return formatted;
}

// ── Type-aware property details builder ──────────────────────────────

function buildPropertyDetails(
  listing: DisplayListing,
  config: DisplaySignageConfig,
  locale: string | null,
): { details: string[]; showBer: boolean } {
  const measurements = getRegionConfig((locale || 'en-IE') as SupportedLocale).property.measurements;
  const isLand = listing.building_type === 'Land';
  const isCommercial = listing.building_type === 'Commercial';
  const details: string[] = [];

  if (isLand) {
    if (config.show_land_size && listing.land_size) {
      const converted = measurements.convertFromAcres(listing.land_size);
      const formatted = converted % 1 === 0 ? converted.toString() : converted.toFixed(2);
      details.push(`${formatted} ${measurements.landSymbol}`);
    }
    if (listing.building_type) details.push(listing.building_type);
    return { details, showBer: false };
  }

  if (isCommercial) {
    if (listing.floor_area_size) {
      details.push(`${listing.floor_area_size.toLocaleString()} ${measurements.areaSymbol}`);
    }
    if (listing.building_type) details.push(listing.building_type);
    return { details, showBer: true };
  }

  // Residential
  if (config.show_bedrooms_bathrooms) {
    if (listing.bedrooms) details.push(`${listing.bedrooms} Bed`);
    if (listing.bathrooms) details.push(`${listing.bathrooms} Bath`);
    if (listing.ensuite) details.push(`${listing.ensuite} Ensuite`);
  }
  if (listing.building_type) details.push(listing.building_type);
  if (listing.floor_area_size) {
    details.push(`${listing.floor_area_size.toLocaleString()} ${measurements.areaSymbol}`);
  }
  if (listing.furnished && (listing.category === 'Rental' || listing.category === 'Holiday Rental')) {
    details.push(listing.furnished);
  }
  return { details, showBer: true };
}

// ── Description excerpt helper ──────────────────────────────────────

function getDescriptionExcerpt(description: string | null, maxChars = 150): string | null {
  if (!description) return null;
  const firstParagraph = description.split(/\n\n|\r\n\r\n/)[0].trim();
  if (firstParagraph.length <= maxChars) return firstParagraph;
  const truncated = firstParagraph.substring(0, maxChars);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated) + '...';
}

// ── Slide component ──────────────────────────────────────────────────

function DisplaySlide({
  listing,
  organization,
  config,
  slideNumber,
  totalSlides,
  orientation,
  activePhotoUrl,
}: {
  listing: DisplayListing;
  organization: DisplayOrganization;
  config: DisplaySignageConfig;
  slideNumber: number;
  totalSlides: number;
  orientation: 'landscape' | 'portrait';
  activePhotoUrl?: string | null;
}) {
  const primaryColor = organization.primary_color || '#1e3a5f';
  const secondaryColor = organization.secondary_color || '#f0f4f8';
  const badge = getStatusBadge(listing.status);
  const displayPhoto = activePhotoUrl ?? listing.hero_photo;
  const qrUrl = config.show_qr_code && organization.domain
    ? `https://${organization.domain}/property/${listing.id}`
    : null;

  const location = [listing.address_town, listing.county].filter(Boolean).join(', ');
  const { details, showBer } = buildPropertyDetails(listing, config, organization.locale);

  const statusBadge = badge && (
    <div
      className="absolute top-6 left-6 px-6 py-2 rounded-full text-white font-bold uppercase tracking-wider"
      style={{ backgroundColor: badge.color, fontSize: '1.2rem' }}
    >
      {badge.label}
    </div>
  );

  // Count visible detail rows for dynamic font scaling (2.6)
  const hasDescription = config.show_description && !!listing.description;
  const visibleDetailCount = [
    config.show_logo_on_slide && !!organization.logo_url,
    config.show_price && listing.price !== null,
    details.length > 0,
    hasDescription,
    showBer && config.show_ber_rating && listing.ber_rating && listing.ber_rating !== 'EXEMPT',
    config.show_address && location,
  ].filter(Boolean).length;

  // Scale up fonts when fewer details are visible (2.6)
  const fontScale = visibleDetailCount <= 2 ? 1.2 : visibleDetailCount <= 3 ? 1.1 : 1;

  const detailsContent = (
    <>
      {config.show_logo_on_slide && organization.logo_url && (
        <img
          src={organization.logo_url}
          alt={organization.business_name}
          className="object-contain"
          style={{
            height: 'clamp(2rem, 4vh, 3rem)',
            maxWidth: '12rem',
            opacity: 0.9,
          }}
        />
      )}
      <h1 className="font-bold leading-tight line-clamp-2 text-white" style={{
        fontSize: orientation === 'portrait'
          ? `clamp(1.8rem, ${4 * fontScale}vh, ${3 * fontScale}rem)`
          : `clamp(1.8rem, ${3.5 * fontScale}vw, ${3.5 * fontScale}rem)`,
      }}>
        {listing.title || 'Property'}
      </h1>
      {config.show_price && listing.price !== null && (
        <p className="font-bold" style={{
          fontSize: orientation === 'portrait'
            ? `clamp(2rem, ${5 * fontScale}vh, ${3.5 * fontScale}rem)`
            : `clamp(2rem, ${4 * fontScale}vw, ${4 * fontScale}rem)`,
          color: secondaryColor,
        }}>
          {formatDisplayPrice(listing.price, organization.locale, organization.currency, listing.category)}
        </p>
      )}
      {details.length > 0 && (
        <p className="text-white/70" style={{
          fontSize: orientation === 'portrait'
            ? `clamp(1rem, ${2.5 * fontScale}vh, ${1.6 * fontScale}rem)`
            : `clamp(1rem, ${1.5 * fontScale}vw, ${1.6 * fontScale}rem)`,
        }}>
          {details.join('  \u00b7  ')}
        </p>
      )}
      {hasDescription && (
        <p className="text-white/60 italic leading-snug" style={{
          fontSize: orientation === 'portrait'
            ? `clamp(0.8rem, ${1.8 * fontScale}vh, ${1.1 * fontScale}rem)`
            : `clamp(0.8rem, ${1 * fontScale}vw, ${1.1 * fontScale}rem)`,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {getDescriptionExcerpt(listing.description)}
        </p>
      )}
      {showBer && config.show_ber_rating && listing.ber_rating && listing.ber_rating !== 'EXEMPT' && (
        <p className="text-white/70" style={{
          fontSize: orientation === 'portrait'
            ? `clamp(0.9rem, ${2 * fontScale}vh, ${1.3 * fontScale}rem)`
            : `clamp(0.9rem, ${1.2 * fontScale}vw, ${1.4 * fontScale}rem)`,
        }}>
          BER: {listing.ber_rating}
        </p>
      )}
      {config.show_address && location && (
        <p className="text-white/70" style={{
          fontSize: orientation === 'portrait'
            ? `clamp(1rem, ${2.5 * fontScale}vh, ${1.6 * fontScale}rem)`
            : `clamp(1rem, ${1.5 * fontScale}vw, ${1.6 * fontScale}rem)`,
        }}>
          {location}
        </p>
      )}
    </>
  );

  const theme = config.display_theme || 'classic';

  // ── Modern theme: full-bleed photo with overlay text ──────────────
  if (theme === 'modern') {
    return (
      <div className="h-full w-full relative">
        <HeroImage
          src={displayPhoto}
          alt={listing.title || 'Property'}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
        />
        {statusBadge}
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        {/* Text overlaid at bottom */}
        <div className="absolute inset-x-0 bottom-0 p-8 flex flex-col gap-2" style={{ paddingBottom: '6rem' }}>
          {detailsContent}
        </div>
        {qrUrl && (
          <div className="absolute top-6 right-6 p-2 bg-white rounded-lg shadow-lg">
            <QRCodeSVG value={qrUrl} size={80} />
          </div>
        )}
        {/* Branding bar fixed at bottom */}
        <div className="absolute inset-x-0 bottom-0">
          <BrandingBar
            organization={organization}
            config={config}
            primaryColor={primaryColor}
            slideNumber={slideNumber}
            totalSlides={totalSlides}
            compact={orientation === 'portrait'}
          />
        </div>
      </div>
    );
  }

  // ── Minimal theme: centered card layout ───────────────────────────
  if (theme === 'minimal') {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center" style={{ padding: '4vh 4vw', backgroundColor: '#111' }}>
        <div className="flex-1 flex items-center justify-center w-full max-w-5xl">
          <div className={`flex ${orientation === 'portrait' ? 'flex-col' : 'flex-row'} gap-8 items-center w-full`}>
            {/* Photo — constrained and centered */}
            <div className="relative rounded-xl overflow-hidden" style={{
              width: orientation === 'portrait' ? '100%' : '60%',
              aspectRatio: orientation === 'portrait' ? '4/3' : '16/10',
            }}>
              <HeroImage
                src={displayPhoto}
                alt={listing.title || 'Property'}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
              />
              {statusBadge}
            </div>
            {/* Details — clean typography */}
            <div className="flex flex-col gap-3" style={{ width: orientation === 'portrait' ? '100%' : '40%' }}>
              {detailsContent}
              {qrUrl && (
                <div className="mt-2">
                  <div className="inline-block p-2 bg-white rounded-lg">
                    <QRCodeSVG value={qrUrl} size={80} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <BrandingBar
          organization={organization}
          config={config}
          primaryColor={primaryColor}
          slideNumber={slideNumber}
          totalSlides={totalSlides}
          compact={orientation === 'portrait'}
        />
      </div>
    );
  }

  // ── Classic theme (default) ───────────────────────────────────────

  if (orientation === 'portrait') {
    return (
      <div className="h-full w-full flex flex-col" style={{ padding: '3vh 3vw' }}>
        {/* Hero photo — 60% */}
        <div className="relative flex-[6] rounded-2xl overflow-hidden">
          <HeroImage
            src={displayPhoto}
            alt={listing.title || 'Property'}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
          />
          {statusBadge}
          {qrUrl && (
            <div className="absolute bottom-4 right-4 p-2 bg-white rounded-lg shadow-lg">
              <QRCodeSVG value={qrUrl} size={80} />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/50 to-transparent" />
        </div>

        {/* Details — 30% (dark theme for TV readability) */}
        <div
          className="flex-[3] flex flex-col justify-center px-6 py-6 gap-3 rounded-xl"
          style={{ backgroundColor: `${primaryColor}18` }}
        >
          {detailsContent}
        </div>

        {/* Branding bar — 10% */}
        <BrandingBar
          organization={organization}
          config={config}
          primaryColor={primaryColor}
          slideNumber={slideNumber}
          totalSlides={totalSlides}
          compact
        />
      </div>
    );
  }

  // Classic landscape layout
  return (
    <div className="h-full w-full flex flex-col" style={{ padding: '3vh 3vw' }}>
      <div className="flex-1 flex gap-6 min-h-0">
        {/* Hero photo — 70% */}
        <div className="relative flex-[7] rounded-2xl overflow-hidden">
          <HeroImage
            src={displayPhoto}
            alt={listing.title || 'Property'}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
          />
          {statusBadge}
          <div className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-black/30 to-transparent" />
        </div>

        {/* Details panel — 30% (dark theme for TV readability) */}
        <div
          className="flex-[3] flex flex-col justify-center gap-4 px-6 rounded-xl"
          style={{ backgroundColor: `${primaryColor}18` }}
        >
          {detailsContent}
          {qrUrl && (
            <div className="flex justify-center mt-2">
              <div className="p-2 bg-white rounded-lg">
                <QRCodeSVG value={qrUrl} size={96} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Branding bar */}
      <BrandingBar
        organization={organization}
        config={config}
        primaryColor={primaryColor}
        slideNumber={slideNumber}
        totalSlides={totalSlides}
      />
    </div>
  );
}

// ── Hero image with loading state ────────────────────────────────────

function HeroImage({
  src,
  alt,
  primaryColor,
  secondaryColor,
}: {
  src: string | null;
  alt: string;
  primaryColor: string;
  secondaryColor: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const prevSrc = useRef(src);

  // Reset loaded state when src changes
  useEffect(() => {
    if (src !== prevSrc.current) {
      setLoaded(false);
      prevSrc.current = src;
    }
  }, [src]);

  if (!src) {
    return (
      <div
        className="w-full h-full"
        style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
      />
    );
  }

  return (
    <>
      {!loaded && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{ background: `linear-gradient(135deg, ${primaryColor}40, ${secondaryColor}40)` }}
        />
      )}
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        style={{
          opacity: loaded ? 1 : 0,
          transition: 'opacity 300ms ease',
          animation: loaded ? 'kenBurns 20s ease-in-out infinite alternate' : undefined,
          transformOrigin: 'center center',
        }}
        onLoad={() => setLoaded(true)}
      />
    </>
  );
}

// ── Branding bar ─────────────────────────────────────────────────────

function BrandingBar({
  organization,
  config,
  primaryColor,
  slideNumber,
  totalSlides,
  compact,
}: {
  organization: DisplayOrganization;
  config: DisplaySignageConfig;
  primaryColor: string;
  slideNumber: number;
  totalSlides: number;
  compact?: boolean;
}) {
  const certLogos = getLogosForLocale(organization.locale || 'en-IE')
    .filter(logo => logo.url);

  return (
    <div
      className="flex items-center justify-between rounded-xl px-6"
      style={{
        backgroundColor: primaryColor,
        color: '#ffffff',
        minHeight: compact ? '4rem' : '5rem',
        fontSize: compact ? 'clamp(0.8rem, 1.5vh, 1.1rem)' : 'clamp(0.9rem, 1.2vw, 1.3rem)',
      }}
    >
      <div className="flex items-center gap-4">
        {organization.logo_url && (
          <img
            src={organization.logo_url}
            alt={organization.business_name}
            className="object-contain"
            style={{ height: compact ? '2.5rem' : '3rem', maxWidth: '10rem' }}
          />
        )}
        <span className="font-semibold">{organization.business_name}</span>
        {certLogos.length > 0 && (
          <div className="flex items-center gap-2 ml-2 opacity-80">
            {certLogos.map(logo => (
              <img
                key={logo.id}
                src={logo.url}
                alt={logo.name}
                title={logo.description}
                className="object-contain"
                style={{ height: compact ? '1.5rem' : '2rem' }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-6">
        {config.show_contact_info && organization.domain && (
          <span className="font-medium">{organization.domain}</span>
        )}
        {config.show_contact_info && organization.contact_phone && (
          <span>{organization.contact_phone}</span>
        )}
        {config.show_contact_info && organization.psr_licence_number && (
          <span className="opacity-75">PSRA: {organization.psr_licence_number}</span>
        )}
        {totalSlides > 1 && (
          <span className="opacity-75">{slideNumber} / {totalSlides}</span>
        )}
      </div>
    </div>
  );
}

// ── Progress bar ─────────────────────────────────────────────────────

function SlideProgressBar({
  durationSeconds,
  slideKey,
  primaryColor,
}: {
  durationSeconds: number;
  slideKey: number;
  primaryColor: string;
}) {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10 z-10">
      <div
        key={slideKey}
        className="h-full"
        style={{
          backgroundColor: primaryColor,
          opacity: 0.6,
          animation: `slideProgress ${durationSeconds}s linear`,
        }}
      />
      <style>{`
        @keyframes slideProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}

// ── Clock overlay (4.4) ──────────────────────────────────────────────

function ClockOverlay() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="absolute top-4 left-4 z-10 px-4 py-2 rounded-lg bg-black/40 text-white font-medium backdrop-blur-sm"
      style={{ fontSize: 'clamp(0.9rem, 1.5vw, 1.4rem)' }}
    >
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      <span className="ml-3 opacity-70">
        {time.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}
      </span>
    </div>
  );
}

// ── Custom banner (4.2) ─────────────────────────────────────────────

function CustomBanner({ message, primaryColor }: { message: string; primaryColor: string }) {
  return (
    <div
      className="absolute top-0 left-0 right-0 z-10 text-center text-white font-bold py-3 px-6"
      style={{
        backgroundColor: primaryColor,
        fontSize: 'clamp(1rem, 2vw, 1.8rem)',
        textShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }}
    >
      {message}
    </div>
  );
}

// ── Start screen ─────────────────────────────────────────────────────

function StartScreen({
  organization,
  listingCount,
  onStart,
}: {
  organization: DisplayOrganization | null;
  listingCount: number;
  onStart: () => void;
}) {
  const primaryColor = organization?.primary_color || '#1e3a5f';
  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center gap-8"
      style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}
    >
      {organization?.logo_url && (
        <img src={organization.logo_url} alt="" className="h-20 object-contain" />
      )}
      <h1 className="text-white font-bold text-center" style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)' }}>
        {organization?.business_name || 'Shop Window Display'}
      </h1>
      <p className="text-white/70" style={{ fontSize: 'clamp(1rem, 2vw, 1.4rem)' }}>
        {listingCount} {listingCount === 1 ? 'listing' : 'listings'} ready to display
      </p>
      <button
        onClick={onStart}
        className="flex items-center gap-3 px-8 py-4 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-colors"
        style={{ fontSize: 'clamp(1.1rem, 2vw, 1.4rem)' }}
      >
        <Play className="h-6 w-6" />
        Start Fullscreen Display
      </button>
      <p className="text-white/50 text-sm">
        Press F11 or use the button above for fullscreen
      </p>
    </div>
  );
}

// ── Coming Soon screen ───────────────────────────────────────────────

function ComingSoonScreen({ organization }: { organization: DisplayOrganization | null }) {
  const primaryColor = organization?.primary_color || '#1e3a5f';
  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center gap-8"
      style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` }}
    >
      {organization?.logo_url && (
        <img src={organization.logo_url} alt="" className="h-24 object-contain" />
      )}
      <h1 className="text-white font-bold" style={{ fontSize: 'clamp(2rem, 5vw, 4rem)' }}>
        {organization?.business_name || 'Properties'}
      </h1>
      <p className="text-white/80" style={{ fontSize: 'clamp(1.2rem, 2.5vw, 2rem)' }}>
        New listings coming soon
      </p>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Monitor className="h-12 w-12 text-muted-foreground animate-pulse" />
        <div className="text-xl text-muted-foreground">Loading display...</div>
      </div>
    </div>
  );
}

// ── Main display component ───────────────────────────────────────────

export default function ShopWindowDisplay() {
  const [searchParams] = useSearchParams();
  const displayId = searchParams.get('display') || undefined;
  const { organization, loading: orgLoading } = useOrganization();
  const { selectedOrganization, isOrganizationView } = useOrganizationView();

  const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;
  const orgId = targetOrg?.id;

  const { data, isLoading } = useDisplayListings(orgId, displayId);

  const config = data?.config || DEFAULT_DISPLAY_CONFIG;
  const listings = data?.listings || [];
  const displayOrg = data?.organization || null;

  // Display analytics (5.2)
  const { recordSlideView, flush: flushAnalytics } = useDisplayAnalytics(orgId, config);

  const [displayStarted, setDisplayStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Start display with fullscreen ──────────────────────────────────

  const handleStart = useCallback(() => {
    setDisplayStarted(true);
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen().catch(() => {
        // Fullscreen denied — display still works without it
      });
    }
  }, []);

  // ── Track fullscreen state ─────────────────────────────────────────

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    handleFullscreenChange(); // sync initial state
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // ── Determine orientation ──────────────────────────────────────────

  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  useEffect(() => {
    const detect = () => {
      if (config.orientation && config.orientation !== 'auto') {
        setOrientation(config.orientation);
      } else {
        setOrientation(window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait');
      }
    };
    detect();
    window.addEventListener('resize', detect);
    return () => window.removeEventListener('resize', detect);
  }, [config.orientation]);

  // ── Record analytics when current listing changes (5.2) ────────────

  useEffect(() => {
    if (!displayStarted || !listings[currentIndex]) return;
    recordSlideView(listings[currentIndex].id, orientation);
  }, [displayStarted, currentIndex, listings, orientation, recordSlideView]);

  // Flush analytics on unmount
  useEffect(() => {
    return () => flushAnalytics(orientation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-advance slides (double-buffer crossfade) ──────────────────

  useEffect(() => {
    if (!displayStarted || listings.length <= 1) return;
    const duration = (config.slide_duration_seconds || 10) * 1000;

    const interval = setInterval(() => {
      setIsTransitioning(true);
      setPreviousIndex(currentIndex);
      setCurrentIndex(prev => (prev + 1) % listings.length);

      // Clear transition after animation completes
      setTimeout(() => {
        setIsTransitioning(false);
        setPreviousIndex(null);
      }, 800);
    }, duration);

    return () => clearInterval(interval);
  }, [displayStarted, listings.length, config.slide_duration_seconds, currentIndex]);

  // ── Multi-photo cycling within each listing (4.1) ──────────────────

  const photosPerListing = config.photos_per_listing || 1;
  const currentPhotos = (() => {
    if (photosPerListing <= 1 || !listings[currentIndex]) return null;
    const listing = listings[currentIndex];
    const allPhotos = [listing.hero_photo, ...(listing.photos || [])].filter(Boolean) as string[];
    return allPhotos.slice(0, photosPerListing);
  })();

  useEffect(() => {
    if (!displayStarted || !currentPhotos || currentPhotos.length <= 1) return;
    setPhotoIndex(0);
    const photoDuration = ((config.slide_duration_seconds || 10) * 1000) / currentPhotos.length;

    const timer = setInterval(() => {
      setPhotoIndex(prev => (prev + 1) % currentPhotos.length);
    }, photoDuration);

    return () => clearInterval(timer);
  }, [displayStarted, currentIndex, currentPhotos?.length, config.slide_duration_seconds]);

  const activePhotoUrl = currentPhotos && currentPhotos.length > 1
    ? currentPhotos[photoIndex % currentPhotos.length]
    : undefined;

  // ── Reset index when listings change ───────────────────────────────

  useEffect(() => {
    setCurrentIndex(0);
    setPreviousIndex(null);
    setIsTransitioning(false);
    setPhotoIndex(0);
  }, [listings.length]);

  // ── Preload next image ─────────────────────────────────────────────

  useEffect(() => {
    if (listings.length <= 1) return;
    const nextIndex = (currentIndex + 1) % listings.length;
    const nextPhoto = listings[nextIndex]?.hero_photo;
    if (nextPhoto) {
      const img = new window.Image();
      img.src = nextPhoto;
    }
  }, [currentIndex, listings]);

  // ── Screen Wake Lock ───────────────────────────────────────────────

  useEffect(() => {
    if (!displayStarted) return;
    let wakeLock: WakeLockSentinel | null = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch {
        // Wake Lock not supported or failed
      }
    };
    requestWakeLock();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      wakeLock?.release();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [displayStarted]);

  // ── Auto-hide cursor & show controls on mouse move ─────────────────

  useEffect(() => {
    if (!displayStarted) return;
    let cursorTimer: ReturnType<typeof setTimeout>;
    const hideCursor = () => { document.body.style.cursor = 'none'; };
    const handleMouseMove = () => {
      document.body.style.cursor = 'default';
      setShowControls(true);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
      clearTimeout(cursorTimer);
      cursorTimer = setTimeout(hideCursor, 3000);
    };
    document.addEventListener('mousemove', handleMouseMove);
    cursorTimer = setTimeout(hideCursor, 3000);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(cursorTimer);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      document.body.style.cursor = 'default';
    };
  }, [displayStarted]);

  // ── Exit handler ───────────────────────────────────────────────────

  const handleExit = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    window.history.back();
  }, []);

  // ── Keyboard: ESC exits only when NOT in fullscreen ────────────────
  // When in fullscreen, the browser handles ESC to exit fullscreen.
  // We only navigate back on ESC when already out of fullscreen.

  useEffect(() => {
    if (!displayStarted) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        handleExit();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [displayStarted, handleExit]);

  // ── Loading state ──────────────────────────────────────────────────

  if (orgLoading || isLoading) return <LoadingScreen />;

  // No listings
  if (listings.length === 0) return <ComingSoonScreen organization={displayOrg} />;

  // Start screen — requires user click for fullscreen
  if (!displayStarted) {
    return (
      <StartScreen
        organization={displayOrg}
        listingCount={listings.length}
        onStart={handleStart}
      />
    );
  }

  const currentListing = listings[currentIndex];
  if (!displayOrg || !currentListing) return <ComingSoonScreen organization={displayOrg} />;

  const previousListing = previousIndex !== null ? listings[previousIndex] : null;
  const primaryColor = displayOrg?.primary_color || '#1e3a5f';

  return (
    <div className="h-screen w-screen overflow-hidden bg-black relative select-none">
      {/* Custom banner overlay (4.2) */}
      {config.custom_message && (
        <CustomBanner message={config.custom_message} primaryColor={primaryColor} />
      )}

      {/* Clock overlay (4.4) */}
      {config.show_clock && <ClockOverlay />}

      {/* Previous slide (fading out behind) */}
      {isTransitioning && previousListing && (
        <div
          className="absolute inset-0 z-0"
          style={{
            opacity: 0,
            transition: 'opacity 800ms ease-in-out',
          }}
        >
          <DisplaySlide
            listing={previousListing}
            organization={displayOrg!}
            config={config}
            slideNumber={(previousIndex ?? 0) + 1}
            totalSlides={listings.length}
            orientation={orientation}
          />
        </div>
      )}

      {/* Current slide (fading in on top) */}
      <div
        className="absolute inset-0 z-1"
        style={{
          opacity: isTransitioning ? 0 : 1,
          transition: 'opacity 800ms ease-in-out',
          animation: isTransitioning ? 'fadeIn 800ms ease-in-out forwards' : undefined,
        }}
      >
        <DisplaySlide
          listing={currentListing}
          organization={displayOrg!}
          config={config}
          slideNumber={currentIndex + 1}
          totalSlides={listings.length}
          orientation={orientation}
          activePhotoUrl={activePhotoUrl}
        />
      </div>

      {/* Progress bar */}
      {listings.length > 1 && (
        <SlideProgressBar
          durationSeconds={config.slide_duration_seconds || 10}
          slideKey={currentIndex}
          primaryColor={primaryColor}
        />
      )}

      {/* Exit button — fades in on mouse move */}
      <button
        onClick={handleExit}
        className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all"
        style={{
          opacity: showControls ? 0.8 : 0,
          pointerEvents: showControls ? 'auto' : 'none',
          transition: 'opacity 300ms ease',
        }}
        title="Exit display"
      >
        <X className="h-6 w-6" />
      </button>

      {/* CSS for crossfade animation */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes kenBurns {
          0% { transform: scale(1) translate(0, 0); }
          100% { transform: scale(1.08) translate(-1%, -1%); }
        }
      `}</style>
    </div>
  );
}
