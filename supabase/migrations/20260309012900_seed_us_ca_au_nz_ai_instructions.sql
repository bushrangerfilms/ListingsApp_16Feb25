-- Seed locale-specific AI instruction sets for US, CA, AU, NZ markets
-- Priority 110 = overrides global (100) but not org-specific

-- ═══════════════════════════════════════════════════
-- UNITED STATES (en-US)
-- ═══════════════════════════════════════════════════

INSERT INTO public.ai_instruction_sets (
  feature_type, scope, locale, name, description, banned_phrases, tone_guidelines, freeform_instructions, priority
) VALUES
(
  'listing_enhance_description',
  'global',
  'en-US',
  'US Description Enhancement Rules',
  'US-specific rules for enhancing property descriptions',
  ARRAY['BER Rating', 'Eircode', 'EPC', 'council tax', 'stamp duty', 'solicitor', 'flat'],
  ARRAY['Use American English spelling (color, center, organization)', 'Reference US amenities (freeway access, school district, HOA amenities)', 'Use US property types (single-family home, condo, townhouse, duplex, ranch)', 'Comply with Fair Housing Act — never reference demographics, religion, or family status'],
  'Use American English throughout. Reference zip codes not postcodes. Use US floor numbering (1st floor = ground level). Mention HOA fees and property taxes where relevant. Use "yard" and "backyard" for outdoor space, "garage" for parking. Currency is USD ($). Area in sq ft. Include school district and walkability references where appropriate. IMPORTANT: Never use language that could violate the Fair Housing Act.',
  110
),
(
  'listing_enhance_specs',
  'global',
  'en-US',
  'US Specs Formatting Rules',
  'US-specific rules for formatting property specifications',
  ARRAY['BER', 'Eircode', 'EPC', 'sq m'],
  ARRAY['Use American English spelling', 'Use imperial measurements (sq ft) as primary', 'Reference US energy standards where applicable'],
  'Format US property specs with sq ft measurements, lot size in acres or sq ft. Include year built, HOA fees (monthly), property tax (annual). Floor numbering: 1st Floor = ground level, 2nd Floor, 3rd Floor. Zip code format (e.g., 90210 or 90210-1234). Include MLS number if available. Parking: garage (1-car, 2-car, 3-car), carport, driveway.',
  110
),
(
  'property_extraction',
  'global',
  'en-US',
  'US Property Extraction Rules',
  'US-specific rules for extracting property details from screenshots',
  ARRAY[]::TEXT[],
  ARRAY['Recognise US property portals (Zillow, Realtor.com, Redfin, MLS)', 'Extract HOA fees and property taxes', 'Identify US property types (single-family, condo, townhome)'],
  'When extracting from US property listings: identify MLS number, HOA fees, property taxes, year built, lot size, school district. Recognise zip code format. Extract garage details (attached/detached, number of cars). Identify zoning type. Note any Fair Housing compliance notices.',
  110
),
(
  'chatbot_assistant',
  'global',
  'en-US',
  'US Chatbot Personality',
  'US-specific personality and behavior for AI chatbot',
  ARRAY[]::TEXT[],
  ARRAY['Use American English spelling and phrasing', 'Reference US buying process (offer, inspection, appraisal, closing)', 'Mention US-relevant considerations (property taxes, HOA, title insurance)'],
  'Guide US buyers through the process: pre-approval → home search → offer → inspection → appraisal → closing. Reference down payment requirements (conventional, FHA, VA loans). Mention title insurance and escrow. Use "Realtor" or "real estate agent" not "estate agent". Comply with Fair Housing Act at all times.',
  110
),
(
  'photo_captions',
  'global',
  'en-US',
  'US Photo Caption Rules',
  'US-specific rules for generating photo captions',
  ARRAY[]::TEXT[],
  ARRAY['Use American English spelling', 'Reference US architectural styles (craftsman, colonial, ranch, modern)', 'Use US room names (living room, family room, den, mudroom)'],
  'Use US property terminology: living room, family room, den, mudroom, walk-in closet, master suite/primary suite, breakfast nook, great room. Reference architectural styles where visible: craftsman, colonial, ranch, Cape Cod, contemporary. Use "yard" and "backyard" for outdoor areas.',
  110
),
(
  'social_media_posts',
  'global',
  'en-US',
  'US Social Media Rules',
  'US-specific rules for generating social media posts',
  ARRAY['DM for details', 'Link in bio'],
  ARRAY['Use American English spelling', 'Reference US property market language', 'Include US-relevant hashtags (#realestate #justlisted #openhouse #homeforsale)'],
  'Use US property market language: "just listed", "price reduced", "open house", "move-in ready", "turnkey". Include location-specific hashtags. Reference school districts and walkability where appropriate. Currency in USD ($). Use "Realtor" or "real estate agent". Comply with Fair Housing Act — never reference protected classes.',
  110
),

-- ═══════════════════════════════════════════════════
-- CANADA (en-CA)
-- ═══════════════════════════════════════════════════

(
  'listing_enhance_description',
  'global',
  'en-CA',
  'Canadian Description Enhancement Rules',
  'Canada-specific rules for enhancing property descriptions',
  ARRAY['BER Rating', 'Eircode', 'EPC', 'council tax', 'stamp duty'],
  ARRAY['Use Canadian English spelling (colour, centre but program not programme)', 'Reference Canadian amenities (transit, schools, parks, ski hills)', 'Use Canadian property types (detached, semi-detached, townhouse, condo, bungalow)', 'Reference EnerGuide rating where applicable'],
  'Use Canadian English throughout (British spelling for most words but some American conventions). Reference postal codes (A1A 1A1 format). Use Canadian floor numbering (1st floor = ground level, like US). Mention property taxes. Currency is CAD ($). Area in sq ft. Reference provincial context where relevant (Ontario, BC, Alberta, etc.). Include proximity to transit (TTC, SkyTrain, CTrain, etc.).',
  110
),
(
  'listing_enhance_specs',
  'global',
  'en-CA',
  'Canadian Specs Formatting Rules',
  'Canada-specific rules for formatting property specifications',
  ARRAY['BER', 'Eircode', 'EPC'],
  ARRAY['Use Canadian English spelling', 'Use imperial measurements (sq ft) as primary with metric where helpful', 'Reference EnerGuide rating where applicable'],
  'Format Canadian property specs with sq ft measurements, lot size in sq ft or acres. Include year built, property taxes (annual), condo fees (monthly) if applicable. Postal code format (e.g., M5V 2T6). Include MLS number. Parking: garage, underground, surface. Reference EnerGuide energy rating (GJ/year) if available.',
  110
),
(
  'property_extraction',
  'global',
  'en-CA',
  'Canadian Property Extraction Rules',
  'Canada-specific rules for extracting property details from screenshots',
  ARRAY[]::TEXT[],
  ARRAY['Recognise Canadian property portals (Realtor.ca, REW, Centris)', 'Extract property taxes and condo fees', 'Identify Canadian property types'],
  'When extracting from Canadian listings: identify MLS number, property taxes, condo/strata fees, lot dimensions, year built. Recognise Canadian postal code format (A1A 1A1). Extract parking type (garage, underground, surface). Note CREA/board watermarks. Identify EnerGuide rating if shown.',
  110
),
(
  'chatbot_assistant',
  'global',
  'en-CA',
  'Canadian Chatbot Personality',
  'Canada-specific personality and behavior for AI chatbot',
  ARRAY[]::TEXT[],
  ARRAY['Use Canadian English spelling and phrasing', 'Reference Canadian buying process (offer, inspection, conditions, closing)', 'Mention Canadian-relevant considerations (land transfer tax, CMHC insurance, stress test)'],
  'Guide Canadian buyers through the process: pre-approval (stress test) → home search → offer (with conditions) → inspection → financing → closing. Reference CMHC mortgage insurance for <20% down. Mention land transfer tax (varies by province). Use "Realtor" or "real estate agent". Reference provincial variations where relevant.',
  110
),
(
  'photo_captions',
  'global',
  'en-CA',
  'Canadian Photo Caption Rules',
  'Canada-specific rules for generating photo captions',
  ARRAY[]::TEXT[],
  ARRAY['Use Canadian English spelling', 'Reference Canadian architectural features', 'Use Canadian room terminology'],
  'Use Canadian property terminology: living room, family room, mudroom, den, ensuite (one word), rec room, finished basement. Reference Canadian features: snow removal, heated garage, triple-pane windows, radiant floor heating. Use "yard" and "backyard" for outdoor areas.',
  110
),
(
  'social_media_posts',
  'global',
  'en-CA',
  'Canadian Social Media Rules',
  'Canada-specific rules for generating social media posts',
  ARRAY['DM for details', 'Link in bio'],
  ARRAY['Use Canadian English spelling', 'Reference Canadian property market language', 'Include Canadian-relevant hashtags (#realestate #canadianrealestate #justlisted)'],
  'Use Canadian property market language: "just listed", "price reduced", "open house", "move-in ready". Include city/province-specific hashtags (#TorontoRealEstate, #VancouverHomes, etc.). Currency in CAD ($). Reference transit and school catchment areas.',
  110
),

-- ═══════════════════════════════════════════════════
-- AUSTRALIA (en-AU)
-- ═══════════════════════════════════════════════════

(
  'listing_enhance_description',
  'global',
  'en-AU',
  'Australian Description Enhancement Rules',
  'Australia-specific rules for enhancing property descriptions',
  ARRAY['BER Rating', 'Eircode', 'EPC', 'council tax', 'stamp duty (UK)', 'solicitor'],
  ARRAY['Use Australian English spelling (colour, centre, organisation)', 'Reference Australian amenities (beach, bush, transport, schools)', 'Use Australian property types (house, unit, apartment, townhouse, villa, acreage)', 'Reference NatHERS star rating where applicable'],
  'Use Australian English throughout. Reference postcodes (4-digit format, e.g., 2000). Use Australian floor numbering (ground floor, level 1, level 2). Mention strata levies for units/apartments. Currency is AUD ($). Area in sq m (metric standard in Australia). Reference local council area. Include proximity to CBD, beaches, transport (train, tram, bus). Mention auction dates where relevant — auctions are common in AU.',
  110
),
(
  'listing_enhance_specs',
  'global',
  'en-AU',
  'Australian Specs Formatting Rules',
  'Australia-specific rules for formatting property specifications',
  ARRAY['BER', 'Eircode', 'EPC', 'sq ft'],
  ARRAY['Use Australian English spelling', 'Use metric measurements (sq m) exclusively — Australia is fully metric', 'Reference NatHERS star rating (1-10 stars) where applicable'],
  'Format Australian property specs with sq m measurements (never sq ft). Land size in sq m or hectares. Include year built, council rates (annual), strata levies (quarterly) if applicable. Postcode format (4 digits, e.g., 2000). Include NatHERS energy star rating (1-10) if available. Parking: garage, carport, off-street, on-street.',
  110
),
(
  'property_extraction',
  'global',
  'en-AU',
  'Australian Property Extraction Rules',
  'Australia-specific rules for extracting property details from screenshots',
  ARRAY[]::TEXT[],
  ARRAY['Recognise Australian property portals (Domain, realestate.com.au)', 'Extract council rates and strata levies', 'Identify Australian property types (house, unit, townhouse, villa)'],
  'When extracting from Australian listings: identify council rates, strata levies, lot size, year built. Recognise 4-digit postcode format. Extract parking type (garage, carport, off-street). Note auction date and guide if shown. Identify NatHERS star rating. Recognise state/territory context (NSW, VIC, QLD, WA, SA, TAS, ACT, NT).',
  110
),
(
  'chatbot_assistant',
  'global',
  'en-AU',
  'Australian Chatbot Personality',
  'Australia-specific personality and behavior for AI chatbot',
  ARRAY[]::TEXT[],
  ARRAY['Use Australian English spelling and phrasing', 'Reference Australian buying process (offer/auction, building inspection, settlement)', 'Mention Australian-relevant considerations (stamp duty, LMI, first home buyer grants)'],
  'Guide Australian buyers through the process: pre-approval → search → auction or private treaty offer → building/pest inspection → exchange → settlement. Reference stamp duty (varies by state). Mention LMI for <20% deposit. First Home Owner Grant and stamp duty concessions for eligible buyers. Use "real estate agent" not "Realtor". Explain auction process (common in Melbourne/Sydney).',
  110
),
(
  'photo_captions',
  'global',
  'en-AU',
  'Australian Photo Caption Rules',
  'Australia-specific rules for generating photo captions',
  ARRAY[]::TEXT[],
  ARRAY['Use Australian English spelling', 'Reference Australian architectural features (queenslander, federation, art deco)', 'Use Australian room names (lounge, rumpus room, alfresco)'],
  'Use Australian property terminology: lounge, rumpus room, alfresco area, ensuite (one word), study nook, built-in wardrobes (BIR). Reference Australian features: outdoor entertaining, pool, ducted air conditioning, solar panels, water tank, NBN connection. Architectural styles: Queenslander, Federation, Art Deco, mid-century.',
  110
),
(
  'social_media_posts',
  'global',
  'en-AU',
  'Australian Social Media Rules',
  'Australia-specific rules for generating social media posts',
  ARRAY['DM for details', 'Link in bio'],
  ARRAY['Use Australian English spelling', 'Reference Australian property market language', 'Include Australian-relevant hashtags (#realestate #australianproperty #justlisted)'],
  'Use Australian property market language: "just listed", "price guide", "auction", "under offer", "expressions of interest". Include city-specific hashtags (#SydneyRealEstate, #MelbourneProperty, etc.). Currency in AUD ($). Reference auction dates prominently. Use "real estate agent" terminology.',
  110
),

-- ═══════════════════════════════════════════════════
-- NEW ZEALAND (en-NZ)
-- ═══════════════════════════════════════════════════

(
  'listing_enhance_description',
  'global',
  'en-NZ',
  'New Zealand Description Enhancement Rules',
  'NZ-specific rules for enhancing property descriptions',
  ARRAY['BER Rating', 'Eircode', 'EPC', 'council tax', 'stamp duty'],
  ARRAY['Use New Zealand English spelling (colour, centre, organisation)', 'Reference NZ amenities (beach, bush walks, schools, parks)', 'Use NZ property types (house, unit, apartment, townhouse, lifestyle block)', 'Mention Healthy Homes standards where relevant'],
  'Use New Zealand English throughout (very similar to British English). Reference postcodes (4-digit format, e.g., 6011). Use NZ floor numbering (ground floor, first floor). Mention rates (council rates). Currency is NZD ($). Area in sq m (metric). Reference proximity to CBD, beaches, parks. Mention earthquake strengthening / building compliance where relevant. Include CV (capital value) or RV (rateable value) references.',
  110
),
(
  'listing_enhance_specs',
  'global',
  'en-NZ',
  'New Zealand Specs Formatting Rules',
  'NZ-specific rules for formatting property specifications',
  ARRAY['BER', 'Eircode', 'EPC', 'sq ft'],
  ARRAY['Use New Zealand English spelling', 'Use metric measurements (sq m) exclusively', 'Reference Homestar or NABERSNZ rating where applicable'],
  'Format NZ property specs with sq m measurements (never sq ft). Land size in sq m or hectares. Include year built, council rates (annual), body corporate levies if applicable. Postcode format (4 digits, e.g., 6011). Parking: garage, carport, off-street. Include floor area and land area separately. Note earthquake rating / %NBS where relevant.',
  110
),
(
  'property_extraction',
  'global',
  'en-NZ',
  'New Zealand Property Extraction Rules',
  'NZ-specific rules for extracting property details from screenshots',
  ARRAY[]::TEXT[],
  ARRAY['Recognise NZ property portals (Trade Me Property, realestate.co.nz, OneRoof)', 'Extract council rates and body corporate fees', 'Identify NZ property types (house, unit, townhouse, lifestyle block)'],
  'When extracting from NZ listings: identify council rates, body corporate fees, land area, floor area, year built, CV/RV. Recognise 4-digit postcode format. Extract parking details. Note auction/tender/deadline sale dates. Identify earthquake strengthening status (%NBS). Recognise REINZ listing conventions.',
  110
),
(
  'chatbot_assistant',
  'global',
  'en-NZ',
  'New Zealand Chatbot Personality',
  'NZ-specific personality and behavior for AI chatbot',
  ARRAY[]::TEXT[],
  ARRAY['Use New Zealand English spelling and phrasing', 'Reference NZ buying process (offer, LIM report, building inspection, settlement)', 'Mention NZ-relevant considerations (Bright-line test, LIM report, Healthy Homes)'],
  'Guide NZ buyers through the process: pre-approval → search → offer (auction, tender, deadline sale, or negotiation) → due diligence (LIM report, building inspection) → unconditional → settlement. Reference Bright-line test for investment properties. Mention Healthy Homes standards for rentals. Use "real estate agent" not "Realtor". Explain auction and tender processes.',
  110
),
(
  'photo_captions',
  'global',
  'en-NZ',
  'New Zealand Photo Caption Rules',
  'NZ-specific rules for generating photo captions',
  ARRAY[]::TEXT[],
  ARRAY['Use New Zealand English spelling', 'Reference NZ architectural features (villa, bungalow, weatherboard)', 'Use NZ room names (lounge, rumpus, study nook)'],
  'Use NZ property terminology: lounge, rumpus room, ensuite (one word), study nook, built-in wardrobes, scullery, sleep-out. Reference NZ features: heat pump, log burner, double glazing, deck, outdoor entertaining, native plantings. Architectural styles: villa, bungalow, art deco, 1970s, modern contemporary.',
  110
),
(
  'social_media_posts',
  'global',
  'en-NZ',
  'New Zealand Social Media Rules',
  'NZ-specific rules for generating social media posts',
  ARRAY['DM for details', 'Link in bio'],
  ARRAY['Use New Zealand English spelling', 'Reference NZ property market language', 'Include NZ-relevant hashtags (#nzproperty #realestate #justlisted)'],
  'Use NZ property market language: "just listed", "price by negotiation", "auction", "tender", "deadline sale", "set date of sale". Include city-specific hashtags (#AucklandProperty, #WellingtonHomes, etc.). Currency in NZD ($). Reference sale method prominently. Use "real estate agent" terminology.',
  110
)
ON CONFLICT DO NOTHING;

-- Enable all remaining market feature flags
UPDATE public.feature_flags
SET is_active = true, default_state = true
WHERE key IN ('us_launch', 'ca_launch', 'au_launch', 'nz_launch');
