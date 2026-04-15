import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, phone, bedrooms, comments, clientSlug } = await req.json();

    console.log('Received property alert submission:', { name, email, phone, bedrooms, clientSlug });

    // Validate required fields
    if (!name || !email || !phone || !bedrooms || bedrooms.length === 0 || !clientSlug) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting check
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const rateLimitResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/check-rate-limit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.get('Authorization') || '',
      },
      body: JSON.stringify({
        clientSlug: 'property-alert',
        ipAddress: clientIp,
      }),
    });

    if (!rateLimitResponse.ok) {
      const rateLimitError = await rateLimitResponse.json();
      console.error('Rate limit exceeded:', rateLimitError);
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase clients for different schemas
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Public schema client for organizations, property_alerts
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' }
    });
    
    // CRM schema client for buyer_profiles
    const supabaseCrm = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'crm' }
    });

    // Get organization with email config
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('id, business_name, notification_emails')
      .eq('slug', clientSlug)
      .single();

    if (orgError || !orgData) {
      console.error('Error finding organization:', orgError);
      return new Response(
        JSON.stringify({ error: 'Invalid client organization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Organization found:', orgData.business_name);

    // Format bedrooms array as a string for emails
    const bedroomsText = bedrooms.map((b: number) => {
      if (b === 5) return '5+ Bedrooms';
      return `${b} Bedroom${b > 1 ? 's' : ''}`;
    }).join(', ');

    // Insert into Supabase property_alerts table
    const { data: supabaseData, error: supabaseError } = await supabase
      .from('property_alerts')
      .insert({
        organization_id: orgData.id,
        name,
        email,
        phone,
        bedrooms,
        comments: comments || null,
        status: 'active',
      })
      .select()
      .single();

    if (supabaseError) {
      console.error('Error inserting into Supabase:', supabaseError);
      throw new Error('Failed to save property alert');
    }

    console.log('Property alert saved successfully:', supabaseData.id);
    
    // Create buyer profile in CRM (using CRM schema client)
    let buyerProfileId: string | null = null;
    try {
      const { data: profileData, error: profileError } = await supabaseCrm
        .from('buyer_profiles')
        .insert({
          organization_id: orgData.id,
          name,
          email,
          phone,
          bedrooms_required: bedrooms,
          stage: 'lead',
          source: 'property_alert',
          source_id: supabaseData.id,
          property_alert_id: supabaseData.id,
          notes: comments || null,
        })
        .select('id')
        .single();

      if (profileError) {
        console.error('Error creating buyer profile in CRM schema:', profileError);
        // Log detailed error but don't fail the request
      } else {
        buyerProfileId = profileData?.id || null;
        console.log('Buyer profile created successfully in CRM schema:', buyerProfileId);
      }
    } catch (crmError) {
      console.error('Error in CRM profile creation:', crmError);
    }

    // Generate preferences URL using the token
    const preferencesToken = supabaseData?.preferences_token || 'unknown';
    const siteUrl = Deno.env.get('SITE_URL') || 'https://yoursite.com';
    const preferencesUrl = `${siteUrl}/alert-preferences/${preferencesToken}`;

    // Send emails and wait for completion
    let emailsSent = { subscriber: false, admin: false };
    try {
      // Send confirmation email to subscriber
      console.log('Sending confirmation email to subscriber:', email);
      const subscriberEmailResponse = await supabase.functions.invoke('send-email', {
        body: {
          templateKey: 'alert_confirmation',
          to: email,
          organizationId: orgData.id,
          variables: {
            name,
            bedrooms: bedroomsText,
            preferencesUrl,
          },
        },
      });

      if (subscriberEmailResponse.error) {
        console.error('Error sending subscriber confirmation email:', subscriberEmailResponse.error);
      } else {
        emailsSent.subscriber = true;
        console.log('Subscriber confirmation email sent successfully');
      }

      // Send notification to org's notification emails (or fallback to global ADMIN_EMAIL)
      const notificationEmails = orgData.notification_emails?.length > 0 
        ? orgData.notification_emails 
        : [Deno.env.get('ADMIN_EMAIL')].filter(Boolean);
      
      for (const adminEmail of notificationEmails) {
        if (adminEmail) {
          console.log('Sending notification email to:', adminEmail);
          const adminEmailResponse = await supabase.functions.invoke('send-email', {
            body: {
              templateKey: 'alert_admin_notification',
              to: adminEmail,
              organizationId: orgData.id,
              variables: {
                name,
                email,
                phone,
                bedrooms: bedroomsText,
                comments: comments || 'No additional comments',
              },
            },
          });

          if (adminEmailResponse.error) {
            console.error('Error sending admin notification email:', adminEmailResponse.error);
          } else {
            emailsSent.admin = true;
            console.log('Admin notification email sent to:', adminEmail);
          }
        }
      }
    } catch (emailError) {
      console.error('Error in email sending process:', emailError);
    }

    console.log('Property alert submission complete:', {
      alertId: supabaseData.id,
      buyerProfileId,
      emailsSent,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: { 
          id: supabaseData.id,
          buyerProfileId,
          emailsSent,
        } 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in submit-property-alert function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
