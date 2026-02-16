import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Image } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { uploadOrganizationFavicon, deleteOrganizationFavicon } from "@/lib/organizationHelpers";

interface OrganizationFaviconUploaderProps {
  currentFaviconUrl: string | null;
  fallbackLogoUrl: string | null;
  organizationId: string;
  onFaviconUpdate: (newUrl: string | null) => void;
}

export function OrganizationFaviconUploader({
  currentFaviconUrl,
  fallbackLogoUrl,
  organizationId,
  onFaviconUpdate,
}: OrganizationFaviconUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentFaviconUrl);

  useEffect(() => {
    setPreviewUrl(currentFaviconUrl);
  }, [currentFaviconUrl]);

  const displayUrl = previewUrl || fallbackLogoUrl;
  const isUsingFallback = !previewUrl && fallbackLogoUrl;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (JPG, PNG, or ICO)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 1 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 1MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const publicUrl = await uploadOrganizationFavicon(file, organizationId);
      
      setPreviewUrl(publicUrl);
      onFaviconUpdate(publicUrl);

      toast({
        title: "Favicon uploaded",
        description: "Your public site favicon has been updated",
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload favicon",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentFaviconUrl) return;

    setIsUploading(true);

    try {
      await deleteOrganizationFavicon(currentFaviconUrl);
      
      setPreviewUrl(null);
      onFaviconUpdate(null);

      toast({
        title: "Favicon removed",
        description: "Your public site will now use your organisation logo as the favicon",
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete favicon",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-6">
        <div className="relative w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/20">
          {displayUrl ? (
            <>
              <img
                src={displayUrl}
                alt="Favicon preview"
                className="w-12 h-12 object-contain"
              />
              {previewUrl && !isUploading && (
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-5 w-5"
                  onClick={handleDelete}
                  data-testid="button-delete-favicon"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </>
          ) : (
            <Image className="h-8 w-8 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 space-y-2">
          <h3 className="font-medium">Public Site Favicon</h3>
          <p className="text-sm text-muted-foreground">
            {isUsingFallback 
              ? "Currently using your organisation logo. Upload a custom favicon for your public site."
              : "Custom favicon for your public property listings site. Max size: 1MB."
            }
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={() => document.getElementById('favicon-upload')?.click()}
              data-testid="button-upload-favicon"
            >
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? "Uploading..." : previewUrl ? "Change" : "Upload Favicon"}
            </Button>
            <input
              id="favicon-upload"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/x-icon,image/ico"
              className="hidden"
              onChange={handleFileSelect}
              disabled={isUploading}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
