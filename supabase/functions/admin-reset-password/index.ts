import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

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
    const { userId, organizationId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: userId" }),
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
        JSON.stringify({ error: "Permission denied. Only admins can reset passwords." }),
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
        return new Response(
          JSON.stringify({ error: "Failed to verify organization access" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const callerOrgIds = callerOrgs?.map(o => o.organization_id) || [];
      
      const { data: targetUserOrgs } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', userId);

      const targetOrgIds = targetUserOrgs?.map(o => o.organization_id) || [];
      const hasSharedOrg = targetOrgIds.some(orgId => callerOrgIds.includes(orgId));

      if (!hasSharedOrg) {
        return new Response(
          JSON.stringify({ error: "Permission denied. You can only reset passwords for users in your organization." }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const { data: targetUser, error: targetUserError } = await supabase.auth.admin.getUserById(userId);

    if (targetUserError || !targetUser?.user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('🔑 Generating password reset link for:', targetUser.user.email);

    // Get the app URL for redirect
    const appUrl = Deno.env.get("APP_URL") || "https://app.autolisting.io";
    
    const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: targetUser.user.email!,
      options: {
        redirectTo: `${appUrl}/reset-password`,
      },
    });

    if (resetError) {
      console.error('❌ Error generating reset link:', resetError);
      return new Response(
        JSON.stringify({ error: `Failed to generate reset link: ${resetError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('✅ Password reset link generated');

    // Get Resend API key
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error('❌ RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: "Email service not configured. Please contact support." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extract the reset link from the generated data
    const resetLink = resetData.properties?.action_link;
    if (!resetLink) {
      console.error('❌ No reset link in response:', resetData);
      return new Response(
        JSON.stringify({ error: "Failed to generate reset link" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('📧 Sending password reset email via Resend');

    // Send email via Resend
    const resend = new Resend(resendApiKey);
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "AutoListing <noreply@autolisting.io>",
      to: targetUser.user.email!,
      subject: "Reset Your Password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">Reset Your Password</h2>
          <p>Hello,</p>
          <p>An administrator has requested a password reset for your account. Click the button below to set a new password:</p>
          <p style="margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </p>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetLink}</p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't expect this email, you can safely ignore it.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #888; font-size: 12px;">AutoListing.io</p>
        </div>
      `,
    });

    if (emailError) {
      console.error('❌ Resend error:', emailError);
      return new Response(
        JSON.stringify({ error: `Failed to send email: ${emailError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('✅ Password reset email sent, ID:', emailData?.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password reset email sent successfully",
        email: targetUser.user.email,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error('❌ Error in admin-reset-password:', error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
