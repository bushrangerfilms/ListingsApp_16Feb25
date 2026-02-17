import { useState, useEffect } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Upload, FileText, Sparkles } from "lucide-react";
import { PhotoUploader } from "@/components/PhotoUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { listingSchema, ListingFormData } from "@/lib/listingSchema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/hooks/useLocale";
import { useEnergyRatings, useAddressConfig, useBuildingTypes, useMeasurementConfig, useLandMeasurements } from "@/hooks/useRegionConfig";
import { usePropertyServices } from "@/hooks/usePropertyServices";


const CreateListing = () => {
  const { t, currency } = useLocale();
  
  const getCurrencyLabel = () => {
    switch (currency) {
      case 'EUR': return 'Euro (\u20AC)';
      case 'GBP': return 'Pound Sterling (\u00A3)';
      case 'USD': return 'US Dollar ($)';
      default: return currency;
    }
  };
  const energyRatings = useEnergyRatings();
  const addressConfig = useAddressConfig();
  const buildingTypes = useBuildingTypes();
  const measurementConfig = useMeasurementConfig();
  const landMeasurements = useLandMeasurements();
  const { enabledCategories, isLoading: servicesLoading } = usePropertyServices();
  const navigate = useNavigate();
  const location = useLocation();
  const { organization } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [heroPhotoIndex, setHeroPhotoIndex] = useState(0);
  const [socialMediaPhotoIndices, setSocialMediaPhotoIndices] = useState<number[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionImages, setExtractionImages] = useState<File[]>([]);
  const [extractionText, setExtractionText] = useState("");
  const [isEnhancingDescription, setIsEnhancingDescription] = useState(false);
  const [isEnhancingSpecs, setIsEnhancingSpecs] = useState(false);

  const form = useForm<ListingFormData>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      category: "Listing",
      description: "",
      buildingType: undefined,
      isPOA: false,
      price: "",
      bedrooms: "",
      bathrooms: "",
      buildingSize: "",
      landSize: "",
      addressLine1: "",
      addressTown: "",
      county: "",
      eircode: "",
      berRating: undefined,
      specs: "",
      furnishingStatus: undefined,
      bookingPlatformLink: "",
      photos: [],
      heroPhotoIndex: 0,
      socialMediaPhotoIndices: [],
      markAsNew: false,
    },
  });

  // Auto-select first enabled category if default "Listing" is not available
  useEffect(() => {
    if (!servicesLoading && enabledCategories.length > 0) {
      const currentCategory = form.getValues('category');
      if (!enabledCategories.includes(currentCategory as any)) {
        form.setValue('category', enabledCategories[0]);
      }
    }
  }, [servicesLoading, enabledCategories, form]);

  // Restore form data and photos when navigating back from review page
  useEffect(() => {
    const state = location.state as any;
    if (state?.formData && state?.photos) {
      // Restore form values
      form.reset(state.formData);
      
      // Restore photos
      setPhotos(state.photos);
      
      // Restore photo indices
      if (typeof state.heroPhotoIndex === 'number') {
        setHeroPhotoIndex(state.heroPhotoIndex);
      }
      if (Array.isArray(state.socialMediaPhotoIndices)) {
        setSocialMediaPhotoIndices(state.socialMediaPhotoIndices);
      }
      
      // Clear the state to prevent it from persisting
      window.history.replaceState({}, document.title);
    }
  }, [location.state, form]);

  const onSubmit = async (data: ListingFormData) => {
    if (photos.length === 0) {
      toast({
        title: t('listings.toast.photosRequired'),
        description: t('listings.toast.pleaseUploadPhoto'),
        variant: "destructive",
      });
      return;
    }

    // Store form data and navigate to review page
    const formDataToStore = {
      ...data,
      photos: photos.map(photo => ({
        name: photo.name,
        size: photo.size,
        type: photo.type,
      })),
      heroPhotoIndex,
      socialMediaPhotoIndices,
    };
    
    sessionStorage.setItem('listingFormData', JSON.stringify(formDataToStore));
    sessionStorage.setItem('listingPhotos', JSON.stringify(photos.map(p => p.name)));
    
    // Store actual photo files separately
    const photoFilesArray: File[] = [];
    photos.forEach(photo => photoFilesArray.push(photo));
    
    navigate(`/admin/review-listing`, { 
      state: { 
        formData: data, 
        photos: photoFilesArray,
        heroPhotoIndex,
        socialMediaPhotoIndices,
        markAsNew: data.markAsNew
      } 
    });
  };

  const handleExtractFromImage = async () => {
    if (extractionImages.length === 0) {
      toast({
        title: t('listings.create.toast.noImages'),
        description: t('listings.create.toast.pleaseSelectScreenshot'),
        variant: "destructive",
      });
      return;
    }

    setIsExtracting(true);

    try {
      toast({
        title: t('listings.create.toast.extractingDetails'),
        description: t('listings.create.toast.aiAnalyzing', { count: extractionImages.length }),
      });

      // Process all images and combine the results
      let combinedExtracted: any = {};

      for (let i = 0; i < extractionImages.length; i++) {
        const image = extractionImages[i];
        
        // Convert image to base64
        const reader = new FileReader();
        reader.readAsDataURL(image);
        
        await new Promise((resolve) => {
          reader.onload = resolve;
        });

        const base64Image = reader.result as string;

        const { data, error } = await supabase.functions.invoke('extract-property-details', {
          body: { image: base64Image }
        });

        if (error) {
          console.error(`Error extracting from image ${i + 1}:`, error);
          continue;
        }

        if (data?.success && data?.data) {
          const extracted = data.data;
          
          // Merge extracted data, prioritizing non-empty values
          Object.keys(extracted).forEach(key => {
            if (extracted[key] && (!combinedExtracted[key] || combinedExtracted[key] === '')) {
              combinedExtracted[key] = extracted[key];
            } else if (extracted[key] && key === 'description') {
              // Smart merge: normalize and compare to avoid preview text duplication
              const existing = combinedExtracted[key] || '';
              const newText = extracted[key];
              
              if (!existing) {
                combinedExtracted[key] = newText;
              } else {
                // Normalize for comparison (remove extra whitespace, line breaks, ellipsis)
                const normalizeText = (text: string) => 
                  text.replace(/\s+/g, ' ').replace(/\.\.\./g, '').trim().toLowerCase();
                
                const normalizedExisting = normalizeText(existing);
                const normalizedNew = normalizeText(newText);
                
                // Check if one is a substring of the other
                if (normalizedNew.includes(normalizedExisting)) {
                  // New is more complete, use it
                  combinedExtracted[key] = newText;
                } else if (normalizedExisting.includes(normalizedNew)) {
                  // Existing is more complete, keep it
                } else {
                  // Different content, concatenate
                  combinedExtracted[key] = `${existing}\n\n${newText}`;
                }
              }
            } else if (extracted[key] && key === 'specs') {
              // Smart concatenate specs - avoid duplicates
              const existing = combinedExtracted[key] || '';
              const newText = extracted[key];
              // Only add if not a substring and not already included
              if (!existing.includes(newText) && !newText.includes(existing)) {
                combinedExtracted[key] = existing ? `${existing}\n\n${newText}` : newText;
              } else if (newText.length > existing.length) {
                // If the new text is longer and contains the existing, use the new one
                combinedExtracted[key] = newText;
              }
            }
          });
        }
      }

      // Auto-fill form fields with combined extracted data
      if (combinedExtracted.description) form.setValue('description', combinedExtracted.description);
      if (combinedExtracted.buildingType) form.setValue('buildingType', combinedExtracted.buildingType);
      if (combinedExtracted.isPOA !== undefined) {
        form.setValue('isPOA', combinedExtracted.isPOA);
        if (combinedExtracted.isPOA) {
          form.setValue('price', '0');
        }
      }
      if (combinedExtracted.price && !combinedExtracted.isPOA) form.setValue('price', combinedExtracted.price);
      if (combinedExtracted.bedrooms) form.setValue('bedrooms', combinedExtracted.bedrooms);
      if (combinedExtracted.bathrooms) form.setValue('bathrooms', combinedExtracted.bathrooms);
      if (combinedExtracted.buildingSize) form.setValue('buildingSize', combinedExtracted.buildingSize);
      if (combinedExtracted.landSize) {
        const cleaned = combinedExtracted.landSize.replace(/[^\d.]/g, '');
        if (cleaned && !isNaN(parseFloat(cleaned))) form.setValue('landSize', cleaned);
      }
      if (combinedExtracted.addressLine1) form.setValue('addressLine1', combinedExtracted.addressLine1);
      if (combinedExtracted.addressTown) form.setValue('addressTown', combinedExtracted.addressTown);
      if (combinedExtracted.county) form.setValue('county', combinedExtracted.county);
      if (combinedExtracted.eircode) form.setValue('eircode', combinedExtracted.eircode);
      if (combinedExtracted.berRating) form.setValue('berRating', combinedExtracted.berRating);
      if (combinedExtracted.category) form.setValue('category', combinedExtracted.category);
      if (combinedExtracted.specs) form.setValue('specs', combinedExtracted.specs);
      if (combinedExtracted.furnishingStatus) form.setValue('furnishingStatus', combinedExtracted.furnishingStatus);
      if (combinedExtracted.bookingPlatformLink) form.setValue('bookingPlatformLink', combinedExtracted.bookingPlatformLink);

      toast({
        title: t('listings.create.toast.successExtracted'),
        description: t('listings.create.toast.successExtractedDescription', { count: extractionImages.length }),
      });
    } catch (error) {
      console.error('Error extracting property details:', error);
      toast({
        title: t('listings.create.toast.extractionFailed'),
        description: error instanceof Error ? error.message : t('listings.create.toast.extractionFailed'),
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleExtractFromText = async () => {
    if (!extractionText.trim()) {
      toast({
        title: t('listings.create.toast.noTextProvided'),
        description: t('listings.create.toast.pleaseEnterText'),
        variant: "destructive",
      });
      return;
    }

    setIsExtracting(true);

    try {
      toast({
        title: t('listings.create.toast.extractingDetails'),
        description: t('listings.create.toast.aiAnalyzingText'),
      });

      const { data, error } = await supabase.functions.invoke('extract-property-details', {
        body: { text: extractionText }
      });

      if (error) throw error;

      if (data?.success && data?.data) {
        const extracted = data.data;
        
        // Auto-fill form fields with extracted data
        if (extracted.description) form.setValue('description', extracted.description);
        if (extracted.buildingType) form.setValue('buildingType', extracted.buildingType);
        if (extracted.isPOA !== undefined) {
          form.setValue('isPOA', extracted.isPOA);
          if (extracted.isPOA) {
            form.setValue('price', '0');
          }
        }
        if (extracted.price && !extracted.isPOA) form.setValue('price', extracted.price);
        if (extracted.bedrooms) form.setValue('bedrooms', extracted.bedrooms);
        if (extracted.bathrooms) form.setValue('bathrooms', extracted.bathrooms);
        if (extracted.buildingSize) form.setValue('buildingSize', extracted.buildingSize);
        if (extracted.landSize) {
          const cleaned = extracted.landSize.replace(/[^\d.]/g, '');
          if (cleaned && !isNaN(parseFloat(cleaned))) form.setValue('landSize', cleaned);
        }
        if (extracted.addressLine1) form.setValue('addressLine1', extracted.addressLine1);
        if (extracted.addressTown) form.setValue('addressTown', extracted.addressTown);
        if (extracted.county) form.setValue('county', extracted.county);
        if (extracted.eircode) form.setValue('eircode', extracted.eircode);
        if (extracted.berRating) form.setValue('berRating', extracted.berRating);
        if (extracted.category) form.setValue('category', extracted.category);
        if (extracted.specs) form.setValue('specs', extracted.specs);
        if (extracted.furnishingStatus) form.setValue('furnishingStatus', extracted.furnishingStatus);
        if (extracted.bookingPlatformLink) form.setValue('bookingPlatformLink', extracted.bookingPlatformLink);

        toast({
          title: t('listings.create.toast.successExtracted'),
          description: t('listings.create.toast.successExtractedText'),
        });
      } else {
        throw new Error('Failed to extract property details');
      }
    } catch (error) {
      console.error('Error extracting property details:', error);
      toast({
        title: t('listings.create.toast.extractionFailed'),
        description: error instanceof Error ? error.message : t('listings.create.toast.extractionFailed'),
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleEnhanceWithAI = async (type: 'description' | 'specs') => {
    const content = type === 'description' ? form.getValues('description') : form.getValues('specs');
    
    if (!content || content.trim().length < 10) {
      toast({
        title: "Not enough content",
        description: `Please enter at least 10 characters in the ${type} field before enhancing.`,
        variant: "destructive",
      });
      return;
    }

    const setLoading = type === 'description' ? setIsEnhancingDescription : setIsEnhancingSpecs;
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const locale = organization?.locale || 'en-IE';
      const propertyMetadata = {
        category: form.getValues('category'),
        buildingType: form.getValues('buildingType'),
        bedrooms: form.getValues('bedrooms') ? parseInt(form.getValues('bedrooms')) : undefined,
        bathrooms: form.getValues('bathrooms') ? parseFloat(form.getValues('bathrooms')) : undefined,
        town: form.getValues('addressTown'),
        county: form.getValues('county'),
      };

      const response = await supabase.functions.invoke('enhance-listing-copy', {
        body: { type, content, locale, propertyMetadata },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Enhancement failed');
      }

      if (response.data?.success && response.data?.enhancedText) {
        form.setValue(type, response.data.enhancedText);
        toast({
          title: "Enhanced successfully",
          description: `Your ${type} has been improved by AI.`,
        });
      } else {
        throw new Error(response.data?.error || 'No enhanced text returned');
      }
    } catch (error) {
      console.error(`Error enhancing ${type}:`, error);
      toast({
        title: "Enhancement failed",
        description: error instanceof Error ? error.message : "Failed to enhance with AI",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <Link to="/admin/listings">
          <Button variant="ghost" className="gap-2 mb-6">
            <ArrowLeft className="h-4 w-4" />
            {t('listings.create.backToDashboard')}
          </Button>
        </Link>
        
        <div className="bg-card rounded-lg shadow-sm border border-border p-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('listings.create.title')}
          </h1>
          <p className="text-muted-foreground mb-8">
            {t('listings.create.subtitle')}
          </p>

          {/* AI Extraction Section */}
          <Card className="mb-8 bg-accent/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                {t('listings.create.aiExtraction.title')}
              </CardTitle>
              <CardDescription>
                {t('listings.create.aiExtraction.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="image" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="image">{t('listings.create.aiExtraction.screenshots')}</TabsTrigger>
                  <TabsTrigger value="text">Paste property details</TabsTrigger>
                </TabsList>
                
                <TabsContent value="image" className="space-y-4">
                  <div>
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setExtractionImages(files);
                      }}
                      disabled={isExtracting}
                    />
                    {extractionImages.length > 0 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {t('listings.create.aiExtraction.selectedCount', { count: extractionImages.length })}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleExtractFromImage}
                    disabled={extractionImages.length === 0 || isExtracting}
                    className="w-full"
                  >
                    {isExtracting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isExtracting ? t('listings.create.aiExtraction.extracting') : t('listings.create.aiExtraction.extractFromScreenshots')}
                  </Button>
                </TabsContent>
                
                <TabsContent value="text" className="space-y-4">
                  <Textarea
                    placeholder={t('listings.create.aiExtraction.pasteHere')}
                    value={extractionText}
                    onChange={(e) => setExtractionText(e.target.value)}
                    disabled={isExtracting}
                    className="min-h-32"
                  />
                  <Button
                    onClick={handleExtractFromText}
                    disabled={!extractionText.trim() || isExtracting}
                    className="w-full"
                  >
                    {isExtracting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isExtracting ? t('listings.create.aiExtraction.extracting') : t('listings.create.aiExtraction.extractFromText')}
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
              const fieldLabels: Record<string, string> = {
                description: 'Description',
                buildingType: 'Building Type',
                price: 'Price',
                bedrooms: 'Bedrooms',
                bathrooms: 'Bathrooms',
                buildingSize: 'Building Size',
                landSize: 'Land Size',
                addressLine1: 'Address Line 1',
                addressTown: 'Town',
                county: 'County',
                eircode: addressConfig.postalCodeLabel,
                berRating: 'Energy Rating',
                category: 'Category',
                furnishingStatus: 'Furnishing Status',
                bookingPlatformLink: 'Booking Platform Link',
                photos: 'Photos',
                specs: 'Specs',
              };

              const fieldIssues: string[] = [];
              for (const key of Object.keys(errors)) {
                if (key === 'category' && errors.category?.type === 'custom') {
                  const category = form.getValues('category');
                  const isLand = form.getValues('buildingType') === 'Land';
                  const data = form.getValues();

                  if (category === 'Listing') {
                    if (!data.isPOA && (!data.price || !/^\d+(\.\d{1,2})?$/.test(data.price))) fieldIssues.push('Price');
                    if (!data.addressLine1 || data.addressLine1.trim().length < 3) fieldIssues.push('Address Line 1');
                    if (!isLand) {
                      if (!data.bedrooms) fieldIssues.push('Bedrooms');
                      if (!data.bathrooms) fieldIssues.push('Bathrooms');
                    }
                  } else if (category === 'Rental') {
                    if (!data.price || !/^\d+(\.\d{1,2})?$/.test(data.price)) fieldIssues.push('Monthly Rent');
                    if (!data.addressLine1 || data.addressLine1.trim().length < 3) fieldIssues.push('Address Line 1');
                    if (!data.furnishingStatus) fieldIssues.push('Furnishing Status');
                    if (!isLand) {
                      if (!data.bedrooms) fieldIssues.push('Bedrooms');
                      if (!data.bathrooms) fieldIssues.push('Bathrooms');
                    }
                  } else if (category === 'Holiday Rental') {
                    if (!data.bookingPlatformLink || data.bookingPlatformLink.trim().length === 0) fieldIssues.push('Booking Platform Link');
                  }
                  form.clearErrors('category');
                } else {
                  fieldIssues.push(fieldLabels[key] || key);
                }
              }

              const uniqueFields = [...new Set(fieldIssues)];
              toast({
                title: "Please complete required fields",
                description: uniqueFields.length > 0
                  ? uniqueFields.join(', ')
                  : "Some fields need attention. Please review the form.",
                variant: "destructive",
              });
            })} className="space-y-8">
              {/* Category Selection - FIRST FIELD (only show if multiple services enabled) */}
              {enabledCategories.length > 1 && (
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-lg font-semibold">{t('listings.create.category.label')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background" data-testid="select-listing-category">
                            <SelectValue placeholder={t('listings.create.category.label')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover z-50">
                          {enabledCategories.includes('Listing') && (
                            <SelectItem value="Listing" data-testid="option-for-sale">{t('listings.create.category.forSale')}</SelectItem>
                          )}
                          {enabledCategories.includes('Rental') && (
                            <SelectItem value="Rental" data-testid="option-rental">{t('listings.create.category.rental')}</SelectItem>
                          )}
                          {enabledCategories.includes('Holiday Rental') && (
                            <SelectItem value="Holiday Rental" data-testid="option-holiday-rental">{t('listings.create.category.holidayRental')}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {t('listings.create.category.description')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* POA Checkbox - Only for "Listing" */}
              {form.watch('category') === "Listing" && (
                <FormField
                  control={form.control}
                  name="isPOA"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            // When POA is checked, set price to "0"
                            if (checked) {
                              form.setValue('price', '0');
                            } else {
                              form.setValue('price', '');
                            }
                          }}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>{t('listings.create.poa.label')}</FormLabel>
                        <FormDescription>
                          {t('listings.create.poa.description')}
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              )}

              {/* Price - For "Listing" and "Rental" only */}
              {(form.watch('category') === "Listing" || form.watch('category') === "Rental") && (
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {form.watch('category') === "Rental" 
                          ? `Monthly Rent in ${getCurrencyLabel()}` 
                          : `Price in ${getCurrencyLabel()}`}
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={form.watch('category') === "Rental" ? "1200" : "250000"} 
                          {...field} 
                          disabled={form.watch('category') === "Listing" && form.watch('isPOA')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Booking Platform Link - Only for "Holiday Rental" */}
              {form.watch('category') === "Holiday Rental" && (
                <FormField
                  control={form.control}
                  name="bookingPlatformLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('listings.create.bookingLink.label')}</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={t('listings.create.bookingLink.placeholder')}
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        {t('listings.create.bookingLink.description')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Mark as New Checkbox */}
              <FormField
                control={form.control}
                name="markAsNew"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        {t('listings.create.markAsNew.label')}
                      </FormLabel>
                      <FormDescription>
                        {t('listings.create.markAsNew.description')}
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {/* Address Line 1 - Optional for Holiday Rental */}
              <FormField
                control={form.control}
                name="addressLine1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {form.watch('category') === "Holiday Rental" ? t('listings.create.address.line1Optional') : t('listings.create.address.line1')}
                    </FormLabel>
                    <FormControl>
                      <Input placeholder={t('listings.create.address.line1Placeholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Address Town, County/State, Postal Code */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="addressTown"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('listings.create.address.town')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('listings.create.address.townPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* State dropdown for US, County input for others */}
                {addressConfig.stateRequired && addressConfig.states ? (
                  <FormField
                    control={form.control}
                    name="county"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{addressConfig.stateLabel || 'State'}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select State" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-popover z-50 max-h-[300px]">
                            {addressConfig.states.map((state) => (
                              <SelectItem key={state.code} value={state.name}>
                                {state.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="county"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{addressConfig.countyLabel || t('listings.create.address.county')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('listings.create.address.countyPlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {(form.watch('category') === "Listing" || form.watch('category') === "Rental") && (
                  <FormField
                    control={form.control}
                    name="eircode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{addressConfig.postalCodeLabel}</FormLabel>
                        <FormControl>
                          <Input placeholder={addressConfig.postalCodePlaceholder} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Bedrooms & Bathrooms - NOT for Holiday Rental or Land */}
              {form.watch('category') !== "Holiday Rental" && form.watch('buildingType') !== "Land" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="bedrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('listings.create.details.bedrooms')}</FormLabel>
                        <FormControl>
                          <Input placeholder="3" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bathrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('listings.create.details.bathrooms')}</FormLabel>
                        <FormControl>
                          <Input placeholder="2" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Building Size - NOT for Holiday Rental or Land */}
              {form.watch('category') !== "Holiday Rental" && form.watch('buildingType') !== "Land" && (
                <FormField
                  control={form.control}
                  name="buildingSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('listings.create.details.buildingSize')} ({measurementConfig.areaSymbol})
                      </FormLabel>
                      <FormControl>
                        <Input placeholder={measurementConfig.areaUnit === 'sqft' ? '1200' : '120'} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Land Size - NOT for Holiday Rental, REQUIRED for Land type */}
              {form.watch('category') !== "Holiday Rental" && (
                <FormField
                  control={form.control}
                  name="landSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('listings.create.details.landSize')} (Approx.) ({landMeasurements.landSymbol})
                        {form.watch('buildingType') === "Land" && <span className="text-destructive ml-1">*</span>}
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="0.5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Building Type - NOT for Holiday Rental */}
              {form.watch('category') !== "Holiday Rental" && (
                <FormField
                  control={form.control}
                  name="buildingType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('listings.create.details.buildingType')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('listings.create.details.selectBuildingType')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover z-50">
                          {buildingTypes.map((type) => (
                            <SelectItem key={type.code} value={type.code}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Energy Rating - NOT for Holiday Rental or Land, only if enabled in region */}
              {form.watch('category') !== "Holiday Rental" && form.watch('buildingType') !== "Land" && energyRatings.enabled && (
                <FormField
                  control={form.control}
                  name="berRating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{energyRatings.label}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={`Select ${energyRatings.label}`} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover z-50">
                          {energyRatings.ratings.map((rating) => (
                            <SelectItem key={rating.code} value={rating.code}>
                              {rating.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Furnishing Status - Only for Rental */}
              {form.watch('category') === "Rental" && (
                <FormField
                  control={form.control}
                  name="furnishingStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('listings.create.details.furnishingStatus')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder={t('listings.create.details.selectFurnishingStatus')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover z-50">
                          <SelectItem value="Unfurnished">{t('common.unfurnished')}</SelectItem>
                          <SelectItem value="Partially Furnished">{t('common.partiallyFurnished')}</SelectItem>
                          <SelectItem value="Fully Furnished">{t('common.fullyFurnished')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => {
                  const charCount = field.value?.length || 0;
                  const maxChars = 10000;
                  const isOverLimit = charCount > maxChars;
                  const charsOver = charCount - maxChars;
                  
                  return (
                    <FormItem>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <FormLabel>{t('listings.create.details.description')}</FormLabel>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleEnhanceWithAI('description')}
                          disabled={isEnhancingDescription || isExtracting || !field.value || field.value.length < 10}
                          data-testid="button-enhance-description"
                        >
                          {isEnhancingDescription ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-1" />
                          )}
                          {isEnhancingDescription ? "Enhancing..." : "Enhance with AI"}
                        </Button>
                      </div>
                      <FormControl>
                        <Textarea
                          placeholder={t('listings.create.details.descriptionPlaceholder')}
                          className="min-h-48 whitespace-pre-wrap"
                          {...field}
                        />
                      </FormControl>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <FormDescription>
                          {t('common.pasteFormattedText')}
                        </FormDescription>
                        <span className={`text-xs ${isOverLimit ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          {charCount}/{maxChars}
                          {isOverLimit && ` (${charsOver} over limit)`}
                        </span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              {/* Specs/Features - Label changes based on category */}
              <FormField
                control={form.control}
                name="specs"
                render={({ field }) => {
                  const charCount = field.value?.length || 0;
                  const maxChars = 3000;
                  const isOverLimit = charCount > maxChars;
                  const charsOver = charCount - maxChars;
                  
                  return (
                    <FormItem>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <FormLabel>
                          {form.watch('category') === "Rental" ? t('common.features') : t('listings.create.details.specs')}
                        </FormLabel>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleEnhanceWithAI('specs')}
                          disabled={isEnhancingSpecs || isExtracting || !field.value || field.value.length < 10}
                          data-testid="button-enhance-specs"
                        >
                          {isEnhancingSpecs ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-1" />
                          )}
                          {isEnhancingSpecs ? "Enhancing..." : "Enhance with AI"}
                        </Button>
                      </div>
                      <FormControl>
                        <Textarea
                          placeholder={t('listings.create.details.specsPlaceholder')}
                          className="min-h-32 whitespace-pre-wrap"
                          {...field}
                        />
                      </FormControl>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <FormDescription>
                          {form.watch('category') === "Rental" 
                            ? t('common.listAmenities')
                            : t('common.pasteFormattedText')
                          }
                        </FormDescription>
                        <span className={`text-xs ${isOverLimit ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          {charCount}/{maxChars}
                          {isOverLimit && ` (${charsOver} over limit)`}
                        </span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              {/* Photos */}
              <div>
                <PhotoUploader
                  photos={photos}
                  heroPhotoIndex={heroPhotoIndex}
                  socialMediaPhotoIndices={socialMediaPhotoIndices}
                  onPhotosChange={(newPhotos) => {
                    setPhotos(newPhotos);
                    form.setValue("photos", newPhotos);
                    form.setValue("heroPhotoIndex", heroPhotoIndex);
                    // Reset social media selections if photos are removed
                    if (newPhotos.length < photos.length) {
                      setSocialMediaPhotoIndices([]);
                    }
                  }}
                  onHeroPhotoChange={(newIndex) => {
                    setHeroPhotoIndex(newIndex);
                  }}
                  onSocialMediaSelectionChange={(indices) => {
                    setSocialMediaPhotoIndices(indices);
                    form.setValue("socialMediaPhotoIndices", indices);
                  }}
                />
                {form.formState.errors.photos && (
                  <p className="text-sm text-destructive mt-2">
                    {form.formState.errors.photos.message}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/admin/listings`)}
                  disabled={isSubmitting}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit">
                  {t('common.next')}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default CreateListing;
