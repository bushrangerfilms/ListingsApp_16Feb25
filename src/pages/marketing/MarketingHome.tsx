import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { SEO } from '@/components/SEO';
import { getSignupUrl } from '@/lib/appUrls';
import { useQuery } from '@tanstack/react-query';
import { getPlanDefinitions } from '@/lib/billing/billingClient';
import { formatPrice, estimatePrice, type SupportedCurrency } from '@/lib/billing/pricing';
import { useLocale } from '@/hooks/useLocale';
import { getRegionConfig } from '@/lib/locale/config';
import {
  ArrowRight,
  Check,
  Play,
  Video,
  Calendar,
  Share2,
  Users,
  Home,
  Sparkles,
  X,
} from 'lucide-react';
import { GuidanceVideoLink } from '@/components/ui/GuidanceVideoLink';

const DEMO_VIDEO_URL = 'https://sjcfcxjpukgeaxxkffpq.supabase.co/storage/v1/object/public/public-assets/pilot-program-demo.mp4';
const DEMO_THUMBNAIL_URL = 'https://sjcfcxjpukgeaxxkffpq.supabase.co/storage/v1/object/public/public-assets/video-thumbnail.png';

const VIDEO_STYLE_SAMPLES: Array<{
  label: string;
  url: string;
  orientation: 'landscape' | 'portrait';
}> = [
  {
    label: 'Style 1',
    url: 'https://sjcfcxjpukgeaxxkffpq.supabase.co/storage/v1/object/public/real-estate-videos/c4db7362-9f98-4417-a393-289673638781_16x9_1769525532206.mp4',
    orientation: 'landscape',
  },
  {
    label: 'Style 4',
    url: 'https://sjcfcxjpukgeaxxkffpq.supabase.co/storage/v1/object/public/video-style2/sessions/e63b1f0b-c7bf-4426-b315-8b651de0f399/renders/final_20feb986-5c48-46eb-afe2-f063dd1fa3d0.mp4',
    orientation: 'landscape',
  },
  {
    label: 'Style 2',
    url: 'https://sjcfcxjpukgeaxxkffpq.supabase.co/storage/v1/object/public/video-style2/sessions/532dbe31-8127-46c8-9417-ecdf873a106b/renders/final_4ec4c565-7d42-468a-937c-5f3db9b64f2b.mp4',
    orientation: 'portrait',
  },
  {
    label: 'Style 6',
    url: 'https://sjcfcxjpukgeaxxkffpq.supabase.co/storage/v1/object/public/video-style2/sessions/8bb63e39-d403-45c7-8cae-5e4ccebfceee/renders/video_style6_7872fc63-5ab6-4e6e-8667-a50c389b8c7e.mp4',
    orientation: 'portrait',
  },
];

function VideoStylePreviewModal({ url, onClose }: { url: string; onClose: () => void }) {
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={handleBackdropClick}>
      <div className="relative w-[95vw] max-w-4xl max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-gray-300 z-10"
          aria-label="Close preview"
        >
          <X className="h-6 w-6" />
        </button>
        <video
          src={url}
          controls
          autoPlay
          className="w-full max-h-[85vh] rounded-lg object-contain bg-black"
        />
      </div>
    </div>
  );
}

function VideoStyleThumbnail({ label, url, orientation, onClick }: {
  label: string;
  url: string;
  orientation: 'landscape' | 'portrait';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative group rounded-lg overflow-hidden border border-border hover:border-primary shadow-sm hover:shadow-md transition-all ${
        orientation === 'landscape' ? 'aspect-video w-full' : 'aspect-[9/16] w-full'
      }`}
    >
      <video src={url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-white/95 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
          <Play className="h-5 w-5 text-primary ml-0.5" />
        </div>
      </div>
      <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider text-white bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded">
        {label}
      </span>
    </button>
  );
}

function PricingCard({ name, displayName, price, features, isPopular, isFree, billingInterval, currency }: {
  name: string;
  displayName: string;
  price: number;
  features: string[];
  isPopular?: boolean;
  isFree?: boolean;
  billingInterval: string;
  currency: SupportedCurrency;
}) {
  return (
    <Card className={`relative flex flex-col ${isPopular ? 'border-primary shadow-lg scale-[1.02]' : ''}`}>
      {isPopular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">Most Popular</Badge>
      )}
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-lg">{displayName}</CardTitle>
        <div className="mt-2">
          {isFree ? (
            <span className="text-4xl font-bold">Free</span>
          ) : (
            <>
              <span className="text-4xl font-bold">{formatPrice(currency === 'EUR' ? price : estimatePrice(price, currency), currency)}</span>
              <span className="text-muted-foreground">/{billingInterval}</span>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <ul className="space-y-2 flex-1">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <a href={isFree ? getSignupUrl() : getSignupUrl()} className="mt-6 block">
          <Button className="w-full" variant={isPopular ? 'default' : isFree ? 'default' : 'outline'}>
            {isFree ? 'Start Free' : `Get ${displayName}`}
          </Button>
        </a>
        {isFree && (
          <p className="text-xs text-center text-muted-foreground mt-2">No credit card required</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function MarketingHome() {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [stylePreviewUrl, setStylePreviewUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { currency: detectedCurrency, locale } = useLocale();
  const optimizedWord = getRegionConfig(locale).spelling === 'american' ? 'optimized' : 'optimised';
  const currency = detectedCurrency as SupportedCurrency;

  const { data: plans } = useQuery({
    queryKey: ['plan-definitions-marketing'],
    queryFn: getPlanDefinitions,
    staleTime: 5 * 60 * 1000,
  });

  const allPlans = plans?.filter(p => p.is_active && ['free', 'standard', 'professional', 'multi_branch'].includes(p.plan_tier)) || [];

  const handlePlayVideo = () => {
    setIsVideoPlaying(true);
    videoRef.current?.play();
  };

  return (
    <MarketingLayout>
      <SEO
        title="AutoListing.io — Automate Your Property Social Media"
        description="Post property listings to Instagram, TikTok, Facebook and more — automatically. AI-generated videos, smart scheduling, CRM and lead capture. Try free, no card required."
      />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 relative">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <Badge variant="secondary" className="gap-1.5 px-3 py-1">
              <Sparkles className="h-3.5 w-3.5" />
              Now with AI-generated property videos
            </Badge>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
              Automate Your Property{' '}
              <span className="text-primary">Social Media</span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Post listings to Instagram, TikTok, Facebook and more — automatically.
              AI-generated videos, smart scheduling, and lead capture built for estate agents.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href={getSignupUrl()}>
                <Button size="lg" className="gap-2 text-base px-8">
                  Try Free — No Card Required
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
              <Button size="lg" variant="outline" className="gap-2 text-base" onClick={() => {
                document.getElementById('demo-video')?.scrollIntoView({ behavior: 'smooth' });
              }}>
                <Play className="h-4 w-4" />
                Watch Demo
              </Button>
            </div>

            <GuidanceVideoLink
              url="https://youtu.be/RQhOENCec8o"
              label="Getting Started Guide"
            />
          </div>
        </div>
      </section>

      {/* Demo Video */}
      <section id="demo-video" className="py-20 scroll-mt-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold">See It In Action</h2>
              <p className="text-lg text-muted-foreground">
                Watch how AutoListing automates your social media in 2 minutes
              </p>
            </div>

            <div className="relative rounded-xl overflow-hidden shadow-2xl bg-black aspect-video">
              {!isVideoPlaying ? (
                <button
                  onClick={handlePlayVideo}
                  className="absolute inset-0 flex items-center justify-center group cursor-pointer"
                  style={{ backgroundImage: `url(${DEMO_THUMBNAIL_URL})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                >
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
                  <div className="relative w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Play className="w-8 h-8 text-white ml-1" />
                  </div>
                  <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm font-medium">
                    Watch the 2 min demo
                  </span>
                </button>
              ) : (
                <video
                  ref={videoRef}
                  controls
                  autoPlay
                  className="w-full h-full"
                  poster={DEMO_THUMBNAIL_URL}
                >
                  <source src={DEMO_VIDEO_URL} type="video/mp4" />
                </video>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">Everything You Need to Dominate Social Media on Autopilot</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From content creation to posting — fully automated.
            </p>
          </div>

          {/* Feature 1: Video Generation */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Video className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold">AI-Generated Property Videos</h3>
              <p className="text-muted-foreground text-lg">
                Upload your listing photos and we create scroll-stopping videos automatically.
                A growing library of styles — from cinematic slideshows to AI motion clips —
                with new ones added as AI models improve.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500" /> 6 video styles (and growing), 2 carousel types, and image posts</li>
                <li className="flex items-start gap-2 text-sm"><Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" /> Auto-generated on-screen captions, post descriptions and hashtags posted to all your accounts</li>
                <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500" /> 9:16 and 16:9 formats for every platform</li>
              </ul>
            </div>
            <div className="rounded-2xl border bg-card p-5 sm:p-6 shadow-lg space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {VIDEO_STYLE_SAMPLES.filter(s => s.orientation === 'landscape').map(s => (
                  <VideoStyleThumbnail
                    key={s.label}
                    label={s.label}
                    url={s.url}
                    orientation={s.orientation}
                    onClick={() => setStylePreviewUrl(s.url)}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 max-w-[260px] sm:max-w-xs mx-auto">
                {VIDEO_STYLE_SAMPLES.filter(s => s.orientation === 'portrait').map(s => (
                  <VideoStyleThumbnail
                    key={s.label}
                    label={s.label}
                    url={s.url}
                    orientation={s.orientation}
                    onClick={() => setStylePreviewUrl(s.url)}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Tap any sample to play. New styles released regularly as AI improves.
              </p>
            </div>
          </div>

          {/* Feature 2: Lead Magnets */}
          <div className="space-y-6">
            <div className="text-center space-y-2 max-w-2xl mx-auto">
              <div className="inline-flex h-12 w-12 rounded-lg bg-primary/10 items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold">Turn scrollers into qualified leads!</h3>
              <p className="text-muted-foreground text-lg">
                Posted automatically to all your accounts several times a week.
              </p>
            </div>

            <div className="rounded-2xl border bg-card overflow-hidden shadow-sm grid md:grid-cols-2 gap-0 items-stretch">
              <div className="bg-gradient-to-br from-primary/5 to-purple-500/5 p-6 sm:p-8 flex items-center justify-center">
                <img
                  src="https://sjcfcxjpukgeaxxkffpq.supabase.co/storage/v1/object/public/quiz-images/3db5b8f0-311c-49d1-83e5-0170e58e87e5/quiz/worth-estimate/1776870305498.jpg"
                  alt="Example 'What is your property worth?' quiz post"
                  className="rounded-xl shadow-lg max-h-[420px] w-auto object-contain"
                  loading="lazy"
                />
              </div>
              <div className="p-6 sm:p-8 flex flex-col justify-center space-y-4">
                <Badge variant="secondary" className="gap-1 self-start"><Sparkles className="h-3 w-3" /> 2-minute AI quiz</Badge>
                <h4 className="text-xl font-bold">AI Property Valuation</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-3"><span className="text-base shrink-0 leading-tight">🏡</span><span>Visitors answer a few questions about their home</span></li>
                  <li className="flex items-start gap-3"><span className="text-base shrink-0 leading-tight">💰</span><span>They get a price range + market drivers</span></li>
                  <li className="flex items-start gap-3"><span className="text-base shrink-0 leading-tight">📥</span><span>You get the seller lead in your CRM</span></li>
                  <li className="flex items-start gap-3"><span className="text-base shrink-0 leading-tight">⚡</span><span>Done in under 2 minutes</span></li>
                </ul>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border bg-card p-4 space-y-1">
                <div className="text-2xl leading-none">🏠</div>
                <h4 className="font-semibold text-sm">Free Valuation Form</h4>
                <p className="text-xs text-muted-foreground">Direct to your seller pipeline</p>
              </div>
              <div className="rounded-xl border bg-card p-4 space-y-1">
                <div className="text-2xl leading-none">✅</div>
                <h4 className="font-semibold text-sm">Ready-to-Sell Quiz</h4>
                <p className="text-xs text-muted-foreground">Score + personalised prep checklist</p>
              </div>
              <div className="rounded-xl border bg-card p-4 space-y-1">
                <div className="text-2xl leading-none">📈</div>
                <h4 className="font-semibold text-sm">Monthly Market Update</h4>
                <p className="text-xs text-muted-foreground">AI area report → newsletter list</p>
              </div>
              <div className="rounded-xl border bg-card p-4 space-y-1">
                <div className="text-2xl leading-none">📚</div>
                <h4 className="font-semibold text-sm">Tips & Advice Articles</h4>
                <p className="text-xs text-muted-foreground">Evergreen guides, email-gated</p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <div className="rounded-xl border bg-background p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none">🔀</span>
                  <h4 className="font-semibold text-sm">Built-in variety</h4>
                </div>
                <p className="text-xs text-muted-foreground">Captions, images and areas all rotate — platforms keep promoting</p>
              </div>
              <div className="rounded-xl border bg-background p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none">📬</span>
                  <h4 className="font-semibold text-sm">Straight to your CRM</h4>
                </div>
                <p className="text-xs text-muted-foreground">Pipeline drop + instant email alert. No DM copy-paste</p>
              </div>
              <div className="rounded-xl border bg-background p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none">🔗</span>
                  <h4 className="font-semibold text-sm">One link for your bio</h4>
                </div>
                <p className="text-xs text-muted-foreground">Bio Hub for every magnet. Multi-area? Visitors pick first</p>
              </div>
            </div>
          </div>

          {/* Feature 3: Smart Scheduling */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 rounded-2xl overflow-hidden shadow-lg border">
              <img
                src="https://sjcfcxjpukgeaxxkffpq.supabase.co/storage/v1/object/public/public-assets/marketing-calendar.png"
                alt="Smart scheduling calendar with posts"
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
            <div className="order-1 lg:order-2 space-y-6">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold">Smart Scheduling Calendar</h3>
              <p className="text-muted-foreground text-lg">
                Your social calendar fills itself. Posts are scheduled at optimal times
                based on your listing status — new listings get more frequent posting.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500" /> Automatic frequency based on listing status</li>
                <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500" /> Drag and drop to reschedule</li>
                <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500" /> Post approval workflow (optional)</li>
              </ul>
            </div>
          </div>

          {/* Feature 4: Multi-Platform Posting */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Share2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold">Post Everywhere, Automatically</h3>
              <p className="text-muted-foreground text-lg">
                Connect your social accounts once. Every post goes to Instagram, TikTok,
                Facebook, YouTube, LinkedIn, Pinterest, X, Threads, Reddit, and Bluesky —
                all at once.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500" /> 10 platforms supported</li>
                <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500" /> Platform-{optimizedWord} captions</li>
                <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500" /> Lead magnets and quiz posts</li>
              </ul>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-lg border">
              <img
                src="https://sjcfcxjpukgeaxxkffpq.supabase.co/storage/v1/object/public/public-assets/marketing-multi-platform.png"
                alt="Multi-platform social media posting"
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          </div>

          {/* Feature 5: CRM & Website */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 rounded-2xl overflow-hidden shadow-lg border">
              <img
                src="https://sjcfcxjpukgeaxxkffpq.supabase.co/storage/v1/object/public/public-assets/marketing-crm-website.png"
                alt="CRM and property website"
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
            <div className="order-1 lg:order-2 space-y-6">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold">CRM, Website & Lead Capture</h3>
              <p className="text-muted-foreground text-lg">
                Property listings website with your own custom domain, built-in CRM,
                and email automation. Capture leads from social media and nurture them automatically.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500" /> Your own property listings website</li>
                <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500" /> Custom domain — use youragency.com (paid plans)</li>
                <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500" /> CRM with buyer and seller pipelines</li>
                <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500" /> Email sequences and automation</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 scroll-mt-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl font-bold">Simple, Weekly Pricing</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Start free. Upgrade as you grow. Cancel anytime.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {allPlans.map((plan) => (
              <PricingCard
                key={plan.name}
                name={plan.name}
                displayName={plan.display_name}
                price={plan.monthly_price_cents}
                features={plan.features as string[]}
                isPopular={plan.name === 'professional'}
                isFree={plan.plan_tier === 'free'}
                billingInterval={plan.billing_interval}
                currency={currency}
              />
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
            <div className="space-y-6">
              {[
                {
                  q: 'How does the free plan work?',
                  a: 'Sign up with just your business name and email — no credit card needed. You get 3 listings, automated posting, and a property website. Upgrade whenever you need more.',
                },
                {
                  q: 'Can I upgrade or downgrade anytime?',
                  a: 'Yes. Upgrade instantly to get higher limits. Downgrade at the end of your billing period. No lock-in contracts.',
                },
                {
                  q: 'What social platforms do you support?',
                  a: 'Instagram, TikTok, Facebook, YouTube, LinkedIn, Pinterest, X, Threads, Reddit, and Bluesky — 10 platforms in total. Connect once and every post goes everywhere automatically.',
                },
                {
                  q: 'How are the videos created?',
                  a: 'Upload your listing photos and our AI generates professional property videos in multiple styles — from cinematic slideshows to AI motion clips. Captions and hashtags are generated automatically.',
                },
                {
                  q: 'Can I use my own domain?',
                  a: 'Yes! On any paid plan you can connect your own domain (like youragency.com) to your property listings website. We guide you through the setup step by step — it takes about 5 minutes.',
                },
                {
                  q: 'What is a Social Hub?',
                  a: 'A Social Hub is a branch of your social media operations. Multi-Branch plans let agencies with multiple offices run separate social accounts and schedules for each location.',
                },
              ].map((faq) => (
                <div key={faq.q} className="space-y-2">
                  <h3 className="font-semibold text-lg">{faq.q}</h3>
                  <p className="text-muted-foreground">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-3xl font-bold">Start Automating Your Social Media Today</h2>
            <p className="text-lg opacity-90">
              Join estate agents who are saving hours every week.
              Start free — no credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href={getSignupUrl()}>
                <Button size="lg" variant="secondary" className="gap-2 text-base px-8">
                  Start Free Now
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
              <Link to="/pricing">
                <Button size="lg" variant="ghost" className="gap-2 text-base text-primary-foreground hover:text-primary-foreground/90 hover:bg-primary-foreground/10">
                  View Pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {stylePreviewUrl && (
        <VideoStylePreviewModal url={stylePreviewUrl} onClose={() => setStylePreviewUrl(null)} />
      )}
    </MarketingLayout>
  );
}
