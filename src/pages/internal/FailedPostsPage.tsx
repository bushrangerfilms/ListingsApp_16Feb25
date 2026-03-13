import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, AlertTriangle, RefreshCw, Search, ChevronDown, ChevronRight, Copy, Check } from "lucide-react";
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi, type FailedPost } from "@/lib/admin/adminApi";
import { useSuperAdminPermissions } from '@/hooks/useSuperAdminPermissions';

function contentTypeLabel(ct: string | null): string {
  if (!ct) return '-';
  const map: Record<string, string> = {
    video_style_1: 'VS1',
    video_style_2: 'VS2',
    video_style_3: 'VS3',
    video_style_4: 'VS4',
  };
  return map[ct] || ct.replace(/_/g, ' ');
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return (
    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); copy(); }} className="h-7 px-2">
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

export default function FailedPostsPage() {
  const { hasSuperAdminAccess, loading: authLoading } = useSuperAdminPermissions();
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

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
      (post.error_message || '').toLowerCase().includes(q) ||
      (post.content_type || '').toLowerCase().includes(q) ||
      (post.platforms_to_post || []).some(p => p.toLowerCase().includes(q))
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
                    <TableHead className="w-[30px]"></TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Listing</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Platforms</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Scheduled For</TableHead>
                    <TableHead>Failed At</TableHead>
                    <TableHead>ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPosts.map((post) => {
                    const isExpanded = expandedIds.has(post.id);
                    const listingLabel = post.listing_title || post.listing_address || (post.post_category === 'lead_magnet' ? 'Quiz Post' : '-');
                    return (
                      <>
                        <TableRow
                          key={post.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleExpand(post.id)}
                        >
                          <TableCell className="px-2">
                            {isExpanded
                              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            }
                          </TableCell>
                          <TableCell className="font-medium">
                            <button
                              className="text-blue-600 hover:underline text-left"
                              onClick={(e) => { e.stopPropagation(); navigate('/internal/organizations'); }}
                            >
                              {post.organization_name}
                            </button>
                          </TableCell>
                          <TableCell>{listingLabel}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{post.post_category || 'listing'}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(post.platforms_to_post || []).map(p => (
                                <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                              ))}
                              {(!post.platforms_to_post || post.platforms_to_post.length === 0) && (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{contentTypeLabel(post.content_type)}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-red-600">
                              {post.error_message
                                ? post.error_message.length > 80
                                  ? post.error_message.substring(0, 80) + '...'
                                  : post.error_message
                                : '-'
                              }
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            {format(new Date(post.scheduled_for), 'MMM d, HH:mm')}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            {format(new Date(post.updated_at), 'MMM d, HH:mm')}
                          </TableCell>
                          <TableCell>
                            <code className="text-xs text-muted-foreground font-mono">{post.id.substring(0, 8)}</code>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${post.id}-expanded`}>
                            <TableCell colSpan={10} className="bg-muted/30 border-b">
                              <div className="p-4 space-y-3">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 space-y-2">
                                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Full Error Message</div>
                                    <p className="text-sm text-red-600 whitespace-pre-wrap break-all bg-red-50 dark:bg-red-950/30 rounded-md p-3 border border-red-200 dark:border-red-800">
                                      {post.error_message || 'No error message'}
                                    </p>
                                  </div>
                                  {post.error_message && <CopyButton text={post.error_message} />}
                                </div>
                                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Schedule ID: </span>
                                    <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded select-all">{post.id}</code>
                                    <CopyButton text={post.id} />
                                  </div>
                                  {post.listing_id && (
                                    <div>
                                      <span className="text-muted-foreground">Listing ID: </span>
                                      <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded select-all">{post.listing_id}</code>
                                      <CopyButton text={post.listing_id} />
                                    </div>
                                  )}
                                  <div>
                                    <span className="text-muted-foreground">Org ID: </span>
                                    <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded select-all">{post.organization_id}</code>
                                    <CopyButton text={post.organization_id} />
                                  </div>
                                  {post.aspect_ratio && (
                                    <div>
                                      <span className="text-muted-foreground">Aspect Ratio: </span>
                                      <span>{post.aspect_ratio}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
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
