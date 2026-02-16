import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { PublicHeader } from '@/components/PublicHeader';
import { Footer } from '@/components/Footer';
import { CookieConsent } from '@/components/CookieConsent';
import { SEO } from '@/components/SEO';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePublicListings } from '@/contexts/PublicListingsContext';

export default function ValuationRequest() {
  const { orgSlug } = useParams<{ orgSlug?: string }>();
  const navigate = useNavigate();
  const { organization, setOrganizationBySlug } = useOrganization();
  const { organization: domainOrg, isPublicSite: isDomainBased, loading: domainLoading } = usePublicListings();
  
  const [domainError, setDomainError] = useState(false);
  
  // Load organization by slug for slug-based access
  useEffect(() => {
    if (!isDomainBased && orgSlug && !organization) {
      console.log('[ValuationRequest] Loading organization by slug:', orgSlug);
      setOrganizationBySlug(orgSlug);
    }
  }, [orgSlug, isDomainBased, organization, setOrganizationBySlug]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    propertyAddress: '',
    message: '',
    gdprConsent: false,
  });
  const [submitting, setSubmitting] = useState(false);
  
  // Check for domain configuration error
  useEffect(() => {
    if (isDomainBased) {
      if (domainLoading) {
        // Waiting for domain detection
        return;
      }
      if (!domainOrg) {
        // Domain not configured
        setDomainError(true);
      } else {
        setDomainError(false);
      }
    } else {
      setDomainError(false);
    }
  }, [isDomainBased, domainOrg, domainLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.gdprConsent) {
      toast.error('Please accept the privacy policy to continue');
      return;
    }
    
    // Block submission if domain detection is still in progress
    if (isDomainBased && domainLoading) {
      toast.error('Please wait while we load the page...');
      console.error('Blocked submission: Domain detection in progress');
      return;
    }
    
    // Block submission if domain-based access but no org found (prevent tenant leakage)
    if (isDomainBased && !domainOrg) {
      toast.error('Domain not configured. Please contact support.');
      console.error('Blocked submission: Domain not configured');
      return;
    }
    
    // Derive clientSlug with precedence:
    // 1. Domain mode: use domainOrg.slug only
    // 2. Slug mode: prefer URL param, fallback to organization context
    let clientSlug: string | undefined;
    
    if (isDomainBased) {
      clientSlug = domainOrg?.slug;
    } else {
      // Use URL param first, then organization context as fallback
      clientSlug = orgSlug || organization?.slug;
    }
    
    // Block submission if no client slug (prevent tenant leakage)
    if (!clientSlug) {
      toast.error('Organization not found. Please try again.');
      console.error('No client slug for valuation submission', { 
        isDomainBased, 
        domainOrg: domainOrg?.slug, 
        orgSlug, 
        organizationSlug: organization?.slug 
      });
      return;
    }

    setSubmitting(true);
    console.log('[ValuationRequest] Submitting with clientSlug:', clientSlug, { isDomainBased, orgSlug, organizationSlug: organization?.slug });

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-valuation-request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...formData,
            clientSlug, // Validated slug from domain or URL
          }),
        }
      );

      const data = await response.json();
      console.log('[ValuationRequest] Response:', { status: response.status, data });

      if (data.success) {
        toast.success('Valuation request submitted successfully! We\'ll be in touch soon.');
        setFormData({
          name: '',
          email: '',
          phone: '',
          propertyAddress: '',
          message: '',
          gdprConsent: false,
        });
      } else {
        console.error('[ValuationRequest] Failed:', data.error || 'Unknown error');
        toast.error(data.error || 'Failed to submit request. Please try again.');
      }
    } catch (error) {
      console.error('[ValuationRequest] Error submitting:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Show loading state while domain detection is in progress
  if (isDomainBased && domainLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Show domain error if accessing via custom domain but no org configured
  if (domainError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <CardContent className="text-center space-y-4">
            <h1 className="text-2xl font-bold">Domain Not Configured</h1>
            <p className="text-muted-foreground">
              This domain is not associated with any organization. Please contact support.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const businessName = organization?.business_name || 'Property Management';
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO 
        title={`Request a Property Valuation - ${businessName}`}
        description={`Get a free, no-obligation property valuation from ${businessName} expert team. Fill out the form and we'll contact you within 24 hours.`}
      />
      <PublicHeader />
      <CookieConsent />
      
      {/* Back Button */}
      <div className="container mx-auto px-4 pt-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate(orgSlug ? `/${orgSlug}` : '/')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Properties
        </Button>
      </div>

      {/* Hero Section */}
      <section className="bg-muted py-16">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h1 className="text-4xl font-bold mb-4">Request a Property Valuation</h1>
          <p className="text-lg text-muted-foreground">
            Get a free, no-obligation valuation of your property from our expert team.
            Fill out the form below and we'll get back to you within 24 hours.
          </p>
        </div>
      </section>

      {/* Form Section */}
      <section className="container mx-auto px-4 py-12">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label className="block mb-2">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label className="block mb-2">
                  Email Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label className="block mb-2">
                  Phone Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="tel"
                  placeholder="+353 123 456 789"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label className="block mb-2">
                  Property Address <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  placeholder="Enter the full address of the property you'd like valued"
                  value={formData.propertyAddress}
                  onChange={(e) => setFormData({ ...formData, propertyAddress: e.target.value })}
                  rows={3}
                  required
                />
              </div>

              <div>
                <Label className="block mb-2">
                  Additional Information (Optional)
                </Label>
                <Textarea
                  placeholder="Any additional details about your property or specific requirements"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="gdprConsent"
                  checked={formData.gdprConsent}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, gdprConsent: checked as boolean })
                  }
                  disabled={submitting}
                />
                <Label htmlFor="gdprConsent" className="text-sm leading-tight cursor-pointer">
                  I agree to the <Link to="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link> and 
                  consent to {(isDomainBased ? domainOrg?.business_name : organization?.business_name) || 'this organization'} processing my data for this valuation request *
                </Label>
              </div>

              <div className="pt-4">
                <Button type="submit" className="w-full" disabled={submitting || !formData.gdprConsent}>
                  {submitting ? 'Submitting...' : 'Request Valuation'}
                </Button>
              </div>
            </form>

            <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
              <p>
                Your information is secure and will only be used to contact you about your valuation request.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Footer />
    </div>
  );
}
