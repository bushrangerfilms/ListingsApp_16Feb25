import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { getEdgeLocaleConfig, type EdgeLocaleConfig } from '../_shared/locale-config.ts';

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

// ── Photo Vision Analysis ─────────────────────────────────────────────

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB limit
const VISION_CONCURRENCY = 3;
const MAX_VISION_PHOTOS = 12; // Cap vision analysis — brochure only uses ~4 rooms + gallery

const PHOTO_ANALYSIS_PROMPT = `Identify this real estate photo in one line.
Format: "[Room/Space type]: [Key features in 8-10 words]"
Examples:
- "Kitchen: Open-plan with marble island, gas range, skylight"
- "Master Bedroom: Vaulted ceilings, en-suite, garden views"
- "Exterior Front: Detached house, gravel driveway, mature hedging"
- "Bathroom: Walk-in shower, heated towel rail, tiled floor"
- "Living Room: Log burner, wooden floors, bay window"`;

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes.byteLength > MAX_IMAGE_SIZE) return null;

    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return { base64: btoa(binary), mimeType: contentType.split(';')[0] };
  } catch {
    return null;
  }
}

async function analyzePhoto(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
): Promise<string | null> {
  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: PHOTO_ANALYSIS_PROMPT },
                { inline_data: { mime_type: mimeType, data: imageBase64 } },
              ],
            }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 60,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        return text && text.length > 0 ? text : null;
      }

      if (response.status === 429 || response.status === 503) {
        const backoff = 5000 * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      return null;
    } catch {
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }
  return null;
}

async function analyzeAllPhotos(
  apiKey: string,
  photoUrls: string[],
): Promise<Map<string, string>> {
  const descriptions = new Map<string, string>();
  if (photoUrls.length === 0) return descriptions;

  // Cap photos to avoid timeout on listings with many images
  const photosToAnalyze = photoUrls.slice(0, MAX_VISION_PHOTOS);
  console.log(`[Brochure] Analyzing ${photosToAnalyze.length}/${photoUrls.length} photos with vision...`);

  // Process in batches for rate limiting
  for (let i = 0; i < photosToAnalyze.length; i += VISION_CONCURRENCY) {
    const batch = photosToAnalyze.slice(i, i + VISION_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (url) => {
        const imageData = await fetchImageAsBase64(url);
        if (!imageData) return { url, description: null };
        const description = await analyzePhoto(apiKey, imageData.base64, imageData.mimeType);
        return { url, description };
      })
    );

    for (const { url, description } of results) {
      if (description) {
        descriptions.set(url, description);
        console.log(`[Brochure] Photo analyzed: ${description}`);
      }
    }

    // Small delay between batches to respect rate limits
    if (i + VISION_CONCURRENCY < photosToAnalyze.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`[Brochure] Vision analysis complete: ${descriptions.size}/${photosToAnalyze.length} photos described`);
  return descriptions;
}

// ── Prompt Building ────────────────────────────────────────────────────

function buildFullBrochurePrompt(
  listing: Record<string, unknown>,
  localeConfig: EdgeLocaleConfig,
  customInstructions: string,
  photoDescriptions?: Map<string, string>
): string {
  const photos = (listing.photos as string[]) || [];
  const photoList = photos.map((url: string, i: number) => {
    const desc = photoDescriptions?.get(url);
    return desc
      ? `  Photo ${i + 1} [${url}]: ${desc}`
      : `  Photo ${i + 1} [${url}]: (no description)`;
  }).join('\n');
  const hasDescriptions = photoDescriptions && photoDescriptions.size > 0;

  const spellingLabel = localeConfig.spelling === 'british' ? 'British English' : 'American English';
  const measurementNote = localeConfig.measurements.area === 'sqm'
    ? 'Use both imperial (feet/inches) as primary and metric in parentheses.'
    : 'Use imperial (feet and inches). Also include metric in parentheses.';

  return `You are an expert real estate copywriter creating a professional property brochure.
Generate a complete brochure content in JSON format for the following property listing.

LOCALE REQUIREMENTS:
- Write in ${spellingLabel}
- Currency: ${localeConfig.currency.symbol} (${localeConfig.currency.code})
- Area unit: ${localeConfig.measurements.areaSymbol}
- Energy rating system: ${localeConfig.energyRating.system}
- Postal code term: ${localeConfig.postalCode.label}
- Measurements: ${measurementNote}
- Country: ${localeConfig.country}

PROPERTY DATA:
- Title: ${listing.title || 'Untitled'}
- Address: ${listing.address || ''}, ${listing.address_town || ''}, ${listing.county || ''}
- ${localeConfig.postalCode.label}: ${listing.eircode || 'Not provided'}
- Category: ${listing.category || 'Listing'}
- Building Type: ${listing.building_type || 'Not specified'}
- Bedrooms: ${listing.bedrooms || 'Not specified'}
- Bathrooms: ${listing.bathrooms || 'Not specified'}
- Ensuites: ${listing.ensuite || 'Not specified'}
- Floor Area: ${listing.floor_area_size ? `${listing.floor_area_size} ${localeConfig.measurements.areaSymbol}` : 'Not specified'}
- Land Size: ${listing.land_size ? `${listing.land_size} acres` : 'Not specified'}
- Price: ${listing.price ? `${localeConfig.currency.symbol} ${Number(listing.price).toLocaleString()}` : 'Price on Application'}
- Energy Rating: ${listing.ber_rating || 'Not provided'}
- Category: ${listing.category === 'Rental' ? 'To Let' : listing.category === 'Holiday Rental' ? 'Holiday Let' : 'For Sale'}

DESCRIPTION (from agent):
${listing.description || 'No description provided.'}

SPECS/DIMENSIONS (from agent):
${listing.specs || 'No specs provided.'}

HERO PHOTO: ${listing.hero_photo || (photos.length > 0 ? photos[0] : '')}

AVAILABLE PHOTOS (${photos.length} total):
${photoList || '  No photos available'}

IMPORTANT LAYOUT CONSTRAINT: This content must fit in a strict 4-page A4 brochure (A5 booklet format).
Page 1 = cover with hero photo, address, description, and price.
Pages 2-3 = room details, features, location.
Page 4 = back cover photo, floor plans, legal.
All text MUST be concise — do NOT be verbose.

INSTRUCTIONS:
1. Generate a compelling marketing description in EXACTLY 2 short paragraphs (3-4 sentences each). This goes on the cover page below the hero photo, so keep it concise. Enhance the original description professionally.

2. Extract key features as a bullet list (4-6 items max). Keep each feature under 8 words. Focus on standout selling points.

3. Parse the specs/description text into individual rooms. For each room, extract:
   - Room name (e.g., "Living Room", "Master Bedroom", "Kitchen/Dining")
   - Floor level ("${localeConfig.terminology.groundFloor}", "${localeConfig.terminology.firstFloor}", "Basement", etc.)
   - Dimensions if mentioned (format: imperial with metric in parentheses for Irish, or as appropriate for locale)
   - A very brief description (max 10 words, e.g., "Laminate flooring, recessed lighting, feature fireplace")
   - photoUrl: ${hasDescriptions ? 'Use the PHOTO DESCRIPTIONS above to assign the best matching photo URL. Match room type names (e.g., "Kitchen", "Master Bedroom") to the photo descriptions.' : 'Assign the best matching photo URL from the available photos.'}
   If no specs are provided, generate reasonable room placeholders based on the bedroom/bathroom count and building type.

4. Generate a services list (heating type, water, sewerage, broadband, etc.) based on any mentions in the description/specs. Keep to 3-5 items.

5. Generate an external features list (garden, parking, views, etc.) from the description. Keep to 3-5 items.

6. Write a location description in EXACTLY 2 sentences about ${listing.address_town || 'the area'}, ${listing.county || ''}, ${localeConfig.country}. Mention the town and 2-3 key nearby amenities.

7. For the gallery, select up to 4 visually interesting photos from the available photos list. These are used as accent photos throughout the brochure. ${hasDescriptions ? 'Use the photo descriptions to understand what each photo shows, but write captions as short buyer-appeal marketing copy (2-4 words), NOT literal descriptions. Examples: "Outdoor space potential", "Generous rear garden", "Period character features", "Countryside setting".' : 'Write captions as short buyer-appeal marketing copy (2-4 words), e.g. "Generous rear garden", "Period character features".'}

8. Determine the sale method based on the Category field above. If "For Sale", use "For Sale by Private Treaty" unless the description mentions auction. If "To Let" or "Holiday Let", use "To Let". Do NOT use the listing's status (New/Published/Sold/Sale Agreed) as the sale method — always use the appropriate sale method phrase.
${customInstructions}

RESPOND WITH ONLY VALID JSON matching this exact structure (no markdown, no code fences):
{
  "cover": {
    "headline": "string - e.g. '3 Bed Detached House' or descriptive headline",
    "address": "string - full address with ${localeConfig.postalCode.label}",
    "price": "string - formatted price with currency symbol, or 'Price on Application'",
    "saleMethod": "string - e.g. 'For Sale by Private Treaty'",
    "heroPhotoUrl": "string - URL of hero photo",
    "energyRating": "string or null - e.g. 'B3' or null if not provided"
  },
  "description": {
    "marketingText": "string - exactly 2 short paragraphs separated by newline",
    "keyFeatures": ["string array - 4-6 concise selling points (under 8 words each)"]
  },
  "rooms": [
    {
      "id": "string - unique ID like 'room-1'",
      "name": "string - room name",
      "floor": "string - floor level",
      "dimensions": "string or null - e.g. \"15'5 x 9'4 (4.7m x 2.9m)\"",
      "description": "string or null - max 10 words",
      "photoUrl": "string or null - best matching photo URL from available photos"
    }
  ],
  "features": {
    "services": ["string array - utilities/services"],
    "external": ["string array - external features"],
    "nearby": ["string array - nearby amenities/points of interest"]
  },
  "location": {
    "text": "string - exactly 2 sentences about the location",
    "amenities": []
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
  localeConfig: EdgeLocaleConfig,
  customInstructions: string
): string {
  const spellingLabel = localeConfig.spelling === 'british' ? 'British English' : 'American English';
  const measurementNote = localeConfig.measurements.area === 'sqm'
    ? 'Use both imperial (feet/inches) as primary and metric in parentheses.'
    : 'Use imperial (feet and inches). Also include metric in parentheses.';

  return `You are an expert real estate copywriter. Regenerate ONLY the "${section}" section of a property brochure.

LOCALE: ${spellingLabel}, ${localeConfig.currency.symbol}, ${localeConfig.country}
Measurements: ${measurementNote}

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
      .select('business_name, logo_url, primary_color, secondary_color, contact_name, contact_email, contact_phone, business_address, psr_licence_number, locale, currency, country_code, default_brochure_certifications, default_brochure_style_options')
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

    // Analyze photos with vision (only for full generation, not section regen)
    let photoDescriptions: Map<string, string> | undefined;
    if (!regenerateSection && photos.length > 0) {
      try {
        photoDescriptions = await analyzeAllPhotos(GOOGLE_AI_API_KEY, photos);
      } catch (err) {
        console.error('[Brochure] Vision analysis failed, continuing without descriptions:', err);
      }
    }

    // Fetch custom AI instructions
    const effectiveLocale = locale || org.locale || 'en-IE';
    const customInstructions = await fetchAIInstructions(supabase, 'brochure_generation', organizationId, effectiveLocale);
    const customInstructionsSection = buildCustomInstructionsSection(customInstructions);

    const localeConfig = getEdgeLocaleConfig(effectiveLocale);

    // Build the prompt
    const prompt = regenerateSection
      ? buildSectionRegeneratePrompt(regenerateSection, listingWithPhotos, existingContent || {}, localeConfig, customInstructionsSection)
      : buildFullBrochurePrompt(listingWithPhotos, localeConfig, customInstructionsSection, photoDescriptions);

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
            thinkingConfig: { thinkingBudget: 0 },
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
      licenceDisplayLabel: ({
        'en-IE': 'PSRA Licence',
        'en-GB': 'Propertymark No.',
        'en-US': 'License No.',
        'en-CA': 'Reg. No.',
        'en-AU': 'Licence No.',
        'en-NZ': 'REA Licence',
      } as Record<string, string>)[effectiveLocale] || 'Licence No.',
      locale: effectiveLocale,
      currency: org.currency || localeConfig.currency.code,
      countryCode: org.country_code || 'IE',
      styleOptions: {
        templateId: 'classic-1',
        frameStyle: 'classic',
        imageCornerRadius: 'rounded',
        imageBorder: true,
        showInnerPrice: false,
        showBackCoverPrice: false,
        pageFormat: 'a5',
        ...(org.default_brochure_style_options || {}),
        ...(org.default_brochure_certifications ? { certificationLogos: org.default_brochure_certifications } : {}),
      },
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
