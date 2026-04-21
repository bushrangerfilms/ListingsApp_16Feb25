import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Globe, CheckCircle2, ArrowRight, Lock, ExternalLink, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { DnsProviderGuide } from "@/components/DnsProviderGuide";
import { DnsAiPromptButton } from "@/components/DnsAiPromptButton";
import { EmailDnsRecords } from "@/components/EmailDnsRecords";
import {
  useDomainVerification,
  type DomainStatus,
  type EmailSenderStatus,
  type EmailSenderRecord,
} from "@/hooks/useDomainVerification";
import { usePlanInfo } from "@/hooks/usePlanInfo";
import { useNavigate } from "react-router-dom";

interface CustomDomainSetupProps {
  organizationId: string;
  organizationName: string;
  organizationSlug?: string;
  currentDomain: string | null;
  cnameTarget?: string | null;
  domainStatus?: DomainStatus;
  onDomainChange: (domain: string) => void;
}

export function CustomDomainSetup({
  organizationId,
  organizationName,
  organizationSlug,
  currentDomain,
  cnameTarget,
  domainStatus: initialDomainStatus,
  onDomainChange,
}: CustomDomainSetupProps) {
  const [domain, setDomain] = useState(currentDomain || "");
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRetryingEmailSender, setIsRetryingEmailSender] = useState(false);
  const [localCnameTarget, setLocalCnameTarget] = useState(cnameTarget || "");
  const [localStatus, setLocalStatus] = useState<DomainStatus>(initialDomainStatus || null);
  const [localEmailSenderDomain, setLocalEmailSenderDomain] = useState<string | null>(null);
  const [localEmailSenderStatus, setLocalEmailSenderStatus] = useState<EmailSenderStatus>(null);
  const [localEmailSenderRecords, setLocalEmailSenderRecords] = useState<EmailSenderRecord[] | null>(null);
  const navigate = useNavigate();

  const { planInfo } = usePlanInfo();
  const isPaidPlan = planInfo?.accountStatus === 'active';

  const {
    status: verificationStatus,
    emailSenderStatus: polledEmailSenderStatus,
    emailSenderDomain: polledEmailSenderDomain,
    emailSenderRecords: polledEmailSenderRecords,
    isChecking,
    checkNow,
    isVerified,
  } = useDomainVerification(
    organizationId,
    localStatus,
    !!currentDomain && localStatus !== 'verified',
    {
      status: localEmailSenderStatus,
      domain: localEmailSenderDomain,
      records: localEmailSenderRecords,
    },
  );

  // Polled email sender state replaces local on every successful verify.
  useEffect(() => {
    if (polledEmailSenderDomain !== null) setLocalEmailSenderDomain(polledEmailSenderDomain);
    if (polledEmailSenderStatus !== null) setLocalEmailSenderStatus(polledEmailSenderStatus);
    if (polledEmailSenderRecords !== null) setLocalEmailSenderRecords(polledEmailSenderRecords);
  }, [polledEmailSenderDomain, polledEmailSenderStatus, polledEmailSenderRecords]);

  // Sync verification status back to local state
  useEffect(() => {
    if (verificationStatus && verificationStatus !== localStatus) {
      setLocalStatus(verificationStatus);
    }
  }, [verificationStatus]);

  useEffect(() => {
    setDomain(currentDomain || "");
    setLocalCnameTarget(cnameTarget || "");
    setLocalStatus(initialDomainStatus || null);
  }, [currentDomain, cnameTarget, initialDomainStatus]);

  const hasDomain = !!currentDomain && currentDomain.trim() !== "";

  const getCurrentStep = (): 1 | 2 | 3 => {
    if (!hasDomain) return 1;
    if (isVerified || localStatus === 'verified') return 3;
    return 2;
  };

  const currentStep = getCurrentStep();

  const handleCreateDomain = async () => {
    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!cleanDomain) {
      toast({ title: "Domain required", description: "Please enter a domain name.", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-custom-domain', {
        body: { action: 'create', organizationId, domain: cleanDomain },
      });

      if (error) throw new Error(error.message || 'Failed to register domain');
      if (data?.error) throw new Error(data.error);

      setLocalCnameTarget(data.cnameTarget || '');
      setLocalStatus('pending');
      setLocalEmailSenderDomain(data.emailSenderDomain ?? null);
      setLocalEmailSenderStatus(data.emailSenderStatus ?? null);
      setLocalEmailSenderRecords(data.emailSenderRecords ?? null);
      onDomainChange(cleanDomain);

      toast({ title: "Domain registered!", description: "Now follow the steps below to connect it." });
    } catch (error) {
      console.error('Create domain error:', error);
      toast({
        title: "Could not register domain",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteDomain = async () => {
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-custom-domain', {
        body: { action: 'delete', organizationId },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setDomain("");
      setLocalCnameTarget("");
      setLocalStatus(null);
      setLocalEmailSenderDomain(null);
      setLocalEmailSenderStatus(null);
      setLocalEmailSenderRecords(null);
      onDomainChange("");

      toast({ title: "Domain removed", description: "Your custom domain has been disconnected." });
    } catch (error) {
      console.error('Delete domain error:', error);
      toast({
        title: "Could not remove domain",
        description: error instanceof Error ? error.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRetryEmailSender = async () => {
    setIsRetryingEmailSender(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-custom-domain', {
        body: { action: 'retry_email_sender', organizationId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setLocalEmailSenderDomain(data.emailSenderDomain ?? null);
      setLocalEmailSenderStatus(data.emailSenderStatus ?? null);
      setLocalEmailSenderRecords(data.emailSenderRecords ?? null);
      toast({ title: "Email sender ready", description: "Add the DNS records below to finish setup." });
    } catch (error) {
      console.error('Retry email sender error:', error);
      toast({
        title: "Still couldn't set up email sender",
        description: error instanceof Error ? error.message : "Please try again shortly.",
        variant: "destructive",
      });
    } finally {
      setIsRetryingEmailSender(false);
    }
  };

  const StepIndicator = ({ step, title, isActive, isCompleted }: { step: number; title: string; isActive: boolean; isCompleted: boolean }) => (
    <div className="flex items-center gap-2">
      <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-colors ${
        isCompleted
          ? 'bg-green-500/20 text-green-600 dark:text-green-400'
          : isActive
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'
      }`}>
        {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : step}
      </div>
      <span className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
        {title}
      </span>
    </div>
  );

  // --- Free tier: locked state ---
  if (!isPaidPlan) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Connect Your Own Domain</CardTitle>
              <CardDescription>
                Use your own web address like <strong>youragency.com</strong> instead of app.autolisting.io/{organizationSlug || 'your-name'}.
                Available on paid plans.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate('/admin/billing')} className="gap-2">
            Upgrade to Unlock
          </Button>
        </CardContent>
      </Card>
    );
  }

  // --- Paid tier: self-service flow ---
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Custom Domain</CardTitle>
              <CardDescription>
                Use your own web address for your public property listings
              </CardDescription>
            </div>
          </div>
          {hasDomain && (
            <Badge variant="outline" className="gap-1.5">
              {currentStep === 3 ? (
                <><CheckCircle2 className="h-3 w-3 text-green-500" /> Connected</>
              ) : (
                <>Step {currentStep} of 3</>
              )}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress bar */}
        {hasDomain && (
          <div className="flex items-center gap-2 pb-4 border-b overflow-x-auto">
            <StepIndicator step={1} title="Enter Domain" isActive={currentStep === 1} isCompleted={currentStep > 1} />
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <StepIndicator step={2} title="Update DNS" isActive={currentStep === 2} isCompleted={currentStep > 2} />
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <StepIndicator step={3} title="You're Live" isActive={currentStep === 3} isCompleted={false} />
          </div>
        )}

        {/* STEP 1: Enter domain */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-base font-medium">What domain do you want to use?</p>
              <p className="text-sm text-muted-foreground">
                This is the web address your clients will visit to see your property listings.
                For example: youragency.com or listings.youragency.com
              </p>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="e.g. youragency.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateDomain()}
              />
              <Button
                onClick={handleCreateDomain}
                disabled={isCreating || !domain.trim()}
              >
                {isCreating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Setting up...</> : "Continue"}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Don't have a domain? You can buy one from providers like Namecheap, GoDaddy, or Cloudflare for around $10-15/year.
            </p>

            <div className="bg-muted/50 rounded-md p-3">
              <p className="text-xs text-muted-foreground">
                Your public listings are currently available at:{" "}
                <a
                  href={`https://app.autolisting.io/${organizationSlug || organizationId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground inline-flex items-center gap-1"
                >
                  app.autolisting.io/{organizationSlug || 'your-org'}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: Configure DNS */}
        {currentStep === 2 && localCnameTarget && (
          <div className="space-y-6">
            <div className="space-y-1">
              <p className="text-base font-medium">Point your domain to AutoListing</p>
              <p className="text-sm text-muted-foreground">
                You need to update a setting with your domain provider (where you bought your domain).
                This tells the internet to send visitors to your AutoListing site.
                It sounds technical but it's just copying and pasting one value.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                This usually takes about 5 minutes to set up.
              </p>
            </div>

            {/* Provider guide with DNS records */}
            <DnsProviderGuide
              cnameTarget={localCnameTarget}
              domain={currentDomain || domain}
            />

            {/* Email sender records — add at the same DNS provider in the same session */}
            <EmailDnsRecords
              domain={currentDomain || domain}
              senderDomain={localEmailSenderDomain}
              records={localEmailSenderRecords}
              status={localEmailSenderStatus}
              onRetry={handleRetryEmailSender}
              isRetrying={isRetryingEmailSender}
            />

            {/* Verification status */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                {isChecking ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : localStatus === 'dns_configured' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    {localStatus === 'dns_configured'
                      ? "We can see your changes — waiting for your security certificate..."
                      : "Waiting for your changes to take effect..."
                    }
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This can take anywhere from a few minutes to a couple of hours. You can close this page and come back — we'll keep checking automatically.
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={checkNow}
                disabled={isChecking}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                Check Now
              </Button>
            </div>

            {/* LLM help */}
            <DnsAiPromptButton
              domain={currentDomain || domain}
              cnameTarget={localCnameTarget}
            />

            {/* Change/remove domain */}
            <div className="pt-2 border-t flex items-center justify-between text-sm">
              <div>
                <span className="text-muted-foreground">Domain: </span>
                <span className="font-mono font-medium">{currentDomain}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteDomain}
                disabled={isDeleting}
                className="text-muted-foreground gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isDeleting ? "Removing..." : "Remove"}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Live! */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 shrink-0" />
              <div>
                <p className="text-base font-medium text-green-800 dark:text-green-300">
                  Your domain is connected!
                </p>
                <p className="text-sm text-green-700 dark:text-green-400">
                  Your property listings are now live at <strong>{currentDomain}</strong>.
                  Your clients can visit this address to browse your properties.
                </p>
              </div>
            </div>

            {localEmailSenderStatus === 'verified' && localEmailSenderDomain && (
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 shrink-0" />
                <div>
                  <p className="text-base font-medium text-green-800 dark:text-green-300">
                    Branded email is live
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-400">
                    Emails to your leads now come from <code className="text-xs">noreply@{localEmailSenderDomain}</code> with
                    replies routed to your contact email — no "autolisting" in the sender.
                  </p>
                </div>
              </div>
            )}

            {localEmailSenderStatus && localEmailSenderStatus !== 'verified' && (
              <EmailDnsRecords
                domain={currentDomain || domain}
                senderDomain={localEmailSenderDomain}
                records={localEmailSenderRecords}
                status={localEmailSenderStatus}
                onRetry={handleRetryEmailSender}
                isRetrying={isRetryingEmailSender}
              />
            )}

            <a
              href={`https://${currentDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              Visit {currentDomain} <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <p className="text-xs text-muted-foreground">
              Your SSL certificate (the padlock icon in the browser) was set up automatically.
            </p>

            <div className="pt-4 border-t flex items-center justify-between text-sm">
              <div>
                <span className="text-muted-foreground">Domain: </span>
                <span className="font-mono font-medium">{currentDomain}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteDomain}
                disabled={isDeleting}
                className="text-muted-foreground gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isDeleting ? "Removing..." : "Remove Domain"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
