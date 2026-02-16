import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Home, Key, Palmtree } from "lucide-react";
import type { PropertyService } from "@/lib/billing/types";
import { PROPERTY_SERVICES, DEFAULT_PROPERTY_SERVICES } from "@/hooks/usePropertyServices";

interface PropertyServicesSelectorProps {
  organizationId: string;
  currentServices?: PropertyService[];
  onServicesUpdate?: (services: PropertyService[]) => void;
}

const SERVICE_ICONS = {
  sales: Home,
  rentals: Key,
  holiday_rentals: Palmtree,
} as const;

export function PropertyServicesSelector({
  organizationId,
  currentServices,
  onServicesUpdate,
}: PropertyServicesSelectorProps) {
  const [services, setServices] = useState<PropertyService[]>(
    currentServices ?? DEFAULT_PROPERTY_SERVICES
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (currentServices) {
      setServices(currentServices);
      setHasChanges(false);
    }
  }, [currentServices]);

  const handleServiceToggle = (service: PropertyService, checked: boolean) => {
    const newServices = checked
      ? [...services, service]
      : services.filter((s) => s !== service);

    if (newServices.length === 0) {
      toast({
        title: "At least one service required",
        description: "You must offer at least one property service",
        variant: "destructive",
      });
      return;
    }

    setServices(newServices);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("organizations")
        .update({ 
          property_services: services,
          updated_at: new Date().toISOString() 
        })
        .eq("id", organizationId);

      if (error) throw error;

      toast({
        title: "Services updated",
        description: "Your property services have been saved",
      });

      setHasChanges(false);
      onServicesUpdate?.(services);
    } catch (error) {
      console.error("Error saving property services:", error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update services",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Property Services</CardTitle>
        <CardDescription>
          Choose which property services your organization offers. This controls
          which listing types are available.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {PROPERTY_SERVICES.map((serviceConfig) => {
          const Icon = SERVICE_ICONS[serviceConfig.value];
          const isChecked = services.includes(serviceConfig.value);

          return (
            <div
              key={serviceConfig.value}
              className="flex items-start gap-3 p-3 rounded-lg border"
              data-testid={`service-option-${serviceConfig.value}`}
            >
              <Checkbox
                id={`service-${serviceConfig.value}`}
                checked={isChecked}
                onCheckedChange={(checked) =>
                  handleServiceToggle(serviceConfig.value, checked === true)
                }
                data-testid={`checkbox-service-${serviceConfig.value}`}
              />
              <div className="flex items-start gap-3 flex-1">
                <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <Label
                  htmlFor={`service-${serviceConfig.value}`}
                  className="flex-1 cursor-pointer"
                >
                  <span className="font-medium text-foreground block">
                    {serviceConfig.label}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {serviceConfig.description}
                  </span>
                </Label>
              </div>
            </div>
          );
        })}

        {hasChanges && (
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              data-testid="button-save-property-services"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Services
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
