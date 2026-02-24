import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { publicCorsHeaders } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

const corsHeaders = {
  ...publicCorsHeaders,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Resend API configuration
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "AutoListing Reports <reports@autolisting.io>";

// Send email via Resend
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Resend API error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

// Ready-to-Sell Section Max Points (V1 - LOCKED per spec)
const SECTION_MAX_POINTS = {
  legal_compliance: 30,      // Section A
  condition_readiness: 25,   // Section B
  timeline_motivation: 20,   // Section C
  pricing_awareness: 15,     // Section D
  property_basics: 10,       // Section E
};

// Band thresholds (V1 - LOCKED per spec)
const BANDS = {
  READY: { min: 85, label: "Ready" },
  NEARLY_READY: { min: 65, label: "Nearly Ready" },
  EARLY_STAGE: { min: 40, label: "Early Stage" },
  NOT_READY: { min: 0, label: "Not Ready" },
};

// Legal flags for band capping
type LegalFlag = "LEGAL_UNKNOWN" | "LEGAL_RISK" | "PLANNING_UNKNOWN" | "PLANNING_RISK";

// Worth Estimate: sqm inference table (conservative medians)
const SQM_INFERENCE: Record<string, Record<number, number>> = {
  apartment: { 1: 55, 2: 70, 3: 85, 4: 100, 5: 115, 6: 130 },
  terrace: { 1: 65, 2: 85, 3: 100, 4: 120, 5: 140, 6: 160 },
  semi: { 1: 75, 2: 95, 3: 115, 4: 135, 5: 155, 6: 175 },
  detached: { 1: 85, 2: 110, 3: 135, 4: 165, 5: 195, 6: 225 },
  bungalow: { 1: 80, 2: 105, 3: 130, 4: 160, 5: 185, 6: 210 },
};

interface OrgConfig {
  id: string;
  slug: string;
  business_name: string;
  logo_url: string | null;
  contact_email: string | null;
}

interface LeadMagnetConfig {
  id: string;
  organization_id: string;
  type: string;
  is_enabled: boolean;
  brand_config: Record<string, unknown>;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Rate limit: 50 per hour per IP (public endpoint)
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                   req.headers.get('x-real-ip') ||
                   'unknown';
  const rateCheck = await checkRateLimit(supabase, clientIp, {
    feature: 'lead-magnet-api',
    maxRequests: 50,
    windowMinutes: 60,
  });
  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.', resetTime: rateCheck.resetTime }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  
  // Expected paths:
  // GET /lead-magnet-api/org/:slug - Get org config
  // GET /lead-magnet-api/config/:orgSlug/:type - Get lead magnet config
  // POST /lead-magnet-api/submit - Submit quiz answers (pre-unlock)
  // POST /lead-magnet-api/unlock - Submit contact info and get full results

  try {
    // Route: GET /org/:slug
    if (req.method === "GET" && pathParts[1] === "org" && pathParts[2]) {
      return await handleGetOrg(supabase, pathParts[2]);
    }

    // Route: GET /config/:orgSlug/:type
    if (req.method === "GET" && pathParts[1] === "config" && pathParts[2] && pathParts[3]) {
      return await handleGetConfig(supabase, pathParts[2], pathParts[3]);
    }

    // Route: POST /submit
    if (req.method === "POST" && pathParts[1] === "submit") {
      const body = await req.json();
      return await handleSubmit(supabase, body);
    }

    // Route: POST /unlock
    if (req.method === "POST" && pathParts[1] === "unlock") {
      const body = await req.json();
      return await handleUnlock(supabase, body);
    }

    // Route: POST /contact-agent
    if (req.method === "POST" && pathParts[1] === "contact-agent") {
      const body = await req.json();
      return await handleContactAgent(supabase, body);
    }

    // Route: POST with action=get_config (for public site lead magnet buttons)
    if (req.method === "POST") {
      const body = await req.json();
      if (body.action === "get_config" && body.orgSlug) {
        return await handleGetAllConfigs(supabase, body.orgSlug);
      }
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Lead magnet API error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Get organization by slug
async function handleGetOrg(supabase: any, slug: string): Promise<Response> {
  const { data: org, error } = await supabase
    .from("organizations")
    .select("id, slug, business_name, logo_url, contact_email")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !org) {
    return new Response(
      JSON.stringify({ error: "Organization not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ org }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Get lead magnet config
async function handleGetConfig(supabase: any, orgSlug: string, type: string): Promise<Response> {
  const normalizedType = type.toUpperCase().replace(/-/g, "_");
  
  // Get org first
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, slug, business_name, logo_url, contact_email")
    .eq("slug", orgSlug)
    .eq("is_active", true)
    .single();

  if (orgError || !org) {
    return new Response(
      JSON.stringify({ error: "Organization not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get lead magnet config
  const { data: config, error: configError } = await supabase
    .from("lead_magnets")
    .select("*")
    .eq("organization_id", org.id)
    .eq("type", normalizedType)
    .eq("is_enabled", true)
    .single();

  if (configError || !config) {
    return new Response(
      JSON.stringify({ error: "Lead magnet not found or disabled" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ org, config }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Get all lead magnet configs for an organization (for public site hero buttons)
async function handleGetAllConfigs(supabase: any, orgSlug: string): Promise<Response> {
  // Get org first
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, slug, business_name")
    .eq("slug", orgSlug)
    .eq("is_active", true)
    .single();

  if (orgError || !org) {
    return new Response(
      JSON.stringify({ success: false, error: "Organization not found", configs: [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get all lead magnet configs for this org
  const { data: configs, error: configError } = await supabase
    .from("lead_magnets")
    .select("id, type, is_enabled, brand_config")
    .eq("organization_id", org.id);

  if (configError) {
    console.error("Error fetching lead magnet configs:", configError);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to fetch configs", configs: [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, configs: configs || [] }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Submit quiz answers (pre-unlock) - returns basic result
async function handleSubmit(supabase: any, body: any): Promise<Response> {
  const {
    organization_id,
    lead_magnet_id,
    type,
    answers,
    utm_source,
    utm_campaign,
    campaign_id,
    post_id,
    version,
  } = body;

  if (!organization_id || !type || !answers) {
    return new Response(
      JSON.stringify({ error: "Missing required fields" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let result: any = {};

  if (type === "READY_TO_SELL") {
    result = calculateReadinessScore(answers);
  } else if (type === "WORTH_ESTIMATE") {
    result = await calculateWorthEstimate(supabase, answers);
  }

  // Create submission record (without contact info yet)
  const { data: submission, error: insertError } = await supabase
    .from("lead_submissions")
    .insert({
      organization_id,
      lead_magnet_id,
      utm_source,
      utm_campaign,
      campaign_id,
      post_id,
      version,
      answers_json: answers,
      ...result,
    })
    .select()
    .single();

  if (insertError) {
    console.error("Error creating submission:", insertError);
    return new Response(
      JSON.stringify({ error: "Failed to save submission" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Return basic result (gated version)
  const gatedResult = getGatedResult(type, result);

  return new Response(
    JSON.stringify({
      submission_id: submission.id,
      result: gatedResult,
      is_gated: true,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Unlock full results with contact info
async function handleUnlock(supabase: any, body: any): Promise<Response> {
  const { submission_id, name, email, phone, consent } = body;

  if (!submission_id || !email || !consent) {
    return new Response(
      JSON.stringify({ error: "Email and consent are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get submission
  const { data: submission, error: fetchError } = await supabase
    .from("lead_submissions")
    .select("*, lead_magnets!inner(type), organizations!inner(id, slug, business_name, contact_email)")
    .eq("id", submission_id)
    .single();

  if (fetchError || !submission) {
    return new Response(
      JSON.stringify({ error: "Submission not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Update submission with contact info
  const { error: updateError } = await supabase
    .from("lead_submissions")
    .update({ name, email, phone, consent })
    .eq("id", submission_id);

  if (updateError) {
    console.error("Error updating submission:", updateError);
    return new Response(
      JSON.stringify({ error: "Failed to update submission" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Create/update CRM seller profile
  const sellerProfileId = await upsertSellerProfile(supabase, {
    organization_id: submission.organization_id,
    name,
    email,
    phone,
    source: "lead_magnet",
    submission,
  });

  // Link seller profile to submission
  if (sellerProfileId) {
    await supabase
      .from("lead_submissions")
      .update({ seller_profile_id: sellerProfileId })
      .eq("id", submission_id);
  }

  // Get full result
  const type = submission.lead_magnets?.type;
  const fullResult = getFullResult(type, submission);

  // Send email notification to agent/org
  const orgEmail = submission.organizations?.contact_email;
  const orgName = submission.organizations?.business_name || "Your Organisation";
  
  if (orgEmail) {
    const quizType = type === "READY_TO_SELL" ? "Ready to Sell" : "Worth Estimate";
    const emailSubject = `New Lead: ${name || email} - ${quizType} Quiz`;
    
    const emailHtml = buildLeadNotificationEmail({
      leadName: name || "Not provided",
      leadEmail: email,
      leadPhone: phone || "Not provided",
      quizType,
      orgName,
      answers: submission.answers_json,
      result: fullResult,
      submittedAt: new Date().toISOString(),
    });
    
    const emailSent = await sendEmail(orgEmail, emailSubject, emailHtml);
    
    // Update submission with email status
    if (emailSent) {
      await supabase
        .from("lead_submissions")
        .update({ email_sent: true, email_sent_at: new Date().toISOString() })
        .eq("id", submission_id);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      result: fullResult,
      is_gated: false,
      org: {
        name: orgName,
        email: orgEmail,
      },
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ============================================
// Ready-to-Sell Scoring Engine (Deterministic - V1 LOCKED)
// ============================================
function calculateReadinessScore(answers: any): any {
  const gaps: string[] = [];
  const todos: Array<{ priority: string; section: string; task: string }> = [];
  const legalFlags: LegalFlag[] = [];

  // Section A: Legal & Compliance (30 pts max)
  const legalScore = scoreSectionA(answers, gaps, todos, legalFlags);

  // Section B: Condition & Sale Readiness (25 pts max)
  const conditionScore = scoreSectionB(answers, todos);

  // Section C: Timeline & Motivation (20 pts max)
  const timelineScore = scoreSectionC(answers);

  // Section D: Pricing & Market Awareness (15 pts max)
  const pricingScore = scoreSectionD(answers, todos);

  // Section E: Property Basics Completeness (10 pts max)
  const basicsScore = scoreSectionE(answers);

  // Calculate total score (0-100)
  const totalScore = legalScore + conditionScore + timelineScore + pricingScore + basicsScore;

  // Determine band from score
  let band = determineBand(totalScore);

  // Apply legal caps AFTER scoring (per spec)
  // If LEGAL_RISK OR PLANNING_RISK → cap at "Nearly Ready"
  const hasLegalRisk = legalFlags.includes("LEGAL_RISK") || legalFlags.includes("PLANNING_RISK");
  if (hasLegalRisk && (band === "Ready")) {
    band = "Nearly Ready";
    gaps.push("Legal or planning issues require resolution");
  }

  // If 2+ legal flags → cap at "Early Stage"
  if (legalFlags.length >= 2) {
    if (band === "Ready" || band === "Nearly Ready") {
      band = "Early Stage";
      gaps.push("Multiple legal items need attention");
    }
  }

  // Sort todos by priority (High before Medium before Optional)
  const priorityOrder = { "High": 1, "Medium": 2, "Optional": 3 };
  todos.sort((a, b) => (priorityOrder[a.priority as keyof typeof priorityOrder] || 4) - (priorityOrder[b.priority as keyof typeof priorityOrder] || 4));

  return {
    score: Math.round(totalScore),
    band,
    headline_gaps: gaps.slice(0, 3),
    todo_json: todos,
    rules_version: "v1",
  };
}

// Section A: Legal & Compliance (30 pts max)
function scoreSectionA(answers: any, gaps: string[], todos: any[], flags: LegalFlag[]): number {
  let score = 0;

  // Title deeds available? (12 pts max)
  if (answers.title_deeds === "yes" || answers.title_deeds === "in_hand") {
    score += 12;
  } else if (answers.title_deeds === "not_sure" || answers.title_deeds === "unknown") {
    score += 4;
    flags.push("LEGAL_UNKNOWN");
    todos.push({ priority: "High", section: "Legal", task: "Confirm title with solicitor" });
  } else if (answers.title_deeds === "no") {
    score += 0;
    flags.push("LEGAL_RISK");
    gaps.push("Title deeds not available");
    todos.push({ priority: "High", section: "Legal", task: "Locate title deeds" });
  }

  // Planning compliance (10 pts max)
  if (answers.planning_compliance === "all_compliant" || answers.planning_compliance === "fully_compliant") {
    score += 10;
  } else if (answers.planning_compliance === "unsure" || answers.planning_compliance === "unknown") {
    score += 3;
    flags.push("PLANNING_UNKNOWN");
    todos.push({ priority: "High", section: "Legal", task: "Verify planning compliance" });
  } else if (answers.planning_compliance === "non_compliant" || answers.planning_compliance === "minor_issues") {
    score += 0;
    flags.push("PLANNING_RISK");
    gaps.push("Planning compliance issues");
    todos.push({ priority: "High", section: "Legal", task: "Resolve planning issues" });
  }

  // Solicitor engaged? (8 pts max)
  if (answers.solicitor_appointed === "yes") {
    score += 8;
  } else {
    score += 2;
    todos.push({ priority: "Medium", section: "Legal", task: "Engage solicitor" });
  }

  return score;
}

// Section B: Condition & Sale Readiness (25 pts max)
function scoreSectionB(answers: any, todos: any[]): number {
  let score = 0;

  // Overall condition (12 pts max)
  if (answers.property_condition === "excellent") {
    score += 12;
  } else if (answers.property_condition === "good") {
    score += 9;
  } else if (answers.property_condition === "fair") {
    score += 5;
    todos.push({ priority: "Medium", section: "Condition", task: "Address cosmetic issues" });
  } else if (answers.property_condition === "needs_work") {
    score += 0;
    todos.push({ priority: "High", section: "Condition", task: "Repair major issues" });
  }

  // Known major issues? (8 pts max)
  if (answers.known_issues === "none") {
    score += 8;
  } else if (answers.known_issues === "minor") {
    score += 4;
    todos.push({ priority: "Medium", section: "Condition", task: "Fix minor issues" });
  } else if (answers.known_issues === "major") {
    score += 0;
    todos.push({ priority: "High", section: "Condition", task: "Resolve structural issues" });
  } else {
    // Default if not answered - assume none
    score += 8;
  }

  // Ready for marketing? (5 pts max)
  if (answers.is_presentable === "yes" || answers.marketing_ready === "yes") {
    score += 5;
  } else if (answers.is_presentable === "not_sure" || answers.marketing_ready === "not_sure") {
    score += 2;
    todos.push({ priority: "Optional", section: "Preparation", task: "Discuss marketing process" });
  } else {
    score += 0;
    todos.push({ priority: "Medium", section: "Preparation", task: "Prepare for sale process" });
  }

  return score;
}

// Section C: Timeline & Motivation (20 pts max)
function scoreSectionC(answers: any): number {
  let score = 0;

  // Selling timeframe (10 pts max)
  if (answers.timeline === "asap" || answers.timeline === "0_3_months" || answers.timeline === "1_3_months") {
    score += 10;
  } else if (answers.timeline === "3_6_months") {
    score += 8;
  } else if (answers.timeline === "6_12_months") {
    score += 4;
  } else if (answers.timeline === "just_exploring") {
    score += 1;
  }

  // Reason for selling stated? (10 pts max)
  if (answers.motivation && answers.motivation !== "just_curious" && answers.motivation !== "") {
    score += 10; // Clear reason
  } else if (answers.motivation === "just_curious") {
    score += 0; // Not sure
  } else {
    score += 5; // Somewhat unclear (no answer given)
  }

  return score;
}

// Section D: Pricing & Market Awareness (15 pts max)
function scoreSectionD(answers: any, todos: any[]): number {
  let score = 0;

  // Know rough value? (8 pts max)
  if (answers.has_price_expectation === "yes") {
    score += 8;
  } else if (answers.has_price_expectation === "rough_idea" || answers.has_price_expectation === "some_idea") {
    score += 4;
    todos.push({ priority: "Medium", section: "Pricing", task: "Review local prices" });
  } else {
    score += 0;
    todos.push({ priority: "High", section: "Pricing", task: "Establish pricing" });
  }

  // Researched local sales? (7 pts max)
  if (answers.researched_local === "yes") {
    score += 7;
  } else {
    score += 0;
    todos.push({ priority: "Medium", section: "Pricing", task: "Review comparables" });
  }

  return score;
}

// Section E: Property Basics Completeness (10 pts max)
function scoreSectionE(answers: any): number {
  let score = 0;

  // 2 pts each for 5 fields
  if (answers.property_type) score += 2;
  if (answers.bedrooms) score += 2;
  if (answers.location || answers.town || answers.county) score += 2;
  if (answers.occupancy) score += 2;
  if (answers.ber_rating !== undefined) score += 2; // Known or marked unknown

  return score;
}

function determineBand(score: number): string {
  if (score >= BANDS.READY.min) return BANDS.READY.label;
  if (score >= BANDS.NEARLY_READY.min) return BANDS.NEARLY_READY.label;
  if (score >= BANDS.EARLY_STAGE.min) return BANDS.EARLY_STAGE.label;
  return BANDS.NOT_READY.label;
}

// ============================================
// Worth Estimate Calculation (V1 - Conservative Envelope per Spec)
// ============================================
async function calculateWorthEstimate(supabase: any, answers: any): Promise<any> {
  const areaKey = `${answers.town || answers.area || ""}_${answers.county || ""}`.toLowerCase().replace(/\s+/g, "_");
  const propertyType = normalizePropertyType(answers.property_type);

  // STEP 8: Refusal Rule - if no usable location data
  if (!areaKey || areaKey === "_" || (!answers.town && !answers.area && !answers.county)) {
    return {
      refused: true,
      refusal_message: "We can't estimate reliably for this area yet. A local appraisal is recommended.",
      estimate_low: null,
      estimate_high: null,
      confidence: null,
      drivers_json: [],
      valuation_model_version: "v1",
    };
  }

  // STEP 1: Get market research (cached, AI-generated, or default)
  let research = await getCachedResearch(supabase, areaKey, propertyType);
  let researchWeak = false;
  let researchSource = "cached";

  if (!research) {
    // No cache - try AI research
    console.log(`No cached research for ${areaKey}/${propertyType}, attempting AI research...`);
    research = await performAIMarketResearch(supabase, areaKey, propertyType, answers);
    
    if (research) {
      researchSource = "ai";
      console.log(`AI research completed for ${areaKey}/${propertyType}`);
    } else {
      // Fallback to defaults
      research = getDefaultMarketResearch(propertyType);
      researchWeak = true; // No cached/AI research = weak confidence
      researchSource = "default";
      console.log(`Using default research for ${areaKey}/${propertyType}`);
    }
  }

  // STEP 2: Floor area determination
  let sqmUsed = answers.floor_area_sqm ? parseFloat(answers.floor_area_sqm) : null;
  let sqmInferred = false;

  if (!sqmUsed || sqmUsed <= 0) {
    const bedrooms = parseInt(answers.bedrooms) || 3;
    const typeKey = propertyType;
    const inferTable = SQM_INFERENCE[typeKey] || SQM_INFERENCE.semi;
    sqmUsed = inferTable[Math.min(bedrooms, 6)] || inferTable[3] || 115;
    sqmInferred = true;
  }

  // STEP 3: Base envelope
  const pricePerSqmLow = research.price_per_sqm_low || research.avg_price_sqm * 0.85;
  const pricePerSqmHigh = research.price_per_sqm_high || research.avg_price_sqm * 1.15;

  let baseLow = pricePerSqmLow * sqmUsed;
  let baseHigh = pricePerSqmHigh * sqmUsed;

  const drivers: Array<{ factor: string; impact: string; direction: string }> = [];

  // Add research source indicator
  if (researchSource === "ai") {
    drivers.push({ factor: "AI market research", impact: "Local comparables analysed", direction: "positive" });
  } else if (researchSource === "cached") {
    drivers.push({ factor: "Cached market data", impact: "Recent research used", direction: "positive" });
  }

  if (sqmInferred) {
    drivers.push({ factor: "Floor area estimated from bedrooms", impact: "Widens estimate", direction: "neutral" });
  }

  // STEP 4: Condition adjustment (multiplier on both low & high)
  const conditionMultipliers: Record<string, number> = {
    excellent: 1.05,
    good: 1.02,
    fair: 0.95,
    needs_work: 0.85,
  };
  const conditionMult = conditionMultipliers[answers.property_condition] || 1.0;
  baseLow *= conditionMult;
  baseHigh *= conditionMult;

  if (conditionMult !== 1.0) {
    const pct = Math.round((conditionMult - 1) * 100);
    drivers.push({
      factor: `Condition: ${answers.property_condition}`,
      impact: `${pct >= 0 ? '+' : ''}${pct}%`,
      direction: pct >= 0 ? "positive" : "negative",
    });
  }

  // STEP 5: Feature adjustments (capped at ±8% total)
  let featureAdjustment = 0;
  let berUnknown = false;

  // BER adjustment
  if (answers.ber_rating && answers.ber_rating !== "unknown") {
    const berChar = answers.ber_rating.charAt(0).toUpperCase();
    const berAdjustments: Record<string, number> = {
      A: 0.03, B: 0.03, C: 0.01, D: -0.04, E: -0.04, F: -0.04,
    };
    const berAdj = berAdjustments[berChar] || 0;
    featureAdjustment += berAdj;
    if (berAdj !== 0) {
      drivers.push({
        factor: `BER ${answers.ber_rating}`,
        impact: `${berAdj >= 0 ? '+' : ''}${Math.round(berAdj * 100)}%`,
        direction: berAdj >= 0 ? "positive" : "negative",
      });
    }
  } else {
    berUnknown = true;
    drivers.push({ factor: "BER unknown", impact: "0%", direction: "neutral" });
  }

  // Parking adjustment
  const parkingAdjustments: Record<string, number> = {
    garage: 0.03,
    driveway: 0.01,
    on_street: 0,
    none: -0.02,
  };
  const parkingAdj = parkingAdjustments[answers.parking] || 0;
  featureAdjustment += parkingAdj;
  if (parkingAdj !== 0) {
    drivers.push({
      factor: `Parking: ${answers.parking}`,
      impact: `${parkingAdj >= 0 ? '+' : ''}${Math.round(parkingAdj * 100)}%`,
      direction: parkingAdj >= 0 ? "positive" : "negative",
    });
  }

  // Outdoor space adjustment
  const outdoorAdjustments: Record<string, number> = {
    large: 0.03,
    average: 0.01,
    small: 0,
    none: -0.02,
  };
  const outdoorAdj = outdoorAdjustments[answers.outdoor_space] || 0;
  featureAdjustment += outdoorAdj;
  if (outdoorAdj !== 0) {
    drivers.push({
      factor: `Outdoor space: ${answers.outdoor_space}`,
      impact: `${outdoorAdj >= 0 ? '+' : ''}${Math.round(outdoorAdj * 100)}%`,
      direction: outdoorAdj >= 0 ? "positive" : "negative",
    });
  }

  // Bathrooms adjustment - more bathrooms add value
  const bathroomCount = parseInt(answers.bathrooms) || 0;
  if (bathroomCount > 0) {
    const bathroomAdjustments: Record<number, number> = {
      1: 0,       // baseline
      2: 0.02,    // +2% for 2 bathrooms
      3: 0.03,    // +3% for 3 bathrooms
      4: 0.04,    // +4% for 4+ bathrooms
    };
    const bathroomAdj = bathroomAdjustments[Math.min(bathroomCount, 4)] || 0;
    featureAdjustment += bathroomAdj;
    if (bathroomAdj !== 0) {
      drivers.push({
        factor: `${bathroomCount} bathroom${bathroomCount > 1 ? 's' : ''}`,
        impact: `+${Math.round(bathroomAdj * 100)}%`,
        direction: "positive",
      });
    }
  }

  // Land size adjustment (acres) - larger plots add value, especially for rural
  const landSizeAcres = parseFloat(answers.land_size_acres) || 0;
  if (landSizeAcres > 0) {
    let landAdj = 0;
    if (landSizeAcres >= 5) {
      landAdj = 0.08; // 5+ acres: +8%
    } else if (landSizeAcres >= 2) {
      landAdj = 0.05; // 2-5 acres: +5%
    } else if (landSizeAcres >= 1) {
      landAdj = 0.03; // 1-2 acres: +3%
    } else if (landSizeAcres >= 0.5) {
      landAdj = 0.02; // 0.5-1 acre: +2%
    }
    featureAdjustment += landAdj;
    if (landAdj !== 0) {
      drivers.push({
        factor: `Land: ${landSizeAcres} acre${landSizeAcres !== 1 ? 's' : ''}`,
        impact: `+${Math.round(landAdj * 100)}%`,
        direction: "positive",
      });
    }
  }

  // Property age adjustment - newer properties and well-maintained period homes
  const propertyAge = answers.property_age;
  if (propertyAge) {
    const ageAdjustments: Record<string, number> = {
      new_build: 0.05,    // New builds command premium
      modern: 0.03,       // Modern (5-20 years) still good
      established: 0,     // Baseline (20-50 years)
      period: 0.02,       // Period properties can be desirable
      historic: 0.01,     // Historic - depends on condition
    };
    const ageAdj = ageAdjustments[propertyAge] || 0;
    featureAdjustment += ageAdj;
    if (ageAdj !== 0) {
      const ageLabels: Record<string, string> = {
        new_build: "New Build",
        modern: "Modern (5-20 yrs)",
        established: "Established",
        period: "Period property",
        historic: "Historic (100+ yrs)",
      };
      drivers.push({
        factor: ageLabels[propertyAge] || propertyAge,
        impact: `${ageAdj >= 0 ? '+' : ''}${Math.round(ageAdj * 100)}%`,
        direction: ageAdj >= 0 ? "positive" : "negative",
      });
    }
  }

  // Renovation adjustment - recent renovations add value
  const recentRenovations = answers.recent_renovations;
  if (recentRenovations && recentRenovations !== "none") {
    const renovationAdjustments: Record<string, number> = {
      major: 0.06,      // Major renovation (kitchen, bathroom, extension)
      moderate: 0.04,   // Moderate updates (windows, heating, roof)
      minor: 0.02,      // Minor updates (decorative, flooring)
    };
    const renovationAdj = renovationAdjustments[recentRenovations] || 0;
    featureAdjustment += renovationAdj;
    if (renovationAdj !== 0) {
      const renovationLabels: Record<string, string> = {
        major: "Major renovation",
        moderate: "Moderate updates",
        minor: "Minor updates",
      };
      drivers.push({
        factor: renovationLabels[recentRenovations] || "Recent renovations",
        impact: `+${Math.round(renovationAdj * 100)}%`,
        direction: "positive",
      });
    }
  }

  // Eircode - note if provided (for future precise lookup)
  if (answers.eircode && answers.eircode.trim()) {
    drivers.push({
      factor: "Eircode provided",
      impact: "Improves accuracy",
      direction: "positive",
    });
  }

  // Cap feature adjustments at ±15% (increased to accommodate age and renovation fields)
  featureAdjustment = Math.max(-0.15, Math.min(0.15, featureAdjustment));

  // Apply feature adjustment to both bounds
  baseLow *= (1 + featureAdjustment);
  baseHigh *= (1 + featureAdjustment);

  // STEP 6: Calculate confidence tier
  // Start at High (0 downgrades), then downgrade
  let downgrades = 0;
  if (sqmInferred) downgrades++;
  if (berUnknown) downgrades++;
  if (research.volatility === "high") downgrades++;
  if (researchWeak || research.research_confidence === "weak") downgrades++;

  let confidence: "High" | "Medium" | "Low";
  if (downgrades === 0) confidence = "High";
  else if (downgrades <= 2) confidence = "Medium";
  else confidence = "Low";

  // STEP 7: Apply range width based on confidence
  const rangeWidths: Record<string, number> = {
    High: 0.05,
    Medium: 0.09,
    Low: 0.15,
  };
  const width = rangeWidths[confidence];

  // Calculate adjusted midpoint and apply width
  const adjustedMid = (baseLow + baseHigh) / 2;
  const finalLow = adjustedMid * (1 - width);
  const finalHigh = adjustedMid * (1 + width);

  // Round to nearest 5000
  const estimate_low = Math.round(finalLow / 5000) * 5000;
  const estimate_high = Math.round(finalHigh / 5000) * 5000;

  return {
    refused: false,
    estimate_low,
    estimate_high,
    confidence,
    drivers_json: drivers,
    market_trend: research.trend || "Stable",
    market_insights: research.market_insights || null,
    comparable_sales: research.comparable_sales || null,
    research_source: researchSource,
    research_snapshot_id: research.id || null,
    valuation_model_version: "v1",
  };
}

function normalizePropertyType(type: string | undefined): string {
  if (!type) return "semi";
  const t = type.toLowerCase().replace(/[^a-z]/g, "");
  if (t.includes("apartment") || t.includes("flat")) return "apartment";
  if (t.includes("terrace") || t.includes("townhouse")) return "terrace";
  if (t.includes("semi") || t.includes("semidetached")) return "semi";
  if (t.includes("detached")) return "detached";
  if (t.includes("bungalow")) return "bungalow";
  return "semi";
}

async function getCachedResearch(supabase: any, areaKey: string, propertyType: string): Promise<any> {
  const { data } = await supabase
    .from("market_research_cache")
    .select("*")
    .eq("area_key", areaKey)
    .eq("property_type", propertyType)
    .gt("expires_at", new Date().toISOString())
    .single();

  return data?.research_json || null;
}

function getDefaultMarketResearch(propertyType: string): any {
  // Conservative default ranges for Ireland (per spec structure)
  const defaults: Record<string, any> = {
    detached: { price_per_sqm_low: 2600, price_per_sqm_high: 3400, volatility: "medium", trend: "stable", research_confidence: "moderate" },
    semi: { price_per_sqm_low: 2800, price_per_sqm_high: 3600, volatility: "medium", trend: "stable", research_confidence: "moderate" },
    terrace: { price_per_sqm_low: 3000, price_per_sqm_high: 3800, volatility: "low", trend: "stable", research_confidence: "moderate" },
    apartment: { price_per_sqm_low: 3500, price_per_sqm_high: 4500, volatility: "medium", trend: "stable", research_confidence: "moderate" },
    bungalow: { price_per_sqm_low: 2700, price_per_sqm_high: 3500, volatility: "low", trend: "stable", research_confidence: "moderate" },
  };

  return defaults[propertyType] || defaults.semi;
}

// ============================================
// AI Market Research (Google Gemini)
// ============================================
async function performAIMarketResearch(
  supabase: any,
  areaKey: string,
  propertyType: string,
  answers: any
): Promise<any> {
  const googleApiKey = Deno.env.get("GOOGLE_AI_API_KEY");
  
  if (!googleApiKey) {
    console.log("No Google AI API key configured, using default research");
    return null;
  }

  const townland = answers.town || answers.area || "unknown area";
  const county = answers.county || "unknown county";
  const propertyTypeLabel = {
    detached: "detached house",
    semi: "semi-detached house", 
    terrace: "terraced house",
    apartment: "apartment",
    bungalow: "bungalow"
  }[propertyType] || "residential property";

  const bedrooms = answers.bedrooms || "3";
  const propertyAge = answers.property_age || "unknown";
  const landSize = answers.land_size_acres ? `${answers.land_size_acres} acres` : "standard plot";

  const prompt = `You are a property valuation expert in Ireland. Research and provide current market data for properties in ${townland}, County ${county}.

Property Details:
- Type: ${propertyTypeLabel}
- Bedrooms: ${bedrooms}
- Approximate age: ${propertyAge}
- Land size: ${landSize}

Please provide a JSON response with comparable sales analysis. Research recent sales (last 6-12 months) in this area and nearby comparable areas.

Consider:
1. Recent comparable sales prices in the area
2. Price per square metre for similar properties
3. Impact of property age on value
4. Impact of land size on value
5. Distance from nearest town centre
6. Current market trends

Respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "price_per_sqm_low": <number - conservative low estimate in euros>,
  "price_per_sqm_high": <number - conservative high estimate in euros>,
  "avg_price_sqm": <number - average price per sqm in euros>,
  "comparable_sales": [
    {
      "description": "<brief description of comparable property>",
      "sale_price": <number in euros>,
      "approx_sqm": <number>,
      "price_per_sqm": <number>,
      "distance_km": <number - approximate distance from subject property>
    }
  ],
  "market_insights": "<1-2 sentence summary of local market conditions>",
  "volatility": "<low|medium|high>",
  "trend": "<rising|stable|falling>",
  "research_confidence": "<strong|moderate|weak>",
  "area_premium_notes": "<any notes about location premiums or discounts>"
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2000,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error("Gemini API error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      console.error("No text content in Gemini response");
      return null;
    }

    // Parse JSON from response (handle potential markdown code blocks)
    let jsonStr = textContent.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.slice(7);
    }
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith("```")) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const research = JSON.parse(jsonStr);

    // Validate required fields
    if (!research.price_per_sqm_low || !research.price_per_sqm_high) {
      console.error("Invalid research response - missing price fields");
      return null;
    }

    // Store in cache with 6-month expiry
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 6);

    await supabase.from("market_research_cache").upsert({
      area_key: areaKey,
      property_type: propertyType,
      research_json: research,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
    }, {
      onConflict: "area_key,property_type",
    });

    console.log(`AI research cached for ${areaKey}/${propertyType}, expires: ${expiresAt.toISOString()}`);

    return research;
  } catch (error) {
    console.error("AI market research failed:", error);
    return null;
  }
}

// ============================================
// Gating Logic
// ============================================
function getGatedResult(type: string, result: any): any {
  if (type === "READY_TO_SELL") {
    return {
      band: result.band,
      score_range: getScoreRange(result.score),
      headline_gaps: result.headline_gaps?.slice(0, 1) || [],
      message: "Get your full readiness report to see your personalised action plan.",
    };
  } else {
    // Worth estimate - show wide range only
    const range = result.estimate_high - result.estimate_low;
    const widerLow = result.estimate_low - range * 0.2;
    const widerHigh = result.estimate_high + range * 0.2;

    return {
      estimate_range: `€${formatNumber(widerLow)} - €${formatNumber(widerHigh)}`,
      confidence: "Preliminary",
      message: "Get your full valuation report for a refined estimate and market insights.",
    };
  }
}

function getFullResult(type: string, submission: any): any {
  if (type === "READY_TO_SELL") {
    return {
      score: submission.score,
      band: submission.band,
      headline_gaps: submission.headline_gaps,
      todo_list: submission.todo_json,
      next_steps: getNextSteps(submission.band),
    };
  } else {
    return {
      estimate_low: submission.estimate_low,
      estimate_high: submission.estimate_high,
      estimate_display: `€${formatNumber(submission.estimate_low)} - €${formatNumber(submission.estimate_high)}`,
      confidence: submission.confidence,
      drivers: submission.drivers_json,
      market_trend: submission.market_trend,
      market_insights: submission.market_insights,
      comparable_sales: submission.comparable_sales,
      research_source: submission.research_source,
      next_steps: getValuationNextSteps(submission.confidence),
    };
  }
}

function getScoreRange(score: number): string {
  if (score >= 85) return "85-100";
  if (score >= 65) return "65-84";
  if (score >= 40) return "40-64";
  return "0-39";
}

function getNextSteps(band: string): string[] {
  const steps: Record<string, string[]> = {
    "Ready": [
      "Contact the agent to discuss listing strategy",
      "Prepare marketing materials",
      "Schedule professional photography",
    ],
    "Nearly Ready": [
      "Address the highlighted gaps first",
      "Consult with a solicitor if legal items are pending",
      "Contact the agent for a pre-listing consultation",
    ],
    "Early Stage": [
      "Work through your personalised to-do list",
      "Gather required documents",
      "Consider a property assessment",
    ],
    "Not Ready": [
      "Focus on legal and compliance items first",
      "Take time to prepare properly",
      "The agent can guide you when you're ready",
    ],
  };
  return steps[band] || steps["Early Stage"];
}

function getValuationNextSteps(confidence: string): string[] {
  const steps: Record<string, string[]> = {
    High: [
      "This estimate is based on strong data - contact the agent to confirm",
      "Request a formal in-person appraisal",
      "Discuss pricing strategy with the agent",
    ],
    Medium: [
      "Some factors may affect the final value",
      "Request a professional appraisal for accuracy",
      "The agent can provide a more precise figure",
    ],
    Low: [
      "Limited data means this is a broad estimate",
      "A professional appraisal is strongly recommended",
      "Contact the agent for an accurate assessment",
    ],
  };
  return steps[confidence] || steps["Medium"];
}

function formatNumber(num: number): string {
  return Math.round(num).toLocaleString("en-IE");
}

// ============================================
// Email Templates
// ============================================

// HTML escape helper to prevent XSS in emails
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface LeadNotificationData {
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  quizType: string;
  orgName: string;
  answers: Record<string, unknown>;
  result: Record<string, unknown>;
  submittedAt: string;
}

function buildLeadNotificationEmail(data: LeadNotificationData): string {
  const { leadName, leadEmail, leadPhone, quizType, orgName, answers, result, submittedAt } = data;
  
  const formattedDate = new Date(submittedAt).toLocaleDateString("en-IE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Build result summary based on quiz type
  let resultSummary = "";
  if (quizType === "Ready to Sell") {
    resultSummary = `
      <p><strong>Score:</strong> ${result.score || "N/A"}</p>
      <p><strong>Band:</strong> ${result.band || "N/A"}</p>
      ${result.headline_gaps && Array.isArray(result.headline_gaps) ? `<p><strong>Key Gaps:</strong> ${result.headline_gaps.join(", ")}</p>` : ""}
    `;
  } else {
    resultSummary = `
      <p><strong>Estimate:</strong> ${result.estimate_display || "N/A"}</p>
      <p><strong>Confidence:</strong> ${result.confidence || "N/A"}</p>
      <p><strong>Market Trend:</strong> ${result.market_trend || "N/A"}</p>
    `;
  }

  // Build answers summary (escaped for HTML safety)
  const answersHtml = Object.entries(answers || {})
    .map(([key, value]) => `<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(value))}</li>`)
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Lead from ${quizType} Quiz</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">New Lead Alert</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">From ${quizType} Quiz</p>
      </div>
      
      <div style="background: #f9f9f9; padding: 20px; border: 1px solid #eee; border-top: none;">
        <h2 style="color: #333; margin-top: 0;">Lead Details</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Name:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${leadName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Email:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><a href="mailto:${leadEmail}">${leadEmail}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Phone:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${leadPhone}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Submitted:</strong></td>
            <td style="padding: 8px 0;">${formattedDate}</td>
          </tr>
        </table>

        <h2 style="color: #333; margin-top: 24px;">Quiz Results</h2>
        ${resultSummary}

        <h2 style="color: #333; margin-top: 24px;">Quiz Answers</h2>
        <ul style="background: white; padding: 15px 15px 15px 30px; border-radius: 4px; border: 1px solid #eee;">
          ${answersHtml}
        </ul>

        <div style="margin-top: 24px; padding: 15px; background: #e8f4fd; border-radius: 4px;">
          <p style="margin: 0; color: #1a73e8;">
            <strong>Next Step:</strong> This lead has been automatically added to your CRM.
          </p>
        </div>
      </div>
      
      <div style="padding: 15px; text-align: center; color: #999; font-size: 12px;">
        <p style="margin: 0;">Sent via AutoListing.io</p>
      </div>
    </body>
    </html>
  `;
}

function buildContactRequestEmail(data: {
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  orgName: string;
  additionalInfo?: string;
}): string {
  const { leadName, leadEmail, leadPhone, orgName, additionalInfo } = data;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Contact Request</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Contact Request</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">A lead would like to speak with you</p>
      </div>
      
      <div style="background: #f9f9f9; padding: 20px; border: 1px solid #eee; border-top: none;">
        <h2 style="color: #333; margin-top: 0;">Lead Details</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Name:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${leadName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Email:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><a href="mailto:${leadEmail}">${leadEmail}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Phone:</strong></td>
            <td style="padding: 8px 0;">${leadPhone}</td>
          </tr>
        </table>

        ${additionalInfo ? `
          <h2 style="color: #333; margin-top: 24px;">Additional Information</h2>
          <div style="background: white; padding: 15px; border-radius: 4px; border: 1px solid #eee;">
            <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(additionalInfo)}</p>
          </div>
        ` : ""}

        <div style="margin-top: 24px; padding: 15px; background: #d4edda; border-radius: 4px;">
          <p style="margin: 0; color: #155724;">
            <strong>Action Required:</strong> Please contact this lead as soon as possible.
          </p>
        </div>
      </div>
      
      <div style="padding: 15px; text-align: center; color: #999; font-size: 12px;">
        <p style="margin: 0;">Sent via AutoListing.io</p>
      </div>
    </body>
    </html>
  `;
}

// ============================================
// Contact Agent Handler
// ============================================
async function handleContactAgent(supabase: any, body: any): Promise<Response> {
  const { submission_id, additional_info } = body;

  if (!submission_id) {
    return new Response(
      JSON.stringify({ error: "Submission ID is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get submission with org details
  const { data: submission, error: fetchError } = await supabase
    .from("lead_submissions")
    .select("*, organizations!inner(id, slug, business_name, contact_email)")
    .eq("id", submission_id)
    .single();

  if (fetchError || !submission) {
    return new Response(
      JSON.stringify({ error: "Submission not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const orgEmail = submission.organizations?.contact_email;
  const orgName = submission.organizations?.business_name || "Your Organisation";

  if (!orgEmail) {
    return new Response(
      JSON.stringify({ error: "Organisation contact email not configured" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const emailSubject = `Contact Request: ${submission.name || submission.email} would like to speak with you`;
  
  const emailHtml = buildContactRequestEmail({
    leadName: submission.name || "Not provided",
    leadEmail: submission.email,
    leadPhone: submission.phone || "Not provided",
    orgName,
    additionalInfo: additional_info,
  });

  const emailSent = await sendEmail(orgEmail, emailSubject, emailHtml);

  if (!emailSent) {
    return new Response(
      JSON.stringify({ error: "Failed to send contact request" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: "Contact request sent" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ============================================
// CRM Integration
// ============================================
async function upsertSellerProfile(supabase: any, data: any): Promise<string | null> {
  const { organization_id, name, email, phone, source, submission } = data;

  // Check for existing profile by email
  const { data: existing } = await supabase
    .schema("crm")
    .from("seller_profiles")
    .select("id")
    .eq("organization_id", organization_id)
    .eq("email", email)
    .single();

  if (existing) {
    // Update existing profile
    await supabase
      .schema("crm")
      .from("seller_profiles")
      .update({
        name: name || undefined,
        phone: phone || undefined,
        last_contact_at: new Date().toISOString(),
        notes: `Lead magnet submission: ${submission.lead_magnets?.type}`,
      })
      .eq("id", existing.id);

    return existing.id;
  }

  // Create new profile
  const { data: newProfile, error } = await supabase
    .schema("crm")
    .from("seller_profiles")
    .insert({
      organization_id,
      name: name || "Lead Magnet Submission",
      email,
      phone,
      source: "lead_magnet",
      stage: determineLeadStage(submission),
      notes: `From ${submission.lead_magnets?.type} quiz`,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating seller profile:", error);
    return null;
  }

  return newProfile?.id || null;
}

function determineLeadStage(submission: any): string {
  if (submission.band === "Ready to List") return "Hot";
  if (submission.band === "Nearly Ready") return "Warm";
  if (submission.confidence === "High") return "Warm";
  return "Nurture";
}
