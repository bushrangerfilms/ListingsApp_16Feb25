import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import { EmailSettingsCard } from "@/components/EmailSettingsCard";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function AdminEmailSettings() {
  const { organization, loading } = useOrganization();
  const { selectedOrganization, isOrganizationView } = useOrganizationView();

  const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!targetOrg) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Organization Found</CardTitle>
          <CardDescription>You are not associated with any organization</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Email Settings</h2>
        <p className="text-muted-foreground">Configure how emails are sent from your organization</p>
      </div>

      <EmailSettingsCard organizationId={targetOrg.id} />
    </div>
  );
}
