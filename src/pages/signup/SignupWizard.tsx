import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  Check,
  ArrowRight,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { supabase } from '@/integrations/supabase/client';

const FREE_FEATURES = [
  '3 property listings',
  'Automated social media posting',
  'AI-generated property videos',
  'Your own property website',
  'CRM & lead capture',
  'No credit card required',
];

export default function SignupWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const utmSource = searchParams.get('utm_source');
  const utmMedium = searchParams.get('utm_medium');
  const utmCampaign = searchParams.get('utm_campaign');

  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gdprConsent, setGdprConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isCompletingSignupRef = useRef(false);

  useEffect(() => {
    if (user && !isCompletingSignupRef.current) {
      navigate('/admin/listings');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!businessName.trim()) {
      toast.error('Please enter your business name');
      return;
    }
    if (!email.trim()) {
      toast.error('Please enter your email');
      return;
    }
    if (!password || password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!gdprConsent) {
      toast.error('You must accept the privacy policy and terms');
      return;
    }

    setIsSubmitting(true);
    isCompletingSignupRef.current = true;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-organization`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            businessName: businessName.trim(),
            contactEmail: email.trim(),
            userEmail: email.trim(),
            password,
            firstName: businessName.trim().split(' ')[0] || 'User',
            lastName: '',
            utmSource: utmSource || null,
            utmMedium: utmMedium || null,
            utmCampaign: utmCampaign || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account');
      }

      // Auto-login
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) {
        // Account created but auto-login failed — redirect to login
        navigate('/admin/login');
        toast.success('Account created! Please check your email to verify, then log in.');
        return;
      }

      // Navigate to success/dashboard
      navigate('/signup/success', {
        state: {
          businessName: businessName.trim(),
          plan: 'free',
        },
      });
    } catch (error: any) {
      console.error('Signup error:', error);
      if (error.message.includes('already registered') || error.message.includes('already exists')) {
        toast.error('An account with this email already exists. Try logging in instead.');
      } else {
        toast.error(error.message || 'Failed to create account. Please try again.');
      }
      isCompletingSignupRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MarketingLayout hideFooter>
      <SEO
        title="Sign Up Free — AutoListing.io"
        description="Create your AutoListing account. Start with 3 listings free, no credit card required."
      />

      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-4xl grid lg:grid-cols-2 gap-8 items-center">
          {/* Left: Value Prop */}
          <div className="space-y-6 hidden lg:block">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                Free — No card required
              </div>
              <h1 className="text-3xl font-bold">
                Start automating your social media in minutes
              </h1>
              <p className="text-muted-foreground">
                Create your account and add your first listing. We'll handle the rest.
              </p>
            </div>

            <ul className="space-y-3">
              {FREE_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: Signup Form */}
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Create Your Account</CardTitle>
              <CardDescription>
                Start free with up to 3 listings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    placeholder="e.g. Smith & Co Auctioneers"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@agency.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={8}
                  />
                </div>

                <div className="flex items-start gap-2 pt-2">
                  <Checkbox
                    id="gdpr"
                    checked={gdprConsent}
                    onCheckedChange={(checked) => setGdprConsent(checked === true)}
                  />
                  <label htmlFor="gdpr" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                    I agree to the{' '}
                    <Link to="/privacy-policy" target="_blank" className="text-primary hover:underline">
                      Privacy Policy
                    </Link>{' '}
                    and{' '}
                    <Link to="/terms-conditions" target="_blank" className="text-primary hover:underline">
                      Terms & Conditions
                    </Link>
                  </label>
                </div>

                <Button
                  type="submit"
                  className="w-full gap-2"
                  size="lg"
                  disabled={isSubmitting || !gdprConsent}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating your account...
                    </>
                  ) : (
                    <>
                      Create Account
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Already have an account?{' '}
                  <Link to="/admin/login" className="text-primary hover:underline">
                    Log in
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </MarketingLayout>
  );
}
