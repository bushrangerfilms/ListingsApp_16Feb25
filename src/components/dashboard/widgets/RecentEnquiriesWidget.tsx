import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import { formatDistanceToNow } from "date-fns";
import { Mail, Phone } from "lucide-react";

export const RecentEnquiriesWidget = () => {
  const { organization } = useOrganization();
  const { viewAsOrganizationId, selectedOrganization, isOrganizationView } = useOrganizationView();
  
  const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;

  const { data: enquiries } = useQuery({
    queryKey: ["dashboard-recent-enquiries", targetOrg?.id],
    queryFn: async () => {
      if (!targetOrg) return [];
      
      const { data } = await supabase
        .from("property_enquiries")
        .select("*")
        .eq("organization_id", targetOrg.id)
        .order("created_at", { ascending: false })
        .limit(5);

      return data || [];
    },
  });

  return (
    <div className="space-y-3">
      {enquiries?.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No enquiries yet</p>
      ) : (
        enquiries?.map((enquiry) => (
          <div key={enquiry.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
            <div className="p-2 rounded-lg bg-muted">
              <Mail className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{enquiry.name}</p>
              <p className="text-xs text-muted-foreground truncate">{enquiry.property_title}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(enquiry.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
