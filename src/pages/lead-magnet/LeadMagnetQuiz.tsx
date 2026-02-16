import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, AlertCircle, Home, ArrowRight, ArrowLeft, Lock, Unlock, TrendingUp, FileText, Scale, Calendar, Wrench, DollarSign, Download, Phone, MessageSquare } from "lucide-react";
import jsPDF from "jspdf";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface OrgConfig {
  id: string;
  slug: string;
  business_name: string;
  logo_url: string | null;
  contact_email: string | null;
}

interface LeadMagnetConfig {
  id: string;
  organization_id: string;
  type: string;
  is_enabled: boolean;
  brand_config: Record<string, unknown>;
}

interface QuizAnswer {
  [key: string]: string | number | boolean | null;
}

interface GatedResult {
  band?: string;
  score_range?: string;
  headline_gaps?: string[];
  estimate_range?: string;
  confidence?: string;
  message: string;
}

interface FullResult {
  score?: number;
  band?: string;
  headline_gaps?: string[];
  todo_list?: Array<{ priority: number; section: string; task: string; reason: string }>;
  next_steps?: string[];
  estimate_low?: number;
  estimate_high?: number;
  estimate_display?: string;
  confidence?: string;
  drivers?: Array<{ factor: string; impact: string; direction: string }>;
  market_trend?: string;
  market_insights?: string;
  comparable_sales?: Array<{ address: string; price: number; bedrooms: number }>;
  research_source?: string;
}

type QuizType = "READY_TO_SELL" | "WORTH_ESTIMATE";

export function LeadMagnetQuiz() {
  const { orgSlug, quizType } = useParams<{ orgSlug: string; quizType: string }>();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [org, setOrg] = useState<OrgConfig | null>(null);
  const [config, setConfig] = useState<LeadMagnetConfig | null>(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer>({});
  const [submitting, setSubmitting] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [gatedResult, setGatedResult] = useState<GatedResult | null>(null);
  const [fullResult, setFullResult] = useState<FullResult | null>(null);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockForm, setUnlockForm] = useState({ name: "", email: "", phone: "", consent: false });
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactAdditionalInfo, setContactAdditionalInfo] = useState("");
  const [sendingContact, setSendingContact] = useState(false);
  const { toast } = useToast();

  const utmParams = useMemo(() => ({
    utm_source: searchParams.get("utm_source"),
    utm_campaign: searchParams.get("utm_campaign"),
    campaign_id: searchParams.get("c"),
    post_id: searchParams.get("pid"),
    version: searchParams.get("v"),
  }), [searchParams]);

  const normalizedType: QuizType = quizType?.toUpperCase().replace(/-/g, "_") as QuizType || "READY_TO_SELL";

  useEffect(() => {
    loadConfig();
  }, [orgSlug, quizType]);

  const loadConfig = async () => {
    if (!orgSlug || !quizType) {
      setError("Invalid quiz URL");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/lead-magnet-api/config/${orgSlug}/${quizType}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load quiz");
      }

      setOrg(data.org);
      setConfig(data.config);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load quiz");
    } finally {
      setLoading(false);
    }
  };

  const steps = normalizedType === "READY_TO_SELL" ? readyToSellSteps : worthEstimateSteps;
  const totalSteps = steps.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const handleAnswer = (key: string, value: string | number | boolean) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const canProceed = () => {
    const currentQuestions = steps[currentStep]?.questions || [];
    return currentQuestions.every((q: any) => {
      if (!q.required) return true;
      const answer = answers[q.key];
      return answer !== undefined && answer !== null && answer !== "";
    });
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      submitQuiz();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const submitQuiz = async () => {
    if (!org || !config) return;

    setSubmitting(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/lead-magnet-api/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: org.id,
          lead_magnet_id: config.id,
          type: normalizedType,
          answers,
          ...utmParams,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit quiz");
      }

      setSubmissionId(data.submission_id);
      setGatedResult(data.result);
      setShowUnlockModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlock = async () => {
    if (!unlockForm.email || !unlockForm.consent) return;

    setUnlocking(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/lead-magnet-api/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_id: submissionId,
          ...unlockForm,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to unlock results");
      }

      setFullResult(data.result);
      setShowUnlockModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlock results");
    } finally {
      setUnlocking(false);
    }
  };

  const handleContactAgent = async () => {
    if (!submissionId) return;

    setSendingContact(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/lead-magnet-api/contact-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_id: submissionId,
          additional_info: contactAdditionalInfo || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send contact request");
      }

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

  const generatePDF = () => {
    if (!fullResult || !org) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(100, 100, 100);
    doc.text(org.business_name || "Property Report", pageWidth / 2, y, { align: "center" });
    y += 15;

    // Title
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    const title = normalizedType === "READY_TO_SELL" ? "Ready to Sell Assessment" : "Property Value Estimate";
    doc.text(title, pageWidth / 2, y, { align: "center" });
    y += 15;

    // Date
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-IE")}`, pageWidth / 2, y, { align: "center" });
    y += 15;

    // Results
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);

    if (normalizedType === "READY_TO_SELL") {
      doc.setFontSize(14);
      doc.text(`Score: ${fullResult.score || "N/A"}`, 20, y);
      y += 10;
      doc.text(`Band: ${fullResult.band || "N/A"}`, 20, y);
      y += 15;

      if (fullResult.headline_gaps && fullResult.headline_gaps.length > 0) {
        doc.setFontSize(12);
        doc.text("Key Areas to Address:", 20, y);
        y += 8;
        doc.setFontSize(10);
        fullResult.headline_gaps.forEach((gap) => {
          doc.text(`• ${gap}`, 25, y);
          y += 7;
        });
        y += 5;
      }

      if (fullResult.todo_list && fullResult.todo_list.length > 0) {
        doc.setFontSize(12);
        doc.text("Action Plan:", 20, y);
        y += 8;
        doc.setFontSize(10);
        fullResult.todo_list.forEach((item, i) => {
          const text = `${i + 1}. ${item.task}`;
          const lines = doc.splitTextToSize(text, pageWidth - 45);
          doc.text(lines, 25, y);
          y += lines.length * 6 + 3;
        });
      }
    } else {
      doc.setFontSize(14);
      doc.text(`Estimated Value: ${fullResult.estimate_display || "N/A"}`, 20, y);
      y += 10;
      doc.text(`Confidence: ${fullResult.confidence || "N/A"}`, 20, y);
      y += 10;
      if (fullResult.market_trend) {
        doc.text(`Market Trend: ${fullResult.market_trend}`, 20, y);
        y += 15;
      }

      if (fullResult.drivers && fullResult.drivers.length > 0) {
        doc.setFontSize(12);
        doc.text("Value Drivers:", 20, y);
        y += 8;
        doc.setFontSize(10);
        fullResult.drivers.forEach((driver) => {
          doc.text(`• ${driver.factor}: ${driver.impact}`, 25, y);
          y += 7;
        });
        y += 5;
      }

      // Market insights if available
      if (fullResult.market_insights) {
        doc.setFontSize(12);
        doc.text("Market Insights:", 20, y);
        y += 8;
        doc.setFontSize(10);
        const insightLines = doc.splitTextToSize(fullResult.market_insights, pageWidth - 45);
        doc.text(insightLines, 25, y);
        y += insightLines.length * 6 + 5;
      }
    }

    // Next steps
    if (fullResult.next_steps && fullResult.next_steps.length > 0) {
      y += 10;
      doc.setFontSize(12);
      doc.text("Next Steps:", 20, y);
      y += 8;
      doc.setFontSize(10);
      fullResult.next_steps.forEach((step) => {
        const lines = doc.splitTextToSize(`• ${step}`, pageWidth - 45);
        doc.text(lines, 25, y);
        y += lines.length * 6 + 2;
      });
    }

    // Footer
    y = doc.internal.pageSize.getHeight() - 20;
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Report provided by ${org.business_name || "AutoListing"}`, pageWidth / 2, y, { align: "center" });

    // Save
    const filename = normalizedType === "READY_TO_SELL" ? "ready-to-sell-report.pdf" : "property-value-report.pdf";
    doc.save(filename);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-testid="quiz-loading">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Quiz Not Available</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (fullResult) {
    return (
      <div className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Header org={org} />
          <FullResultsView 
            type={normalizedType} 
            result={fullResult} 
            org={org} 
            onDownloadPDF={generatePDF}
            onContactAgent={() => setShowContactModal(true)}
          />
        </div>

        {/* Contact Agent Modal */}
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
                <Label htmlFor="additional-info">
                  Additional Information (Optional)
                </Label>
                <Textarea
                  id="additional-info"
                  placeholder="Please add any other relevant information for the agent..."
                  value={contactAdditionalInfo}
                  onChange={(e) => setContactAdditionalInfo(e.target.value)}
                  rows={4}
                  data-testid="input-additional-info"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setShowContactModal(false)}
                  disabled={sendingContact}
                  data-testid="button-cancel-contact"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleContactAgent}
                  disabled={sendingContact}
                  data-testid="button-send-contact"
                >
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Header org={org} />

        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle data-testid="quiz-step-title">{steps[currentStep]?.title}</CardTitle>
                <CardDescription>{steps[currentStep]?.description}</CardDescription>
              </div>
              <Badge variant="secondary">
                Step {currentStep + 1} of {totalSteps}
              </Badge>
            </div>
            <Progress value={progress} className="mt-4" />
          </CardHeader>

          <CardContent className="space-y-6">
            {steps[currentStep]?.questions.map((question: any) => (
              <QuestionField
                key={question.key}
                question={question}
                value={answers[question.key]}
                onChange={(value) => handleAnswer(question.key, value)}
              />
            ))}

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 0}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>

              <Button
                onClick={handleNext}
                disabled={!canProceed() || submitting}
                data-testid="button-next"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : currentStep === totalSteps - 1 ? (
                  <>
                    Get Results
                    <CheckCircle className="h-4 w-4 ml-2" />
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <UnlockModal
          open={showUnlockModal}
          onOpenChange={setShowUnlockModal}
          gatedResult={gatedResult}
          type={normalizedType}
          form={unlockForm}
          onFormChange={setUnlockForm}
          onUnlock={handleUnlock}
          unlocking={unlocking}
          org={org}
        />
      </div>
    </div>
  );
}

function Header({ org }: { org: OrgConfig | null }) {
  return (
    <div className="text-center">
      {org?.logo_url && (
        <img
          src={org.logo_url}
          alt={org.business_name}
          className="h-12 mx-auto mb-4 object-contain"
          data-testid="img-org-logo"
        />
      )}
      <h1 className="text-2xl font-bold" data-testid="text-org-name">
        {org?.business_name || "Property Quiz"}
      </h1>
    </div>
  );
}

interface QuestionFieldProps {
  question: any;
  value: any;
  onChange: (value: any) => void;
}

function QuestionField({ question, value, onChange }: QuestionFieldProps) {
  if (question.type === "radio") {
    return (
      <div className="space-y-3">
        <Label className="text-base font-medium">
          {question.label}
          {question.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <RadioGroup
          value={value || ""}
          onValueChange={onChange}
          className="grid gap-2"
          data-testid={`radio-${question.key}`}
        >
          {question.options.map((option: any) => (
            <div
              key={option.value}
              className="flex items-center space-x-3 p-3 rounded-md border hover-elevate cursor-pointer"
              onClick={() => onChange(option.value)}
            >
              <RadioGroupItem value={option.value} id={`${question.key}-${option.value}`} />
              <Label htmlFor={`${question.key}-${option.value}`} className="flex-1 cursor-pointer">
                <span className="font-medium">{option.label}</span>
                {option.description && (
                  <span className="block text-sm text-muted-foreground">{option.description}</span>
                )}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    );
  }

  if (question.type === "select") {
    return (
      <div className="space-y-2">
        <Label htmlFor={question.key} className="text-base font-medium">
          {question.label}
          {question.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <select
          id={question.key}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
          data-testid={`select-${question.key}`}
        >
          <option value="">Select an option</option>
          {question.options.map((option: any) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (question.type === "number") {
    return (
      <div className="space-y-2">
        <Label htmlFor={question.key} className="text-base font-medium">
          {question.label}
          {question.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Input
          id={question.key}
          type="number"
          value={value || ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          placeholder={question.placeholder}
          data-testid={`input-${question.key}`}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={question.key} className="text-base font-medium">
        {question.label}
        {question.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        id={question.key}
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={question.placeholder}
        data-testid={`input-${question.key}`}
      />
    </div>
  );
}

interface UnlockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gatedResult: GatedResult | null;
  type: QuizType;
  form: { name: string; email: string; phone: string; consent: boolean };
  onFormChange: (form: any) => void;
  onUnlock: () => void;
  unlocking: boolean;
  org: OrgConfig | null;
}

function UnlockModal({ open, onOpenChange, gatedResult, type, form, onFormChange, onUnlock, unlocking, org }: UnlockModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Get Your Full Report
          </DialogTitle>
          <DialogDescription>
            Enter your details to receive your personalised report
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <GatedResultPreview result={gatedResult} type={type} />

          <div className="space-y-3">
            <div>
              <Label htmlFor="unlock-name">Name</Label>
              <Input
                id="unlock-name"
                value={form.name}
                onChange={(e) => onFormChange({ ...form, name: e.target.value })}
                placeholder="Your name"
                data-testid="input-unlock-name"
              />
            </div>

            <div>
              <Label htmlFor="unlock-email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="unlock-email"
                type="email"
                value={form.email}
                onChange={(e) => onFormChange({ ...form, email: e.target.value })}
                placeholder="your@email.com"
                required
                data-testid="input-unlock-email"
              />
            </div>

            <div>
              <Label htmlFor="unlock-phone">Phone (optional)</Label>
              <Input
                id="unlock-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => onFormChange({ ...form, phone: e.target.value })}
                placeholder="Your phone number"
                data-testid="input-unlock-phone"
              />
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="consent"
                checked={form.consent}
                onCheckedChange={(checked) => onFormChange({ ...form, consent: !!checked })}
                data-testid="checkbox-consent"
              />
              <Label htmlFor="consent" className="text-sm text-muted-foreground leading-tight">
                I agree to receive my report and property updates from {org?.business_name || "the agent"}.
                You can unsubscribe at any time.
              </Label>
            </div>
          </div>

          <Button
            onClick={onUnlock}
            disabled={!form.email || !form.consent || unlocking}
            className="w-full"
            data-testid="button-get-report"
          >
            {unlocking ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            Get My Full Report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GatedResultPreview({ result, type }: { result: GatedResult | null; type: QuizType }) {
  if (!result) return null;

  return (
    <Card className="bg-muted/50">
      <CardContent className="pt-4">
        {type === "READY_TO_SELL" ? (
          <div className="text-center">
            <Badge variant="secondary" className="text-lg px-4 py-1">
              {result.band}
            </Badge>
            <p className="text-sm text-muted-foreground mt-2">
              Score range: {result.score_range}
            </p>
            {result.headline_gaps && result.headline_gaps.length > 0 && (
              <p className="text-sm mt-2">
                Key area: <span className="font-medium">{result.headline_gaps[0]}</span>
              </p>
            )}
          </div>
        ) : (
          <div className="text-center">
            <p className="text-2xl font-bold">{result.estimate_range}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Confidence: {result.confidence}
            </p>
          </div>
        )}
        <p className="text-sm text-center mt-4 text-muted-foreground">{result.message}</p>
      </CardContent>
    </Card>
  );
}

interface FullResultsViewProps {
  type: QuizType;
  result: FullResult;
  org: OrgConfig | null;
  onDownloadPDF: () => void;
  onContactAgent: () => void;
}

function FullResultsView({ type, result, org, onDownloadPDF, onContactAgent }: FullResultsViewProps) {
  if (type === "READY_TO_SELL") {
    return (
      <div className="space-y-6 mt-6">
        <Card>
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <CardTitle>Your Readiness Score</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-5xl font-bold text-primary mb-2" data-testid="text-score">
              {result.score}
            </div>
            <Badge className="text-lg px-4 py-1" data-testid="badge-band">
              {result.band}
            </Badge>
          </CardContent>
        </Card>

        {result.headline_gaps && result.headline_gaps.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Key Areas to Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {result.headline_gaps.map((gap, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-500 mt-1">-</span>
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {result.todo_list && result.todo_list.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Your Action Plan
              </CardTitle>
              <CardDescription>Prioritized tasks to get ready for sale</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {result.todo_list.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{item.task}</p>
                      <p className="text-sm text-muted-foreground">{item.reason}</p>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {item.section}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {result.next_steps && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRight className="h-5 w-5" />
                Next Steps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {result.next_steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <ContactCTA org={org} onDownloadPDF={onDownloadPDF} onContactAgent={onContactAgent} />
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      <Card>
        <CardHeader className="text-center">
          <Home className="h-12 w-12 text-primary mx-auto mb-2" />
          <CardTitle>Estimated Property Value</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-4xl font-bold text-primary mb-2" data-testid="text-estimate">
            {result.estimate_display}
          </p>
          <div className="flex items-center justify-center gap-2">
            <Badge variant={
              result.confidence === "High" ? "default" :
              result.confidence === "Medium" ? "secondary" : "outline"
            }>
              {result.confidence} Confidence
            </Badge>
            {result.market_trend && (
              <Badge variant="outline" className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {result.market_trend}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {result.drivers && result.drivers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Value Drivers
            </CardTitle>
            <CardDescription>Factors affecting your property value</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {result.drivers.map((driver, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                  <span>{driver.factor}</span>
                  <Badge variant={
                    driver.direction === "positive" ? "default" :
                    driver.direction === "negative" ? "destructive" : "secondary"
                  }>
                    {driver.impact}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {result.next_steps && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5" />
              Recommended Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {result.next_steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <ContactCTA org={org} onDownloadPDF={onDownloadPDF} onContactAgent={onContactAgent} />
    </div>
  );
}

interface ContactCTAProps {
  org: OrgConfig | null;
  onDownloadPDF: () => void;
  onContactAgent: () => void;
}

function ContactCTA({ org, onDownloadPDF, onContactAgent }: ContactCTAProps) {
  return (
    <div className="space-y-4">
      {/* Download PDF Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="font-semibold">Download Your Report</h3>
              <p className="text-sm text-muted-foreground">Save a copy of your results as a PDF</p>
            </div>
            <Button variant="outline" onClick={onDownloadPDF} data-testid="button-download-pdf">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contact Agent Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6 text-center">
          <Phone className="h-10 w-10 text-primary mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-2">Ready to Take the Next Step?</h3>
          <p className="text-muted-foreground mb-4">
            Request a call back from {org?.business_name || "our team"} for a personal consultation
          </p>
          <Button onClick={onContactAgent} data-testid="button-contact">
            Request a Call Back
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

const readyToSellSteps = [
  {
    title: "Property Basics",
    description: "Tell us about your property",
    icon: Home,
    questions: [
      {
        key: "property_type",
        label: "Property Type",
        type: "select",
        required: true,
        options: [
          { value: "detached", label: "Detached House" },
          { value: "semi", label: "Semi-Detached House" },
          { value: "terrace", label: "Terraced House" },
          { value: "apartment", label: "Apartment" },
          { value: "bungalow", label: "Bungalow" },
        ],
      },
      {
        key: "bedrooms",
        label: "Number of Bedrooms",
        type: "select",
        required: true,
        options: [
          { value: "1", label: "1 Bedroom" },
          { value: "2", label: "2 Bedrooms" },
          { value: "3", label: "3 Bedrooms" },
          { value: "4", label: "4 Bedrooms" },
          { value: "5", label: "5 Bedrooms" },
          { value: "6", label: "6+ Bedrooms" },
        ],
      },
      {
        key: "location",
        label: "Town/Area",
        type: "text",
        required: true,
        placeholder: "e.g., Dalkey, Dublin",
      },
    ],
  },
  {
    title: "Timeline & Motivation",
    description: "When are you looking to sell?",
    icon: Calendar,
    questions: [
      {
        key: "timeline",
        label: "When do you want to sell?",
        type: "radio",
        required: true,
        options: [
          { value: "asap", label: "As soon as possible", description: "Ready to list now" },
          { value: "1_3_months", label: "1-3 months", description: "Planning to list soon" },
          { value: "3_6_months", label: "3-6 months", description: "Preparing for sale" },
          { value: "6_12_months", label: "6-12 months", description: "Early planning stage" },
          { value: "just_exploring", label: "Just exploring", description: "Curious about the process" },
        ],
      },
      {
        key: "motivation",
        label: "What's your main reason for selling?",
        type: "select",
        required: false,
        options: [
          { value: "upsizing", label: "Upsizing / Need more space" },
          { value: "downsizing", label: "Downsizing" },
          { value: "relocating", label: "Relocating" },
          { value: "investment", label: "Investment / Financial" },
          { value: "life_change", label: "Life change (marriage, divorce, etc.)" },
          { value: "just_curious", label: "Just curious about value" },
        ],
      },
    ],
  },
  {
    title: "Legal Readiness",
    description: "Documentation and compliance status",
    icon: FileText,
    questions: [
      {
        key: "title_deeds",
        label: "Do you have access to your title deeds?",
        type: "radio",
        required: true,
        options: [
          { value: "in_hand", label: "Yes, I have them", description: "Documents are accessible" },
          { value: "with_solicitor", label: "With my solicitor", description: "Held by legal representative" },
          { value: "unknown", label: "I'm not sure", description: "Need to check" },
        ],
      },
      {
        key: "planning_compliance",
        label: "Is the property fully planning compliant?",
        type: "radio",
        required: true,
        options: [
          { value: "fully_compliant", label: "Yes, fully compliant", description: "All works have proper planning" },
          { value: "minor_issues", label: "Minor issues", description: "Some items may need attention" },
          { value: "unknown", label: "Not sure", description: "Haven't checked" },
        ],
      },
      {
        key: "solicitor_appointed",
        label: "Have you appointed a solicitor for the sale?",
        type: "radio",
        required: true,
        options: [
          { value: "yes", label: "Yes", description: "Solicitor is ready" },
          { value: "no", label: "Not yet", description: "Will appoint when needed" },
          { value: "unknown", label: "Not sure", description: "Haven't decided" },
        ],
      },
    ],
  },
  {
    title: "Property Condition",
    description: "Current state and presentation",
    icon: Wrench,
    questions: [
      {
        key: "property_condition",
        label: "How would you describe your property's condition?",
        type: "radio",
        required: true,
        options: [
          { value: "excellent", label: "Excellent", description: "Move-in ready, recently updated" },
          { value: "good", label: "Good", description: "Well-maintained, minor updates needed" },
          { value: "fair", label: "Fair", description: "Functional but dated" },
          { value: "needs_work", label: "Needs work", description: "Requires renovation or repairs" },
        ],
      },
      {
        key: "is_presentable",
        label: "Is the property ready for viewings?",
        type: "radio",
        required: true,
        options: [
          { value: "yes", label: "Yes", description: "Decluttered and presentable" },
          { value: "partially", label: "Partially", description: "Some work needed" },
          { value: "no", label: "Not yet", description: "Needs significant preparation" },
        ],
      },
      {
        key: "ber_rating",
        label: "BER Rating (if known)",
        type: "select",
        required: false,
        options: [
          { value: "A1", label: "A1" },
          { value: "A2", label: "A2" },
          { value: "A3", label: "A3" },
          { value: "B1", label: "B1" },
          { value: "B2", label: "B2" },
          { value: "B3", label: "B3" },
          { value: "C1", label: "C1" },
          { value: "C2", label: "C2" },
          { value: "C3", label: "C3" },
          { value: "D1", label: "D1" },
          { value: "D2", label: "D2" },
          { value: "E1", label: "E1" },
          { value: "E2", label: "E2" },
          { value: "F", label: "F" },
          { value: "G", label: "G" },
          { value: "unknown", label: "Don't know" },
        ],
      },
    ],
  },
  {
    title: "Pricing Expectations",
    description: "Your thoughts on value",
    icon: DollarSign,
    questions: [
      {
        key: "has_price_expectation",
        label: "Do you have a price expectation?",
        type: "radio",
        required: true,
        options: [
          { value: "yes", label: "Yes, I have a target price", description: "Based on research or valuation" },
          { value: "rough_idea", label: "Rough idea", description: "Have a general range in mind" },
          { value: "no", label: "No", description: "Need guidance on pricing" },
        ],
      },
      {
        key: "price_flexibility",
        label: "How flexible are you on price?",
        type: "radio",
        required: false,
        options: [
          { value: "flexible", label: "Flexible", description: "Open to market feedback" },
          { value: "somewhat_flexible", label: "Somewhat flexible", description: "Some room for negotiation" },
          { value: "firm", label: "Firm", description: "Need to achieve a specific price" },
        ],
      },
    ],
  },
];

const worthEstimateSteps = [
  {
    title: "Property Location",
    description: "Where is your property located?",
    icon: Home,
    questions: [
      {
        key: "eircode",
        label: "Eircode",
        type: "text",
        required: false,
        placeholder: "e.g., D02 XY45 (optional)",
      },
      {
        key: "town",
        label: "Townland",
        type: "text",
        required: true,
        placeholder: "e.g., Mountbellew",
      },
      {
        key: "county",
        label: "County",
        type: "select",
        required: true,
        options: [
          { value: "dublin", label: "Dublin" },
          { value: "cork", label: "Cork" },
          { value: "galway", label: "Galway" },
          { value: "limerick", label: "Limerick" },
          { value: "waterford", label: "Waterford" },
          { value: "kildare", label: "Kildare" },
          { value: "meath", label: "Meath" },
          { value: "wicklow", label: "Wicklow" },
          { value: "wexford", label: "Wexford" },
          { value: "other", label: "Other" },
        ],
      },
    ],
  },
  {
    title: "Property Type",
    description: "What type of property is it?",
    icon: Home,
    questions: [
      {
        key: "property_type",
        label: "Property Type",
        type: "radio",
        required: true,
        options: [
          { value: "detached", label: "Detached House" },
          { value: "semi", label: "Semi-Detached House" },
          { value: "terrace", label: "Terraced House" },
          { value: "apartment", label: "Apartment" },
          { value: "bungalow", label: "Bungalow" },
        ],
      },
      {
        key: "bedrooms",
        label: "Number of Bedrooms",
        type: "select",
        required: true,
        options: [
          { value: "1", label: "1 Bedroom" },
          { value: "2", label: "2 Bedrooms" },
          { value: "3", label: "3 Bedrooms" },
          { value: "4", label: "4 Bedrooms" },
          { value: "5", label: "5 Bedrooms" },
          { value: "6", label: "6+ Bedrooms" },
        ],
      },
      {
        key: "bathrooms",
        label: "Number of Bathrooms",
        type: "select",
        required: true,
        options: [
          { value: "1", label: "1 Bathroom" },
          { value: "2", label: "2 Bathrooms" },
          { value: "3", label: "3 Bathrooms" },
          { value: "4", label: "4+ Bathrooms" },
        ],
      },
      {
        key: "land_size_acres",
        label: "Approx Land Size (acres)",
        type: "number",
        required: false,
        placeholder: "e.g., 0.5 (leave blank if unsure)",
      },
    ],
  },
  {
    title: "Property Condition",
    description: "Current state of your property",
    icon: Wrench,
    questions: [
      {
        key: "property_condition",
        label: "Overall Condition",
        type: "radio",
        required: true,
        options: [
          { value: "excellent", label: "Excellent", description: "Recently renovated, top quality" },
          { value: "good", label: "Good", description: "Well-maintained, move-in ready" },
          { value: "fair", label: "Fair", description: "Functional but dated" },
          { value: "needs_work", label: "Needs Work", description: "Requires renovation" },
        ],
      },
      {
        key: "property_age",
        label: "Approximate Age of Property",
        type: "select",
        required: true,
        options: [
          { value: "new_build", label: "New Build (0-5 years)" },
          { value: "modern", label: "Modern (5-20 years)" },
          { value: "established", label: "Established (20-50 years)" },
          { value: "period", label: "Period Property (50-100 years)" },
          { value: "historic", label: "Historic (100+ years)" },
        ],
      },
      {
        key: "recent_renovations",
        label: "Recent Renovations (last 10 years)",
        type: "select",
        required: false,
        options: [
          { value: "major", label: "Major renovation (kitchen, bathroom, extension)" },
          { value: "moderate", label: "Moderate updates (new windows, heating, roof)" },
          { value: "minor", label: "Minor updates (decorative, flooring)" },
          { value: "none", label: "No significant renovations" },
        ],
      },
      {
        key: "occupancy",
        label: "Current Occupancy",
        type: "radio",
        required: true,
        options: [
          { value: "owner_occupied", label: "Owner Occupied" },
          { value: "rented", label: "Rented / Tenanted" },
          { value: "vacant", label: "Vacant" },
        ],
      },
    ],
  },
  {
    title: "Property Details",
    description: "Additional details help refine your estimate",
    icon: FileText,
    questions: [
      {
        key: "floor_area_sqm",
        label: "Approximate Floor Area (sqm)",
        type: "number",
        required: false,
        placeholder: "e.g., 120 (leave blank if unsure)",
      },
      {
        key: "ber_rating",
        label: "BER Rating",
        type: "select",
        required: false,
        options: [
          { value: "A", label: "A (A1-A3)" },
          { value: "B", label: "B (B1-B3)" },
          { value: "C", label: "C (C1-C3)" },
          { value: "D", label: "D (D1-D2)" },
          { value: "E", label: "E (E1-E2)" },
          { value: "F", label: "F" },
          { value: "G", label: "G" },
          { value: "unknown", label: "Don't know" },
        ],
      },
      {
        key: "parking",
        label: "Parking",
        type: "select",
        required: false,
        options: [
          { value: "garage", label: "Garage" },
          { value: "driveway", label: "Driveway" },
          { value: "on_street", label: "On-street only" },
          { value: "none", label: "None" },
        ],
      },
      {
        key: "outdoor_space",
        label: "Outdoor Space",
        type: "select",
        required: false,
        options: [
          { value: "large", label: "Large garden" },
          { value: "average", label: "Average garden" },
          { value: "small", label: "Small garden / patio" },
          { value: "none", label: "None" },
        ],
      },
    ],
  },
];

export default LeadMagnetQuiz;
