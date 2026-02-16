import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import { PlatformHeader } from "@/components/PlatformHeader";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Mail, TrendingUp, Users, Clock, ArrowUpDown } from "lucide-react";

interface TemplateMetrics {
  templateKey: string;
  templateName: string;
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  uniqueOpens: number;
  uniqueClicks: number;
  openRate: number;
  clickRate: number;
  clickToOpenRate: number;
  lastSent: string | null;
}

interface TimeMetrics {
  hour: number;
  sent: number;
  opened: number;
  clicked: number;
}

interface EngagementMetrics {
  profileId: string;
  profileName: string;
  profileType: string;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  openRate: number;
  clickRate: number;
  lastEngagement: string | null;
}

type SortKey = "totalSent" | "openRate" | "clickRate" | "clickToOpenRate";
type SortDirection = "asc" | "desc";

export default function AdminEmailCampaignAnalytics() {
  const { organization } = useOrganization();
  const { selectedOrganization, isOrganizationView } = useOrganizationView();
  const [templateMetrics, setTemplateMetrics] = useState<TemplateMetrics[]>([]);
  const [timeMetrics, setTimeMetrics] = useState<TimeMetrics[]>([]);
  const [engagementMetrics, setEngagementMetrics] = useState<EngagementMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("totalSent");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;
  const targetOrgId = targetOrg?.id;

  useEffect(() => {
    if (targetOrgId) {
      fetchEmailAnalytics(targetOrgId);
    }
  }, [targetOrgId]);

  const fetchEmailAnalytics = async (organizationId: string) => {
    setLoading(true);
    try {
      // CRITICAL: All queries MUST filter by organization_id for multi-tenant security
      const { data: emailQueue } = await supabase
        .from("profile_email_queue")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("status", "sent")
        .order("sent_at", { ascending: false });

      // Fetch all email tracking events
      const { data: trackingEvents } = await supabase
        .from("email_tracking")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      // Fetch email templates
      const { data: templates } = await supabase
        .from("email_templates")
        .select("*")
        .eq("organization_id", organizationId);

      const sentEmails = emailQueue || [];
      const events = trackingEvents || [];
      const templatesList = templates || [];

      // Calculate template metrics
      const templateMap = new Map<string, any>();

      sentEmails.forEach((email) => {
        const key = email.template_key;
        if (!templateMap.has(key)) {
          const template = templatesList.find((t) => t.template_key === key);
          templateMap.set(key, {
            templateKey: key,
            templateName: template?.template_name || key,
            emailIds: [],
            openedIds: new Set(),
            clickedIds: new Set(),
            uniqueOpenIPs: new Set(),
            uniqueClickIPs: new Set(),
            lastSent: null,
          });
        }
        const templateData = templateMap.get(key);
        templateData.emailIds.push(email.id);
        if (!templateData.lastSent || email.sent_at > templateData.lastSent) {
          templateData.lastSent = email.sent_at;
        }
      });

      // Process tracking events
      events.forEach((event) => {
        const email = sentEmails.find((e) => e.id === event.profile_email_queue_id);
        if (email) {
          const templateData = templateMap.get(email.template_key);
          if (templateData) {
            if (event.event_type === "opened") {
              templateData.openedIds.add(event.profile_email_queue_id);
              if (event.ip_address) {
                templateData.uniqueOpenIPs.add(event.ip_address);
              }
            } else if (event.event_type === "clicked") {
              templateData.clickedIds.add(event.profile_email_queue_id);
              if (event.ip_address) {
                templateData.uniqueClickIPs.add(event.ip_address);
              }
            }
          }
        }
      });

      const templatesMetrics: TemplateMetrics[] = Array.from(templateMap.values()).map(
        (data) => {
          const totalSent = data.emailIds.length;
          const totalOpened = data.openedIds.size;
          const totalClicked = data.clickedIds.size;
          const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
          const clickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;
          const clickToOpenRate = totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0;

          return {
            templateKey: data.templateKey,
            templateName: data.templateName,
            totalSent,
            totalOpened,
            totalClicked,
            uniqueOpens: data.uniqueOpenIPs.size,
            uniqueClicks: data.uniqueClickIPs.size,
            openRate,
            clickRate,
            clickToOpenRate,
            lastSent: data.lastSent,
          };
        }
      );

      setTemplateMetrics(templatesMetrics);

      // Calculate time-based metrics (by hour of day)
      const hourMetrics = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        sent: 0,
        opened: 0,
        clicked: 0,
      }));

      sentEmails.forEach((email) => {
        if (email.sent_at) {
          const hour = new Date(email.sent_at).getHours();
          hourMetrics[hour].sent++;
        }
      });

      events.forEach((event) => {
        const hour = new Date(event.created_at).getHours();
        if (event.event_type === "opened") {
          hourMetrics[hour].opened++;
        } else if (event.event_type === "clicked") {
          hourMetrics[hour].clicked++;
        }
      });

      setTimeMetrics(hourMetrics);

      // Calculate profile engagement metrics
      const { data: buyers } = await supabase.from("buyer_profiles").select("id, name, email");
      const { data: sellers } = await supabase.from("seller_profiles").select("id, name, email");

      const profileEngagement: EngagementMetrics[] = [];

      // Process buyers
      (buyers || []).forEach((buyer) => {
        const buyerEmails = sentEmails.filter((e) => e.buyer_profile_id === buyer.id);
        const emailIds = buyerEmails.map((e) => e.id);
        const opened = events.filter(
          (ev) => emailIds.includes(ev.profile_email_queue_id) && ev.event_type === "opened"
        ).length;
        const clicked = events.filter(
          (ev) => emailIds.includes(ev.profile_email_queue_id) && ev.event_type === "clicked"
        ).length;

        if (buyerEmails.length > 0) {
          const lastEvent = events
            .filter((ev) => emailIds.includes(ev.profile_email_queue_id))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

          profileEngagement.push({
            profileId: buyer.id,
            profileName: buyer.name,
            profileType: "Buyer",
            emailsSent: buyerEmails.length,
            emailsOpened: opened,
            emailsClicked: clicked,
            openRate: (opened / buyerEmails.length) * 100,
            clickRate: (clicked / buyerEmails.length) * 100,
            lastEngagement: lastEvent?.created_at || null,
          });
        }
      });

      // Process sellers
      (sellers || []).forEach((seller) => {
        const sellerEmails = sentEmails.filter((e) => e.seller_profile_id === seller.id);
        const emailIds = sellerEmails.map((e) => e.id);
        const opened = events.filter(
          (ev) => emailIds.includes(ev.profile_email_queue_id) && ev.event_type === "opened"
        ).length;
        const clicked = events.filter(
          (ev) => emailIds.includes(ev.profile_email_queue_id) && ev.event_type === "clicked"
        ).length;

        if (sellerEmails.length > 0) {
          const lastEvent = events
            .filter((ev) => emailIds.includes(ev.profile_email_queue_id))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

          profileEngagement.push({
            profileId: seller.id,
            profileName: seller.name,
            profileType: "Seller",
            emailsSent: sellerEmails.length,
            emailsOpened: opened,
            emailsClicked: clicked,
            openRate: (opened / sellerEmails.length) * 100,
            clickRate: (clicked / sellerEmails.length) * 100,
            lastEngagement: lastEvent?.created_at || null,
          });
        }
      });

      setEngagementMetrics(profileEngagement.sort((a, b) => b.emailsSent - a.emailsSent));
    } catch (error) {
      console.error("Error fetching email analytics:", error);
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

  const sortedTemplates = [...templateMetrics].sort((a, b) => {
    const aValue = a[sortKey];
    const bValue = b[sortKey];
    const multiplier = sortDirection === "asc" ? 1 : -1;
    return (aValue > bValue ? 1 : -1) * multiplier;
  });

  const totalSent = templateMetrics.reduce((sum, m) => sum + m.totalSent, 0);
  const totalOpened = templateMetrics.reduce((sum, m) => sum + m.totalOpened, 0);
  const totalClicked = templateMetrics.reduce((sum, m) => sum + m.totalClicked, 0);
  const overallOpenRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
  const overallClickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;

  const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))"];

  const engagementLevelData = [
    {
      name: "High Engagement",
      value: engagementMetrics.filter((m) => m.openRate > 50).length,
    },
    {
      name: "Medium Engagement",
      value: engagementMetrics.filter((m) => m.openRate > 20 && m.openRate <= 50).length,
    },
    {
      name: "Low Engagement",
      value: engagementMetrics.filter((m) => m.openRate <= 20).length,
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PlatformHeader />
        <main className="container mx-auto p-6">
          <div className="space-y-6">
            <Skeleton className="h-12 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
            <Skeleton className="h-96" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PlatformHeader />
      <main className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Email Campaign Analytics</h1>
            <p className="text-muted-foreground">
              Detailed performance metrics for email templates and campaigns
            </p>
          </div>
          <Button onClick={fetchEmailAnalytics}>
            <Mail className="mr-2 h-4 w-4" />
            Refresh Data
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Emails Sent</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSent.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Across {templateMetrics.length} templates
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Overall Open Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallOpenRate.toFixed(2)}%</div>
              <p className="text-xs text-muted-foreground">{totalOpened} total opens</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Overall Click Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallClickRate.toFixed(2)}%</div>
              <p className="text-xs text-muted-foreground">{totalClicked} total clicks</p>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Tabs */}
        <Tabs defaultValue="templates" className="space-y-6">
          <TabsList>
            <TabsTrigger value="templates">Template Performance</TabsTrigger>
            <TabsTrigger value="timing">Send Time Analysis</TabsTrigger>
            <TabsTrigger value="engagement">Recipient Engagement</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Template Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template</TableHead>
                      <TableHead
                        className="cursor-pointer"
                        onClick={() => handleSort("totalSent")}
                      >
                        <div className="flex items-center gap-1">
                          Sent
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer"
                        onClick={() => handleSort("openRate")}
                      >
                        <div className="flex items-center gap-1">
                          Open Rate
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer"
                        onClick={() => handleSort("clickRate")}
                      >
                        <div className="flex items-center gap-1">
                          Click Rate
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer"
                        onClick={() => handleSort("clickToOpenRate")}
                      >
                        <div className="flex items-center gap-1">
                          CTOR
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead>Last Sent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTemplates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No email data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedTemplates.map((template) => (
                        <TableRow key={template.templateKey}>
                          <TableCell className="font-medium">{template.templateName}</TableCell>
                          <TableCell>{template.totalSent}</TableCell>
                          <TableCell>
                            <span className="font-semibold text-primary">
                              {template.openRate.toFixed(2)}%
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">
                              ({template.totalOpened})
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-secondary">
                              {template.clickRate.toFixed(2)}%
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">
                              ({template.totalClicked})
                            </span>
                          </TableCell>
                          <TableCell>
                            {template.clickToOpenRate.toFixed(2)}%
                          </TableCell>
                          <TableCell>
                            {template.lastSent
                              ? new Date(template.lastSent).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
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

            <Card>
              <CardHeader>
                <CardTitle>Template Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={sortedTemplates.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="templateName" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="openRate" fill="hsl(var(--primary))" name="Open Rate %" />
                    <Bar dataKey="clickRate" fill="hsl(var(--secondary))" name="Click Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Activity by Hour of Day</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={timeMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" label={{ value: "Hour (24h format)", position: "insideBottom", offset: -5 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="sent"
                      stroke="hsl(var(--primary))"
                      name="Emails Sent"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="opened"
                      stroke="hsl(var(--secondary))"
                      name="Emails Opened"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="clicked"
                      stroke="hsl(var(--accent))"
                      name="Links Clicked"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Best Time to Send</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {timeMetrics
                      .map((m, idx) => ({ ...m, openRate: m.sent > 0 ? (m.opened / m.sent) * 100 : 0 }))
                      .sort((a, b) => b.openRate - a.openRate)
                      .slice(0, 5)
                      .map((metric) => (
                        <div key={metric.hour} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-semibold">
                              {metric.hour.toString().padStart(2, "0")}:00 - {(metric.hour + 1).toString().padStart(2, "0")}:00
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {metric.sent} sent • {metric.opened} opened
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-primary">
                              {metric.openRate.toFixed(1)}%
                            </p>
                            <p className="text-xs text-muted-foreground">open rate</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="font-semibold mb-2 text-foreground">Peak Sending Time</p>
                      <p className="text-sm text-muted-foreground">
                        Most emails are sent around{" "}
                        {timeMetrics.reduce((max, m) => (m.sent > max.sent ? m : max)).hour}:00
                      </p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="font-semibold mb-2 text-foreground">Peak Engagement Time</p>
                      <p className="text-sm text-muted-foreground">
                        Highest open rate occurs around{" "}
                        {timeMetrics
                          .map((m) => ({ ...m, rate: m.sent > 0 ? m.opened / m.sent : 0 }))
                          .reduce((max, m) => (m.rate > max.rate ? m : max)).hour}
                        :00
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="engagement" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Engagement Level Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={engagementLevelData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={100}
                        fill="hsl(var(--primary))"
                        dataKey="value"
                      >
                        {engagementLevelData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Engaged Recipients</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {engagementMetrics.slice(0, 5).map((profile) => (
                      <div
                        key={profile.profileId}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <p className="font-semibold">{profile.profileName}</p>
                          <p className="text-sm text-muted-foreground">
                            {profile.profileType} • {profile.emailsSent} emails sent
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-primary">
                            {profile.openRate.toFixed(0)}% opens
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {profile.clickRate.toFixed(0)}% clicks
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>All Recipients Engagement</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Emails Sent</TableHead>
                      <TableHead>Open Rate</TableHead>
                      <TableHead>Click Rate</TableHead>
                      <TableHead>Last Engagement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {engagementMetrics.slice(0, 20).map((profile) => (
                      <TableRow key={profile.profileId}>
                        <TableCell className="font-medium">{profile.profileName}</TableCell>
                        <TableCell>{profile.profileType}</TableCell>
                        <TableCell>{profile.emailsSent}</TableCell>
                        <TableCell>
                          <span className="font-semibold text-primary">
                            {profile.openRate.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-secondary">
                            {profile.clickRate.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          {profile.lastEngagement
                            ? new Date(profile.lastEngagement).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Never"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
