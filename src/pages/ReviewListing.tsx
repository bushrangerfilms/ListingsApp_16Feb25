import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import type { ListingFormData } from "@/lib/listingSchema";

const ReviewListing = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<ListingFormData | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [heroPhotoIndex, setHeroPhotoIndex] = useState(0);
  const [socialMediaPhotoIndices, setSocialMediaPhotoIndices] = useState<number[]>([]);
  const [propertyTitle, setPropertyTitle] = useState("");
  const [markAsNew, setMarkAsNew] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const specsRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (location.state) {
      const data = location.state.formData;
      setFormData(data);
      setPhotos(location.state.photos || []);
      setHeroPhotoIndex(location.state.heroPhotoIndex || 0);
      setSocialMediaPhotoIndices(location.state.socialMediaPhotoIndices || []);
      setMarkAsNew(location.state.markAsNew || false);
      
      // Generate property title based on category
      if (data) {
        let title = '';
        if (data.category === 'Holiday Rental') {
          title = `Holiday Rental in ${data.addressTown || ''}, ${data.county || ''}`;
        } else {
          title = `${data.bedrooms || ''} Bed, ${data.bathrooms || ''} Bath ${data.buildingType || ''} in ${data.addressTown || ''}, ${data.county || ''}`;
        }
        setPropertyTitle(title);
      }
    } else {
      // If no state, redirect back to create listing
      navigate(`/admin/create`);
    }
  }, [location.state, navigate]);

  useEffect(() => {
    // Auto-resize textareas on mount and when content changes
    if (descriptionRef.current) {
      descriptionRef.current.style.height = 'auto';
      descriptionRef.current.style.height = descriptionRef.current.scrollHeight + 'px';
    }
    if (specsRef.current) {
      specsRef.current.style.height = 'auto';
      specsRef.current.style.height = specsRef.current.scrollHeight + 'px';
    }
  }, [formData?.description, formData?.specs]);

  const handleFieldUpdate = (field: keyof ListingFormData, value: any) => {
    if (formData) {
      setFormData({ ...formData, [field]: value });
    }
  };

  const getMissingFields = () => {
    if (!formData) return [];
    const missing: string[] = [];
    
    // Common required fields
    if (!formData.description || formData.description.length < 20) missing.push("Description");
    if (!formData.addressTown?.trim()) missing.push("Town");
    if (!formData.county?.trim()) missing.push("County");
    
    // Category-specific validation
    if (formData.category === 'Listing') {
      if (!formData.isPOA && (!formData.price || formData.price === '0')) {
        missing.push("Price (or select POA)");
      }
      if (!formData.addressLine1?.trim()) missing.push("Address Line 1");
      if (!formData.eircode?.trim()) missing.push("Eircode");
      if (!formData.bedrooms) missing.push("Bedrooms");
      if (!formData.bathrooms) missing.push("Bathrooms");
      if (!formData.buildingType) missing.push("Building Type");
    }
    
    if (formData.category === 'Rental') {
      if (!formData.price || formData.price === '0') missing.push("Monthly Rent");
      if (!formData.addressLine1?.trim()) missing.push("Address Line 1");
      if (!formData.eircode?.trim()) missing.push("Eircode");
      if (!formData.bedrooms) missing.push("Bedrooms");
      if (!formData.bathrooms) missing.push("Bathrooms");
      if (!formData.buildingType) missing.push("Building Type");
      if (!formData.furnishingStatus) missing.push("Furnishing Status");
    }
    
    if (formData.category === 'Holiday Rental') {
      if (!formData.bookingPlatformLink?.trim()) missing.push("Booking Platform Link");
    }
    
    return missing;
  };

  const handleConfirmAndPost = async () => {
    if (!formData || !organization) {
      toast({
        title: "Organization not found",
        description: "Please refresh the page and try again",
        variant: "destructive",
      });
      return;
    }

    const missingFields = getMissingFields();
    if (missingFields.length > 0) {
      toast({
        title: "Missing required fields",
        description: `Please fill in: ${missingFields.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    if (photos.length === 0) {
      toast({
        title: "Missing photos",
        description: "Please add at least one photo",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 1: Check rate limit
      const { data: rateLimitData, error: rateLimitError } = await supabase.functions.invoke(
        "check-rate-limit",
        {
          body: { clientSlug: organization.slug },
        }
      );

      if (rateLimitError || !rateLimitData?.allowed) {
        const remaining = rateLimitData?.remainingTime || "some time";
        toast({
          title: "Rate limit exceeded",
          description: `Please wait ${remaining} before submitting another listing`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Step 2: Process and upload images in batches
      toast({
        title: "Processing photos",
        description: `Uploading ${photos.length} images in batches...`,
      });

      // Process images in batches of 20 to avoid payload size limits
      const BATCH_SIZE = 20;
      const batches = [];
      for (let i = 0; i < photos.length; i += BATCH_SIZE) {
        batches.push(photos.slice(i, i + BATCH_SIZE));
      }

      let allPhotoUrls: string[] = [];
      let heroPhotoUrl = '';

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchStartIndex = batchIndex * BATCH_SIZE;
        
        toast({
          title: "Processing photos",
          description: `Uploading batch ${batchIndex + 1} of ${batches.length} (${batch.length} images)...`,
        });

        const imageFormData = new FormData();
        batch.forEach((photo) => {
          imageFormData.append("images", photo);
        });
        
        // Adjust hero index for this batch
        const batchHeroIndex = (heroPhotoIndex >= batchStartIndex && heroPhotoIndex < batchStartIndex + batch.length)
          ? heroPhotoIndex - batchStartIndex
          : -1;
        
        imageFormData.append("heroIndex", batchHeroIndex.toString());
        imageFormData.append("clientSlug", organization.slug);

        const { data: imageData, error: imageError } = await supabase.functions.invoke(
          "process-images",
          {
            body: imageFormData,
          }
        );

        if (imageError || !imageData?.photoUrls) {
          throw new Error(`Failed to upload photo batch ${batchIndex + 1}: ${imageError?.message || 'Unknown error'}`);
        }

        allPhotoUrls = allPhotoUrls.concat(imageData.photoUrls);
        
        // Capture hero photo URL if it's in this batch
        if (batchHeroIndex >= 0 && imageData.heroPhotoUrl) {
          heroPhotoUrl = imageData.heroPhotoUrl;
        }
      }

      // If hero photo wasn't set, use the first photo
      if (!heroPhotoUrl && allPhotoUrls.length > 0) {
        heroPhotoUrl = allPhotoUrls[heroPhotoIndex] || allPhotoUrls[0];
      }

      const imageData = {
        photoUrls: allPhotoUrls,
        heroPhotoUrl: heroPhotoUrl,
        count: allPhotoUrls.length
      };

      // Step 3: Create listing in database
      toast({
        title: "Creating listing",
        description: "Saving listing...",
      });

      // Generate a title from property details based on category
      let generatedTitle = '';
      if (formData.category === 'Holiday Rental') {
        generatedTitle = `Holiday Rental in ${formData.addressTown}, ${formData.county}`;
      } else {
        generatedTitle = `${formData.buildingType} in ${formData.addressTown}, ${formData.county}`;
      }
      
      // Construct social media photo URLs (hero first + up to 15 unique social media photos)
      const socialMediaPhotoUrls = socialMediaPhotoIndices.length > 0
        ? [
            imageData.heroPhotoUrl, // Hero is always first
            ...socialMediaPhotoIndices
              .filter(index => index !== heroPhotoIndex) // Exclude hero if it was selected in social media
              .map(index => imageData.photoUrls[index])
              .filter(url => url) // Remove any null/undefined URLs
          ]
        : [imageData.heroPhotoUrl]; // Just hero if no social media photos selected
      
      const listingData = {
        clientSlug: organization.slug,
        organizationId: organization.id,
        title: propertyTitle,
        description: formData.description,
        buildingType: formData.buildingType,
        isPOA: formData.isPOA || false,
        price: (formData.isPOA || !formData.price) ? 0 : parseFloat(formData.price),
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : undefined,
        bathrooms: formData.bathrooms ? parseFloat(formData.bathrooms) : undefined,
        buildingSize: formData.buildingSize ? parseFloat(formData.buildingSize) : undefined,
        landSize: formData.landSize ? parseFloat(formData.landSize) : undefined,
        addressLine1: formData.addressLine1 || "",
        addressTown: formData.addressTown,
        county: formData.county,
        eircode: formData.eircode,
        berRating: formData.berRating || "",
        specs: formData.specs || "",
        category: formData.category || "Listing",
        furnishingStatus: formData.furnishingStatus,
        bookingPlatformLink: formData.bookingPlatformLink,
        photoUrls: imageData.photoUrls,
        heroPhotoUrl: imageData.heroPhotoUrl,
        socialMediaPhotoUrls,
        markAsNew: markAsNew,
      };

      const { data: createData, error: createError } = await supabase.functions.invoke(
        "create-listing",
        {
          body: listingData,
        }
      );

      if (createError || !createData?.success) {
        let errorMessage = "Failed to create listing";
        if (createData?.error) {
          errorMessage = createData.error;
        } else if (createError?.message) {
          errorMessage = createError.message;
        }
        if (createData?.details) {
          errorMessage += `: ${createData.details}`;
        }
        console.error("Create listing error details:", { createError, createData });
        throw new Error(errorMessage);
      }

      toast({
        title: "Success!",
        description: "Listing created successfully",
      });

      navigate(`/admin/listings`);
    } catch (error) {
      console.error("Error creating listing:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create listing",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!formData) {
    return <div>Loading...</div>;
  }

  const missingFields = getMissingFields();

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(`/admin/create`, { 
              state: { 
                formData, 
                photos, 
                heroPhotoIndex, 
                socialMediaPhotoIndices 
              } 
            })}
            className="inline-flex items-center text-sm"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Edit
          </Button>
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Review Your Listing</h1>
            <p className="text-muted-foreground mt-2">
              Review and edit your listing details before posting
            </p>
          </div>

          {/* Photo Display */}
          {photos.length > 0 && (
            <Card>
              <CardContent className="p-6 space-y-4">
                {/* Hero Photo */}
                <div className="w-full aspect-square overflow-hidden rounded-lg">
                  <img
                    src={URL.createObjectURL(photos[heroPhotoIndex])}
                    alt="Hero photo"
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* Other Photos Grid */}
                {photos.length > 1 && (
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                    {photos.map((photo, index) => (
                      <div
                        key={index}
                        className={`aspect-square overflow-hidden rounded-md ${
                          index === heroPhotoIndex ? 'ring-2 ring-primary' : ''
                        }`}
                      >
                        <img
                          src={URL.createObjectURL(photo)}
                          alt={`Photo ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Property Title */}
                <div className="pt-4">
                  <Label htmlFor="propertyTitle" className="text-base">Property Title</Label>
                  <Input
                    id="propertyTitle"
                    value={propertyTitle}
                    onChange={(e) => setPropertyTitle(e.target.value)}
                    className="text-xl font-bold mt-2"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {missingFields.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Missing required fields: {missingFields.join(", ")}
              </AlertDescription>
            </Alert>
          )}

          {markAsNew && (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                ✨ This listing will display a NEW banner for 2 weeks
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Property Details</CardTitle>
              <CardDescription>Review and edit if needed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Category Display */}
              <div>
                <Label>Category</Label>
                <div className="text-lg font-semibold">{formData.category || "Listing"}</div>
              </div>

              {/* POA Checkbox - Only for Listing */}
              {formData.category === 'Listing' && (
                <div className="flex items-center space-x-2 rounded-md border p-4">
                  <Checkbox
                    id="isPOA"
                    checked={formData.isPOA || false}
                    onCheckedChange={(checked) => {
                      handleFieldUpdate('isPOA', checked);
                      if (checked) {
                        handleFieldUpdate('price', '0');
                      }
                    }}
                  />
                  <div className="space-y-1">
                    <label htmlFor="isPOA" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Price on Application (POA)
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Check this if the price is not publicly listed
                    </p>
                  </div>
                </div>
              )}

              {/* Price - Only for Listing and Rental */}
              {(formData.category === 'Listing' || formData.category === 'Rental') && (
                <div className={!formData.price && formData.category === 'Listing' && !formData.isPOA ? "border-2 border-amber-500 rounded-md p-2" : ""}>
                  <Label htmlFor="price">
                    {formData.category === 'Rental' ? 'Monthly Rent (€)' : 'Price (€)'}
                  </Label>
                  {formData.isPOA && formData.category === 'Listing' ? (
                    <div className="text-2xl font-bold py-2">POA</div>
                  ) : (
                    <Input
                      id="price"
                      value={formData.price}
                      onChange={(e) => handleFieldUpdate("price", e.target.value)}
                      placeholder={!formData.price ? "EMPTY" : formData.category === 'Rental' ? "1200" : "250000"}
                      className={!formData.price ? "placeholder:text-amber-500" : ""}
                    />
                  )}
                </div>
              )}

              {/* Booking Platform Link - Only for Holiday Rental */}
              {formData.category === 'Holiday Rental' && (
                <div className={!formData.bookingPlatformLink ? "border-2 border-amber-500 rounded-md p-2" : ""}>
                  <Label htmlFor="bookingPlatformLink">Booking Platform Link</Label>
                  <Input
                    id="bookingPlatformLink"
                    type="url"
                    value={formData.bookingPlatformLink || ''}
                    onChange={(e) => handleFieldUpdate('bookingPlatformLink', e.target.value)}
                    placeholder={!formData.bookingPlatformLink ? "EMPTY" : "https://airbnb.com/rooms/123456"}
                    className={!formData.bookingPlatformLink ? "placeholder:text-amber-500" : ""}
                  />
                </div>
              )}

              {/* Building Type - Not for Holiday Rental */}
              {formData.category !== 'Holiday Rental' && (
                <div className={!formData.buildingType ? "border-2 border-amber-500 rounded-md p-2" : ""}>
                  <Label htmlFor="buildingType">Building Type</Label>
                  <Select
                    value={formData.buildingType}
                    onValueChange={(value) => handleFieldUpdate("buildingType", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Detached">Detached</SelectItem>
                      <SelectItem value="Semi-Detached">Semi-Detached</SelectItem>
                      <SelectItem value="Terrace">Terrace</SelectItem>
                      <SelectItem value="Apartment">Apartment</SelectItem>
                      <SelectItem value="Commercial">Commercial</SelectItem>
                      <SelectItem value="Land">Land</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Furnishing Status - Only for Rental */}
              {formData.category === 'Rental' && (
                <div className={!formData.furnishingStatus ? "border-2 border-amber-500 rounded-md p-2" : ""}>
                  <Label htmlFor="furnishingStatus">Furnishing Status</Label>
                  <Select
                    value={formData.furnishingStatus || ''}
                    onValueChange={(value) => handleFieldUpdate('furnishingStatus', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select furnishing status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Unfurnished">Unfurnished</SelectItem>
                      <SelectItem value="Partially Furnished">Partially Furnished</SelectItem>
                      <SelectItem value="Fully Furnished">Fully Furnished</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Bedrooms & Bathrooms - Not for Holiday Rental */}
              {formData.category !== 'Holiday Rental' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={!formData.bedrooms ? "border-2 border-amber-500 rounded-md p-2" : ""}>
                    <Label htmlFor="bedrooms">Bedrooms</Label>
                    <Input
                      id="bedrooms"
                      value={formData.bedrooms}
                      onChange={(e) => handleFieldUpdate("bedrooms", e.target.value)}
                      placeholder={!formData.bedrooms ? "EMPTY" : "3"}
                      className={!formData.bedrooms ? "placeholder:text-amber-500" : ""}
                    />
                  </div>

                  <div className={!formData.bathrooms ? "border-2 border-amber-500 rounded-md p-2" : ""}>
                    <Label htmlFor="bathrooms">Bathrooms</Label>
                    <Input
                      id="bathrooms"
                      value={formData.bathrooms}
                      onChange={(e) => handleFieldUpdate("bathrooms", e.target.value)}
                      placeholder={!formData.bathrooms ? "EMPTY" : "2"}
                      className={!formData.bathrooms ? "placeholder:text-amber-500" : ""}
                    />
                  </div>
                </div>
              )}

              {/* Building Size & Land Size - Not for Holiday Rental */}
              {formData.category !== 'Holiday Rental' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="buildingSize">Building Size (m²)</Label>
                    <Input
                      id="buildingSize"
                      value={formData.buildingSize || ""}
                      onChange={(e) => handleFieldUpdate("buildingSize", e.target.value)}
                      placeholder={!formData.buildingSize ? "EMPTY" : "102"}
                      className={!formData.buildingSize ? "placeholder:text-amber-500" : ""}
                    />
                  </div>

                  <div>
                    <Label htmlFor="landSize">Land Size (Approx.) (Acres)</Label>
                    <Input
                      id="landSize"
                      value={formData.landSize || ""}
                      onChange={(e) => handleFieldUpdate("landSize", e.target.value)}
                      placeholder={!formData.landSize ? "EMPTY" : "2.50"}
                      className={!formData.landSize ? "placeholder:text-amber-500" : ""}
                    />
                  </div>
                </div>
              )}

              <div className={formData.category !== 'Holiday Rental' && !formData.addressLine1 ? "border-2 border-amber-500 rounded-md p-2" : ""}>
                <Label htmlFor="addressLine1">
                  Address Line 1 {formData.category === 'Holiday Rental' && '(Optional)'}
                </Label>
                <Input
                  id="addressLine1"
                  value={formData.addressLine1}
                  onChange={(e) => handleFieldUpdate("addressLine1", e.target.value)}
                  placeholder={formData.category !== 'Holiday Rental' && !formData.addressLine1 ? "EMPTY" : "9 Árd Álainn"}
                  className={formData.category !== 'Holiday Rental' && !formData.addressLine1 ? "placeholder:text-amber-500" : ""}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={!formData.addressTown ? "border-2 border-amber-500 rounded-md p-2" : ""}>
                  <Label htmlFor="addressTown">Town</Label>
                  <Input
                    id="addressTown"
                    value={formData.addressTown}
                    onChange={(e) => handleFieldUpdate("addressTown", e.target.value)}
                    placeholder={!formData.addressTown ? "EMPTY" : "Castlebridge"}
                    className={!formData.addressTown ? "placeholder:text-amber-500" : ""}
                  />
                </div>

                <div className={!formData.county ? "border-2 border-amber-500 rounded-md p-2" : ""}>
                  <Label htmlFor="county">County</Label>
                  <Input
                    id="county"
                    value={formData.county}
                    onChange={(e) => handleFieldUpdate("county", e.target.value)}
                    placeholder={!formData.county ? "EMPTY" : "Wexford"}
                    className={!formData.county ? "placeholder:text-amber-500" : ""}
                  />
                </div>

                {(formData.category === 'Listing' || formData.category === 'Rental') && (
                  <div className={!formData.eircode ? "border-2 border-amber-500 rounded-md p-2" : ""}>
                    <Label htmlFor="eircode">Eircode</Label>
                    <Input
                      id="eircode"
                      value={formData.eircode}
                      onChange={(e) => handleFieldUpdate("eircode", e.target.value)}
                      placeholder={!formData.eircode ? "EMPTY" : "Y35N677"}
                      className={!formData.eircode ? "placeholder:text-amber-500" : ""}
                    />
                  </div>
                )}
              </div>

              {/* BER Rating - Not for Holiday Rental */}
              {formData.category !== 'Holiday Rental' && (
                <div>
                  <Label htmlFor="berRating">BER Rating (Optional)</Label>
                  <Select
                    value={formData.berRating}
                    onValueChange={(value) => handleFieldUpdate("berRating", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select BER rating" />
                    </SelectTrigger>
                    <SelectContent>
                      {["A1", "A2", "A3", "B1", "B2", "B3", "C1", "C2", "C3", "D1", "D2", "E1", "E2", "F", "G", "EXEMPT"].map(rating => (
                        <SelectItem key={rating} value={rating}>{rating}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className={!formData.description || formData.description.length < 20 ? "border-2 border-amber-500 rounded-md p-2" : ""}>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  ref={descriptionRef}
                  id="description"
                  value={formData.description}
                  onChange={(e) => {
                    handleFieldUpdate("description", e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  placeholder={!formData.description ? "EMPTY" : "Enter property description (minimum 20 characters)"}
                  className={`min-h-[120px] overflow-hidden resize-none ${!formData.description ? "placeholder:text-amber-500" : ""}`}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  {formData.description.length} / 20 minimum characters
                </p>
              </div>

              <div>
                <Label htmlFor="specs">
                  {formData.category === 'Rental' ? 'Features' : 'Specs (Dimensions / Services)'}
                </Label>
                <Textarea
                  ref={specsRef}
                  id="specs"
                  value={formData.specs || ""}
                  onChange={(e) => {
                    handleFieldUpdate("specs", e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  placeholder={formData.category === 'Rental' ? "Amenities and features" : "Additional specifications"}
                  className="min-h-[100px] overflow-hidden resize-none"
                />
                <p className={`text-sm mt-1 ${(formData.specs?.length || 0) > 3000 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                  {formData.specs?.length || 0}/3000
                  {(formData.specs?.length || 0) > 3000 && ` (${(formData.specs?.length || 0) - 3000} over limit)`}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Location Map */}
          {formData.eircode && (
            <Card>
              <CardHeader>
                <CardTitle>Location</CardTitle>
                <CardDescription>Property location based on Eircode</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full h-[400px] rounded-lg overflow-hidden">
                  <iframe
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    style={{ border: 0 }}
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(formData.eircode)}&output=embed`}
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              Once created, this listing will be added to your website and social media schedule to be auto-posted to your social accounts according to your frequency set in Socials Hub &gt; Settings.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/admin/create`, { 
                state: { 
                  formData, 
                  photos, 
                  heroPhotoIndex, 
                  socialMediaPhotoIndices 
                } 
              })}
              disabled={isSubmitting}
            >
              Back to Edit
            </Button>
            <Button
              onClick={handleConfirmAndPost}
              disabled={isSubmitting || missingFields.length > 0}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Posting..." : "Confirm and Post"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewListing;