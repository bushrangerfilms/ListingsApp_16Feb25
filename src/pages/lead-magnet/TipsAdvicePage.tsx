import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { isPublicSite, detectOrganizationFromDomain } from "@/lib/domainDetection";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Lightbulb, Mail, CheckCircle, ArrowRight,
  AlertCircle, Lock, BookOpen, Star,
} from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface OrgConfig {
  id: string;
  slug: string;
  business_name: string;
  logo_url: string | null;
}

interface Tip {
  title: string;
  body: string;
  impact: string;
}

interface TipsContent {
  headline: string;
  intro: string;
  tips: Tip[];
  conclusion: string;
  cta_text: string;
}

const IMPACT_STYLES: Record<string, string> = {
  High: "bg-amber-100 text-amber-700 border-amber-200",
  Medium: "bg-blue-100 text-blue-700 border-blue-200",
};

export default function TipsAdvicePage() {
  const { orgSlug: orgSlugParam } = useParams<{ orgSlug: string }>();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [resolvedOrgSlug, setResolvedOrgSlug] = useState<string | null>(orgSlugParam || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [org, setOrg] = useState<OrgConfig | null>(null);
  const [area, setArea] = useState("");
  const [tipsContent, setTipsContent] = useState<TipsContent | null>(null);

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

  // Load tips content
  useEffect(() => {
    if (!resolvedOrgSlug) return;

    const areaParam = searchParams.get("area") || "";
    const fetchTips = async () => {
      try {
        const areaPath = areaParam ? `/${encodeURIComponent(areaParam)}` : "";
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/lead-magnet-api/tips-content/${resolvedOrgSlug}${areaPath}`
        );
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || "Failed to load");

        setOrg(data.org);
        setArea(data.area);
        setTipsContent(data.tips);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tips");
      } finally {
        setLoading(false);
      }
    };

    fetchTips();
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
            type_key: "tips-advice",
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
        toast({ title: "Article unlocked!", description: "All tips are now visible." });
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

  // How many tips to show free
  const FREE_TIP_COUNT = 2;
  const tips = tipsContent?.tips || [];
  const freeTips = tips.slice(0, FREE_TIP_COUNT);
  const gatedTips = tips.slice(FREE_TIP_COUNT);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading expert tips...</p>
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
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white py-12 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-3">
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30 mb-2">
            <BookOpen className="h-3 w-3 mr-1" />
            Expert Guide
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
            {tipsContent?.headline || `Expert Tips for Selling in ${area}`}
          </h1>
          <p className="text-emerald-100 text-lg max-w-xl mx-auto">
            {tipsContent?.intro}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Free tips */}
        {freeTips.map((tip, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-lg">
                  {i + 1}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{tip.title}</h3>
                    {tip.impact && (
                      <Badge variant="outline" className={`text-[10px] ${IMPACT_STYLES[tip.impact] || ""}`}>
                        <Star className="h-2.5 w-2.5 mr-0.5" />
                        {tip.impact} Impact
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{tip.body}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Gated tips — blurred preview */}
        {!unlocked && gatedTips.length > 0 && (
          <div className="relative">
            {gatedTips.map((tip, i) => (
              <Card key={i + FREE_TIP_COUNT} className="overflow-hidden mb-4 opacity-40 blur-[2px] select-none pointer-events-none">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-lg">
                      {i + FREE_TIP_COUNT + 1}
                    </div>
                    <div className="flex-1 space-y-2">
                      <h3 className="font-semibold text-gray-900">{tip.title}</h3>
                      <p className="text-sm text-gray-600">{tip.body}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Overlay with lock */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-6 text-center max-w-xs">
                <Lock className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                <p className="font-semibold text-sm">
                  {gatedTips.length} more tips below
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter your email to unlock the full article
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Unlocked tips */}
        {unlocked && gatedTips.map((tip, i) => (
          <Card key={i + FREE_TIP_COUNT} className="overflow-hidden">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-lg">
                  {i + FREE_TIP_COUNT + 1}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{tip.title}</h3>
                    {tip.impact && (
                      <Badge variant="outline" className={`text-[10px] ${IMPACT_STYLES[tip.impact] || ""}`}>
                        <Star className="h-2.5 w-2.5 mr-0.5" />
                        {tip.impact} Impact
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{tip.body}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Email gate */}
        {!unlocked && (
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="pt-6 space-y-4">
              <div className="text-center space-y-2">
                <Mail className="h-8 w-8 text-emerald-600 mx-auto" />
                <h3 className="text-lg font-semibold">Read the Full Article</h3>
                <p className="text-sm text-muted-foreground">
                  Enter your email to unlock all {tips.length} expert tips from {org?.business_name}.
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
                    I agree to receive property tips and updates from {org?.business_name || "the agent"}. Unsubscribe at any time.
                  </Label>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  disabled={!form.email || !form.consent || submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  {submitting ? "Unlocking..." : "Unlock All Tips"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Conclusion + CTA after unlock */}
        {unlocked && tipsContent && (
          <div className="space-y-4">
            {tipsContent.conclusion && (
              <Card>
                <CardContent className="pt-5 pb-5">
                  <div className="flex gap-3">
                    <Lightbulb className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-700 italic">{tipsContent.conclusion}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {tipsContent.cta_text && (
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardContent className="pt-6 text-center space-y-3">
                  <CheckCircle className="h-8 w-8 text-emerald-600 mx-auto" />
                  <p className="text-sm font-medium text-emerald-800">{tipsContent.cta_text}</p>
                  {org?.business_name && (
                    <p className="text-xs text-muted-foreground">
                      Contact {org.business_name} for personalised advice about your property.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
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
