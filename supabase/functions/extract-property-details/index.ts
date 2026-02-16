import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

async function fetchAIInstructions(
  supabase: ReturnType<typeof createClient>,
  featureType: string,
  organizationId?: string,
  locale?: string
): Promise<AIInstructionSet[]> {
  try {
    // Pass null for locale when empty/undefined to enable global fallback
    const effectiveLocale = locale && locale.trim() !== '' ? locale : null;
    const { data, error } = await supabase.rpc('get_ai_instructions', {
      p_feature_type: featureType,
      p_organization_id: organizationId || null,
      p_locale: effectiveLocale
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
    sections.push(`EXTRACTION GUIDELINES:\n- ${allToneGuidelines.join('\n- ')}`);
  }
  
  const freeformInstructions = instructions
    .filter(i => i.freeform_instructions)
    .map(i => i.freeform_instructions);
  if (freeformInstructions.length > 0) {
    sections.push(`ADDITIONAL INSTRUCTIONS:\n${freeformInstructions.join('\n\n')}`);
  }
  
  if (sections.length === 0) return '';
  return `\n\nCUSTOM EXTRACTION REQUIREMENTS:\n${sections.join('\n\n')}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image, text, organizationId, locale } = await req.json();
    
    console.log('Extracting property details from input');

    const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
    if (!GOOGLE_AI_API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY not configured');
    }

    // Initialize Supabase client for fetching custom instructions
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch custom AI instructions for property extraction
    const customInstructions = await fetchAIInstructions(supabase, 'property_extraction', organizationId, locale);
    const customInstructionsSection = buildCustomInstructionsSection(customInstructions);
    
    if (customInstructions.length > 0) {
      console.log(`Loaded ${customInstructions.length} custom instruction set(s) for property_extraction`);
    }

    // Prepare the messages for the AI
    const messages: any[] = [
      {
        role: 'system',
        content: `You are a property data extraction expert. Extract property details from images or text and return them in the specified format. Use your best judgment to infer details from context.${customInstructionsSection}

CRITICAL INSTRUCTIONS FOR DESCRIPTIONS:
When extracting descriptions, especially from multiple screenshots:
1. DETECT DUPLICATES: Identify and remove any duplicate or near-duplicate paragraphs/sentences that appear across multiple screenshots
2. LOGICAL FLOW: Ensure the final description reads as a coherent, logical narrative without repetition
3. MERGE INTELLIGENTLY: If you see overlapping content (e.g., same information phrased differently), combine it into a single, well-written paragraph
4. REMOVE REDUNDANCY: Do not repeat the same information multiple times even if it appears in different screenshots
5. MAINTAIN STRUCTURE: Preserve the natural flow from introduction → features → location → conclusion
6. CHECK CONTINUITY: Ensure each paragraph logically follows the previous one without jarring transitions or repeated ideas`
      }
    ];

    // Build user message with image or text
    if (image) {
      // Handle image input - ensure it's properly formatted for Gemini
      const imageContent: any[] = [
        {
          type: 'text',
          text: `Carefully extract ALL property details from this image. Pay special attention to:

CATEGORY: Determine if this is:
- "Listing" - Property for SALE (has asking price, look for "for sale", "price", "€X" without rental terms)
- "Rental" - Long-term RENTAL (monthly rate, look for "to let", "per month", "€X pcm", "monthly rent", "lease")
- "Holiday Rental" - Short-term rental (look for "per night", "per week", "€X pw", "holiday let", "Airbnb", "vacation rental", "self-catering")

PRICE: Extract the numeric price value ONLY (no currency symbols or text). Look for:
- Sale prices: "€250,000", "250000", "€250k"
- Monthly rental rates: "€4,500 per month", "€4500 pcm", "From €X per month", "€X/month"
- Weekly/nightly rates for holiday rentals: "€500 per week", "€100 per night"
Extract ONLY the numeric value (e.g., "4500" from "€4,500 per month"). Remove commas, currency symbols, and text.
If you see "POA", "Price on Application", "Contact for price", or similar, set isPOA to true and price to "0".

BUILDING TYPE: Look for property type (Detached, Semi-Detached, Terrace, Apartment, Commercial, Land)
BER RATING: Look for energy rating badges or BER certificates (A1-G or EXEMPT)

DESCRIPTION: Extract ONLY the actual property description text. CRITICAL FILTERING AND DEDUPLICATION RULES:
- EXCLUDE any mortgage advertising, financing tools, calculators, or buying guides (e.g., "Your Mortgage and Insurance Tools", "Check off the steps", "Budget calculator", "Learn more about what this area has to offer")
- EXCLUDE standard features that belong in Specs (like "Parking", "Garden", "Alarm" - these go in the Specs field, NOT description)
- EXCLUDE website navigation text, buttons, or call-to-action content
- ONLY include the genuine property description that describes the property itself, its location, and unique characteristics
- CRITICAL: If processing multiple screenshots, check for duplicate paragraphs and remove them - keep only ONE instance of each unique paragraph
- VERIFY CONTINUITY: Read the entire description to ensure it flows logically without repetition or contradictions
- MERGE OVERLAPPING CONTENT: If the same information appears multiple times in different words, merge it into one clear statement
- Preserve paragraph structure by using double newlines (\\n\\n) between paragraphs. Each distinct paragraph should be separated.

SPECS: Extract specifications like room dimensions and services. Include standard features here like Parking, Garden, Alarm, etc. IMPORTANT: Put each room or item on a new line using newline characters (\\n). Format like:
Room Name: dimensions
Another Room: dimensions
Services include: details

Also extract: price (euros, numbers only), bedrooms, bathrooms, building size (sqm), land size (acres), full address including street, town, county, and eircode.

If any field is not visible in the image, leave it empty. Be thorough and extract all visible text.`
        },
        {
          type: 'image_url',
          image_url: {
            url: image
          }
        }
      ];
      
      messages.push({
        role: 'user',
        content: imageContent
      });
    } else if (text) {
      messages.push({
        role: 'user',
        content: `Carefully extract ALL property details from this text: "${text}"

Pay special attention to:
- CATEGORY: Determine if this is:
  * "Listing" - Property for SALE (has asking price, keywords: "for sale", "price", "€X" without rental terms)
  * "Rental" - Long-term RENTAL (monthly rate, keywords: "to let", "per month", "€X pcm", "monthly rent", "lease")
  * "Holiday Rental" - Short-term rental (keywords: "per night", "per week", "€X pw", "holiday let", "Airbnb", "vacation rental", "self-catering")
- PRICE: Extract the numeric price value ONLY (no currency symbols or text). Look for:
  * Sale prices: "€250,000", "250000", "€250k"
  * Monthly rental rates: "€4,500 per month", "€4500 pcm", "From €X per month", "€X/month"  
  * Weekly/nightly rates for holiday rentals: "€500 per week", "€100 per night"
  Extract ONLY the numeric value (e.g., "4500" from "€4,500 per month"). Remove commas, currency symbols, and text.
  If you see "POA", "Price on Application", "Contact for price", or similar, set isPOA to true and price to "0".
- BUILDING TYPE: Property type (Detached, Semi-Detached, Terrace, Apartment, Commercial, Land)
- BER RATING: Energy rating (A1-G or EXEMPT)
- DESCRIPTION: Extract ONLY the actual property description text. CRITICAL RULES:
  * EXCLUDE any mortgage advertising, financing tools, calculators, or buying guides (e.g., "Your Mortgage and Insurance Tools", "Check off the steps", "Budget calculator", "Learn more about what this area has to offer")
  * EXCLUDE standard features that belong in Specs (like "Parking", "Garden", "Alarm" - these go in the Specs field)
  * EXCLUDE website navigation text, buttons, or call-to-action content
  * ONLY include the genuine property description that describes the property itself
  * CRITICAL: Check for duplicate paragraphs and remove them - keep only ONE instance of each unique paragraph
  * VERIFY CONTINUITY: Read the entire description to ensure it flows logically without repetition or contradictions
  * MERGE OVERLAPPING CONTENT: If the same information appears multiple times in different words, merge it into one clear statement
  * Preserve paragraph structure by using double newlines (\\n\\n) between paragraphs
- SPECS: Room dimensions, heating, fixtures, features. IMPORTANT: Put each room or item on a new line using newline characters (\\n). Format like:
Room Name: dimensions
Another Room: dimensions
Services include: details

Also extract: price (euros), bedrooms, bathrooms, building size (sqm), land size (acres), address, town, county, eircode.

Be thorough and extract all available information.`
      });
    } else {
      throw new Error('Either image or text must be provided');
    }

    // Prepare function declaration for Google Gemini
    const functionDeclaration = {
      name: 'extract_property_details',
      description: 'Extract property details from the provided image or text',
      parameters: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'Detailed property description with paragraph breaks preserved using \\n\\n between paragraphs'
          },
          category: {
            type: 'string',
            enum: ['Listing', 'Rental', 'Holiday Rental'],
            description: 'Property category: "Listing" for sale properties, "Rental" for long-term rentals (per month), "Holiday Rental" for short-term/vacation rentals (per night/week)'
          },
          buildingType: {
            type: 'string',
            enum: ['Detached', 'Semi-Detached', 'Terrace', 'Apartment', 'Commercial', 'Land'],
            description: 'Type of building'
          },
          isPOA: {
            type: 'boolean',
            description: 'True if price is "POA" (Price on Application), "Contact for price", or similar'
          },
          price: {
            type: 'string',
            description: 'Numeric price value ONLY (no €, commas, or text). Extract from phrases like "€4,500 per month" → "4500", "From €250,000" → "250000". Set to "0" if isPOA is true'
          },
          bedrooms: {
            type: 'string',
            description: 'Number of bedrooms'
          },
          bathrooms: {
            type: 'string',
            description: 'Number of bathrooms'
          },
          buildingSize: {
            type: 'string',
            description: 'Building size in square meters'
          },
          landSize: {
            type: 'string',
            description: 'Land size in acres (format: x.xx)'
          },
          addressLine1: {
            type: 'string',
            description: 'Street address'
          },
          addressTown: {
            type: 'string',
            description: 'Town name'
          },
          county: {
            type: 'string',
            description: 'County name'
          },
          eircode: {
            type: 'string',
            description: 'Irish postal code (Eircode)'
          },
          berRating: {
            type: 'string',
            enum: ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3', 'D1', 'D2', 'E1', 'E2', 'F', 'G', 'EXEMPT'],
            description: 'BER energy rating'
          },
          specs: {
            type: 'string',
            description: 'Additional specifications with each item on a new line (\\n). Format: Room Name: dimensions\\nAnother Room: dimensions'
          },
          furnishingStatus: {
            type: 'string',
            enum: ['Unfurnished', 'Partially Furnished', 'Fully Furnished'],
            description: 'Furnishing status of the rental property (look for keywords: furnished, unfurnished, semi-furnished, fully furnished)'
          },
          bookingPlatformLink: {
            type: 'string',
            description: 'URL to booking platform (extract URLs containing airbnb, booking.com, vrbo, or similar platforms)'
          }
        },
        required: []
      }
    };

    // Build Gemini API request body
    const systemInstruction = messages.find((m: any) => m.role === 'system')?.content || '';
    const userMessage = messages.find((m: any) => m.role === 'user');
    
    let parts = [];
    if (userMessage?.content) {
      if (Array.isArray(userMessage.content)) {
        // Handle multimodal content (text + image)
        for (const part of userMessage.content) {
          if (part.type === 'text') {
            parts.push({ text: part.text });
          } else if (part.type === 'image_url') {
            // Extract base64 data from data URL
            const imageUrl = part.image_url.url;
            if (imageUrl.startsWith('data:')) {
              // Parse data URL format: data:image/jpeg;base64,/9j/4AAQ...
              const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
              if (matches) {
                const mimeType = matches[1];
                const base64Data = matches[2];
                parts.push({
                  inlineData: {
                    mimeType,
                    data: base64Data
                  }
                });
              } else {
                console.error('Invalid data URL format:', imageUrl.substring(0, 50));
                throw new Error('Invalid image data URL format');
              }
            } else {
              // Assume it's already pure base64 - detect mime type
              let mimeType = 'image/jpeg'; // default
              if (imageUrl.startsWith('/9j/')) mimeType = 'image/jpeg';
              else if (imageUrl.startsWith('iVBORw0KGgo')) mimeType = 'image/png';
              else if (imageUrl.startsWith('R0lGOD')) mimeType = 'image/gif';
              else if (imageUrl.startsWith('UklGR')) mimeType = 'image/webp';
              
              parts.push({
                inlineData: {
                  mimeType,
                  data: imageUrl
                }
              });
            }
          }
        }
      } else {
        // Simple text content
        parts.push({ text: userMessage.content });
      }
    }

    // Call Google Gemini API directly
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_AI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: [{
          role: 'user',
          parts
        }],
        tools: [{
          functionDeclarations: [functionDeclaration]
        }],
        toolConfig: {
          functionCallingConfig: {
            mode: 'ANY',
            allowedFunctionNames: ['extract_property_details']
          }
        }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('Google Gemini API error:', response.status, errorText);
      throw new Error('Failed to extract property details');
    }

    const data = await response.json();
    console.log('Gemini API Response:', JSON.stringify(data));

    // Extract function call from Gemini response
    const functionCall = data.candidates?.[0]?.content?.parts?.find((part: any) => part.functionCall);
    if (!functionCall) {
      throw new Error('No function call in Gemini response');
    }

    const propertyDetails = functionCall.functionCall.args;
    console.log('Extracted property details:', propertyDetails);

    return new Response(
      JSON.stringify({ success: true, data: propertyDetails }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-property-details:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
