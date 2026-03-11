import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, AlertTriangle, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { adminApi, type FailedPost } from "@/lib/admin/adminApi";
import { useSuperAdminPermissions } from '@/hooks/useSuperAdminPermissions';

export default function FailedPostsPage() {
  const { hasSuperAdminAccess, loading: authLoading } = useSuperAdminPermissions();
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading, refetch, isRefetching, isError } = useQuery({
    queryKey: ['admin', 'failed-posts', dateFrom, dateTo],
    queryFn: () => adminApi.failedPosts.list({
      limit: 200,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
    enabled: !authLoading && hasSuperAdminAccess,
    refetchInterval: 30000,
  });

  const posts = data?.posts || [];

  const filteredPosts = posts.filter(post => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (post.organization_name || '').toLowerCase().includes(q) ||
      (post.listing_title || '').toLowerCase().includes(q) ||
      (post.listing_address || '').toLowerCase().includes(q) ||
      (post.error_message || '').toLowerCase().includes(q)
    );
  });

  // Count unique orgs affected
  const uniqueOrgs = new Set(posts.map(p => p.organization_id)).size;

  // Count posts from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const failedToday = posts.filter(p => new Date(p.updated_at) >= today).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Failed Posts</h1>
          <p className="text-muted-foreground">Monitor failed post deliveries across all organizations</p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Failed</CardDescription>
            <CardTitle className="text-2xl text-red-600">{data?.total || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Failed Today</CardDescription>
            <CardTitle className="text-2xl text-red-600">{failedToday}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Orgs Affected</CardDescription>
            <CardTitle className="text-2xl">{uniqueOrgs}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Failed Posts
          </CardTitle>
          <CardDescription>Posts that failed to publish across all organizations (auto-refreshes every 30s)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by org, listing, or error..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[160px]"
              placeholder="From date"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[160px]"
              placeholder="To date"
            />
            {(dateFrom || dateTo || searchQuery) && (
              <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(""); setDateFrom(""); setDateTo(""); }}>
                Clear
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Failed to load failed posts</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
                Try Again
              </Button>
            </div>
          ) : filteredPosts.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Listing</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Scheduled For</TableHead>
                    <TableHead>Failed At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPosts.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell className="font-medium">{post.organization_name}</TableCell>
                      <TableCell className="max-w-[180px] truncate">
                        {post.listing_title || post.listing_address || (post.post_category === 'lead_magnet' ? 'Quiz Post' : '-')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{post.post_category || 'listing'}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <ErrorCell message={post.error_message} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {format(new Date(post.scheduled_for), 'MMM d, HH:mm')}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {format(new Date(post.updated_at), 'MMM d, HH:mm')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No failed posts found</p>
              {searchQuery || dateFrom || dateTo ? (
                <p className="text-sm mt-1">Try adjusting your search or date filters</p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ErrorCell({ message }: { message: string | null }) {
  if (!message) return <span className="text-muted-foreground">-</span>;

  const truncated = message.length > 80 ? message.substring(0, 80) + '...' : message;

  if (message.length <= 80) {
    return <span className="text-sm text-red-600">{message}</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-sm text-red-600 cursor-help">{truncated}</span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[400px]">
          <p className="text-sm whitespace-pre-wrap">{message}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
