import { useState, useRef, useEffect } from "react";
import { Upload, X, Star, Maximize2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { FullscreenPhotoViewer, PhotoViewerPhoto } from "./FullscreenPhotoViewer";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface PhotoUploaderProps {
  photos: File[];
  heroPhotoIndex: number;
  onPhotosChange: (photos: File[]) => void;
  onHeroPhotoChange: (index: number) => void;
  socialMediaPhotoIndices: number[];
  onSocialMediaSelectionChange: (indices: number[]) => void;
}

interface SortablePhotoProps {
  id: string;
  index: number;
  preview: string;
  isHero: boolean;
  isSocialMedia: boolean;
  showSocialMediaCheckbox: boolean;
  socialNumber: number | null;
  onSetHero: () => void;
  onRemove: () => void;
  onToggleSocialMedia: () => void;
  onOpenFullscreen: () => void;
}

function SortablePhoto({
  id,
  index,
  preview,
  isHero,
  isSocialMedia,
  showSocialMediaCheckbox,
  socialNumber,
  onSetHero,
  onRemove,
  onToggleSocialMedia,
  onOpenFullscreen,
}: SortablePhotoProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group aspect-square rounded-lg overflow-hidden border-solid",
        isHero && "!border-[6px] !border-blue-600",
        !isHero && isSocialMedia && "border-2 border-primary",
        !isHero && !isSocialMedia && "border-2 border-border"
      )}
    >
      <img
        src={preview}
        alt={`Preview ${index + 1}`}
        className="w-full h-full object-cover cursor-pointer"
        onClick={onOpenFullscreen}
        data-testid={`img-photo-${index}`}
      />
      
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 text-white rounded p-1 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-20"
        data-testid={`drag-handle-${index}`}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Hover overlay with actions */}
      <div 
        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 cursor-pointer p-2"
        onClick={onOpenFullscreen}
      >
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant={isHero ? "default" : "secondary"}
            onClick={(e) => { e.stopPropagation(); onSetHero(); }}
            data-testid={`button-hero-${index}`}
          >
            <Star className={`h-4 w-4 ${isHero ? "fill-current" : ""}`} />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            onClick={(e) => { e.stopPropagation(); onOpenFullscreen(); }}
            data-testid={`button-fullscreen-${index}`}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="destructive"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            data-testid={`button-remove-${index}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Hero badge */}
      {isHero && (
        <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg z-10 pointer-events-none">
          <Star className="h-4 w-4 fill-current" />
        </div>
      )}

      {/* Social Media Checkbox - shown when 2+ photos */}
      {showSocialMediaCheckbox && !isHero && (
        <button
          type="button"
          className="absolute top-2 left-2 z-10"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSocialMedia();
          }}
        >
          <div className={cn(
            "h-5 w-5 rounded border-2 bg-background shadow-lg flex items-center justify-center cursor-pointer hover:border-primary",
            isSocialMedia ? "bg-primary border-primary" : "border-input"
          )}>
            {isSocialMedia && (
              <svg className="h-3 w-3 text-primary-foreground" fill="currentColor" viewBox="0 0 12 12">
                <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        </button>
      )}

      {/* Sequential number badge for social media selections (not for hero) */}
      {showSocialMediaCheckbox && !isHero && socialNumber && (
        <div className="absolute bottom-2 left-2 bg-primary text-primary-foreground font-bold text-sm px-2.5 py-1 rounded-full shadow-lg pointer-events-none">
          #{socialNumber}
        </div>
      )}
    </div>
  );
}

export const PhotoUploader = ({
  photos,
  heroPhotoIndex,
  onPhotosChange,
  onHeroPhotoChange,
  socialMediaPhotoIndices,
  onSocialMediaSelectionChange,
}: PhotoUploaderProps) => {
  const [previews, setPreviews] = useState<string[]>([]);
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  const nextIdRef = useRef(0);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end - reorder photos and update indices
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = photoIds.indexOf(active.id as string);
      const newIndex = photoIds.indexOf(over.id as string);

      // Reorder photos, previews, and IDs together
      const newPhotos = arrayMove(photos, oldIndex, newIndex);
      const newPreviews = arrayMove(previews, oldIndex, newIndex);
      const newPhotoIds = arrayMove(photoIds, oldIndex, newIndex);

      // Update hero index to follow the photo
      let newHeroIndex = heroPhotoIndex;
      if (heroPhotoIndex === oldIndex) {
        newHeroIndex = newIndex;
      } else if (oldIndex < heroPhotoIndex && newIndex >= heroPhotoIndex) {
        newHeroIndex = heroPhotoIndex - 1;
      } else if (oldIndex > heroPhotoIndex && newIndex <= heroPhotoIndex) {
        newHeroIndex = heroPhotoIndex + 1;
      }

      // Update social media indices to follow the photos
      const newSocialMediaIndices = socialMediaPhotoIndices.map(idx => {
        if (idx === oldIndex) {
          return newIndex;
        } else if (oldIndex < idx && newIndex >= idx) {
          return idx - 1;
        } else if (oldIndex > idx && newIndex <= idx) {
          return idx + 1;
        }
        return idx;
      });

      setPhotoIds(newPhotoIds);
      onPhotosChange(newPhotos);
      setPreviews(newPreviews);
      onHeroPhotoChange(newHeroIndex);
      onSocialMediaSelectionChange(newSocialMediaIndices);
    }
  };

  // Regenerate previews and IDs when photos change externally (e.g., navigating back from review)
  useEffect(() => {
    if (photos.length > 0 && previews.length === 0) {
      const generatePreviews = async () => {
        const newPreviews = await Promise.all(
          photos.map((file) => {
            return new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(file);
            });
          })
        );
        setPreviews(newPreviews);
        // Generate stable IDs for each photo
        const newIds = photos.map(() => {
          const id = `photo-${nextIdRef.current}`;
          nextIdRef.current += 1;
          return id;
        });
        setPhotoIds(newIds);
      };
      generatePreviews();
    } else if (photos.length === 0 && previews.length > 0) {
      setPreviews([]);
      setPhotoIds([]);
    }
  }, [photos]);

  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions to keep under ~1MB
          const MAX_SIZE = 2560;
          if (width > height && width > MAX_SIZE) {
            height = (height * MAX_SIZE) / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width = (width * MAX_SIZE) / height;
            height = MAX_SIZE;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                reject(new Error("Compression failed"));
              }
            },
            "image/jpeg",
            0.92
          );
        };
      };
      reader.onerror = reject;
    });
  };

  const processFiles = async (files: File[]) => {
    
    if (photos.length + files.length > 70) {
      toast({
        title: "Too many photos",
        description: "Maximum 70 photos allowed",
        variant: "destructive",
      });
      return;
    }

    try {
      const compressedFiles = await Promise.all(
        files.map((file) => compressImage(file))
      );

      const newPreviews = await Promise.all(
        compressedFiles.map((file) => {
          return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
        })
      );

      const updatedPhotos = [...photos, ...compressedFiles];
      
      // Generate stable IDs for new photos
      const newIds = compressedFiles.map(() => {
        const id = `photo-${nextIdRef.current}`;
        nextIdRef.current += 1;
        return id;
      });
      
      onPhotosChange(updatedPhotos);
      setPreviews([...previews, ...newPreviews]);
      setPhotoIds([...photoIds, ...newIds]);

      // Auto-select first photos for social media if we now have 2+ photos and none selected
      if (updatedPhotos.length >= 2 && socialMediaPhotoIndices.length === 0) {
        const numToSelect = Math.min(15, updatedPhotos.length - 1); // Select up to 15 photos
        const autoSelected = Array.from({ length: numToSelect }, (_, i) => i + 1);
        onSocialMediaSelectionChange(autoSelected);
        toast({
          title: "Photos added",
          description: `${files.length} photo(s) added. First ${numToSelect} auto-selected for social media (hero separate).`,
        });
      } else {
        toast({
          title: "Photos added",
          description: `${files.length} photo(s) compressed and ready`,
        });
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to process some images",
        variant: "destructive",
      });
    }

  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await processFiles(files);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );

    if (files.length > 0) {
      await processFiles(files);
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    const newPhotoIds = photoIds.filter((_, i) => i !== index);
    
    onPhotosChange(newPhotos);
    setPreviews(newPreviews);
    setPhotoIds(newPhotoIds);

    // Adjust hero photo index if needed
    if (heroPhotoIndex === index) {
      onHeroPhotoChange(0);
    } else if (heroPhotoIndex > index) {
      onHeroPhotoChange(heroPhotoIndex - 1);
    }

    // Clean up social media selections - remove the hero and adjust indices
    const cleanedSelections = socialMediaPhotoIndices
      .filter(i => i !== index && i !== heroPhotoIndex)
      .map(i => i > index ? i - 1 : i);
    onSocialMediaSelectionChange(cleanedSelections);
  };

  const setHeroPhoto = (index: number) => {
    onHeroPhotoChange(index);
    onSocialMediaSelectionChange(socialMediaPhotoIndices.filter(i => i !== index));
    toast({
      title: "Hero photo set",
      description: "This will be the main listing photo and will appear first in social media posts",
    });
  };

  const toggleSocialMediaSelection = (index: number) => {
    if (socialMediaPhotoIndices.includes(index)) {
      onSocialMediaSelectionChange(socialMediaPhotoIndices.filter(i => i !== index));
    } else {
      if (socialMediaPhotoIndices.length < 15) {
        onSocialMediaSelectionChange([...socialMediaPhotoIndices, index]);
      } else {
        toast({
          title: "Maximum 15 photos",
          description: "You can only select 15 social media images (separate from hero)",
          variant: "destructive",
        });
      }
    }
  };

  // Get the sequential number for a photo in social media selection (preserves pick order)
  const getSocialMediaNumber = (index: number): number | null => {
    const positionInSelection = socialMediaPhotoIndices.indexOf(index);
    if (positionInSelection === -1) return null;
    // Return position in selection order (1-indexed)
    return positionInSelection + 1; // 1-15
  };

  const deselectAllSocialMedia = () => {
    onSocialMediaSelectionChange([]);
    toast({
      title: "Selections cleared",
      description: "All social media photo selections have been removed",
    });
  };

  const openFullscreen = (index: number) => {
    console.log('[PhotoUploader] openFullscreen called with index:', index);
    setFullscreenIndex(index);
    setFullscreenOpen(true);
    console.log('[PhotoUploader] fullscreenOpen should now be true');
  };

  const viewerPhotos: PhotoViewerPhoto[] = previews.map((preview, index) => ({
    id: String(index),
    preview,
    isHero: heroPhotoIndex === index,
    isSocialMedia: socialMediaPhotoIndices.includes(index),
    socialNumber: getSocialMediaNumber(index),
  }));

  const handleViewerSetHero = (id: string) => {
    const index = parseInt(id, 10);
    setHeroPhoto(index);
  };

  const handleViewerToggleSocialMedia = (id: string) => {
    const index = parseInt(id, 10);
    toggleSocialMediaSelection(index);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Property Photos</h3>
          <p className="text-sm text-muted-foreground">
            Upload up to 70 photos.
          </p>
          <p className="text-sm text-muted-foreground">
            It's best not to have less than 15 photos for optimal social media performance. (select your best 15 that are more zoomed out and avoid tight bathroom photos)
          </p>
          <p className="text-sm text-muted-foreground">
            Click star for hero photo (Main title photo){photos.length >= 2 ? ", checkbox for up to 15 social media images (separate from hero)" : ""}.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={photos.length >= 70}
        >
          <Upload className="h-4 w-4 mr-2" />
          Add Photos
        </Button>
      </div>

      {/* Social Media Counter - shown when 2+ photos */}
      {photos.length >= 2 && (
        <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <div>
            <p className="text-sm font-semibold text-foreground">Social Media Images</p>
            <p className="text-xs text-muted-foreground">Hero photo + {socialMediaPhotoIndices.length} social media {socialMediaPhotoIndices.length === 1 ? 'photo' : 'photos'} (in pick order)</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-primary">
              Hero + {socialMediaPhotoIndices.length}
            </span>
            {socialMediaPhotoIndices.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={deselectAllSocialMedia}
                className="h-8 text-xs"
              >
                Deselect All
              </Button>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {photos.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={photoIds} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {previews.map((preview, index) => (
                <SortablePhoto
                  key={photoIds[index]}
                  id={photoIds[index]}
                  index={index}
                  preview={preview}
                  isHero={heroPhotoIndex === index}
                  isSocialMedia={socialMediaPhotoIndices.includes(index)}
                  showSocialMediaCheckbox={photos.length >= 2}
                  socialNumber={getSocialMediaNumber(index)}
                  onSetHero={() => setHeroPhoto(index)}
                  onRemove={() => removePhoto(index)}
                  onToggleSocialMedia={() => toggleSocialMediaSelection(index)}
                  onOpenFullscreen={() => openFullscreen(index)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {photos.length === 0 && (
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
            isDragging 
              ? "border-primary bg-primary/5" 
              : "border-border hover:border-primary"
          )}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {isDragging ? "Drop images here" : "Click to upload or drag and drop"}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Images will be compressed to ~1MB each
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {photos.length} / 70 photos uploaded
        </p>
        {photos.length >= 2 && (
          <p className="text-xs text-primary font-medium">
            Hero + {socialMediaPhotoIndices.length} social media {socialMediaPhotoIndices.length === 1 ? 'image' : 'images'}
          </p>
        )}
      </div>

      <FullscreenPhotoViewer
        photos={viewerPhotos}
        initialIndex={fullscreenIndex}
        isOpen={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        onSetHero={handleViewerSetHero}
        onToggleSocialMedia={handleViewerToggleSocialMedia}
        canSelectSocialMedia={photos.length >= 2}
        maxSocialMedia={15}
        currentSocialMediaCount={socialMediaPhotoIndices.length}
      />
    </div>
  );
};
