import { z } from "zod";

export const listingSchema = z.object({
  description: z.string()
    .min(20, "Description must be at least 20 characters")
    .max(10000, "Description must be less than 10,000 characters"),
  
  // Building types vary by region: IE (Terrace, Apartment), UK (Terraced, Flat), US (Townhouse, Condo)
  buildingType: z.enum([
    "Detached", "Semi-Detached", 
    "Terrace", "Apartment",      // IE
    "Terraced", "Flat",          // UK
    "Townhouse", "Condo",        // US
    "Commercial", "Land"
  ], {
    required_error: "Please select a building type",
  }),
  
  isPOA: z.boolean().default(false),
  
  price: z.string().optional(),
  
  bedrooms: z.string()
    .regex(/^\d+$/, "Bedrooms must be a whole number")
    .optional(),
  
  bathrooms: z.string()
    .regex(/^\d+(\.\d)?$/, "Bathrooms must be a valid number")
    .optional(),
  
  buildingSize: z.string()
    .optional()
    .refine(
      (val) => !val || val.trim() === '' || /^\d+$/.test(val),
      { message: "Building size must be a whole number" }
    ),
  
  landSize: z.string()
    .optional()
    .transform((val) => {
      if (!val || val.trim() === '') return undefined;
      const cleaned = val.replace(/[^\d.]/g, '');
      if (!cleaned) return undefined;
      const num = parseFloat(cleaned);
      if (isNaN(num)) return undefined;
      return num.toFixed(2);
    }),
  
  addressLine1: z.string()
    .max(200, "Address must be less than 200 characters")
    .optional(),
  
  addressTown: z.string()
    .min(2, "Town is required")
    .max(100, "Town must be less than 100 characters"),
  
  county: z.string()
    .min(2, "County is required")
    .max(100, "County must be less than 100 characters"),
  
  eircode: z.string()
    .max(20, "Eircode must be less than 20 characters")
    .optional(),
  
  // Energy ratings vary by region: IE (BER A1-G), UK (EPC A-G), US (HERS optional)
  berRating: z.enum([
    // Irish BER ratings
    "A1", "A2", "A3", "B1", "B2", "B3", "C1", "C2", "C3", "D1", "D2", "E1", "E2", "F", "G", "EXEMPT",
    // UK EPC ratings
    "A", "B", "C", "D", "E",
    // US HERS ratings (optional in US)
    "HERS_0_50", "HERS_51_100", "HERS_101_130", "HERS_131_PLUS", "NOT_RATED"
  ], {
    required_error: "Please select an energy rating",
  }).optional(),
  
  category: z.enum(["Listing", "Rental", "Holiday Rental"], {
    required_error: "Please select a category",
  }).default("Listing"),
  
  specs: z.string()
    .max(3000, "Specs must be less than 3000 characters")
    .optional(),
  
  furnishingStatus: z.enum(["Unfurnished", "Partially Furnished", "Fully Furnished"], {
    required_error: "Please select furnishing status",
  }).optional(),
  
  bookingPlatformLink: z.string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
  
  photos: z.array(z.instanceof(File))
    .min(1, "At least 1 photo is required")
    .max(70, "Maximum 70 photos allowed"),
  
  heroPhotoIndex: z.number()
    .min(0, "Please select a hero photo")
    .default(0),
  
  socialMediaPhotoIndices: z.array(z.number())
    .optional(),
  
  markAsNew: z.boolean().optional(),
}).refine((data) => {
  const isLand = data.buildingType === "Land";
  
  // Category-specific validation
  if (data.category === "Listing") {
    // For sale properties
    if (!data.isPOA && (!data.price || !/^\d+(\.\d{1,2})?$/.test(data.price))) {
      return false;
    }
    if (!data.addressLine1 || data.addressLine1.trim().length < 3) return false;
    if (!data.buildingType) return false;
    
    if (isLand) {
      // Land: requires land size, no bedrooms/bathrooms/energy rating needed
      if (!data.landSize || !/^\.?\d*\.?\d+$/.test(data.landSize)) return false;
    } else {
      // Buildings: require bedrooms and bathrooms
      if (!data.bedrooms || !/^\d+$/.test(data.bedrooms)) return false;
      if (!data.bathrooms || !/^\d+(\.\d)?$/.test(data.bathrooms)) return false;
    }
  }
  
  if (data.category === "Rental") {
    // Long-term rental (Land not applicable for rentals, but handle gracefully)
    if (!data.price || !/^\d+(\.\d{1,2})?$/.test(data.price)) return false;
    if (!data.addressLine1 || data.addressLine1.trim().length < 3) return false;
    if (!data.buildingType) return false;
    if (!data.furnishingStatus) return false;
    
    if (!isLand) {
      if (!data.bedrooms || !/^\d+$/.test(data.bedrooms)) return false;
      if (!data.bathrooms || !/^\d+(\.\d)?$/.test(data.bathrooms)) return false;
    }
  }
  
  if (data.category === "Holiday Rental") {
    // Short-term rental - minimal validation
    if (!data.bookingPlatformLink || data.bookingPlatformLink.trim().length === 0) return false;
  }
  
  return true;
}, {
  message: "Please fill in all required fields for the selected category",
  path: ["category"],
});

export type ListingFormData = z.infer<typeof listingSchema>;
