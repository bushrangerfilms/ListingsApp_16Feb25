-- Project Plans and Task Tracking System
-- Allows storing and tracking implementation plans (like the billing system rollout)
-- for better organization and progress monitoring

-- Step 1: Create project_plans table for high-level plans
CREATE TABLE IF NOT EXISTS public.project_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'completed', 'on_hold', 'cancelled')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  estimated_hours integer,
  start_date timestamptz,
  target_completion_date timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id)
);

-- Step 2: Create plan_tasks table for individual tasks within plans
CREATE TABLE IF NOT EXISTS public.plan_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.project_plans(id) ON DELETE CASCADE,
  task_number integer NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'cancelled')),
  complexity text CHECK (complexity IN ('simple', 'medium', 'complex')),
  dependencies integer[] DEFAULT ARRAY[]::integer[],
  phase text,
  estimated_hours decimal(4,1),
  actual_hours decimal(4,1),
  assigned_to uuid REFERENCES auth.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(plan_id, task_number)
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_plans_status ON public.project_plans(status);
CREATE INDEX IF NOT EXISTS idx_project_plans_priority ON public.project_plans(priority);
CREATE INDEX IF NOT EXISTS idx_project_plans_created_at ON public.project_plans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_tasks_plan_id ON public.plan_tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_tasks_status ON public.plan_tasks(status);
CREATE INDEX IF NOT EXISTS idx_plan_tasks_phase ON public.plan_tasks(phase);

-- Step 4: Enable RLS
ALTER TABLE public.project_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_tasks ENABLE ROW LEVEL SECURITY;

-- Step 5: RLS Policies for project_plans
-- Allow admins/developers to view plans (restrict sensitive business data)
CREATE POLICY "Admins can view project plans"
  ON public.project_plans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'developer', 'admin')
    )
  );

-- Allow admins and developers to manage plans
CREATE POLICY "Admins can manage project plans"
  ON public.project_plans FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'developer', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'developer', 'admin')
    )
  );

-- Service role full access
CREATE POLICY "Service role can manage project plans"
  ON public.project_plans FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 6: RLS Policies for plan_tasks
-- Allow admins/developers to view tasks (restrict sensitive business data)
CREATE POLICY "Admins can view plan tasks"
  ON public.plan_tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'developer', 'admin')
    )
  );

-- Allow admins and developers to manage tasks
CREATE POLICY "Admins can manage plan tasks"
  ON public.plan_tasks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'developer', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'developer', 'admin')
    )
  );

-- Service role full access
CREATE POLICY "Service role can manage plan tasks"
  ON public.plan_tasks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 7: Insert the Credit-Based Billing System Implementation Plan (Idempotent)
DO $$
DECLARE
  billing_plan_id uuid;
  plan_exists boolean;
BEGIN
  -- Check if plan already exists
  SELECT EXISTS (
    SELECT 1 FROM public.project_plans 
    WHERE name = 'Credit-Based Billing System Implementation'
  ) INTO plan_exists;

  -- Only insert if plan doesn't exist
  IF NOT plan_exists THEN
    -- Insert the main plan
    INSERT INTO public.project_plans (
    name,
    description,
    status,
    priority,
    estimated_hours,
    metadata
  ) VALUES (
    'Credit-Based Billing System Implementation',
    'Comprehensive implementation of Stripe-powered credit billing system for monetizing social media post and video generation features across CRM and Socials apps. Includes shared credit ledger, purchase flows, webhook handling, UI components, and cross-app integration.',
    'in_progress',
    'critical',
    40,
    jsonb_build_object(
      'architecture', jsonb_build_object(
        'database', 'Shared credit ledger in public schema',
        'payment_processor', 'Stripe Checkout Sessions',
        'integration_type', 'Multi-app credit pool',
        'security', 'RLS + SELECT FOR UPDATE for race conditions'
      ),
      'pricing_model', jsonb_build_object(
        'free_tier', '50 starter credits',
        'packs', jsonb_build_array(
          jsonb_build_object('credits', 100, 'price_eur', 10, 'discount', 0),
          jsonb_build_object('credits', 500, 'price_eur', 40, 'discount', 20),
          jsonb_build_object('credits', 2000, 'price_eur', 120, 'discount', 40)
        ),
        'costs', jsonb_build_object(
          'post_generation', 10,
          'video_generation', 40
        )
      ),
      'risks', jsonb_build_array(
        'Race conditions in concurrent deductions',
        'Webhook replay attacks',
        'Double-charging scenarios',
        'Performance impact of credit checks'
      ),
      'mitigations', jsonb_build_array(
        'SELECT FOR UPDATE with SERIALIZABLE isolation',
        'Unique stripe_event_id index for idempotency',
        'Cached balance view for fast lookups',
        'Comprehensive audit logging'
      )
    )
  )
  RETURNING id INTO billing_plan_id;

  -- Insert Phase 1 tasks (Database Foundation)
  INSERT INTO public.plan_tasks (plan_id, task_number, title, description, status, complexity, phase, estimated_hours, dependencies) VALUES
    (billing_plan_id, 1, 'Create billing database migration: Add enums (credit_source, feature_type, transaction_type) and initial tables structure', 'Create migration file with enum types for credit sources, feature types, and transaction types that will be used across all billing tables', 'in_progress', 'complex', 'Phase 1: Database Foundation', 1.0, ARRAY[]::integer[]),
    (billing_plan_id, 2, 'Create billing_profiles table with RLS policies linking organizations to Stripe customers', 'Table to map organizations to Stripe customer IDs and subscription IDs. Includes RLS policies for tenant isolation.', 'pending', 'medium', 'Phase 1: Database Foundation', 1.0, ARRAY[1]),
    (billing_plan_id, 3, 'Create credit_packs table with product catalog (100/500/2000 credit options) and Stripe price mappings', 'Product catalog table storing available credit pack sizes, prices, and their corresponding Stripe Price IDs', 'pending', 'medium', 'Phase 1: Database Foundation', 0.5, ARRAY[1]),
    (billing_plan_id, 4, 'Create credit_transactions ledger table with unique stripe_event_id index for idempotency and RLS policies', 'Immutable ledger table for all credit movements (+/-). Critical unique index on stripe_event_id prevents double-processing webhooks.', 'pending', 'complex', 'Phase 1: Database Foundation', 1.5, ARRAY[1, 2]),
    (billing_plan_id, 5, 'Create credit_usage_events table for detailed per-feature tracking with foreign keys to transactions', 'Detailed event log linking transactions to specific features (post/video generation) with metadata', 'pending', 'medium', 'Phase 1: Database Foundation', 1.0, ARRAY[1, 4]),
    (billing_plan_id, 6, 'Create usage_rates configuration table with costs per feature (post_generation=10, video_generation=40)', 'Configuration table defining credit costs for each feature type. Allows dynamic pricing changes.', 'pending', 'simple', 'Phase 1: Database Foundation', 0.5, ARRAY[1]),
    (billing_plan_id, 7, 'Create credit_balances materialized view for fast balance lookups with auto-refresh trigger', 'Materialized view aggregating credit_transactions for fast balance checks. Auto-refresh trigger on inserts.', 'pending', 'complex', 'Phase 1: Database Foundation', 1.5, ARRAY[4]),
    (billing_plan_id, 8, 'Create sp_get_credit_balance(org_id) stored procedure with SECURITY DEFINER for fast balance checks', 'RPC function for querying current balance. Uses SECURITY DEFINER to bypass RLS for performance.', 'pending', 'medium', 'Phase 1: Database Foundation', 1.0, ARRAY[7]),
    (billing_plan_id, 9, 'Create sp_consume_credits(org_id, feature_id, qty) with SELECT FOR UPDATE lock and SERIALIZABLE isolation to prevent race conditions', 'CRITICAL: Atomic credit deduction function. Uses row-level locking to prevent double-spend from concurrent requests.', 'pending', 'complex', 'Phase 1: Database Foundation', 2.0, ARRAY[4, 6, 7]),
    (billing_plan_id, 10, 'Create sp_grant_credits(org_id, amount, source, metadata) for adding credits from purchases/webhooks', 'Function to add credits to organization. Called by webhook handler after successful payments.', 'pending', 'medium', 'Phase 1: Database Foundation', 1.0, ARRAY[4]),
    (billing_plan_id, 11, 'Create sp_get_credit_history(org_id, limit, offset) for paginated transaction history', 'RPC function returning paginated transaction history for billing UI display', 'pending', 'simple', 'Phase 1: Database Foundation', 0.5, ARRAY[4]),
    (billing_plan_id, 12, 'Add helper function to compute action cost from usage_rates table with caching', 'Utility function to look up feature costs. Includes caching for performance.', 'pending', 'simple', 'Phase 1: Database Foundation', 0.5, ARRAY[6]),
    (billing_plan_id, 13, 'Test database migration in development: verify all tables, RLS policies, and stored procedures work correctly', 'Comprehensive testing of all database objects before proceeding to Stripe integration', 'pending', 'medium', 'Phase 1: Database Foundation', 1.0, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]);

  -- Insert Phase 2 tasks (Stripe Integration)
  INSERT INTO public.plan_tasks (plan_id, task_number, title, description, status, complexity, phase, estimated_hours, dependencies) VALUES
    (billing_plan_id, 14, 'Search and configure Stripe integration using Replit''s Stripe blueprint', 'Set up Stripe integration using Replit''s built-in blueprint for seamless secret management', 'pending', 'simple', 'Phase 2: Stripe Integration', 0.5, ARRAY[13]),
    (billing_plan_id, 15, 'Set up Stripe products and prices for credit packs (100/500/2000) and store Price IDs in credit_packs table', 'Create products in Stripe dashboard and link Price IDs to database records', 'pending', 'medium', 'Phase 2: Stripe Integration', 1.0, ARRAY[14, 3]),
    (billing_plan_id, 16, 'Create create-checkout-session edge function with rate limiting and auth guards', 'Supabase edge function to create Stripe Checkout sessions. Includes rate limiting to prevent abuse.', 'pending', 'complex', 'Phase 2: Stripe Integration', 2.0, ARRAY[14, 15]),
    (billing_plan_id, 17, 'Create stripe-webhook edge function with signature verification and idempotency handling', 'CRITICAL: Webhook handler with Stripe signature verification and event deduplication', 'pending', 'complex', 'Phase 2: Stripe Integration', 2.5, ARRAY[14, 10]),
    (billing_plan_id, 18, 'Implement webhook handlers for checkout.session.completed event (grant credits)', 'Process successful payments and grant credits using sp_grant_credits function', 'pending', 'complex', 'Phase 2: Stripe Integration', 1.5, ARRAY[17]),
    (billing_plan_id, 19, 'Implement webhook handlers for subscription events (invoice.payment_succeeded, customer.subscription.deleted)', 'Handle subscription billing and cancellations for Pro tier users', 'pending', 'medium', 'Phase 2: Stripe Integration', 1.5, ARRAY[17]),
    (billing_plan_id, 20, 'Add webhook event logging table and implement audit trail for all Stripe events', 'Log all webhook events for debugging, compliance, and audit purposes', 'pending', 'medium', 'Phase 2: Stripe Integration', 1.0, ARRAY[17]),
    (billing_plan_id, 21, 'Test Stripe integration using Stripe CLI for webhook testing and verify idempotency', 'Comprehensive testing with Stripe test mode and CLI webhook forwarding', 'pending', 'medium', 'Phase 2: Stripe Integration', 1.5, ARRAY[16, 17, 18, 19, 20]);

  -- Insert Phase 3 tasks (Shared Billing SDK)
  INSERT INTO public.plan_tasks (plan_id, task_number, title, description, status, complexity, phase, estimated_hours, dependencies) VALUES
    (billing_plan_id, 22, 'Create shared billing client SDK at src/lib/billing/billingClient.ts with typed functions', 'TypeScript SDK wrapping all billing RPCs for both CRM and Socials apps', 'pending', 'medium', 'Phase 3: Shared SDK', 1.5, ARRAY[8, 9, 11]),
    (billing_plan_id, 23, 'Create billing types file src/lib/billing/types.ts with FeatureType, CreditTransaction, and other interfaces', 'Shared TypeScript types for cross-app consistency', 'pending', 'simple', 'Phase 3: Shared SDK', 0.5, ARRAY[22]),
    (billing_plan_id, 24, 'Update Supabase types generation to include new billing tables', 'Regenerate TypeScript types from Supabase schema', 'pending', 'simple', 'Phase 3: Shared SDK', 0.5, ARRAY[13]);

  -- Insert Phase 4 tasks (CRM UI Components)
  INSERT INTO public.plan_tasks (plan_id, task_number, title, description, status, complexity, phase, estimated_hours, dependencies) VALUES
    (billing_plan_id, 25, 'Create CreditBalanceBadge component for header/sidebar with color-coded states and click-to-purchase', 'Visual component showing current credit balance with traffic light colors', 'pending', 'medium', 'Phase 4: UI Components', 1.0, ARRAY[22, 23]),
    (billing_plan_id, 26, 'Create PurchaseCreditsModal component with credit pack grid, pricing display, and Stripe Checkout redirect', 'Modal for purchasing credits, displays all pack options with savings calculations', 'pending', 'complex', 'Phase 4: UI Components', 2.0, ARRAY[16, 22, 23]),
    (billing_plan_id, 27, 'Create AdminBilling page with tabs: Overview, History, Usage Analytics', 'Main billing dashboard page accessible from admin navigation', 'pending', 'complex', 'Phase 4: UI Components', 2.5, ARRAY[22, 23]),
    (billing_plan_id, 28, 'Add billing history table component with filters, pagination, and CSV export', 'Transaction history table with date range filters and export functionality', 'pending', 'medium', 'Phase 4: UI Components', 1.5, ARRAY[27]),
    (billing_plan_id, 29, 'Create usage analytics dashboard with charts showing credit consumption by feature type', 'Recharts-based dashboard showing usage patterns over time', 'pending', 'complex', 'Phase 4: UI Components', 2.0, ARRAY[27]),
    (billing_plan_id, 30, 'Create LowBalanceToast component that shows when credits < 20 with persistent storage', 'Toast notification with localStorage to avoid repeated dismissals', 'pending', 'simple', 'Phase 4: UI Components', 0.5, ARRAY[25]),
    (billing_plan_id, 31, 'Create PaymentStatusBanner for success/failure messages after Stripe redirects', 'Banner component for Checkout return URLs showing payment status', 'pending', 'simple', 'Phase 4: UI Components', 0.5, ARRAY[26]),
    (billing_plan_id, 32, 'Add billing route to admin navigation and update PlatformHeader with credit badge', 'Integrate billing UI into existing admin navigation structure', 'pending', 'simple', 'Phase 4: UI Components', 0.5, ARRAY[25, 27]),
    (billing_plan_id, 33, 'Implement Stripe Checkout success/cancel callback pages with proper status handling', 'Pages for /billing/success and /billing/cancel routes', 'pending', 'medium', 'Phase 4: UI Components', 1.0, ARRAY[26, 31]);

  -- Insert Phase 5 tasks (Integration & Testing)
  INSERT INTO public.plan_tasks (plan_id, task_number, title, description, status, complexity, phase, estimated_hours, dependencies) VALUES
    (billing_plan_id, 34, 'Add welcome bonus: grant 50 free credits to new organizations on signup', 'Trigger function or edge function to grant starter credits on organization creation', 'pending', 'medium', 'Phase 5: Integration', 1.0, ARRAY[10]),
    (billing_plan_id, 35, 'Create backfill script to grant starter credits to existing organizations', 'One-time script to credit existing organizations with 50 starter credits', 'pending', 'simple', 'Phase 5: Integration', 0.5, ARRAY[34]),
    (billing_plan_id, 36, 'Add comprehensive error handling for insufficient credits across all credit-consuming features', 'User-friendly error messages and guidance when credits run out', 'pending', 'medium', 'Phase 5: Integration', 1.5, ARRAY[22, 30]),
    (billing_plan_id, 37, 'Test complete purchase flow: select pack → Stripe Checkout → webhook → balance update → UI refresh', 'End-to-end testing of the entire purchase and fulfillment cycle', 'pending', 'complex', 'Phase 5: Integration', 2.0, ARRAY[26, 33, 18]),
    (billing_plan_id, 38, 'Test concurrent credit deduction from multiple requests to verify race condition prevention', 'Load testing to verify SELECT FOR UPDATE prevents double-spend', 'pending', 'complex', 'Phase 5: Integration', 1.5, ARRAY[9]),
    (billing_plan_id, 39, 'Document billing SDK usage for Socials app team with example code and integration guide', 'Create comprehensive documentation for integrating billing into Socials app', 'pending', 'simple', 'Phase 5: Integration', 1.0, ARRAY[22, 23, 36]),
    (billing_plan_id, 40, 'Update replit.md with billing system architecture and cross-app coordination notes', 'Update project documentation with billing system overview', 'pending', 'simple', 'Phase 5: Integration', 0.5, ARRAY[39]);
  
  ELSE
    RAISE NOTICE 'Billing implementation plan already exists, skipping insertion';
  END IF;

END $$;

-- Success message
SELECT 'Project plans tracking system created and billing implementation plan stored successfully!' as result;
