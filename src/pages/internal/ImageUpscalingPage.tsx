import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdminPermissions } from "@/hooks/useSuperAdminPermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ImageUp, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, Zap } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB

interface Organization {
  id: string;
  name: string;
}

interface UpscaleJob {
  id: string;
  listing_id: string;
  organization_id: string;
  photo_index: number;
  original_url: string;
  upscaled_url: string | null;
  status: string;
  job_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface Listing {
  id: string;
  title: string;
  social_media_photos: string[] | null;
}

export default function ImageUpscalingPage() {
  const { userRole, hasSuperAdminAccess, loading: authLoading } = useSuperAdminPermissions();
  const isSuperAdmin = userRole === "super_admin";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [upscalingPhotoKey, setUpscalingPhotoKey] = useState<string | null>(null);
  const [fileSizes, setFileSizes] = useState<Record<string, number>>({});
  const [loadingFileSizes, setLoadingFileSizes] = useState(false);

  const { data: organizations } = useQuery({
    queryKey: ["admin-orgs-for-upscale"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name:business_name")
        .order("business_name");
      if (error) throw error;
      return (data as unknown as Organization[]) || [];
    },
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs } = useQuery({
    queryKey: ["admin-upscale-jobs", selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client
        .from("photo_upscale_jobs")
        .select("*")
        .eq("organization_id", selectedOrgId)
        .order("listing_id")
        .order("photo_index");
      if (error) throw error;
      return (data as UpscaleJob[]) || [];
    },
    enabled: !authLoading && hasSuperAdminAccess && !!selectedOrgId,
    refetchInterval: 5000, // Auto-refresh every 5 seconds to catch webhook updates
  });

  const { data: listings } = useQuery({
    queryKey: ["admin-listings-for-upscale", selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await supabase
        .from("listings")
        .select("id, title, social_media_photos")
        .eq("organization_id", selectedOrgId)
        .not("social_media_photos", "is", null);
      if (error) throw error;
      return (data as Listing[]) || [];
    },
    enabled: !authLoading && hasSuperAdminAccess && !!selectedOrgId,
    refetchInterval: 5000, // Auto-refresh to catch webhook updates
  });

  // Check file sizes for all photos
  useEffect(() => {
    if (!listings || listings.length === 0) return;
    
    const checkFileSizes = async () => {
      setLoadingFileSizes(true);
      const newSizes: Record<string, number> = {};
      
      for (const listing of listings) {
        const photos = listing.social_media_photos || [];
        for (let i = 0; i < photos.length; i++) {
          const url = photos[i];
          const key = `${listing.id}-${i}`;
          
          // Skip if already checked or if URL is from upscaled folder
          if (fileSizes[key] !== undefined || url.includes("/upscaled/")) continue;
          
          try {
            const response = await fetch(url, { method: "HEAD" });
            const contentLength = response.headers.get("content-length");
            if (contentLength) {
              newSizes[key] = parseInt(contentLength, 10);
            }
          } catch {
            // If HEAD fails, set to 0 (unknown)
            newSizes[key] = 0;
          }
        }
      }
      
      if (Object.keys(newSizes).length > 0) {
        setFileSizes(prev => ({ ...prev, ...newSizes }));
      }
      setLoadingFileSizes(false);
    };
    
    checkFileSizes();
  }, [listings]);

  const upscaleSinglePhoto = async (listingId: string, photoIndex: number, photoUrl: string) => {
    const photoKey = `${listingId}-${photoIndex}`;
    setUpscalingPhotoKey(photoKey);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upscale-photos`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            listingId,
            photoType: "social_media",
            photoIndex,
            photoUrl,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit upscaling");
      }

      toast({
        title: "Submitted for upscaling",
        description: `Photo ${photoIndex + 1} has been submitted to Topaz AI`,
      });

      queryClient.invalidateQueries({ queryKey: ["admin-upscale-jobs", selectedOrgId] });
    } catch (error) {
      toast({
        title: "Upscaling Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setUpscalingPhotoKey(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "skipped":
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      failed: "destructive",
      pending: "secondary",
      processing: "outline",
      skipped: "secondary",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  // Build a list of all photos with their status and file size
  const photoList = listings?.flatMap((listing) => {
    const photos = listing.social_media_photos || [];
    return photos.map((photoUrl, index) => {
      const job = jobs?.find(
        (j) => j.listing_id === listing.id && j.photo_index === index
      );
      const photoKey = `${listing.id}-${index}`;
      const fileSize = fileSizes[photoKey] || 0;
      // For retries, use the stored original_url if available (in case social_media_photos was mutated)
      const originalUrl = job?.original_url || photoUrl;
      return {
        listingId: listing.id,
        listingTitle: listing.title,
        photoIndex: index,
        photoUrl,           // Current URL in social_media_photos (may be upscaled)
        originalUrl,        // Original source URL for upscaling
        status: job?.status || null,
        upscaledUrl: job?.upscaled_url || null,
        errorMessage: job?.error_message || null,
        fileSize,           // File size in bytes (0 = unknown)
        isTooLarge: fileSize > MAX_FILE_SIZE,
      };
    });
  }) || [];

  // Filter to show only photos that need upscaling
  // Exclude: completed jobs, photos already upscaled, photos over 1MB
  const pendingPhotos = photoList.filter((p) => {
    // Skip if job is completed
    if (p.status === "completed") return false;
    
    // Skip if the current URL is already an upscaled version
    const isAlreadyUpscaled = p.photoUrl.includes("/upscaled/");
    if (isAlreadyUpscaled && !p.status) return false; // No job but already upscaled = skip
    
    // Skip if file is too large (and size is known)
    if (p.fileSize > 0 && p.isTooLarge) return false;
    
    // Include pending, failed, or no job (and not already upscaled)
    return !p.status || p.status === "failed" || p.status === "pending";
  });
  
  // Track photos that were filtered out due to size
  const oversizedPhotos = photoList.filter((p) => p.fileSize > 0 && p.isTooLarge && !p.photoUrl.includes("/upscaled/"));
  const completedPhotos = photoList.filter((p) => p.status === "completed");
  const processingPhotos = photoList.filter((p) => p.status === "processing");

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              This feature is only available to Super Admins.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Image Upscaling</h1>
          <p className="text-muted-foreground">
            Upscale social media listing photos to 4K resolution (2x) using Topaz AI
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => refetchJobs()}
          disabled={jobsLoading}
          data-testid="button-refresh-jobs"
        >
          <RefreshCw className={`h-4 w-4 ${jobsLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageUp className="h-5 w-5" />
            Select Organization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedOrgId}
            onValueChange={setSelectedOrgId}
            data-testid="select-organization"
          >
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Choose an organization..." />
            </SelectTrigger>
            <SelectContent>
              {organizations?.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedOrgId && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-yellow-600">
                  {loadingFileSizes ? <Loader2 className="h-6 w-6 animate-spin" /> : pendingPhotos.length}
                </div>
                <p className="text-sm text-muted-foreground">Pending / Failed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-600">{processingPhotos.length}</div>
                <p className="text-sm text-muted-foreground">Processing</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{completedPhotos.length}</div>
                <p className="text-sm text-muted-foreground">Completed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-orange-600">{oversizedPhotos.length}</div>
                <p className="text-sm text-muted-foreground">Too Large (&gt;1MB)</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Photos Needing Upscaling ({pendingPhotos.length})</CardTitle>
              <CardDescription>
                Click the upscale button to process each photo individually
              </CardDescription>
            </CardHeader>
            <CardContent>
              {jobsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : pendingPhotos.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  All photos have been processed!
                </p>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {pendingPhotos.map((photo) => {
                      const photoKey = `${photo.listingId}-${photo.photoIndex}`;
                      const isUpscaling = upscalingPhotoKey === photoKey;
                      return (
                        <div
                          key={photoKey}
                          className="border rounded-md p-3 space-y-2"
                          data-testid={`photo-card-${photoKey}`}
                        >
                          <div className="aspect-video bg-muted rounded overflow-hidden">
                            <img
                              src={photo.photoUrl}
                              alt={`Photo ${photo.photoIndex + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium truncate" title={photo.listingTitle}>
                              {photo.listingTitle}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Photo {photo.photoIndex + 1}
                            </p>
                            {photo.status && (
                              <div className="flex items-center gap-1">
                                {getStatusIcon(photo.status)}
                                {getStatusBadge(photo.status)}
                              </div>
                            )}
                            {photo.errorMessage && (
                              <p className="text-xs text-red-500 truncate" title={photo.errorMessage}>
                                {photo.errorMessage}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => upscaleSinglePhoto(photo.listingId, photo.photoIndex, photo.originalUrl)}
                            disabled={isUpscaling}
                            data-testid={`button-upscale-${photoKey}`}
                          >
                            {isUpscaling ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Zap className="h-4 w-4 mr-2" />
                            )}
                            {isUpscaling ? "Submitting..." : "Upscale"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Completed Photos ({completedPhotos.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {completedPhotos.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No completed photos yet
                </p>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {completedPhotos.map((photo) => {
                      const photoKey = `${photo.listingId}-${photo.photoIndex}`;
                      return (
                        <div
                          key={photoKey}
                          className="border rounded-md p-2 space-y-2"
                          data-testid={`completed-photo-${photoKey}`}
                        >
                          <div className="aspect-video bg-muted rounded overflow-hidden relative">
                            <img
                              src={photo.upscaledUrl || photo.photoUrl}
                              alt={`Photo ${photo.photoIndex + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-1 right-1">
                              <Badge variant="default" className="text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                8K
                              </Badge>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {photo.listingTitle} - Photo {photo.photoIndex + 1}
                          </p>
                          {photo.upscaledUrl && (
                            <a
                              href={photo.upscaledUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              View Full Size
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
