import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

// CORS headers set per-request below

interface EnhanceRequest {
  type: 'description' | 'specs';
  content: string;
  locale: string;
  organizationId?: string;
  propertyMetadata?: {
    category?: string;
    buildingType?: string;
    bedrooms?: number;
    bathrooms?: number;
    town?: string;
    county?: string;
  };
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

// Helper to fetch custom AI instructions
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

// Merge custom instructions into prompt
function buildCustomInstructionsSection(instructions: AIInstructionSet[]): string {
  if (!instructions || instructions.length === 0) return '';
  
  const sections: string[] = [];
  
  // Aggregate banned phrases
  const allBannedPhrases = instructions.flatMap(i => i.banned_phrases || []);
  if (allBannedPhrases.length > 0) {
    sections.push(`BANNED PHRASES (Never use these):\n- ${allBannedPhrases.join('\n- ')}`);
  }
  
  // Aggregate tone guidelines
  const allToneGuidelines = instructions.flatMap(i => i.tone_guidelines || []);
  if (allToneGuidelines.length > 0) {
    sections.push(`TONE GUIDELINES:\n- ${allToneGuidelines.join('\n- ')}`);
  }
  
  // Aggregate freeform instructions (in priority order)
  const freeformInstructions = instructions
    .filter(i => i.freeform_instructions)
    .map(i => i.freeform_instructions);
  if (freeformInstructions.length > 0) {
    sections.push(`ADDITIONAL INSTRUCTIONS:\n${freeformInstructions.join('\n\n')}`);
  }
  
  if (sections.length === 0) return '';
  
  return `\n\nCUSTOM REQUIREMENTS:\n${sections.join('\n\n')}`;
}

const getLocaleConfig = (locale: string) => {
  switch (locale) {
    case 'en-GB':
      return {
        currency: '£',
        currencyName: 'GBP',
        areaUnit: 'm²',
        spelling: 'British English',
        energyRating: 'EPC',
        postalCode: 'postcode',
        terminology: {
          apartment: 'flat',
          terrace: 'terraced house',
          ground_floor: 'ground floor',
          first_floor: 'first floor',
        }
      };
    case 'en-US':
      return {
        currency: '$',
        currencyName: 'USD',
        areaUnit: 'sq ft',
        spelling: 'American English',
        energyRating: 'HERS',
        postalCode: 'ZIP code',
        terminology: {
          apartment: 'condo',
          terrace: 'townhouse',
          ground_floor: 'first floor',
          first_floor: 'second floor',
        }
      };
    case 'en-IE':
    default:
      return {
        currency: '€',
        currencyName: 'EUR',
        areaUnit: 'm²',
        spelling: 'British English (Irish)',
        energyRating: 'BER',
        postalCode: 'Eircode',
        terminology: {
          apartment: 'apartment',
          terrace: 'terrace',
          ground_floor: 'ground floor',
          first_floor: 'first floor',
        }
      };
  }
};

const getDescriptionPrompt = (content: string, localeConfig: any, metadata: any) => {
  return `You are an expert real estate copywriter. Enhance this property description to be more engaging and sales-focused while maintaining complete accuracy.

LOCALE REQUIREMENTS (${localeConfig.spelling}):
- Use ${localeConfig.spelling} spelling (e.g., "colour" not "color" for British, "center" not "centre" for American)
- Use ${localeConfig.currency} for any currency references
- Use ${localeConfig.areaUnit} for measurements
- Reference ${localeConfig.energyRating} for energy ratings

PROPERTY CONTEXT:
${metadata?.category ? `- Category: ${metadata.category}` : ''}
${metadata?.buildingType ? `- Building Type: ${metadata.buildingType}` : ''}
${metadata?.bedrooms ? `- Bedrooms: ${metadata.bedrooms}` : ''}
${metadata?.bathrooms ? `- Bathrooms: ${metadata.bathrooms}` : ''}
${metadata?.town ? `- Location: ${metadata.town}${metadata.county ? `, ${metadata.county}` : ''}` : ''}

ENHANCEMENT GUIDELINES:
1. Make the opening sentence compelling and attention-grabbing
2. Highlight key selling points with persuasive language
3. Use sensory and emotional language where appropriate
4. Maintain a professional yet warm tone
5. Keep all facts accurate - do NOT add features that aren't mentioned
6. Improve flow and readability with better paragraph structure
7. Remove any awkward phrasing or redundancy
8. Add subtle calls to action where natural
9. Keep the total length similar to the original (within 20%)

ORIGINAL DESCRIPTION:
${content}

Return ONLY the enhanced description text, no explanations or markers. Preserve paragraph breaks using double newlines.`;
};

const getSpecsPrompt = (content: string, localeConfig: any) => {
  const dimensionExample = localeConfig.areaUnit === 'sq ft' 
    ? '"Living Room: 17ft x 14ft"' 
    : '"Living Room: 5.2m x 4.1m"';
  
  const abbreviationRule = localeConfig.areaUnit === 'sq ft'
    ? 'Standardize to sq ft (not sf, not sqft)'
    : 'Standardize to m² (not sqm, not sq m)';

  return `You are a property specifications formatter. Clean up and format these property specifications for clarity and consistency.

LOCALE REQUIREMENTS:
- Use ${localeConfig.areaUnit} for all area measurements
- Use ${localeConfig.spelling} spelling
- Use ${localeConfig.terminology.ground_floor} for ground level, ${localeConfig.terminology.first_floor} for the next level up

FORMATTING RULES:
1. Put each room/item on its own line
2. Use consistent format: "Room Name: dimensions" (e.g., ${dimensionExample})
3. Convert any inconsistent measurements to ${localeConfig.areaUnit}
4. Group related items (bedrooms together, reception rooms together, etc.)
5. Use bullet points (•) for features that don't have dimensions
6. ${abbreviationRule}
7. Keep it purely factual - no marketing language
8. Remove any duplicate entries
9. Ensure dimensions are in correct format (width x depth)

ORIGINAL SPECS:
${content}

Return ONLY the formatted specifications, no explanations. Each item should be on a new line.`;
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('Request body keys:', Object.keys(body));
    console.log('Type:', body.type);
    console.log('Content length:', body.content?.length || 0);
    console.log('Locale:', body.locale);
    
    const { type, content, locale, organizationId, propertyMetadata } = body as EnhanceRequest;
    
    console.log(`Enhancing ${type} for locale: ${locale}`);

    if (!content || content.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: 'Content too short. Please enter at least 10 characters.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (content.length > 10000) {
      return new Response(
        JSON.stringify({ error: 'Content too long. Maximum 10,000 characters allowed.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
    if (!GOOGLE_AI_API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY not configured');
    }

    // Initialize Supabase client for fetching custom instructions
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limit: 50 requests per hour per organization
    const rateLimitId = organizationId || 'unknown';
    const rateCheck = await checkRateLimit(supabase, rateLimitId, {
      feature: 'enhance-listing-copy',
      maxRequests: 50,
      windowMinutes: 60,
    });
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.', resetTime: rateCheck.resetTime }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch custom AI instructions based on type
    const featureType = type === 'description' ? 'listing_enhance_description' : 'listing_enhance_specs';
    const customInstructions = await fetchAIInstructions(supabase, featureType, organizationId, locale);
    const customInstructionsSection = buildCustomInstructionsSection(customInstructions);
    
    if (customInstructions.length > 0) {
      console.log(`Loaded ${customInstructions.length} custom instruction set(s) for ${featureType}`);
    }

    const localeConfig = getLocaleConfig(locale || 'en-IE');
    
    // Build prompt with custom instructions appended
    const basePrompt = type === 'description' 
      ? getDescriptionPrompt(content, localeConfig, propertyMetadata)
      : getSpecsPrompt(content, localeConfig);
    
    const prompt = basePrompt + customInstructionsSection;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: type === 'description' ? 0.7 : 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ]
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    
    const enhancedText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!enhancedText) {
      throw new Error('No response from AI');
    }

    const tokenUsage = {
      promptTokens: result.usageMetadata?.promptTokenCount || 0,
      completionTokens: result.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: result.usageMetadata?.totalTokenCount || 0,
    };

    console.log(`Enhanced ${type} successfully. Tokens used:`, tokenUsage);

    return new Response(
      JSON.stringify({
        success: true,
        enhancedText: enhancedText.trim(),
        tokenUsage,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in enhance-listing-copy:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
