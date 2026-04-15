import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RemoveUserRequest {
  organizationId: string;
  userOrganizationId: string;
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

    const { organizationId, userOrganizationId }: RemoveUserRequest = await req.json();

    if (!organizationId || !userOrganizationId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: organizationId and userOrganizationId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: requesterOrg } = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (!requesterOrg || (requesterOrg.role !== 'admin' && requesterOrg.role !== 'super_admin')) {
      return new Response(
        JSON.stringify({ error: 'You must be an admin to remove users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: targetUser } = await supabase
      .from('user_organizations')
      .select('user_id, role')
      .eq('id', userOrganizationId)
      .eq('organization_id', organizationId)
      .single();

    if (!targetUser) {
      return new Response(
        JSON.stringify({ error: 'User not found in this organization' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (targetUser.user_id === user.id) {
      return new Response(
        JSON.stringify({ error: 'You cannot remove yourself from the organization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (targetUser.role === 'super_admin' && requesterOrg.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Only super admins can remove other super admins' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: deleteError } = await supabase
      .from('user_organizations')
      .delete()
      .eq('id', userOrganizationId)
      .eq('organization_id', organizationId);

    if (deleteError) {
      console.error('Failed to remove user:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to remove user: ' + deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${targetUser.user_id} removed from organization ${organizationId} by ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User removed from organization successfully' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in remove-org-user:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
