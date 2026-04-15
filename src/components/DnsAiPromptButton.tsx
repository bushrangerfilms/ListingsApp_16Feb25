import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle2, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface DnsAiPromptButtonProps {
  domain: string;
  cnameTarget: string;
}

export function DnsAiPromptButton({ domain, cnameTarget }: DnsAiPromptButtonProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const prompt = `I need help configuring DNS for my domain ${domain}.

I need to add these records at my domain provider:
1. A CNAME record: Name "@", pointing to ${cnameTarget}
2. I also need to remove any existing A or AAAA records for my domain first.

My domain provider is [REPLACE WITH YOUR PROVIDER, e.g. Cloudflare, GoDaddy, Namecheap].

Please walk me through the exact steps in their dashboard. I'm not technical — explain each click simply.`;

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied!",
      description: "Paste this into ChatGPT, Claude, or any AI assistant.",
    });
  };

  return (
    <div className="border rounded-lg">
      <button
        className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors rounded-lg"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Need extra help?</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            You can copy the instructions below and paste them into ChatGPT, Claude, or any AI assistant.
            Just replace the provider name with yours and it will walk you through step by step.
          </p>

          <div className="bg-muted/50 rounded-md p-3">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
              {prompt}
            </pre>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={handleCopy}
          >
            {copied ? (
              <><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Copied!</>
            ) : (
              <><Copy className="h-3.5 w-3.5" /> Copy Instructions for AI Assistant</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
