import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, ImageIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { uploadOrganizationLogo, deleteOrganizationLogo } from "@/lib/organizationHelpers";

interface OrganizationLogoUploaderProps {
  currentLogoUrl: string | null;
  organizationId: string;
  onLogoUpdate: (newUrl: string | null) => void;
}

export function OrganizationLogoUploader({
  currentLogoUrl,
  organizationId,
  onLogoUpdate,
}: OrganizationLogoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl);

  // Sync previewUrl with currentLogoUrl when it changes
  useEffect(() => {
    setPreviewUrl(currentLogoUrl);
  }, [currentLogoUrl]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (JPG or PNG)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 2MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Upload to storage
      const publicUrl = await uploadOrganizationLogo(file, organizationId);
      
      setPreviewUrl(publicUrl);
      onLogoUpdate(publicUrl);

      toast({
        title: "Logo uploaded",
        description: "Your organisation logo has been updated",
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload logo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentLogoUrl) return;

    setIsUploading(true);

    try {
      await deleteOrganizationLogo(currentLogoUrl);
      
      setPreviewUrl(null);
      onLogoUpdate(null);

      toast({
        title: "Logo deleted",
        description: "Your organisation logo has been removed",
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete logo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center gap-6">
          <div className="relative min-w-32 min-h-24 max-w-48 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/20 p-3">
            {previewUrl ? (
              <>
                <img
                  src={previewUrl}
                  alt="Organisation logo"
                  className="max-w-full max-h-24 object-contain"
                />
                {!isUploading && (
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-1 right-1 h-6 w-6"
                    onClick={handleDelete}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </>
            ) : (
              <ImageIcon className="h-12 w-12 text-muted-foreground" />
            )}
          </div>

          <div className="flex-1 space-y-2">
            <h3 className="font-medium">Organisation Logo</h3>
            <p className="text-sm text-muted-foreground">
              Upload your organisation logo. Max file size: 2MB. Accepted formats: JPG, PNG
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={isUploading}
                onClick={() => document.getElementById('logo-upload')?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? "Uploading..." : previewUrl ? "Change Logo" : "Upload Logo"}
              </Button>
              <input
                id="logo-upload"
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                className="hidden"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
