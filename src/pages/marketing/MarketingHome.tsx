import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { SEO } from '@/components/SEO';
import { getSignupUrl } from '@/lib/appUrls';
import { useQuery } from '@tanstack/react-query';
import { getPlanDefinitions } from '@/lib/billing/billingClient';
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
  ChevronDown,
  ChevronUp,
  Building2,
} from 'lucide-react';

const DEMO_VIDEO_URL = 'https://sjcfcxjpukgeaxxkffpq.supabase.co/storage/v1/object/public/public-assets/pilot-program-demo.mp4';
const DEMO_THUMBNAIL_URL = 'https://sjcfcxjpukgeaxxkffpq.supabase.co/storage/v1/object/public/public-assets/video-thumbnail.png';

function PricingCard({ name, displayName, price, features, isPopular, isFree, billingInterval }: {
  name: string;
  displayName: string;
  price: number;
  features: string[];
  isPopular?: boolean;
  isFree?: boolean;
  billingInterval: string;
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
              <span className="text-4xl font-bold">&euro;{Math.round(price / 100)}</span>
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
  const [showMultiBranch, setShowMultiBranch] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { data: plans } = useQuery({
    queryKey: ['plan-definitions-marketing'],
    queryFn: getPlanDefinitions,
    staleTime: 5 * 60 * 1000,
  });

  const standardPlans = plans?.filter(p => p.is_active && ['free', 'standard', 'professional'].includes(p.plan_tier)) || [];
  const multiBranchPlans = plans?.filter(p => p.is_active && p.plan_tier === 'multi_branch') || [];

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

            <p className="text-sm text-muted-foreground">
              Start with 3 listings free. Upgrade anytime.
            </p>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-8 border-y bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-muted-foreground">
            Trusted by estate agents and auctioneers across Ireland
          </p>
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
            <h2 className="text-3xl font-bold">Everything You Need to Dominate Social Media</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From video creation to posting — fully automated for estate agents
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
                Multiple styles — from cinematic slideshows to AI motion clips.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500" /> Multiple video styles to match your brand</li>
                <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500" /> Auto-generated captions and hashtags</li>
                <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500" /> 9:16 and 16:9 formats for every platform</li>
              </ul>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-lg border">
              <img
                src="https://sjcfcxjpukgeaxxkffpq.supabase.co/storage/v1/object/public/public-assets/marketing-video-gen.png"
                alt="AI-generated property video preview"
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          </div>

          {/* Feature 2: Smart Scheduling */}
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

          {/* Feature 3: Multi-Platform Posting */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Share2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold">Post Everywhere, Automatically</h3>
              <p className="text-muted-foreground text-lg">
                Connect your social accounts once. Every post goes to Instagram, TikTok,
                Facebook, YouTube, LinkedIn, and Pinterest — all at once.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500" /> 6 platforms supported</li>
                <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500" /> Platform-optimised captions</li>
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

          {/* Feature 4: CRM & Website */}
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
                Property listings website, built-in CRM, and email automation.
                Capture leads from social media and nurture them automatically.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500" /> Your own property listings website</li>
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
            {standardPlans.map((plan) => (
              <PricingCard
                key={plan.name}
                name={plan.name}
                displayName={plan.display_name}
                price={plan.monthly_price_cents}
                features={plan.features as string[]}
                isPopular={plan.name === 'professional'}
                isFree={plan.plan_tier === 'free'}
                billingInterval={plan.billing_interval}
              />
            ))}
          </div>

          {/* Multi-Branch Toggle */}
          {multiBranchPlans.length > 0 && (
            <div className="mt-8 max-w-6xl mx-auto">
              <button
                onClick={() => setShowMultiBranch(!showMultiBranch)}
                className="flex items-center gap-2 mx-auto text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Building2 className="h-4 w-4" />
                Multi-Branch Plans for Agencies
                {showMultiBranch ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showMultiBranch && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6">
                  {multiBranchPlans.map((plan) => (
                    <PricingCard
                      key={plan.name}
                      name={plan.name}
                      displayName={plan.display_name}
                      price={plan.monthly_price_cents}
                      features={plan.features as string[]}
                      billingInterval={plan.billing_interval}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
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
                  a: 'Instagram, TikTok, Facebook, YouTube, LinkedIn, and Pinterest. Connect once and every post goes everywhere automatically.',
                },
                {
                  q: 'How are the videos created?',
                  a: 'Upload your listing photos and our AI generates professional property videos in multiple styles — from cinematic slideshows to AI motion clips. Captions and hashtags are generated automatically.',
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
              Join estate agents across Ireland who are saving hours every week.
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
    </MarketingLayout>
  );
}
