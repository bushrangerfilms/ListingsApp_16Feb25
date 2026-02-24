import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { EditPhotoManager, PhotoChanges } from "./EditPhotoManager";
import { useLocale } from "@/hooks/useLocale";
import { useEnergyRatings, useAddressConfig, useBuildingTypes, useMeasurementConfig, useLandMeasurements } from "@/hooks/useRegionConfig";

interface EditListingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: any;
  clientSlug: string;
  onSuccess: () => void;
}

export function EditListingDialog({
  open,
  onOpenChange,
  listing,
  clientSlug,
  onSuccess,
}: EditListingDialogProps) {
  const { t } = useLocale();
  const energyRatings = useEnergyRatings();
  const addressConfig = useAddressConfig();
  const buildingTypes = useBuildingTypes();
  const measurementConfig = useMeasurementConfig();
  const landMeasurements = useLandMeasurements();
  const [isUpdating, setIsUpdating] = useState(false);
  const [formData, setFormData] = useState({
    Title: "",
    Price: 0,
    "Address Line 1": "",
    "Address Town": "",
    County: "",
    Eircode: "",
    Bedrooms: 0,
    Bathrooms: 0,
    "Building Type": "",
    Description: "",
    Specs: "",
    BER: "",
    "Building Size (Sq M)": 0,
    "Land Size (Acres)": 0,
    "Show NEW Badge": false,
  });
  const [landSizeInput, setLandSizeInput] = useState("");
  const [photoChanges, setPhotoChanges] = useState<PhotoChanges | null>(null);
  const [photoKey, setPhotoKey] = useState(0);

  useEffect(() => {
    if (listing && open) {
      const landSize = listing.landSize || 0;
      setFormData({
        Title: listing.title || "",
        Price: listing.price || 0,
        "Address Line 1": listing.addressLine1 || "",
        "Address Town": listing.addressTown || "",
        County: listing.county || "",
        Eircode: listing.eircode || "",
        Bedrooms: listing.bedrooms || 0,
        Bathrooms: listing.bathrooms || 0,
        "Building Type": listing.buildingType || "",
        Description: listing.description || "",
        Specs: listing.specs || "",
        BER: listing.berRating || listing.ber || "",
        "Building Size (Sq M)": listing.buildingSize || 0,
        "Land Size (Acres)": landSize,
        "Show NEW Badge": listing.showNewBadge || false,
      });
      setLandSizeInput(landSize ? String(landSize) : "");
      setPhotoChanges(null);
      setPhotoKey(prev => prev + 1);
    }
  }, [listing, open]);

  const getExistingPhotoUrls = (): string[] => {
    let photoUrls: string[] = [];
    
    if (listing?.photos && Array.isArray(listing.photos)) {
      photoUrls = listing.photos.map((p: any) => {
        if (typeof p === 'string') return p;
        if (p?.url) return p.url;
        return null;
      }).filter(Boolean);
    }
    
    // Ensure the hero photo is included in the photos array (it might be stored separately)
    const heroUrl = listing?.heroPhoto || listing?.hero_photo || listing?.heroPhotoUrl || listing?.hero_photo_url;
    if (heroUrl && !photoUrls.includes(heroUrl)) {
      // Add hero photo at the beginning so it's easy to find
      photoUrls = [heroUrl, ...photoUrls];
    }
    
    return photoUrls;
  };

  const getExistingHeroUrl = (): string | null => {
    // Check for all possible field name variants (camelCase, snake_case, with/without _url suffix)
    const heroUrl = listing?.heroPhoto || listing?.hero_photo || listing?.heroPhotoUrl || listing?.hero_photo_url;
    if (heroUrl) return heroUrl;
    const photos = getExistingPhotoUrls();
    return photos.length > 0 ? photos[0] : null;
  };

  const getExistingSocialMediaUrls = (): string[] => {
    // Check for both camelCase and snake_case field names
    const socialPhotos = listing?.socialMediaPhotos || listing?.social_media_photos;
    if (!socialPhotos) return [];
    if (Array.isArray(socialPhotos)) {
      return socialPhotos.map((p: any) => {
        if (typeof p === 'string') return p;
        if (p?.url) return p.url;
        return null;
      }).filter(Boolean);
    }
    return [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);

    try {
      let uploadedPhotoUrls: string[] = [];
      let newHeroUrl: string | null = null;
      let newSocialMediaUrls: string[] = [];

      if (photoChanges && photoChanges.newPhotos.length > 0) {
        const imageFormData = new FormData();
        photoChanges.newPhotos.forEach((file) => {
          imageFormData.append('images', file);
        });
        
        const heroIndex = photoChanges.heroPhotoIndex ?? -1;
        imageFormData.append('heroIndex', heroIndex.toString());
        imageFormData.append('clientSlug', clientSlug);

        const { data: uploadData, error: uploadError } = await supabase.functions.invoke('process-images', {
          body: imageFormData,
        });

        if (uploadError || !uploadData?.photoUrls) {
          console.error('Photo upload error:', uploadError);
          throw new Error('Failed to upload new photos');
        }

        uploadedPhotoUrls = uploadData.photoUrls || [];
        
        if (heroIndex >= 0 && uploadData.heroPhotoUrl) {
          newHeroUrl = uploadData.heroPhotoUrl;
        }

        newSocialMediaUrls = photoChanges.socialMediaIndices
          .map(idx => uploadedPhotoUrls[idx])
          .filter(Boolean);
      }

      const finalPhotoUrls = [...(photoChanges?.existingPhotos || []), ...uploadedPhotoUrls];
      const finalHeroUrl = photoChanges?.heroPhotoUrl || newHeroUrl || (finalPhotoUrls.length > 0 ? finalPhotoUrls[0] : null);
      const finalSocialMediaUrls = [...(photoChanges?.socialMediaUrls || []), ...newSocialMediaUrls];

      const listingFields: Record<string, any> = {
        'Listing Title': formData.Title,
        'Price €': formData.Price,
        'Address Line 1': formData["Address Line 1"],
        'Address Town': formData["Address Town"],
        'County': formData.County,
        'Eircode': formData.Eircode,
        'Bedrooms': formData.Bedrooms,
        'Bathrooms': formData.Bathrooms,
        'Building Type': formData["Building Type"],
        'Description': formData.Description,
        'Specs (Dimensions / Services)': formData.Specs,
        'BER Rating': formData.BER,
        'Building Size sqm': formData["Building Size (Sq M)"] || null,
        'Land Size (Acres)': formData["Land Size (Acres)"] || null,
      };

      if (photoChanges) {
        listingFields['photos'] = finalPhotoUrls;
        listingFields['hero_photo'] = finalHeroUrl;
        listingFields['social_media_photos'] = finalSocialMediaUrls;
      }

      const { data, error } = await supabase.functions.invoke('update-listing-details', {
        body: {
          clientSlug,
          recordId: listing.id,
          fields: listingFields,
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: t('listings.edit.toast.success'),
          description: t('listings.edit.toast.successDescription'),
        });
        onSuccess();
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error updating listing:', error);
      toast({
        title: t('listings.edit.toast.error'),
        description: error instanceof Error ? error.message : t('listings.edit.toast.errorDescription'),
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t('listings.edit.title')}</DialogTitle>
          <DialogDescription>
            {t('listings.edit.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">{t('listings.edit.propertyTitle')}</Label>
            <Input
              id="title"
              value={formData.Title}
              onChange={(e) => setFormData({ ...formData, Title: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price">{t('listings.create.price.label')}</Label>
              <Input
                id="price"
                type="number"
                value={formData.Price}
                onChange={(e) => setFormData({ ...formData, Price: Number(e.target.value) })}
                required
              />
            </div>
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5">
                <Label htmlFor="new-badge">{t('listings.edit.showNewBadge')}</Label>
                <p className="text-xs text-muted-foreground">{t('listings.edit.showNewBadgeDescription')}</p>
              </div>
              <Switch
                id="new-badge"
                checked={formData["Show NEW Badge"]}
                onCheckedChange={(checked) => setFormData({ ...formData, "Show NEW Badge": checked })}
              />
            </div>
          </div>

          {/* Energy Rating - only if enabled in region, NOT for Land */}
          {energyRatings.enabled && formData["Building Type"] !== "Land" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ber">{energyRatings.label}</Label>
                <Select 
                  value={formData.BER} 
                  onValueChange={(value) => setFormData({ ...formData, BER: value })}
                >
                  <SelectTrigger id="ber">
                    <SelectValue placeholder={`Select ${energyRatings.label}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {energyRatings.ratings.map((rating) => (
                      <SelectItem key={rating.code} value={rating.code}>
                        {rating.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="address1">{t('listings.create.address.line1')}</Label>
            <Input
              id="address1"
              value={formData["Address Line 1"]}
              onChange={(e) => setFormData({ ...formData, "Address Line 1": e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="town">{t('listings.create.address.town')}</Label>
              <Input
                id="town"
                value={formData["Address Town"]}
                onChange={(e) => setFormData({ ...formData, "Address Town": e.target.value })}
                required
              />
            </div>
            {/* State dropdown for US, County input for others */}
            {addressConfig.stateRequired && addressConfig.states ? (
              <div>
                <Label htmlFor="county">{addressConfig.stateLabel || 'State'}</Label>
                <Select 
                  value={formData.County} 
                  onValueChange={(value) => setFormData({ ...formData, County: value })}
                >
                  <SelectTrigger id="county">
                    <SelectValue placeholder="Select State" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {addressConfig.states.map((state) => (
                      <SelectItem key={state.code} value={state.name}>
                        {state.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label htmlFor="county">{addressConfig.countyLabel || t('listings.create.address.county')}</Label>
                <Input
                  id="county"
                  value={formData.County}
                  onChange={(e) => setFormData({ ...formData, County: e.target.value })}
                  required
                />
              </div>
            )}
            <div>
              <Label htmlFor="eircode">{addressConfig.postalCodeLabel}</Label>
              <Input
                id="eircode"
                placeholder={addressConfig.postalCodePlaceholder}
                value={formData.Eircode}
                onChange={(e) => setFormData({ ...formData, Eircode: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Building Type */}
          <div>
            <Label htmlFor="buildingType">{t('listings.create.details.buildingType')}</Label>
            <Select 
              value={formData["Building Type"]} 
              onValueChange={(value) => setFormData({ ...formData, "Building Type": value })}
            >
              <SelectTrigger id="buildingType">
                <SelectValue placeholder={t('listings.create.details.selectBuildingType')} />
              </SelectTrigger>
              <SelectContent>
                {buildingTypes.map((type) => (
                  <SelectItem key={type.code} value={type.code}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bedrooms & Bathrooms - NOT for Land */}
          {formData["Building Type"] !== "Land" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bedrooms">{t('listings.create.details.bedrooms')}</Label>
                <Input
                  id="bedrooms"
                  type="text"
                  placeholder={t('listings.create.details.bedrooms')}
                  value={formData.Bedrooms || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, Bedrooms: value ? Number(value) : undefined });
                  }}
                  required
                />
              </div>
              <div>
                <Label htmlFor="bathrooms">{t('listings.create.details.bathrooms')}</Label>
                <Input
                  id="bathrooms"
                  type="text"
                  placeholder={t('listings.create.details.bathrooms')}
                  value={formData.Bathrooms || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, Bathrooms: value ? Number(value) : undefined });
                  }}
                  required
                />
              </div>
            </div>
          )}

          {/* Building Size - NOT for Land */}
          {formData["Building Type"] !== "Land" && (
            <div>
              <Label htmlFor="buildingSize">
                {t('listings.create.details.buildingSize')} ({measurementConfig.areaSymbol})
              </Label>
              <Input
                id="buildingSize"
                type="text"
                placeholder={measurementConfig.areaUnit === 'sqft' ? '1200' : '120'}
                value={formData["Building Size (Sq M)"] || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({ ...formData, "Building Size (Sq M)": value ? Number(value) : undefined });
                }}
              />
            </div>
          )}

          {/* Land Size - REQUIRED for Land */}
          <div>
            <Label htmlFor="landSize">
              {t('listings.create.details.landSize')} (Approx.) ({landMeasurements.landSymbol})
              {formData["Building Type"] === "Land" && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id="landSize"
              type="text"
              placeholder="0.5"
              value={landSizeInput}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "" || /^\d*\.?\d*$/.test(value)) {
                  setLandSizeInput(value);
                  setFormData({ ...formData, "Land Size (Acres)": value ? parseFloat(value) : undefined });
                }
              }}
              required={formData["Building Type"] === "Land"}
            />
          </div>

          <div>
            <Label htmlFor="description">{t('listings.create.details.description')}</Label>
            <Textarea
              id="description"
              value={formData.Description}
              onChange={(e) => setFormData({ ...formData, Description: e.target.value })}
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="specs">{t('listings.create.details.specs')}</Label>
            <Textarea
              id="specs"
              value={formData.Specs}
              onChange={(e) => setFormData({ ...formData, Specs: e.target.value })}
              rows={4}
            />
          </div>

          <Separator className="my-4" />

          <EditPhotoManager
            key={photoKey}
            existingPhotoUrls={getExistingPhotoUrls()}
            existingHeroUrl={getExistingHeroUrl()}
            existingSocialMediaUrls={getExistingSocialMediaUrls()}
            onChange={setPhotoChanges}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUpdating}
            >
              {t('listings.edit.buttons.cancel')}
            </Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isUpdating ? t('listings.edit.buttons.saving') : t('listings.edit.buttons.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
