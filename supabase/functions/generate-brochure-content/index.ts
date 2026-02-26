import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

// ── Types ──────────────────────────────────────────────────────────────

interface GenerateBrochureRequest {
  listingId: string;
  organizationId: string;
  locale?: string;
  regenerateSection?: string;
  existingContent?: Record<string, unknown>;
}

interface AIInstructionSet {
  id: string;
  feature_type: string;
  scope: string;
  organization_id: string | null;
  locale: string | null;
  name: string;
  banned_phrases: string[];
  tone_guidelines: string[];
  freeform_instructions: string | null;
  is_active: boolean;
  priority: number;
}

// ── Locale Config ──────────────────────────────────────────────────────

const getLocaleConfig = (locale: string) => {
  switch (locale) {
    case 'en-GB':
      return {
        currency: '£', currencyName: 'GBP', areaUnit: 'm²',
        spelling: 'British English', energyRating: 'EPC',
        postalCode: 'postcode', country: 'United Kingdom',
        measurementNote: 'Use metric (metres). Also include imperial in parentheses.',
        terminology: { apartment: 'flat', terrace: 'terraced house', groundFloor: 'ground floor', firstFloor: 'first floor' },
        legalDisclaimer: 'These particulars are set out as a general outline only for guidance and do not constitute any part of an offer or contract. Intending purchasers should not rely on them as statements of representation of fact, but must satisfy themselves by inspection or otherwise as to their accuracy.',
      };
    case 'en-US':
      return {
        currency: '$', currencyName: 'USD', areaUnit: 'sq ft',
        spelling: 'American English', energyRating: 'HERS',
        postalCode: 'ZIP code', country: 'United States',
        measurementNote: 'Use imperial (feet and inches). Also include metric in parentheses.',
        terminology: { apartment: 'condo', terrace: 'townhouse', groundFloor: 'first floor', firstFloor: 'second floor' },
        legalDisclaimer: 'The information provided is deemed reliable but is not guaranteed and should be independently verified. All properties are subject to prior sale, change or withdrawal.',
      };
    case 'en-AU':
      return {
        currency: '$', currencyName: 'AUD', areaUnit: 'm²',
        spelling: 'Australian English', energyRating: 'NatHERS',
        postalCode: 'postcode', country: 'Australia',
        measurementNote: 'Use metric (metres). Also include imperial in parentheses.',
        terminology: { apartment: 'unit', terrace: 'terrace', groundFloor: 'ground floor', firstFloor: 'first floor' },
        legalDisclaimer: 'All information contained herein is gathered from sources we believe to be reliable. However, we cannot guarantee its accuracy and interested persons should rely on their own enquiries.',
      };
    case 'en-CA':
      return {
        currency: '$', currencyName: 'CAD', areaUnit: 'sq ft',
        spelling: 'Canadian English', energyRating: 'EnerGuide',
        postalCode: 'postal code', country: 'Canada',
        measurementNote: 'Use imperial (feet and inches). Also include metric in parentheses.',
        terminology: { apartment: 'condo', terrace: 'townhouse', groundFloor: 'main floor', firstFloor: 'second floor' },
        legalDisclaimer: 'The information provided is from sources deemed reliable but is not guaranteed. Buyers should verify all information independently.',
      };
    case 'en-IE':
    default:
      return {
        currency: '€', currencyName: 'EUR', areaUnit: 'm²',
        spelling: 'British English (Irish)', energyRating: 'BER',
        postalCode: 'Eircode', country: 'Ireland',
        measurementNote: 'Use both imperial (feet/inches) as primary and metric in parentheses — this is standard Irish practice.',
        terminology: { apartment: 'apartment', terrace: 'terrace', groundFloor: 'ground floor', firstFloor: 'first floor' },
        legalDisclaimer: 'Kindly note that any negotiations respecting the above property are conducted through us. We do not hold ourselves responsible in any way for inaccuracy, but will take every care in preparing particulars. All offers are subject to the property being unsold, let or withdrawn. The above may be seen by appointment only. Any reasonable offer will be submitted to the owner for consideration.',
      };
  }
};

// ── AI Instructions ────────────────────────────────────────────────────

async function fetchAIInstructions(
  supabase: ReturnType<typeof createClient>,
  featureType: string,
  organizationId?: string,
  locale?: string
): Promise<AIInstructionSet[]> {
  try {
    const effectiveLocale = locale && locale.trim() !== '' ? locale : null;
    const { data, error } = await supabase.rpc('get_ai_instructions', {
      p_feature_type: featureType,
      p_organization_id: organizationId || null,
      p_locale: effectiveLocale,
    });
    if (error) {
      console.error('Error fetching AI instructions:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Failed to fetch AI instructions:', err);
    return [];
  }
}

function buildCustomInstructionsSection(instructions: AIInstructionSet[]): string {
  if (!instructions || instructions.length === 0) return '';
  const sections: string[] = [];

  const allBannedPhrases = instructions.flatMap(i => i.banned_phrases || []);
  if (allBannedPhrases.length > 0) {
    sections.push(`BANNED PHRASES (Never use these):\n- ${allBannedPhrases.join('\n- ')}`);
  }

  const allToneGuidelines = instructions.flatMap(i => i.tone_guidelines || []);
  if (allToneGuidelines.length > 0) {
    sections.push(`TONE GUIDELINES:\n- ${allToneGuidelines.join('\n- ')}`);
  }

  const freeformInstructions = instructions
    .filter(i => i.freeform_instructions)
    .map(i => i.freeform_instructions);
  if (freeformInstructions.length > 0) {
    sections.push(`ADDITIONAL INSTRUCTIONS:\n${freeformInstructions.join('\n\n')}`);
  }

  if (sections.length === 0) return '';
  return `\n\nCUSTOM REQUIREMENTS:\n${sections.join('\n\n')}`;
}

// ── Prompt Building ────────────────────────────────────────────────────

function buildFullBrochurePrompt(
  listing: Record<string, unknown>,
  localeConfig: ReturnType<typeof getLocaleConfig>,
  customInstructions: string
): string {
  const photos = (listing.photos as string[]) || [];
  const photoList = photos.map((url: string, i: number) => `  Photo ${i + 1}: ${url}`).join('\n');

  return `You are an expert real estate copywriter creating a professional property brochure.
Generate a complete brochure content in JSON format for the following property listing.

LOCALE REQUIREMENTS:
- Write in ${localeConfig.spelling}
- Currency: ${localeConfig.currency} (${localeConfig.currencyName})
- Area unit: ${localeConfig.areaUnit}
- Energy rating system: ${localeConfig.energyRating}
- Postal code term: ${localeConfig.postalCode}
- Measurements: ${localeConfig.measurementNote}
- Country: ${localeConfig.country}

PROPERTY DATA:
- Title: ${listing.title || 'Untitled'}
- Address: ${listing.address || ''}, ${listing.address_town || ''}, ${listing.county || ''}
- ${localeConfig.postalCode}: ${listing.eircode || 'Not provided'}
- Category: ${listing.category || 'Listing'}
- Building Type: ${listing.building_type || 'Not specified'}
- Bedrooms: ${listing.bedrooms || 'Not specified'}
- Bathrooms: ${listing.bathrooms || 'Not specified'}
- Ensuites: ${listing.ensuite || 'Not specified'}
- Floor Area: ${listing.floor_area_size ? `${listing.floor_area_size} ${localeConfig.areaUnit}` : 'Not specified'}
- Land Size: ${listing.land_size ? `${listing.land_size} acres` : 'Not specified'}
- Price: ${listing.price ? `${localeConfig.currency}${Number(listing.price).toLocaleString()}` : 'Price on Application'}
- Energy Rating: ${listing.ber_rating || 'Not provided'}
- Category: ${listing.category === 'Rental' ? 'To Let' : listing.category === 'Holiday Rental' ? 'Holiday Let' : 'For Sale'}

DESCRIPTION (from agent):
${listing.description || 'No description provided.'}

SPECS/DIMENSIONS (from agent):
${listing.specs || 'No specs provided.'}

HERO PHOTO: ${listing.hero_photo || (photos.length > 0 ? photos[0] : '')}

AVAILABLE PHOTOS (${photos.length} total):
${photoList || '  No photos available'}

INSTRUCTIONS:
1. Generate a compelling marketing description (2-3 paragraphs) that enhances the original description. Keep it professional, factual, and enticing.

2. Extract key features as a bullet list (6-10 items). Focus on standout selling points.

3. Parse the specs/description text into individual rooms. For each room, extract:
   - Room name (e.g., "Living Room", "Master Bedroom", "Kitchen/Dining")
   - Floor level ("${localeConfig.terminology.groundFloor}", "${localeConfig.terminology.firstFloor}", "Basement", etc.)
   - Dimensions if mentioned (format: imperial with metric in parentheses for Irish, or as appropriate for locale)
   - A brief 1-sentence description of the room
   If no specs are provided, generate reasonable room placeholders based on the bedroom/bathroom count and building type.

4. Generate a services list (heating type, water, sewerage, broadband, etc.) based on any mentions in the description/specs.

5. Generate an external features list (garden, parking, views, etc.) from the description.

6. Write a location description paragraph about ${listing.address_town || 'the area'}, ${listing.county || ''}, ${localeConfig.country}. Mention proximity to amenities, transport, schools, etc.

7. For the gallery, select up to 8 of the best photos from the available photos list. Assign brief captions.

8. Determine the sale method based on the Category field above. If "For Sale", use "For Sale by Private Treaty" unless the description mentions auction. If "To Let" or "Holiday Let", use "To Let". Do NOT use the listing's status (New/Published/Sold/Sale Agreed) as the sale method — always use the appropriate sale method phrase.
${customInstructions}

RESPOND WITH ONLY VALID JSON matching this exact structure (no markdown, no code fences):
{
  "cover": {
    "headline": "string - e.g. '3 Bed Detached House' or descriptive headline",
    "address": "string - full address with ${localeConfig.postalCode}",
    "price": "string - formatted price with currency symbol, or 'Price on Application'",
    "saleMethod": "string - e.g. 'For Sale by Private Treaty'",
    "heroPhotoUrl": "string - URL of hero photo",
    "energyRating": "string or null - e.g. 'B3' or null if not provided"
  },
  "description": {
    "marketingText": "string - 2-3 paragraph marketing description",
    "keyFeatures": ["string array - 6-10 key selling points"]
  },
  "rooms": [
    {
      "id": "string - unique ID like 'room-1'",
      "name": "string - room name",
      "floor": "string - floor level",
      "dimensions": "string or null - e.g. \"15'5 x 9'4 (4.7m x 2.9m)\"",
      "description": "string or null - brief description",
      "photoUrl": "string or null - best matching photo URL from available photos"
    }
  ],
  "features": {
    "services": ["string array - utilities/services"],
    "external": ["string array - external features"],
    "nearby": ["string array - nearby amenities/points of interest"]
  },
  "location": {
    "text": "string - location description paragraph",
    "amenities": ["string array - notable nearby amenities"]
  },
  "floorPlans": [],
  "gallery": [
    {
      "id": "string - e.g. 'gallery-1'",
      "url": "string - photo URL",
      "caption": "string - brief caption"
    }
  ],
  "legal": {
    "disclaimer": "string - standard legal disclaimer for ${localeConfig.country}",
    "psrLicenceNumber": "string or null"
  },
  "visibleSections": {
    "cover": true,
    "description": true,
    "rooms": true,
    "features": true,
    "location": true,
    "gallery": true,
    "floorPlans": false,
    "legal": true
  },
  "sectionOrder": ["cover","description","rooms","features","location","gallery","floorPlans","legal"]
}`;
}

function buildSectionRegeneratePrompt(
  section: string,
  listing: Record<string, unknown>,
  existingContent: Record<string, unknown>,
  localeConfig: ReturnType<typeof getLocaleConfig>,
  customInstructions: string
): string {
  return `You are an expert real estate copywriter. Regenerate ONLY the "${section}" section of a property brochure.

LOCALE: ${localeConfig.spelling}, ${localeConfig.currency}, ${localeConfig.country}
Measurements: ${localeConfig.measurementNote}

PROPERTY: ${listing.title || ''} at ${listing.address || ''}, ${listing.address_town || ''}, ${listing.county || ''}
DESCRIPTION: ${listing.description || ''}
SPECS: ${listing.specs || ''}
BEDROOMS: ${listing.bedrooms || 'N/A'}, BATHROOMS: ${listing.bathrooms || 'N/A'}

EXISTING BROCHURE CONTENT (for context):
${JSON.stringify(existingContent, null, 2)}
${customInstructions}

Regenerate ONLY the "${section}" section. Return valid JSON with just that section's data structure. No markdown fences.`;
}

// ── Main Handler ───────────────────────────────────────────────────────

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { listingId, organizationId, locale, regenerateSection, existingContent } = body as GenerateBrochureRequest;

    if (!listingId || !organizationId) {
      return new Response(
        JSON.stringify({ error: 'listingId and organizationId are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
    if (!GOOGLE_AI_API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limit: 30 requests/hour/org for brochure generation
    const rateCheck = await checkRateLimit(supabase, organizationId, {
      feature: 'generate-brochure-content',
      maxRequests: 30,
      windowMinutes: 60,
    });
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.', resetTime: rateCheck.resetTime }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch listing data
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .eq('organization_id', organizationId)
      .single();

    if (listingError || !listing) {
      return new Response(
        JSON.stringify({ error: 'Listing not found.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch organization branding
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('business_name, logo_url, primary_color, secondary_color, contact_name, contact_email, contact_phone, business_address, psr_licence_number, locale, currency, country_code')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: 'Organization not found.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch upscaled photo URLs where available
    const { data: upscaleJobs } = await supabase
      .from('photo_upscale_jobs')
      .select('photo_index, photo_type, upscaled_url')
      .eq('listing_id', listingId)
      .eq('status', 'completed')
      .not('upscaled_url', 'is', null);

    // Build photo array with upscaled versions where available
    const originalPhotos = (listing.photos as string[]) || [];
    const photos = originalPhotos.map((url: string, index: number) => {
      const upscaled = upscaleJobs?.find(
        (j: { photo_index: number; photo_type: string }) => j.photo_index === index && j.photo_type === 'gallery'
      );
      return upscaled?.upscaled_url || url;
    });

    // Use upscaled hero if available
    const heroUpscale = upscaleJobs?.find(
      (j: { photo_type: string }) => j.photo_type === 'hero'
    );
    const heroPhoto = heroUpscale?.upscaled_url || listing.hero_photo || (photos.length > 0 ? photos[0] : '');

    // Merge upscaled photos into the listing for prompt
    const listingWithPhotos = { ...listing, photos, hero_photo: heroPhoto };

    // Fetch custom AI instructions
    const effectiveLocale = locale || org.locale || 'en-IE';
    const customInstructions = await fetchAIInstructions(supabase, 'brochure_generation', organizationId, effectiveLocale);
    const customInstructionsSection = buildCustomInstructionsSection(customInstructions);

    const localeConfig = getLocaleConfig(effectiveLocale);

    // Build the prompt
    const prompt = regenerateSection
      ? buildSectionRegeneratePrompt(regenerateSection, listingWithPhotos, existingContent || {}, localeConfig, customInstructionsSection)
      : buildFullBrochurePrompt(listingWithPhotos, localeConfig, customInstructionsSection);

    // Call Gemini 2.5 Flash
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.5,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error('No response from AI');
    }

    // Parse the JSON response — handle various formats Gemini may return
    let brochureContent;
    let textToParse = rawText.trim();

    // Strip markdown code fences if present
    const fenceMatch = textToParse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      textToParse = fenceMatch[1].trim();
    }

    // Strip any leading/trailing non-JSON characters (e.g., explanation text)
    const jsonStart = textToParse.indexOf('{');
    const jsonEnd = textToParse.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      textToParse = textToParse.substring(jsonStart, jsonEnd + 1);
    }

    try {
      brochureContent = JSON.parse(textToParse);
    } catch (parseError) {
      console.error('Failed to parse AI response. First 1000 chars:', rawText.substring(0, 1000));
      console.error('Parse error:', parseError);
      throw new Error('Failed to parse AI response as JSON. The AI may have returned malformed output — please try again.');
    }

    // Inject legal disclaimer from locale config if AI didn't provide one
    if (!brochureContent.legal?.disclaimer) {
      brochureContent.legal = {
        ...brochureContent.legal,
        disclaimer: localeConfig.legalDisclaimer,
      };
    }

    // Inject PSR licence number from org data
    if (org.psr_licence_number) {
      brochureContent.legal = {
        ...brochureContent.legal,
        psrLicenceNumber: org.psr_licence_number,
      };
    }

    // Build branding snapshot
    const branding = {
      businessName: org.business_name || '',
      logoUrl: org.logo_url || null,
      primaryColor: org.primary_color || '#1a365d',
      secondaryColor: org.secondary_color || '#c53030',
      contactName: org.contact_name || '',
      contactEmail: org.contact_email || '',
      contactPhone: org.contact_phone || '',
      businessAddress: org.business_address || '',
      psrLicenceNumber: org.psr_licence_number || null,
      locale: effectiveLocale,
      currency: org.currency || localeConfig.currencyName,
      countryCode: org.country_code || 'IE',
    };

    const tokenUsage = {
      promptTokens: result.usageMetadata?.promptTokenCount || 0,
      completionTokens: result.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: result.usageMetadata?.totalTokenCount || 0,
    };

    return new Response(
      JSON.stringify({
        success: true,
        content: brochureContent,
        branding,
        tokenUsage,
        regeneratedSection: regenerateSection || null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-brochure-content:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
