import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, GdprRequest } from '@/lib/admin/adminApi';
import { useSuperAdminPermissions } from '@/hooks/useSuperAdminPermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Shield, 
  FileDown, 
  Trash2, 
  Clock,
  AlertTriangle,
  CheckCircle2,
  Plus,
  User,
  Building2,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

export default function GdprCompliancePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission, userRole, hasSuperAdminAccess, loading: authLoading } = useSuperAdminPermissions();
  const canExportData = hasPermission('canExportGDPRData');
  const isSuperAdmin = userRole === 'super_admin';

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [rejectDialogRequest, setRejectDialogRequest] = useState<GdprRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [exportingRequestId, setExportingRequestId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    request_type: 'data_export' as 'data_export' | 'data_deletion' | 'access_request',
    target_type: 'user' as 'user' | 'organization',
    target_id: '',
    target_email: '',
    notes: '',
  });

  const { data: requests, isLoading, error } = useQuery({
    queryKey: ['admin-gdpr-requests'],
    queryFn: () => adminApi.gdpr.getRequests(),
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const createRequestMutation = useMutation({
    mutationFn: () => adminApi.gdpr.createRequest({
      request_type: formData.request_type,
      target_type: formData.target_type,
      target_id: formData.target_id || undefined,
      target_email: formData.target_email || undefined,
      notes: formData.notes || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gdpr-requests'] });
      setIsCreateOpen(false);
      setFormData({
        request_type: 'data_export',
        target_type: 'user',
        target_id: '',
        target_email: '',
        notes: '',
      });
      toast({ title: 'GDPR request created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create request', description: error.message, variant: 'destructive' });
    },
  });

  const processRequestMutation = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: 'complete' | 'reject'; reason?: string }) =>
      adminApi.gdpr.processRequest(id, action, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gdpr-requests'] });
      setRejectDialogRequest(null);
      setRejectionReason('');
      toast({ title: 'Request updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update request', description: error.message, variant: 'destructive' });
    },
  });

  const exportDataMutation = useMutation({
    mutationFn: (requestId: string) => {
      setExportingRequestId(requestId);
      toast({ title: 'Generating data export...', description: 'This may take a moment' });
      return adminApi.gdpr.generateExport(requestId);
    },
    onSuccess: (data) => {
      const jsonStr = JSON.stringify(data.export_data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Data export downloaded successfully' });
      setExportingRequestId(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to generate export', description: error.message, variant: 'destructive' });
      setExportingRequestId(null);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'in_progress':
        return <Badge variant="outline"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
      case 'completed':
        return <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRequestTypeBadge = (type: string) => {
    switch (type) {
      case 'data_export':
        return <Badge variant="outline"><FileDown className="h-3 w-3 mr-1" />Export</Badge>;
      case 'data_deletion':
        return <Badge variant="destructive"><Trash2 className="h-3 w-3 mr-1" />Deletion</Badge>;
      case 'access_request':
        return <Badge variant="secondary"><Shield className="h-3 w-3 mr-1" />Access</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const pendingRequests = requests?.filter(r => r.status === 'pending' || r.status === 'in_progress') || [];
  const completedRequests = requests?.filter(r => r.status === 'completed' || r.status === 'rejected') || [];

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="p-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium">Failed to load GDPR requests</p>
              <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">GDPR Compliance</h1>
          <p className="text-muted-foreground">Manage data subject requests and compliance workflows</p>
        </div>
        {canExportData && (
          <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-request">
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-pending-requests">
              {pendingRequests.length}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting processing</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-completed-requests">
              {requests?.filter(r => r.status === 'completed').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Successfully processed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-rejected-requests">
              {requests?.filter(r => r.status === 'rejected').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Invalid or denied</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            History ({completedRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Requests</CardTitle>
              <CardDescription>Data subject requests awaiting action</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : pendingRequests.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Identifier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      {isSuperAdmin && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRequests.map((request) => (
                      <TableRow key={request.id} data-testid={`row-request-${request.id}`}>
                        <TableCell>{getRequestTypeBadge(request.request_type)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {request.target_type === 'organization' ? (
                              <Building2 className="h-3 w-3 mr-1" />
                            ) : (
                              <User className="h-3 w-3 mr-1" />
                            )}
                            {request.target_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {request.target_email || request.target_id || '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(request.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        {isSuperAdmin && (
                          <TableCell>
                            <div className="flex gap-2">
                              {(request.request_type === 'data_export' || request.request_type === 'access_request') && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => exportDataMutation.mutate(request.id)}
                                  disabled={exportingRequestId === request.id}
                                  data-testid={`button-export-${request.id}`}
                                >
                                  {exportingRequestId === request.id ? (
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  ) : (
                                    <FileDown className="h-3 w-3 mr-1" />
                                  )}
                                  Download
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => processRequestMutation.mutate({ id: request.id, action: 'complete' })}
                                disabled={processRequestMutation.isPending}
                                data-testid={`button-complete-${request.id}`}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Complete
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setRejectDialogRequest(request)}
                                disabled={processRequestMutation.isPending}
                                data-testid={`button-reject-${request.id}`}
                              >
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">No pending requests</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardHeader>
              <CardTitle>Request History</CardTitle>
              <CardDescription>Completed and rejected requests</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : completedRequests.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Identifier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Completed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedRequests.map((request) => (
                      <TableRow key={request.id} data-testid={`row-history-${request.id}`}>
                        <TableCell>{getRequestTypeBadge(request.request_type)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {request.target_type === 'organization' ? (
                              <Building2 className="h-3 w-3 mr-1" />
                            ) : (
                              <User className="h-3 w-3 mr-1" />
                            )}
                            {request.target_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {request.target_email || request.target_id || '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {request.completed_at 
                            ? format(new Date(request.completed_at), 'MMM d, yyyy')
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">No completed requests</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create GDPR Request</DialogTitle>
            <DialogDescription>
              Create a data export or deletion request for a user or organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Request Type</Label>
              <Select
                value={formData.request_type}
                onValueChange={(v) => setFormData({ ...formData, request_type: v as any })}
              >
                <SelectTrigger data-testid="select-request-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="data_export">Data Export</SelectItem>
                  <SelectItem value="data_deletion">Data Deletion</SelectItem>
                  <SelectItem value="access_request">Access Request</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Type</Label>
              <Select
                value={formData.target_type}
                onValueChange={(v) => setFormData({ ...formData, target_type: v as 'user' | 'organization' })}
              >
                <SelectTrigger data-testid="select-target-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="organization">Organization</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target ID (UUID)</Label>
              <Input
                placeholder="Enter target UUID"
                value={formData.target_id}
                onChange={(e) => setFormData({ ...formData, target_id: e.target.value })}
                data-testid="input-target-id"
              />
            </div>
            <div className="space-y-2">
              <Label>Or Email Address</Label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={formData.target_email}
                onChange={(e) => setFormData({ ...formData, target_email: e.target.value })}
                data-testid="input-target-email"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Additional context..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                data-testid="input-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createRequestMutation.mutate()}
              disabled={(!formData.target_id && !formData.target_email) || createRequestMutation.isPending}
              data-testid="button-submit-request"
            >
              {createRequestMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectDialogRequest} onOpenChange={() => setRejectDialogRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this GDPR request
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rejection Reason</Label>
              <Textarea
                placeholder="Enter reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                data-testid="input-rejection-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogRequest(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rejectDialogRequest) {
                  processRequestMutation.mutate({
                    id: rejectDialogRequest.id,
                    action: 'reject',
                    reason: rejectionReason,
                  });
                }
              }}
              disabled={processRequestMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {processRequestMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
