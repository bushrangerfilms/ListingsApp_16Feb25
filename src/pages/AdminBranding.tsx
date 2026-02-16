import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import { updateOrganizationProfile } from "@/lib/organizationHelpers";
import { Loader2, Pipette, RotateCcw, ExternalLink } from "lucide-react";

interface ColorPickerProps {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  testId: string;
}

function ColorPicker({ label, description, value, onChange, testId }: ColorPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [supportsEyeDropper, setSupportsEyeDropper] = useState(false);

  useEffect(() => {
    setSupportsEyeDropper('EyeDropper' in window);
  }, []);

  const handleEyeDropper = async () => {
    if ('EyeDropper' in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        onChange(result.sRGBHex);
      } catch (e) {
        console.log('EyeDropper cancelled or failed');
      }
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={testId}>{label}</Label>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="flex items-center gap-2">
        <div 
          className="w-10 h-10 rounded-md border cursor-pointer shrink-0"
          style={{ backgroundColor: value }}
          onClick={() => inputRef.current?.click()}
          data-testid={`${testId}-preview`}
        />
        <Input
          ref={inputRef}
          type="color"
          id={testId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-16 h-10 p-1 cursor-pointer"
          data-testid={testId}
        />
        <Input
          type="text"
          value={value.toUpperCase()}
          onChange={(e) => {
            const val = e.target.value;
            if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
              onChange(val);
            }
          }}
          className="w-28 font-mono"
          placeholder="#000000"
          data-testid={`${testId}-hex`}
        />
        {supportsEyeDropper && (
          <Button 
            type="button" 
            variant="outline" 
            size="icon"
            onClick={handleEyeDropper}
            title="Pick color from screen"
            data-testid={`${testId}-eyedropper`}
          >
            <Pipette className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

const DEFAULT_COLORS = {
  primary: '#1e3a5f',
  secondary: '#f0f4f8',
};

export default function AdminBranding() {
  const { organization, loading } = useOrganization();
  const { selectedOrganization, isOrganizationView } = useOrganizationView();
  const [isSaving, setIsSaving] = useState(false);
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_COLORS.primary);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_COLORS.secondary);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;

  useEffect(() => {
    if (targetOrg) {
      setPrimaryColor(targetOrg.primary_color || DEFAULT_COLORS.primary);
      setSecondaryColor(targetOrg.secondary_color || DEFAULT_COLORS.secondary);
    }
  }, [targetOrg]);

  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'BRANDING_PREVIEW',
        colors: {
          primary: primaryColor,
          secondary: secondaryColor,
        }
      }, '*');
    }
  }, [primaryColor, secondaryColor]);

  const handleReset = () => {
    setPrimaryColor(DEFAULT_COLORS.primary);
    setSecondaryColor(DEFAULT_COLORS.secondary);
    toast({
      title: "Colors reset",
      description: "Colors have been reset to defaults. Save to apply.",
    });
  };

  const handleSave = async () => {
    if (!targetOrg) return;

    setIsSaving(true);
    try {
      await updateOrganizationProfile(targetOrg.id, {
        primary_color: primaryColor,
        secondary_color: secondaryColor,
      });

      toast({
        title: "Branding saved",
        description: "Your color palette has been updated successfully",
      });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save branding",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const publicSiteUrl = targetOrg?.slug 
    ? `${window.location.origin}/${targetOrg.slug}` 
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!targetOrg) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Organization Found</CardTitle>
          <CardDescription>You are not associated with any organization</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold">Branding</h3>
        <p className="text-muted-foreground">Customise the colors used on your public website</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Color Palette</CardTitle>
            <CardDescription>
              Choose colors that match your brand identity. Changes are previewed in real-time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ColorPicker
              label="Primary Color"
              description="Main brand color used for buttons, headers, and accents"
              value={primaryColor}
              onChange={setPrimaryColor}
              testId="input-primary-color"
            />

            <ColorPicker
              label="Secondary Color"
              description="Used for backgrounds, cards, and subtle elements"
              value={secondaryColor}
              onChange={setSecondaryColor}
              testId="input-secondary-color"
            />

            <div className="flex flex-wrap gap-2 pt-4 border-t">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                data-testid="button-save-branding"
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Colors
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                data-testid="button-reset-colors"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Live Preview</CardTitle>
              <CardDescription>See how your colors look on your public site</CardDescription>
            </div>
            {publicSiteUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={publicSiteUrl} target="_blank" rel="noopener noreferrer" data-testid="link-open-public-site">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Site
                </a>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="aspect-[4/3] w-full border rounded-md overflow-hidden bg-muted">
              {publicSiteUrl ? (
                <iframe
                  ref={iframeRef}
                  src={`${publicSiteUrl}?preview=true`}
                  className="w-full h-full"
                  title="Public site preview"
                  data-testid="iframe-preview"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>Preview not available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
