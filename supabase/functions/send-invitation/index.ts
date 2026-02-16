import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { Resend } from 'https://esm.sh/resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendInvitationRequest {
  email: string;
  organizationId: string;
  role: 'admin' | 'user';
}

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, organizationId, role }: SendInvitationRequest = await req.json();

    if (!email || !organizationId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email and organizationId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: userOrg } = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (!userOrg || (userOrg.role !== 'admin' && userOrg.role !== 'super_admin')) {
      return new Response(
        JSON.stringify({ error: 'You must be an admin to invite users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('business_name, slug, logo_url')
      .eq('id', organizationId)
      .single();

    if (!org) {
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: existingMember } = await supabase
      .from('user_organizations')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', (await supabase.from('auth.users').select('id').eq('email', email).single()).data?.id)
      .maybeSingle();

    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: existingInvite } = await supabase
      .from('organization_invitations')
      .select('id')
      .eq('email', email)
      .eq('organization_id', organizationId)
      .is('accepted_at', null)
      .maybeSingle();

    if (existingInvite) {
      await supabase
        .from('organization_invitations')
        .update({
          token,
          expires_at: expiresAt.toISOString(),
          role,
          invited_by: user.id,
        })
        .eq('id', existingInvite.id);
    } else {
      const { error: insertError } = await supabase
        .from('organization_invitations')
        .insert({
          email,
          organization_id: organizationId,
          role: role || 'user',
          token,
          invited_by: user.id,
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) {
        console.error('Failed to create invitation:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to create invitation: ' + insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resend = new Resend(resendApiKey);
    const siteUrl = Deno.env.get('SITE_URL') || 'https://app.autolisting.io';
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'noreply@autolisting.io';
    const fromName = org.business_name || 'AutoListing.io';

    const inviteUrl = `${siteUrl}/accept-invitation?token=${token}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
        <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          ${org.logo_url ? `<img src="${org.logo_url}" alt="${org.business_name}" style="height: 48px; margin-bottom: 24px;">` : ''}
          
          <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0;">You're invited to join ${org.business_name}</h1>
          
          <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
            You've been invited to join <strong>${org.business_name}</strong> on AutoListing.io as ${role === 'admin' ? 'an administrator' : 'a team member'}.
          </p>
          
          <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;">
            Click the button below to accept the invitation and create your account:
          </p>
          
          <a href="${inviteUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Accept Invitation
          </a>
          
          <p style="color: #71717a; font-size: 14px; margin: 32px 0 0 0;">
            This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
          
          <p style="color: #a1a1aa; font-size: 12px; margin: 0;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${inviteUrl}" style="color: #2563eb;">${inviteUrl}</a>
          </p>
        </div>
      </body>
      </html>
    `;

    const { error: emailError } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [email],
      subject: `You're invited to join ${org.business_name}`,
      html: emailHtml,
    });

    if (emailError) {
      console.error('Failed to send invitation email:', emailError);
      return new Response(
        JSON.stringify({ error: 'Failed to send invitation email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Invitation sent to ${email} for org ${org.business_name}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Invitation sent to ${email}` 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in send-invitation:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
