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
    const { propertyId, propertyTitle, name, email, phone, message, clientSlug } = await req.json();

    console.log('Submitting property enquiry for:', propertyTitle);

    if (!propertyId || !propertyTitle || !name || !email || !phone || !clientSlug) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Public schema client for organizations, property_enquiries
    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'public' }
    });
    
    // CRM schema client for buyer_profiles and crm_activities
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
    
    console.log('Organization found:', orgData.business_name);

    // Fetch property details for email (address and hero image)
    // Check if propertyId is a UUID format or CRM record ID (same logic as get-listings)
    let propertyAddress = '';
    let propertyImageUrl = '';
    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyId);
      
      let query = supabase
        .from('listings')
        .select('address, hero_photo');
      
      // If it's a UUID, check the id field; otherwise check the CRM record ID
      if (isUUID) {
        query = query.eq('id', propertyId);
      } else {
        query = query.eq('crm_record_id', propertyId);
      }
      
      const { data: listingData, error: listingError } = await query.single();
      
      if (listingError) {
        console.error('Error fetching listing:', listingError, 'propertyId:', propertyId, 'isUUID:', isUUID);
      } else if (listingData) {
        propertyAddress = listingData.address || '';
        propertyImageUrl = listingData.hero_photo || '';
        console.log('Property details fetched:', { propertyAddress, hasImage: !!propertyImageUrl });
      }
    } catch (listingError) {
      console.error('Error fetching listing details:', listingError);
    }

    const { data, error } = await supabase
      .from('property_enquiries')
      .insert({
        organization_id: orgData.id,
        property_id: propertyId,
        property_title: propertyTitle,
        name,
        email,
        phone,
        message: message || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting enquiry:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to submit enquiry' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Property enquiry submitted successfully:', data.id);

    // Create or update buyer profile in the CRM schema
    let buyerProfileId: string | null = null;
    const propertyDisplayName = propertyAddress || propertyTitle;
    const enquiryNote = `Property Enquiry: ${propertyDisplayName}\nMessage: ${message || 'No message provided'}`;
    
    try {
      const { data: existingProfile } = await supabaseCrm
        .from('buyer_profiles')
        .select('id, interested_properties, notes')
        .eq('email', email)
        .eq('organization_id', orgData.id)
        .single();

      if (existingProfile) {
        // Add property to interested_properties if not already there
        const currentProperties = existingProfile.interested_properties || [];
        const updatedProperties = currentProperties.includes(propertyId)
          ? currentProperties
          : [...currentProperties, propertyId];
        
        // Append enquiry note to existing notes
        const existingNotes = existingProfile.notes || '';
        const updatedNotes = existingNotes 
          ? `${existingNotes}\n\n---\n${new Date().toLocaleDateString('en-IE')}: ${enquiryNote}`
          : enquiryNote;
        
        const { error: updateError } = await supabaseCrm
          .from('buyer_profiles')
          .update({
            interested_properties: updatedProperties,
            notes: updatedNotes,
            last_contact_at: new Date().toISOString(),
          })
          .eq('id', existingProfile.id);

        if (updateError) {
          console.error('Error updating buyer profile:', updateError);
        } else {
          buyerProfileId = existingProfile.id;
          console.log('Buyer profile updated with new interested property:', buyerProfileId);
        }
      } else {
        const { data: profileData, error: profileError } = await supabaseCrm
          .from('buyer_profiles')
          .insert({
            organization_id: orgData.id,
            name,
            email,
            phone,
            interested_properties: [propertyId],
            stage: 'lead',
            source: 'property_enquiry',
            source_id: data.id,
            notes: enquiryNote,
            last_contact_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (profileError) {
          console.error('Error creating buyer profile:', profileError);
        } else {
          buyerProfileId = profileData?.id || null;
          console.log('Buyer profile created successfully:', buyerProfileId);
        }
      }
      
      // Add CRM activity for the enquiry (also in CRM schema)
      if (buyerProfileId) {
        const activityMetadata = JSON.stringify({
          property_id: propertyId,
          property_title: propertyTitle,
          property_address: propertyAddress,
          enquiry_id: data.id,
          channel: 'property_enquiry_form',
        });
        
        const { error: activityError } = await supabaseCrm
          .from('crm_activities')
          .insert({
            organization_id: orgData.id,
            buyer_profile_id: buyerProfileId,
            activity_type: 'note',
            title: `Property Enquiry: ${propertyDisplayName}`,
            description: `Submitted enquiry for "${propertyTitle}"\nAddress: ${propertyAddress || 'N/A'}\nMessage: ${message || 'No message provided'}`,
            metadata: activityMetadata
          });
        
        if (activityError) {
          console.error('Error creating CRM activity:', activityError);
        } else {
          console.log('CRM activity created for enquiry');
        }
      }
    } catch (crmError) {
      console.error('Error in CRM profile creation:', crmError);
    }

    let emailsSent = { buyer: false, admin: false };
    try {
      console.log('Sending confirmation email to buyer:', email);
      const buyerEmailResponse = await supabase.functions.invoke('send-email', {
        body: {
          templateKey: 'enquiry_confirmation',
          to: email,
          organizationId: orgData.id,
          variables: {
            name,
            property_title: propertyTitle,
            property_address: propertyAddress || propertyTitle,
            property_image: propertyImageUrl,
          },
        },
      });

      if (buyerEmailResponse.error) {
        console.error('Error sending buyer confirmation email:', buyerEmailResponse.error);
      } else {
        emailsSent.buyer = true;
        console.log('Buyer confirmation email sent successfully');
      }

      const notificationEmails = orgData.notification_emails?.length > 0 
        ? orgData.notification_emails 
        : [Deno.env.get('ADMIN_EMAIL')].filter(Boolean);
      
      for (const adminEmail of notificationEmails) {
        if (adminEmail) {
          console.log('Sending notification email to:', adminEmail);
          const adminEmailResponse = await supabase.functions.invoke('send-email', {
            body: {
              templateKey: 'enquiry_admin_notification',
              to: adminEmail,
              organizationId: orgData.id,
              variables: {
                name,
                email,
                phone,
                property_title: propertyTitle,
                property_address: propertyAddress || propertyTitle,
                property_image: propertyImageUrl,
                message: message || 'No message provided',
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

    console.log('Property enquiry submission complete:', {
      enquiryId: data.id,
      buyerProfileId,
      emailsSent,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Enquiry submitted successfully',
        enquiryId: data.id,
        buyerProfileId,
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
