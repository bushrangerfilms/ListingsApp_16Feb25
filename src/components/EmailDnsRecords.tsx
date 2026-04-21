import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle2, Mail, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { EmailSenderRecord, EmailSenderStatus } from "@/hooks/useDomainVerification";

interface EmailDnsRecordsProps {
  domain: string;                      // public custom domain (e.g. bridgeauctioneers.ie)
  senderDomain: string | null;         // em.<domain> — may be null if Resend provisioning failed
  records: EmailSenderRecord[] | null;
  status: EmailSenderStatus;
  onRetry?: () => void;
  isRetrying?: boolean;
}

function hostRelativeToZone(name: string, zone: string): string {
  const lowerName = name.toLowerCase();
  const lowerZone = zone.toLowerCase();
  if (lowerName === lowerZone) return "@";
  if (lowerName.endsWith(`.${lowerZone}`)) return name.slice(0, -`.${zone}`.length);
  return name;
}

function statusBadge(status?: string) {
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
        <CheckCircle2 className="h-3 w-3" /> Verified
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
        <AlertTriangle className="h-3 w-3" /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" /> Pending
    </span>
  );
}

export function EmailDnsRecords({
  domain,
  senderDomain,
  records,
  status,
  onRetry,
  isRetrying,
}: EmailDnsRecordsProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Resend provisioning failed — show retry affordance instead of the table.
  if (!senderDomain || !records || records.length === 0) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Branded email sender isn't ready yet</p>
            <p className="text-sm text-muted-foreground">
              Your public site will still work, but emails to your leads will come from
              {" "}<code className="text-xs">noreply@mail.autolisting.io</code> with replies routed to your contact email.
              We can retry provisioning a branded sender whenever you're ready.
            </p>
          </div>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
            {isRetrying ? (
              <><Loader2 className="h-3 w-3 mr-2 animate-spin" /> Retrying…</>
            ) : (
              <><RefreshCw className="h-3 w-3 mr-2" /> Try again</>
            )}
          </Button>
        )}
      </div>
    );
  }

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      toast({ title: "Copied", description: "Paste into your DNS provider." });
      setTimeout(() => setCopiedKey(k => (k === key ? null : k)), 2000);
    } catch {
      toast({ title: "Couldn't copy", description: "Copy the value manually.", variant: "destructive" });
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-start gap-3">
        <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Email sender records</h3>
            {statusBadge(status ?? undefined)}
          </div>
          <p className="text-sm text-muted-foreground">
            Add these at the <strong>same DNS provider</strong> where you just added the CNAME above.
            Once verified, your emails will send from <code className="text-xs">noreply@{senderDomain}</code>
            {" "}— no "autolisting" in the address.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="font-medium pb-2 pr-3">Type</th>
              <th className="font-medium pb-2 pr-3">Host</th>
              <th className="font-medium pb-2 pr-3">Value</th>
              <th className="font-medium pb-2 pr-3">Priority</th>
              <th className="font-medium pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => {
              const relativeHost = hostRelativeToZone(r.name, domain);
              const hostKey = `host-${i}`;
              const valueKey = `value-${i}`;
              return (
                <tr key={i} className="border-t">
                  <td className="py-2 pr-3 font-mono text-xs">{r.type}</td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-1">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{relativeHost}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => copy(relativeHost, hostKey)}
                      >
                        {copiedKey === hostKey ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </td>
                  <td className="py-2 pr-3 max-w-xs">
                    <div className="flex items-center gap-1">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded truncate max-w-[220px]" title={r.value}>
                        {r.value}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => copy(r.value, valueKey)}
                      >
                        {copiedKey === valueKey ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">{r.priority ?? "—"}</td>
                  <td className="py-2">{statusBadge(r.status)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Most DNS providers auto-append your domain to the Host field, so paste the Host value exactly as shown
        (e.g. <code>resend._domainkey.em</code>, not the full <code>resend._domainkey.em.{domain}</code>).
      </p>
    </div>
  );
}
