import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface DnsProviderGuideProps {
  cnameTarget: string;
  domain: string;
}

type ProviderId = 'cloudflare' | 'godaddy' | 'namecheap' | 'other';

interface Provider {
  id: ProviderId;
  name: string;
  propagation: string;
  helpUrl: string;
  steps: string[];
  warnings?: string[];
}

const providers: Provider[] = [
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    propagation: 'Usually instant to 5 minutes',
    helpUrl: 'https://developers.cloudflare.com/dns/manage-dns-records/',
    steps: [
      'Log in to your Cloudflare account at dash.cloudflare.com',
      'Click on your domain name from the dashboard',
      'Click "DNS" in the left sidebar to open your DNS records',
      'Look for any existing A or AAAA records for your domain — click the three dots on the right and delete them',
      'Click "Add Record" and choose Type: CNAME',
      'In the "Name" field, enter: @',
      'In the "Target" field, paste: {cnameTarget}',
      'Click Save',
    ],
    warnings: [
      'Make sure the orange cloud icon is toggled OFF (it should show a grey cloud that says "DNS only"). This is required for your security certificate to work correctly.',
    ],
  },
  {
    id: 'godaddy',
    name: 'GoDaddy',
    propagation: '30 minutes to a few hours',
    helpUrl: 'https://www.godaddy.com/help/manage-dns-records-680',
    steps: [
      'Log in to GoDaddy at godaddy.com',
      'Go to My Products and click "DNS" next to your domain',
      'Look for any existing A records — click the pencil icon and delete them',
      'Click "Add" to create a new record',
      'Choose Type: CNAME, set Host to @, and set "Points to" to: {cnameTarget}',
      'Set TTL to 1 Hour and click Save',
    ],
    warnings: [
      'GoDaddy sometimes doesn\'t allow CNAME records on root domains if you have other records (like email MX records). If you see an error, try using a subdomain like www or listings instead.',
    ],
  },
  {
    id: 'namecheap',
    name: 'Namecheap',
    propagation: '30 minutes to 2 hours',
    helpUrl: 'https://www.namecheap.com/support/knowledgebase/article.aspx/319/2237/how-can-i-set-up-a-cname-record-for-my-domain/',
    steps: [
      'Log in to Namecheap at namecheap.com',
      'Go to Domain List and click "Manage" next to your domain',
      'Click the "Advanced DNS" tab at the top',
      'Delete any existing A or AAAA records (click the trash icon next to each one)',
      'Click "Add New Record" and choose Type: CNAME Record',
      'Set Host to @ and Value to: {cnameTarget}',
      'Set TTL to Automatic and click the green tick to save',
    ],
  },
  {
    id: 'other',
    name: 'Other Provider',
    propagation: '5 minutes to a few hours',
    helpUrl: '',
    steps: [
      'Log in to your domain provider\'s website (where you bought your domain)',
      'Find the DNS settings or DNS management page for your domain',
      'Remove any existing A or AAAA records for your domain (these point to an old IP address)',
      'Add a new CNAME record with Name/Host set to @ (or your subdomain) and Value/Target set to: {cnameTarget}',
      'Save your changes and wait for them to take effect',
    ],
  },
];

export function DnsProviderGuide({ cnameTarget, domain }: DnsProviderGuideProps) {
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
    toast({ title: "Copied!", description: `${label} copied to clipboard` });
  };

  const provider = providers.find(p => p.id === selectedProvider);

  return (
    <div className="space-y-6">
      {/* Provider selector */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Where did you buy your domain?</p>
        <p className="text-xs text-muted-foreground">
          Select your provider so we can show you the exact steps. Not sure? Check your email for a "domain registration" or "domain purchase" confirmation.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {providers.map((p) => (
            <Button
              key={p.id}
              variant={selectedProvider === p.id ? "default" : "outline"}
              className="h-auto py-3 text-sm justify-start"
              onClick={() => setSelectedProvider(p.id)}
            >
              {p.name}
            </Button>
          ))}
        </div>
      </div>

      {/* DNS records to copy */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Values you'll need to copy</p>
        <div className="bg-muted/50 rounded-lg p-4 space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              CNAME Record Target
            </p>
            <p className="text-xs text-muted-foreground">
              This tells the internet where to find your AutoListing website
            </p>
            <div className="flex items-center gap-2 bg-background rounded-md p-3">
              <code className="text-sm font-mono flex-1 break-all">{cnameTarget}</code>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => handleCopy(cnameTarget, 'CNAME target')}
              >
                {copiedField === 'CNAME target' ? (
                  <><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Copied</>
                ) : (
                  <><Copy className="h-3.5 w-3.5" /> Copy</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* What to delete warning */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-2">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              You may need to remove old records first
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              If your domain was previously pointing somewhere else (like a website builder or parking page),
              you'll need to remove the old setting before adding the new one. Look for any existing
              <strong> A records</strong> or <strong>AAAA records</strong> for your domain and delete them.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
              <strong>Don't worry</strong> — this won't affect your email. Records labelled MX, SPF, DKIM, or DMARC
              are for email and should be left alone.
            </p>
          </div>
        </div>
      </div>

      {/* Provider-specific steps */}
      {provider && (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            Step-by-step for {provider.name}
          </p>
          <div className="bg-muted/50 rounded-lg p-4">
            <ol className="space-y-3">
              {provider.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">
                    {step.replace('{cnameTarget}', cnameTarget)}
                  </span>
                </li>
              ))}
            </ol>

            {provider.warnings?.map((warning, i) => (
              <div key={i} className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  <strong>Important:</strong> {warning}
                </p>
              </div>
            ))}

            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>Changes usually take effect in: {provider.propagation}</span>
              {provider.helpUrl && (
                <a
                  href={provider.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {provider.name} help docs <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Root domain tip */}
      <div className="text-xs text-muted-foreground bg-muted/30 rounded-md p-3 space-y-1">
        <p className="font-medium text-foreground">Using a root domain (e.g. youragency.com)?</p>
        <p>
          Some providers don't support CNAME records on root domains. If you see an error,
          you can either use a subdomain (like www.youragency.com or listings.youragency.com)
          or transfer your DNS management to Cloudflare (free) which supports this.
        </p>
      </div>
    </div>
  );
}
