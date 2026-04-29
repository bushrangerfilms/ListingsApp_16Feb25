import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import {
  COUNTRY_TO_LOCALE,
  DEFAULT_LOCALE,
  LOCALE_CONFIGS,
  type MarketCountry,
} from '../_shared/locale.config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getPostcodeLabel(countryCode: string | null | undefined): string {
  const cc = (countryCode || LOCALE_CONFIGS[DEFAULT_LOCALE].countryCode).toUpperCase() as MarketCountry;
  const locale = COUNTRY_TO_LOCALE[cc];
  if (!locale) return LOCALE_CONFIGS[DEFAULT_LOCALE].address.postalCodeLabel;
  return LOCALE_CONFIGS[locale].address.postalCodeLabel;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, phone, propertyAddress, postcode, message, clientSlug, utm_source, utm_campaign, utm_content, post_id } = await req.json();

    if (!name || !email || !phone || !propertyAddress || !clientSlug) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Submitting valuation request:', { name, email, phone, propertyAddress, clientSlug });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'public' }
    });

    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('id, business_name, notification_emails, contact_email, country_code')
      .eq('slug', clientSlug)
      .single();

    if (orgError || !orgData) {
      console.error('Error finding organization:', orgError);
      return new Response(
        JSON.stringify({ error: 'Invalid client organization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Organization found:', orgData.business_name, 'notification_emails:', orgData.notification_emails);

    const { data, error } = await supabase
      .from('valuation_requests')
      .insert({
        organization_id: orgData.id,
        name,
        email,
        phone,
        property_address: propertyAddress,
        postcode: postcode || null,
        message: message || null,
        status: 'new',
        utm_source: utm_source || null,
        utm_campaign: utm_campaign || null,
        utm_content: utm_content || null,
        post_id: post_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting valuation request:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to submit valuation request' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Valuation request submitted successfully:', data.id);

    const postcodeLabel = getPostcodeLabel(orgData.country_code);
    const sellerPropertyAddress = postcode
      ? `${propertyAddress}, ${postcode}`
      : propertyAddress;

    let sellerProfileId: string | null = null;
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('seller_profiles')
        .insert({
          organization_id: orgData.id,
          name,
          email,
          phone,
          property_address: sellerPropertyAddress,
          stage: 'lead',
          source: 'valuation_request',
          source_id: data.id,
          valuation_request_id: data.id,
        })
        .select('id')
        .single();

      if (profileError) {
        console.error('Error creating seller profile:', profileError);
      } else {
        sellerProfileId = profileData?.id || null;
        console.log('Seller profile created successfully:', sellerProfileId);
      }
    } catch (crmError) {
      console.error('Error in CRM profile creation:', crmError);
    }

    let emailsSent = { seller: false, admin: false };
    try {
      console.log('Sending confirmation email to seller:', email);
      const sellerEmailResponse = await supabase.functions.invoke('send-email', {
        body: {
          templateKey: 'valuation_confirmation',
          to: email,
          organizationId: orgData.id,
          variables: {
            name,
            propertyAddress,
          },
        },
      });

      if (sellerEmailResponse.error) {
        console.error('Error sending seller confirmation email:', sellerEmailResponse.error);
      } else {
        emailsSent.seller = true;
        console.log('Seller confirmation email sent successfully');
      }

      let notificationEmails: string[];
      if (orgData.notification_emails?.length > 0) {
        notificationEmails = orgData.notification_emails;
      } else if (orgData.contact_email && orgData.contact_email.trim()) {
        notificationEmails = [orgData.contact_email.trim()];
      } else {
        notificationEmails = [Deno.env.get('ADMIN_EMAIL')].filter(Boolean) as string[];
      }
      
      for (const adminEmail of notificationEmails) {
        if (adminEmail) {
          console.log('Sending notification email to:', adminEmail);
          const adminEmailResponse = await supabase.functions.invoke('send-email', {
            body: {
              templateKey: 'valuation_admin_notification',
              to: adminEmail,
              organizationId: orgData.id,
              variables: {
                name,
                email,
                phone,
                propertyAddress,
                postcode: postcode || '',
                postcodeLabel,
                message: message || 'No additional information provided',
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

    console.log('Valuation request submission complete:', {
      requestId: data.id,
      sellerProfileId,
      emailsSent,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Valuation request submitted successfully',
        requestId: data.id,
        sellerProfileId,
        emailsSent,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
