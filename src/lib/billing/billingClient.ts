/**
 * Billing Client SDK
 * Shared client for credit-based billing operations across CRM and Socials apps
 */

import { supabase } from '@/integrations/supabase/client';
import type { 
  CreditBalance, 
  CreditTransaction, 
  CreditHistoryResult,
  FeatureType,
  CreditSource,
  CreditPack,
  UsageRate,
  PlanDefinition,
  PlanName,
  SignupRequest
} from './types';

/**
 * Organizations exempt from credit requirements
 * These organizations can use all features without consuming credits
 * Loaded from VITE_BILLING_EXEMPT_ORG_IDS environment variable (comma-separated list)
 */
function getExemptOrganizations(): string[] {
  const exemptIds = import.meta.env.VITE_BILLING_EXEMPT_ORG_IDS || '';
  if (!exemptIds) return [];
  return exemptIds.split(',').map((id: string) => id.trim()).filter(Boolean);
}

/**
 * Check if an organization is exempt from credit requirements
 */
function isExemptOrganization(organizationId: string): boolean {
  const exemptOrgs = getExemptOrganizations();
  return exemptOrgs.includes(organizationId);
}

/**
 * Get current credit balance for an organization
 */
export async function getCreditBalance(organizationId: string): Promise<number> {
  // Exempt organizations always show unlimited credits
  if (isExemptOrganization(organizationId)) {
    return 999999;
  }
  
  try {
    const { data, error } = await (supabase as any).rpc('sp_get_credit_balance', {
      p_organization_id: organizationId
    });

    if (error) {
      // Handle RPC function not found or network errors gracefully
      if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('NetworkError')) {
        console.warn('[Billing] Credit balance RPC not available, returning 0');
        return 0;
      }
      console.error('Failed to get credit balance:', error);
      return 0;
    }

    // The RPC returns a table with one row containing balance, last_transaction_at, etc.
    // We only need the balance field
    if (Array.isArray(data) && data.length > 0) {
      return data[0].balance ?? 0;
    }
    
    return 0;
  } catch (err) {
    console.warn('[Billing] Credit balance fetch failed, returning 0:', err);
    return 0;
  }
}

/**
 * Consume credits for a feature usage
 * @throws Error if insufficient credits or other failure
 */
export async function consumeCredits(params: {
  organizationId: string;
  featureType: FeatureType;
  quantity?: number;
  userId?: string;
  sourceApp?: string;
  requestId?: string;
  featureDetails?: Record<string, any>;
}): Promise<{
  transaction_id: string;
  credits_consumed: number;
  balance_after: number;
}> {
  const {
    organizationId,
    featureType,
    quantity = 1,
    userId,
    sourceApp = 'crm',
    requestId,
    featureDetails
  } = params;

  // Exempt organizations don't consume credits
  if (isExemptOrganization(organizationId)) {
    console.log('[Billing] Organization is exempt from credit consumption:', organizationId);
    return {
      transaction_id: 'exempt-' + Date.now(),
      credits_consumed: 0,
      balance_after: 999999,
    };
  }

  try {
    const { data, error } = await (supabase as any).rpc('sp_consume_credits', {
      p_organization_id: organizationId,
      p_feature_type: featureType,
      p_quantity: quantity,
      p_user_id: userId,
      p_source_app: sourceApp,
      p_request_id: requestId,
      p_feature_details: featureDetails
    });

    if (error) {
      console.error('Failed to consume credits:', error);

      if (error.message?.includes('Insufficient credits')) {
        throw new Error('INSUFFICIENT_CREDITS');
      }
      if (error.message?.includes('CREDIT_SPENDING_DISABLED')) {
        throw new Error('CREDIT_SPENDING_DISABLED');
      }

      throw new Error(`Failed to consume credits: ${error.message}`);
    }

    return data as {
      transaction_id: string;
      credits_consumed: number;
      balance_after: number;
    };
  } catch (err: any) {
    // Re-throw known billing errors for the UI to handle
    if (['INSUFFICIENT_CREDITS', 'CREDIT_SPENDING_DISABLED'].includes(err.message)) {
      throw err;
    }
    console.error('[Billing] Consume credits failed:', err);
    throw new Error(`Credit system error: ${err.message || 'Unknown error'}`);
  }
}

/**
 * Grant credits to an organization
 * (Admin only - typically called by webhooks or admin actions)
 */
export async function grantCredits(params: {
  organizationId: string;
  amount: number;
  source: CreditSource;
  description: string;
  stripeEventId?: string;
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
  createdBy?: string;
  sourceApp?: string;
  metadata?: Record<string, any>;
}): Promise<{
  transaction_id: string;
  balance_after: number;
}> {
  try {
    const { data, error } = await (supabase as any).rpc('sp_grant_credits', {
      p_organization_id: params.organizationId,
      p_amount: params.amount,
      p_source: params.source,
      p_description: params.description,
      p_stripe_event_id: params.stripeEventId,
      p_stripe_payment_intent_id: params.stripePaymentIntentId,
      p_stripe_checkout_session_id: params.stripeCheckoutSessionId,
      p_created_by: params.createdBy,
      p_source_app: params.sourceApp || 'crm',
      p_metadata: params.metadata
    });

    if (error) {
      // Handle RPC function not found gracefully
      if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('NetworkError')) {
        console.warn('[Billing] Grant credits RPC not available');
        throw new Error('Credit system not available');
      }
      console.error('Failed to grant credits:', error);
      throw new Error(`Failed to grant credits: ${error.message}`);
    }

    return data as {
      transaction_id: string;
      balance_after: number;
    };
  } catch (err: any) {
    if (err.message === 'Credit system not available') {
      throw err;
    }
    console.warn('[Billing] Grant credits failed:', err);
    throw new Error('Credit system not available');
  }
}

/**
 * Get paginated credit transaction history
 */
export async function getCreditHistory(
  organizationId: string,
  limit: number = 50,
  offset: number = 0
): Promise<CreditHistoryResult> {
  try {
    const { data, error } = await (supabase as any).rpc('sp_get_credit_history', {
      p_organization_id: organizationId,
      p_limit: limit,
      p_offset: offset
    });

    if (error) {
      // Handle RPC function not found gracefully
      if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('NetworkError')) {
        console.warn('[Billing] Credit history RPC not available, returning empty');
        return { transactions: [], total_count: 0, has_more: false };
      }
      console.error('Failed to get credit history:', error);
      return { transactions: [], total_count: 0, has_more: false };
    }

    const transactions = (data as any[]) || [];
    
    return {
      transactions: transactions as CreditTransaction[],
      total_count: transactions.length,
      has_more: transactions.length === limit
    };
  } catch (err) {
    console.warn('[Billing] Credit history fetch failed, returning empty:', err);
    return { transactions: [], total_count: 0, has_more: false };
  }
}

/**
 * Get available credit packs
 */
export async function getCreditPacks(): Promise<CreditPack[]> {
  const { data, error } = await (supabase as any)
    .from('credit_packs')
    .select('id, credits, stripe_price_id, discount_percentage')
    .eq('is_active', true)
    .order('display_order');

  if (error) {
    // PGRST205 = table doesn't exist
    if (error.code === 'PGRST205') {
      console.warn('[Billing] credit_packs table not found, returning empty array');
      return [];
    }
    console.error('Failed to get credit packs:', error);
    throw new Error(`Failed to get credit packs: ${error.message}`);
  }

  return data as CreditPack[];
}

/**
 * Get usage rates for features
 */
export async function getUsageRates(): Promise<UsageRate[]> {
  const { data, error } = await (supabase as any)
    .from('usage_rates')
    .select('feature_type, credits_per_use')
    .eq('is_active', true)
    .order('feature_type');

  if (error) {
    console.error('Failed to get usage rates:', error);
    throw new Error(`Failed to get usage rates: ${error.message}`);
  }

  return data as UsageRate[];
}

/**
 * Check if organization has sufficient credits for an action
 */
export async function hasEnoughCredits(
  organizationId: string,
  featureType: FeatureType,
  quantity: number = 1
): Promise<boolean> {
  try {
    // Get current balance
    const balance = await getCreditBalance(organizationId);
    
    // Get cost for this feature
    const { data: rates, error } = await (supabase as any)
      .from('usage_rates')
      .select('credits_per_use')
      .eq('feature_type', featureType)
      .eq('is_active', true)
      .single();

    if (error || !rates) {
      console.error('Failed to get usage rate:', error);
      return false;
    }

    const totalCost = rates.credits_per_use * quantity;
    return balance >= totalCost;
  } catch (error) {
    console.error('Error checking credit balance:', error);
    return false;
  }
}

/**
 * Get cost for a feature
 */
export async function getFeatureCost(featureType: FeatureType): Promise<number> {
  const { data, error } = await (supabase as any)
    .from('usage_rates')
    .select('credits_per_use')
    .eq('feature_type', featureType)
    .eq('is_active', true)
    .single();

  if (error) {
    console.error('Failed to get feature cost:', error);
    throw new Error(`Failed to get feature cost: ${error.message}`);
  }

  return data.credits_per_use;
}

/**
 * Create a Stripe checkout session for purchasing credits or subscription
 * @returns The checkout URL to redirect the user to
 */
export async function createCheckoutSession(params: {
  priceId: string;
  mode: 'subscription' | 'payment';
  organizationId: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<{ url: string; sessionId: string }> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !sessionData?.session) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const response = await fetch(`${supabaseUrl}/functions/v1/stripe-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionData.session.access_token}`,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to create checkout session');
  }

  return await response.json();
}

/**
 * Get billing profile for an organization
 */
export async function getBillingProfile(organizationId: string): Promise<{
  id: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_status?: string;
  subscription_plan?: string;
  subscription_started_at?: string;
  subscription_ends_at?: string;
} | null> {
  const { data, error } = await (supabase as any)
    .from('billing_profiles')
    .select('*')
    .eq('organization_id', organizationId)
    .single();

  if (error) {
    // PGRST116 = no rows found, PGRST205 = table doesn't exist
    if (error.code === 'PGRST116' || error.code === 'PGRST205') {
      if (error.code === 'PGRST205') {
        console.warn('[Billing] billing_profiles table not found, returning null');
      }
      return null;
    }
    console.error('Failed to get billing profile:', error);
    throw new Error(`Failed to get billing profile: ${error.message}`);
  }

  return data;
}

/**
 * Check if organization has an active subscription
 */
export async function hasActiveSubscription(organizationId: string): Promise<boolean> {
  if (isExemptOrganization(organizationId)) {
    return true;
  }

  const profile = await getBillingProfile(organizationId);
  return profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';
}

/**
 * Get all active plan definitions
 */
export async function getPlanDefinitions(): Promise<PlanDefinition[]> {
  const { data, error } = await (supabase as any)
    .from('plan_definitions')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  if (error) {
    // PGRST205 = table doesn't exist
    if (error.code === 'PGRST205') {
      console.warn('[Billing] plan_definitions table not found, returning empty array');
      return [];
    }
    console.error('Failed to get plan definitions:', error);
    throw new Error(`Failed to get plan definitions: ${error.message}`);
  }

  return data as PlanDefinition[];
}

/**
 * Get a specific plan by name
 */
export async function getPlanByName(name: PlanName): Promise<PlanDefinition | null> {
  const { data, error } = await (supabase as any)
    .from('plan_definitions')
    .select('*')
    .eq('name', name)
    .eq('is_active', true)
    .single();

  if (error) {
    // PGRST116 = no rows found, PGRST205 = table doesn't exist
    if (error.code === 'PGRST116' || error.code === 'PGRST205') {
      if (error.code === 'PGRST205') {
        console.warn('[Billing] plan_definitions table not found, using defaults');
      }
      return null;
    }
    console.error('Failed to get plan:', error);
    throw new Error(`Failed to get plan: ${error.message}`);
  }

  return data as PlanDefinition;
}

/**
 * Create a signup request to track the signup flow
 */
export async function createSignupRequest(params: {
  email: string;
  planName?: PlanName;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  referrer?: string;
  landingPage?: string;
}): Promise<SignupRequest | null> {
  const { data, error } = await (supabase as any)
    .from('signup_requests')
    .insert({
      email: params.email,
      plan_name: params.planName,
      utm_source: params.utmSource,
      utm_medium: params.utmMedium,
      utm_campaign: params.utmCampaign,
      utm_term: params.utmTerm,
      utm_content: params.utmContent,
      referrer: params.referrer,
      landing_page: params.landingPage,
      status: 'pending'
    })
    .select()
    .single();

  if (error) {
    // PGRST205 = table doesn't exist
    if (error.code === 'PGRST205') {
      console.warn('[Billing] signup_requests table not found, skipping');
      return null;
    }
    console.error('Failed to create signup request:', error);
    throw new Error(`Failed to create signup request: ${error.message}`);
  }

  return data as SignupRequest;
}

/**
 * Update signup request status
 */
export async function updateSignupRequest(
  requestId: string, 
  updates: Partial<{
    status: 'pending' | 'completed' | 'abandoned' | 'failed';
    organizationId: string;
    userId: string;
    stripeCheckoutSessionId: string;
  }>
): Promise<SignupRequest | null> {
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString()
  };
  
  if (updates.status) updateData.status = updates.status;
  if (updates.organizationId) updateData.organization_id = updates.organizationId;
  if (updates.userId) updateData.user_id = updates.userId;
  if (updates.stripeCheckoutSessionId) updateData.stripe_checkout_session_id = updates.stripeCheckoutSessionId;
  if (updates.status === 'completed') updateData.completed_at = new Date().toISOString();

  const { data, error } = await (supabase as any)
    .from('signup_requests')
    .update(updateData)
    .eq('id', requestId)
    .select()
    .single();

  if (error) {
    // PGRST205 = table doesn't exist
    if (error.code === 'PGRST205') {
      console.warn('[Billing] signup_requests table not found, skipping update');
      return null;
    }
    console.error('Failed to update signup request:', error);
    throw new Error(`Failed to update signup request: ${error.message}`);
  }

  return data as SignupRequest;
}

/**
 * Constants for credit costs (for display purposes)
 */
export const CREDIT_COSTS = {
  video_generation: 25,
  post_generation: 2,
  ai_assistant: 0.5,
  property_extraction: 10,
  email_send: 0.2,
  image_enhancement: 5
} as const;

/**
 * Constants for trial credits
 */
export const TRIAL_CREDITS = 100;
