import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useLocale } from "@/hooks/useLocale";

const personalities = [
  { value: "professional", label: "Professional", description: "Formal and business-focused" },
  { value: "friendly", label: "Friendly", description: "Warm and approachable" },
  { value: "casual", label: "Casual", description: "Relaxed and conversational" },
  { value: "expert", label: "Expert", description: "Authoritative and knowledgeable" },
];

const capabilities = [
  { id: "property_recommendations", label: "Property Recommendations", description: "Suggest matching properties" },
  { id: "market_insights", label: "Market Insights & Trends", description: "Provide market analysis" },
  { id: "valuation_estimates", label: "Valuation Estimates", description: "Offer property valuations" },
  { id: "viewing_scheduling", label: "Viewing Scheduling", description: "Help schedule property viewings" },
  { id: "lead_qualification", label: "Lead Qualification", description: "Qualify potential buyers/sellers" },
  { id: "contact_gathering", label: "Contact Information Gathering", description: "Naturally collect name, email, phone" },
  { id: "agent_handoff", label: "Agent Handoff", description: "Recognise when to involve human agents" },
  { id: "faq_answering", label: "FAQ Answering", description: "Answer common questions" },
];

const leadFields = [
  { id: "name", label: "Name" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
];

const captureStyles = [
  { value: "subtle", label: "Subtle", description: "Gentle, non-intrusive information gathering" },
  { value: "balanced", label: "Balanced", description: "Natural conversation with clear asks" },
  { value: "aggressive", label: "Aggressive", description: "Direct and persistent qualification" },
];

const models = [
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Balanced - Best for most use cases" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Advanced reasoning" },
  { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", description: "Fast responses" },
];

const responseLengths = [
  { value: "concise", label: "Concise" },
  { value: "balanced", label: "Balanced" },
  { value: "detailed", label: "Detailed" },
];

export const TrainingConfig = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const [hasChanges, setHasChanges] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["ai-assistant-config"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get user's organization ID
      const { data: orgData, error: orgError } = await supabase
        .from("user_organizations")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (orgError) throw orgError;
      if (!orgData) throw new Error("No organization found");

      const { data, error } = await supabase
        .from("ai_assistant_config")
        .select("*")
        .eq("organization_id", orgData.organization_id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (!data) {
        const { data: newConfig, error: insertError } = await supabase
          .from("ai_assistant_config")
          .insert({
            organization_id: orgData.organization_id,
            user_id: user.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        return newConfig;
      }

      return data;
    },
  });

  const [localConfig, setLocalConfig] = useState<any>(null);

  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get user's organization ID
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
      queryClient.invalidateQueries({ queryKey: ["ai-assistant-config"] });
      setHasChanges(false);
      toast({
        title: "Configuration Saved",
        description: "Your AI assistant training settings have been updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save configuration",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (localConfig) {
      updateMutation.mutate(localConfig);
    }
  };

  const updateLocalConfig = (field: string, value: any) => {
    setLocalConfig((prev: any) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const toggleCapability = (capabilityId: string, enabled: boolean) => {
    const currentCapabilities = (localConfig?.enabled_capabilities as string[]) || [];
    const newCapabilities = enabled
      ? [...currentCapabilities, capabilityId]
      : currentCapabilities.filter((id: string) => id !== capabilityId);
    
    updateLocalConfig("enabled_capabilities", newCapabilities);
  };

  const toggleRequiredField = (fieldId: string, enabled: boolean) => {
    const currentFields = (localConfig?.required_lead_fields as string[]) || [];
    const newFields = enabled
      ? [...currentFields, fieldId]
      : currentFields.filter((id: string) => id !== fieldId);
    
    updateLocalConfig("required_lead_fields", newFields);
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

  const enabledCapabilities = (localConfig.enabled_capabilities as string[]) || [];
  const requiredLeadFields = (localConfig.required_lead_fields as string[]) || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Personality & Tone</CardTitle>
          <CardDescription>
            Define how your AI assistant communicates with users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="personality">Personality Type</Label>
            <Select 
              value={localConfig.personality} 
              onValueChange={(val) => updateLocalConfig("personality", val)}
            >
              <SelectTrigger id="personality">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {personalities.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <div>
                      <div className="font-medium">{p.label}</div>
                      <div className="text-xs text-muted-foreground">{p.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="system-prompt">Custom System Prompt (Optional)</Label>
            <Textarea
              id="system-prompt"
              placeholder="Add custom instructions to override the default behavior..."
              value={localConfig.system_prompt || ""}
              onChange={(e) => updateLocalConfig("system_prompt", e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use the default prompt based on personality type
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conversation Capabilities</CardTitle>
          <CardDescription>
            Enable or disable specific features your assistant can perform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {capabilities.map((cap) => (
            <div key={cap.id} className="flex items-start space-x-3">
              <Checkbox
                id={cap.id}
                checked={enabledCapabilities.includes(cap.id)}
                onCheckedChange={(checked) => toggleCapability(cap.id, checked as boolean)}
              />
              <div className="space-y-0.5">
                <Label htmlFor={cap.id} className="cursor-pointer">
                  {cap.label}
                </Label>
                <p className="text-sm text-muted-foreground">{cap.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Response Behaviour</CardTitle>
          <CardDescription>
            Control how the assistant responds to queries
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="response-length">Response Length</Label>
            <Select 
              value={localConfig.response_length} 
              onValueChange={(val) => updateLocalConfig("response_length", val)}
            >
              <SelectTrigger id="response-length">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {responseLengths.map((rl) => (
                  <SelectItem key={rl.value} value={rl.value}>
                    {rl.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="max-recommendations">Max Property Recommendations</Label>
              <span className="text-sm text-muted-foreground">{localConfig.max_recommendations}</span>
            </div>
            <Slider
              id="max-recommendations"
              min={1}
              max={5}
              step={1}
              value={[localConfig.max_recommendations]}
              onValueChange={(val) => updateLocalConfig("max_recommendations", val[0])}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CRM Integration</CardTitle>
          <CardDescription>
            Configure automatic lead capture and agent notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="crm-auto-capture">Enable Automatic Lead Capture</Label>
              <p className="text-sm text-muted-foreground">
                Automatically save qualified leads to CRM during conversations
              </p>
            </div>
            <Switch
              id="crm-auto-capture"
              checked={localConfig.crm_auto_capture ?? true}
              onCheckedChange={(val) => updateLocalConfig("crm_auto_capture", val)}
            />
          </div>

          <div className="space-y-3">
            <Label>Required Fields Before CRM Save</Label>
            <p className="text-sm text-muted-foreground">
              Select which information must be collected before creating a CRM profile
            </p>
            <div className="space-y-2">
              {leadFields.map((field) => (
                <div key={field.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={`required-${field.id}`}
                    checked={requiredLeadFields.includes(field.id)}
                    onCheckedChange={(checked) => toggleRequiredField(field.id, checked as boolean)}
                  />
                  <Label htmlFor={`required-${field.id}`} className="cursor-pointer font-normal">
                    {field.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="capture-style">Lead Capture Style</Label>
            <Select 
              value={localConfig.lead_capture_style || "balanced"} 
              onValueChange={(val) => updateLocalConfig("lead_capture_style", val)}
            >
              <SelectTrigger id="capture-style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {captureStyles.map((style) => (
                  <SelectItem key={style.value} value={style.value}>
                    <div>
                      <div className="font-medium">{style.label}</div>
                      <div className="text-xs text-muted-foreground">{style.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-email">Agent Notification Email</Label>
            <Input
              id="agent-email"
              type="email"
              placeholder="agent@bridgeauctioneers.ie"
              value={localConfig.agent_notification_email || ""}
              onChange={(e) => updateLocalConfig("agent_notification_email", e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Email address to notify when leads request agent contact
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Widget Settings</CardTitle>
          <CardDescription>
            Customise how the AI assistant widget appears and greets users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="welcome-message">Welcome Message</Label>
            <Input
              id="welcome-message"
              type="text"
              placeholder="Hi! I can help you find the perfect property."
              value={localConfig.welcome_message || ""}
              onChange={(e) => updateLocalConfig("welcome_message", e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              The first message users see when they open the chat widget
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Model Selection</CardTitle>
          <CardDescription>
            Choose which AI model powers your assistant
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Select 
            value={localConfig.model_name} 
            onValueChange={(val) => updateLocalConfig("model_name", val)}
          >
            <SelectTrigger id="model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  <div>
                    <div className="font-medium">{m.label}</div>
                    <div className="text-xs text-muted-foreground">{m.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {hasChanges && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={handleSave} disabled={updateMutation.isPending} size="lg">
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Configuration
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
