import { useOrganizationView } from '@/contexts/OrganizationViewContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const OrganizationViewSelector = () => {
  const {
    isSuperAdmin,
    organizations,
    isLoadingOrganizations,
    viewAsOrganizationId,
    setViewAsOrganization,
    clearOrganizationView,
    selectedOrganization,
    isOrganizationView,
  } = useOrganizationView();

  // Only show for super admins
  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={viewAsOrganizationId || 'none'}
        onValueChange={(value) => {
          if (value === 'none') {
            clearOrganizationView();
          } else {
            setViewAsOrganization(value);
          }
        }}
        disabled={isLoadingOrganizations}
      >
        <SelectTrigger className="w-[200px] h-9 bg-background border-border">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="View as organization..." />
          </div>
        </SelectTrigger>
        <SelectContent className="bg-background border-border z-50">
          <SelectItem value="none">
            <span className="text-muted-foreground">Super Admin View (All Clients)</span>
          </SelectItem>
          {organizations.map((org) => (
            <SelectItem key={org.id} value={org.id}>
              <div className="flex items-center gap-2">
                {org.logo_url && (
                  <img
                    src={org.logo_url}
                    alt=""
                    className="max-h-5 w-auto object-contain"
                  />
                )}
                <span>{org.business_name}</span>
                {!org.is_active && (
                  <span className="text-xs text-muted-foreground">(Inactive)</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isOrganizationView && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearOrganizationView}
          className="h-9 px-2"
          title="Clear organization view"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
