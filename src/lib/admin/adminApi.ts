import { supabase } from "@/integrations/supabase/client";

const ADMIN_API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/internal-admin-api`;

async function getAuthHeaders(maxRetries = 5, maxWaitMs = 3000): Promise<HeadersInit> {
  const startTime = Date.now();
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      };
    }
    
    // Check if we've exceeded max wait time
    if (Date.now() - startTime >= maxWaitMs) {
      break;
    }
    
    // Wait before retry with exponential backoff (100ms, 200ms, 400ms, 800ms)
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
    }
  }
  
  // Final attempt: wait for auth state change
  return new Promise((resolve, reject) => {
    const remainingTime = Math.max(0, maxWaitMs - (Date.now() - startTime));
    
    const timeoutId = setTimeout(() => {
      subscription.unsubscribe();
      reject(new Error("Not authenticated - session not available after waiting"));
    }, remainingTime);
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.access_token) {
        clearTimeout(timeoutId);
        subscription.unsubscribe();
        resolve({
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        });
      }
    });
    
    // Also check immediately in case session is already available
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        clearTimeout(timeoutId);
        subscription.unsubscribe();
        resolve({
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        });
      }
    });
  });
}

async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${ADMIN_API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || `API error: ${response.status}`);
  }

  return data as T;
}

export interface AnalyticsOverview {
  organizations: { total: number; active: number; trial: number };
  users: { total: number; admins: number };
  credits: { granted: number; used: number; balance: number } | { redacted: boolean; reason: string };
  discounts: { total: number; active: number; totalRedemptions: number };
  features: { total: number; enabled: number };
}

export function isCreditsRedacted(credits: AnalyticsOverview['credits'] | undefined | null): credits is { redacted: boolean; reason: string } {
  return credits != null && typeof credits === 'object' && 'redacted' in credits && credits.redacted === true;
}

export interface RecentSignup {
  id: string;
  name: string;
  account_status: string;
  created_at: string;
}

export interface FeatureUsage {
  feature: string;
  count: number;
  totalCredits: number;
}

export interface DiscountStats {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  times_used: number;
  max_uses: number | null;
  is_active: boolean;
  credit_grant_amount: number | null;
}

export interface VideoAnalyticsFunnel {
  stage: string;
  count: number;
  dropOff: number;
}

export interface VideoAnalyticsOverview {
  totalViews: number;
  uniqueSessions: number;
  completionRate: number;
  avgWatchTimeSeconds: number;
  deviceBreakdown: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  funnel: VideoAnalyticsFunnel[];
}

export interface VideoAnalyticsEvent {
  id: string;
  session_id: string;
  event_type: string;
  max_percentage: number;
  video_duration_seconds: number | null;
  watch_time_seconds: number;
  device_type: string;
  user_agent: string;
  referrer: string | null;
  created_at: string;
}

export interface AdminNote {
  id: string;
  target_type: string;
  target_id: string;
  note: string;
  created_by: string;
  created_at: string;
}

export interface FailedPost {
  id: string;
  organization_id: string;
  organization_name: string;
  listing_id: string | null;
  listing_title: string | null;
  listing_address: string | null;
  post_category: string;
  content_type: string | null;
  aspect_ratio: string | null;
  error_message: string | null;
  scheduled_for: string;
  updated_at: string;
  failure_notified_at: string | null;
  platforms_to_post: string[] | null;
}

export interface FailedPostsResponse {
  posts: FailedPost[];
  total: number;
}

export interface EmailQueueItem {
  id: string;
  to_email: string;
  subject: string;
  status: string;
  created_at: string;
}

export interface GdprRequest {
  id: string;
  request_type: string;
  target_type: string;
  target_id: string | null;
  target_email: string | null;
  status: string;
  notes: string | null;
  rejection_reason: string | null;
  requested_by: string;
  completed_at: string | null;
  created_at: string;
}

export interface DiscountCode {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  currency: string;
  max_uses: number | null;
  current_uses: number;
  max_uses_per_org: number;
  valid_from: string;
  valid_until: string | null;
  applicable_plans: string[] | null;
  min_months: number;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
}

export interface DiscountCodeInput {
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

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  flag_type: "boolean" | "percentage" | "allowlist";
  default_state: boolean;
  rollout_percentage: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface FeatureFlagInput {
  key: string;
  name: string;
  description?: string;
  flag_type: "boolean" | "percentage" | "allowlist";
  default_state?: boolean;
  rollout_percentage?: number;
  is_active?: boolean;
}

export interface UsageRate {
  id: string;
  feature_type: string;
  credits_per_use: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UsageRateInput {
  feature_type: string;
  credits_per_use: number;
  description?: string;
}

export interface AIInstructionSet {
  id: string;
  feature_type: string;
  name: string;
  description: string | null;
  banned_phrases: string[];
  tone_guidelines: string[];
  freeform_instructions: string | null;
  is_active: boolean;
  priority: number;
  locale: string | null;
  scope: 'global' | 'organization';
  organization_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface AIInstructionSetInput {
  feature_type: string;
  name: string;
  description?: string;
  banned_phrases?: string[];
  tone_guidelines?: string[];
  freeform_instructions?: string;
  is_active?: boolean;
  priority?: number;
  locale?: string;
  scope?: 'global' | 'organization';
  organization_id?: string;
}

export interface AIInstructionHistory {
  id: string;
  instruction_set_id: string;
  changed_by: string;
  change_type: 'create' | 'update' | 'delete' | 'duplicate';
  previous_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  change_reason: string | null;
  created_at: string;
}

export interface VideoMusicTrack {
  id: string;
  name: string;
  description: string | null;
  storage_path: string;
  file_name: string;
  file_size_bytes: number;
  duration_seconds: number | null;
  genre: string | null;
  mood: string | null;
  tags: string[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VideoMusicTrackInput {
  name: string;
  description?: string;
  storage_path: string;
  file_name: string;
  file_size_bytes: number;
  duration_seconds?: number;
  genre?: string;
  mood?: string;
  tags?: string[];
  is_active?: boolean;
}

export interface FeatureFlagOverride {
  id: string;
  feature_flag_id: string;
  organization_id: string;
  state: boolean;
  expires_at: string | null;
  reason: string | null;
  created_at: string;
}

export interface CreditLedgerEntry {
  id: string;
  organization_id: string;
  amount: number;
  type: string;
  description: string | null;
  granted_by: string | null;
  created_at: string;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string | null;
  metric_type: string;
  condition: string;
  threshold: number;
  time_window_minutes: number;
  notification_channels: string[];
  is_enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertRuleInput {
  name: string;
  description?: string;
  metric_type: string;
  condition: string;
  threshold: number;
  time_window_minutes?: number;
  notification_channels?: string[];
  is_enabled?: boolean;
}

export interface AlertHistory {
  id: string;
  rule_id: string | null;
  rule_name: string;
  metric_type: string;
  metric_value: number;
  threshold: number;
  condition: string;
  notification_channels: string[];
  notification_status: string;
  notification_error: string | null;
  triggered_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action_type: string;
  target_type: string | null;
  target_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLogListResponse {
  logs: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface OrganizationWithCounts {
  id: string;
  business_name: string;
  slug: string;
  domain: string | null;
  contact_email: string | null;
  contact_name: string | null;
  is_active: boolean | null;
  created_at: string | null;
  logo_url: string | null;
  user_count: number;
  listing_count: number;
  credit_balance: number | null;
  credit_balance_redacted: boolean;
  plan_display_name: string | null;
  account_status: string | null;
  has_billing_override: boolean;
}

export interface OrganizationCreditsTransaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  source: string | null;
  created_at: string;
  created_by: string | null;
}

export interface OrganizationCreditsTimeline {
  week: string;
  credits: number;
  debits: number;
}

export interface OrganizationCreditsResponse {
  organization_id: string;
  organization_name: string;
  balance: number;
  balance_updated_at: string | null;
  last_top_up: {
    amount: number;
    date: string;
    description: string | null;
  } | null;
  total_granted: number;
  total_used: number;
  usage_timeline: OrganizationCreditsTimeline[];
  transactions: OrganizationCreditsTransaction[];
}

export interface OrganizationCreditsRedacted {
  redacted: true;
  reason: string;
}

export function isOrgCreditsRedacted(
  data: OrganizationCreditsResponse | OrganizationCreditsRedacted | undefined | null
): data is OrganizationCreditsRedacted {
  return data != null && typeof data === 'object' && 'redacted' in data && data.redacted === true;
}

export interface OrganizationsListResponse {
  organizations: OrganizationWithCounts[];
  total: number;
}

export interface UserOrganization {
  user_id: string;
  organization_id: string;
  role: string;
  organization_name?: string;
}

export interface UserWithDetails {
  id: string;
  user_id: string;
  role: string;
  email: string | null;
  name: string | null;
  created_at: string | null;
  organizations: UserOrganization[];
}

export interface UsersListResponse {
  users: UserWithDetails[];
  total: number;
}

export interface OrganizationDetailUser {
  user_id: string;
  role: string;
  created_at: string;
}

export interface BillingOverride {
  type: string;
  plan_equivalent?: string | null;
  price_weekly_cents?: number | null;
  currency?: string | null;
  notes?: string | null;
  expires_at?: string | null;
}

export interface PlanSummary {
  organization_id: string;
  organization_name: string | null;
  effective_plan_name: string;
  plan_display_name: string;
  plan_tier: string | null;
  max_listings: number | null;
  max_social_hubs: number | null;
  max_posts_per_listing_per_week: number | null;
  max_lead_magnets_per_week: number | null;
  max_crm_contacts: number | null;
  max_email_campaigns_per_month: number | null;
  max_users: number | null;
  has_watermark: boolean | null;
  allowed_video_styles: string[] | null;
  monthly_credits: number | null;
  has_billing_override: boolean;
  billing_override: BillingOverride | null;
  account_status: string | null;
  credit_spending_enabled: boolean | null;
  listing_count: number;
  hub_count: number;
}

export interface PlanDefinition {
  name: string;
  display_name: string;
  description: string | null;
  monthly_price_cents: number;
  features: Record<string, unknown> | null;
  limits: Record<string, unknown> | null;
  display_order: number;
  is_active: boolean;
}

export interface OrganizationDetailResponse {
  organization: {
    id: string;
    business_name: string;
    slug: string;
    domain: string | null;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    business_address: string | null;
    psr_licence_number: string | null;
    logo_url: string | null;
    is_active: boolean | null;
    is_comped: boolean | null;
    account_status: string | null;
    trial_ends_at: string | null;
    grace_period_ends_at: string | null;
    created_at: string | null;
    updated_at: string | null;
    locale: string | null;
    currency: string | null;
    timezone: string | null;
    vat_rate: number | null;
    country_code: string | null;
    current_plan_name: string | null;
    billing_override: BillingOverride | null;
  };
  stats: {
    users: number;
    listings: number;
    activeListings: number;
  };
  users: OrganizationDetailUser[];
  billing_profile: {
    id: string;
    organization_id: string;
    subscription_plan: string | null;
    subscription_status: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    is_sponsored: boolean | null;
    sponsored_reason: string | null;
  } | null;
  plan_summary: PlanSummary | null;
}

export interface BroadcastCampaign {
  id: string;
  subject: string;
  body_html: string;
  preview_text: string | null;
  from_name: string;
  from_email: string;
  audience_filters: {
    plans?: string[];
    countries?: string[];
    account_statuses?: string[];
    engagement?: string[];
  };
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';
  scheduled_for: string | null;
  sent_at: string | null;
  total_recipients: number;
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  total_bounced: number;
  created_by: string | null;
  sent_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BroadcastRecipient {
  id: string;
  campaign_id: string;
  email: string;
  user_id: string | null;
  name: string | null;
  status: 'pending' | 'sent' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'failed';
  resend_email_id: string | null;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  created_at: string;
}

export interface BroadcastCampaignInput {
  subject: string;
  body_html: string;
  preview_text?: string;
  from_name?: string;
  from_email?: string;
  audience_filters?: BroadcastCampaign['audience_filters'];
  scheduled_for?: string;
}

export interface BroadcastCampaignDetail extends BroadcastCampaign {
  recipients: BroadcastRecipient[];
}

export const adminApi = {
  plans: {
    list: () => adminFetch<{ plans: PlanDefinition[] }>("/plan-definitions"),
  },

  organizations: {
    list: (params?: { search?: string; status?: string; page?: number; pageSize?: number }) => {
      const queryParams = new URLSearchParams();
      if (params?.search) queryParams.set("search", params.search);
      if (params?.status) queryParams.set("status", params.status);
      if (params?.page !== undefined) queryParams.set("page", params.page.toString());
      if (params?.pageSize) queryParams.set("pageSize", params.pageSize.toString());
      const query = queryParams.toString();
      return adminFetch<OrganizationsListResponse>(`/organizations${query ? `?${query}` : ""}`);
    },
    getDetail: (organizationId: string) =>
      adminFetch<OrganizationDetailResponse>(`/organizations/${organizationId}/detail`),
    getCredits: (organizationId: string) =>
      adminFetch<OrganizationCreditsResponse | OrganizationCreditsRedacted>(
        `/organizations/${organizationId}/credits`
      ),
    getBilling: (organizationId: string) =>
      adminFetch<{
        organization_id: string;
        organization_name: string;
        account_status: string | null;
        trial_ends_at: string | null;
        grace_period_ends_at: string | null;
        billing_profile: {
          id: string;
          organization_id: string;
          subscription_plan: string | null;
          subscription_status: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          is_sponsored: boolean | null;
          sponsored_reason: string | null;
        } | null;
      }>(`/organizations/${organizationId}/billing`),
    changePlan: (organizationId: string, plan: string) =>
      adminFetch<{
        success: boolean;
        organization_id: string;
        previous_plan: string | null;
        new_plan: string;
      }>(`/organizations/${organizationId}/plan`, {
        method: "PATCH",
        body: JSON.stringify({ plan }),
      }),
    setBillingOverride: (organizationId: string, override: BillingOverride | null) =>
      adminFetch<{
        success: boolean;
        organization_id: string;
        billing_override: BillingOverride | null;
      }>(`/organizations/${organizationId}/billing-override`, {
        method: "PATCH",
        body: JSON.stringify({ override }),
      }),
    updateRegionSettings: (organizationId: string, data: { locale: string; currency: string; timezone: string }) =>
      adminFetch<{
        success: boolean;
        organization_id: string;
        locale: string;
        currency: string;
        timezone: string;
      }>(`/organizations/${organizationId}/region`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (organizationIds: string[]) =>
      adminFetch<{
        success: boolean;
        message: string;
        results: { orgId: string; success: boolean; error?: string }[];
      }>("/organizations/delete", {
        method: "POST",
        body: JSON.stringify({ organizationIds }),
      }),
  },

  users: {
    list: (params?: { search?: string; role?: string; page?: number; pageSize?: number }) => {
      const queryParams = new URLSearchParams();
      if (params?.search) queryParams.set("search", params.search);
      if (params?.role) queryParams.set("role", params.role);
      if (params?.page !== undefined) queryParams.set("page", params.page.toString());
      if (params?.pageSize) queryParams.set("pageSize", params.pageSize.toString());
      const query = queryParams.toString();
      return adminFetch<UsersListResponse>(`/users${query ? `?${query}` : ""}`);
    },
    bulkAction: (data: { userIds: string[]; action: 'suspend' | 'unsuspend'; reason?: string }) =>
      adminFetch<{
        success: boolean;
        message: string;
        results: { userId: string; success: boolean; error?: string }[];
      }>("/users/bulk-action", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    deleteUsers: (data: { userIds: string[] }) =>
      adminFetch<{
        success: boolean;
        message: string;
        results: { userId: string; success: boolean; error?: string }[];
      }>("/users/delete", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    changeRole: (data: { userId: string; newRole: string }) =>
      adminFetch<{
        success: boolean;
        message: string;
        previousRole: string;
        newRole: string;
      }>("/users/change-role", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  analytics: {
    getOverview: () => adminFetch<AnalyticsOverview>("/analytics/overview"),
    getRecentSignups: (limit = 10) => adminFetch<RecentSignup[]>(`/analytics/signups?limit=${limit}`),
    getFeatureUsage: () => adminFetch<FeatureUsage[]>("/analytics/features"),
    getDiscountStats: () => adminFetch<DiscountStats[]>("/analytics/discounts"),
    getVideoAnalytics: () => adminFetch<VideoAnalyticsOverview>("/analytics/video"),
    getVideoEvents: (limit = 50) => adminFetch<VideoAnalyticsEvent[]>(`/analytics/video/events?limit=${limit}`),
  },

  support: {
    getNotes: (targetType?: string, targetId?: string) => {
      const params = new URLSearchParams();
      if (targetType) params.set("target_type", targetType);
      if (targetId) params.set("target_id", targetId);
      const query = params.toString();
      return adminFetch<AdminNote[]>(`/support/notes${query ? `?${query}` : ""}`);
    },
    createNote: (data: { target_type: string; target_id: string; note: string }) =>
      adminFetch<AdminNote>("/support/notes", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    deleteNote: (noteId: string) =>
      adminFetch<{ success: boolean }>(`/support/notes/${noteId}`, {
        method: "DELETE",
      }),
    getEmailQueue: (limit = 50) => adminFetch<EmailQueueItem[]>(`/support/email-queue?limit=${limit}`),
    resendVerification: (userId: string) =>
      adminFetch<{ success: boolean; email: string }>("/support/resend-verification", {
        method: "POST",
        body: JSON.stringify({ userId }),
      }),
    resetPassword: (email: string) =>
      adminFetch<{ success: boolean; email: string }>("/support/password-reset", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    setPassword: (userId: string, newPassword: string) =>
      adminFetch<{ success: boolean; userId: string }>("/support/set-password", {
        method: "POST",
        body: JSON.stringify({ userId, newPassword }),
      }),
  },

  gdpr: {
    getRequests: (status?: string) => {
      const query = status ? `?status=${status}` : "";
      return adminFetch<GdprRequest[]>(`/gdpr/requests${query}`);
    },
    createRequest: (data: {
      request_type: string;
      target_type: string;
      target_id?: string;
      target_email?: string;
      notes?: string;
    }) =>
      adminFetch<GdprRequest>("/gdpr/requests", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    processRequest: (requestId: string, action: "complete" | "reject", reason?: string) =>
      adminFetch<{ success: boolean; status: string }>(`/gdpr/requests/${requestId}`, {
        method: "PATCH",
        body: JSON.stringify({ action, reason }),
      }),
    generateExport: (requestId: string) =>
      adminFetch<{ success: boolean; export_data: Record<string, unknown>; filename: string }>(
        `/gdpr/requests/${requestId}/export`,
        { method: "POST" }
      ),
  },

  discounts: {
    list: () => adminFetch<DiscountCode[]>("/discounts"),
    create: (data: DiscountCodeInput) =>
      adminFetch<DiscountCode>("/discounts", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (codeId: string, data: Partial<DiscountCodeInput>) =>
      adminFetch<DiscountCode>(`/discounts/${codeId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (codeId: string) =>
      adminFetch<{ success: boolean }>(`/discounts/${codeId}`, {
        method: "DELETE",
      }),
  },

  flags: {
    list: async (): Promise<FeatureFlag[]> => {
      const { data, error } = await (supabase as any)
        .from("feature_flags")
        .select('id, name, description, is_enabled, created_at, updated_at, created_by')
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []).map((f: any) => ({
        id: f.id,
        key: f.name || '',
        name: f.name || '',
        description: f.description || '',
        flag_type: 'boolean' as const,
        default_state: false,
        rollout_percentage: 0,
        is_active: f.is_enabled ?? false,
        created_at: f.created_at || new Date().toISOString(),
        updated_at: f.updated_at || new Date().toISOString(),
        created_by: f.created_by || null,
      }));
    },
    getOverrides: (flagId: string) => adminFetch<FeatureFlagOverride[]>(`/flags/${flagId}/overrides`),
    create: async (data: FeatureFlagInput): Promise<FeatureFlag> => {
      const { data: result, error } = await (supabase as any)
        .from("feature_flags")
        .insert({
          name: data.key || data.name,
          description: data.description,
          is_enabled: data.is_active ?? false,
          applies_to: 'all',
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return {
        id: result.id,
        key: result.name || '',
        name: result.name || '',
        description: result.description || '',
        flag_type: 'boolean' as const,
        default_state: false,
        rollout_percentage: 0,
        is_active: result.is_enabled ?? false,
        created_at: result.created_at || new Date().toISOString(),
        updated_at: result.updated_at || new Date().toISOString(),
        created_by: result.created_by || null,
      };
    },
    update: async (flagId: string, data: Partial<FeatureFlagInput>): Promise<FeatureFlag> => {
      const updateData: any = {};
      if (data.key || data.name) updateData.name = data.key || data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.is_active !== undefined) updateData.is_enabled = data.is_active;
      
      const { data: result, error } = await (supabase as any)
        .from("feature_flags")
        .update(updateData)
        .eq("id", flagId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return {
        id: result.id,
        key: result.name || '',
        name: result.name || '',
        description: result.description || '',
        flag_type: 'boolean' as const,
        default_state: false,
        rollout_percentage: 0,
        is_active: result.is_enabled ?? false,
        created_at: result.created_at || new Date().toISOString(),
        updated_at: result.updated_at || new Date().toISOString(),
        created_by: result.created_by || null,
      };
    },
    toggle: async (flagId: string, isActive: boolean): Promise<FeatureFlag> => {
      const { data: result, error } = await (supabase as any)
        .from("feature_flags")
        .update({ is_enabled: isActive })
        .eq("id", flagId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return {
        id: result.id,
        key: result.name || '',
        name: result.name || '',
        description: result.description || '',
        flag_type: 'boolean' as const,
        default_state: false,
        rollout_percentage: 0,
        is_active: result.is_enabled ?? false,
        created_at: result.created_at || new Date().toISOString(),
        updated_at: result.updated_at || new Date().toISOString(),
        created_by: result.created_by || null,
      };
    },
    delete: async (flagId: string): Promise<{ success: boolean }> => {
      const { error } = await (supabase as any)
        .from("feature_flags")
        .delete()
        .eq("id", flagId);
      if (error) throw new Error(error.message);
      return { success: true };
    },
  },

  credits: {
    grant: (data: { organization_id: string; amount: number; reason?: string }) =>
      adminFetch<CreditLedgerEntry>("/credits/grant", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  alerts: {
    list: () => adminFetch<AlertRule[]>("/alerts"),
    getHistory: (limit = 50) => adminFetch<AlertHistory[]>(`/alerts/history?limit=${limit}`),
    create: (data: AlertRuleInput) =>
      adminFetch<AlertRule>("/alerts", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (ruleId: string, data: Partial<AlertRuleInput>) =>
      adminFetch<AlertRule>(`/alerts/${ruleId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (ruleId: string) =>
      adminFetch<{ success: boolean }>(`/alerts/${ruleId}`, {
        method: "DELETE",
      }),
    test: (ruleId: string) =>
      adminFetch<{ success: boolean }>(`/alerts/${ruleId}/test`, {
        method: "POST",
      }),
  },

  auditLog: {
    list: (params?: { search?: string; actionType?: string; limit?: number; offset?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set("search", params.search);
      if (params?.actionType) searchParams.set("actionType", params.actionType);
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      if (params?.offset) searchParams.set("offset", params.offset.toString());
      const query = searchParams.toString();
      return adminFetch<AuditLogListResponse>(`/audit-log${query ? `?${query}` : ""}`);
    },
  },

  impersonation: {
    start: (data: { organizationId: string; reason?: string }) =>
      adminFetch<{ success: boolean; session_id: string; organization_name: string }>(
        "/impersonation/start",
        { method: "POST", body: JSON.stringify(data) }
      ),
    end: (data: { sessionId?: string; organizationId?: string }) =>
      adminFetch<{ success: boolean }>(
        "/impersonation/end",
        { method: "POST", body: JSON.stringify(data) }
      ),
  },

  usageRates: {
    list: () => adminFetch<UsageRate[]>("/usage-rates"),
    create: (data: UsageRateInput) =>
      adminFetch<UsageRate>("/usage-rates", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (featureType: string, data: { credits_per_use: number; description?: string }) =>
      adminFetch<UsageRate>(`/usage-rates/${encodeURIComponent(featureType)}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (featureType: string) =>
      adminFetch<{ success: boolean }>(`/usage-rates/${encodeURIComponent(featureType)}`, {
        method: "DELETE",
      }),
  },

  aiInstructions: {
    list: (params?: { feature_type?: string; scope?: string; locale?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.feature_type) searchParams.set("feature_type", params.feature_type);
      if (params?.scope) searchParams.set("scope", params.scope);
      if (params?.locale) searchParams.set("locale", params.locale);
      const query = searchParams.toString();
      return adminFetch<AIInstructionSet[]>(`/ai-instructions${query ? `?${query}` : ""}`);
    },
    get: (id: string) => adminFetch<AIInstructionSet>(`/ai-instructions/${id}`),
    create: (data: AIInstructionSetInput) =>
      adminFetch<AIInstructionSet>("/ai-instructions", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<AIInstructionSetInput>) =>
      adminFetch<AIInstructionSet>(`/ai-instructions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      adminFetch<{ success: boolean }>(`/ai-instructions/${id}`, {
        method: "DELETE",
      }),
    getHistory: (id: string) =>
      adminFetch<AIInstructionHistory[]>(`/ai-instructions/${id}/history`),
    duplicate: (id: string, data?: { name?: string; locale?: string }) =>
      adminFetch<AIInstructionSet>(`/ai-instructions/${id}/duplicate`, {
        method: "POST",
        body: JSON.stringify(data || {}),
      }),
  },

  failedPosts: {
    list: (params?: { limit?: number; offset?: number; organization_id?: string; date_from?: string; date_to?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      if (params?.offset) searchParams.set("offset", params.offset.toString());
      if (params?.organization_id) searchParams.set("organization_id", params.organization_id);
      if (params?.date_from) searchParams.set("date_from", params.date_from);
      if (params?.date_to) searchParams.set("date_to", params.date_to);
      const query = searchParams.toString();
      return adminFetch<FailedPostsResponse>(`/failed-posts${query ? `?${query}` : ""}`);
    },
  },

  videoMusic: {
    list: () => adminFetch<VideoMusicTrack[]>("/video-music"),
    create: (data: VideoMusicTrackInput) =>
      adminFetch<VideoMusicTrack>("/video-music", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<VideoMusicTrackInput>) =>
      adminFetch<VideoMusicTrack>(`/video-music/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      adminFetch<{ success: boolean }>(`/video-music/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
  },

  broadcasts: {
    list: () => adminFetch<BroadcastCampaign[]>("/broadcasts"),
    get: (id: string) => adminFetch<BroadcastCampaignDetail>(`/broadcasts/${id}`),
    create: (data: BroadcastCampaignInput) =>
      adminFetch<BroadcastCampaign>("/broadcasts", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<BroadcastCampaignInput>) =>
      adminFetch<BroadcastCampaign>(`/broadcasts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      adminFetch<{ success: boolean }>(`/broadcasts/${id}`, {
        method: "DELETE",
      }),
    send: (id: string, excludedEmails?: string[]) =>
      adminFetch<{ success: boolean; total_recipients: number; total_sent: number }>(
        `/broadcasts/${id}/send`,
        {
          method: "POST",
          body: JSON.stringify({ excluded_emails: excludedEmails || [] }),
        }
      ),
    cancel: (id: string) =>
      adminFetch<{ success: boolean }>(`/broadcasts/${id}/cancel`, {
        method: "POST",
      }),
    audienceCount: (filters: BroadcastCampaign['audience_filters']) => {
      const params = new URLSearchParams({ filters: JSON.stringify(filters) });
      return adminFetch<{ count: number; platform_count: number; external_count: number }>(
        `/broadcasts/audience-count?${params}`
      );
    },
    audiencePreview: (filters: BroadcastCampaign['audience_filters']) => {
      const params = new URLSearchParams({ filters: JSON.stringify(filters) });
      return adminFetch<{
        recipients: Array<{
          user_id: string | null;
          email: string;
          name: string | null;
          source: "platform" | "external";
        }>
      }>(
        `/broadcasts/audience-preview?${params}`
      );
    },
    // Global, persistent external-contact pool. The Super Admin's "Interested"
    // list lives here across campaigns: re-uploading the same export only
    // inserts net-new addresses, and any name_override the admin set survives.
    externalContacts: {
      list: () =>
        adminFetch<{
          contacts: Array<{
            id: string;
            email: string;
            name: string | null;
            name_override: string | null;
            source: string;
            created_at: string;
            updated_at: string;
            last_uploaded_at: string;
          }>;
          total: number;
          deduped_against_platform: number;
          net_new: number;
        }>(`/broadcasts/external-contacts`),
      upsert: (contacts: Array<{ email: string; name?: string }>, source = "manual_upload") =>
        adminFetch<{ inserted: number; preserved: number; skipped_invalid: number; total: number }>(
          `/broadcasts/external-contacts`,
          {
            method: "POST",
            body: JSON.stringify({ contacts, source }),
          }
        ),
      update: (contactId: string, patch: { name_override?: string | null }) =>
        adminFetch<{ contact: { id: string; email: string; name: string | null; name_override: string | null } }>(
          `/broadcasts/external-contacts/${contactId}`,
          {
            method: "PATCH",
            body: JSON.stringify(patch),
          }
        ),
      remove: (contactId: string) =>
        adminFetch<{ success: boolean }>(`/broadcasts/external-contacts/${contactId}`, {
          method: "DELETE",
        }),
      clear: () =>
        adminFetch<{ success: boolean }>(`/broadcasts/external-contacts`, {
          method: "DELETE",
        }),
    },
  },
};
