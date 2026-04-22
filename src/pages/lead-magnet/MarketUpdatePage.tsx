import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { isPublicSite, detectOrganizationFromDomain } from "@/lib/domainDetection";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/hooks/useLocale";
import {
  Loader2, TrendingUp, TrendingDown, Minus, BarChart3, Mail,
  CheckCircle, ArrowRight, AlertCircle, Building2, MessageSquare,
  MapPin,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ContactCTA } from "./ContactCTA";

interface ServiceArea {
  name: string;
  is_primary: boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SOCIALS_HUB_URL =
  import.meta.env.VITE_SOCIALS_HUB_URL || "https://socials.autolisting.io";

interface OrgConfig {
  id: string;
  slug: string;
  business_name: string;
  logo_url: string | null;
}

interface ComparableSale {
  description: string;
  sale_price: number;
  approx_sqm: number;
  price_per_sqm: number;
  distance_km: number;
}

interface MarketInsights {
  headline: string;
  summary: string;
  key_stats: Array<{ label: string; value: string; trend: string }>;
  insights: string[];
  cta_text: string;
  comparable_sales?: ComparableSale[];
  price_per_sqm_low?: number;
  price_per_sqm_high?: number;
  avg_price_sqm?: number;
  trend?: string;
  trend_commentary?: string;
  area_premium_notes?: string;
}

const TREND_ICONS: Record<string, typeof TrendingUp> = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
};

const TREND_COLORS: Record<string, string> = {
  up: "text-green-600",
  down: "text-red-500",
  stable: "text-amber-500",
};

export default function MarketUpdatePage() {
  const { orgSlug: orgSlugParam } = useParams<{ orgSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { locale } = useLocale();

  const [resolvedOrgSlug, setResolvedOrgSlug] = useState<string | null>(orgSlugParam || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [org, setOrg] = useState<OrgConfig | null>(null);
  const [area, setArea] = useState("");
  const [insights, setInsights] = useState<MarketInsights | null>(null);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);

  const [unlocked, setUnlocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", consent: false });
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactAdditionalInfo, setContactAdditionalInfo] = useState("");
  const [sendingContact, setSendingContact] = useState(false);

  const utmParams = useMemo(() => ({
    utm_source: searchParams.get("utm_source") || searchParams.get("s") || undefined,
    utm_campaign: searchParams.get("utm_campaign") || undefined,
    utm_content: searchParams.get("utm_content") || undefined,
    post_id: searchParams.get("pid") || undefined,
  }), [searchParams]);

  useEffect(() => {
    if (orgSlugParam) {
      setResolvedOrgSlug(orgSlugParam);
      return;
    }
    if (isPublicSite()) {
      detectOrganizationFromDomain().then((domainOrg) => {
        if (domainOrg?.slug) {
          setResolvedOrgSlug(domainOrg.slug);
        } else {
          setError("Could not detect organization from this domain");
          setLoading(false);
        }
      });
    } else {
      setError("Invalid page URL");
      setLoading(false);
    }
  }, [orgSlugParam]);

  useEffect(() => {
    if (!resolvedOrgSlug) return;

    const areaParam = searchParams.get("area") || "";
    const fetchInsights = async () => {
      try {
        const areaPath = areaParam ? `/${encodeURIComponent(areaParam)}` : "";
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/lead-magnet-api/market-insights/${resolvedOrgSlug}${areaPath}`
        );
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || "Failed to load");

        setOrg(data.org);
        setArea(data.area);
        setInsights(data.insights);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load market data");
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [resolvedOrgSlug, searchParams]);

  // Fetch this org's service areas so multi-area orgs can see a "change" control
  // on the breadcrumb. Single-area orgs get no picker. Silent on failure.
  useEffect(() => {
    if (!resolvedOrgSlug) return;
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/lead-magnet-api/service-areas/${encodeURIComponent(resolvedOrgSlug)}`,
        );
        if (!res.ok) return;
        const data: { areas?: ServiceArea[] } = await res.json();
        setServiceAreas(data.areas ?? []);
      } catch {
        // leave serviceAreas empty — change control just won't render
      }
    })();
  }, [resolvedOrgSlug]);

  const handleAreaChange = (newArea: string) => {
    if (!newArea || newArea === area) return;
    // Preserve other query params (utm, etc) while swapping the area.
    const next = new URLSearchParams(searchParams);
    next.set("area", newArea);
    setSearchParams(next, { replace: false });
  };

  const downloadPdf = async (silent = false) => {
    if (!insights || !org) return;
    setDownloadingPdf(true);
    try {
      const resp = await fetch(`${SOCIALS_HUB_URL}/api/lead-magnet-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "MARKET_UPDATE",
          orgSlug: org.slug,
          result: {
            area,
            headline: insights.headline,
            summary: insights.summary,
            key_stats: insights.key_stats,
            insights: insights.insights,
            comparable_sales: insights.comparable_sales,
            price_per_sqm_low: insights.price_per_sqm_low,
            price_per_sqm_high: insights.price_per_sqm_high,
            avg_price_sqm: insights.avg_price_sqm,
            trend: insights.trend,
            trend_commentary: insights.trend_commentary,
            area_premium_notes: insights.area_premium_notes,
            cta_text: insights.cta_text,
          },
          locale,
          generatedAt: new Date().toISOString(),
        }),
      });
      if (!resp.ok) throw new Error(`PDF render failed (${resp.status})`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "market-report.pdf";
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("[MarketUpdatePage] PDF download error", err);
      if (!silent) {
        toast({
          title: "Download failed",
          description: "Couldn't generate the report PDF. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.consent || !org) return;

    setSubmitting(true);
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/lead-magnet-api/submit-cta`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organization_id: org.id,
            type_key: "market-update",
            name: form.name,
            email: form.email,
            consent: form.consent,
            area,
            ...utmParams,
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        setUnlocked(true);
        if (data.submission_id) setSubmissionId(data.submission_id);
        toast({ title: "Report unlocked!", description: "Downloading your full PDF report…" });
        void downloadPdf(true);
      } else {
        throw new Error(data.error || "Submission failed");
      }
    } catch (err) {
      toast({
        title: "Something went wrong",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleContactAgent = async () => {
    if (!submissionId || sendingContact) return;
    setSendingContact(true);
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/lead-magnet-api/contact-request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submission_id: submissionId,
            additional_info: contactAdditionalInfo || undefined,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to send contact request");

      toast({
        title: "Request sent",
        description: `${org?.business_name || "The agent"} will be in touch soon.`,
      });
      setShowContactModal(false);
      setContactAdditionalInfo("");
    } catch (err) {
      toast({
        title: "Failed to send",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSendingContact(false);
    }
  };

  const currencySymbol = useMemo(() => {
    if (!locale) return "€";
    if (locale.startsWith("en-GB")) return "£";
    if (locale.startsWith("en-US")) return "$";
    if (locale.startsWith("en-CA")) return "C$";
    if (locale.startsWith("en-AU")) return "A$";
    if (locale.startsWith("en-NZ")) return "NZ$";
    return "€";
  }, [locale]);

  const areaUnit = useMemo(() => {
    if (!locale) return "m²";
    if (locale.startsWith("en-US") || locale.startsWith("en-CA")) return "sqft";
    return "m²";
  }, [locale]);

  const formatNum = (n: number | undefined) =>
    typeof n === "number" ? n.toLocaleString(locale || "en-IE") : "—";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading market data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasPriceData =
    insights?.price_per_sqm_low || insights?.price_per_sqm_high || insights?.avg_price_sqm;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-center gap-3">
          {org?.logo_url && (
            <img src={org.logo_url} alt={org.business_name} className="h-10 object-contain" />
          )}
          <span className="text-lg font-semibold text-gray-900">{org?.business_name}</span>
        </div>
      </div>

      {/* Area breadcrumb — for multi-area orgs, lets the visitor correct the
          area if the URL defaulted to the wrong one or they arrived from the
          generic bio hub. Single-area orgs see nothing here (no point). */}
      {serviceAreas.length > 1 && area && (
        <div className="bg-blue-50 border-b border-blue-100">
          <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <span className="text-gray-600">Showing data for</span>
            <Select value={area} onValueChange={handleAreaChange}>
              <SelectTrigger className="h-7 w-auto min-w-[120px] border-blue-200 bg-white text-sm font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {serviceAreas.map((a) => (
                  <SelectItem key={a.name} value={a.name}>
                    {a.name}{a.is_primary ? " (primary)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-12 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-3">
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30 mb-2">
            <BarChart3 className="h-3 w-3 mr-1" />
            Market Report
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
            {insights?.headline || `${area} Property Market Update`}
          </h1>
          <p className="text-blue-100 text-lg max-w-xl mx-auto">
            {insights?.summary}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {insights?.key_stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {insights.key_stats.map((stat, i) => {
              const TrendIcon = TREND_ICONS[stat.trend] || Minus;
              const trendColor = TREND_COLORS[stat.trend] || "text-gray-500";
              return (
                <Card key={i}>
                  <CardContent className="pt-5 pb-4 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{stat.label}</p>
                    <p className="text-xl font-bold">{stat.value}</p>
                    <TrendIcon className={`h-4 w-4 mx-auto mt-1 ${trendColor}`} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {insights?.insights && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Key Market Insights
            </h2>

            {insights.insights.slice(0, 2).map((insight, i) => (
              <Card key={i}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-700">{insight}</p>
                  </div>
                </CardContent>
              </Card>
            ))}

            {!unlocked && insights.insights.length > 2 && (
              <div className="relative">
                {insights.insights.slice(2).map((insight, i) => (
                  <Card key={i + 2} className="mb-3 opacity-40 blur-[2px] select-none pointer-events-none">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex gap-3">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-gray-700">{insight}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {unlocked && insights.insights.slice(2).map((insight, i) => (
              <Card key={i + 2}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-700">{insight}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {unlocked && hasPriceData && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Price Range in {area}
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {insights?.price_per_sqm_low ? (
                <Card>
                  <CardContent className="pt-4 pb-4 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Low / {areaUnit}</p>
                    <p className="text-lg font-bold">{currencySymbol}{formatNum(insights.price_per_sqm_low)}</p>
                  </CardContent>
                </Card>
              ) : null}
              {insights?.avg_price_sqm ? (
                <Card className="border-blue-400 bg-blue-50/50">
                  <CardContent className="pt-4 pb-4 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Average / {areaUnit}</p>
                    <p className="text-lg font-bold">{currencySymbol}{formatNum(insights.avg_price_sqm)}</p>
                  </CardContent>
                </Card>
              ) : null}
              {insights?.price_per_sqm_high ? (
                <Card>
                  <CardContent className="pt-4 pb-4 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">High / {areaUnit}</p>
                    <p className="text-lg font-bold">{currencySymbol}{formatNum(insights.price_per_sqm_high)}</p>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        )}

        {unlocked && insights?.trend_commentary && (
          <Card>
            <CardContent className="pt-5 pb-5 space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Market Trend
              </h3>
              <p className="text-sm text-gray-700 leading-relaxed">{insights.trend_commentary}</p>
            </CardContent>
          </Card>
        )}

        {unlocked && insights?.comparable_sales && insights.comparable_sales.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Recent Comparable Sales</h2>
            <Card>
              <CardContent className="pt-4 pb-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="pb-2 pr-2">Property</th>
                        <th className="pb-2 pr-2">Sale Price</th>
                        <th className="pb-2 pr-2">Size</th>
                        <th className="pb-2">{currencySymbol}/{areaUnit}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insights.comparable_sales.map((c, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 pr-2">{c.description}</td>
                          <td className="py-2 pr-2">{currencySymbol}{formatNum(c.sale_price)}</td>
                          <td className="py-2 pr-2">{formatNum(c.approx_sqm)} {areaUnit}</td>
                          <td className="py-2">{currencySymbol}{formatNum(c.price_per_sqm)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {unlocked && insights?.area_premium_notes && (
          <Card className="bg-blue-50/50 border-blue-200">
            <CardContent className="pt-5 pb-5 space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-900">
                Why {area}
              </h3>
              <p className="text-sm text-gray-700 leading-relaxed">{insights.area_premium_notes}</p>
            </CardContent>
          </Card>
        )}

        {!unlocked && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="pt-6 space-y-4">
              <div className="text-center space-y-2">
                <Mail className="h-8 w-8 text-blue-600 mx-auto" />
                <h3 className="text-lg font-semibold">Get the Full PDF Report</h3>
                <p className="text-sm text-muted-foreground">
                  Enter your email to unlock the full insights, comparable sales, price-per-{areaUnit} range, and a branded PDF download from {org?.business_name}.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3 max-w-sm mx-auto">
                <div>
                  <Label htmlFor="name" className="text-sm">Name (optional)</Label>
                  <Input
                    id="name"
                    placeholder="Your name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="text-sm">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="your@email.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="consent"
                    checked={form.consent}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, consent: !!checked }))}
                  />
                  <Label htmlFor="consent" className="text-xs text-muted-foreground leading-tight">
                    I agree to receive market updates from {org?.business_name || "the agent"}. Unsubscribe at any time.
                  </Label>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!form.email || !form.consent || submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  {submitting ? "Unlocking..." : "Unlock Full Report"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {unlocked && (
          <ContactCTA
            org={org}
            onDownloadPDF={() => void downloadPdf(false)}
            onContactAgent={() => setShowContactModal(true)}
            downloading={downloadingPdf}
            downloadLabel={`Download the ${area} Market Report`}
            downloadDescription="Save a branded PDF copy of the full report"
          />
        )}
      </div>

      <Dialog open={showContactModal} onOpenChange={setShowContactModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Request a Call Back
            </DialogTitle>
            <DialogDescription>
              {org?.business_name || "The agent"} will be in touch soon.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="additional-info">Additional Information (Optional)</Label>
              <Textarea
                id="additional-info"
                placeholder="Any details about your property or timeline..."
                value={contactAdditionalInfo}
                onChange={(e) => setContactAdditionalInfo(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowContactModal(false)}
                disabled={sendingContact}
              >
                Cancel
              </Button>
              <Button onClick={handleContactAgent} disabled={sendingContact}>
                {sendingContact ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    Send Request
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="border-t bg-white py-4 text-center">
        <p className="text-xs text-muted-foreground">
          Powered by <a href="https://autolisting.io" className="text-primary hover:underline">AutoListing.io</a>
        </p>
      </div>
    </div>
  );
}
