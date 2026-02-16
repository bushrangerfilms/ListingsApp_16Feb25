import { useMemo, useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { OrganizationProvider } from "./contexts/OrganizationContext";
import { OrganizationViewProvider } from "./contexts/OrganizationViewContext";
import { PublicListingsProvider, usePublicListings } from "./contexts/PublicListingsContext";
import { LocaleProvider } from "./lib/i18n/LocaleProvider";
import { LocalePreviewProvider } from "./components/admin/LocalePreviewProvider";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { OrganizationRoute } from "./components/OrganizationRoute";
import { PilotModeRouteGuard } from "./components/admin/PilotModeRouteGuard";
import { ImpersonationBanner } from "./components/ImpersonationBanner";
import { AdminLayout } from "./components/AdminLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { getDomainType, type DomainType } from "./lib/domainDetection";
import { useMarketingVisibleFlag, usePublicSignupFlag } from "./hooks/useFeatureFlag";

// Marketing Pages
import MarketingHome from "./pages/marketing/MarketingHome";
import PricingPage from "./pages/marketing/PricingPage";
import FeaturesPage from "./pages/marketing/FeaturesPage";
import SupportPage from "./pages/marketing/SupportPage";

// Public Pages
import PublicListings from "./pages/PublicListings";
import PropertyDetails from "./pages/PropertyDetails";
import ValuationRequest from "./pages/ValuationRequest";
import UpdateAlertPreferences from "./pages/UpdateAlertPreferences";
import EmailPreferences from "./pages/EmailPreferences";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsConditions from "./pages/TermsConditions";
import CookiePolicy from "./pages/CookiePolicy";

// Admin Pages - Consolidated Hubs
import AdminAnalyticsHub from "./pages/AdminAnalyticsHub";
import AdminCommunicationsHub from "./pages/AdminCommunicationsHub";
import AdminEmailTemplates from "./pages/AdminEmailTemplates";
import AdminCRM from "./pages/AdminCRM";
import AdminSettings from "./pages/AdminSettings";

// Admin Pages - Core Operations
import ListingsDashboard from "./pages/ListingsDashboard";
import CreateListing from "./pages/CreateListing";
import ReviewListing from "./pages/ReviewListing";
import AdminBilling from "./pages/AdminBilling";
import AdminUsers from "./pages/AdminUsers";

// Auth Pages
import AdminLogin from "./pages/AdminLogin";
import AdminDevLogin from "./pages/AdminDevLogin";
import AdminSignup from "./pages/AdminSignup";
import OrganizationSignup from "./pages/OrganizationSignup";
import AcceptInvitation from "./pages/AcceptInvitation";
import ResetPassword from "./pages/ResetPassword";

// Signup Flow
import SignupWizard from "./pages/signup/SignupWizard";
import SignupSuccess from "./pages/signup/SignupSuccess";
import PilotAccessRequest from "./pages/PilotAccessRequest";

// Billing Pages
import ManageSubscription from "./pages/billing/ManageSubscription";
import UpgradeToPro from "./pages/billing/UpgradeToPro";

// Utility
import NotFound from "./pages/NotFound";

// Lead Magnet Pages
import LeadMagnetQuiz from "./pages/lead-magnet/LeadMagnetQuiz";

// Super Admin Portal
import { SuperAdminRouteGuard } from "./components/admin/SuperAdminRouteGuard";
import { SuperAdminOnlyRouteGuard } from "./components/admin/SuperAdminOnlyRouteGuard";
import { SuperAdminLayout } from "./components/admin/SuperAdminLayout";
import SuperAdminDashboard from "./pages/internal/SuperAdminDashboard";
import OrganizationsPage from "./pages/internal/OrganizationsPage";
import UsersPage from "./pages/internal/UsersPage";
import BillingDashboardPage from "./pages/internal/BillingDashboardPage";
import AuditLogPage from "./pages/internal/AuditLogPage";
import DiscountCodesPage from "./pages/internal/DiscountCodesPage";
import FeatureFlagsPage from "./pages/internal/FeatureFlagsPage";
import SupportToolsPage from "./pages/internal/SupportToolsPage";
import AnalyticsPage from "./pages/internal/AnalyticsPage";
import GdprCompliancePage from "./pages/internal/GdprCompliancePage";
import AlertsPage from "./pages/internal/AlertsPage";
import EmailQueuePage from "./pages/internal/EmailQueuePage";
import UsageRatesPage from "./pages/internal/UsageRatesPage";
import AITrainingPage from "./pages/internal/AITrainingPage";
import VideoMusicPage from "./pages/internal/VideoMusicPage";
import PilotSettingsPage from "./pages/internal/PilotSettingsPage";
import ImageUpscalingPage from "./pages/internal/ImageUpscalingPage";

const queryClient = new QueryClient();

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
    <Routes>
      <Route path="/" element={<Navigate to="/admin/login" replace />} />
      <Route path="/marketing" element={<MarketingHome />} />
      
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
      <Route path="/admin/analytics" element={<ProtectedRoute><PilotModeRouteGuard><AdminLayout><AdminAnalyticsHub /></AdminLayout></PilotModeRouteGuard></ProtectedRoute>} />
      <Route path="/admin/crm" element={<ProtectedRoute><PilotModeRouteGuard><AdminLayout><AdminCRM /></AdminLayout></PilotModeRouteGuard></ProtectedRoute>} />
      <Route path="/admin/communications" element={<ProtectedRoute><PilotModeRouteGuard><AdminLayout><AdminCommunicationsHub /></AdminLayout></PilotModeRouteGuard></ProtectedRoute>} />
      <Route path="/admin/email-templates" element={<ProtectedRoute><PilotModeRouteGuard><AdminLayout><AdminEmailTemplates /></AdminLayout></PilotModeRouteGuard></ProtectedRoute>} />
      <Route path="/admin/billing" element={<ProtectedRoute><PilotModeRouteGuard><AdminLayout><AdminBilling /></AdminLayout></PilotModeRouteGuard></ProtectedRoute>} />
      <Route path="/admin/billing/manage" element={<ProtectedRoute><PilotModeRouteGuard><AdminLayout><ManageSubscription /></AdminLayout></PilotModeRouteGuard></ProtectedRoute>} />
      <Route path="/admin/billing/upgrade" element={<ProtectedRoute><PilotModeRouteGuard><AdminLayout><UpgradeToPro /></AdminLayout></PilotModeRouteGuard></ProtectedRoute>} />
      <Route path="/admin/team" element={<ProtectedRoute><PilotModeRouteGuard><AdminLayout><AdminUsers /></AdminLayout></PilotModeRouteGuard></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute><PilotModeRouteGuard><AdminLayout><AdminSettings /></AdminLayout></PilotModeRouteGuard></ProtectedRoute>} />
      
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
      <Route path="/internal/usage-rates" element={<SuperAdminOnlyRouteGuard><SuperAdminLayout><UsageRatesPage /></SuperAdminLayout></SuperAdminOnlyRouteGuard>} />
      <Route path="/internal/ai-training" element={<SuperAdminOnlyRouteGuard><SuperAdminLayout><AITrainingPage /></SuperAdminLayout></SuperAdminOnlyRouteGuard>} />
      <Route path="/internal/video-music" element={<SuperAdminOnlyRouteGuard><SuperAdminLayout><VideoMusicPage /></SuperAdminLayout></SuperAdminOnlyRouteGuard>} />
      <Route path="/internal/pilot" element={<SuperAdminOnlyRouteGuard><SuperAdminLayout><PilotSettingsPage /></SuperAdminLayout></SuperAdminOnlyRouteGuard>} />
      <Route path="/internal/image-upscaling" element={<SuperAdminOnlyRouteGuard><SuperAdminLayout><ImageUpscalingPage /></SuperAdminLayout></SuperAdminOnlyRouteGuard>} />
      
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
      
      {/* Dynamic org routes - these match any single-segment path */}
      <Route path="/:orgSlug" element={<OrganizationRoute><PublicListings /></OrganizationRoute>} />
      <Route path="/:orgSlug/property/:id" element={<OrganizationRoute><PropertyDetails /></OrganizationRoute>} />
      <Route path="/:orgSlug/request-valuation" element={<OrganizationRoute><ValuationRequest /></OrganizationRoute>} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function OrgPublicRoutes() {
  return (
    <Routes>
      <Route path="/" element={<OrganizationRoute><PublicListings /></OrganizationRoute>} />
      <Route path="/property/:id" element={<OrganizationRoute><PropertyDetails /></OrganizationRoute>} />
      <Route path="/request-valuation" element={<OrganizationRoute><ValuationRequest /></OrganizationRoute>} />
      {/* Also support slug-based routes on custom domains for compatibility */}
      <Route path="/:orgSlug" element={<OrganizationRoute><PublicListings /></OrganizationRoute>} />
      <Route path="/:orgSlug/property/:id" element={<OrganizationRoute><PropertyDetails /></OrganizationRoute>} />
      <Route path="/:orgSlug/request-valuation" element={<OrganizationRoute><ValuationRequest /></OrganizationRoute>} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-conditions" element={<TermsConditions />} />
      <Route path="/cookie-policy" element={<CookiePolicy />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
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
    <ErrorBoundary>
      {domainType === 'admin' && <ImpersonationBanner />}
      <AppRoutes domainType={domainType} />
    </ErrorBoundary>
  );
}

const App = () => {
  const domainType = useMemo(() => getDomainType(), []);
  
  return (
    <QueryClientProvider client={queryClient}>
      <LocalePreviewProvider>
        <AuthProvider>
          <OrganizationViewProvider>
            <OrganizationProvider>
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
