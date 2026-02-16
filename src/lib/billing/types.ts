/**
 * Billing System Types
 * Shared types for credit-based billing across CRM and Socials apps
 */

// Property Services Types (for organization settings)
export type PropertyService = 'sales' | 'rentals' | 'holiday_rentals';

export const PROPERTY_SERVICES: { value: PropertyService; label: string; description: string }[] = [
  { value: 'sales', label: 'Property Sales', description: 'List properties for sale' },
  { value: 'rentals', label: 'Lettings / Rentals', description: 'Long-term rental properties' },
  { value: 'holiday_rentals', label: 'Holiday Rentals', description: 'Short-term rentals with booking platform links (Airbnb, VRBO, etc.)' },
];

export const DEFAULT_PROPERTY_SERVICES: PropertyService[] = ['sales'];

export function getPropertyServiceLabel(service: PropertyService): string {
  const found = PROPERTY_SERVICES.find(s => s.value === service);
  return found?.label ?? service;
}

export function isServiceEnabled(services: PropertyService[] | undefined | null, service: PropertyService): boolean {
  if (!services || services.length === 0) {
    return service === 'sales'; // Default to sales only
  }
  return services.includes(service);
}

// Map listing category to property service
export function categoryToService(category: 'Listing' | 'Rental' | 'Holiday Rental'): PropertyService {
  switch (category) {
    case 'Listing': return 'sales';
    case 'Rental': return 'rentals';
    case 'Holiday Rental': return 'holiday_rentals';
  }
}

// Map property service to listing category
export function serviceToCategory(service: PropertyService): 'Listing' | 'Rental' | 'Holiday Rental' {
  switch (service) {
    case 'sales': return 'Listing';
    case 'rentals': return 'Rental';
    case 'holiday_rentals': return 'Holiday Rental';
  }
}

// Phase 2.5: Account Lifecycle Types
export type AccountStatus = 
  | 'trial'
  | 'active'
  | 'trial_expired'
  | 'payment_failed'
  | 'unsubscribed'
  | 'archived';

export interface AccountLifecycleState {
  account_status: AccountStatus;
  credit_spending_enabled: boolean;
  read_only_reason: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  grace_period_ends_at: string | null;
  archived_at: string | null;
}

export interface DunningEmail {
  id: string;
  organization_id: string;
  email_type: string;
  recipient_email: string | null;
  email_number: number;
  sent_at: string | null;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface AccountLifecycleLog {
  id: string;
  organization_id: string;
  previous_status: AccountStatus | null;
  new_status: AccountStatus;
  reason: string;
  triggered_by: 'signup' | 'webhook' | 'cron' | 'admin' | 'user';
  metadata?: Record<string, any>;
  created_at: string;
}

// Helper functions for trial lifecycle
export function isTrialActive(org: { account_status: AccountStatus; trial_ends_at: string | null }): boolean {
  if (org.account_status !== 'trial') return false;
  if (!org.trial_ends_at) return false;
  return new Date(org.trial_ends_at) > new Date();
}

export function getTrialDaysRemaining(trial_ends_at: string | null): number {
  if (!trial_ends_at) return 0;
  const endDate = new Date(trial_ends_at);
  const now = new Date();
  const diffMs = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function getGraceDaysRemaining(grace_period_ends_at: string | null): number {
  if (!grace_period_ends_at) return 0;
  const endDate = new Date(grace_period_ends_at);
  const now = new Date();
  const diffMs = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function isAccountActive(org: { account_status: AccountStatus; credit_spending_enabled: boolean }): boolean {
  return org.account_status === 'active' && org.credit_spending_enabled;
}

export function canSpendCredits(org: { credit_spending_enabled: boolean }): boolean {
  return org.credit_spending_enabled;
}

export function getAccountStatusLabel(status: AccountStatus): string {
  switch (status) {
    case 'trial': return 'Trial';
    case 'active': return 'Active';
    case 'trial_expired': return 'Trial Expired';
    case 'payment_failed': return 'Payment Failed';
    case 'unsubscribed': return 'Unsubscribed';
    case 'archived': return 'Archived';
  }
}

export function getAccountStatusColor(status: AccountStatus): string {
  switch (status) {
    case 'trial': return 'text-blue-600 dark:text-blue-400';
    case 'active': return 'text-green-600 dark:text-green-400';
    case 'trial_expired': return 'text-orange-600 dark:text-orange-400';
    case 'payment_failed': return 'text-red-600 dark:text-red-400';
    case 'unsubscribed': return 'text-yellow-600 dark:text-yellow-400';
    case 'archived': return 'text-gray-600 dark:text-gray-400';
  }
}

export type CreditSource = 
  | 'purchase'
  | 'subscription'
  | 'welcome_bonus'
  | 'admin_grant'
  | 'refund'
  | 'promotion';

export type FeatureType = 
  | 'post_generation'
  | 'video_generation'
  | 'image_enhancement'
  | 'ai_assistant'
  | 'property_extraction'
  | 'email_send';

export type PlanName = 'starter' | 'pro';

export interface PlanDefinition {
  id: string;
  name: PlanName;
  display_name: string;
  description?: string;
  price_cents: number;
  currency: string;
  billing_interval: 'month' | 'year';
  monthly_credits: number;
  max_users: number;
  stripe_product_id?: string;
  stripe_price_id?: string;
  features: string[];
  is_active: boolean;
  display_order: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SignupRequest {
  id: string;
  email: string;
  plan_name?: PlanName;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
  landing_page?: string;
  status: 'pending' | 'completed' | 'abandoned' | 'failed';
  organization_id?: string;
  user_id?: string;
  stripe_checkout_session_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
  completed_at?: string;
  updated_at: string;
}

export function getPlanPriceEur(plan: PlanDefinition): number {
  return plan.price_cents / 100;
}

export type TransactionType = 
  | 'credit'
  | 'debit';

export interface CreditTransaction {
  id: string;
  organization_id: string;
  transaction_type: TransactionType;
  amount: number;
  balance_after: number;
  source: CreditSource;
  description: string;
  stripe_event_id?: string;
  stripe_payment_intent_id?: string;
  stripe_checkout_session_id?: string;
  created_by?: string;
  source_app?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface CreditUsageEvent {
  id: string;
  transaction_id: string;
  feature_type: FeatureType;
  quantity: number;
  credits_consumed: number;
  user_id?: string;
  source_app?: string;
  request_id?: string;
  feature_details?: Record<string, any>;
  created_at: string;
}

export interface UsageRate {
  id: string;
  feature_type: FeatureType;
  credits_per_use: number;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreditPack {
  id: string;
  name: string;
  description?: string;
  credits: number;
  price_cents: number;
  currency: string;
  stripe_price_id?: string;
  stripe_product_id?: string;
  is_active: boolean;
  display_order: number;
  discount_percentage?: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Helper to convert price_cents to price_eur for display
export function getPriceEur(pack: CreditPack): number {
  return pack.price_cents / 100;
}

export interface BillingProfile {
  id: string;
  organization_id: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_status?: string;
  subscription_plan?: string;
  subscription_started_at?: string;
  subscription_ends_at?: string;
  billing_email?: string;
  // Phase 2.5: Payment tracking fields
  last_payment_failed_at?: string | null;
  payment_failure_count?: number;
  unsubscribed_at?: string | null;
  card_expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditBalance {
  organization_id: string;
  balance: number;
  last_transaction_at?: string;
}

export interface CreditHistoryResult {
  transactions: CreditTransaction[];
  total_count: number;
  has_more: boolean;
}

// UI Helper Types
export type BalanceStatus = 'healthy' | 'low' | 'critical' | 'empty';

export interface BalanceDisplayProps {
  balance: number;
  status: BalanceStatus;
}

export function getBalanceStatus(balance: number): BalanceStatus {
  if (balance === 0) return 'empty';
  if (balance < 10) return 'critical';
  if (balance < 20) return 'low';
  return 'healthy';
}

export function getBalanceColor(status: BalanceStatus): string {
  switch (status) {
    case 'healthy':
      return 'text-green-600 dark:text-green-400';
    case 'low':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'critical':
      return 'text-orange-600 dark:text-orange-400';
    case 'empty':
      return 'text-red-600 dark:text-red-400';
  }
}
