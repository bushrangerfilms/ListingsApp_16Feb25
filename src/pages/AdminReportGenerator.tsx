import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PlatformHeader } from "@/components/PlatformHeader";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Calendar, Mail } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ReportSection {
  id: string;
  label: string;
  description: string;
  checked: boolean;
}

export default function AdminReportGenerator() {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [dateRange, setDateRange] = useState("last_7_days");
  const [format, setFormat] = useState("summary");
  
  const [sections, setSections] = useState<ReportSection[]>([
    {
      id: "listings",
      label: "Listing Performance",
      description: "Views, enquiries, and conversion rates",
      checked: true,
    },
    {
      id: "crm",
      label: "CRM Metrics",
      description: "Pipeline activity and stage distribution",
      checked: true,
    },
    {
      id: "email",
      label: "Email Campaigns",
      description: "Open rates, click rates, and engagement",
      checked: true,
    },
    {
      id: "sources",
      label: "Lead Sources",
      description: "Attribution and source performance",
      checked: false,
    },
    {
      id: "funnel",
      label: "Sales Funnel",
      description: "Conversion rates by stage",
      checked: false,
    },
    {
      id: "matching",
      label: "Buyer Matching",
      description: "Match quality and engagement",
      checked: false,
    },
    {
      id: "team",
      label: "Team Performance",
      description: "Activity metrics and response times",
      checked: false,
    },
  ]);

  const toggleSection = (id: string) => {
    setSections(sections.map(s => 
      s.id === id ? { ...s, checked: !s.checked } : s
    ));
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const selectedSections = sections.filter(s => s.checked).map(s => s.id);
      
      if (selectedSections.length === 0) {
        toast({
          title: "No sections selected",
          description: "Please select at least one section to include in the report.",
          variant: "destructive",
        });
        return;
      }

      // Calculate date range
      const endDate = new Date();
      let startDate = new Date();
      
      switch (dateRange) {
        case "last_7_days":
          startDate.setDate(endDate.getDate() - 7);
          break;
        case "last_30_days":
          startDate.setDate(endDate.getDate() - 30);
          break;
        case "last_90_days":
          startDate.setDate(endDate.getDate() - 90);
          break;
        case "this_month":
          startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
          break;
        case "last_month":
          startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1);
          endDate.setDate(0); // Last day of previous month
          break;
      }

      // Fetch data for selected sections
      const reportData: any = {
        metadata: {
          generatedAt: new Date().toISOString(),
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            label: dateRange.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
          },
          sections: selectedSections,
        },
        data: {},
      };

      // Fetch listings data
      if (selectedSections.includes("listings")) {
        const { data: views } = await supabase
          .from("listing_views")
          .select("*")
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString());

        const { data: enquiries } = await supabase
          .from("property_enquiries")
          .select("*")
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString());

        reportData.data.listings = {
          totalViews: views?.length || 0,
          totalEnquiries: enquiries?.length || 0,
          conversionRate: views && views.length > 0 
            ? ((enquiries?.length || 0) / views.length * 100).toFixed(2) 
            : "0.00",
        };
      }

      // Fetch CRM data
      if (selectedSections.includes("crm")) {
        const { data: buyers } = await supabase
          .from("buyer_profiles")
          .select("*");
        
        const { data: sellers } = await supabase
          .from("seller_profiles")
          .select("*");

        const { data: activities } = await supabase
          .from("crm_activities")
          .select("*")
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString());

        reportData.data.crm = {
          totalBuyers: buyers?.length || 0,
          totalSellers: sellers?.length || 0,
          activitiesInPeriod: activities?.length || 0,
          activeBuyers: buyers?.filter(b => b.stage !== "lost").length || 0,
          activeSellers: sellers?.filter(s => s.stage !== "lost").length || 0,
        };
      }

      // Fetch email data
      if (selectedSections.includes("email")) {
        const { data: emailQueue } = await supabase
          .from("profile_email_queue")
          .select("*")
          .eq("status", "sent")
          .gte("sent_at", startDate.toISOString())
          .lte("sent_at", endDate.toISOString());

        const emailIds = emailQueue?.map(e => e.id) || [];
        
        const { data: tracking } = await supabase
          .from("email_tracking")
          .select("*")
          .in("profile_email_queue_id", emailIds);

        const opened = tracking?.filter(t => t.event_type === "opened").length || 0;
        const clicked = tracking?.filter(t => t.event_type === "clicked").length || 0;

        reportData.data.email = {
          totalSent: emailQueue?.length || 0,
          totalOpened: opened,
          totalClicked: clicked,
          openRate: emailQueue && emailQueue.length > 0 
            ? ((opened / emailQueue.length) * 100).toFixed(2) 
            : "0.00",
          clickRate: emailQueue && emailQueue.length > 0 
            ? ((clicked / emailQueue.length) * 100).toFixed(2) 
            : "0.00",
        };
      }

      // Add other sections data similarly...
      if (selectedSections.includes("team")) {
        const { data: activities } = await supabase
          .from("crm_activities")
          .select("*")
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString());

        reportData.data.team = {
          totalActivities: activities?.length || 0,
        };
      }

      // Generate the report content
      const reportContent = generateReportContent(reportData, format);
      
      // Download as text file
      downloadReport(reportContent, format);

      toast({
        title: "Report generated successfully",
        description: "Your analytics report has been downloaded.",
      });
    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        title: "Error generating report",
        description: "There was an error creating your report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const generateReportContent = (data: any, format: string) => {
    const { metadata, data: reportData } = data;
    const lines: string[] = [];

    // Header
    lines.push("=" .repeat(80));
    lines.push("ANALYTICS REPORT");
    lines.push("=" .repeat(80));
    lines.push("");
    lines.push(`Generated: ${new Date(metadata.generatedAt).toLocaleString()}`);
    lines.push(`Period: ${metadata.dateRange.label}`);
    lines.push(`Date Range: ${new Date(metadata.dateRange.start).toLocaleDateString()} - ${new Date(metadata.dateRange.end).toLocaleDateString()}`);
    lines.push("");
    lines.push("=" .repeat(80));
    lines.push("");

    // Listings Section
    if (reportData.listings) {
      lines.push("LISTING PERFORMANCE");
      lines.push("-" .repeat(80));
      lines.push(`Total Views: ${reportData.listings.totalViews}`);
      lines.push(`Total Enquiries: ${reportData.listings.totalEnquiries}`);
      lines.push(`Conversion Rate: ${reportData.listings.conversionRate}%`);
      lines.push("");
    }

    // CRM Section
    if (reportData.crm) {
      lines.push("CRM METRICS");
      lines.push("-" .repeat(80));
      lines.push(`Total Buyers: ${reportData.crm.totalBuyers}`);
      lines.push(`Active Buyers: ${reportData.crm.activeBuyers}`);
      lines.push(`Total Sellers: ${reportData.crm.totalSellers}`);
      lines.push(`Active Sellers: ${reportData.crm.activeSellers}`);
      lines.push(`Activities in Period: ${reportData.crm.activitiesInPeriod}`);
      lines.push("");
    }

    // Email Section
    if (reportData.email) {
      lines.push("EMAIL CAMPAIGN PERFORMANCE");
      lines.push("-" .repeat(80));
      lines.push(`Total Emails Sent: ${reportData.email.totalSent}`);
      lines.push(`Total Opened: ${reportData.email.totalOpened}`);
      lines.push(`Total Clicked: ${reportData.email.totalClicked}`);
      lines.push(`Open Rate: ${reportData.email.openRate}%`);
      lines.push(`Click Rate: ${reportData.email.clickRate}%`);
      lines.push("");
    }

    // Team Section
    if (reportData.team) {
      lines.push("TEAM PERFORMANCE");
      lines.push("-" .repeat(80));
      lines.push(`Total Activities: ${reportData.team.totalActivities}`);
      lines.push("");
    }

    lines.push("=" .repeat(80));
    lines.push("End of Report");
    lines.push("=" .repeat(80));

    return lines.join("\n");
  };

  const downloadReport = (content: string, format: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-report-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <PlatformHeader />
      <main className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Report Generator</h1>
          <p className="text-muted-foreground">
            Create custom analytics reports with selected metrics
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Report Sections</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sections.map((section) => (
                    <div
                      key={section.id}
                      className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        id={section.id}
                        checked={section.checked}
                        onCheckedChange={() => toggleSection(section.id)}
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={section.id}
                          className="font-semibold cursor-pointer"
                        >
                          {section.label}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {section.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Date Range</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                    <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                    <SelectItem value="last_90_days">Last 90 Days</SelectItem>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="last_month">Last Month</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Report Format</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={format} onValueChange={setFormat}>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg">
                    <RadioGroupItem value="summary" id="summary" />
                    <Label htmlFor="summary" className="flex-1 cursor-pointer">
                      <div>
                        <p className="font-semibold">Summary Report</p>
                        <p className="text-sm text-muted-foreground">
                          Key metrics and highlights
                        </p>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg">
                    <RadioGroupItem value="detailed" id="detailed" />
                    <Label htmlFor="detailed" className="flex-1 cursor-pointer">
                      <div>
                        <p className="font-semibold">Detailed Report</p>
                        <p className="text-sm text-muted-foreground">
                          Comprehensive data and analysis
                        </p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          </div>

          {/* Action Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Generate Report</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={generateReport}
                  disabled={generating}
                  className="w-full"
                  size="lg"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {generating ? "Generating..." : "Download Report"}
                </Button>

                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-4">
                    Selected: {sections.filter(s => s.checked).length} sections
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Reports are generated as text files with all selected metrics and can be opened in any text editor or spreadsheet application.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start" disabled>
                  <Calendar className="mr-2 h-4 w-4" />
                  Schedule Reports
                  <span className="ml-auto text-xs text-muted-foreground">Coming Soon</span>
                </Button>
                <Button variant="outline" className="w-full justify-start" disabled>
                  <Mail className="mr-2 h-4 w-4" />
                  Email Report
                  <span className="ml-auto text-xs text-muted-foreground">Coming Soon</span>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Report Templates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setSections(sections.map(s => ({
                      ...s,
                      checked: ["listings", "crm", "email"].includes(s.id)
                    })));
                    setDateRange("last_7_days");
                  }}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Weekly Overview
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setSections(sections.map(s => ({ ...s, checked: true })));
                    setDateRange("this_month");
                  }}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Monthly Full Report
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setSections(sections.map(s => ({
                      ...s,
                      checked: ["crm", "team", "email"].includes(s.id)
                    })));
                    setDateRange("last_30_days");
                  }}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Team Performance
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
