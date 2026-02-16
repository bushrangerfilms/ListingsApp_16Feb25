import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Globe, Copy, CheckCircle2, Clock, Mail, ExternalLink, ArrowRight } from "lucide-react";

interface CustomDomainSetupProps {
  organizationId: string;
  organizationName: string;
  organizationSlug?: string;
  currentDomain: string | null;
  onDomainChange: (domain: string) => void;
}

const REPLIT_IP = "34.111.179.208";

export function CustomDomainSetup({ 
  organizationId, 
  organizationName,
  organizationSlug,
  currentDomain,
  onDomainChange
}: CustomDomainSetupProps) {
  const [domain, setDomain] = useState(currentDomain || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [activationRequested, setActivationRequested] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    setDomain(currentDomain || "");
  }, [currentDomain]);

  const hasDomain = !!currentDomain && currentDomain.trim() !== "";

  const getCurrentStep = (): 1 | 2 | 3 | 4 => {
    if (!hasDomain) return 1;
    if (!activationRequested) return 2;
    return 3;
  };

  const currentStep = getCurrentStep();

  const handleSaveDomain = async () => {
    if (!domain.trim()) {
      toast({
        title: "Domain required",
        description: "Please enter a domain name",
        variant: "destructive",
      });
      return;
    }

    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ custom_domain: cleanDomain })
        .eq('id', organizationId);

      if (error) throw error;

      onDomainChange(cleanDomain);
      setActivationRequested(false);
      toast({
        title: "Domain saved",
        description: "Proceed to Step 2 to request activation.",
      });
    } catch (error) {
      console.error('Save domain error:', error);
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save domain",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast({
      title: "Copied",
      description: `${field} copied to clipboard`,
    });
  };

  const handleRequestActivation = async () => {
    if (!currentDomain) return;

    setIsSendingRequest(true);
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: 'support@autolisting.io',
          subject: `Custom Domain Activation Request: ${currentDomain}`,
          html: `
            <h2>Custom Domain Activation Request</h2>
            <p><strong>Organization:</strong> ${organizationName}</p>
            <p><strong>Organization ID:</strong> ${organizationId}</p>
            <p><strong>Requested Domain:</strong> ${currentDomain}</p>
            <hr />
            <h3>Admin Instructions:</h3>
            <ol>
              <li>Go to Replit Deployments → Settings → Link a domain</li>
              <li>Enter: <strong>${currentDomain}</strong></li>
              <li>Copy the TXT verification record that Replit generates</li>
              <li>Reply to the client with the DNS records:
                <ul>
                  <li>A record: @ → ${REPLIT_IP}</li>
                  <li>TXT record: @ → [paste verification code]</li>
                </ul>
              </li>
              <li>Once client confirms DNS is set up, click "Link" in Replit to verify</li>
            </ol>
          `,
        },
      });

      if (error) throw error;

      setActivationRequested(true);
      toast({
        title: "Activation requested",
        description: "We'll email you the DNS records within 24 hours.",
      });
    } catch (error) {
      console.error('Request activation error:', error);
      toast({
        title: "Request failed",
        description: error instanceof Error ? error.message : "Failed to send activation request. Please try again or contact support@autolisting.io directly.",
        variant: "destructive",
      });
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleRemoveDomain = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ custom_domain: null })
        .eq('id', organizationId);

      if (error) throw error;

      setDomain("");
      setActivationRequested(false);
      onDomainChange("");
      toast({
        title: "Domain removed",
        description: "Your custom domain has been removed.",
      });
    } catch (error) {
      console.error('Remove domain error:', error);
      toast({
        title: "Remove failed",
        description: error instanceof Error ? error.message : "Failed to remove domain",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const StepIndicator = ({ step, title, isActive, isCompleted }: { step: number; title: string; isActive: boolean; isCompleted: boolean }) => (
    <div className="flex items-center gap-3">
      <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
        isCompleted 
          ? 'bg-green-500/20 text-green-600 dark:text-green-400' 
          : isActive 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-muted text-muted-foreground'
      }`}>
        {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : step}
      </div>
      <span className={`text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
        {title}
      </span>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Custom Domain</CardTitle>
              <CardDescription>
                Use your own domain for your public property listings
              </CardDescription>
            </div>
          </div>
          {hasDomain && (
            <Badge variant="outline" className="gap-1.5">
              <Clock className="h-3 w-3" />
              Step {currentStep} of 4
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-2 pb-4 border-b overflow-x-auto">
          <StepIndicator step={1} title="Enter Domain" isActive={currentStep === 1} isCompleted={currentStep > 1} />
          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <StepIndicator step={2} title="Request Activation" isActive={currentStep === 2} isCompleted={currentStep > 2} />
          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <StepIndicator step={3} title="Configure DNS" isActive={currentStep === 3} isCompleted={currentStep > 3} />
          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <StepIndicator step={4} title="Go Live" isActive={currentStep === 4} isCompleted={false} />
        </div>

        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom-domain" className="text-base font-medium">Step 1: Enter Your Domain</Label>
              <p className="text-sm text-muted-foreground">
                Enter the domain you want to use for your public listings site.
              </p>
              <div className="flex gap-2 mt-3">
                <Input
                  id="custom-domain"
                  placeholder="yourdomain.com or listings.yourdomain.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="flex-1"
                  data-testid="input-custom-domain"
                />
                <Button
                  onClick={handleSaveDomain}
                  disabled={isSaving || !domain.trim()}
                  data-testid="button-save-domain"
                >
                  {isSaving ? "Saving..." : "Continue"}
                </Button>
              </div>
            </div>
            <div className="bg-muted/50 rounded-md p-4">
              <p className="text-sm text-muted-foreground">
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

        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-base font-medium">Step 2: Request Activation</Label>
              <p className="text-sm text-muted-foreground">
                We'll set up <span className="font-mono font-medium text-foreground">{currentDomain}</span> and 
                email you the DNS records you need to add.
              </p>
            </div>

            <div className="bg-muted/50 rounded-md p-4 space-y-3">
              <p className="text-sm font-medium">What happens next:</p>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal pl-5">
                <li>We receive your request and configure the domain</li>
                <li>We email you with the exact DNS records to add</li>
                <li>You add the records to your domain registrar (e.g., Cloudflare, GoDaddy)</li>
                <li>We verify and activate your domain</li>
              </ol>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={handleRequestActivation}
                disabled={isSendingRequest}
                className="gap-2"
                data-testid="button-request-activation"
              >
                <Mail className="h-4 w-4" />
                {isSendingRequest ? "Sending..." : "Request Activation"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDomain("");
                  onDomainChange("");
                  handleRemoveDomain();
                }}
                disabled={isSaving}
                className="text-muted-foreground"
              >
                Change Domain
              </Button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-base font-medium">Step 3: Configure DNS</Label>
              <p className="text-sm text-muted-foreground">
                Check your email for the DNS records. You'll need to add these to your domain registrar.
              </p>
            </div>

            <div className="bg-muted/50 rounded-md p-4 space-y-4">
              <p className="text-sm font-medium">Expected DNS Records:</p>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4 p-3 bg-background rounded-md">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">A Record</p>
                    <p className="font-mono text-sm">@ → {REPLIT_IP}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleCopy(REPLIT_IP, 'IP Address')}
                  >
                    {copiedField === 'IP Address' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-4 p-3 bg-background rounded-md">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">TXT Record (from email)</p>
                    <p className="font-mono text-sm">@ → replit-verify=<span className="text-muted-foreground">[check email]</span></p>
                  </div>
                </div>
              </div>

              <div className="text-sm space-y-2 pt-2 border-t">
                <p className="font-medium">Important:</p>
                <ul className="text-muted-foreground space-y-1 list-disc pl-5">
                  <li>Set proxy status to "DNS only" (gray cloud) in Cloudflare</li>
                  <li>Remove any existing A or AAAA records for this domain</li>
                  <li>DNS changes can take up to 48 hours to propagate</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button variant="outline" asChild>
                <a href="mailto:support@autolisting.io" className="gap-2">
                  <Mail className="h-4 w-4" />
                  Contact Support
                </a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveDomain}
                disabled={isSaving}
                className="text-muted-foreground"
              >
                Cancel Setup
              </Button>
            </div>
          </div>
        )}

        {hasDomain && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Domain: </span>
                <span className="font-mono font-medium">{currentDomain}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveDomain}
                disabled={isSaving}
                className="text-muted-foreground"
                data-testid="button-remove-domain"
              >
                Remove
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
