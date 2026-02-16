import { useState } from 'react';
import { Building2, Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

interface Organization {
  id: string;
  slug: string;
  business_name: string;
  is_active: boolean;
}

export const OrganizationSwitcher = () => {
  const { user, isSuperAdmin, startImpersonation, impersonationState } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const { data: organizations, isLoading, refetch } = useQuery({
    queryKey: ['all-organizations'],
    queryFn: async () => {
      if (!user) return [];

      // Use SECURITY DEFINER RPC to get organizations (bypasses RLS)
      // Function uses auth.uid() internally for security
      const { data, error } = await (supabase.rpc as any)('get_impersonatable_organizations');

      if (error) {
        console.error('Failed to load organizations:', error);
        throw error;
      }
      return (data || []) as Organization[];
    },
    enabled: isSuperAdmin && open,
  });

  const filteredOrgs = organizations?.filter((org) =>
    org.business_name.toLowerCase().includes(search.toLowerCase()) ||
    org.slug.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectOrg = async (orgId: string) => {
    try {
      setSelectedOrgId(orgId);
      await startImpersonation(orgId, reason || 'Support/debugging');
      toast({
        title: 'Impersonation started',
        description: 'You are now viewing this organization',
      });
      setOpen(false);
      setReason('');
      setSelectedOrgId(null);
    } catch (error) {
      console.error('Failed to start impersonation:', error);
      toast({
        title: 'Error',
        description: 'Failed to start impersonation session',
        variant: 'destructive',
      });
      setSelectedOrgId(null);
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" data-testid="button-organization-switcher">
          <Building2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle data-testid="text-organization-switcher-title">
            Switch Organization
          </DialogTitle>
          <DialogDescription>
            Select an organization to impersonate for support or debugging
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search organizations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-organization-search"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              data-testid="button-refresh-organizations"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Reason (optional)
            </label>
            <Textarea
              placeholder="e.g., Investigating customer issue #123"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-20"
              data-testid="input-impersonation-reason"
            />
          </div>

          <ScrollArea className="h-[300px] border rounded-md">
            {isLoading && (
              <div className="p-4 text-center text-muted-foreground" data-testid="text-loading">
                Loading organizations...
              </div>
            )}

            {filteredOrgs && filteredOrgs.length === 0 && (
              <div className="p-4 text-center text-muted-foreground" data-testid="text-no-results">
                No organizations found
              </div>
            )}

            {filteredOrgs?.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSelectOrg(org.id)}
                disabled={selectedOrgId === org.id || org.id === impersonationState?.organizationId}
                className="w-full text-left p-3 hover-elevate active-elevate-2 border-b last:border-b-0 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid={`button-select-org-${org.slug}`}
              >
                <div className="font-medium">{org.business_name}</div>
                <div className="text-sm text-muted-foreground">
                  {org.slug}
                  {!org.is_active && <span className="text-destructive ml-2">(Inactive)</span>}
                  {org.id === impersonationState?.organizationId && (
                    <span className="text-primary ml-2">(Current)</span>
                  )}
                </div>
              </button>
            ))}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
