import { useEffect } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { PlatformHeader } from "@/components/PlatformHeader";
import { useDynamicFavicon } from "@/hooks/use-dynamic-favicon";
import { WelcomeModal } from "@/components/onboarding";
import { useOnboardingAutoDetect } from "@/hooks/useOnboardingAutoDetect";
import { UKPreviewBanner } from "@/components/admin/UKPreviewBanner";
import { useLocalePreview } from "@/hooks/useLocalePreview";
import { useOrganization } from "@/contexts/OrganizationContext";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  useDynamicFavicon({});
  useOnboardingAutoDetect();
  const { clearPreview } = useLocalePreview();
  const { organization } = useOrganization();

  useEffect(() => {
    if (organization?.business_name) {
      document.title = `${organization.business_name} - AutoListing.io Admin`;
    }
  }, [organization?.business_name]);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 min-w-0">
          <UKPreviewBanner onDisable={clearPreview} />
          <PlatformHeader />
          <main className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
            {children}
          </main>
        </SidebarInset>
      </div>
      <WelcomeModal />
    </SidebarProvider>
  );
}
