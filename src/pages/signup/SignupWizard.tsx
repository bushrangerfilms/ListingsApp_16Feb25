import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Check, 
  Building2, 
  ArrowRight, 
  ArrowLeft,
  Loader2,
  Sparkles,
  Calendar,
  CreditCard,
  Zap,
  Upload,
  X,
  ImageIcon
} from 'lucide-react';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { TRIAL_CREDITS } from '@/lib/billing/billingClient';
import { supabase } from '@/integrations/supabase/client';

type SignupStep = 'business' | 'account';

const TRIAL_FEATURES = [
  'Full access to all platform features',
  `${TRIAL_CREDITS} free credits to try AI & automation`,
  'Property listings management',
  'CRM & contact management',
  'Email automation',
  'AI assistant',
  'Webhook integrations',
  'No credit card required',
];

export default function SignupWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  const utmSource = searchParams.get('utm_source');
  const utmMedium = searchParams.get('utm_medium');
  const utmCampaign = searchParams.get('utm_campaign');
  const isInvited = searchParams.get('invited') === 'true';
  
  const [step, setStep] = useState<SignupStep>('business');
  
  const [businessName, setBusinessName] = useState('');
  const [psrLicenceNumber, setPsrLicenceNumber] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gdprConsent, setGdprConsent] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already logged in (don't depend on loading to avoid form reset on tab focus)
  useEffect(() => {
    if (user) {
      navigate('/admin/listings');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (step === 'account' && contactEmail && !email) {
      setEmail(contactEmail);
    }
  }, [step, contactEmail, email]);

  const handleLogoUpload = async (file: File) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a PNG, JPEG, SVG, or WebP image');
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be less than 2MB');
      return;
    }
    
    setIsUploadingLogo(true);
    
    try {
      const previewUrl = URL.createObjectURL(file);
      setLogoPreview(previewUrl);
      
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `organization-logos/signup-temp/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('real-estate-videos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });
      
      if (error) {
        console.error('Logo upload error:', error);
        toast.error('Failed to upload logo. Please try again.');
        setLogoPreview(null);
        return;
      }
      
      const { data: urlData } = supabase.storage
        .from('real-estate-videos')
        .getPublicUrl(data.path);
      
      setLogoUrl(urlData.publicUrl);
      toast.success('Logo uploaded successfully');
    } catch (error) {
      console.error('Logo upload error:', error);
      toast.error('Failed to upload logo');
      setLogoPreview(null);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
    setLogoPreview(null);
  };

  const handleBusinessNext = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!businessName.trim()) {
      toast.error('Business name is required');
      return;
    }
    
    if (!contactEmail.trim()) {
      toast.error('Contact email is required');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail)) {
      toast.error('Please enter a valid contact email');
      return;
    }
    
    setStep('account');
  };

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || !confirmPassword || !firstName || !lastName) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!gdprConsent) {
      toast.error('Please accept the privacy policy to continue');
      return;
    }

    setIsSubmitting(true);

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
            psrLicenceNumber: psrLicenceNumber.trim() || null,
            contactEmail: contactEmail.trim(),
            phone: phone.trim() || null,
            website: website.trim() || null,
            logoUrl: logoUrl || null,
            userEmail: email.trim(),
            password,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            utmSource: utmSource || null,
            utmMedium: utmMedium || null,
            utmCampaign: utmCampaign || null,
            isComped: isInvited,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create organization');
      }

      const data = await response.json();
      
      if (isInvited) {
        toast.success('Account created! Welcome to the pilot program.');
      } else {
        toast.success('Account created! Your 14-day free trial has started.');
        toast.success(`You've received ${TRIAL_CREDITS} free trial credits!`);
      }
      
      navigate('/signup/success', { 
        state: { 
          trialEndsAt: data.trial?.endsAt,
          trialCredits: data.trial?.credits || TRIAL_CREDITS,
          businessName: businessName.trim(),
          isPilot: isInvited,
        } 
      });
      
    } catch (error: any) {
      console.error('Signup error:', error);
      toast.error(error.message || 'Failed to create organization. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <SEO 
        title="Sign Up - AutoListing.io | Property Management Platform"
        description="Create your AutoListing.io account. The all-in-one platform for real estate agents and agencies. Manage listings, automate marketing, capture leads with AI."
        ogTitle="Sign Up - AutoListing.io"
        ogDescription="Start your free trial. The all-in-one property management platform for real estate professionals."
      />
      <MarketingLayout hideHeader={isInvited} hideFooter={isInvited}>
        <div className="min-h-screen py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <Badge variant="secondary" className="mb-4">
              <Sparkles className="w-3 h-3 mr-1" />
              {isInvited ? 'Pilot Program' : '14-Day Free Trial'}
            </Badge>
            <h1 className="text-3xl font-bold mb-2">
              {step === 'business' && (isInvited ? 'Create Your Organization' : 'Start Your Free Trial')}
              {step === 'account' && 'Create Your Account'}
            </h1>
            <p className="text-muted-foreground">
              {step === 'business' && (isInvited ? 'Set up your organization to access the platform.' : 'No credit card required. Get full access to all features for 14 days.')}
              {step === 'account' && 'Set up your admin account to get started'}
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 mb-8">
            <div className={`flex items-center gap-2 ${step === 'business' ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'business' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                1
              </div>
              <span className="text-sm font-medium hidden sm:inline">Business</span>
            </div>
            <div className="w-8 h-px bg-border" />
            <div className={`flex items-center gap-2 ${step === 'account' ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'account' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                2
              </div>
              <span className="text-sm font-medium hidden sm:inline">Account</span>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="order-2 lg:order-1">
              {step === 'business' && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-5 h-5 text-primary" />
                      <Badge variant="outline">Step 1 of 2</Badge>
                    </div>
                    <CardTitle>Business Details</CardTitle>
                    <CardDescription>Tell us about your real estate business</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleBusinessNext} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="businessName">Business Name *</Label>
                        <Input
                          id="businessName"
                          data-testid="input-business-name"
                          placeholder="e.g., Premier Estates"
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="psrLicenceNumber">PSR Licence Number</Label>
                        <Input
                          id="psrLicenceNumber"
                          data-testid="input-psr-licence-number"
                          placeholder="002179"
                          value={psrLicenceNumber}
                          onChange={(e) => setPsrLicenceNumber(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Company Logo</Label>
                        <div className="flex items-start gap-4">
                          {logoPreview || logoUrl ? (
                            <div className="relative">
                              <div className="w-20 h-20 rounded-md border overflow-hidden bg-muted flex items-center justify-center">
                                <img 
                                  src={logoPreview || logoUrl || ''} 
                                  alt="Company logo" 
                                  className="w-full h-full object-contain"
                                />
                              </div>
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute -top-2 -right-2 w-6 h-6"
                                onClick={handleRemoveLogo}
                                data-testid="button-remove-logo"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <label 
                              className="w-20 h-20 rounded-md border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 cursor-pointer flex flex-col items-center justify-center gap-1 transition-colors"
                              data-testid="input-logo-upload"
                            >
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleLogoUpload(file);
                                }}
                                disabled={isUploadingLogo}
                              />
                              {isUploadingLogo ? (
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                              ) : (
                                <>
                                  <ImageIcon className="w-5 h-5 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">Upload</span>
                                </>
                              )}
                            </label>
                          )}
                          <div className="flex-1 text-sm text-muted-foreground">
                            <p>Upload your company logo for branding across the platform.</p>
                            <p className="mt-1">PNG, JPEG, SVG, or WebP. Max 2MB.</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="contactEmail">Business Contact Email *</Label>
                        <Input
                          id="contactEmail"
                          data-testid="input-contact-email"
                          type="email"
                          placeholder="info@yourbusiness.com"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                          id="phone"
                          data-testid="input-phone"
                          type="tel"
                          placeholder="+353 1 234 5678"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="domain">Domain</Label>
                        <Input
                          id="domain"
                          data-testid="input-domain"
                          type="text"
                          placeholder="yourbusiness.com"
                          value={website}
                          onChange={(e) => setWebsite(e.target.value)}
                        />
                      </div>

                      <Button type="submit" className="w-full" data-testid="button-next-account">
                        Continue
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              {step === 'account' && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-5 h-5 text-primary" />
                      <span className="text-sm text-muted-foreground">{businessName}</span>
                    </div>
                    <CardTitle>Create Your Account</CardTitle>
                    <CardDescription>Set up your admin account to manage your organization</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleAccountSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">First Name *</Label>
                          <Input
                            id="firstName"
                            data-testid="input-first-name"
                            placeholder="John"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last Name *</Label>
                          <Input
                            id="lastName"
                            data-testid="input-last-name"
                            placeholder="Doe"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          data-testid="input-email"
                          type="email"
                          placeholder="john@yourbusiness.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="password">Password *</Label>
                        <Input
                          id="password"
                          data-testid="input-password"
                          type="password"
                          placeholder="At least 6 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm Password *</Label>
                        <Input
                          id="confirmPassword"
                          data-testid="input-confirm-password"
                          type="password"
                          placeholder="Confirm your password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                      </div>

                      <div className="flex items-start space-x-2 pt-2">
                        <Checkbox
                          id="gdprConsent"
                          data-testid="checkbox-gdpr"
                          checked={gdprConsent}
                          onCheckedChange={(checked) => setGdprConsent(checked as boolean)}
                        />
                        <Label htmlFor="gdprConsent" className="text-sm leading-relaxed">
                          I agree to the{' '}
                          <Link to="/privacy-policy" className="text-primary hover:underline" target="_blank">
                            Privacy Policy
                          </Link>{' '}
                          and{' '}
                          <Link to="/terms-conditions" className="text-primary hover:underline" target="_blank">
                            Terms & Conditions
                          </Link>
                        </Label>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => setStep('business')}
                          disabled={isSubmitting}
                          data-testid="button-back-business"
                        >
                          <ArrowLeft className="w-4 h-4 mr-2" />
                          Back
                        </Button>
                        <Button 
                          type="submit" 
                          className="flex-1" 
                          disabled={isSubmitting}
                          data-testid="button-create-account"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Creating Account...
                            </>
                          ) : (
                            <>
                              {isInvited ? 'Create Account' : 'Start Free Trial'}
                              <ArrowRight className="w-4 h-4 ml-2" />
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="text-center text-sm pt-2">
                        <span className="text-muted-foreground">Already have an account? </span>
                        <Link to="/admin/login" className="text-primary hover:underline">
                          Sign in
                        </Link>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="order-1 lg:order-2">
              {isInvited ? (
                <Card className="bg-primary text-primary-foreground border-primary">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-primary-foreground">
                      <Sparkles className="w-5 h-5" />
                      Welcome to the Pilot Program
                    </CardTitle>
                    <CardDescription className="text-primary-foreground/80">
                      You have been invited to join AutoListing
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-white">Full Platform Access</div>
                        <div className="text-white/70">All features unlocked</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                        <Zap className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-white">Unlimited Credits</div>
                        <div className="text-white/70">Use all AI & automation features</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-white">Your Own Organization</div>
                        <div className="text-white/70">Create a dedicated workspace</div>
                      </div>
                    </div>

                    <div className="border-t border-white/20 pt-4">
                      <div className="text-sm font-medium mb-3 text-white">What's included:</div>
                      <ul className="space-y-2">
                        {['Automated social media posting', 'Automated video generation', 'Company website (Optional)', 'Property listings management', 'CRM & contact management', 'Email automation', 'AI assistant', 'Priority support'].map((feature, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                            <span className="text-white/80">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-accent/30 border-dashed">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      Your 14-Day Free Trial
                    </CardTitle>
                    <CardDescription>
                      Try AutoListing risk-free with full access to all features
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">14 days free</div>
                        <div className="text-muted-foreground">Full access to all features</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Zap className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{TRIAL_CREDITS} free credits</div>
                        <div className="text-muted-foreground">Try AI & automation features</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <CreditCard className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">No credit card required</div>
                        <div className="text-muted-foreground">Choose a plan when you're ready</div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <div className="text-sm font-medium mb-3">What's included:</div>
                      <ul className="space-y-2">
                        {TRIAL_FEATURES.slice(2).map((feature, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                            <span className="text-muted-foreground">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-background rounded-lg p-4 border">
                      <div className="text-sm text-muted-foreground mb-2">After your trial, plans start at:</div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold">€29</span>
                        <span className="text-muted-foreground">/month</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Cancel anytime. No hidden fees.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </MarketingLayout>
    </>
  );
}
