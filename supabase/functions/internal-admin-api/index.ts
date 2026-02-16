import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

interface AuthResult {
  user: { id: string; email: string };
  isSuperAdmin: boolean;
  isDeveloper: boolean;
  roles: string[];
}

async function authenticateAdmin(
  req: Request,
  supabase: SupabaseClient
): Promise<AuthResult | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: userRoles, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleError) {
    console.error("Error fetching user roles:", roleError);
    return new Response(
      JSON.stringify({ error: "Failed to verify permissions" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const roles = userRoles?.map((r) => r.role) || [];
  const isSuperAdmin = roles.includes("super_admin");
  const isDeveloper = roles.includes("developer");

  if (!isSuperAdmin && !isDeveloper) {
    return new Response(
      JSON.stringify({ error: "Access denied. Super Admin or Developer role required." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return {
    user: { id: user.id, email: user.email || "" },
    isSuperAdmin,
    isDeveloper,
    roles,
  };
}

async function handleAnalyticsOverview(supabase: SupabaseClient, auth: AuthResult) {
  const [orgsResult, usersResult, creditsResult, discountsResult, featuresResult] = await Promise.all([
    supabase.from("organizations").select("id, name, account_status, created_at", { count: "exact" }),
    supabase.from("user_roles").select("user_id, role", { count: "exact" }),
    supabase.from("credit_ledger").select("amount, type, created_at"),
    supabase.from("discount_codes").select("id, code, times_used, max_uses, is_active"),
    supabase.from("feature_flags").select("id, name, is_enabled"),
  ]);

  const orgs = orgsResult.data || [];
  const totalOrgs = orgsResult.count || 0;
  const activeOrgs = orgs.filter((o) => o.account_status === "active").length;
  const trialOrgs = orgs.filter((o) => o.account_status === "trial").length;

  const userRoles = usersResult.data || [];
  const uniqueUsers = new Set(userRoles.map((u) => u.user_id)).size;
  const adminCount = userRoles.filter((u) => u.role === "admin").length;

  const discounts = discountsResult.data || [];
  const activeDiscounts = discounts.filter((d) => d.is_active).length;
  const totalRedemptions = discounts.reduce((sum, d) => sum + (d.times_used || 0), 0);

  const features = featuresResult.data || [];
  const enabledFeatures = features.filter((f) => f.is_enabled).length;

  const baseResponse = {
    organizations: {
      total: totalOrgs,
      active: activeOrgs,
      trial: trialOrgs,
    },
    users: {
      total: uniqueUsers,
      admins: adminCount,
    },
    discounts: {
      total: discounts.length,
      active: activeDiscounts,
      totalRedemptions,
    },
    features: {
      total: features.length,
      enabled: enabledFeatures,
    },
  };

  if (auth.isSuperAdmin) {
    const ledger = creditsResult.data || [];
    const totalCreditsGranted = ledger
      .filter((l) => l.type === "grant" || l.type === "purchase")
      .reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);
    const totalCreditsUsed = ledger
      .filter((l) => l.type === "usage")
      .reduce((sum, l) => sum + Math.abs(parseFloat(l.amount || 0)), 0);

    return {
      ...baseResponse,
      credits: {
        granted: totalCreditsGranted,
        used: totalCreditsUsed,
        balance: totalCreditsGranted - totalCreditsUsed,
      },
    };
  }

  return {
    ...baseResponse,
    credits: { redacted: true, reason: "Revenue data restricted to super admins" },
  };
}

async function handleRecentSignups(supabase: SupabaseClient, auth: AuthResult, limit = 10) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, account_status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch recent signups: ${error.message}`);
  }

  return data || [];
}

async function handleFeatureUsage(supabase: SupabaseClient, auth: AuthResult) {
  const { data, error } = await supabase
    .from("credit_ledger")
    .select("feature, amount")
    .eq("type", "usage");

  if (error) {
    console.error("Error fetching feature usage:", error);
    return [];
  }

  const usageByFeature: Record<string, { count: number; totalCredits: number }> = {};
  (data || []).forEach((entry) => {
    const feature = entry.feature || "unknown";
    if (!usageByFeature[feature]) {
      usageByFeature[feature] = { count: 0, totalCredits: 0 };
    }
    usageByFeature[feature].count++;
    usageByFeature[feature].totalCredits += Math.abs(parseFloat(entry.amount || 0));
  });

  return Object.entries(usageByFeature)
    .map(([feature, stats]) => ({ feature, ...stats }))
    .sort((a, b) => b.totalCredits - a.totalCredits);
}

async function handleDiscountStats(supabase: SupabaseClient, auth: AuthResult) {
  const { data, error } = await supabase
    .from("discount_codes")
    .select("id, code, discount_type, discount_value, times_used, max_uses, is_active, credit_grant_amount")
    .order("times_used", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch discount stats: ${error.message}`);
  }

  return data || [];
}

async function handleVideoAnalyticsOverview(supabase: SupabaseClient, auth: AuthResult) {
  // Get all video events
  const { data: events, error } = await supabase
    .from("demo_video_analytics")
    .select("session_id, event_type, max_percentage, watch_time_seconds, device_type, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch video analytics: ${error.message}`);
  }

  const allEvents = events || [];
  
  // Count unique sessions
  const uniqueSessions = new Set(allEvents.map(e => e.session_id)).size;
  
  // Count by event type
  const playEvents = allEvents.filter(e => e.event_type === 'play').length;
  const progress25 = allEvents.filter(e => e.event_type === 'progress_25').length;
  const progress50 = allEvents.filter(e => e.event_type === 'progress_50').length;
  const progress75 = allEvents.filter(e => e.event_type === 'progress_75').length;
  const completeEvents = allEvents.filter(e => e.event_type === 'complete').length;
  
  // Calculate completion rate
  const completionRate = playEvents > 0 ? Math.round((completeEvents / playEvents) * 100) : 0;
  
  // Calculate average watch time from sessions with watch_time_seconds
  const sessionsWithWatchTime = allEvents.filter(e => e.watch_time_seconds && e.watch_time_seconds > 0);
  const avgWatchTimeSeconds = sessionsWithWatchTime.length > 0 
    ? Math.round(sessionsWithWatchTime.reduce((sum, e) => sum + (e.watch_time_seconds || 0), 0) / sessionsWithWatchTime.length)
    : 0;
  
  // Device breakdown
  const deviceBreakdown = {
    desktop: allEvents.filter(e => e.device_type === 'desktop' && e.event_type === 'play').length,
    mobile: allEvents.filter(e => e.device_type === 'mobile' && e.event_type === 'play').length,
    tablet: allEvents.filter(e => e.device_type === 'tablet' && e.event_type === 'play').length,
  };

  // Funnel data
  const funnel = [
    { stage: 'Started', count: playEvents, dropOff: 0 },
    { stage: '25%', count: progress25, dropOff: playEvents > 0 ? Math.round(((playEvents - progress25) / playEvents) * 100) : 0 },
    { stage: '50%', count: progress50, dropOff: progress25 > 0 ? Math.round(((progress25 - progress50) / progress25) * 100) : 0 },
    { stage: '75%', count: progress75, dropOff: progress50 > 0 ? Math.round(((progress50 - progress75) / progress50) * 100) : 0 },
    { stage: 'Completed', count: completeEvents, dropOff: progress75 > 0 ? Math.round(((progress75 - completeEvents) / progress75) * 100) : 0 },
  ];

  return {
    totalViews: playEvents,
    uniqueSessions,
    completionRate,
    avgWatchTimeSeconds,
    deviceBreakdown,
    funnel,
  };
}

async function handleVideoAnalyticsEvents(supabase: SupabaseClient, auth: AuthResult, limit: number) {
  const { data, error } = await supabase
    .from("demo_video_analytics")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch video events: ${error.message}`);
  }

  return data || [];
}

async function handleAdminNotes(supabase: SupabaseClient, auth: AuthResult, targetType?: string, targetId?: string) {
  let query = supabase
    .from("admin_notes")
    .select("*")
    .order("created_at", { ascending: false });

  if (targetType) {
    query = query.eq("target_type", targetType);
  }
  if (targetId) {
    query = query.eq("target_id", targetId);
  }

  const { data, error } = await query.limit(100);

  if (error) {
    throw new Error(`Failed to fetch admin notes: ${error.message}`);
  }

  return data || [];
}

async function handleCreateAdminNote(
  supabase: SupabaseClient,
  auth: AuthResult,
  body: { target_type: string; target_id: string; note: string }
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can create admin notes");
  }

  if (!body.target_id?.trim()) {
    throw new Error("Target ID is required");
  }
  if (!body.note?.trim()) {
    throw new Error("Note content is required");
  }

  const noteData = {
    target_type: body.target_type,
    target_id: body.target_id.trim(),
    note: body.note.trim(),
    created_by: auth.user.id,
  };

  const { data, error } = await supabase
    .from("admin_notes")
    .insert(noteData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create note: ${error.message}`);
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "create_admin_note",
    target_type: body.target_type,
    target_id: body.target_id.trim(),
    before_state: null,
    after_state: noteData,
  });

  return data;
}

async function handleDeleteAdminNote(supabase: SupabaseClient, auth: AuthResult, noteId: string) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can delete admin notes");
  }

  const { data: existing, error: fetchError } = await supabase
    .from("admin_notes")
    .select("*")
    .eq("id", noteId)
    .single();

  if (fetchError || !existing) {
    throw new Error("Note not found");
  }

  const { error } = await supabase.from("admin_notes").delete().eq("id", noteId);

  if (error) {
    throw new Error(`Failed to delete note: ${error.message}`);
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "delete_admin_note",
    target_type: "admin_note",
    target_id: noteId,
    before_state: existing,
    after_state: null,
  });

  return { success: true };
}

async function handleGdprRequests(supabase: SupabaseClient, auth: AuthResult, status?: string) {
  let query = supabase
    .from("gdpr_data_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch GDPR requests: ${error.message}`);
  }

  return data || [];
}

async function handleCreateGdprRequest(
  supabase: SupabaseClient,
  auth: AuthResult,
  body: { request_type: string; target_type: string; target_id?: string; target_email?: string; notes?: string }
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can create GDPR requests");
  }

  const validRequestTypes = ["data_export", "data_deletion", "access_request"];
  if (!validRequestTypes.includes(body.request_type)) {
    throw new Error("Invalid request type");
  }

  if (!body.target_id?.trim() && !body.target_email?.trim()) {
    throw new Error("Either target ID or target email is required");
  }

  const requestData = {
    request_type: body.request_type,
    target_type: body.target_type,
    target_id: body.target_id?.trim() || null,
    target_email: body.target_email?.trim() || null,
    notes: body.notes?.trim() || null,
    status: "pending",
    requested_by: auth.user.id,
  };

  const { data, error } = await supabase
    .from("gdpr_data_requests")
    .insert(requestData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create GDPR request: ${error.message}`);
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "create_gdpr_request",
    target_type: "gdpr_request",
    target_id: data.id,
    before_state: null,
    after_state: requestData,
  });

  return data;
}

async function handleProcessGdprRequest(
  supabase: SupabaseClient,
  auth: AuthResult,
  requestId: string,
  action: "complete" | "reject",
  reason?: string
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can process GDPR requests");
  }

  const { data: existing, error: fetchError } = await supabase
    .from("gdpr_data_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (fetchError || !existing) {
    throw new Error("GDPR request not found");
  }

  const newStatus = action === "complete" ? "completed" : "rejected";
  const updateData: Record<string, any> = {
    status: newStatus,
    completed_at: new Date().toISOString(),
  };

  if (action === "reject" && reason) {
    updateData.rejection_reason = reason;
  }

  const { error } = await supabase
    .from("gdpr_data_requests")
    .update(updateData)
    .eq("id", requestId);

  if (error) {
    throw new Error(`Failed to process GDPR request: ${error.message}`);
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: `${action}_gdpr_request`,
    target_type: "gdpr_request",
    target_id: requestId,
    before_state: { status: existing.status },
    after_state: { status: newStatus, rejection_reason: reason },
  });

  return { success: true, status: newStatus };
}

async function handleGdprDataExport(supabase: SupabaseClient, auth: AuthResult, requestId: string) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can generate GDPR data exports");
  }

  const { data: request, error: requestError } = await supabase
    .from("gdpr_data_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (requestError || !request) {
    throw new Error("GDPR request not found");
  }

  if (request.request_type !== "data_export" && request.request_type !== "access_request") {
    throw new Error("This request type does not support data export");
  }

  const exportData: Record<string, unknown> = {
    export_date: new Date().toISOString(),
    request_id: requestId,
    request_type: request.request_type,
    target_type: request.target_type,
  };

  if (request.target_type === "user") {
    const userId = request.target_id;
    const userEmail = request.target_email;

    let targetUserId = userId;

    if (!targetUserId && userEmail) {
      const { data: userData } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", userEmail)
        .single();
      
      if (userData) {
        targetUserId = userData.id;
      }
    }

    if (targetUserId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email, display_name, avatar_url, phone, job_title, created_at, updated_at")
        .eq("id", targetUserId)
        .single();

      exportData.profile = profile || null;

      const { data: orgMemberships } = await supabase
        .from("organization_members")
        .select("organization_id, role, created_at")
        .eq("user_id", targetUserId);

      exportData.organization_memberships = orgMemberships || [];

      const { data: authUser } = await supabase.auth.admin.getUserById(targetUserId);
      if (authUser?.user) {
        exportData.auth_metadata = {
          email: authUser.user.email,
          email_confirmed_at: authUser.user.email_confirmed_at,
          phone: authUser.user.phone,
          created_at: authUser.user.created_at,
          last_sign_in_at: authUser.user.last_sign_in_at,
          app_metadata: authUser.user.app_metadata,
        };
      }

      const { data: auditLogs } = await supabase
        .from("admin_audit_log")
        .select("action_type, target_type, target_id, created_at")
        .eq("actor_id", targetUserId)
        .order("created_at", { ascending: false })
        .limit(100);

      exportData.activity_logs = auditLogs || [];
    }
  } else if (request.target_type === "organization") {
    const orgId = request.target_id;

    if (orgId) {
      const { data: org } = await supabase
        .from("organizations")
        .select("id, name, slug, plan, status, stripe_customer_id, created_at, updated_at")
        .eq("id", orgId)
        .single();

      exportData.organization = org || null;

      const { data: members } = await supabase
        .from("organization_members")
        .select("user_id, role, created_at")
        .eq("organization_id", orgId);

      exportData.members = members || [];

      const { data: creditLedger } = await supabase
        .from("credit_ledger")
        .select("id, credit_amount, description, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(100);

      exportData.credit_ledger = creditLedger || [];

      const { data: listings } = await supabase
        .from("listings")
        .select("id, address, property_type, status, price, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(500);

      exportData.listings = listings || [];
    }
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "generate_gdpr_export",
    target_type: request.target_type,
    target_id: request.target_id || request.target_email,
    before_state: null,
    after_state: { request_id: requestId, export_generated: true },
  });

  return {
    success: true,
    export_data: exportData,
    filename: `gdpr_export_${request.target_type}_${Date.now()}.json`,
  };
}

async function handleResendVerification(supabase: SupabaseClient, auth: AuthResult, userId: string) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can resend verification emails");
  }

  if (!userId?.trim()) {
    throw new Error("User ID is required");
  }

  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);

  if (userError || !userData?.user) {
    throw new Error("User not found");
  }

  const beforeState = {
    user_id: userId,
    email: userData.user.email,
    email_confirmed: userData.user.email_confirmed_at != null,
  };

  const { error } = await supabase.auth.admin.generateLink({
    type: "signup",
    email: userData.user.email!,
  });

  if (error) {
    throw new Error(`Failed to resend verification: ${error.message}`);
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "resend_verification_email",
    target_type: "user",
    target_id: userId,
    before_state: beforeState,
    after_state: { email: userData.user.email, verification_sent: true },
  });

  return { success: true, email: userData.user.email };
}

async function handlePasswordReset(supabase: SupabaseClient, auth: AuthResult, email: string) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can trigger password resets");
  }

  if (!email?.trim()) {
    throw new Error("Email is required");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());

  if (error) {
    throw new Error(`Failed to send password reset: ${error.message}`);
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "send_password_reset",
    target_type: "user",
    target_id: email.trim(),
    before_state: null,
    after_state: { email: email.trim(), reset_sent: true },
  });

  return { success: true, email: email.trim() };
}

async function handleSetPassword(supabase: SupabaseClient, auth: AuthResult, userId: string, newPassword: string) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can set user passwords");
  }

  if (!userId?.trim()) {
    throw new Error("User ID is required");
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const { error } = await supabase.auth.admin.updateUserById(userId.trim(), {
    password: newPassword,
  });

  if (error) {
    throw new Error(`Failed to set password: ${error.message}`);
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "set_user_password",
    target_type: "user",
    target_id: userId.trim(),
    before_state: null,
    after_state: { password_updated: true },
  });

  return { success: true, userId: userId.trim() };
}

async function handleEmailQueue(supabase: SupabaseClient, auth: AuthResult, limit = 50) {
  const { data, error } = await supabase
    .from("email_queue")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Email queue query error:", error);
    return [];
  }

  return data || [];
}

async function handleDiscountCodesList(supabase: SupabaseClient, auth: AuthResult) {
  const { data, error } = await supabase
    .from("discount_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch discount codes: ${error.message}`);
  }

  return data || [];
}

async function handleCreateDiscountCode(
  supabase: SupabaseClient,
  auth: AuthResult,
  body: {
    code: string;
    description?: string;
    discount_type: "percentage" | "fixed";
    discount_value: number;
    max_uses?: number;
    max_uses_per_org?: number;
    valid_until?: string;
    applicable_plans?: string[];
    min_months?: number;
    is_active?: boolean;
  }
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can create discount codes");
  }

  if (!body.code?.trim()) {
    throw new Error("Code is required");
  }
  if (!body.discount_value || body.discount_value <= 0) {
    throw new Error("Valid discount value is required");
  }

  const insertData = {
    code: body.code.toUpperCase().trim(),
    description: body.description?.trim() || null,
    discount_type: body.discount_type || "percentage",
    discount_value: body.discount_value,
    max_uses: body.max_uses || null,
    max_uses_per_org: body.max_uses_per_org || 1,
    valid_until: body.valid_until || null,
    applicable_plans: body.applicable_plans?.length ? body.applicable_plans : null,
    min_months: body.min_months || 1,
    is_active: body.is_active !== false,
    created_by: auth.user.id,
  };

  const { data, error } = await supabase
    .from("discount_codes")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create discount code: ${error.message}`);
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "create_discount_code",
    target_type: "discount_code",
    target_id: data.id,
    before_state: null,
    after_state: insertData,
  });

  return data;
}

async function handleUpdateDiscountCode(
  supabase: SupabaseClient,
  auth: AuthResult,
  codeId: string,
  body: {
    code?: string;
    description?: string;
    discount_type?: "percentage" | "fixed";
    discount_value?: number;
    max_uses?: number;
    max_uses_per_org?: number;
    valid_until?: string;
    applicable_plans?: string[];
    min_months?: number;
    is_active?: boolean;
  }
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can update discount codes");
  }

  const { data: existing, error: fetchError } = await supabase
    .from("discount_codes")
    .select("*")
    .eq("id", codeId)
    .single();

  if (fetchError || !existing) {
    throw new Error("Discount code not found");
  }

  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (body.code !== undefined) updateData.code = body.code.toUpperCase().trim();
  if (body.description !== undefined) updateData.description = body.description?.trim() || null;
  if (body.discount_type !== undefined) updateData.discount_type = body.discount_type;
  if (body.discount_value !== undefined) updateData.discount_value = body.discount_value;
  if (body.max_uses !== undefined) updateData.max_uses = body.max_uses || null;
  if (body.max_uses_per_org !== undefined) updateData.max_uses_per_org = body.max_uses_per_org || 1;
  if (body.valid_until !== undefined) updateData.valid_until = body.valid_until || null;
  if (body.applicable_plans !== undefined) updateData.applicable_plans = body.applicable_plans?.length ? body.applicable_plans : null;
  if (body.min_months !== undefined) updateData.min_months = body.min_months || 1;
  if (body.is_active !== undefined) updateData.is_active = body.is_active;

  const { data, error } = await supabase
    .from("discount_codes")
    .update(updateData)
    .eq("id", codeId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update discount code: ${error.message}`);
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "update_discount_code",
    target_type: "discount_code",
    target_id: codeId,
    before_state: existing,
    after_state: data,
  });

  return data;
}

async function handleDeleteDiscountCode(supabase: SupabaseClient, auth: AuthResult, codeId: string) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can delete discount codes");
  }

  const { data: existing, error: fetchError } = await supabase
    .from("discount_codes")
    .select("*")
    .eq("id", codeId)
    .single();

  if (fetchError || !existing) {
    throw new Error("Discount code not found");
  }

  const { error } = await supabase.from("discount_codes").delete().eq("id", codeId);

  if (error) {
    throw new Error(`Failed to delete discount code: ${error.message}`);
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "delete_discount_code",
    target_type: "discount_code",
    target_id: codeId,
    before_state: existing,
    after_state: null,
  });

  return { success: true };
}

async function handleFeatureFlagsList(supabase: SupabaseClient, auth: AuthResult) {
  const { data, error } = await supabase
    .from("feature_flags")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch feature flags: ${error.message}`);
  }

  return data || [];
}

async function handleFeatureFlagOverrides(supabase: SupabaseClient, auth: AuthResult, flagId: string) {
  const { data, error } = await supabase
    .from("feature_flag_overrides")
    .select("*")
    .eq("feature_flag_id", flagId);

  if (error) {
    throw new Error(`Failed to fetch feature flag overrides: ${error.message}`);
  }

  return data || [];
}

async function handleCreateFeatureFlag(
  supabase: SupabaseClient,
  auth: AuthResult,
  body: {
    name: string;
    description?: string;
    is_enabled?: boolean;
    applies_to?: string;
    organization_ids?: string[];
  }
) {
  if (!body.name?.trim()) {
    throw new Error("Name is required");
  }

  const insertData = {
    name: body.name.trim(),
    description: body.description?.trim() || null,
    is_enabled: body.is_enabled !== false,
    applies_to: body.applies_to || "all",  // valid values: 'all' or 'specific_orgs'
    organization_ids: body.organization_ids || [],
    created_by: auth.user.id,
  };

  const { data, error } = await supabase
    .from("feature_flags")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create feature flag: ${error.message}`);
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "create_feature_flag",
    target_type: "feature_flag",
    target_id: data.id,
    before_state: null,
    after_state: insertData,
  });

  return data;
}

async function handleUpdateFeatureFlag(
  supabase: SupabaseClient,
  auth: AuthResult,
  flagId: string,
  body: {
    name?: string;
    description?: string;
    is_enabled?: boolean;
    applies_to?: string;
    organization_ids?: string[];
  }
) {
  const { data: existing, error: fetchError } = await supabase
    .from("feature_flags")
    .select("*")
    .eq("id", flagId)
    .single();

  if (fetchError || !existing) {
    throw new Error("Feature flag not found");
  }

  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (body.name !== undefined) updateData.name = body.name.trim();
  if (body.description !== undefined) updateData.description = body.description?.trim() || null;
  if (body.is_enabled !== undefined) updateData.is_enabled = body.is_enabled;
  if (body.applies_to !== undefined) updateData.applies_to = body.applies_to;
  if (body.organization_ids !== undefined) updateData.organization_ids = body.organization_ids;

  const { data, error } = await supabase
    .from("feature_flags")
    .update(updateData)
    .eq("id", flagId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update feature flag: ${error.message}`);
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "update_feature_flag",
    target_type: "feature_flag",
    target_id: flagId,
    before_state: existing,
    after_state: data,
  });

  return data;
}

async function handleToggleFeatureFlag(
  supabase: SupabaseClient,
  auth: AuthResult,
  flagId: string,
  isEnabled: boolean
) {
  const { data: existing, error: fetchError } = await supabase
    .from("feature_flags")
    .select("*")
    .eq("id", flagId)
    .single();

  if (fetchError || !existing) {
    throw new Error("Feature flag not found");
  }

  const { data, error } = await supabase
    .from("feature_flags")
    .update({ is_enabled: isEnabled, updated_at: new Date().toISOString() })
    .eq("id", flagId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to toggle feature flag: ${error.message}`);
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "toggle_feature_flag",
    target_type: "feature_flag",
    target_id: flagId,
    before_state: { is_enabled: existing.is_enabled },
    after_state: { is_enabled: isEnabled },
  });

  return data;
}

async function handleDeleteFeatureFlag(supabase: SupabaseClient, auth: AuthResult, flagId: string) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can delete feature flags");
  }

  const { data: existing, error: fetchError } = await supabase
    .from("feature_flags")
    .select("*")
    .eq("id", flagId)
    .single();

  if (fetchError || !existing) {
    throw new Error("Feature flag not found");
  }

  const { error } = await supabase.from("feature_flags").delete().eq("id", flagId);

  if (error) {
    throw new Error(`Failed to delete feature flag: ${error.message}`);
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "delete_feature_flag",
    target_type: "feature_flag",
    target_id: flagId,
    before_state: existing,
    after_state: null,
  });

  return { success: true };
}

async function handleGrantCredits(
  supabase: SupabaseClient,
  auth: AuthResult,
  body: {
    organization_id: string;
    amount: number;
    reason?: string;
  }
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can grant credits");
  }

  if (!body.organization_id?.trim()) {
    throw new Error("Organization ID is required");
  }
  if (!body.amount || body.amount <= 0) {
    throw new Error("Valid credit amount is required");
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, business_name")
    .eq("id", body.organization_id)
    .single();

  if (orgError || !org) {
    throw new Error("Organization not found");
  }

  // Use the sp_grant_credits stored procedure for proper balance tracking
  const { data, error } = await supabase.rpc("sp_grant_credits", {
    p_organization_id: body.organization_id.trim(),
    p_amount: body.amount,
    p_source: "admin_grant",
    p_description: body.reason?.trim() || "Admin credit grant",
    p_created_by: auth.user.id,
    p_source_app: "admin",
  });

  if (error) {
    throw new Error(`Failed to grant credits: ${error.message}`);
  }

  // Check if the grant was successful
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.success) {
    throw new Error(result?.error_message || "Failed to grant credits");
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "grant_credits",
    target_type: "organization",
    target_id: body.organization_id,
    before_state: null,
    after_state: { 
      amount: body.amount, 
      reason: body.reason, 
      org_name: org.business_name,
      new_balance: result.new_balance,
      transaction_id: result.transaction_id,
    },
  });

  return {
    success: true,
    amount: body.amount,
    new_balance: result.new_balance,
    transaction_id: result.transaction_id,
    organization_id: body.organization_id,
  };
}

async function handleOrganizationsList(
  supabase: SupabaseClient,
  auth: AuthResult,
  params: { search?: string; status?: string; page?: number; pageSize?: number }
) {
  const { search, status, page = 0, pageSize = 20 } = params;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("organizations")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search) {
    query = query.or(`business_name.ilike.%${search}%,slug.ilike.%${search}%,contact_email.ilike.%${search}%`);
  }

  if (status === "active") {
    query = query.eq("is_active", true);
  } else if (status === "inactive") {
    query = query.eq("is_active", false);
  }

  const { data: orgs, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch organizations: ${error.message}`);
  }

  if (!orgs || orgs.length === 0) {
    return { organizations: [], total: count || 0 };
  }

  const orgIds = orgs.map((org: any) => org.id);

  const [usersResult, listingsResult, balancesResult] = await Promise.all([
    supabase.from("user_organizations").select("organization_id").in("organization_id", orgIds),
    supabase.from("listings").select("organization_id").in("organization_id", orgIds),
    supabase.from("organization_credit_balances").select("organization_id, balance, updated_at").in("organization_id", orgIds),
  ]);

  const userCountMap = new Map<string, number>();
  const listingCountMap = new Map<string, number>();
  const balanceMap = new Map<string, { balance: number; updated_at: string }>();

  (usersResult.data || []).forEach((u: any) => {
    userCountMap.set(u.organization_id, (userCountMap.get(u.organization_id) || 0) + 1);
  });
  (listingsResult.data || []).forEach((l: any) => {
    listingCountMap.set(l.organization_id, (listingCountMap.get(l.organization_id) || 0) + 1);
  });
  (balancesResult.data || []).forEach((b: any) => {
    balanceMap.set(b.organization_id, { balance: parseFloat(b.balance || 0), updated_at: b.updated_at });
  });

  const orgsWithCounts = orgs.map((org: any) => {
    const balanceData = balanceMap.get(org.id);
    return {
      ...org,
      user_count: userCountMap.get(org.id) || 0,
      listing_count: listingCountMap.get(org.id) || 0,
      credit_balance: auth.isSuperAdmin ? (balanceData?.balance ?? 0) : null,
      credit_balance_redacted: !auth.isSuperAdmin,
    };
  });

  return { organizations: orgsWithCounts, total: count || 0 };
}

async function handleOrganizationDetail(
  supabase: SupabaseClient,
  auth: AuthResult,
  organizationId: string
) {
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", organizationId)
    .single();

  if (orgError || !org) {
    throw new Error("Organization not found");
  }

  const [usersResult, listingsResult, activeListingsResult, billingResult, userListResult] = await Promise.all([
    supabase.from("user_organizations").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).neq("role", "super_admin").neq("role", "developer"),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "For Sale"),
    supabase.from("billing_profiles").select("*").eq("organization_id", organizationId).maybeSingle(),
    supabase.from("user_organizations").select("user_id, role, created_at").eq("organization_id", organizationId).limit(10),
  ]);

  return {
    organization: org,
    stats: {
      users: usersResult.count || 0,
      listings: listingsResult.count || 0,
      activeListings: activeListingsResult.count || 0,
    },
    users: userListResult.data || [],
    billing_profile: billingResult.data,
  };
}

async function handleOrganizationBilling(
  supabase: SupabaseClient,
  auth: AuthResult,
  organizationId: string
) {
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, business_name, account_status, trial_ends_at, grace_period_ends_at")
    .eq("id", organizationId)
    .single();

  if (orgError || !org) {
    throw new Error("Organization not found");
  }

  const { data: billingProfile } = await supabase
    .from("billing_profiles")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  return {
    organization_id: organizationId,
    organization_name: org.business_name,
    account_status: org.account_status,
    trial_ends_at: org.trial_ends_at,
    grace_period_ends_at: org.grace_period_ends_at,
    billing_profile: billingProfile,
  };
}

async function handleChangePlan(
  supabase: SupabaseClient,
  auth: AuthResult,
  organizationId: string,
  body: { plan: string; is_sponsored?: boolean; sponsored_reason?: string }
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can change organization plans");
  }

  const { plan, is_sponsored, sponsored_reason } = body;
  if (!plan || !["starter", "pro"].includes(plan)) {
    throw new Error("Invalid plan. Must be 'starter' or 'pro'");
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, business_name")
    .eq("id", organizationId)
    .single();

  if (orgError || !org) {
    throw new Error("Organization not found");
  }

  const { data: existingProfile } = await supabase
    .from("billing_profiles")
    .select("subscription_plan, is_sponsored, sponsored_reason")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const previousState = {
    subscription_plan: existingProfile?.subscription_plan || null,
    is_sponsored: existingProfile?.is_sponsored || false,
    sponsored_reason: existingProfile?.sponsored_reason || null,
  };

  const updateData = {
    subscription_plan: plan,
    is_sponsored: is_sponsored ?? false,
    sponsored_reason: is_sponsored ? (sponsored_reason || null) : null,
    updated_at: new Date().toISOString(),
  };

  if (existingProfile) {
    const { error: updateError } = await supabase
      .from("billing_profiles")
      .update(updateData)
      .eq("organization_id", organizationId);

    if (updateError) {
      throw new Error(`Failed to update plan: ${updateError.message}`);
    }
  } else {
    const { error: insertError } = await supabase
      .from("billing_profiles")
      .insert({
        organization_id: organizationId,
        subscription_plan: plan,
        subscription_status: "active",
        is_sponsored: is_sponsored ?? false,
        sponsored_reason: is_sponsored ? (sponsored_reason || null) : null,
      });

    if (insertError) {
      throw new Error(`Failed to create billing profile: ${insertError.message}`);
    }
  }

  const newState = {
    subscription_plan: plan,
    is_sponsored: is_sponsored ?? false,
    sponsored_reason: is_sponsored ? (sponsored_reason || null) : null,
  };

  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "change_plan",
    target_type: "organization",
    target_id: organizationId,
    before_state: previousState,
    after_state: newState,
    metadata: { organization_name: org.business_name },
  });

  return {
    success: true,
    organization_id: organizationId,
    previous_plan: previousState.subscription_plan,
    new_plan: plan,
    is_sponsored: is_sponsored ?? false,
    sponsored_reason: is_sponsored ? (sponsored_reason || null) : null,
  };
}

async function handleOrganizationCredits(
  supabase: SupabaseClient,
  auth: AuthResult,
  organizationId: string
) {
  if (!auth.isSuperAdmin) {
    return { redacted: true, reason: "Credit data restricted to super admins" };
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, business_name")
    .eq("id", organizationId)
    .single();

  if (orgError || !org) {
    throw new Error("Organization not found");
  }

  const [balanceResult, transactionsResult, usageTimelineResult] = await Promise.all([
    supabase
      .from("organization_credit_balances")
      .select("balance, updated_at")
      .eq("organization_id", organizationId)
      .single(),
    supabase
      .from("credit_transactions")
      .select("id, amount, type, description, source, created_at, created_by")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("credit_transactions")
      .select("amount, type, created_at")
      .eq("organization_id", organizationId)
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: true }),
  ]);

  const balance = parseFloat(balanceResult.data?.balance || "0");
  const balanceUpdatedAt = balanceResult.data?.updated_at || null;

  const transactions = (transactionsResult.data || []).map((t: any) => ({
    id: t.id,
    amount: parseFloat(t.amount),
    type: t.type,
    description: t.description,
    source: t.source,
    created_at: t.created_at,
    created_by: t.created_by,
  }));

  // Find last positive transaction (grant/purchase/credit) - use amount > 0 as primary check
  // since transaction types vary (credit, grant, purchase, etc.)
  const lastTopUp = transactions.find((t: any) => t.amount > 0);

  const totalUsed = transactions
    .filter((t: any) => t.amount < 0)
    .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);

  const totalGranted = transactions
    .filter((t: any) => t.amount > 0)
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  const usageTimeline = buildWeeklyTimeline(usageTimelineResult.data || []);

  return {
    organization_id: organizationId,
    organization_name: org.business_name,
    balance,
    balance_updated_at: balanceUpdatedAt,
    last_top_up: lastTopUp ? {
      amount: lastTopUp.amount,
      date: lastTopUp.created_at,
      description: lastTopUp.description,
    } : null,
    total_granted: totalGranted,
    total_used: totalUsed,
    usage_timeline: usageTimeline,
    transactions,
  };
}

function buildWeeklyTimeline(transactions: any[]) {
  const weeks: Record<string, { credits: number; debits: number }> = {};
  
  transactions.forEach((t) => {
    const date = new Date(t.created_at);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split("T")[0];
    
    if (!weeks[weekKey]) {
      weeks[weekKey] = { credits: 0, debits: 0 };
    }
    
    const amount = parseFloat(t.amount);
    if (t.type === "credit" || amount > 0) {
      weeks[weekKey].credits += Math.abs(amount);
    } else {
      weeks[weekKey].debits += Math.abs(amount);
    }
  });

  return Object.entries(weeks)
    .map(([week, data]) => ({ week, ...data }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

async function handleUsersList(
  supabase: SupabaseClient,
  auth: AuthResult,
  params: { search?: string; role?: string; page?: number; pageSize?: number }
) {
  const { search, role, page = 0, pageSize = 20 } = params;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("user_roles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search) {
    query = query.ilike("user_id", `%${search}%`);
  }

  if (role && role !== "all") {
    query = query.eq("role", role);
  }

  const { data: userRoles, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  if (!userRoles || userRoles.length === 0) {
    return { users: [], total: count || 0 };
  }

  const userIds = userRoles.map((u: any) => u.user_id);

  // Fetch user details (email, name) from auth.users in batches
  const userDetailsMap = new Map<string, { email: string | null; name: string | null }>();
  
  // Process in batches of 50 to avoid rate limits
  const batchSize = 50;
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batchIds = userIds.slice(i, i + batchSize);
    for (const userId of batchIds) {
      try {
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
        if (!userError && userData?.user) {
          const user = userData.user;
          const name = user.user_metadata?.full_name || 
                      user.user_metadata?.name || 
                      user.raw_user_meta_data?.full_name ||
                      user.raw_user_meta_data?.name ||
                      null;
          userDetailsMap.set(userId, {
            email: user.email || null,
            name: name,
          });
        }
      } catch (e) {
        // Skip individual user errors
        console.warn(`Failed to fetch details for user ${userId}:`, e);
      }
    }
  }

  const { data: allOrgLinks } = await supabase
    .from("user_organizations")
    .select("user_id, organization_id, role")
    .in("user_id", userIds);

  const orgIds = [...new Set((allOrgLinks || []).map((l: any) => l.organization_id))];

  const { data: orgsData } = await supabase
    .from("organizations")
    .select("id, business_name")
    .in("id", orgIds.length > 0 ? orgIds : ["__none__"]);

  const orgNameMap = new Map<string, string>();
  (orgsData || []).forEach((org: any) => {
    orgNameMap.set(org.id, org.business_name);
  });

  const userOrgMap = new Map<string, any[]>();
  (allOrgLinks || []).forEach((link: any) => {
    const orgs = userOrgMap.get(link.user_id) || [];
    orgs.push({
      user_id: link.user_id,
      organization_id: link.organization_id,
      role: link.role,
      organization_name: orgNameMap.get(link.organization_id),
    });
    userOrgMap.set(link.user_id, orgs);
  });

  const usersWithOrgs = userRoles.map((user: any) => {
    const details = userDetailsMap.get(user.user_id);
    return {
      ...user,
      email: details?.email || null,
      name: details?.name || null,
      organizations: userOrgMap.get(user.user_id) || [],
    };
  });

  return { users: usersWithOrgs, total: count || 0 };
}

async function handleBulkUserAction(
  supabase: SupabaseClient,
  auth: AuthResult,
  body: { userIds: string[]; action: string; reason?: string }
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can perform bulk user actions");
  }

  const { userIds, action, reason } = body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throw new Error("At least one user ID is required");
  }

  if (userIds.length > 50) {
    throw new Error("Maximum 50 users per bulk action");
  }

  if (!["suspend", "unsuspend"].includes(action)) {
    throw new Error("Invalid action. Must be 'suspend' or 'unsuspend'");
  }

  const results: { userId: string; success: boolean; error?: string }[] = [];

  for (const userId of userIds) {
    try {
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          suspended: action === "suspend",
          suspended_at: action === "suspend" ? new Date().toISOString() : null,
          suspended_reason: action === "suspend" ? (reason || "Suspended by admin") : null,
          suspended_by: action === "suspend" ? auth.user.id : null,
        },
      });

      if (error) {
        results.push({ userId, success: false, error: error.message });
      } else {
        results.push({ userId, success: true });

        await supabase.from("admin_audit_log").insert({
          actor_id: auth.user.id,
          action_type: action === "suspend" ? "suspend_user" : "unsuspend_user",
          target_type: "user",
          target_id: userId,
          metadata: { reason: reason || null, bulk_action: true },
        });
      }
    } catch (e: any) {
      results.push({ userId, success: false, error: e.message });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return {
    success: failCount === 0,
    message: `${successCount} users ${action}ed successfully${failCount > 0 ? `, ${failCount} failed` : ""}`,
    results,
  };
}

async function handleDeleteUsers(
  supabase: SupabaseClient,
  auth: AuthResult,
  body: { userIds: string[] }
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can delete users");
  }

  const { userIds } = body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throw new Error("At least one user ID is required");
  }

  if (userIds.length > 50) {
    throw new Error("Maximum 50 users per delete operation");
  }

  // Prevent self-deletion
  if (userIds.includes(auth.user.id)) {
    throw new Error("Cannot delete your own account");
  }

  const results: { userId: string; success: boolean; error?: string }[] = [];

  for (const userId of userIds) {
    try {
      // Get user details before deletion for audit log
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      const userEmail = userData?.user?.email || "unknown";

      // Delete from user_organizations first (foreign key constraint)
      await supabase
        .from("user_organizations")
        .delete()
        .eq("user_id", userId);

      // Delete from user_roles
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      // Delete from admin_notes if exists
      await supabase
        .from("admin_notes")
        .delete()
        .eq("target_id", userId);

      // Delete the user from auth
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

      if (deleteError) {
        results.push({ userId, success: false, error: deleteError.message });
      } else {
        results.push({ userId, success: true });

        // Log the deletion
        await supabase.from("admin_audit_log").insert({
          actor_id: auth.user.id,
          action_type: "delete_user",
          target_type: "user",
          target_id: userId,
          metadata: { 
            deleted_user_email: userEmail,
            permanent: true 
          },
        });
      }
    } catch (e: any) {
      results.push({ userId, success: false, error: e.message });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return {
    success: failCount === 0,
    message: `${successCount} user${successCount !== 1 ? 's' : ''} deleted permanently${failCount > 0 ? `, ${failCount} failed` : ""}`,
    results,
  };
}

async function handleChangeUserRole(
  supabase: SupabaseClient,
  auth: AuthResult,
  body: { userId: string; newRole: string }
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can change user roles");
  }

  const { userId, newRole } = body;

  if (!userId) {
    throw new Error("User ID is required");
  }

  const validRoles = ["super_admin", "developer", "admin", "user"];
  if (!validRoles.includes(newRole)) {
    throw new Error(`Invalid role. Must be one of: ${validRoles.join(", ")}`);
  }

  // Prevent changing own role
  if (userId === auth.user.id) {
    throw new Error("Cannot change your own role");
  }

  // Get user details
  const { data: userData } = await supabase.auth.admin.getUserById(userId);
  if (!userData?.user) {
    throw new Error("User not found");
  }

  // Get current role
  const { data: currentRoleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  const previousRole = currentRoleData?.role || "user";

  // Update or insert role in user_roles table
  let roleError;
  if (currentRoleData) {
    // Update existing role
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole })
      .eq("user_id", userId);
    roleError = error;
  } else {
    // Insert new role
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: newRole });
    roleError = error;
  }

  if (roleError) {
    throw new Error(`Failed to update role: ${roleError.message}`);
  }

  // Also update role in user_organizations for all orgs the user is in
  await supabase
    .from("user_organizations")
    .update({ role: newRole === "super_admin" || newRole === "developer" ? "admin" : newRole })
    .eq("user_id", userId);

  // Log the role change
  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "change_user_role",
    target_type: "user",
    target_id: userId,
    before_state: { role: previousRole },
    after_state: { role: newRole },
    metadata: { 
      user_email: userData.user.email,
    },
  });

  return {
    success: true,
    message: `User role changed from ${previousRole} to ${newRole}`,
    previousRole,
    newRole,
  };
}

async function handleStartImpersonation(
  supabase: SupabaseClient,
  auth: AuthResult,
  body: { organizationId: string; reason?: string }
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can start impersonation");
  }

  const { organizationId, reason } = body;

  if (!organizationId) {
    throw new Error("Organization ID is required");
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id, business_name")
    .eq("id", organizationId)
    .single();

  if (!org) {
    throw new Error("Organization not found");
  }

  const { data: session, error: sessionError } = await supabase
    .from("impersonation_sessions")
    .insert({
      super_admin_id: auth.user.id,
      organization_id: organizationId,
      reason: reason || "Support/debugging",
    })
    .select()
    .single();

  if (sessionError) {
    throw new Error(`Failed to start impersonation: ${sessionError.message}`);
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "impersonate_user",
    target_type: "organization",
    target_id: organizationId,
    metadata: { reason: reason || "Support/debugging", session_id: session.id },
  });

  return {
    success: true,
    session_id: session.id,
    organization_name: org.business_name,
  };
}

async function handleEndImpersonation(
  supabase: SupabaseClient,
  auth: AuthResult,
  body: { sessionId?: string; organizationId?: string }
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can end impersonation");
  }

  // Verify there's an active session for this user before ending
  const { data: activeSession } = await supabase
    .from("impersonation_sessions")
    .select("id, organization_id")
    .eq("super_admin_id", auth.user.id)
    .is("ended_at", null)
    .single();

  if (!activeSession) {
    return { success: true, message: "No active impersonation session" };
  }

  const { error } = await supabase.rpc("end_impersonation_session");

  if (error) {
    throw new Error(`Failed to end impersonation: ${error.message}`);
  }

  // Log with verified session data from database
  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "end_impersonation",
    target_type: "organization",
    target_id: activeSession.organization_id,
    metadata: { session_id: activeSession.id },
  });

  return { success: true };
}

async function handleAlertRulesList(supabase: SupabaseClient, auth: AuthResult) {
  const { data, error } = await supabase
    .from("admin_alert_rules")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch alert rules: ${error.message}`);
  }

  return data || [];
}

async function handleAlertHistory(supabase: SupabaseClient, auth: AuthResult, limit: number) {
  const { data, error } = await supabase
    .from("admin_alert_history")
    .select("*")
    .order("triggered_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch alert history: ${error.message}`);
  }

  return data || [];
}

async function handleCreateAlertRule(
  supabase: SupabaseClient,
  auth: AuthResult,
  body: {
    name: string;
    description?: string;
    metric_type: string;
    condition: string;
    threshold: number;
    time_window_minutes?: number;
    notification_channels?: string[];
    is_enabled?: boolean;
  }
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can create alert rules");
  }

  if (!body.name?.trim()) {
    throw new Error("Alert rule name is required");
  }
  if (!body.metric_type?.trim()) {
    throw new Error("Metric type is required");
  }
  if (!body.condition?.trim()) {
    throw new Error("Condition is required");
  }
  if (body.threshold === undefined) {
    throw new Error("Threshold is required");
  }

  const ruleData = {
    name: body.name.trim(),
    description: body.description?.trim() || null,
    metric_type: body.metric_type.trim(),
    condition: body.condition.trim(),
    threshold: body.threshold,
    time_window_minutes: body.time_window_minutes || 60,
    notification_channels: body.notification_channels || ["email"],
    is_enabled: body.is_enabled !== false,
    created_by: auth.user.id,
  };

  const { data, error } = await supabase
    .from("admin_alert_rules")
    .insert(ruleData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create alert rule: ${error.message}`);
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "create_alert_rule",
    target_type: "alert_rule",
    target_id: data.id,
    before_state: null,
    after_state: data,
  });

  return data;
}

async function handleUpdateAlertRule(
  supabase: SupabaseClient,
  auth: AuthResult,
  ruleId: string,
  body: Partial<{
    name: string;
    description: string;
    metric_type: string;
    condition: string;
    threshold: number;
    time_window_minutes: number;
    notification_channels: string[];
    is_enabled: boolean;
  }>
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can update alert rules");
  }

  const { data: existing, error: fetchError } = await supabase
    .from("admin_alert_rules")
    .select("*")
    .eq("id", ruleId)
    .single();

  if (fetchError || !existing) {
    throw new Error("Alert rule not found");
  }

  const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updateData.name = body.name.trim();
  if (body.description !== undefined) updateData.description = body.description?.trim() || null;
  if (body.metric_type !== undefined) updateData.metric_type = body.metric_type.trim();
  if (body.condition !== undefined) updateData.condition = body.condition.trim();
  if (body.threshold !== undefined) updateData.threshold = body.threshold;
  if (body.time_window_minutes !== undefined) updateData.time_window_minutes = body.time_window_minutes;
  if (body.notification_channels !== undefined) updateData.notification_channels = body.notification_channels;
  if (body.is_enabled !== undefined) updateData.is_enabled = body.is_enabled;

  const { data, error } = await supabase
    .from("admin_alert_rules")
    .update(updateData)
    .eq("id", ruleId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update alert rule: ${error.message}`);
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "update_alert_rule",
    target_type: "alert_rule",
    target_id: ruleId,
    before_state: existing,
    after_state: data,
  });

  return data;
}

async function handleDeleteAlertRule(
  supabase: SupabaseClient,
  auth: AuthResult,
  ruleId: string
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can delete alert rules");
  }

  const { data: existing, error: fetchError } = await supabase
    .from("admin_alert_rules")
    .select("*")
    .eq("id", ruleId)
    .single();

  if (fetchError || !existing) {
    throw new Error("Alert rule not found");
  }

  const { error } = await supabase.from("admin_alert_rules").delete().eq("id", ruleId);

  if (error) {
    throw new Error(`Failed to delete alert rule: ${error.message}`);
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "delete_alert_rule",
    target_type: "alert_rule",
    target_id: ruleId,
    before_state: existing,
    after_state: null,
  });

  return { success: true };
}

async function handleAuditLogList(
  supabase: SupabaseClient,
  auth: AuthResult,
  params: { search?: string; actionType?: string; limit?: number; offset?: number }
) {
  const { search, actionType, limit = 50, offset = 0 } = params;

  let query = supabase
    .from("admin_audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (actionType && actionType !== "all") {
    query = query.ilike("action_type", `%${actionType}%`);
  }

  if (search) {
    query = query.or(`action_type.ilike.%${search}%,target_type.ilike.%${search}%,target_id.ilike.%${search}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch audit logs: ${error.message}`);
  }

  const enrichedLogs = await Promise.all(
    (data || []).map(async (log) => {
      let actorEmail = null;
      if (log.actor_id) {
        const { data: actor } = await supabase.auth.admin.getUserById(log.actor_id);
        actorEmail = actor?.user?.email || null;
      }
      return { ...log, actor_email: actorEmail };
    })
  );

  return {
    logs: enrichedLogs,
    total: count || 0,
    limit,
    offset,
  };
}

const ALERT_TEST_LIMIT = 5;
const ALERT_TEST_WINDOW_MINUTES = 1;

async function checkAlertTestRateLimit(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - ALERT_TEST_WINDOW_MINUTES * 60 * 1000).toISOString();
  
  const { count, error } = await supabase
    .from("admin_audit_log")
    .select("id", { count: "exact", head: true })
    .eq("actor_id", userId)
    .eq("action_type", "test_alert")
    .gte("created_at", windowStart);
  
  if (error) {
    console.error("Rate limit check error:", error);
    return true;
  }
  
  return (count || 0) < ALERT_TEST_LIMIT;
}

async function handleTestAlert(
  supabase: SupabaseClient,
  auth: AuthResult,
  ruleId: string
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can test alert rules");
  }

  const withinLimit = await checkAlertTestRateLimit(supabase, auth.user.id);
  if (!withinLimit) {
    throw new Error(`Rate limit exceeded. Maximum ${ALERT_TEST_LIMIT} test alerts per minute.`);
  }

  const { data: rule, error: fetchError } = await supabase
    .from("admin_alert_rules")
    .select("*")
    .eq("id", ruleId)
    .single();

  if (fetchError || !rule) {
    throw new Error("Alert rule not found");
  }

  const testEntry = {
    rule_id: rule.id,
    rule_name: rule.name,
    metric_type: rule.metric_type,
    metric_value: rule.threshold,
    threshold: rule.threshold,
    condition: rule.condition,
    notification_channels: rule.notification_channels,
    notification_status: "sent",
    triggered_at: new Date().toISOString(),
  };

  const { error: insertError } = await supabase
    .from("admin_alert_history")
    .insert(testEntry);

  if (insertError) {
    throw new Error(`Failed to log test alert: ${insertError.message}`);
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "test_alert",
    target_type: "alert_rule",
    target_id: ruleId,
    after_state: { rule_name: rule.name, channels: rule.notification_channels },
  });

  return { success: true };
}

// Usage Rates Management
async function handleUsageRatesList(supabase: SupabaseClient, auth: AuthResult) {
  const { data, error } = await supabase
    .from("usage_rates")
    .select("*")
    .order("feature_type");

  if (error) {
    throw new Error(`Failed to fetch usage rates: ${error.message}`);
  }

  return data || [];
}

async function handleUpdateUsageRate(
  supabase: SupabaseClient,
  auth: AuthResult,
  featureType: string,
  body: { credits_per_use: number; description?: string }
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can update usage rates");
  }

  const { credits_per_use, description } = body;

  if (typeof credits_per_use !== "number" || credits_per_use < 0) {
    throw new Error("credits_per_use must be a non-negative number");
  }

  // Get current state for audit log
  const { data: currentRate } = await supabase
    .from("usage_rates")
    .select("*")
    .eq("feature_type", featureType)
    .single();

  const updateData: Record<string, any> = {
    credits_per_use,
    updated_at: new Date().toISOString(),
  };

  if (description !== undefined) {
    updateData.description = description;
  }

  const { data, error } = await supabase
    .from("usage_rates")
    .update(updateData)
    .eq("feature_type", featureType)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update usage rate: ${error.message}`);
  }

  // Audit log
  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "update_usage_rate",
    target_type: "usage_rate",
    target_id: featureType,
    before_state: currentRate,
    after_state: data,
  });

  return data;
}

async function handleCreateUsageRate(
  supabase: SupabaseClient,
  auth: AuthResult,
  body: { feature_type: string; credits_per_use: number; description?: string }
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can create usage rates");
  }

  const { feature_type, credits_per_use, description } = body;

  if (!feature_type || typeof credits_per_use !== "number" || credits_per_use < 0) {
    throw new Error("feature_type and valid credits_per_use are required");
  }

  const { data, error } = await supabase
    .from("usage_rates")
    .insert({
      feature_type,
      credits_per_use,
      description: description || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create usage rate: ${error.message}`);
  }

  // Audit log
  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "create_usage_rate",
    target_type: "usage_rate",
    target_id: feature_type,
    after_state: data,
  });

  return data;
}

async function handleDeleteUsageRate(
  supabase: SupabaseClient,
  auth: AuthResult,
  featureType: string
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can delete usage rates");
  }

  // Get current state for audit log
  const { data: currentRate } = await supabase
    .from("usage_rates")
    .select("*")
    .eq("feature_type", featureType)
    .single();

  const { error } = await supabase
    .from("usage_rates")
    .delete()
    .eq("feature_type", featureType);

  if (error) {
    throw new Error(`Failed to delete usage rate: ${error.message}`);
  }

  // Audit log
  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "delete_usage_rate",
    target_type: "usage_rate",
    target_id: featureType,
    before_state: currentRate,
  });

  return { success: true };
}

// AI Instructions Management
interface AIInstructionFilters {
  feature_type?: string;
  scope?: string;
  organization_id?: string;
  is_active?: boolean;
}

async function handleAIInstructionsList(
  supabase: SupabaseClient,
  auth: AuthResult,
  filters: AIInstructionFilters = {}
) {
  let query = supabase
    .from("ai_instruction_sets")
    .select("*")
    .order("feature_type")
    .order("scope")
    .order("priority", { ascending: false });

  if (filters.feature_type) {
    query = query.eq("feature_type", filters.feature_type);
  }
  if (filters.scope) {
    query = query.eq("scope", filters.scope);
  }
  if (filters.organization_id) {
    query = query.eq("organization_id", filters.organization_id);
  }
  if (filters.is_active !== undefined) {
    query = query.eq("is_active", filters.is_active);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch AI instructions: ${error.message}`);
  }

  return data || [];
}

async function handleAIInstructionDetail(
  supabase: SupabaseClient,
  auth: AuthResult,
  instructionId: string
) {
  const { data, error } = await supabase
    .from("ai_instruction_sets")
    .select("*")
    .eq("id", instructionId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch AI instruction: ${error.message}`);
  }

  return data;
}

async function handleCreateAIInstruction(
  supabase: SupabaseClient,
  auth: AuthResult,
  body: {
    feature_type: string;
    scope?: string;
    organization_id?: string;
    locale?: string;
    name: string;
    description?: string;
    banned_phrases?: string[];
    tone_guidelines?: string[];
    freeform_instructions?: string;
    is_active?: boolean;
    priority?: number;
  }
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can create AI instructions");
  }

  if (!body.feature_type || !body.name?.trim()) {
    throw new Error("feature_type and name are required");
  }

  const scope = body.scope || "global";
  if (scope === "organization" && !body.organization_id) {
    throw new Error("organization_id is required for organization-scoped instructions");
  }
  if (scope === "global" && body.organization_id) {
    throw new Error("organization_id must not be set for global instructions");
  }

  const insertData = {
    feature_type: body.feature_type,
    scope,
    organization_id: body.organization_id || null,
    locale: body.locale || null,
    name: body.name.trim(),
    description: body.description?.trim() || null,
    banned_phrases: body.banned_phrases || [],
    tone_guidelines: body.tone_guidelines || [],
    freeform_instructions: body.freeform_instructions?.trim() || null,
    is_active: body.is_active !== false,
    priority: body.priority || 0,
    created_by: auth.user.id,
  };

  const { data, error } = await supabase
    .from("ai_instruction_sets")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create AI instruction: ${error.message}`);
  }

  // Record history
  await supabase.from("ai_instruction_history").insert({
    instruction_set_id: data.id,
    action: "created",
    after_state: insertData,
    changed_by: auth.user.id,
  });

  // Audit log
  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "create_ai_instruction",
    target_type: "ai_instruction",
    target_id: data.id,
    after_state: insertData,
  });

  return data;
}

async function handleUpdateAIInstruction(
  supabase: SupabaseClient,
  auth: AuthResult,
  instructionId: string,
  body: {
    name?: string;
    description?: string;
    banned_phrases?: string[];
    tone_guidelines?: string[];
    freeform_instructions?: string;
    is_active?: boolean;
    priority?: number;
    locale?: string;
    change_reason?: string;
  }
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can update AI instructions");
  }

  // Get current state
  const { data: existing, error: fetchError } = await supabase
    .from("ai_instruction_sets")
    .select("*")
    .eq("id", instructionId)
    .single();

  if (fetchError || !existing) {
    throw new Error("AI instruction not found");
  }

  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (body.name !== undefined) updateData.name = body.name.trim();
  if (body.description !== undefined) updateData.description = body.description?.trim() || null;
  if (body.banned_phrases !== undefined) updateData.banned_phrases = body.banned_phrases;
  if (body.tone_guidelines !== undefined) updateData.tone_guidelines = body.tone_guidelines;
  if (body.freeform_instructions !== undefined) updateData.freeform_instructions = body.freeform_instructions?.trim() || null;
  if (body.is_active !== undefined) updateData.is_active = body.is_active;
  if (body.priority !== undefined) updateData.priority = body.priority;
  if (body.locale !== undefined) updateData.locale = body.locale || null;

  const { data, error } = await supabase
    .from("ai_instruction_sets")
    .update(updateData)
    .eq("id", instructionId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update AI instruction: ${error.message}`);
  }

  // Determine action type for history
  let action = "updated";
  if (body.is_active !== undefined && body.is_active !== existing.is_active) {
    action = body.is_active ? "activated" : "deactivated";
  }

  // Record history
  await supabase.from("ai_instruction_history").insert({
    instruction_set_id: instructionId,
    action,
    before_state: existing,
    after_state: data,
    changed_by: auth.user.id,
    change_reason: body.change_reason || null,
  });

  // Audit log
  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "update_ai_instruction",
    target_type: "ai_instruction",
    target_id: instructionId,
    before_state: existing,
    after_state: data,
  });

  return data;
}

async function handleDeleteAIInstruction(
  supabase: SupabaseClient,
  auth: AuthResult,
  instructionId: string
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can delete AI instructions");
  }

  // Get current state
  const { data: existing, error: fetchError } = await supabase
    .from("ai_instruction_sets")
    .select("*")
    .eq("id", instructionId)
    .single();

  if (fetchError || !existing) {
    throw new Error("AI instruction not found");
  }

  // Record history before deletion (history table has ON DELETE CASCADE but we want the record)
  await supabase.from("ai_instruction_history").insert({
    instruction_set_id: instructionId,
    action: "deleted",
    before_state: existing,
    changed_by: auth.user.id,
  });

  const { error } = await supabase
    .from("ai_instruction_sets")
    .delete()
    .eq("id", instructionId);

  if (error) {
    throw new Error(`Failed to delete AI instruction: ${error.message}`);
  }

  // Audit log
  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "delete_ai_instruction",
    target_type: "ai_instruction",
    target_id: instructionId,
    before_state: existing,
  });

  return { success: true };
}

async function handleAIInstructionHistory(
  supabase: SupabaseClient,
  auth: AuthResult,
  instructionId: string,
  limit = 50
) {
  const { data, error } = await supabase
    .from("ai_instruction_history")
    .select("*")
    .eq("instruction_set_id", instructionId)
    .order("changed_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch AI instruction history: ${error.message}`);
  }

  return data || [];
}

async function handleDuplicateAIInstruction(
  supabase: SupabaseClient,
  auth: AuthResult,
  instructionId: string,
  body: {
    name?: string;
    organization_id?: string;
    locale?: string;
  }
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can duplicate AI instructions");
  }

  // Get source instruction
  const { data: source, error: fetchError } = await supabase
    .from("ai_instruction_sets")
    .select("*")
    .eq("id", instructionId)
    .single();

  if (fetchError || !source) {
    throw new Error("Source AI instruction not found");
  }

  // Determine scope based on organization_id
  const hasOrgId = !!body.organization_id;
  const scope = hasOrgId ? "organization" : "global";

  const insertData = {
    feature_type: source.feature_type,
    scope,
    organization_id: body.organization_id || null,
    locale: body.locale !== undefined ? body.locale : source.locale,
    name: body.name?.trim() || `${source.name} (Copy)`,
    description: source.description,
    banned_phrases: source.banned_phrases,
    tone_guidelines: source.tone_guidelines,
    freeform_instructions: source.freeform_instructions,
    is_active: false, // Start inactive
    priority: source.priority,
    created_by: auth.user.id,
  };

  const { data, error } = await supabase
    .from("ai_instruction_sets")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to duplicate AI instruction: ${error.message}`);
  }

  // Record history
  await supabase.from("ai_instruction_history").insert({
    instruction_set_id: data.id,
    action: "created",
    after_state: { ...insertData, duplicated_from: instructionId },
    changed_by: auth.user.id,
    change_reason: `Duplicated from instruction ${source.name}`,
  });

  // Audit log
  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "duplicate_ai_instruction",
    target_type: "ai_instruction",
    target_id: data.id,
    before_state: { source_id: instructionId },
    after_state: insertData,
  });

  return data;
}

// Video Music Tracks Management
async function handleVideoMusicTracksList(
  supabase: SupabaseClient,
  auth: AuthResult
) {
  // List files from the music-tracks storage bucket
  const { data: storageFiles, error: storageError } = await supabase.storage
    .from("music-tracks")
    .list("tracks", { limit: 500, sortBy: { column: "created_at", order: "desc" } });

  if (storageError) {
    console.error("Storage list error:", storageError);
    // Fall back to metadata table only
  }

  // Get metadata from database table (if it exists)
  const { data: metadataRecords, error: metaError } = await supabase
    .from("video_music_tracks")
    .select("*")
    .order("created_at", { ascending: false });

  // Create a map of storage_path to metadata
  const metadataMap = new Map<string, any>();
  if (metadataRecords) {
    for (const record of metadataRecords) {
      metadataMap.set(record.storage_path, record);
    }
  }

  // Combine storage files with metadata
  const tracks: any[] = [];
  
  if (storageFiles && storageFiles.length > 0) {
    for (const file of storageFiles) {
      if (!file.name || file.name === ".emptyFolderPlaceholder") continue;
      
      const storagePath = `tracks/${file.name}`;
      const metadata = metadataMap.get(storagePath);
      
      // Extract name from filename (format: timestamp-name.ext)
      const nameParts = file.name.split("-");
      const displayName = nameParts.length > 1 
        ? nameParts.slice(1).join("-").replace(/\.[^/.]+$/, "") 
        : file.name.replace(/\.[^/.]+$/, "");
      
      tracks.push({
        id: metadata?.id || storagePath, // Use metadata ID or storage path as ID
        name: metadata?.name || displayName,
        description: metadata?.description || null,
        storage_path: storagePath,
        file_name: file.name,
        file_size_bytes: file.metadata?.size || 0,
        duration_seconds: metadata?.duration_seconds || null,
        genre: metadata?.genre || null,
        mood: metadata?.mood || null,
        tags: metadata?.tags || [],
        is_active: metadata?.is_active ?? true,
        created_at: metadata?.created_at || file.created_at || new Date().toISOString(),
        has_metadata: !!metadata,
      });
      
      // Remove from map to track which metadata records don't have files
      if (metadata) {
        metadataMap.delete(storagePath);
      }
    }
  }

  // Add any metadata records that don't have corresponding storage files (orphaned metadata)
  // These would show as "missing file" in the UI
  for (const [storagePath, metadata] of metadataMap) {
    tracks.push({
      ...metadata,
      has_metadata: true,
      file_missing: true,
    });
  }

  return tracks;
}

async function handleCreateVideoMusicTrack(
  supabase: SupabaseClient,
  auth: AuthResult,
  body: {
    name: string;
    description?: string;
    storage_path: string;
    file_name: string;
    file_size_bytes?: number;
    duration_seconds?: number;
    genre?: string;
    mood?: string;
    tags?: string[];
  }
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can create video music tracks");
  }

  if (!body.name?.trim() || !body.storage_path?.trim() || !body.file_name?.trim()) {
    throw new Error("name, storage_path, and file_name are required");
  }

  const { data, error } = await supabase
    .from("video_music_tracks")
    .insert({
      name: body.name.trim(),
      description: body.description?.trim() || null,
      storage_path: body.storage_path.trim(),
      file_name: body.file_name.trim(),
      file_size_bytes: body.file_size_bytes || null,
      duration_seconds: body.duration_seconds || null,
      genre: body.genre?.trim() || null,
      mood: body.mood?.trim() || null,
      tags: body.tags || [],
      is_active: true,
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create video music track: ${error.message}`);
  }

  // Audit log
  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "create_video_music_track",
    target_type: "video_music_track",
    target_id: data.id,
    after_state: data,
  });

  return data;
}

async function handleUpdateVideoMusicTrack(
  supabase: SupabaseClient,
  auth: AuthResult,
  trackId: string,
  body: Partial<{
    name: string;
    description: string;
    genre: string;
    mood: string;
    tags: string[];
    is_active: boolean;
    storage_path: string;
    file_name: string;
  }>
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can update video music tracks");
  }

  // Check if trackId is a UUID (existing metadata record) or a storage path (storage-only track)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trackId);
  
  if (isUUID) {
    // Update existing metadata record
    const { data: currentTrack } = await supabase
      .from("video_music_tracks")
      .select("*")
      .eq("id", trackId)
      .single();

    const updateData: Record<string, any> = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.genre !== undefined) updateData.genre = body.genre?.trim() || null;
    if (body.mood !== undefined) updateData.mood = body.mood?.trim() || null;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    const { data, error } = await supabase
      .from("video_music_tracks")
      .update(updateData)
      .eq("id", trackId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update video music track: ${error.message}`);
    }

    // Audit log
    await supabase.from("admin_audit_log").insert({
      actor_id: auth.user.id,
      action_type: "update_video_music_track",
      target_type: "video_music_track",
      target_id: trackId,
      before_state: currentTrack,
      after_state: data,
    });

    return data;
  } else {
    // trackId is a storage path - need to CREATE a new metadata record
    // This happens when editing a track that only exists in storage (no metadata in DB yet)
    const storagePath = trackId;
    
    // Extract file_name from storage path
    const fileName = body.file_name || storagePath.split("/").pop() || storagePath;
    
    // Extract display name from filename if not provided
    const nameParts = fileName.split("-");
    const defaultName = nameParts.length > 1 
      ? nameParts.slice(1).join("-").replace(/\.[^/.]+$/, "") 
      : fileName.replace(/\.[^/.]+$/, "");
    
    const insertData = {
      name: body.name?.trim() || defaultName,
      description: body.description?.trim() || null,
      storage_path: storagePath,
      file_name: fileName,
      genre: body.genre?.trim() || null,
      mood: body.mood?.trim() || null,
      tags: body.tags || [],
      is_active: body.is_active ?? true,
      created_by: auth.user.id,
    };

    const { data, error } = await supabase
      .from("video_music_tracks")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create video music track metadata: ${error.message}`);
    }

    // Audit log
    await supabase.from("admin_audit_log").insert({
      actor_id: auth.user.id,
      action_type: "create_video_music_track_metadata",
      target_type: "video_music_track",
      target_id: data.id,
      before_state: { storage_path: storagePath, source: "storage_only" },
      after_state: data,
    });

    return data;
  }
}

async function handleDeleteVideoMusicTrack(
  supabase: SupabaseClient,
  auth: AuthResult,
  trackId: string
) {
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can delete video music tracks");
  }

  let storagePath: string | null = null;
  let currentTrack: any = null;
  let deletedMetadata = false;

  // Check if trackId is a UUID (metadata record) or a storage path
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trackId);
  
  if (isUUID) {
    // Get metadata record
    const { data, error: fetchError } = await supabase
      .from("video_music_tracks")
      .select("*")
      .eq("id", trackId)
      .single();
    
    if (fetchError || !data) {
      throw new Error("Track metadata not found");
    }
    
    currentTrack = data;
    storagePath = data.storage_path || null;

    // Delete metadata record
    const { error } = await supabase
      .from("video_music_tracks")
      .delete()
      .eq("id", trackId);

    if (error) {
      throw new Error(`Failed to delete video music track metadata: ${error.message}`);
    }
    deletedMetadata = true;
  } else {
    // trackId is a storage path (for tracks without metadata in database)
    // Only delete from storage, skip database operations
    storagePath = trackId;
    currentTrack = { storage_path: storagePath, source: "storage_only" };
  }

  // Delete from storage if we have a path
  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from("music-tracks")
      .remove([storagePath]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
      // If we already deleted metadata but storage failed, log but don't throw
      if (!deletedMetadata) {
        throw new Error(`Failed to delete file from storage: ${storageError.message}`);
      }
    }
  }

  // Audit log
  await supabase.from("admin_audit_log").insert({
    actor_id: auth.user.id,
    action_type: "delete_video_music_track",
    target_type: "video_music_track",
    target_id: trackId,
    before_state: currentTrack,
  });

  return { success: true, deleted_metadata: deletedMetadata, deleted_storage: !!storagePath };
}

async function handleDeleteOrganizations(
  supabase: SupabaseClient,
  auth: AuthResult,
  body: { organizationIds: string[] }
) {
  // Only super admins can delete organizations
  if (!auth.isSuperAdmin) {
    throw new Error("Only super admins can delete organizations");
  }

  const { organizationIds } = body;
  if (!organizationIds || !Array.isArray(organizationIds) || organizationIds.length === 0) {
    throw new Error("organizationIds array is required");
  }

  if (organizationIds.length > 10) {
    throw new Error("Maximum 10 organizations per delete request");
  }

  const results: { orgId: string; success: boolean; error?: string }[] = [];

  for (const orgId of organizationIds) {
    try {
      // Get org details for audit log before deletion
      const { data: org } = await supabase
        .from("organizations")
        .select("id, business_name, slug")
        .eq("id", orgId)
        .single();

      if (!org) {
        results.push({ orgId, success: false, error: "Organization not found" });
        continue;
      }

      // Helper to safely delete from a table (ignores errors for missing tables)
      const safeDelete = async (table: string) => {
        try {
          await supabase.from(table).delete().eq("organization_id", orgId);
        } catch (e) {
          // Ignore - table might not exist
        }
      };

      // Delete related data in order (respecting foreign keys)
      // 1. Delete user_organizations links
      await safeDelete("user_organizations");
      
      // 2. Delete listings (and related media will cascade or be cleaned up)
      await safeDelete("listings");
      
      // 3. Delete CRM contacts if exists
      await safeDelete("crm.contacts");
      
      // 4. Delete billing profile if exists
      await safeDelete("billing_profiles");
      
      // 5. Delete credit ledger entries if exists
      await safeDelete("credit_ledger");
      
      // 6. Delete AI assistant configs if exists
      await safeDelete("ai_assistant_config");
      
      // 7. Delete onboarding progress if exists
      await safeDelete("onboarding_progress");
      
      // 8. Delete feature flags for org if exists
      await safeDelete("feature_flags");
      
      // 9. Delete webhooks if exists
      await safeDelete("webhooks");
      
      // 10. Delete signup_requests if exists
      await safeDelete("signup_requests");

      // 11. Finally delete the organization
      const { error: deleteError, count } = await supabase
        .from("organizations")
        .delete({ count: 'exact' })
        .eq("id", orgId);

      if (deleteError) {
        throw deleteError;
      }

      // Verify the row was actually deleted
      const { data: checkOrg } = await supabase
        .from("organizations")
        .select("id")
        .eq("id", orgId)
        .single();

      if (checkOrg) {
        throw new Error("Organization still exists after delete - check RLS policies or foreign key constraints");
      }

      // Audit log
      await supabase.from("admin_audit_log").insert({
        actor_id: auth.user.id,
        action_type: "delete_organization",
        target_type: "organization",
        target_id: orgId,
        before_state: org,
      });

      results.push({ orgId, success: true });
    } catch (error: any) {
      console.error(`Failed to delete organization ${orgId}:`, error);
      results.push({ orgId, success: false, error: error.message });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return {
    success: failCount === 0,
    message: `Deleted ${successCount} of ${organizationIds.length} organizations`,
    results,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authResult = await authenticateAdmin(req, supabase);
    if (authResult instanceof Response) {
      return authResult;
    }

    const url = new URL(req.url);
    const path = url.pathname.replace("/internal-admin-api", "");
    const method = req.method;

    console.log(`[Internal Admin API] ${method} ${path} by ${authResult.user.email}`);

    let responseData: any;

    if (path === "/organizations" && method === "GET") {
      const params = {
        search: url.searchParams.get("search") || undefined,
        status: url.searchParams.get("status") || undefined,
        page: parseInt(url.searchParams.get("page") || "0"),
        pageSize: parseInt(url.searchParams.get("pageSize") || "20"),
      };
      responseData = await handleOrganizationsList(supabase, authResult, params);
    } else if (path.match(/^\/organizations\/[^/]+\/detail$/) && method === "GET") {
      const organizationId = path.replace("/organizations/", "").replace("/detail", "");
      responseData = await handleOrganizationDetail(supabase, authResult, organizationId);
    } else if (path.match(/^\/organizations\/[^/]+\/credits$/) && method === "GET") {
      const organizationId = path.replace("/organizations/", "").replace("/credits", "");
      responseData = await handleOrganizationCredits(supabase, authResult, organizationId);
    } else if (path.match(/^\/organizations\/[^/]+\/billing$/) && method === "GET") {
      const organizationId = path.replace("/organizations/", "").replace("/billing", "");
      responseData = await handleOrganizationBilling(supabase, authResult, organizationId);
    } else if (path.match(/^\/organizations\/[^/]+\/plan$/) && method === "PATCH") {
      const organizationId = path.replace("/organizations/", "").replace("/plan", "");
      const body = await req.json();
      responseData = await handleChangePlan(supabase, authResult, organizationId, body);
    } else if (path === "/organizations/delete" && method === "POST") {
      const body = await req.json();
      responseData = await handleDeleteOrganizations(supabase, authResult, body);
    } else if (path === "/users" && method === "GET") {
      const params = {
        search: url.searchParams.get("search") || undefined,
        role: url.searchParams.get("role") || undefined,
        page: parseInt(url.searchParams.get("page") || "0"),
        pageSize: parseInt(url.searchParams.get("pageSize") || "20"),
      };
      responseData = await handleUsersList(supabase, authResult, params);
    } else if (path === "/analytics/overview" && method === "GET") {
      responseData = await handleAnalyticsOverview(supabase, authResult);
    } else if (path === "/analytics/signups" && method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "10");
      responseData = await handleRecentSignups(supabase, authResult, limit);
    } else if (path === "/analytics/features" && method === "GET") {
      responseData = await handleFeatureUsage(supabase, authResult);
    } else if (path === "/analytics/discounts" && method === "GET") {
      responseData = await handleDiscountStats(supabase, authResult);
    } else if (path === "/support/notes" && method === "GET") {
      const targetType = url.searchParams.get("target_type") || undefined;
      const targetId = url.searchParams.get("target_id") || undefined;
      responseData = await handleAdminNotes(supabase, authResult, targetType, targetId);
    } else if (path === "/support/notes" && method === "POST") {
      const body = await req.json();
      responseData = await handleCreateAdminNote(supabase, authResult, body);
    } else if (path.startsWith("/support/notes/") && method === "DELETE") {
      const noteId = path.replace("/support/notes/", "");
      responseData = await handleDeleteAdminNote(supabase, authResult, noteId);
    } else if (path === "/support/email-queue" && method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "50");
      responseData = await handleEmailQueue(supabase, authResult, limit);
    } else if (path === "/support/resend-verification" && method === "POST") {
      const { userId } = await req.json();
      responseData = await handleResendVerification(supabase, authResult, userId);
    } else if (path === "/support/password-reset" && method === "POST") {
      const { email } = await req.json();
      responseData = await handlePasswordReset(supabase, authResult, email);
    } else if (path === "/support/set-password" && method === "POST") {
      const { userId, newPassword } = await req.json();
      responseData = await handleSetPassword(supabase, authResult, userId, newPassword);
    } else if (path === "/gdpr/requests" && method === "GET") {
      const status = url.searchParams.get("status") || undefined;
      responseData = await handleGdprRequests(supabase, authResult, status);
    } else if (path === "/gdpr/requests" && method === "POST") {
      const body = await req.json();
      responseData = await handleCreateGdprRequest(supabase, authResult, body);
    } else if (path.match(/^\/gdpr\/requests\/[^/]+\/export$/) && method === "POST") {
      const requestId = path.replace("/gdpr/requests/", "").replace("/export", "");
      responseData = await handleGdprDataExport(supabase, authResult, requestId);
    } else if (path.startsWith("/gdpr/requests/") && method === "PATCH") {
      const requestId = path.replace("/gdpr/requests/", "");
      const { action, reason } = await req.json();
      responseData = await handleProcessGdprRequest(supabase, authResult, requestId, action, reason);
    } else if (path === "/discounts" && method === "GET") {
      responseData = await handleDiscountCodesList(supabase, authResult);
    } else if (path === "/discounts" && method === "POST") {
      const body = await req.json();
      responseData = await handleCreateDiscountCode(supabase, authResult, body);
    } else if (path.startsWith("/discounts/") && method === "PATCH") {
      const codeId = path.replace("/discounts/", "");
      const body = await req.json();
      responseData = await handleUpdateDiscountCode(supabase, authResult, codeId, body);
    } else if (path.startsWith("/discounts/") && method === "DELETE") {
      const codeId = path.replace("/discounts/", "");
      responseData = await handleDeleteDiscountCode(supabase, authResult, codeId);
    } else if (path === "/flags" && method === "GET") {
      responseData = await handleFeatureFlagsList(supabase, authResult);
    } else if (path === "/flags" && method === "POST") {
      const body = await req.json();
      responseData = await handleCreateFeatureFlag(supabase, authResult, body);
    } else if (path.match(/^\/flags\/[^/]+\/overrides$/) && method === "GET") {
      const flagId = path.replace("/flags/", "").replace("/overrides", "");
      responseData = await handleFeatureFlagOverrides(supabase, authResult, flagId);
    } else if (path.match(/^\/flags\/[^/]+\/toggle$/) && method === "POST") {
      const flagId = path.replace("/flags/", "").replace("/toggle", "");
      const { is_active } = await req.json();
      responseData = await handleToggleFeatureFlag(supabase, authResult, flagId, is_active);
    } else if (path.startsWith("/flags/") && method === "PATCH") {
      const flagId = path.replace("/flags/", "");
      const body = await req.json();
      responseData = await handleUpdateFeatureFlag(supabase, authResult, flagId, body);
    } else if (path.startsWith("/flags/") && method === "DELETE") {
      const flagId = path.replace("/flags/", "");
      responseData = await handleDeleteFeatureFlag(supabase, authResult, flagId);
    } else if (path === "/credits/grant" && method === "POST") {
      const body = await req.json();
      responseData = await handleGrantCredits(supabase, authResult, body);
    } else if (path === "/alerts" && method === "GET") {
      responseData = await handleAlertRulesList(supabase, authResult);
    } else if (path === "/alerts" && method === "POST") {
      const body = await req.json();
      responseData = await handleCreateAlertRule(supabase, authResult, body);
    } else if (path === "/alerts/history" && method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "50");
      responseData = await handleAlertHistory(supabase, authResult, limit);
    } else if (path.match(/^\/alerts\/[^/]+\/test$/) && method === "POST") {
      const ruleId = path.replace("/alerts/", "").replace("/test", "");
      responseData = await handleTestAlert(supabase, authResult, ruleId);
    } else if (path.startsWith("/alerts/") && method === "PATCH") {
      const ruleId = path.replace("/alerts/", "");
      const body = await req.json();
      responseData = await handleUpdateAlertRule(supabase, authResult, ruleId, body);
    } else if (path.startsWith("/alerts/") && method === "DELETE") {
      const ruleId = path.replace("/alerts/", "");
      responseData = await handleDeleteAlertRule(supabase, authResult, ruleId);
    } else if (path === "/audit-log" && method === "GET") {
      const params = {
        search: url.searchParams.get("search") || undefined,
        actionType: url.searchParams.get("actionType") || undefined,
        limit: parseInt(url.searchParams.get("limit") || "50"),
        offset: parseInt(url.searchParams.get("offset") || "0"),
      };
      responseData = await handleAuditLogList(supabase, authResult, params);
    } else if (path === "/users/bulk-action" && method === "POST") {
      const body = await req.json();
      responseData = await handleBulkUserAction(supabase, authResult, body);
    } else if (path === "/users/delete" && method === "POST") {
      const body = await req.json();
      responseData = await handleDeleteUsers(supabase, authResult, body);
    } else if (path === "/users/change-role" && method === "POST") {
      const body = await req.json();
      responseData = await handleChangeUserRole(supabase, authResult, body);
    } else if (path === "/impersonation/start" && method === "POST") {
      const body = await req.json();
      responseData = await handleStartImpersonation(supabase, authResult, body);
    } else if (path === "/impersonation/end" && method === "POST") {
      const body = await req.json();
      responseData = await handleEndImpersonation(supabase, authResult, body);
    } else if (path === "/usage-rates" && method === "GET") {
      responseData = await handleUsageRatesList(supabase, authResult);
    } else if (path === "/usage-rates" && method === "POST") {
      const body = await req.json();
      responseData = await handleCreateUsageRate(supabase, authResult, body);
    } else if (path.startsWith("/usage-rates/") && method === "PATCH") {
      const featureType = decodeURIComponent(path.replace("/usage-rates/", ""));
      const body = await req.json();
      responseData = await handleUpdateUsageRate(supabase, authResult, featureType, body);
    } else if (path.startsWith("/usage-rates/") && method === "DELETE") {
      const featureType = decodeURIComponent(path.replace("/usage-rates/", ""));
      responseData = await handleDeleteUsageRate(supabase, authResult, featureType);
    } else if (path === "/ai-instructions" && method === "GET") {
      const filters = {
        feature_type: url.searchParams.get("feature_type") || undefined,
        scope: url.searchParams.get("scope") || undefined,
        organization_id: url.searchParams.get("organization_id") || undefined,
        is_active: url.searchParams.get("is_active") === "true" ? true : url.searchParams.get("is_active") === "false" ? false : undefined,
      };
      responseData = await handleAIInstructionsList(supabase, authResult, filters);
    } else if (path === "/ai-instructions" && method === "POST") {
      const body = await req.json();
      responseData = await handleCreateAIInstruction(supabase, authResult, body);
    } else if (path.match(/^\/ai-instructions\/[^/]+\/history$/) && method === "GET") {
      const instructionId = path.replace("/ai-instructions/", "").replace("/history", "");
      const limit = parseInt(url.searchParams.get("limit") || "50");
      responseData = await handleAIInstructionHistory(supabase, authResult, instructionId, limit);
    } else if (path.match(/^\/ai-instructions\/[^/]+\/duplicate$/) && method === "POST") {
      const instructionId = path.replace("/ai-instructions/", "").replace("/duplicate", "");
      const body = await req.json();
      responseData = await handleDuplicateAIInstruction(supabase, authResult, instructionId, body);
    } else if (path.match(/^\/ai-instructions\/[^/]+$/) && method === "GET") {
      const instructionId = path.replace("/ai-instructions/", "");
      responseData = await handleAIInstructionDetail(supabase, authResult, instructionId);
    } else if (path.match(/^\/ai-instructions\/[^/]+$/) && method === "PATCH") {
      const instructionId = path.replace("/ai-instructions/", "");
      const body = await req.json();
      responseData = await handleUpdateAIInstruction(supabase, authResult, instructionId, body);
    } else if (path.match(/^\/ai-instructions\/[^/]+$/) && method === "DELETE") {
      const instructionId = path.replace("/ai-instructions/", "");
      responseData = await handleDeleteAIInstruction(supabase, authResult, instructionId);
    } else if (path === "/video-music" && method === "GET") {
      responseData = await handleVideoMusicTracksList(supabase, authResult);
    } else if (path === "/video-music" && method === "POST") {
      const body = await req.json();
      responseData = await handleCreateVideoMusicTrack(supabase, authResult, body);
    } else if (path.match(/^\/video-music\/[^/]+$/) && (method === "PATCH" || method === "PUT")) {
      const trackId = decodeURIComponent(path.replace("/video-music/", ""));
      const body = await req.json();
      responseData = await handleUpdateVideoMusicTrack(supabase, authResult, trackId, body);
    } else if (path.match(/^\/video-music\/[^/]+$/) && method === "DELETE") {
      const trackId = decodeURIComponent(path.replace("/video-music/", ""));
      responseData = await handleDeleteVideoMusicTrack(supabase, authResult, trackId);
    } else if (path === "/analytics/video" && method === "GET") {
      responseData = await handleVideoAnalyticsOverview(supabase, authResult);
    } else if (path === "/analytics/video/events" && method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "50");
      responseData = await handleVideoAnalyticsEvents(supabase, authResult, limit);
    } else {
      return new Response(
        JSON.stringify({ error: "Not found", path }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[Internal Admin API] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
