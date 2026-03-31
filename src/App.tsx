import * as Sentry from "@sentry/react";
import { Suspense, useMemo, useState, useEffect } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { OrganizationProvider, useOrganization } from "./contexts/OrganizationContext";
import { OrganizationViewProvider } from "./contexts/OrganizationViewContext";
import { PublicListingsProvider, usePublicListings } from "./contexts/PublicListingsContext";
import { LocaleProvider } from "./lib/i18n/LocaleProvider";
import { useLocaleContext } from "./lib/i18n/LocaleProvider";
import { LocalePreviewProvider } from "./components/admin/LocalePreviewProvider";
import { SUPPORTED_LOCALES, type SupportedLocale } from "./lib/i18n";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { OrganizationRoute } from "./components/OrganizationRoute";
import { PilotModeRouteGuard } from "./components/admin/PilotModeRouteGuard";
import { ImpersonationBanner } from "./components/ImpersonationBanner";
import { AdminLayout } from "./components/AdminLayout";
import { RouteErrorBoundary } from "./components/ErrorBoundary";
import { getDomainType, type DomainType } from "./lib/domainDetection";
import { useMarketingVisibleFlag, usePublicSignupFlag } from "./hooks/useFeatureFlag";

// Super Admin route guards and layout (eager — lightweight wrappers)
import { SuperAdminRouteGuard } from "./components/admin/SuperAdminRouteGuard";
import { SuperAdminOnlyRouteGuard } from "./components/admin/SuperAdminOnlyRouteGuard";
import { SuperAdminLayout } from "./components/admin/SuperAdminLayout";

// --- Lazy-loaded pages by domain group ---

// Marketing Pages
const MarketingHome = lazyWithRetry(() => import("./pages/marketing/MarketingHome"));
const PricingPage = lazyWithRetry(() => import("./pages/marketing/PricingPage"));
const FeaturesPage = lazyWithRetry(() => import("./pages/marketing/FeaturesPage"));
const SupportPage = lazyWithRetry(() => import("./pages/marketing/SupportPage"));

// Public Pages
const PublicListings = lazyWithRetry(() => import("./pages/PublicListings"));
const PropertyDetails = lazyWithRetry(() => import("./pages/PropertyDetails"));
const ValuationRequest = lazyWithRetry(() => import("./pages/ValuationRequest"));
const UpdateAlertPreferences = lazyWithRetry(() => import("./pages/UpdateAlertPreferences"));
const EmailPreferences = lazyWithRetry(() => import("./pages/EmailPreferences"));
const PrivacyPolicy = lazyWithRetry(() => import("./pages/PrivacyPolicy"));
const TermsConditions = lazyWithRetry(() => import("./pages/TermsConditions"));
const CookiePolicy = lazyWithRetry(() => import("./pages/CookiePolicy"));

// Admin Pages
const AdminAnalyticsHub = lazyWithRetry(() => import("./pages/AdminAnalyticsHub"));
const AdminCommunicationsHub = lazyWithRetry(() => import("./pages/AdminCommunicationsHub"));
const AdminEmailTemplates = lazyWithRetry(() => import("./pages/AdminEmailTemplates"));
const AdminCRM = lazyWithRetry(() => import("./pages/AdminCRM"));
const AdminSettings = lazyWithRetry(() => import("./pages/AdminSettings"));
const ListingsDashboard = lazyWithRetry(() => import("./pages/ListingsDashboard"));
const CreateListing = lazyWithRetry(() => import("./pages/CreateListing"));
const ReviewListing = lazyWithRetry(() => import("./pages/ReviewListing"));
const BrochureEditor = lazyWithRetry(() => import("./pages/BrochureEditor"));
const AdminBilling = lazyWithRetry(() => import("./pages/AdminBilling"));
const AdminUsers = lazyWithRetry(() => import("./pages/AdminUsers"));
const ShopWindowDisplay = lazyWithRetry(() => import("./pages/ShopWindowDisplay"));
const AdminShopWindowDisplay = lazyWithRetry(() => import("./pages/AdminShopWindowDisplay"));

// Auth Pages
const AdminLogin = lazyWithRetry(() => import("./pages/AdminLogin"));
const AdminDevLogin = lazyWithRetry(() => import("./pages/AdminDevLogin"));
const AdminSignup = lazyWithRetry(() => import("./pages/AdminSignup"));
const OrganizationSignup = lazyWithRetry(() => import("./pages/OrganizationSignup"));
const AcceptInvitation = lazyWithRetry(() => import("./pages/AcceptInvitation"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));

// Signup Flow
const SignupWizard = lazyWithRetry(() => import("./pages/signup/SignupWizard"));
const SignupSuccess = lazyWithRetry(() => import("./pages/signup/SignupSuccess"));
const PilotAccessRequest = lazyWithRetry(() => import("./pages/PilotAccessRequest"));

// Billing Pages
const ManageSubscription = lazyWithRetry(() => import("./pages/billing/ManageSubscription"));
const UpgradeToPro = lazyWithRetry(() => import("./pages/billing/UpgradeToPro"));

// Utility
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

// Lead Magnet Pages
const LeadMagnetQuiz = lazyWithRetry(() => import("./pages/lead-magnet/LeadMagnetQuiz"));

// Super Admin Portal Pages
const SuperAdminDashboard = lazyWithRetry(() => import("./pages/internal/SuperAdminDashboard"));
const OrganizationsPage = lazyWithRetry(() => import("./pages/internal/OrganizationsPage"));
const UsersPage = lazyWithRetry(() => import("./pages/internal/UsersPage"));
const BillingDashboardPage = lazyWithRetry(() => import("./pages/internal/BillingDashboardPage"));
const AuditLogPage = lazyWithRetry(() => import("./pages/internal/AuditLogPage"));
const DiscountCodesPage = lazyWithRetry(() => import("./pages/internal/DiscountCodesPage"));
const FeatureFlagsPage = lazyWithRetry(() => import("./pages/internal/FeatureFlagsPage"));
const SupportToolsPage = lazyWithRetry(() => import("./pages/internal/SupportToolsPage"));
const AnalyticsPage = lazyWithRetry(() => import("./pages/internal/AnalyticsPage"));
const GdprCompliancePage = lazyWithRetry(() => import("./pages/internal/GdprCompliancePage"));
const AlertsPage = lazyWithRetry(() => import("./pages/internal/AlertsPage"));
const EmailQueuePage = lazyWithRetry(() => import("./pages/internal/EmailQueuePage"));
const FailedPostsPage = lazyWithRetry(() => import("./pages/internal/FailedPostsPage"));
const UsageRatesPage = lazyWithRetry(() => import("./pages/internal/UsageRatesPage"));
const AITrainingPage = lazyWithRetry(() => import("./pages/internal/AITrainingPage"));
const VideoMusicPage = lazyWithRetry(() => import("./pages/internal/VideoMusicPage"));
const PilotSettingsPage = lazyWithRetry(() => import("./pages/internal/PilotSettingsPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,      // 30s — avoids refetch on every mount
      gcTime: 300_000,         // 5min — keep unused data in cache
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
  mutationCache: new MutationCache({
    onError: (error) => {
      // Only capture server errors (5xx) to Sentry, not user validation errors
      if (error instanceof Error && /^5\d\d/.test(error.message)) {
        Sentry.captureException(error, { tags: { source: 'react-query-mutation' } });
      }
    },
  }),
});

function GlobalLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function MarketingRoutes() {
  const { isEnabled: isMarketingVisible, isLoading } = useMarketingVisibleFlag();
  
  // During pilot mode (marketing not visible), redirect to login
  if (!isLoading && !isMarketingVisible) {
    // Redirect to the admin login page
    window.location.href = 'https://app.autolisting.io/admin/login';
    return null;
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }
  
  return (
    <Suspense fallback={<GlobalLoadingFallback />}>
      <Routes>
        <Route path="/" element={<MarketingHome />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-conditions" element={<TermsConditions />} />
        <Route path="/cookie-policy" element={<CookiePolicy />} />
        <Route path="/signup" element={<SignupWizard />} />
        <Route path="/signup/success" element={<SignupSuccess />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

function SignupGate({ children }: { children: React.ReactNode }) {
  const { isEnabled: isPublicSignupEnabled, isLoading } = usePublicSignupFlag();
  const [searchParams] = useSearchParams();
  const isInvited = searchParams.get('invited') === 'true';
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [cachedEnabled, setCachedEnabled] = useState(false);
  
  // Cache the flag result after initial load to prevent form unmount on refetch
  useEffect(() => {
    if (!isLoading && !hasInitiallyLoaded) {
      setHasInitiallyLoaded(true);
      setCachedEnabled(isPublicSignupEnabled);
    }
  }, [isLoading, hasInitiallyLoaded, isPublicSignupEnabled]);
  
  // Only show loading on initial load, not on refetch (prevents form data loss)
  if (isLoading && !hasInitiallyLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }
  
  if (isInvited) {
    return <>{children}</>;
  }
  
  // Use cached value to prevent unmounting during refetch
  const signupEnabled = hasInitiallyLoaded ? cachedEnabled : isPublicSignupEnabled;
  
  if (!signupEnabled) {
    return <PilotAccessRequest />;
  }
  
  return <>{children}</>;
}

function AdminRoutes() {
  return (
    <Suspense fallback={<GlobalLoadingFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/login" replace />} />
        <Route path="/marketing" element={<MarketingHome />} />

        <Route path="/login" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dev-login" element={<AdminDevLogin />} />
        <Route path="/signup" element={<SignupGate><SignupWizard /></SignupGate>} />
        <Route path="/signup/success" element={<SignupSuccess />} />
        <Route path="/signup/legacy" element={<SignupGate><OrganizationSignup /></SignupGate>} />
        <Route path="/admin/signup" element={<SignupGate><AdminSignup /></SignupGate>} />
        <Route path="/pilot-access" element={<PilotAccessRequest />} />

        <Route path="/admin/listings" element={<ProtectedRoute><PilotModeRouteGuard><AdminLayout><ListingsDashboard /></AdminLayout></PilotModeRouteGuard></ProtectedRoute>} />
        <Route path="/admin/create" element={<ProtectedRoute><PilotModeRouteGuard><AdminLayout><CreateListing /></AdminLayout></PilotModeRouteGuard></ProtectedRoute>} />
        <Route path="/admin/review-listing" element={<ProtectedRoute><PilotModeRouteGuard><AdminLayout><ReviewListing /></AdminLayout></PilotModeRouteGuard></ProtectedRoute>} />
        <Route path="/admin/brochure/:listingId" element={<ProtectedRoute><PilotModeRouteGuard><AdminLayout><BrochureEditor /></AdminLayout></PilotModeRouteGuard></ProtectedRoute>} />
        <Route path="/admin/analytics" element={<ProtectedRoute><PilotModeRouteGuard><AdminLayout><AdminAnalyticsHub /></AdminLayout></PilotModeRouteGuard></ProtectedRoute>} />
        <Route path="/admin/crm" element={<ProtectedRoute><PilotModeRouteGuard><AdminLayout><AdminCRM /></AdminLayout></PilotModeRouteGuard></ProtectedRoute>} />
        <Route path="/admin/communications" element={<ProtectedRoute><PilotModeRouteGuard><AdminLayout><AdminCommunicationsHub /></AdminLayout></PilotModeRouteGuard></ProtectedRoute>} />
        <Route path="/admin/email-templates" element={<ProtectedRoute><PilotModeRouteGuard><AdminLayout><AdminEmailTemplates /></AdminLayout></PilotModeRouteGuard></ProtectedRoute>} />
        <Route path="/admin/billing" element={<ProtectedRoute><PilotModeRouteGuard><AdminLayout><AdminBilling /></AdminLayout></PilotModeRouteGuard></ProtectedRoute>} />
        <Route path="/admin/billing/manage" element={<ProtectedRoute><PilotModeRouteGuard><AdminLayout><ManageSubscription /></AdminLayout></PilotModeRouteGuard></ProtectedRoute>} />
        <Route path="/admin/billing/upgrade" element={<ProtectedRoute><PilotModeRouteGuard><AdminLayout><UpgradeToPro /></AdminLayout></PilotModeRouteGuard></ProtectedRoute>} />
        <Route path="/admin/team" element={<ProtectedRoute><PilotModeRouteGuard><AdminLayout><AdminUsers /></AdminLayout></PilotModeRouteGuard></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute><PilotModeRouteGuard><AdminLayout><AdminSettings /></AdminLayout></PilotModeRouteGuard></ProtectedRoute>} />
        <Route path="/admin/shop-window-settings" element={<ProtectedRoute><PilotModeRouteGuard><AdminLayout><AdminShopWindowDisplay /></AdminLayout></PilotModeRouteGuard></ProtectedRoute>} />
        <Route path="/admin/shop-window" element={<ProtectedRoute><ShopWindowDisplay /></ProtectedRoute>} />

        {/* Super Admin Portal Routes */}
        <Route path="/internal" element={<SuperAdminRouteGuard><SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout></SuperAdminRouteGuard>} />
        <Route path="/internal/organizations" element={<SuperAdminRouteGuard><SuperAdminLayout><OrganizationsPage /></SuperAdminLayout></SuperAdminRouteGuard>} />
        <Route path="/internal/users" element={<SuperAdminRouteGuard><SuperAdminLayout><UsersPage /></SuperAdminLayout></SuperAdminRouteGuard>} />
        <Route path="/internal/billing" element={<SuperAdminRouteGuard><SuperAdminLayout><BillingDashboardPage /></SuperAdminLayout></SuperAdminRouteGuard>} />
        <Route path="/internal/discounts" element={<SuperAdminRouteGuard><SuperAdminLayout><DiscountCodesPage /></SuperAdminLayout></SuperAdminRouteGuard>} />
        <Route path="/internal/feature-flags" element={<SuperAdminRouteGuard><SuperAdminLayout><FeatureFlagsPage /></SuperAdminLayout></SuperAdminRouteGuard>} />
        <Route path="/internal/support" element={<SuperAdminRouteGuard><SuperAdminLayout><SupportToolsPage /></SuperAdminLayout></SuperAdminRouteGuard>} />
        <Route path="/internal/analytics" element={<SuperAdminRouteGuard><SuperAdminLayout><AnalyticsPage /></SuperAdminLayout></SuperAdminRouteGuard>} />
        <Route path="/internal/gdpr" element={<SuperAdminRouteGuard><SuperAdminLayout><GdprCompliancePage /></SuperAdminLayout></SuperAdminRouteGuard>} />
        <Route path="/internal/alerts" element={<SuperAdminOnlyRouteGuard><SuperAdminLayout><AlertsPage /></SuperAdminLayout></SuperAdminOnlyRouteGuard>} />
        <Route path="/internal/audit-log" element={<SuperAdminRouteGuard><SuperAdminLayout><AuditLogPage /></SuperAdminLayout></SuperAdminRouteGuard>} />
        <Route path="/internal/email-queue" element={<SuperAdminRouteGuard><SuperAdminLayout><EmailQueuePage /></SuperAdminLayout></SuperAdminRouteGuard>} />
        <Route path="/internal/failed-posts" element={<SuperAdminOnlyRouteGuard><SuperAdminLayout><FailedPostsPage /></SuperAdminLayout></SuperAdminOnlyRouteGuard>} />
        <Route path="/internal/usage-rates" element={<SuperAdminOnlyRouteGuard><SuperAdminLayout><UsageRatesPage /></SuperAdminLayout></SuperAdminOnlyRouteGuard>} />
        <Route path="/internal/ai-training" element={<SuperAdminOnlyRouteGuard><SuperAdminLayout><AITrainingPage /></SuperAdminLayout></SuperAdminOnlyRouteGuard>} />
        <Route path="/internal/video-music" element={<SuperAdminOnlyRouteGuard><SuperAdminLayout><VideoMusicPage /></SuperAdminLayout></SuperAdminOnlyRouteGuard>} />
        <Route path="/internal/pilot" element={<SuperAdminOnlyRouteGuard><SuperAdminLayout><PilotSettingsPage /></SuperAdminLayout></SuperAdminOnlyRouteGuard>} />

        <Route path="/alert-preferences/:token" element={<UpdateAlertPreferences />} />
        <Route path="/email-preferences" element={<EmailPreferences />} />
        <Route path="/accept-invitation" element={<AcceptInvitation />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-conditions" element={<TermsConditions />} />
        <Route path="/cookie-policy" element={<CookiePolicy />} />

        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/support" element={<SupportPage />} />

        {/* Lead Magnet Public Routes */}
        <Route path="/lead-magnet/:orgSlug/:quizType" element={<LeadMagnetQuiz />} />

        {/* Static public routes MUST come before dynamic :orgSlug routes */}
        <Route path="/property/:id" element={<OrganizationRoute><PropertyDetails /></OrganizationRoute>} />
        <Route path="/request-valuation" element={<OrganizationRoute><ValuationRequest /></OrganizationRoute>} />
        {/* Legal pages — must come before dynamic :orgSlug routes */}
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-conditions" element={<TermsConditions />} />
        <Route path="/cookie-policy" element={<CookiePolicy />} />

        {/* Dynamic org routes - these match any single-segment path */}
        <Route path="/:orgSlug" element={<OrganizationRoute><PublicListings /></OrganizationRoute>} />
        <Route path="/:orgSlug/property/:id" element={<OrganizationRoute><PropertyDetails /></OrganizationRoute>} />
        <Route path="/:orgSlug/request-valuation" element={<OrganizationRoute><ValuationRequest /></OrganizationRoute>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

function OrgPublicRoutes() {
  return (
    <Suspense fallback={<GlobalLoadingFallback />}>
      <Routes>
        {/* Quiz route on custom domains — org detected from hostname */}
        <Route path="/quiz/:quizType" element={<LeadMagnetQuiz />} />
        <Route path="/" element={<OrganizationRoute><PublicListings /></OrganizationRoute>} />
        <Route path="/property/:id" element={<OrganizationRoute><PropertyDetails /></OrganizationRoute>} />
        <Route path="/request-valuation" element={<OrganizationRoute><ValuationRequest /></OrganizationRoute>} />
        {/* Legal pages — must come before dynamic :orgSlug routes */}
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-conditions" element={<TermsConditions />} />
        <Route path="/cookie-policy" element={<CookiePolicy />} />
        {/* Also support slug-based routes on custom domains for compatibility */}
        <Route path="/:orgSlug" element={<OrganizationRoute><PublicListings /></OrganizationRoute>} />
        <Route path="/:orgSlug/property/:id" element={<OrganizationRoute><PropertyDetails /></OrganizationRoute>} />
        <Route path="/:orgSlug/request-valuation" element={<OrganizationRoute><ValuationRequest /></OrganizationRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

function AppRoutes({ domainType }: { domainType: DomainType }) {
  switch (domainType) {
    case 'marketing':
      return <MarketingRoutes />;
    case 'org-public':
      return <OrgPublicRoutes />;
    case 'admin':
    default:
      return <AdminRoutes />;
  }
}

function AuthAwareRoutes({ domainType }: { domainType: DomainType }) {
  const { loading: authLoading } = useAuth();
  const { loading: publicListingsLoading } = usePublicListings();
  
  // Show loading for admin portal during auth check
  if (authLoading && domainType === 'admin') {
    return <GlobalLoadingFallback />;
  }
  
  // Show loading for public org sites during organization detection
  if (publicListingsLoading && domainType === 'org-public') {
    return <GlobalLoadingFallback />;
  }
  
  return (
    <RouteErrorBoundary>
      {domainType === 'admin' && <ImpersonationBanner />}
      <AppRoutes domainType={domainType} />
    </RouteErrorBoundary>
  );
}

/**
 * Syncs the organization's locale from the database to the i18n system.
 * Must be rendered inside both OrganizationProvider and LocalePreviewProvider.
 * Without this, i18n defaults to browser language (e.g. en-US) instead of
 * the org's configured locale (e.g. en-IE), causing wrong address formats.
 */
function OrgLocaleSync() {
  const { organization } = useOrganization();
  const { setLocale } = useLocaleContext();

  useEffect(() => {
    if (organization?.locale && SUPPORTED_LOCALES.includes(organization.locale as SupportedLocale)) {
      setLocale(organization.locale as SupportedLocale);
    }
  }, [organization?.locale, setLocale]);

  return null;
}

const App = () => {
  const domainType = useMemo(() => getDomainType(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <LocalePreviewProvider>
        <AuthProvider>
          <OrganizationViewProvider>
            <OrganizationProvider>
              <OrgLocaleSync />
              <PublicListingsProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <BrowserRouter>
                    <AuthAwareRoutes domainType={domainType} />
                  </BrowserRouter>
                </TooltipProvider>
              </PublicListingsProvider>
            </OrganizationProvider>
          </OrganizationViewProvider>
        </AuthProvider>
      </LocalePreviewProvider>
    </QueryClientProvider>
  );
};

export default App;
