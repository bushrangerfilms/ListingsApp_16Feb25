-- Shared translations table for AutoListing and Socials apps
-- Both apps can query this table to get translations

CREATE TABLE IF NOT EXISTS public.i18n_translations (
  id SERIAL PRIMARY KEY,
  locale VARCHAR(10) NOT NULL DEFAULT 'en-IE',
  namespace VARCHAR(50) NOT NULL,
  key VARCHAR(255) NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(locale, namespace, key)
);

CREATE INDEX IF NOT EXISTS idx_i18n_translations_locale_ns 
  ON public.i18n_translations(locale, namespace);

ALTER TABLE public.i18n_translations ENABLE ROW LEVEL SECURITY;

-- Anyone can read translations (they're not sensitive)
CREATE POLICY "i18n_public_read" ON public.i18n_translations
  FOR SELECT USING (true);

-- Only super_admins/developers can modify
CREATE POLICY "i18n_admin_modify" ON public.i18n_translations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role IN ('super_admin', 'developer')
    )
  );

COMMENT ON TABLE public.i18n_translations IS 'Shared translations for AutoListing and Socials apps';

-- Insert shared common translations
INSERT INTO public.i18n_translations (locale, namespace, key, value) VALUES
-- Buttons
('en-IE', 'common', 'buttons.save', 'Save'),
('en-IE', 'common', 'buttons.cancel', 'Cancel'),
('en-IE', 'common', 'buttons.delete', 'Delete'),
('en-IE', 'common', 'buttons.edit', 'Edit'),
('en-IE', 'common', 'buttons.create', 'Create'),
('en-IE', 'common', 'buttons.add', 'Add'),
('en-IE', 'common', 'buttons.remove', 'Remove'),
('en-IE', 'common', 'buttons.close', 'Close'),
('en-IE', 'common', 'buttons.confirm', 'Confirm'),
('en-IE', 'common', 'buttons.submit', 'Submit'),
('en-IE', 'common', 'buttons.back', 'Back'),
('en-IE', 'common', 'buttons.next', 'Next'),
('en-IE', 'common', 'buttons.search', 'Search'),
('en-IE', 'common', 'buttons.filter', 'Filter'),
('en-IE', 'common', 'buttons.refresh', 'Refresh'),
('en-IE', 'common', 'buttons.export', 'Export'),
('en-IE', 'common', 'buttons.import', 'Import'),
('en-IE', 'common', 'buttons.view', 'View'),
('en-IE', 'common', 'buttons.viewAll', 'View All'),
('en-IE', 'common', 'buttons.signIn', 'Sign In'),
('en-IE', 'common', 'buttons.signUp', 'Sign Up'),
('en-IE', 'common', 'buttons.signOut', 'Sign Out'),

-- Labels
('en-IE', 'common', 'labels.name', 'Name'),
('en-IE', 'common', 'labels.email', 'Email'),
('en-IE', 'common', 'labels.phone', 'Phone'),
('en-IE', 'common', 'labels.address', 'Address'),
('en-IE', 'common', 'labels.description', 'Description'),
('en-IE', 'common', 'labels.status', 'Status'),
('en-IE', 'common', 'labels.type', 'Type'),
('en-IE', 'common', 'labels.date', 'Date'),
('en-IE', 'common', 'labels.actions', 'Actions'),
('en-IE', 'common', 'labels.settings', 'Settings'),
('en-IE', 'common', 'labels.organisation', 'Organisation'),

-- Status
('en-IE', 'common', 'status.active', 'Active'),
('en-IE', 'common', 'status.inactive', 'Inactive'),
('en-IE', 'common', 'status.pending', 'Pending'),
('en-IE', 'common', 'status.completed', 'Completed'),
('en-IE', 'common', 'status.cancelled', 'Cancelled'),
('en-IE', 'common', 'status.failed', 'Failed'),
('en-IE', 'common', 'status.draft', 'Draft'),

-- Messages
('en-IE', 'common', 'messages.loading', 'Loading...'),
('en-IE', 'common', 'messages.saving', 'Saving...'),
('en-IE', 'common', 'messages.saved', 'Saved successfully'),
('en-IE', 'common', 'messages.deleted', 'Deleted successfully'),
('en-IE', 'common', 'messages.error', 'An error occurred'),
('en-IE', 'common', 'messages.noResults', 'No results found'),
('en-IE', 'common', 'messages.confirmDelete', 'Are you sure you want to delete this?'),

-- Validation
('en-IE', 'common', 'validation.required', 'This field is required'),
('en-IE', 'common', 'validation.invalidEmail', 'Please enter a valid email address'),
('en-IE', 'common', 'validation.invalidPhone', 'Please enter a valid phone number'),

-- Billing namespace - shared between apps
('en-IE', 'billing', 'credits.title', 'Credits'),
('en-IE', 'billing', 'credits.balance', 'Credit Balance'),
('en-IE', 'billing', 'credits.purchase', 'Purchase Credits'),
('en-IE', 'billing', 'credits.topUp', 'Top Up'),
('en-IE', 'billing', 'credits.history', 'Credit History'),
('en-IE', 'billing', 'subscription.title', 'Subscription'),
('en-IE', 'billing', 'subscription.currentPlan', 'Current Plan'),
('en-IE', 'billing', 'subscription.upgrade', 'Upgrade'),
('en-IE', 'billing', 'subscription.trial', 'Free Trial'),
('en-IE', 'billing', 'plans.starter.name', 'Starter'),
('en-IE', 'billing', 'plans.starter.description', 'Perfect for individual agents'),
('en-IE', 'billing', 'plans.pro.name', 'Pro'),
('en-IE', 'billing', 'plans.pro.description', 'For growing agencies'),
('en-IE', 'billing', 'pricing.perMonth', 'per month'),
('en-IE', 'billing', 'pricing.vat', 'VAT'),
('en-IE', 'billing', 'pricing.vatIncluded', 'VAT included'),
('en-IE', 'billing', 'payment.method', 'Payment Method'),
('en-IE', 'billing', 'payment.success', 'Payment successful'),
('en-IE', 'billing', 'payment.failed', 'Payment failed')

ON CONFLICT (locale, namespace, key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
