import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Eye,
  MessageSquare,
  TrendingUp,
  Home,
  Calendar,
  ArrowUpDown,
} from "lucide-react";

interface ListingMetrics {
  listingId: string;
  listingTitle: string;
  totalViews: number;
  uniqueViews: number;
  totalEnquiries: number;
  conversionRate: number;
  avgTimeOnPage: number;
  lastViewed: string | null;
  viewTrend: number[];
}

interface TimeSeriesView {
  date: string;
  views: number;
  enquiries: number;
}

type SortKey = "totalViews" | "totalEnquiries" | "conversionRate" | "uniqueViews";
type SortDirection = "asc" | "desc";

export default function AdminListingAnalytics() {
  const [listingMetrics, setListingMetrics] = useState<ListingMetrics[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesView[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("totalViews");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const navigate = useNavigate();

  useEffect(() => {
    fetchListingAnalytics();
  }, []);

  const fetchListingAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch all listing views
      const { data: viewsData } = await supabase
        .from("listing_views")
        .select("*")
        .order("viewed_at", { ascending: false });

      // Fetch all enquiries
      const { data: enquiriesData } = await supabase
        .from("property_enquiries")
        .select("*");

      const views = viewsData || [];
      const enquiries = enquiriesData || [];

      // Group views by listing
      const listingViewMap = new Map<string, any[]>();
      views.forEach((view) => {
        if (!listingViewMap.has(view.listing_id)) {
          listingViewMap.set(view.listing_id, []);
        }
        listingViewMap.get(view.listing_id)!.push(view);
      });

      // Group enquiries by listing
      const listingEnquiryMap = new Map<string, number>();
      enquiries.forEach((enquiry) => {
        const count = listingEnquiryMap.get(enquiry.property_id) || 0;
        listingEnquiryMap.set(enquiry.property_id, count + 1);
      });

      // Calculate metrics for each listing
      const metrics: ListingMetrics[] = Array.from(listingViewMap.entries()).map(
        ([listingId, listingViews]) => {
          const totalViews = listingViews.length;
          const uniqueIPs = new Set(listingViews.map((v) => v.ip_address));
          const uniqueViews = uniqueIPs.size;
          const totalEnquiries = listingEnquiryMap.get(listingId) || 0;
          const conversionRate = totalViews > 0 ? (totalEnquiries / totalViews) * 100 : 0;

          // Get last 7 days trend
          const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            return date.toISOString().split("T")[0];
          });

          const viewTrend = last7Days.map((date) => {
            return listingViews.filter((v) => v.viewed_at?.startsWith(date)).length;
          });

          return {
            listingId,
            listingTitle: listingViews[0]?.listing_title || listingId,
            totalViews,
            uniqueViews,
            totalEnquiries,
            conversionRate,
            avgTimeOnPage: 0, // Could be calculated if we tracked this
            lastViewed: listingViews[0]?.viewed_at || null,
            viewTrend,
          };
        }
      );

      setListingMetrics(metrics);

      // Build time series data for all listings (last 30 days)
      const timeSeries: TimeSeriesView[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        const dayViews = views.filter((v) => v.viewed_at?.startsWith(dateStr)).length;
        const dayEnquiries = enquiries.filter((e) => e.created_at?.startsWith(dateStr)).length;

        timeSeries.push({
          date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          views: dayViews,
          enquiries: dayEnquiries,
        });
      }

      setTimeSeriesData(timeSeries);
    } catch (error) {
      console.error("Error fetching listing analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  const sortedMetrics = [...listingMetrics].sort((a, b) => {
    const aValue = a[sortKey];
    const bValue = b[sortKey];
    const multiplier = sortDirection === "asc" ? 1 : -1;
    return (aValue > bValue ? 1 : -1) * multiplier;
  });

  const totalViews = listingMetrics.reduce((sum, m) => sum + m.totalViews, 0);
  const totalEnquiries = listingMetrics.reduce((sum, m) => sum + m.totalEnquiries, 0);
  const avgConversionRate =
    listingMetrics.length > 0
      ? listingMetrics.reduce((sum, m) => sum + m.conversionRate, 0) / listingMetrics.length
      : 0;

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Listing Performance Analytics</h1>
            <p className="text-muted-foreground">Track views, enquiries, and conversion metrics</p>
          </div>
          <Button onClick={fetchListingAnalytics}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Refresh Data
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Listing Views</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalViews.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Across {listingMetrics.length} active listings
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Enquiries</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEnquiries}</div>
              <p className="text-xs text-muted-foreground">
                From all listing pages
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Conversion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgConversionRate.toFixed(2)}%</div>
              <p className="text-xs text-muted-foreground">
                Views to enquiries ratio
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Tables */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance Table</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Listings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sortedMetrics.slice(0, 5).map((listing, index) => (
                    <div
                      key={listing.listingId}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/property/${listing.listingId}`)}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="text-2xl font-bold text-muted-foreground w-8">
                          #{index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{listing.listingTitle}</h3>
                          <p className="text-sm text-muted-foreground">
                            {listing.totalViews} views • {listing.totalEnquiries} enquiries
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-primary">
                          {listing.conversionRate.toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground">conversion</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Views vs Enquiries Trend (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="views"
                      stroke="hsl(var(--primary))"
                      name="Views"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="enquiries"
                      stroke="hsl(var(--secondary))"
                      name="Enquiries"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance">
            <Card>
              <CardHeader>
                <CardTitle>Listing Performance Table</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Listing</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort("totalViews")}>
                        <div className="flex items-center gap-1">
                          Total Views
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort("uniqueViews")}>
                        <div className="flex items-center gap-1">
                          Unique Views
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort("totalEnquiries")}>
                        <div className="flex items-center gap-1">
                          Enquiries
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort("conversionRate")}>
                        <div className="flex items-center gap-1">
                          Conversion %
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead>Last Viewed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedMetrics.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No listing data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedMetrics.map((listing) => (
                        <TableRow
                          key={listing.listingId}
                          className="cursor-pointer hover:bg-accent/50"
                          onClick={() => navigate(`/property/${listing.listingId}`)}
                        >
                          <TableCell className="font-medium max-w-[300px] truncate">
                            {listing.listingTitle}
                          </TableCell>
                          <TableCell>{listing.totalViews}</TableCell>
                          <TableCell>{listing.uniqueViews}</TableCell>
                          <TableCell>{listing.totalEnquiries}</TableCell>
                          <TableCell>
                            <span className="font-semibold text-primary">
                              {listing.conversionRate.toFixed(2)}%
                            </span>
                          </TableCell>
                          <TableCell>
                            {listing.lastViewed
                              ? new Date(listing.lastViewed).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "N/A"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {sortedMetrics.slice(0, 6).map((listing) => (
                <Card key={listing.listingId}>
                  <CardHeader>
                    <CardTitle className="text-base truncate">{listing.listingTitle}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart
                        data={listing.viewTrend.map((views, i) => ({
                          day: `Day ${i + 1}`,
                          views,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="views" fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-3 gap-2 mt-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Views</p>
                        <p className="font-semibold">{listing.totalViews}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Enquiries</p>
                        <p className="font-semibold">{listing.totalEnquiries}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Rate</p>
                        <p className="font-semibold">{listing.conversionRate.toFixed(1)}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
      </Tabs>
    </div>
  );
}
