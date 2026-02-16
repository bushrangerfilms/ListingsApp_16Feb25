import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, phone, propertyAddress, message, clientSlug } = await req.json();

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
    
    const supabaseCrm = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'crm' }
    });

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
    
    console.log('Organization found:', orgData.business_name, 'notification_emails:', orgData.notification_emails);

    const { data, error } = await supabase
      .from('valuation_requests')
      .insert({
        organization_id: orgData.id,
        name,
        email,
        phone,
        property_address: propertyAddress,
        message: message || null,
        status: 'new',
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

    let sellerProfileId: string | null = null;
    try {
      const { data: profileData, error: profileError } = await supabaseCrm
        .from('seller_profiles')
        .insert({
          organization_id: orgData.id,
          name,
          email,
          phone,
          property_address: propertyAddress,
          stage: 'lead',
          source: 'valuation_request',
          source_id: data.id,
          valuation_request_id: data.id,
        })
        .select('id')
        .single();

      if (profileError) {
        console.error('Error creating seller profile in CRM schema:', profileError);
      } else {
        sellerProfileId = profileData?.id || null;
        console.log('Seller profile created successfully in CRM schema:', sellerProfileId);
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

      const notificationEmails = orgData.notification_emails?.length > 0 
        ? orgData.notification_emails 
        : [Deno.env.get('ADMIN_EMAIL')].filter(Boolean);
      
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
