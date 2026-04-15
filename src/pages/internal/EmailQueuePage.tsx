import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Mail, RefreshCw, Search, Filter } from "lucide-react";
import { useState } from "react";
import { adminApi } from "@/lib/admin/adminApi";
import { useSuperAdminPermissions } from '@/hooks/useSuperAdminPermissions';

interface EmailQueueItem {
  id: string;
  to_email: string;
  subject: string;
  status: string;
  created_at: string;
  sent_at?: string;
  error_message?: string;
  template_id?: string;
}

export default function EmailQueuePage() {
  const { hasSuperAdminAccess, loading: authLoading } = useSuperAdminPermissions();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: emailQueue, isLoading, refetch, isRefetching, isError } = useQuery({
    queryKey: ['admin', 'email-queue'],
    queryFn: async () => {
      const result = await adminApi.support.getEmailQueue();
      return Array.isArray(result) ? result : [];
    },
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'sent':
        return 'default' as const;
      case 'pending':
        return 'secondary' as const;
      case 'failed':
        return 'destructive' as const;
      case 'queued':
        return 'outline' as const;
      default:
        return 'secondary' as const;
    }
  };

  const filteredQueue = (emailQueue as EmailQueueItem[] | undefined)?.filter(item => {
    const matchesSearch = !searchQuery || 
      item.to_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const statusCounts = (emailQueue as EmailQueueItem[] | undefined)?.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Email Queue</h1>
          <p className="text-muted-foreground">Monitor and manage outgoing email delivery</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          disabled={isRefetching}
          data-testid="button-refresh-queue"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Emails</CardDescription>
            <CardTitle className="text-2xl" data-testid="text-total-emails">
              {emailQueue?.length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sent</CardDescription>
            <CardTitle className="text-2xl text-green-600" data-testid="text-sent-count">
              {statusCounts['sent'] || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl text-yellow-600" data-testid="text-pending-count">
              {statusCounts['pending'] || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Failed</CardDescription>
            <CardTitle className="text-2xl text-red-600" data-testid="text-failed-count">
              {statusCounts['failed'] || 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Queue
          </CardTitle>
          <CardDescription>Recent email delivery status and history</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-emails"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="queued">Queued</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="text-center py-12 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Failed to load email queue</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
                Try Again
              </Button>
            </div>
          ) : filteredQueue.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQueue.map((item) => (
                    <TableRow key={item.id} data-testid={`row-email-${item.id}`}>
                      <TableCell className="font-medium">{item.to_email}</TableCell>
                      <TableCell className="max-w-xs truncate">{item.subject}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(item.status)}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(item.created_at), 'MMM d, HH:mm')}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {item.sent_at ? format(new Date(item.sent_at), 'MMM d, HH:mm') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No emails found</p>
              {searchQuery || statusFilter !== 'all' ? (
                <p className="text-sm mt-1">Try adjusting your search or filter</p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
