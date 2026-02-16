import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Eye, Code, Copy, Check, ExternalLink } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useLocale } from "@/hooks/useLocale";

interface OrganizationData {
  organization_id: string;
  organizations: {
    slug: string;
    business_name: string;
  };
}

export const IntegrationConfig = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const [hasChanges, setHasChanges] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  const { data: configData, isLoading } = useQuery({
    queryKey: ["ai-assistant-config-with-org"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: orgData, error: orgError } = await supabase
        .from("user_organizations")
        .select("organization_id, organizations(slug, business_name)")
        .eq("user_id", user.id)
        .single();

      if (orgError) throw orgError;
      if (!orgData) throw new Error("No organization found");

      const typedOrgData = orgData as unknown as OrganizationData;

      const { data, error } = await supabase
        .from("ai_assistant_config")
        .select("*")
        .eq("organization_id", typedOrgData.organization_id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (!data) {
        const { data: newConfig, error: insertError } = await supabase
          .from("ai_assistant_config")
          .insert({
            organization_id: typedOrgData.organization_id,
            user_id: user.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        return { config: newConfig, organization: typedOrgData.organizations };
      }

      return { config: data, organization: typedOrgData.organizations };
    },
  });

  const config = configData?.config;
  const organization = configData?.organization;
  const [localConfig, setLocalConfig] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: orgData, error: orgError } = await supabase
        .from("user_organizations")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (orgError) throw orgError;

      const { error } = await supabase
        .from("ai_assistant_config")
        .update(updates)
        .eq("organization_id", orgData.organization_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-assistant-config-with-org"] });
      setHasChanges(false);
      toast({
        title: t('ai-assistant.integration.saved'),
        description: t('ai-assistant.integration.savedDesc'),
      });
    },
    onError: (error) => {
      toast({
        title: t('ai-assistant.integration.saveFailed'),
        description: error instanceof Error ? error.message : t('ai-assistant.integration.saveFailed'),
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (localConfig) {
      updateMutation.mutate(localConfig);
    }
  };

  const updateLocalConfig = (field: string, value: unknown) => {
    setLocalConfig((prev) => prev ? { ...prev, [field]: value } : prev);
    setHasChanges(true);
  };

  const copyApiEndpoint = () => {
    const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/query-ai-assistant`;
    navigator.clipboard.writeText(endpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: t('ai-assistant.integration.copied'),
      description: t('ai-assistant.integration.copied'),
    });
  };

  const getEmbedCode = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const widgetUrl = `${window.location.origin}/ai-widget.js`;
    const orgSlug = organization?.slug || '';
    const widgetColor = (localConfig?.widget_color as string) || '#2563eb';
    const welcomeMessage = (localConfig?.welcome_message as string) || 'Hi! How can I help you find your perfect property today?';

    return `<!-- AI Property Assistant Widget -->
<script>
  window.AIWidgetConfig = {
    orgSlug: "${orgSlug}",
    primaryColor: "${widgetColor}",
    welcomeMessage: "${welcomeMessage}",
    supabaseUrl: "${supabaseUrl}",
    position: "bottom-right"
  };
</script>
<script src="${widgetUrl}" async></script>`;
  };

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(getEmbedCode());
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
    toast({
      title: t('ai-assistant.integration.copied'),
      description: t('ai-assistant.integration.copied'),
    });
  };

  if (isLoading || !localConfig) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>{t('ai-assistant.integration.title')}</CardTitle>
              <CardDescription>
                {t('ai-assistant.integration.description')}
              </CardDescription>
            </div>
            {localConfig.widget_enabled && (
              <Badge variant="default">{t('ai-assistant.integration.statusActive')}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="widget-enabled">{t('ai-assistant.integration.enable')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('ai-assistant.integration.enableDesc')}
              </p>
            </div>
            <Switch
              id="widget-enabled"
              data-testid="switch-widget-enabled"
              checked={localConfig.widget_enabled as boolean}
              onCheckedChange={(checked) => updateLocalConfig("widget_enabled", checked)}
            />
          </div>

          {localConfig.widget_enabled && (
            <div className="mt-4 p-4 bg-muted/50 rounded-md space-y-3">
              <p className="text-sm font-medium">Widget is available on:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Your public listings pages</li>
                <li>Property detail pages</li>
                <li>Any external website using the embed code below</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance Settings</CardTitle>
          <CardDescription>
            Customise how your AI assistant looks and greets visitors
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="welcome-message">Welcome Message</Label>
            <Textarea
              id="welcome-message"
              data-testid="input-welcome-message"
              placeholder="Hi! How can I help you find your perfect property today?"
              value={(localConfig.welcome_message as string) || ''}
              onChange={(e) => updateLocalConfig("welcome_message", e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="widget-color">Widget Primary Color</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="widget-color"
                data-testid="input-widget-color"
                type="color"
                value={(localConfig.widget_color as string) || '#2563eb'}
                onChange={(e) => updateLocalConfig("widget_color", e.target.value)}
                className="w-20 cursor-pointer"
              />
              <Input
                type="text"
                data-testid="input-widget-color-text"
                value={(localConfig.widget_color as string) || '#2563eb'}
                onChange={(e) => updateLocalConfig("widget_color", e.target.value)}
                placeholder="#2563eb"
                className="flex-1"
              />
            </div>
          </div>

          <div className="mt-4 p-4 border rounded-md">
            <p className="text-sm font-medium mb-3">Widget Preview</p>
            <div className="flex items-end justify-end">
              <div 
                className="rounded-full p-4 shadow-lg cursor-pointer transition-transform hover:scale-105"
                style={{ backgroundColor: (localConfig.widget_color as string) || '#2563eb' }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            <div>
              <CardTitle>Embed on External Websites</CardTitle>
              <CardDescription>
                Add this code to your website to display the AI assistant chatbot
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Your Organization Slug</Label>
            <div className="flex gap-2 items-center">
              <Badge variant="secondary" className="font-mono text-sm">
                {organization?.slug || 'loading...'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Used to identify your widget
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Embed Code</Label>
            <div className="relative">
              <pre className="p-4 bg-muted rounded-md text-xs overflow-x-auto font-mono whitespace-pre-wrap break-all">
                {getEmbedCode()}
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="absolute top-2 right-2"
                onClick={copyEmbedCode}
                data-testid="button-copy-embed"
              >
                {copiedEmbed ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Code
                  </>
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Paste this code before the closing &lt;/body&gt; tag on any page where you want the widget to appear.
            </p>
          </div>

          {!localConfig.widget_enabled && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Note: The widget is currently disabled. Enable it above to make the chatbot functional.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Access</CardTitle>
          <CardDescription>
            Connect external applications directly to your AI assistant
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API Endpoint</Label>
            <div className="flex gap-2">
              <Input
                value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/query-ai-assistant`}
                readOnly
                className="font-mono text-xs"
                data-testid="input-api-endpoint"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyApiEndpoint}
                data-testid="button-copy-api"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="p-4 bg-muted/50 rounded-md">
            <p className="text-sm font-medium mb-2">API Usage Example</p>
            <pre className="text-xs font-mono bg-background p-3 rounded border overflow-x-auto">
{`fetch("${import.meta.env.VITE_SUPABASE_URL}/functions/v1/query-ai-assistant", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-org-slug": "${organization?.slug || 'your-org-slug'}"
  },
  body: JSON.stringify({
    query: "What properties do you have available?",
    organizationSlug: "${organization?.slug || 'your-org-slug'}",
    conversationHistory: []
  })
})`}
            </pre>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Deployment Status</CardTitle>
          <CardDescription>
            Monitor your AI assistant's deployment and usage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Status</p>
              <div>
                {localConfig.widget_enabled ? (
                  <Badge variant="default" data-testid="badge-status-live">Live</Badge>
                ) : (
                  <Badge variant="secondary" data-testid="badge-status-disabled">Disabled</Badge>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Training Status</p>
              <div>
                <Badge variant="secondary">Ready</Badge>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p className="text-sm font-medium">
                {localConfig.updated_at ? new Date(localConfig.updated_at as string).toLocaleDateString() : 'Never'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-4">
            <Button variant="outline" size="sm" asChild data-testid="button-preview-site">
              <a href={`/${organization?.slug || ''}`} target="_blank" rel="noopener noreferrer">
                <Eye className="mr-2 h-4 w-4" />
                Preview on Site
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild data-testid="button-open-public">
              <a href={`/${organization?.slug || ''}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Public Page
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {hasChanges && (
        <div className="sticky bottom-4 flex justify-end z-50">
          <Button 
            onClick={handleSave} 
            disabled={updateMutation.isPending} 
            size="lg"
            data-testid="button-save-settings"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Integration Settings
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
