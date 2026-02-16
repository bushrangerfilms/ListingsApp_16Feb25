import { useState, useRef, useEffect } from "react";
import { Upload, X, Star, GripVertical, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export interface ExistingPhoto {
  url: string;
  isHero: boolean;
  isSocialMedia: boolean;
}

export interface PhotoChanges {
  existingPhotos: string[];
  newPhotos: File[];
  heroPhotoUrl: string | null;
  heroPhotoIndex: number | null;
  socialMediaUrls: string[];
  socialMediaIndices: number[];
  deletedUrls: string[];
}

interface EditPhotoManagerProps {
  existingPhotoUrls: string[];
  existingHeroUrl: string | null;
  existingSocialMediaUrls: string[];
  onChange: (changes: PhotoChanges) => void;
}

interface PhotoItem {
  id: string;
  type: 'existing' | 'new';
  url?: string;
  file?: File;
  preview: string;
}

interface SortableEditPhotoProps {
  photo: PhotoItem;
  index: number;
  isHero: boolean;
  isSocialMedia: boolean;
  showSocialMediaCheckbox: boolean;
  socialNumber: number | null;
  onSetHero: () => void;
  onRemove: () => void;
  onToggleSocialMedia: () => void;
  onOpenFullscreen: () => void;
}

function SortableEditPhoto({
  photo,
  index,
  isHero,
  isSocialMedia,
  showSocialMediaCheckbox,
  socialNumber,
  onSetHero,
  onRemove,
  onToggleSocialMedia,
  onOpenFullscreen,
}: SortableEditPhotoProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id });

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
      data-testid={`photo-item-${photo.id}`}
    >
      <img
        src={photo.preview}
        alt={`Photo ${photo.id}`}
        className="w-full h-full object-cover cursor-pointer"
        onClick={onOpenFullscreen}
      />

      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 text-white rounded p-1 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-20"
        data-testid={`drag-handle-${photo.id}`}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {photo.type === 'new' && (
        <div className="absolute top-2 right-10 bg-green-600 text-white text-xs px-1.5 py-0.5 rounded">
          New
        </div>
      )}

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
            data-testid={`button-hero-${photo.id}`}
          >
            <Star className={`h-4 w-4 ${isHero ? "fill-current" : ""}`} />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            onClick={(e) => { e.stopPropagation(); onOpenFullscreen(); }}
            data-testid={`button-fullscreen-${photo.id}`}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="destructive"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            data-testid={`button-remove-${photo.id}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isHero && (
        <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg z-10 pointer-events-none">
          <Star className="h-4 w-4 fill-current" />
        </div>
      )}

      {showSocialMediaCheckbox && (
        <button
          type="button"
          className="absolute top-2 left-2 z-10"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSocialMedia();
          }}
          data-testid={`checkbox-social-${photo.id}`}
        >
          <div className={cn(
            "h-5 w-5 rounded border-2 bg-background shadow-lg flex items-center justify-center cursor-pointer hover:border-primary",
            isSocialMedia ? "bg-primary border-primary" : "border-input"
          )}>
            {isSocialMedia && (
              <svg className="h-3 w-3 text-primary-foreground" fill="currentColor" viewBox="0 0 12 12">
                <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </button>
      )}

      {showSocialMediaCheckbox && socialNumber && (
        <div className="absolute bottom-2 left-2 bg-primary text-primary-foreground font-bold text-sm px-2.5 py-1 rounded-full shadow-lg pointer-events-none">
          #{socialNumber}
        </div>
      )}
    </div>
  );
}

export function EditPhotoManager({
  existingPhotoUrls,
  existingHeroUrl,
  existingSocialMediaUrls,
  onChange,
}: EditPhotoManagerProps) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [heroId, setHeroId] = useState<string | null>(null);
  const [socialMediaIds, setSocialMediaIds] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);

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

  // Handle drag end - reorder photos
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setPhotos((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  useEffect(() => {
    if (!isInitialized) {
      if (existingPhotoUrls.length > 0) {
        const photoItems: PhotoItem[] = existingPhotoUrls.map((url, index) => ({
          id: `existing-${index}`,
          type: 'existing' as const,
          url,
          preview: url,
        }));
        setPhotos(photoItems);

        const heroItem = photoItems.find(p => p.url === existingHeroUrl);
        if (heroItem) {
          setHeroId(heroItem.id);
        } else if (photoItems.length > 0) {
          setHeroId(photoItems[0].id);
        }

        const socialIds = photoItems
          .filter(p => existingSocialMediaUrls.includes(p.url || ''))
          .map(p => p.id);
        setSocialMediaIds(socialIds);
      }
      setIsInitialized(true);
    }
  }, [existingPhotoUrls, existingHeroUrl, existingSocialMediaUrls, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;

    const existingPhotos = photos.filter(p => p.type === 'existing').map(p => p.url!);
    const newPhotos = photos.filter(p => p.type === 'new').map(p => p.file!);
    const deletedUrls = existingPhotoUrls.filter(url => !existingPhotos.includes(url));

    const heroPhoto = photos.find(p => p.id === heroId);
    const heroPhotoUrl = heroPhoto?.type === 'existing' ? heroPhoto.url || null : null;
    const heroPhotoIndex = heroPhoto?.type === 'new' ? photos.filter(p => p.type === 'new').indexOf(heroPhoto) : null;

    const socialMediaUrls = photos
      .filter(p => socialMediaIds.includes(p.id) && p.type === 'existing')
      .map(p => p.url!);
    const socialMediaIndices = photos
      .filter(p => socialMediaIds.includes(p.id) && p.type === 'new')
      .map(p => photos.filter(ph => ph.type === 'new').indexOf(p));

    onChange({
      existingPhotos,
      newPhotos,
      heroPhotoUrl,
      heroPhotoIndex,
      socialMediaUrls,
      socialMediaIndices,
      deletedUrls,
    });
  }, [photos, heroId, socialMediaIds, isInitialized]);

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
    const totalPhotos = photos.length + files.length;
    if (totalPhotos > 70) {
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

      const newPhotoItems: PhotoItem[] = await Promise.all(
        compressedFiles.map(async (file, index) => {
          const preview = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          return {
            id: `new-${Date.now()}-${index}`,
            type: 'new' as const,
            file,
            preview,
          };
        })
      );

      setPhotos(prev => [...prev, ...newPhotoItems]);

      toast({
        title: "Photos added",
        description: `${files.length} photo(s) compressed and ready`,
      });
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

  const removePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));

    if (heroId === id) {
      const remainingPhotos = photos.filter(p => p.id !== id);
      setHeroId(remainingPhotos.length > 0 ? remainingPhotos[0].id : null);
    }

    setSocialMediaIds(prev => prev.filter(smId => smId !== id));
  };

  const setHeroPhoto = (id: string) => {
    setHeroId(id);
    setSocialMediaIds(prev => prev.filter(smId => smId !== id));
    toast({
      title: "Hero photo set",
      description: "This will be the main listing photo",
    });
  };

  const toggleSocialMediaSelection = (id: string) => {
    if (id === heroId) return;

    if (socialMediaIds.includes(id)) {
      setSocialMediaIds(prev => prev.filter(smId => smId !== id));
    } else {
      if (socialMediaIds.length < 15) {
        setSocialMediaIds(prev => [...prev, id]);
      } else {
        toast({
          title: "Maximum 15 photos",
          description: "You can only select 15 social media images",
          variant: "destructive",
        });
      }
    }
  };

  const getSocialMediaNumber = (id: string): number | null => {
    const index = socialMediaIds.indexOf(id);
    return index === -1 ? null : index + 1;
  };

  const deselectAllSocialMedia = () => {
    setSocialMediaIds([]);
    toast({
      title: "Selections cleared",
      description: "All social media photo selections have been removed",
    });
  };

  const openFullscreen = (index: number) => {
    console.log('[EditPhotoManager] openFullscreen called with index:', index);
    setFullscreenIndex(index);
    setFullscreenOpen(true);
    console.log('[EditPhotoManager] fullscreenOpen should now be true');
  };

  const viewerPhotos: PhotoViewerPhoto[] = photos.map((photo) => ({
    id: photo.id,
    preview: photo.preview,
    isHero: heroId === photo.id,
    isSocialMedia: socialMediaIds.includes(photo.id),
    socialNumber: getSocialMediaNumber(photo.id),
  }));

  const handleViewerSetHero = (id: string) => {
    setHeroPhoto(id);
  };

  const handleViewerToggleSocialMedia = (id: string) => {
    toggleSocialMediaSelection(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Property Photos</h3>
          <p className="text-sm text-muted-foreground">
            Click star for hero photo{photos.length >= 2 ? ", checkbox for social media" : ""}.
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

      {photos.length >= 2 && (
        <div className="flex items-center justify-between gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg flex-wrap">
          <div>
            <p className="text-sm font-semibold text-foreground">Social Media Images</p>
            <p className="text-xs text-muted-foreground">
              Hero photo + {socialMediaIds.length} social media {socialMediaIds.length === 1 ? 'photo' : 'photos'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-primary">
              Hero + {socialMediaIds.length}
            </span>
            {socialMediaIds.length > 0 && (
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
        data-testid="input-photo-upload"
      />

      {photos.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={photos.map(p => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {photos.map((photo, index) => (
                <SortableEditPhoto
                  key={photo.id}
                  photo={photo}
                  index={index}
                  isHero={heroId === photo.id}
                  isSocialMedia={socialMediaIds.includes(photo.id)}
                  showSocialMediaCheckbox={photos.length >= 2 && heroId !== photo.id}
                  socialNumber={getSocialMediaNumber(photo.id)}
                  onSetHero={() => setHeroPhoto(photo.id)}
                  onRemove={() => removePhoto(photo.id)}
                  onToggleSocialMedia={() => toggleSocialMediaSelection(photo.id)}
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
          data-testid="dropzone-photos"
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

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">
          {photos.length} / 70 photos
        </p>
        {photos.length >= 2 && (
          <p className="text-xs text-primary font-medium">
            Hero + {socialMediaIds.length} social media {socialMediaIds.length === 1 ? 'image' : 'images'}
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
        currentSocialMediaCount={socialMediaIds.length}
      />
    </div>
  );
}
