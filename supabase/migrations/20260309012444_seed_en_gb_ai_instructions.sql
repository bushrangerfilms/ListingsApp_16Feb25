-- Seed en-GB locale-specific AI instruction sets for UK market launch
-- These supplement the global instructions with UK-specific terminology and conventions

INSERT INTO public.ai_instruction_sets (
  feature_type, scope, locale, name, description, banned_phrases, tone_guidelines, freeform_instructions, priority
) VALUES
(
  'listing_enhance_description',
  'global',
  'en-GB',
  'UK Description Enhancement Rules',
  'UK-specific rules for enhancing property descriptions',
  ARRAY['BER Rating', 'Eircode', 'county council', 'Property Registration Authority', 'stamp duty (Irish)', 'PRSA', 'gaff'],
  ARRAY['Use British English spelling (colour, centre, organisation)', 'Reference UK-relevant amenities (high street, tube, rail links, motorway)', 'Use UK property types (detached, semi-detached, terraced, flat, maisonette, bungalow)', 'Refer to Energy Performance Certificate (EPC) not BER'],
  'Use British English throughout. Reference postcodes not Eircodes. Use UK floor numbering (ground floor, first floor, second floor). Mention council tax band if relevant. Reference UK-specific features like period properties, conservation areas, listed building status. Use "garden" not "yard" for outdoor space. Currency is GBP (£). Area in sq m.',
  110
),
(
  'listing_enhance_specs',
  'global',
  'en-GB',
  'UK Specs Formatting Rules',
  'UK-specific rules for formatting property specifications',
  ARRAY['BER', 'Eircode'],
  ARRAY['Use British English spelling', 'Use metric measurements (sq m) as primary with imperial in parentheses where helpful', 'Reference EPC rating (A-G) not BER'],
  'Format UK property specs with EPC rating (A to G), council tax band, tenure type (freehold/leasehold). Use postcode format (e.g., SW1A 1AA). Floor numbering: Ground, First, Second (not 1st, 2nd, 3rd). Include parking type (garage, driveway, on-street, permit).',
  110
),
(
  'property_extraction',
  'global',
  'en-GB',
  'UK Property Extraction Rules',
  'UK-specific rules for extracting property details from screenshots',
  ARRAY[]::TEXT[],
  ARRAY['Recognise UK property portals (Rightmove, Zoopla, OnTheMarket)', 'Extract EPC rating not BER rating', 'Identify UK tenure types (freehold, leasehold, share of freehold)'],
  'When extracting from UK property listings: identify council tax band, EPC rating (A-G), tenure type, and service charges for leasehold properties. Recognise UK postcode format. Identify listed building status and conservation area designations. Extract parking arrangements.',
  110
),
(
  'chatbot_assistant',
  'global',
  'en-GB',
  'UK Chatbot Personality',
  'UK-specific personality and behavior for AI chatbot',
  ARRAY[]::TEXT[],
  ARRAY['Use British English spelling and phrasing', 'Reference UK buying process (offer, survey, exchange, completion)', 'Mention UK-relevant considerations (stamp duty, leasehold, chain status)'],
  'Guide UK buyers through the process: viewing → offer → mortgage agreement in principle → survey → exchange of contracts → completion. Reference Stamp Duty Land Tax thresholds. Mention chain status. For leasehold properties, discuss service charges and ground rent. Use "estate agent" not "realtor".',
  110
),
(
  'photo_captions',
  'global',
  'en-GB',
  'UK Photo Caption Rules',
  'UK-specific rules for generating photo captions',
  ARRAY[]::TEXT[],
  ARRAY['Use British English spelling', 'Reference UK architectural features (bay windows, sash windows, period features)', 'Use UK room names (lounge, reception room, utility room)'],
  'Use UK property terminology: lounge/reception room (not living room), garden (not yard/backyard), en-suite (hyphenated), utility room, conservatory, annexe (not annex). Reference period features where visible: cornicing, dado rails, ceiling roses, original fireplaces.',
  110
),
(
  'social_media_posts',
  'global',
  'en-GB',
  'UK Social Media Rules',
  'UK-specific rules for generating social media posts',
  ARRAY['DM for details', 'Link in bio'],
  ARRAY['Use British English spelling', 'Reference UK property market language', 'Include UK-relevant hashtags (#property #ukproperty #estateagent)'],
  'Use UK property market language: "new to market", "price reduced", "chain free", "no onward chain". Include location-specific hashtags where appropriate. Reference local area features (transport links, school catchment, conservation area). Currency in GBP (£). Use "estate agent" terminology.',
  110
)
ON CONFLICT DO NOTHING;

-- Enable the UK launch feature flag
UPDATE public.feature_flags
SET is_active = true, default_state = true
WHERE key = 'uk_launch';
