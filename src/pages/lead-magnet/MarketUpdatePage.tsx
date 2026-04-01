import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { isPublicSite, detectOrganizationFromDomain } from "@/lib/domainDetection";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, TrendingUp, TrendingDown, Minus, BarChart3, Mail,
  CheckCircle, ArrowRight, AlertCircle, Building2,
} from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface OrgConfig {
  id: string;
  slug: string;
  business_name: string;
  logo_url: string | null;
}

interface MarketInsights {
  headline: string;
  summary: string;
  key_stats: Array<{ label: string; value: string; trend: string }>;
  insights: string[];
  cta_text: string;
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
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [resolvedOrgSlug, setResolvedOrgSlug] = useState<string | null>(orgSlugParam || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [org, setOrg] = useState<OrgConfig | null>(null);
  const [area, setArea] = useState("");
  const [insights, setInsights] = useState<MarketInsights | null>(null);

  // Gate state
  const [unlocked, setUnlocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", consent: false });

  const utmParams = useMemo(() => ({
    utm_source: searchParams.get("utm_source") || undefined,
    utm_campaign: searchParams.get("utm_campaign") || undefined,
    utm_content: searchParams.get("utm_content") || undefined,
    post_id: searchParams.get("pid") || undefined,
  }), [searchParams]);

  // Resolve org slug from custom domain
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

  // Load market insights
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
        toast({ title: "Report unlocked!", description: "Check your email for the full report." });
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

  // Loading state
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

  // Error state
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-center gap-3">
          {org?.logo_url && (
            <img src={org.logo_url} alt={org.business_name} className="h-10 object-contain" />
          )}
          <span className="text-lg font-semibold text-gray-900">{org?.business_name}</span>
        </div>
      </div>

      {/* Hero */}
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
        {/* Key Stats */}
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

        {/* Insights — show first 2 free, gate the rest */}
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

            {/* Gated insights */}
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

            {/* Unlocked insights */}
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

        {/* Email Gate */}
        {!unlocked && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="pt-6 space-y-4">
              <div className="text-center space-y-2">
                <Mail className="h-8 w-8 text-blue-600 mx-auto" />
                <h3 className="text-lg font-semibold">Get the Full Report</h3>
                <p className="text-sm text-muted-foreground">
                  Enter your email to unlock all market insights and receive personalised updates from {org?.business_name}.
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

        {/* CTA after unlock */}
        {unlocked && insights?.cta_text && (
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="pt-6 text-center space-y-3">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
              <p className="text-sm font-medium text-green-800">{insights.cta_text}</p>
              {org?.business_name && (
                <p className="text-xs text-muted-foreground">
                  Contact {org.business_name} to discuss your property options.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer */}
      <div className="border-t bg-white py-4 text-center">
        <p className="text-xs text-muted-foreground">
          Powered by <a href="https://autolisting.io" className="text-primary hover:underline">AutoListing.io</a>
        </p>
      </div>
    </div>
  );
}
