import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-org-slug',
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
    sections.push(`BANNED PHRASES (Never use these in responses):\n- ${allBannedPhrases.join('\n- ')}`);
  }
  
  const allToneGuidelines = instructions.flatMap(i => i.tone_guidelines || []);
  if (allToneGuidelines.length > 0) {
    sections.push(`CONVERSATION GUIDELINES:\n- ${allToneGuidelines.join('\n- ')}`);
  }
  
  const freeformInstructions = instructions
    .filter(i => i.freeform_instructions)
    .map(i => i.freeform_instructions);
  if (freeformInstructions.length > 0) {
    sections.push(`ADDITIONAL INSTRUCTIONS:\n${freeformInstructions.join('\n\n')}`);
  }
  
  if (sections.length === 0) return '';
  return `\n\n## Custom Training Instructions\n${sections.join('\n\n')}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, conversationHistory = [], organizationSlug } = await req.json();
    
    // Also check header for org slug (for public widget)
    const orgSlugFromHeader = req.headers.get('x-org-slug');
    const orgSlug = organizationSlug || orgSlugFromHeader;

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Organization slug is REQUIRED to prevent cross-tenant data leakage
    if (!orgSlug) {
      return new Response(
        JSON.stringify({ error: "Organization identifier is required. Please provide organizationSlug in the request body or x-org-slug header." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const googleAiApiKey = Deno.env.get('GOOGLE_AI_API_KEY');

    if (!googleAiApiKey) {
      throw new Error('GOOGLE_AI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'public' }
    });

    // Look up organization by slug - this ensures tenant isolation
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('id, business_name, domain, contact_email, slug')
      .eq('slug', orgSlug)
      .eq('is_active', true)
      .single();

    if (orgError || !orgData) {
      return new Response(
        JSON.stringify({ error: "Organization not found" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organization = orgData;

    // Get AI config for this specific organization only
    const { data: configData, error: configError } = await supabase
      .from('ai_assistant_config')
      .select('*')
      .eq('organization_id', orgData.id)
      .eq('widget_enabled', true)
      .maybeSingle();

    if (configError || !configData) {
      return new Response(
        JSON.stringify({ error: "AI assistant not enabled for this organization" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = configData;

    console.log('Processing query for organization:', organization.business_name);

    // Fetch custom AI instructions for chatbot
    const customInstructions = await fetchAIInstructions(supabase, 'chatbot_assistant', organization.id);
    const customInstructionsSection = buildCustomInstructionsSection(customInstructions);
    if (customInstructions.length > 0) {
      console.log(`Loaded ${customInstructions.length} custom instruction set(s) for chatbot_assistant`);
    }

    // Get organization details for personalized responses
    const orgName = organization.business_name;

    // Build context from knowledge base
    const contextParts = [];

    contextParts.push(`You are an AI assistant for ${orgName}, a property sales and auction company.`);
    
    // Add personality
    const personalityPrompts: Record<string, string> = {
      professional: "Maintain a professional and business-focused tone.",
      friendly: "Be warm, approachable and helpful.",
      casual: "Use a relaxed and conversational style.",
      expert: "Demonstrate authority and deep market knowledge."
    };
    contextParts.push(personalityPrompts[config.personality as string] || personalityPrompts.professional);

    // Get ACTUAL LISTINGS from public.listings table filtered by organization
    const { data: listings } = await supabase
      .from('listings')
      .select('id, address, address_line_1, address_town, county, price, bedrooms, bathrooms, building_type, description, status, ber_rating, property_type')
      .eq('organization_id', organization.id)
      .in('status', ['New', 'Published'])
      .order('created_at', { ascending: false })
      .limit(20);

    if (listings && listings.length > 0) {
      contextParts.push(`\n## Current Property Listings (${listings.length} properties available):`);
      listings.forEach((listing, index) => {
        const address = listing.address || `${listing.address_line_1 || ''}, ${listing.address_town || ''}, ${listing.county || ''}`.trim();
        const price = listing.price ? `€${Number(listing.price).toLocaleString()}` : 'Price on application';
        const beds = listing.bedrooms ? `${listing.bedrooms} bed` : '';
        const baths = listing.bathrooms ? `${listing.bathrooms} bath` : '';
        const type = listing.building_type || listing.property_type || 'Property';
        const ber = listing.ber_rating ? `BER: ${listing.ber_rating}` : '';
        
        contextParts.push(`\n${index + 1}. **${address}**`);
        contextParts.push(`   - Type: ${type} | Price: ${price}`);
        if (beds || baths) contextParts.push(`   - ${[beds, baths].filter(Boolean).join(', ')}`);
        if (ber) contextParts.push(`   - ${ber}`);
        if (listing.description) {
          const shortDesc = listing.description.substring(0, 150);
          contextParts.push(`   - ${shortDesc}${listing.description.length > 150 ? '...' : ''}`);
        }
      });
    } else {
      contextParts.push(`\nNote: There are currently no active property listings to show. You can still help visitors with general enquiries.`);
    }

    // Get active knowledge documents (filtered by organization)
    const { data: documents } = await supabase
      .from('knowledge_documents')
      .select('title, content')
      .eq('organization_id', organization.id)
      .eq('status', 'active')
      .limit(5);

    if (documents && documents.length > 0) {
      contextParts.push("\n## Business Knowledge Base:");
      documents.forEach(doc => {
        contextParts.push(`\n### ${doc.title}:\n${doc.content.substring(0, 1000)}`);
      });
    }

    // Add capabilities context
    const capabilities = (config.enabled_capabilities as string[]) || [];
    if (capabilities.length > 0) {
      contextParts.push(`\nYou can help with: ${capabilities.join(', ')}.`);
    }

    // Build system prompt
    let systemPrompt = config.system_prompt || contextParts.join('\n');

    // Add CRM lead capture instructions
    systemPrompt += `\n\n## Lead Qualification Goals

Your primary objectives during conversations are to:

1. **Naturally Gather Contact Information:**
   - Ask for their name early in the conversation (e.g., "I'd love to help you! What's your name?")
   - Later, ask for email or phone number in context (e.g., "Would you like me to have one of our agents reach out with more details? What's the best email/phone to reach you?")
   - Make it feel conversational, not like a form

2. **Identify Buyer or Seller Intent:**
   - Determine if they're looking to BUY a property or SELL a property
   - Ask about their situation: "Are you currently looking to buy, or thinking about selling?"
   
3. **Qualify Their Needs:**
   - For BUYERS: budget range, number of bedrooms, preferred location, timeline
   - For SELLERS: property address, reason for selling, timeline, expected value
   - Ask: "What's your timeline for moving?" or "What's your budget range?"

4. **Recognize Agent Handoff Triggers:**
   - Watch for phrases like: "I want to speak with someone", "can an agent call me", "I'd like more information", "can someone contact me"
   - When detected, immediately offer to connect them with an agent and get their contact details
   - Respond with: "Absolutely! I'd be happy to have one of our experienced agents reach out. What's the best number/email to contact you?"

5. **Keep It Natural:**
   - Don't interrogate - weave questions naturally into the conversation
   - Build rapport first, then gather information
   - If they're hesitant, don't push - focus on being helpful

Remember: Every conversation is an opportunity to help someone AND to potentially add a qualified lead to our CRM system.`;

    // Add response length instruction
    const lengthInstructions: Record<string, string> = {
      concise: "Keep responses brief and to the point.",
      balanced: "Provide helpful responses with appropriate detail.",
      detailed: "Give comprehensive, detailed responses."
    };
    systemPrompt += `\n\n${lengthInstructions[config.response_length as string] || lengthInstructions.balanced}`;

    // Append custom AI instructions from training system
    if (customInstructionsSection) {
      systemPrompt += customInstructionsSection;
    }

    console.log('Calling Google Gemini AI with model:', config.model_name || 'gemini-2.5-flash');

    // Define function declarations for Google Gemini
    const functionDeclarations = [
      {
        name: "extract_lead_info",
        description: "Extract contact information and lead type from conversation",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Full name of the person" },
            email: { type: "string", description: "Email address" },
            phone: { type: "string", description: "Phone number" },
            lead_type: { type: "string", enum: ["buyer", "seller", "unknown"], description: "Whether they are looking to buy or sell" }
          },
          required: []
        }
      },
      {
        name: "qualify_lead",
        description: "Qualify lead requirements and preferences",
        parameters: {
          type: "object",
          properties: {
            budget_min: { type: "number", description: "Minimum budget in euros" },
            budget_max: { type: "number", description: "Maximum budget in euros" },
            bedrooms: { type: "array", items: { type: "number" }, description: "Number of bedrooms needed" },
            location: { type: "string", description: "Preferred location or area" },
            timeline: { type: "string", description: "When they want to move or sell" },
            property_address: { type: "string", description: "Address of property they want to sell" },
            notes: { type: "string", description: "Additional requirements or context" }
          },
          required: []
        }
      },
      {
        name: "request_agent_contact",
        description: "User has requested to be contacted by an agent",
        parameters: {
          type: "object",
          properties: {
            urgency: { type: "string", enum: ["low", "medium", "high"], description: "How urgent the request is" },
            reason: { type: "string", description: "Why they want agent contact" }
          },
          required: ["urgency"]
        }
      }
    ];

    // Build conversation history for Gemini format
    const geminiContents = [];
    
    for (const msg of conversationHistory) {
      if (msg.role !== 'system') {
        geminiContents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    }
    
    geminiContents.push({
      role: 'user',
      parts: [{ text: query }]
    });

    // Call Google Gemini API directly with function calling
    const rawModelName = config.model_name || 'gemini-2.5-flash';
    const modelName = rawModelName.replace(/^google\//, '');
    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${googleAiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: geminiContents,
        tools: [{
          functionDeclarations
        }],
        generationConfig: {
          maxOutputTokens: config.response_length === 'detailed' ? 1000 : config.response_length === 'concise' ? 300 : 600,
        }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Google Gemini API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI request failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('Gemini API response received');
    
    // Extract text response and function calls from Gemini response
    const candidate = aiData.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    
    let assistantMessage = "I apologize, but I couldn't generate a response.";
    const functionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
    
    for (const part of parts) {
      if (part.text) {
        assistantMessage = part.text;
      } else if (part.functionCall) {
        functionCalls.push(part.functionCall);
      }
    }

    console.log('AI response generated successfully');

    // Extract structured data from function calls
    let extractedLeadInfo: Record<string, unknown> | null = null;
    let qualifiedLeadData: Record<string, unknown> | null = null;
    let agentContactRequest: Record<string, unknown> | null = null;

    if (functionCalls.length > 0) {
      console.log('Function calls detected:', functionCalls.length);
      
      for (const functionCall of functionCalls) {
        const functionName = functionCall.name;
        const functionArgs = functionCall.args || {};
        
        console.log(`Processing function call: ${functionName}`, functionArgs);
        
        switch (functionName) {
          case 'extract_lead_info':
            extractedLeadInfo = functionArgs;
            break;
          case 'qualify_lead':
            qualifiedLeadData = functionArgs;
            break;
          case 'request_agent_contact':
            agentContactRequest = functionArgs;
            break;
        }
      }
    }

    // Auto-populate CRM if sufficient lead info collected
    let crmProfileId = null;
    let agentNotificationSent = false;
    const orgId = organization.id;
    
    if (extractedLeadInfo && extractedLeadInfo.name && (extractedLeadInfo.email || extractedLeadInfo.phone)) {
      console.log('Sufficient lead info collected, attempting CRM population');
      
      const leadType = extractedLeadInfo.lead_type;
      
      const conversationContext = conversationHistory.map((msg: { role: string; content: string }) => 
        `${msg.role}: ${msg.content}`
      ).join('\n') + `\nuser: ${query}\nassistant: ${assistantMessage}`;

      try {
        if (leadType === 'buyer') {
          const { data: buyerProfile, error: buyerError } = await supabase
            .from('buyer_profiles')
            .insert({
              organization_id: orgId,
              name: extractedLeadInfo.name,
              email: extractedLeadInfo.email || '',
              phone: extractedLeadInfo.phone || '',
              stage: 'lead',
              source: 'ai_assistant',
              budget_min: (qualifiedLeadData?.budget_min as number) || null,
              budget_max: (qualifiedLeadData?.budget_max as number) || null,
              bedrooms_required: (qualifiedLeadData?.bedrooms as number[]) || null,
              notes: `AI Assistant Conversation:\n${conversationContext}\n\nTimeline: ${qualifiedLeadData?.timeline || 'Not specified'}\nLocation: ${qualifiedLeadData?.location || 'Not specified'}\nAdditional: ${qualifiedLeadData?.notes || 'None'}`,
            })
            .select()
            .single();

          if (buyerError) {
            console.error('Error creating buyer profile:', buyerError);
          } else {
            crmProfileId = buyerProfile.id;
            console.log('Buyer profile created:', crmProfileId);

            await supabase.from('crm_activities').insert({
              organization_id: orgId,
              buyer_profile_id: crmProfileId,
              activity_type: 'note',
              title: 'AI Assistant Lead Capture',
              description: `Lead captured via AI Assistant widget. ${agentContactRequest ? `Agent contact requested (${agentContactRequest.urgency} urgency)` : 'Organic conversation'}`,
              metadata: {
                channel: 'ai_widget',
                lead_quality: agentContactRequest ? 'hot' : 'warm',
                conversation_length: conversationHistory.length + 1,
                qualified_data: qualifiedLeadData,
                agent_request: agentContactRequest,
              }
            });
          }

        } else if (leadType === 'seller') {
          const { data: sellerProfile, error: sellerError } = await supabase
            .from('seller_profiles')
            .insert({
              organization_id: orgId,
              name: extractedLeadInfo.name,
              email: extractedLeadInfo.email || '',
              phone: extractedLeadInfo.phone || '',
              stage: 'lead',
              source: 'ai_assistant',
              property_address: (qualifiedLeadData?.property_address as string) || null,
              notes: `AI Assistant Conversation:\n${conversationContext}\n\nTimeline: ${qualifiedLeadData?.timeline || 'Not specified'}\nAdditional: ${qualifiedLeadData?.notes || 'None'}`,
            })
            .select()
            .single();

          if (sellerError) {
            console.error('Error creating seller profile:', sellerError);
          } else {
            crmProfileId = sellerProfile.id;
            console.log('Seller profile created:', crmProfileId);

            await supabase.from('crm_activities').insert({
              organization_id: orgId,
              seller_profile_id: crmProfileId,
              activity_type: 'note',
              title: 'AI Assistant Lead Capture',
              description: `Lead captured via AI Assistant widget. ${agentContactRequest ? `Agent contact requested (${agentContactRequest.urgency} urgency)` : 'Organic conversation'}`,
              metadata: {
                channel: 'ai_widget',
                lead_quality: agentContactRequest ? 'hot' : 'warm',
                conversation_length: conversationHistory.length + 1,
                qualified_data: qualifiedLeadData,
                agent_request: agentContactRequest,
              }
            });
          }
        }
      } catch (error) {
        console.error('Error in CRM population:', error);
      }
    }

    // Send agent notification if requested
    if (agentContactRequest && extractedLeadInfo && crmProfileId) {
      console.log('Agent contact requested, sending notification');
      
      try {
        const notifyResponse = await supabase.functions.invoke('notify-agent', {
          body: {
            organizationId: orgId,
            leadInfo: extractedLeadInfo,
            qualifiedData: qualifiedLeadData,
            agentRequest: agentContactRequest,
            conversationHistory: [
              ...conversationHistory,
              { role: 'user', content: query },
              { role: 'assistant', content: assistantMessage }
            ],
            crmProfileId: crmProfileId,
          }
        });

        if (notifyResponse.error) {
          console.error('Error sending agent notification:', notifyResponse.error);
        } else {
          agentNotificationSent = true;
          console.log('Agent notification sent successfully');
        }
      } catch (error) {
        console.error('Error invoking notify-agent function:', error);
      }
    }

    return new Response(
      JSON.stringify({
        response: assistantMessage,
        model: config.model_name,
        timestamp: new Date().toISOString(),
        organizationName: orgName,
        leadInfo: extractedLeadInfo,
        qualifiedData: qualifiedLeadData,
        agentRequest: agentContactRequest,
        crmProfileId: crmProfileId,
        agentNotificationSent: agentNotificationSent,
        listingsCount: listings?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in query-ai-assistant:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
