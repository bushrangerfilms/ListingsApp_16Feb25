import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi, AuditLogEntry } from '@/lib/admin/adminApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Search, RefreshCw, ChevronLeft, ChevronRight, Eye, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useSuperAdminPermissions } from '@/hooks/useSuperAdminPermissions';

const ACTION_TYPE_CATEGORIES = [
  { value: 'all', label: 'All Actions' },
  { value: 'user', label: 'User Actions' },
  { value: 'gdpr', label: 'GDPR Actions' },
  { value: 'credit', label: 'Credit Actions' },
  { value: 'flag', label: 'Feature Flags' },
  { value: 'discount', label: 'Discount Codes' },
  { value: 'alert', label: 'Alert Rules' },
  { value: 'impersonation', label: 'Impersonation' },
];

const PAGE_SIZE = 25;

export default function AuditLogPage() {
  const { hasSuperAdminAccess, loading: authLoading } = useSuperAdminPermissions();
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['admin-audit-log', actionFilter, searchQuery, page],
    queryFn: () => adminApi.auditLog.list({
      search: searchQuery || undefined,
      actionType: actionFilter !== 'all' ? actionFilter : undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    staleTime: 30000,
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  const getActionBadgeVariant = (actionType: string): "default" | "secondary" | "destructive" | "outline" => {
    if (actionType.includes('delete') || actionType.includes('reject')) return 'destructive';
    if (actionType.includes('create') || actionType.includes('grant')) return 'default';
    if (actionType.includes('update') || actionType.includes('toggle')) return 'secondary';
    return 'outline';
  };

  const formatActionType = (actionType: string) => {
    return actionType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="p-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium">Failed to load audit logs</p>
              <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Audit Log</h1>
          <p className="text-muted-foreground">Track all administrative actions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isRefetching}
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Badge variant="secondary">Read-only</Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by action, target..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(0);
                }}
                className="pl-9"
                data-testid="input-search-audit"
              />
            </div>
            <Select 
              value={actionFilter} 
              onValueChange={(v) => {
                setActionFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[180px]" data-testid="select-action-filter">
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data?.logs && data.logs.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[80px]">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map((log) => (
                    <TableRow key={log.id} data-testid={`row-audit-${log.id}`}>
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(log.action_type)}>
                          {formatActionType(log.action_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.actor_email || (
                          <span className="text-muted-foreground font-mono text-xs">
                            {log.actor_id?.slice(0, 8) || 'System'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.target_type && (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {log.target_type}
                            </Badge>
                            {log.target_id && (
                              <span className="font-mono text-xs text-muted-foreground">
                                {log.target_id.length > 12 ? `${log.target_id.slice(0, 12)}...` : log.target_id}
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setSelectedLog(log)}
                          data-testid={`button-view-${log.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1} - {Math.min((page + 1) * PAGE_SIZE, data.total)} of {data.total} entries
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p - 1)}
                    disabled={page === 0}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= totalPages - 1}
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">No audit log entries found</p>
              {(searchQuery || actionFilter !== 'all') && (
                <Button 
                  variant="link" 
                  onClick={() => { setSearchQuery(''); setActionFilter('all'); }}
                  className="mt-2"
                >
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retention Policy</CardTitle>
          <CardDescription>How long audit logs are kept</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b">
              <span>Financial/Billing Data</span>
              <Badge variant="outline">7 years</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span>GDPR-related Actions</span>
              <Badge variant="outline">6 years</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span>Impersonation Sessions</span>
              <Badge variant="outline">3 years</Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <span>General Admin Actions</span>
              <Badge variant="outline">2 years</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Action</p>
                  <Badge variant={getActionBadgeVariant(selectedLog.action_type)} className="mt-1">
                    {formatActionType(selectedLog.action_type)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date</p>
                  <p className="text-sm mt-1">{format(new Date(selectedLog.created_at), 'PPpp')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Actor</p>
                  <p className="text-sm mt-1 font-mono">{selectedLog.actor_email || selectedLog.actor_id || 'System'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Target</p>
                  <p className="text-sm mt-1">
                    {selectedLog.target_type && (
                      <Badge variant="outline" className="mr-2">{selectedLog.target_type}</Badge>
                    )}
                    <span className="font-mono text-xs">{selectedLog.target_id || '-'}</span>
                  </p>
                </div>
              </div>

              {selectedLog.before_state && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Before State</p>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.before_state, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.after_state && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">After State</p>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.after_state, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.metadata && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Metadata</p>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
