import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AcceptInvitationRequest {
  token: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, email, password, firstName, lastName }: AcceptInvitationRequest = await req.json();

    if (!token || !email || !password || !firstName || !lastName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: invitation, error: inviteError } = await supabase
      .from('organization_invitations')
      .select('*')
      .eq('token', token)
      .is('accepted_at', null)
      .single();

    if (inviteError || !invitation) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired invitation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'This invitation has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: 'Email does not match invitation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      u => u.email?.toLowerCase() === email.toLowerCase()
    );

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      console.log(`User already exists: ${userId}`);
    } else {
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`,
        },
      });

      if (createError || !newUser.user) {
        console.error('Failed to create user:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create account: ' + (createError?.message || 'Unknown error') }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = newUser.user.id;
      console.log(`Created new user: ${userId}`);
    }

    const { data: existingMembership } = await supabase
      .from('user_organizations')
      .select('id')
      .eq('user_id', userId)
      .eq('organization_id', invitation.organization_id)
      .maybeSingle();

    if (!existingMembership) {
      const { error: membershipError } = await supabase
        .from('user_organizations')
        .insert({
          user_id: userId,
          organization_id: invitation.organization_id,
          role: invitation.role,
        });

      if (membershipError) {
        console.error('Failed to add user to organization:', membershipError);
        return new Response(
          JSON.stringify({ error: 'Failed to add to organization: ' + membershipError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({
        user_id: userId,
        role: invitation.role,
      }, { onConflict: 'user_id,role', ignoreDuplicates: true });

    if (roleError) {
      console.error('Failed to assign role:', roleError);
    }

    const { error: updateError } = await supabase
      .from('organization_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);

    if (updateError) {
      console.error('Failed to mark invitation as accepted:', updateError);
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('business_name')
      .eq('id', invitation.organization_id)
      .single();

    console.log(`User ${email} joined organization ${org?.business_name}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Welcome to ${org?.business_name || 'the organization'}!`,
        organizationName: org?.business_name,
        isNewUser: !existingUser,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in accept-invitation:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
