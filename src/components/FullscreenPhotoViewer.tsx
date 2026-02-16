import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Star, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PhotoViewerPhoto {
  id: string;
  preview: string;
  isHero: boolean;
  isSocialMedia: boolean;
  socialNumber: number | null;
}

interface FullscreenPhotoViewerProps {
  photos: PhotoViewerPhoto[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onSetHero: (id: string) => void;
  onToggleSocialMedia: (id: string) => void;
  canSelectSocialMedia: boolean;
  maxSocialMedia?: number;
  currentSocialMediaCount: number;
}

export function FullscreenPhotoViewer({
  photos,
  initialIndex,
  isOpen,
  onClose,
  onSetHero,
  onToggleSocialMedia,
  canSelectSocialMedia,
  maxSocialMedia = 15,
  currentSocialMediaCount,
}: FullscreenPhotoViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          goToPrevious();
          break;
        case "ArrowRight":
          goToNext();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, currentIndex, photos.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  }, [photos.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  }, [photos.length]);

  if (!mounted || !isOpen || photos.length === 0) return null;

  const currentPhoto = photos[currentIndex];

  const handleSetHero = () => {
    onSetHero(currentPhoto.id);
  };

  const handleToggleSocialMedia = () => {
    if (currentPhoto.isHero) return;
    if (!currentPhoto.isSocialMedia && currentSocialMediaCount >= maxSocialMedia) return;
    onToggleSocialMedia(currentPhoto.id);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/95"
      data-testid="fullscreen-photo-viewer"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Image container - low z-index and no pointer events */}
      <div className="absolute inset-0 z-0 flex items-center justify-center p-16 pointer-events-none">
        <img
          src={currentPhoto.preview}
          alt={`Photo ${currentIndex + 1}`}
          className="max-w-full max-h-full object-contain rounded-lg pointer-events-none select-none"
          data-testid="img-fullscreen-photo"
        />
      </div>

      {/* Close button - high z-index with pointer events */}
      <div className="absolute top-4 right-4 z-20 pointer-events-auto">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          data-testid="button-close-viewer"
          aria-label="Close photo viewer"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      {/* Photo counter - high z-index */}
      <div className="absolute top-4 left-4 z-20 pointer-events-auto text-white text-sm font-medium bg-black/50 px-3 py-1.5 rounded-full">
        {currentIndex + 1} / {photos.length}
      </div>

      {/* Navigation arrows - high z-index with pointer events */}
      {photos.length > 1 && (
        <>
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 pointer-events-auto">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-12 w-12"
              onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
              data-testid="button-previous-photo"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
          </div>

          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 pointer-events-auto">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-12 w-12"
              onClick={(e) => { e.stopPropagation(); goToNext(); }}
              data-testid="button-next-photo"
              aria-label="Next photo"
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          </div>
        </>
      )}

      {/* Bottom action buttons - high z-index with pointer events */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex items-center gap-3">
        <Button
          variant={currentPhoto.isHero ? "default" : "secondary"}
          size="default"
          onClick={handleSetHero}
          className="gap-2"
          data-testid="button-set-hero-fullscreen"
        >
          <Star className={cn("h-4 w-4", currentPhoto.isHero && "fill-current")} />
          {currentPhoto.isHero ? "Hero Photo" : "Set as Hero"}
        </Button>

        {canSelectSocialMedia && !currentPhoto.isHero && (
          <Button
            variant={currentPhoto.isSocialMedia ? "default" : "secondary"}
            size="default"
            onClick={handleToggleSocialMedia}
            className="gap-2"
            disabled={!currentPhoto.isSocialMedia && currentSocialMediaCount >= maxSocialMedia}
            data-testid="button-toggle-social-fullscreen"
          >
            <div className={cn(
              "h-4 w-4 rounded border-2 flex items-center justify-center",
              currentPhoto.isSocialMedia 
                ? "bg-primary-foreground border-primary-foreground" 
                : "border-current"
            )}>
              {currentPhoto.isSocialMedia && (
                <Check className="h-3 w-3 text-primary" />
              )}
            </div>
            {currentPhoto.isSocialMedia 
              ? `Social Media #${currentPhoto.socialNumber}` 
              : "Add to Social Media"
            }
          </Button>
        )}
      </div>

      {/* Hero photo indicator - high z-index */}
      {currentPhoto.isHero && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-auto bg-primary text-primary-foreground px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
          <Star className="h-4 w-4 fill-current" />
          <span className="font-semibold">Hero Photo</span>
        </div>
      )}
    </div>,
    document.body
  );
}
