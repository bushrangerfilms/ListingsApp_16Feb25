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
  Loader2, Lightbulb, Mail, CheckCircle, ArrowRight,
  AlertCircle, BookOpen, Star, MapPin, Sparkles, Download,
  FileText, MessageSquare,
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

interface Tip {
  title: string;
  body: string;
  impact: string;
  how_to?: string[];
  common_pitfalls?: string[];
  pro_tip?: string;
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

const SUMMARY_TIP_COUNT = 3;

export default function TipsAdvicePage() {
  const { orgSlug: orgSlugParam } = useParams<{ orgSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { locale } = useLocale();

  const [resolvedOrgSlug, setResolvedOrgSlug] = useState<string | null>(orgSlugParam || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [org, setOrg] = useState<OrgConfig | null>(null);
  const [area, setArea] = useState("");
  const [tipsContent, setTipsContent] = useState<TipsContent | null>(null);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);

  const [delivered, setDelivered] = useState(false);
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
        // leave empty — change control just won't render
      }
    })();
  }, [resolvedOrgSlug]);

  const handleAreaChange = (newArea: string) => {
    if (!newArea || newArea === area) return;
    const next = new URLSearchParams(searchParams);
    next.set("area", newArea);
    setSearchParams(next, { replace: false });
  };

  const downloadPdf = async (silent = false) => {
    if (!tipsContent || !org) return;
    setDownloadingPdf(true);
    try {
      const resp = await fetch(`${SOCIALS_HUB_URL}/api/lead-magnet-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "TIPS_ADVICE",
          orgSlug: org.slug,
          result: {
            area,
            headline: tipsContent.headline,
            intro: tipsContent.intro,
            tips: tipsContent.tips,
            conclusion: tipsContent.conclusion,
            cta_text: tipsContent.cta_text,
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
      link.download = `${area || "seller"}-tips.pdf`;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("[TipsAdvicePage] PDF download error", err);
      if (!silent) {
        toast({
          title: "Download failed",
          description: "Couldn't generate the PDF guide. Please try again.",
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
        setDelivered(true);
        if (data.submission_id) setSubmissionId(data.submission_id);
        toast({
          title: "Guide on its way",
          description: `We've emailed your free seller tips guide to ${form.email}. Downloading now…`,
        });
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

  const tips = tipsContent?.tips || [];
  const summaryTips = tips.slice(0, SUMMARY_TIP_COUNT);
  const extraTipCount = Math.max(0, tips.length - SUMMARY_TIP_COUNT);

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
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-center gap-3">
          {org?.logo_url && (
            <img src={org.logo_url} alt={org.business_name} className="h-10 object-contain" />
          )}
          <span className="text-lg font-semibold text-gray-900">{org?.business_name}</span>
        </div>
      </div>

      {serviceAreas.length > 1 && area && (
        <div className="bg-emerald-50 border-b border-emerald-100">
          <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span className="text-gray-600">Tips for</span>
            <Select value={area} onValueChange={handleAreaChange}>
              <SelectTrigger className="h-7 w-auto min-w-[120px] border-emerald-200 bg-white text-sm font-medium">
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

      <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white py-10 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-3">
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30 mb-2">
            <BookOpen className="h-3 w-3 mr-1" />
            Seller Tips · At a glance
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
            Seller Tips for {area} — Summary
          </h1>
          <p className="text-emerald-100 text-base sm:text-lg max-w-xl mx-auto">
            {tipsContent?.intro}
          </p>
          <p className="text-emerald-100/80 text-xs sm:text-sm max-w-xl mx-auto pt-1">
            The full guide is <span className="font-semibold text-white">free</span> — enter your email below for the PDF with step-by-step how-to, pitfalls to avoid, and pro tips.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {summaryTips.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-emerald-600" />
              Top Tips at a Glance
            </h2>

            {summaryTips.map((tip, i) => (
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

            {extraTipCount > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                + {extraTipCount} more expert tip{extraTipCount === 1 ? "" : "s"}, plus step-by-step how-to and pitfalls to avoid in the free PDF guide below.
              </p>
            )}
          </div>
        )}

        {!delivered && (
          <Card className="border-emerald-300 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
            <CardContent className="pt-6 pb-6 space-y-4">
              <div className="text-center space-y-2">
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 mb-1">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Free Download
                </Badge>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">
                  Get the Full Guide — Free
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Free PDF with all {tips.length} expert tips expanded — step-by-step how-to, common pitfalls, and pro tips from {org?.business_name}. No payment, no spam — unsubscribe anytime.
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
                  {submitting ? "Sending guide..." : "Get the Free Guide →"}
                </Button>
                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" /> Free
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" /> Instant download
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" /> No credit card
                  </span>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {delivered && (
          <>
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="pt-5 pb-5 text-center space-y-2">
                <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Your free guide is on its way
                </h3>
                <p className="text-sm text-gray-700">
                  We've emailed the full guide to <strong>{form.email}</strong>. Your PDF is downloading now too.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => void downloadPdf(false)}
                  disabled={downloadingPdf}
                >
                  {downloadingPdf ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download again
                </Button>
              </CardContent>
            </Card>

            <ContactCTA
              org={org}
              onDownloadPDF={() => void downloadPdf(false)}
              onContactAgent={() => setShowContactModal(true)}
              downloading={downloadingPdf}
              downloadLabel={`Download the ${area} Seller Tips Guide`}
              downloadDescription="Save a branded PDF copy of the full guide"
            />

            {tipsContent?.conclusion && (
              <Card>
                <CardContent className="pt-5 pb-5">
                  <div className="flex gap-3">
                    <Lightbulb className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-700 italic">{tipsContent.conclusion}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="pt-5 pb-5 flex items-start gap-3">
            <FileText className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm text-slate-700">
              <p className="font-medium">What's in the full guide?</p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                <li>All {tips.length || "expert"} tips expanded with step-by-step how-to</li>
                <li>Common pitfalls to avoid</li>
                <li>Pro tips from {org?.business_name || "local agents"}</li>
                <li>Personalised next steps for selling in {area}</li>
              </ul>
            </div>
          </CardContent>
        </Card>
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
