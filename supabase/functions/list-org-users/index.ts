import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { organizationId } = await req.json();

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: organizationId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: callerRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUser.id);

    const isSuperAdmin = callerRoles?.some(r => r.role === 'super_admin' || r.role === 'developer');

    if (!isSuperAdmin) {
      const { data: callerOrgs } = await supabase
        .from('user_organizations')
        .select('organization_id, role')
        .eq('user_id', callerUser.id);

      const callerOrgIds = callerOrgs?.map(o => o.organization_id) || [];
      const isAdmin = callerOrgs?.some(o => o.organization_id === organizationId && o.role === 'admin');
      
      if (!callerOrgIds.includes(organizationId) || !isAdmin) {
        return new Response(
          JSON.stringify({ error: "Permission denied. You need admin access to view organization users." }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const { data: orgUsers, error: orgUsersError } = await supabase
      .from('user_organizations')
      .select('id, user_id, role, created_at')
      .eq('organization_id', organizationId);

    if (orgUsersError) {
      console.error('Error fetching org users:', orgUsersError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch organization users" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const usersWithDetails = await Promise.all(
      (orgUsers || []).map(async (orgUser) => {
        const { data: authUser } = await supabase.auth.admin.getUserById(orgUser.user_id);
        
        const firstName = authUser?.user?.user_metadata?.first_name || '';
        const lastName = authUser?.user?.user_metadata?.last_name || '';
        const email = authUser?.user?.email || '';
        
        return {
          id: orgUser.id,
          user_id: orgUser.user_id,
          role: orgUser.role,
          created_at: orgUser.created_at,
          email,
          first_name: firstName,
          last_name: lastName,
          full_name: firstName && lastName ? `${firstName} ${lastName}` : (firstName || lastName || 'Unknown'),
        };
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        users: usersWithDetails,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error('Error in list-org-users:', error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
