import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Building2, Mail, Globe } from "lucide-react";

import AdminOrganizationSettings from "./AdminOrganizationSettings";
import AdminEmailSettings from "./AdminEmailSettings";
import AdminWebsiteSettings from "./AdminWebsiteSettings";

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
          <AdminWebsiteSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
