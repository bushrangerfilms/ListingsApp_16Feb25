import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { reportToSentry } from '../_shared/sentry-report.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Generate a URL-safe slug from business name
function generateSlug(businessName: string): string {
  return businessName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

// Check if slug is unique, if not, append number
async function generateUniqueSlug(
  supabase: any,
  baseSlug: string
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;
  let isUnique = false;

  while (!isUnique) {
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      throw new Error(`Error checking slug uniqueness: ${error.message}`);
    }

    if (!data) {
      isUnique = true;
    } else {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  return slug;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      businessName,
      psrLicenceNumber,
      contactEmail,
      phone,
      website,
      logoUrl,
      userEmail,
      password,
      firstName,
      lastName,
      planName,
      utmSource,
      utmMedium,
      utmCampaign,
      isComped,
    } = await req.json();

    // Validate and sanitize required fields
    const trimmedBusinessName = businessName?.trim();
    const trimmedContactEmail = contactEmail?.trim();
    const trimmedUserEmail = userEmail?.trim();
    const trimmedFirstName = firstName?.trim();
    const trimmedLastName = lastName?.trim();
    
    if (!trimmedBusinessName || !trimmedContactEmail || !trimmedUserEmail || !password) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Validate business name will produce a valid slug
    if (trimmedBusinessName.length < 2) {
      return new Response(
        JSON.stringify({ error: "Business name must be at least 2 characters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedContactEmail) || !emailRegex.test(trimmedUserEmail)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🏢 Creating organization for:', trimmedBusinessName);

    // Step 1: Generate unique slug from validated business name
    const baseSlug = generateSlug(trimmedBusinessName);
    
    // Ensure slug is not empty after sanitization
    if (!baseSlug || baseSlug.length === 0) {
      return new Response(
        JSON.stringify({ error: "Business name must contain valid characters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const uniqueSlug = await generateUniqueSlug(supabase, baseSlug);
    console.log('✅ Generated unique slug:', uniqueSlug);

    // Step 2: Create organization
    const now = new Date();
    
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .insert({
        business_name: trimmedBusinessName,
        slug: uniqueSlug,
        contact_email: trimmedContactEmail,
        contact_phone: phone?.trim() || null,
        psr_licence_number: psrLicenceNumber?.trim() || null,
        domain: website?.trim() || null,
        logo_url: logoUrl?.trim() || null,
        is_active: true,
        account_status: isComped ? 'active' : 'free',
        trial_started_at: null,
        trial_ends_at: null,
        credit_spending_enabled: true,
        is_comped: isComped || false,
        hide_public_site: true,
      })
      .select()
      .single();

    if (orgError) {
      console.error('❌ Error creating organization:', orgError);
      throw new Error(`Failed to create organization: ${orgError.message}`);
    }

    console.log('✅ Organization created:', organization.id);

    // Step 3: Create user account via Supabase Auth
    // Pilot users (isComped) get email auto-confirmed so they can login immediately
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: trimmedUserEmail,
      password,
      email_confirm: true, // Auto-confirm all users for immediate login
      user_metadata: {
        first_name: trimmedFirstName || '',
        last_name: trimmedLastName || '',
        full_name: [trimmedFirstName, trimmedLastName].filter(Boolean).join(' ') || trimmedBusinessName,
      },
    });

    if (authError) {
      console.error('❌ Error creating user:', authError);
      // Rollback: Delete the organization we just created
      await supabase.from('organizations').delete().eq('id', organization.id);
      throw new Error(`Failed to create user account: ${authError.message}`);
    }

    console.log('✅ User account created:', authData.user.id);

    // Step 4: Assign admin role to user (MANDATORY)
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: 'admin',
      });

    if (roleError) {
      console.error('❌ Error assigning admin role:', roleError);
      // Rollback: Delete user and organization - role assignment is mandatory
      await supabase.auth.admin.deleteUser(authData.user.id);
      await supabase.from('organizations').delete().eq('id', organization.id);
      throw new Error(`Failed to assign admin role: ${roleError.message}`);
    }
    
    console.log('✅ Admin role assigned');

    // Step 5: Link user to organization
    const { error: linkError } = await supabase
      .from('user_organizations')
      .insert({
        user_id: authData.user.id,
        organization_id: organization.id,
        role: 'admin',
      });

    if (linkError) {
      console.error('❌ Error linking user to organization:', linkError);
      // Rollback: Delete user_roles, user, and organization (complete cleanup)
      await supabase.from('user_roles').delete().eq('user_id', authData.user.id);
      await supabase.auth.admin.deleteUser(authData.user.id);
      await supabase.from('organizations').delete().eq('id', organization.id);
      throw new Error(`Failed to link user to organization: ${linkError.message}`);
    }

    console.log('✅ User linked to organization');

    // Step 6: Create default AI Assistant config for the organization
    const { error: aiConfigError } = await supabase
      .from('ai_assistant_config')
      .insert({
        organization_id: organization.id,
        user_id: authData.user.id,
        widget_enabled: false,
        widget_color: '#2563eb',
        welcome_message: `Hi! I'm your AI assistant for ${trimmedBusinessName}. How can I help you find your perfect property today?`,
        personality: 'professional',
        response_length: 'balanced',
        model_name: 'gemini-2.5-flash',
        enabled_capabilities: ['property_recommendations', 'faq_answering', 'contact_gathering', 'lead_qualification'],
        required_lead_fields: ['name', 'email'],
        lead_capture_style: 'balanced',
      });

    if (aiConfigError) {
      console.warn('⚠️ Warning: Failed to create AI assistant config (non-fatal):', aiConfigError);
      // Don't fail the whole signup for this - it can be created later
    } else {
      console.log('✅ AI Assistant config created with defaults');
    }

    // Step 7: Create default AI training metrics
    const { error: trainingMetricsError } = await supabase
      .from('ai_training_metrics')
      .insert({
        user_id: authData.user.id,
        training_status: 'ready',
        properties_count: 0,
        documents_count: 0,
        total_tokens: 0,
      });

    if (trainingMetricsError) {
      console.warn('⚠️ Warning: Failed to create AI training metrics (non-fatal):', trainingMetricsError);
    } else {
      console.log('✅ AI Training metrics created');
    }

    // Step 8: Grant credits for comped/pilot organizations only
    if (isComped) {
      const COMPED_CREDITS = 100;
      const { error: creditLedgerError } = await supabase
        .from('credit_ledger')
        .insert({
          organization_id: organization.id,
          amount: COMPED_CREDITS,
          action: 'grant',
          description: 'Comped credits on signup',
          feature_type: null,
          metadata: {
            type: 'comped_signup',
            plan_name: planName || 'free',
            utm_source: utmSource || null,
            utm_medium: utmMedium || null,
            utm_campaign: utmCampaign || null,
          },
        });

      if (creditLedgerError) {
        console.warn('⚠️ Warning: Failed to grant comped credits (non-fatal):', creditLedgerError);
      } else {
        console.log('✅ Comped credits granted:', COMPED_CREDITS);
      }
    }

    // Step 9: Create signup request record for tracking
    const { error: signupRequestError } = await supabase
      .from('signup_requests')
      .insert({
        email: trimmedUserEmail,
        plan_name: planName || 'starter',
        organization_id: organization.id,
        user_id: authData.user.id,
        status: 'completed',
        utm_source: utmSource || null,
        utm_medium: utmMedium || null,
        utm_campaign: utmCampaign || null,
      });

    if (signupRequestError) {
      console.warn('⚠️ Warning: Failed to create signup request record (non-fatal):', signupRequestError);
    } else {
      console.log('✅ Signup request recorded');
    }

    // Step 10: Create initial account lifecycle log entry
    const { error: lifecycleLogError } = await supabase
      .from('account_lifecycle_log')
      .insert({
        organization_id: organization.id,
        previous_status: null,
        new_status: isComped ? 'active' : 'free',
        reason: isComped ? 'New comped organization created' : 'New organization signup - Free plan',
        triggered_by: 'signup',
        metadata: {
          plan: isComped ? 'comped' : 'free',
          utm_source: utmSource || null,
          utm_medium: utmMedium || null,
          utm_campaign: utmCampaign || null,
        },
      });

    if (lifecycleLogError) {
      console.warn('⚠️ Warning: Failed to create lifecycle log entry (non-fatal):', lifecycleLogError);
    } else {
      console.log('✅ Account lifecycle log created');
    }

    // Step 11: Send welcome email to new user (non-blocking)
    const fullName = [trimmedFirstName, trimmedLastName].filter(Boolean).join(' ') || trimmedBusinessName;
    try {
      // No organizationId — platform welcome email should always come from AutoListing, not the org
      await supabase.functions.invoke('send-email', {
        body: {
          templateKey: 'welcome_signup',
          to: trimmedUserEmail,
          variables: {
            first_name: trimmedFirstName || trimmedBusinessName,
            business_name: trimmedBusinessName,
            login_url: 'https://app.autolisting.io/admin/listings',
          },
        },
      });
      console.log('✅ Welcome email sent to:', trimmedUserEmail);
    } catch (emailErr) {
      console.warn('⚠️ Failed to send welcome email (non-fatal):', emailErr);
    }

    // Step 12: Notify admin of new signup (non-blocking)
    const adminEmail = Deno.env.get('ADMIN_EMAIL');
    if (adminEmail) {
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            templateKey: 'admin_new_signup_notification',
            to: adminEmail,
            variables: {
              business_name: trimmedBusinessName,
              user_name: fullName,
              user_email: trimmedUserEmail,
              plan_name: isComped ? 'Comped' : (planName || 'Free'),
              utm_source: utmSource || 'Direct',
              admin_url: `https://app.autolisting.io/internal/organizations`,
            },
          },
        });
        console.log('✅ Admin notification sent to:', adminEmail);
      } catch (emailErr) {
        console.warn('⚠️ Failed to send admin notification (non-fatal):', emailErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        organization: {
          id: organization.id,
          name: organization.business_name,
          slug: organization.slug,
        },
        user: {
          id: authData.user.id,
          email: authData.user.email,
        },
        plan: {
          name: isComped ? 'comped' : 'free',
        },
        message: "Organization created successfully! Welcome to AutoListing.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    reportToSentry(error, { functionName: 'create-organization' }).catch(() => {});
    console.error('❌ Error in create-organization:', error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
