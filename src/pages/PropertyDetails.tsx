import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Bed, Bath, Home, ArrowLeft, Loader2, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { PublicHeader } from '@/components/PublicHeader';
import { Footer } from '@/components/Footer';
import { CookieConsent } from '@/components/CookieConsent';
import { SEO } from '@/components/SEO';
import { AIAssistantWidget } from '@/components/AIAssistantWidget';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePublicListings } from '@/contexts/PublicListingsContext';

interface PropertyDetails {
  id: string;
  title: string;
  status: string;
  price: number;
  priceOnApplication: boolean;
  addressLine1: string;
  addressLine2?: string;
  addressTown: string;
  county: string;
  eircode?: string;
  bedrooms: number;
  bathrooms: number;
  buildingType: string;
  buildingSize?: string;
  landSize?: number;
  berRating?: string;
  description: string;
  specs?: string;
  heroPhoto: string;
  photos: string[];
  datePosted: string;
}

export default function PropertyDetails() {
  const { id, orgSlug } = useParams<{ id: string; orgSlug?: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { organization, setOrganizationBySlug } = useOrganization();
  const { organization: domainOrg, isPublicSite: isDomainBased, loading: domainLoading } = usePublicListings();
  const [property, setProperty] = useState<PropertyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [domainError, setDomainError] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Clear property state when orgSlug or id changes to prevent showing stale data from previous tenant
  useEffect(() => {
    setProperty(null);
    setLoading(true);
    setError(null);
    setDomainError(false);
  }, [orgSlug, id]);
  const [enquiryForm, setEnquiryForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
    gdprConsent: false,
  });

  // Restore draft on mount
  useEffect(() => {
    if (!id) return;
    
    const draftKey = `enquiry-draft-${id}`;
    const savedDraft = localStorage.getItem(draftKey);
    
    if (savedDraft) {
      try {
        const { data, timestamp } = JSON.parse(savedDraft);
        const hoursSinceCreated = (Date.now() - timestamp) / (1000 * 60 * 60);
        
        // Only restore drafts less than 24 hours old
        if (hoursSinceCreated < 24) {
          setEnquiryForm(data);
          toast.info('Draft restored from your last visit');
        } else {
          localStorage.removeItem(draftKey);
        }
      } catch (error) {
        console.error('Error restoring draft:', error);
        localStorage.removeItem(draftKey);
      }
    }
  }, [id]);

  // Auto-save draft with debounce
  useEffect(() => {
    if (!id) return;
    
    // Don't save if form is completely empty
    const hasContent = enquiryForm.name || enquiryForm.email || enquiryForm.phone || enquiryForm.message;
    if (!hasContent) return;

    const timeoutId = setTimeout(() => {
      const draftKey = `enquiry-draft-${id}`;
      const draftData = {
        data: enquiryForm,
        timestamp: Date.now()
      };
      
      localStorage.setItem(draftKey, JSON.stringify(draftData));
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [enquiryForm, id]);

  const trackListingView = async (title: string) => {
    if (!id || isAdmin) return;
    
    try {
      await supabase.from('listing_views').insert({
        listing_id: id,
        listing_title: title,
      });
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  };

  const fetchPropertyDetails = useCallback(async () => {
    try {
      // Derive clientSlug with strict precedence to avoid stale context:
      // 1. Domain mode: use domainOrg.slug only
      // 2. Slug mode: use fresh orgSlug from URL (no stale organization fallback)
      let clientSlug: string | undefined;
      
      if (isDomainBased) {
        // Domain-based: must use domainOrg
        clientSlug = domainOrg?.slug;
      } else {
        // Slug-based: use fresh orgSlug from URL (default to bridge-auctioneers for backwards compatibility)
        clientSlug = orgSlug || 'bridge-auctioneers';
      }
      
      if (!clientSlug) {
        console.error('No client slug available');
        setError('Organization not found');
        setLoading(false);
        return;
      }
      
      console.log('Fetching property with ID:', id);
      console.log('Using organization:', isDomainBased ? domainOrg?.slug : orgSlug);
      console.log('Client slug:', clientSlug);
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-listings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            clientSlug,
            recordId: id,
            isPublic: true,
          }),
        }
      );

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        setError(`Failed to load property (Error ${response.status})`);
        return;
      }

      const data = await response.json();
      console.log('API Response:', data);
      console.log('Property specs:', data.listings?.[0]?.specs);
      
      if (data.success && data.listings && data.listings.length > 0) {
        console.log('Setting property:', data.listings[0]);
        const propertyData = data.listings[0];
        setProperty(propertyData);
        setError(null);
        
        // Track the view after we have the property data
        trackListingView(propertyData.title);
      } else {
        console.error('No property found in response:', data);
        setError('Property not found');
      }
    } catch (error) {
      console.error('Error fetching property:', error);
      setError('Failed to load property. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id, organization, domainOrg, isDomainBased, orgSlug, isAdmin]);

  useEffect(() => {
    console.log('PropertyDetails effect - isDomainBased:', isDomainBased, 'orgSlug:', orgSlug, 'domainOrg:', domainOrg, 'domainLoading:', domainLoading);
    
    // For domain-based access (production custom domains), wait for domain detection
    if (isDomainBased) {
      // Wait for domain detection to complete
      if (domainLoading) {
        console.log('[PropertyDetails] Waiting for domain detection...');
        return;
      }
      
      // If domain-based but no org found, show error (don't leak other tenant's data)
      if (!domainOrg) {
        console.error('[PropertyDetails] Domain not configured for this hostname');
        setDomainError(true);
        setLoading(false);
        return;
      }
      
      // Use domain-based organization
      setDomainError(false);
      fetchPropertyDetails();
      return;
    }
    
    // For slug-based access (dev or admin portal), fetch using orgSlug from URL
    // Default to 'bridge-auctioneers' for backwards compatibility when no slug in URL
    setDomainError(false);
    const effectiveSlug = orgSlug || 'bridge-auctioneers';
    console.log('[PropertyDetails] Fetching via slug-based access:', effectiveSlug);
    fetchPropertyDetails();
  }, [organization, domainOrg, isDomainBased, domainLoading, orgSlug, fetchPropertyDetails]);

  const handleEnquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
    
    console.log('=== ENQUIRY SUBMISSION STARTED ===');
    console.log('Property:', property);
    console.log('Form data:', enquiryForm);
    console.log('Client slug:', clientSlug);
    console.log('Source:', isDomainBased ? 'domain' : 'slug-based');
    
    if (!property) {
      console.error('No property found');
      return;
    }
    
    // Block submission if no client slug (prevent tenant leakage)
    if (!clientSlug) {
      toast.error('Organization not found. Please try again.');
      console.error('No client slug for enquiry submission', { 
        isDomainBased, 
        domainOrg: domainOrg?.slug, 
        orgSlug,
        organizationSlug: organization?.slug 
      });
      return;
    }

    if (!enquiryForm.gdprConsent) {
      console.log('GDPR consent not given');
      toast.error('Please accept the privacy policy to continue');
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('Invoking submit-property-enquiry function...');
      const { data, error } = await supabase.functions.invoke('submit-property-enquiry', {
        body: {
          propertyId: property.id,
          propertyTitle: property.title,
          name: enquiryForm.name,
          email: enquiryForm.email,
          phone: enquiryForm.phone,
          message: enquiryForm.message,
          clientSlug,
        }
      });

      console.log('Function response - data:', data);
      console.log('Function response - error:', error);

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (data?.success) {
        console.log('✅ Enquiry submitted successfully!');
        toast.success('Enquiry sent successfully! We\'ll be in touch soon.');
        
        // Clear form and draft
        setEnquiryForm({ name: '', email: '', phone: '', message: '', gdprConsent: false });
        if (id) {
          localStorage.removeItem(`enquiry-draft-${id}`);
        }
      } else {
        console.error('Unexpected response format:', data);
        toast.error('Failed to send enquiry. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error submitting enquiry:', error);
      toast.error('Failed to send enquiry. Please try again.');
    } finally {
      setIsSubmitting(false);
      console.log('=== ENQUIRY SUBMISSION ENDED ===');
    }
  };

  const isNew = () => {
    if (!property) return false;
    const posted = new Date(property.datePosted);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 30 && property.status === 'Published';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (domainError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <CardContent className="text-center space-y-4">
            <h1 className="text-2xl font-bold">Domain Not Configured</h1>
            <p className="text-muted-foreground">This domain is not associated with any organization. Please contact support.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Error Loading Property</h2>
          <p className="text-muted-foreground">{error || 'Property not found'}</p>
          <div className="flex gap-4 justify-center">
            <Button onClick={() => window.location.reload()}>Try Again</Button>
            <Button variant="outline" onClick={() => navigate(orgSlug ? `/${orgSlug}` : '/')}>
              Back to Listings
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const allImages = [
    property.heroPhoto,
    ...(property.photos || []).filter(photo => photo !== property.heroPhoto)
  ].filter(Boolean);

  console.log('PropertyDetails - heroPhoto:', property.heroPhoto);
  console.log('PropertyDetails - photos array:', property.photos);
  console.log('PropertyDetails - allImages:', allImages);

  const businessName = organization?.business_name || 'Property Management';
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO 
        title={`${property.title} - ${businessName}`}
        description={property.description.substring(0, 160)}
        ogImage={property.heroPhoto}
      />
      <PublicHeader />
      <CookieConsent />

      {/* Back Button */}
      <div className="container mx-auto px-4 py-6">
        <Button 
          variant="ghost" 
          className="gap-2"
          onClick={() => navigate(orgSlug ? `/${orgSlug}` : '/')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Properties
        </Button>
      </div>

      {/* Property Details */}
      <div className="container mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Images and Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Image */}
            <div className="relative">
              {isNew() && (
                <div className="absolute top-4 left-4 bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded shadow-lg z-10">
                  NEW
                </div>
              )}
              {property.status === 'Sale Agreed' && (
                <div className="absolute top-4 left-4 bg-orange-500 text-white text-sm font-bold px-4 py-2 rounded shadow-lg z-10">
                  SALE AGREED
                </div>
              )}
              {property.status === 'Sold' && (
                <div className="absolute top-4 left-4 bg-red-500 text-white text-sm font-bold px-4 py-2 rounded shadow-lg z-10">
                  SOLD
                </div>
              )}
              <img
                src={allImages[selectedImage]}
                alt={property.title}
                className="w-full aspect-[4/3] object-contain rounded-lg bg-muted"
              />
            </div>

            {/* Image Carousel */}
            {allImages.length > 1 && (
              <div className="relative">
                <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
                  {allImages.map((image, index) => (
                    <img
                      key={index}
                      src={image}
                      alt={`${property.title} - ${index + 1}`}
                      className={`flex-shrink-0 w-32 h-24 object-cover rounded cursor-pointer transition-all snap-start ${
                        selectedImage === index ? 'ring-2 ring-primary scale-105' : 'opacity-70 hover:opacity-100'
                      }`}
                      onClick={() => setSelectedImage(index)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Price Card */}
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground mb-2">Price</p>
                <p className="text-3xl font-bold text-primary">
                  {property.priceOnApplication ? 'POA' : `€${property.price.toLocaleString()}`}
                </p>
              </CardContent>
            </Card>

            {/* Property Info */}
            <Card>
              <CardContent className="p-6 space-y-4">
                 <div>
                   <h1 className="text-3xl font-bold mb-2">{property.title}</h1>
                   <div className="flex items-start gap-2 text-lg text-muted-foreground">
                     <MapPin className="h-5 w-5 mt-0.5 flex-shrink-0" />
                     <div>
                       <p>{property.addressLine1}</p>
                       {property.addressLine2 && <p>{property.addressLine2}</p>}
                       <p>{property.addressTown}, {property.county}</p>
                       {property.eircode && <p className="font-semibold">{property.eircode}</p>}
                     </div>
                   </div>
                 </div>

                <div className="flex items-center gap-6 py-4 border-y flex-wrap">
                  <div className="flex items-center gap-2">
                    <Bed className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold">{property.bedrooms} Bedrooms</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Bath className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold">{property.bathrooms} Bathrooms</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Home className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold">{property.buildingType}</span>
                  </div>
                  {property.buildingSize && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Building Size:</span>
                      <span className="font-semibold">{property.buildingSize} m²</span>
                    </div>
                  )}
                  {property.landSize && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Land Size:</span>
                      <span className="font-semibold">Approx. {property.landSize} acres</span>
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="text-xl font-semibold mb-2">Description</h2>
                  <p className="text-muted-foreground whitespace-pre-wrap">{property.description}</p>
                </div>

                <div>
                  <h2 className="text-xl font-semibold mb-2">Specifications</h2>
                  {property.specs ? (
                    <p className="text-muted-foreground whitespace-pre-wrap">{property.specs}</p>
                  ) : (
                    <p className="text-muted-foreground italic">No specifications available</p>
                  )}
                </div>

                 {property.berRating && (
                   <div>
                     <p className="text-sm text-muted-foreground">BER Rating</p>
                     <Badge variant="outline">{property.berRating}</Badge>
                   </div>
                 )}
               </CardContent>
             </Card>

             {/* Location Map */}
             {property.eircode && (
               <Card>
                 <CardContent className="p-6 space-y-4">
                   <h2 className="text-xl font-semibold">Location</h2>
                   <div className="w-full h-[400px] rounded-lg overflow-hidden">
                     <iframe
                       width="100%"
                       height="100%"
                       frameBorder="0"
                       style={{ border: 0 }}
                       src={`https://maps.google.com/maps?q=${encodeURIComponent(property.eircode)}&output=embed`}
                       allowFullScreen
                       loading="lazy"
                     />
                   </div>
                 </CardContent>
               </Card>
             )}
           </div>

          {/* Right Column - Enquiry */}
          <div className="space-y-6">

            {/* Enquiry Form */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4">Enquire About This Property</h3>
                <form onSubmit={handleEnquirySubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Your Name *</Label>
                    <Input
                      id="name"
                      placeholder="John Doe"
                      value={enquiryForm.name}
                      onChange={(e) => setEnquiryForm({ ...enquiryForm, name: e.target.value })}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Your Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={enquiryForm.email}
                      onChange={(e) => setEnquiryForm({ ...enquiryForm, email: e.target.value })}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Your Phone *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+353 123 4567"
                      value={enquiryForm.phone}
                      onChange={(e) => setEnquiryForm({ ...enquiryForm, phone: e.target.value })}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <Label htmlFor="message">Your Message</Label>
                    <Textarea
                      id="message"
                      placeholder="I'm interested in this property..."
                      value={enquiryForm.message}
                      onChange={(e) => setEnquiryForm({ ...enquiryForm, message: e.target.value })}
                      rows={4}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="gdprConsent"
                      checked={enquiryForm.gdprConsent}
                      onCheckedChange={(checked) => 
                        setEnquiryForm({ ...enquiryForm, gdprConsent: checked as boolean })
                      }
                      disabled={isSubmitting}
                    />
                    <Label htmlFor="gdprConsent" className="text-sm leading-tight cursor-pointer">
                      I agree to the <Link to="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link> and 
                      consent to {businessName} processing my data for this enquiry *
                    </Label>
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting || !enquiryForm.gdprConsent}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send Enquiry'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
      
      <AIAssistantWidget />
    </div>
  );
}
