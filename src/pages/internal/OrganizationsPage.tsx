import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, OrganizationWithCounts } from '@/lib/admin/adminApi';
import { useSuperAdminPermissions } from '@/hooks/useSuperAdminPermissions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Search, Building2, Users, ExternalLink, ChevronLeft, ChevronRight, Coins, X, Loader2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { OrganizationDetailDrawer } from '@/components/admin/OrganizationDetailDrawer';

const PAGE_SIZE = 20;

export default function OrganizationsPage() {
  const { isSuperAdmin, hasSuperAdminAccess, loading: authLoading } = useSuperAdminPermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCreditsOpen, setBulkCreditsOpen] = useState(false);
  const [bulkCreditsAmount, setBulkCreditsAmount] = useState('');
  const [bulkCreditsReason, setBulkCreditsReason] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { data: orgsData, isLoading, error } = useQuery({
    queryKey: ['admin-organizations', searchQuery, statusFilter, currentPage],
    queryFn: () => adminApi.organizations.list({
      search: searchQuery || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      page: currentPage,
      pageSize: PAGE_SIZE,
    }),
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const organizations = orgsData?.organizations;
  const totalCount = orgsData?.total ?? 0;

  const bulkGrantMutation = useMutation({
    mutationFn: async ({ orgIds, amount, reason }: { orgIds: string[]; amount: number; reason: string }) => {
      const results = await Promise.allSettled(
        orgIds.map(orgId => adminApi.credits.grant({ organization_id: orgId, amount, reason }))
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
        throw new Error(`${failed} of ${orgIds.length} grants failed`);
      }
      return results.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      setBulkCreditsOpen(false);
      setBulkCreditsAmount('');
      setBulkCreditsReason('');
      setSelectedIds(new Set());
      toast({ title: `Credits granted to ${count} organisations` });
    },
    onError: (error: Error) => {
      toast({ title: 'Bulk grant failed', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (orgIds: string[]) => {
      return adminApi.organizations.delete(orgIds);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      setDeleteConfirmOpen(false);
      setSelectedIds(new Set());
      
      const failedResults = data.results?.filter((r) => !r.success) || [];
      if (failedResults.length > 0) {
        const errors = failedResults.map((r) => r.error).join('; ');
        toast({ 
          title: data.message, 
          description: errors,
          variant: 'destructive' 
        });
      } else {
        toast({ title: data.message });
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    },
  });

  const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE);

  const currentPageIds = useMemo(() => {
    return organizations?.map(org => org.id) || [];
  }, [organizations]);

  const allSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedIds.has(id));
  const someSelected = currentPageIds.some(id => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      const newSelected = new Set(selectedIds);
      currentPageIds.forEach(id => newSelected.delete(id));
      setSelectedIds(newSelected);
    } else {
      const newSelected = new Set(selectedIds);
      currentPageIds.forEach(id => newSelected.add(id));
      setSelectedIds(newSelected);
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkGrant = () => {
    const amount = parseFloat(bulkCreditsAmount);
    if (!amount || amount <= 0) {
      toast({ title: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }
    bulkGrantMutation.mutate({
      orgIds: Array.from(selectedIds),
      amount,
      reason: bulkCreditsReason || 'Bulk admin credit grant',
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Organisations</h1>
          <p className="text-muted-foreground">Manage all tenant organisations</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {totalCount ?? '...'} total
        </Badge>
      </div>

      {selectedIds.size > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Badge variant="default" data-testid="badge-selected-count">{selectedIds.size} selected</Badge>
              <Button variant="ghost" size="sm" onClick={clearSelection} data-testid="button-clear-selection">
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
            {isSuperAdmin && (
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setBulkCreditsOpen(true)}
                  data-testid="button-bulk-grant-credits"
                >
                  <Coins className="h-4 w-4 mr-2" />
                  Grant Credits
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => setDeleteConfirmOpen(true)}
                  data-testid="button-delete-organizations"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, slug, or email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(0);
                }}
                className="pl-9"
                data-testid="input-search-organizations"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(0);
              }}
            >
              <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">
              Failed to load organisations
            </div>
          ) : organizations?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No organisations found
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                        data-testid="checkbox-select-all"
                        className={someSelected && !allSelected ? 'opacity-50' : ''}
                      />
                    </TableHead>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-center">Users</TableHead>
                    <TableHead className="text-center">Listings</TableHead>
                    <TableHead className="text-center">Credits</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizations?.map((org) => (
                    <TableRow
                      key={org.id}
                      className={`cursor-pointer hover-elevate ${selectedIds.has(org.id) ? 'bg-primary/5' : ''}`}
                      onClick={() => setSelectedOrgId(org.id)}
                      data-testid={`row-organization-${org.id}`}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(org.id)}
                          onCheckedChange={() => {}}
                          onClick={(e) => toggleSelect(org.id, e)}
                          aria-label={`Select ${org.business_name}`}
                          data-testid={`checkbox-org-${org.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {org.logo_url ? (
                            <img
                              src={org.logo_url}
                              alt={org.business_name}
                              className="h-8 w-8 rounded object-cover"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-medium">{org.business_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-1.5 py-0.5 rounded">{org.slug}</code>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {org.contact_name && <div>{org.contact_name}</div>}
                          {org.contact_email && (
                            <div className="text-muted-foreground">{org.contact_email}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{org.user_count}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{org.listing_count}</TableCell>
                      <TableCell className="text-center">
                        {org.credit_balance_redacted ? (
                          <Badge variant="secondary" className="text-xs" data-testid={`text-credit-balance-${org.id}-redacted`}>
                            Restricted
                          </Badge>
                        ) : (
                          <Badge
                            variant={org.credit_balance !== null && org.credit_balance < 100 ? 'destructive' : 'outline'}
                            className="text-xs"
                            data-testid={`text-credit-balance-${org.id}`}
                          >
                            <Coins className="h-3 w-3 mr-1" />
                            {org.credit_balance?.toFixed(0) ?? '0'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={org.is_active ? 'default' : 'secondary'}>
                          {org.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {org.created_at ? format(new Date(org.created_at), 'MMM d, yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        {org.domain && (
                          <a
                            href={`https://${org.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage + 1} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={currentPage >= totalPages - 1}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <OrganizationDetailDrawer
        organizationId={selectedOrgId}
        open={!!selectedOrgId}
        onClose={() => setSelectedOrgId(null)}
      />

      <Dialog open={bulkCreditsOpen} onOpenChange={setBulkCreditsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Credits to {selectedIds.size} Organisations</DialogTitle>
            <DialogDescription>
              This will grant the same amount of credits to all selected organisations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Credit Amount</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                value={bulkCreditsAmount}
                onChange={(e) => setBulkCreditsAmount(e.target.value)}
                placeholder="e.g., 50"
                data-testid="input-bulk-credits-amount"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                value={bulkCreditsReason}
                onChange={(e) => setBulkCreditsReason(e.target.value)}
                placeholder="Why are you granting these credits?"
                data-testid="input-bulk-credits-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkCreditsOpen(false)} data-testid="button-cancel-bulk">
              Cancel
            </Button>
            <Button 
              onClick={handleBulkGrant}
              disabled={bulkGrantMutation.isPending}
              data-testid="button-confirm-bulk-grant"
            >
              {bulkGrantMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Grant {bulkCreditsAmount || '0'} credits each
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} Organisation{selectedIds.size > 1 ? 's' : ''}?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the selected organisation{selectedIds.size > 1 ? 's' : ''} and all associated data including listings, users, billing history, and CRM data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => deleteMutation.mutate(Array.from(selectedIds))}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete {selectedIds.size} Organisation{selectedIds.size > 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
