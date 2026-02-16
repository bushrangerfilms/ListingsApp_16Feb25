import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Building2, User, ArrowLeft } from 'lucide-react';
import { SEO } from '@/components/SEO';

type SignupStep = 'business' | 'account';

export default function OrganizationSignup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');
  const { user } = useAuth();
  
  // Multi-step form state
  const [step, setStep] = useState<SignupStep>('business');
  
  // Business details
  const [businessName, setBusinessName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  
  // User account details
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gdprConsent, setGdprConsent] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already logged in (only check once user is confirmed, not on loading changes)
  useEffect(() => {
    if (user) {
      const targetUrl = returnUrl || '/admin/listings';
      navigate(targetUrl);
    }
  }, [user, navigate, returnUrl]);

  // Auto-fill user email from business contact email
  useEffect(() => {
    if (step === 'account' && contactEmail && !email) {
      setEmail(contactEmail);
    }
  }, [step, contactEmail, email]);

  const handleBusinessDetailsNext = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!businessName.trim()) {
      toast.error('Business name is required');
      return;
    }
    
    if (!contactEmail.trim()) {
      toast.error('Contact email is required');
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail)) {
      toast.error('Please enter a valid contact email');
      return;
    }
    
    setStep('account');
  };

  const handleAccountSignup = async (e: React.FormEvent) => {
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
      // Call edge function to create organization and user account
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-organization`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            // Business details
            businessName: businessName.trim(),
            contactEmail: contactEmail.trim(),
            phone: phone.trim() || null,
            website: website.trim() || null,
            // User account details
            userEmail: email.trim(),
            password,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create organization');
      }

      const data = await response.json();
      
      toast.success('🎉 Organization created successfully!');
      toast.success('Please check your email to verify your account');
      
      // Redirect to login with success message
      setTimeout(() => {
        navigate('/admin/login?message=signup_success');
      }, 2000);
      
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
        title="Create Your Organization - AutoListing.io"
        description="Sign up and create your property management organization with AutoListing.io. The all-in-one platform for real estate agents and agencies."
        ogTitle="Create Your Organization - AutoListing.io"
        ogDescription="Sign up and create your property management organization with AutoListing.io."
      />
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {step === 'business' && <Building2 className="h-5 w-5" />}
              {step === 'account' && <User className="h-5 w-5" />}
              {step === 'business' ? 'Create Your Organization' : 'Create Your Account'}
            </CardTitle>
            <CardDescription>
              {step === 'business' 
                ? 'Tell us about your business to get started'
                : 'Set up your admin account to manage your organization'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Progress indicator */}
            <div className="flex items-center gap-2 mb-6">
              <div className={`flex items-center gap-2 ${step === 'business' ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'business' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  1
                </div>
                <span className="text-sm font-medium">Business</span>
              </div>
              <div className="flex-1 h-px bg-border" />
              <div className={`flex items-center gap-2 ${step === 'account' ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'account' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  2
                </div>
                <span className="text-sm font-medium">Account</span>
              </div>
            </div>

            {/* Step 1: Business Details */}
            {step === 'business' && (
              <form onSubmit={handleBusinessDetailsNext} className="space-y-4">
                {/* Section description */}
                <div className="bg-muted/50 rounded-md p-3 mb-2">
                  <p className="text-sm text-muted-foreground">
                    This information will be displayed publicly on your website and used for client enquiries.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name *</Label>
                  <Input
                    id="businessName"
                    data-testid="input-business-name"
                    type="text"
                    placeholder="e.g., Bridge Auctioneers"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                  />
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
                  <p className="text-xs text-muted-foreground">
                    Shown publicly on your website. Can be a shared inbox like info@ or enquiries@
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <Label htmlFor="website">Domain</Label>
                    <Input
                      id="website"
                      data-testid="input-website"
                      type="text"
                      placeholder="yourbusiness.com"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full"
                  data-testid="button-next-step"
                >
                  Next: Create Account
                </Button>

                <div className="text-center text-sm">
                  <span className="text-muted-foreground">Already have an account? </span>
                  <Link to="/admin/login" className="text-primary hover:underline">
                    Sign in
                  </Link>
                </div>
              </form>
            )}

            {/* Step 2: Account Details */}
            {step === 'account' && (
              <form onSubmit={handleAccountSignup} className="space-y-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep('business')}
                  className="mb-2"
                  data-testid="button-back"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Business Details
                </Button>

                {/* Section description */}
                <div className="bg-muted/50 rounded-md p-3 mb-2">
                  <p className="text-sm text-muted-foreground">
                    Your personal login details. This is how you will sign in to manage your organization.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      data-testid="input-first-name"
                      type="text"
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
                      type="text"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Your Login Email *</Label>
                  <Input
                    id="email"
                    data-testid="input-user-email"
                    type="email"
                    placeholder="john@yourbusiness.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your personal email for signing in. Not shown publicly.
                  </p>
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
                    autoComplete="new-password"
                    minLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    data-testid="input-confirm-password"
                    type="password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    minLength={6}
                  />
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="gdpr"
                    data-testid="checkbox-gdpr"
                    checked={gdprConsent}
                    onCheckedChange={(checked) => {
                      // Explicitly convert to boolean (checked can be boolean or 'indeterminate')
                      setGdprConsent(checked === true);
                    }}
                  />
                  <label
                    htmlFor="gdpr"
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I agree to the{' '}
                    <Link to="/privacy-policy" className="text-primary hover:underline" target="_blank">
                      Privacy Policy
                    </Link>
                    {' '}and{' '}
                    <Link to="/terms-conditions" className="text-primary hover:underline" target="_blank">
                      Terms & Conditions
                    </Link>
                  </label>
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isSubmitting}
                  data-testid="button-create-organization"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating your organization...
                    </>
                  ) : (
                    'Create Organization'
                  )}
                </Button>

                <div className="text-center text-sm">
                  <span className="text-muted-foreground">Already have an account? </span>
                  <Link to="/admin/login" className="text-primary hover:underline">
                    Sign in
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
