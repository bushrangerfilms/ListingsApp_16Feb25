import { Resend } from 'https://esm.sh/resend@4.0.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WaitingListRequest {
  fullName: string;
  email: string;
  phone?: string;
  avgListings?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fullName, email, phone, avgListings }: WaitingListRequest = await req.json();

    console.log('Waiting list request received:', { fullName, email });

    if (!fullName) {
      return new Response(
        JSON.stringify({ error: 'Full name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save to database
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { error: dbError } = await supabase
        .from('waiting_list')
        .insert({
          full_name: fullName,
          email: email,
          phone: phone || null,
          avg_listings: avgListings || null,
        });
      
      if (dbError) {
        console.error('Failed to save to database:', dbError);
      } else {
        console.log('Waiting list entry saved to database');
      }
    }

    // Send email notification
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resend = new Resend(resendApiKey);
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'noreply@autolisting.io';

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4338CA, #6366f1); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; }
          .field { background: white; padding: 12px 15px; border-radius: 6px; border: 1px solid #e2e8f0; margin: 10px 0; }
          .field-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
          .field-value { font-size: 16px; color: #1e293b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">New Waiting List Signup</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">AutoListing.io</p>
          </div>
          <div class="content">
            <div class="field">
              <div class="field-label">Full Name</div>
              <div class="field-value">${fullName}</div>
            </div>
            <div class="field">
              <div class="field-label">Email</div>
              <div class="field-value">${email}</div>
            </div>
            <div class="field">
              <div class="field-label">Phone Number</div>
              <div class="field-value">${phone || 'Not provided'}</div>
            </div>
            <div class="field">
              <div class="field-label">Average Active Listings</div>
              <div class="field-value">${avgListings || 'Not provided'}</div>
            </div>
            <p style="font-size: 13px; color: #64748b; margin-top: 20px;">
              Reply directly to this email to contact the applicant.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: `AutoListing.io <${fromEmail}>`,
      to: ['peter@streamlinedai.tech'],
      replyTo: email,
      subject: `[Waiting List] ${fullName} signed up`,
      html: htmlBody,
    });

    if (error) {
      console.error('Failed to send email:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to send notification' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Waiting list notification email sent:', data?.id);

    return new Response(
      JSON.stringify({ success: true, message: 'Successfully joined waiting list' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing waiting list request:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
