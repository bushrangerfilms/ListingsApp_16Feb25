import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useLocale } from "@/hooks/useLocale";

export const PropertyDataConfig = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLocale();

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

      // Create default config if none exists
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

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<typeof config>) => {
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
      toast({
        title: t('ai-assistant.toast.configUpdated'),
        description: t('ai-assistant.toast.configUpdatedDesc'),
      });
    },
    onError: (error) => {
      toast({
        title: t('ai-assistant.toast.updateFailed'),
        description: error instanceof Error ? error.message : t('ai-assistant.toast.updateFailed'),
        variant: "destructive",
      });
    },
  });

  const handleToggle = (field: string, value: boolean) => {
    updateMutation.mutate({ [field]: value });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('ai-assistant.propertyData.title')}</CardTitle>
          <CardDescription>
            {t('ai-assistant.propertyData.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="active-listings">{t('ai-assistant.propertyData.activeListings')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('ai-assistant.propertyData.activeListingsDesc')}
              </p>
            </div>
            <Switch
              id="active-listings"
              checked={config?.include_active_listings ?? true}
              onCheckedChange={(checked) => handleToggle("include_active_listings", checked)}
              data-testid="switch-active-listings"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sold-listings">{t('ai-assistant.propertyData.soldListings')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('ai-assistant.propertyData.soldListingsDesc')}
              </p>
            </div>
            <Switch
              id="sold-listings"
              checked={config?.include_sold_listings ?? false}
              onCheckedChange={(checked) => handleToggle("include_sold_listings", checked)}
              data-testid="switch-sold-listings"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Buyer & Seller Profile Data</CardTitle>
          <CardDescription>
            Include anonymized profile data to improve recommendations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="buyer-prefs">Buyer Preferences</Label>
              <p className="text-sm text-muted-foreground">
                Learn from buyer requirements and successful matches
              </p>
            </div>
            <Switch
              id="buyer-prefs"
              checked={config?.include_buyer_preferences ?? true}
              onCheckedChange={(checked) => handleToggle("include_buyer_preferences", checked)}
            />
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Privacy Notice:</span> All personal
              information is anonymized before being used for training. Only aggregated patterns
              and preferences are included.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
