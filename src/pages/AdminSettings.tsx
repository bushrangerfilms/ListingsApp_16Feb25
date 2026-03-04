import { useState, Component, type ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Building2, Mail, Globe, AlertTriangle } from "lucide-react";

import AdminOrganizationSettings from "./AdminOrganizationSettings";
import AdminEmailSettings from "./AdminEmailSettings";
import AdminWebsiteSettings from "./AdminWebsiteSettings";

// Error boundary to prevent tab crashes from resetting the entire page
class TabErrorBoundary extends Component<
  { children: ReactNode; tabName: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; tabName: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-12 gap-4 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <h3 className="text-lg font-semibold">Failed to load {this.props.tabName}</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            className="text-sm text-primary underline"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState("organization");

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your platform settings and tools</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full h-auto flex-wrap gap-1 justify-start p-1 mb-6">
          <TabsTrigger value="organization" className="gap-2" data-testid="tab-organization">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Organization</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2" data-testid="tab-email">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Email</span>
          </TabsTrigger>
          <TabsTrigger value="website" className="gap-2" data-testid="tab-website">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Website</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="mt-0">
          <AdminOrganizationSettings />
        </TabsContent>
        <TabsContent value="email" className="mt-0">
          <AdminEmailSettings />
        </TabsContent>
        <TabsContent value="website" className="mt-0">
          <TabErrorBoundary tabName="Website Settings">
            <AdminWebsiteSettings />
          </TabErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}
