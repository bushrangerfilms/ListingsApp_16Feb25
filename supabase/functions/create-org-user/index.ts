import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PLAN_LIMITS: Record<string, number> = {
  starter: 10,
  pro: 10,
  trial: 10,
};

interface TeamLimitResult {
  maxUsers: number;
  currentCount: number;
  planName: string | null;
  isTrial: boolean;
  isAtLimit: boolean;
}

async function getTeamLimitInfo(
  supabase: ReturnType<typeof createClient>,
  organizationId: string
): Promise<TeamLimitResult> {
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('account_status, trial_ends_at')
    .eq('id', organizationId)
    .single();

  if (orgError || !org) {
    console.error('Error fetching organization for team limit:', orgError);
    return { maxUsers: 1, currentCount: 0, planName: null, isTrial: false, isAtLimit: false };
  }

  const isTrial = org.account_status === 'trial' && 
    org.trial_ends_at && 
    new Date(org.trial_ends_at) > new Date();

  const { data: billingProfile } = await supabase
    .from('billing_profiles')
    .select('subscription_plan')
    .eq('organization_id', organizationId)
    .single();

  const planName = billingProfile?.subscription_plan || null;

  let maxUsers = PLAN_LIMITS.starter;

  if (isTrial) {
    maxUsers = PLAN_LIMITS.trial;
  } else if (planName && PLAN_LIMITS[planName.toLowerCase()]) {
    maxUsers = PLAN_LIMITS[planName.toLowerCase()];
  } else if (planName) {
    const { data: planDef } = await supabase
      .from('plan_definitions')
      .select('max_users')
      .eq('name', planName.toLowerCase())
      .eq('is_active', true)
      .single();
    
    if (planDef?.max_users) {
      maxUsers = planDef.max_users;
    }
  }

  const { count, error: countError } = await supabase
    .from('user_organizations')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  if (countError) {
    console.error('Error counting team members:', countError);
  }

  const currentCount = count ?? 0;
  const isAtLimit = currentCount >= maxUsers;

  return {
    maxUsers,
    currentCount,
    planName,
    isTrial,
    isAtLimit,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      organizationId,
      email,
      password,
      firstName,
      lastName,
      role,
    } = await req.json();

    const trimmedEmail = email?.trim();
    const trimmedFirstName = firstName?.trim();
    const trimmedLastName = lastName?.trim();
    const trimmedRole = role?.trim() || 'user';

    if (!organizationId || !trimmedEmail || !password || !trimmedFirstName || !trimmedLastName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: organizationId, email, password, firstName, lastName" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const validRoles = ['admin', 'user'];
    if (!validRoles.includes(trimmedRole)) {
      return new Response(
        JSON.stringify({ error: "Invalid role. Must be 'admin' or 'user'" }),
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

    console.log('📋 Checking permissions for user:', callerUser.id);

    const { data: callerRoles, error: roleCheckError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUser.id);

    if (roleCheckError) {
      console.error('❌ Error checking caller roles:', roleCheckError);
      return new Response(
        JSON.stringify({ error: "Failed to verify permissions" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const roles = callerRoles?.map(r => r.role) || [];
    const isSuperAdmin = roles.includes('super_admin');
    const isAdmin = roles.includes('admin') || isSuperAdmin;

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Permission denied. Only admins can create users." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!isSuperAdmin) {
      const { data: callerOrgs, error: orgCheckError } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', callerUser.id);

      if (orgCheckError) {
        console.error('❌ Error checking caller organizations:', orgCheckError);
        return new Response(
          JSON.stringify({ error: "Failed to verify organization access" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const callerOrgIds = callerOrgs?.map(o => o.organization_id) || [];
      if (!callerOrgIds.includes(organizationId)) {
        return new Response(
          JSON.stringify({ error: "Permission denied. You can only add users to your own organization." }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id, business_name')
      .eq('id', organizationId)
      .single();

    if (orgError || !organization) {
      return new Response(
        JSON.stringify({ error: "Organization not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('👥 Checking team size limit for organization:', organization.business_name);

    const teamLimit = await getTeamLimitInfo(supabase, organizationId);
    
    console.log('📊 Team limit info:', {
      currentCount: teamLimit.currentCount,
      maxUsers: teamLimit.maxUsers,
      planName: teamLimit.planName,
      isTrial: teamLimit.isTrial,
      isAtLimit: teamLimit.isAtLimit,
    });

    if (teamLimit.isAtLimit) {
      const planLabel = teamLimit.isTrial 
        ? 'trial' 
        : teamLimit.planName || 'current';
      
      return new Response(
        JSON.stringify({ 
          error: `Team limit reached. Your ${planLabel} plan allows ${teamLimit.maxUsers} user${teamLimit.maxUsers === 1 ? '' : 's'}. Please upgrade to add more team members.`,
          code: 'TEAM_LIMIT_REACHED',
          details: {
            currentCount: teamLimit.currentCount,
            maxUsers: teamLimit.maxUsers,
            planName: teamLimit.planName,
            isTrial: teamLimit.isTrial,
          }
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('👤 Creating user for organization:', organization.business_name);

    const { data: authData, error: createUserError } = await supabase.auth.admin.createUser({
      email: trimmedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: trimmedFirstName,
        last_name: trimmedLastName,
        full_name: `${trimmedFirstName} ${trimmedLastName}`,
      },
    });

    if (createUserError) {
      console.error('❌ Error creating user:', createUserError);
      return new Response(
        JSON.stringify({ error: `Failed to create user: ${createUserError.message}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('✅ User account created:', authData.user.id);

    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: trimmedRole,
      });

    if (roleError) {
      console.error('❌ Error assigning role:', roleError);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: `Failed to assign role: ${roleError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('✅ Role assigned:', trimmedRole);

    const { error: linkError } = await supabase
      .from('user_organizations')
      .insert({
        user_id: authData.user.id,
        organization_id: organizationId,
        role: trimmedRole,
      });

    if (linkError) {
      console.error('❌ Error linking user to organization:', linkError);
      await supabase.from('user_roles').delete().eq('user_id', authData.user.id);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: `Failed to link user to organization: ${linkError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('✅ User linked to organization');

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: authData.user.id,
          email: authData.user.email,
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          role: trimmedRole,
        },
        message: "User created successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error('❌ Error in create-org-user:', error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
