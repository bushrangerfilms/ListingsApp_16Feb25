import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, VideoMusicTrack, VideoMusicTrackInput } from '@/lib/admin/adminApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Loader2, AlertCircle, Music, Upload, X, CheckCircle2, Play, Pause } from 'lucide-react';
import { format } from 'date-fns';
import { useSuperAdminPermissions } from '@/hooks/useSuperAdminPermissions';
import { supabase } from '@/integrations/supabase/client';

interface BulkUploadFile {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

function extractTrackName(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, '');
}

const GENRES = [
  { value: 'ambient', label: 'Ambient' },
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'electronic', label: 'Electronic' },
  { value: 'folk', label: 'Folk' },
  { value: 'jazz', label: 'Jazz' },
  { value: 'orchestral', label: 'Orchestral' },
  { value: 'pop', label: 'Pop' },
  { value: 'rock', label: 'Rock' },
  { value: 'other', label: 'Other' },
];

const MOODS = [
  { value: 'calm', label: 'Calm' },
  { value: 'energetic', label: 'Energetic' },
  { value: 'happy', label: 'Happy' },
  { value: 'inspirational', label: 'Inspirational' },
  { value: 'melancholic', label: 'Melancholic' },
  { value: 'mysterious', label: 'Mysterious' },
  { value: 'romantic', label: 'Romantic' },
  { value: 'uplifting', label: 'Uplifting' },
];

interface TrackForm {
  name: string;
  description: string;
  genre: string;
  mood: string;
  tags: string[];
  is_active: boolean;
}

const initialFormState: TrackForm = {
  name: '',
  description: '',
  genre: '',
  mood: '',
  tags: [],
  is_active: true,
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function VideoMusicPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole, hasSuperAdminAccess, loading: authLoading } = useSuperAdminPermissions();
  const canEdit = userRole === 'super_admin';

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<VideoMusicTrack | null>(null);
  const [formData, setFormData] = useState<TrackForm>(initialFormState);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<BulkUploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const { data: tracks, isLoading, error } = useQuery({
    queryKey: ['admin-video-music-tracks'],
    queryFn: () => adminApi.videoMusic.list(),
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const createMutation = useMutation({
    mutationFn: async (data: VideoMusicTrackInput) => {
      return adminApi.videoMusic.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-video-music-tracks'] });
      setIsCreateOpen(false);
      setFormData(initialFormState);
      setSelectedFile(null);
      toast({ title: 'Music track created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create music track', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<VideoMusicTrackInput> }) => {
      return adminApi.videoMusic.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-video-music-tracks'] });
      setEditingTrack(null);
      setFormData(initialFormState);
      toast({ title: 'Music track updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update music track', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return adminApi.videoMusic.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-video-music-tracks'] });
      setDeleteConfirm(null);
      toast({ title: 'Music track deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete music track', description: error.message, variant: 'destructive' });
    },
  });

  const handleEdit = (track: VideoMusicTrack) => {
    setEditingTrack(track);
    setFormData({
      name: track.name,
      description: track.description || '',
      genre: track.genre || '',
      mood: track.mood || '',
      tags: track.tags || [],
      is_active: track.is_active,
    });
  };

  const handleSubmit = async () => {
    if (editingTrack) {
      updateMutation.mutate({
        id: editingTrack.id,
        data: {
          name: formData.name,
          description: formData.description || undefined,
          genre: formData.genre || undefined,
          mood: formData.mood || undefined,
          tags: formData.tags,
          is_active: formData.is_active,
          storage_path: editingTrack.storage_path,
          file_name: editingTrack.file_name,
        },
      });
    } else {
      if (!selectedFile) {
        toast({ title: 'Please select a music file', variant: 'destructive' });
        return;
      }

      setUploading(true);
      try {
        const fileName = `${Date.now()}-${selectedFile.name}`;
        const storagePath = `tracks/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('music-tracks')
          .upload(storagePath, selectedFile);

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        createMutation.mutate({
          name: formData.name,
          description: formData.description || undefined,
          storage_path: storagePath,
          file_name: selectedFile.name,
          file_size_bytes: selectedFile.size,
          genre: formData.genre || undefined,
          mood: formData.mood || undefined,
          tags: formData.tags,
          is_active: formData.is_active,
        });
      } catch (err) {
        toast({ 
          title: 'Upload failed', 
          description: err instanceof Error ? err.message : 'Unknown error', 
          variant: 'destructive' 
        });
      } finally {
        setUploading(false);
      }
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
  };

  const handleCloseDialog = () => {
    setIsCreateOpen(false);
    setEditingTrack(null);
    setFormData(initialFormState);
    setSelectedFile(null);
    setTagInput('');
  };

  const handlePlayPause = async (track: VideoMusicTrack) => {
    if (playingTrackId === track.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingTrackId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setAudioLoading(true);
    setPlayingTrackId(track.id);

    try {
      const { data } = await supabase.storage
        .from('music-tracks')
        .createSignedUrl(track.storage_path, 3600);

      if (!data?.signedUrl) {
        throw new Error('Could not get audio URL');
      }

      const audio = new Audio(data.signedUrl);
      audioRef.current = audio;

      audio.oncanplaythrough = () => {
        setAudioLoading(false);
        audio.play().catch(() => {
          setPlayingTrackId(null);
          toast({ title: 'Failed to play audio', variant: 'destructive' });
        });
      };

      audio.onended = () => {
        setPlayingTrackId(null);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setAudioLoading(false);
        setPlayingTrackId(null);
        audioRef.current = null;
        toast({ title: 'Failed to load audio', variant: 'destructive' });
      };

      audio.load();
    } catch (err) {
      setAudioLoading(false);
      setPlayingTrackId(null);
      toast({ 
        title: 'Failed to play track', 
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive' 
      });
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
    if (files.length > 0) {
      setBulkFiles(prev => [
        ...prev,
        ...files.map(file => ({ file, status: 'pending' as const }))
      ]);
    }
  }, []);

  const handleBulkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('audio/'));
    if (files.length > 0) {
      setBulkFiles(prev => [
        ...prev,
        ...files.map(file => ({ file, status: 'pending' as const }))
      ]);
    }
  };

  const removeBulkFile = (index: number) => {
    setBulkFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleBulkUpload = async () => {
    if (bulkFiles.length === 0) return;
    
    setBulkUploading(true);
    
    for (let i = 0; i < bulkFiles.length; i++) {
      const item = bulkFiles[i];
      if (item.status !== 'pending') continue;
      
      setBulkFiles(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: 'uploading' } : f
      ));
      
      try {
        const fileName = `${Date.now()}-${item.file.name}`;
        const storagePath = `tracks/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('music-tracks')
          .upload(storagePath, item.file);
        
        if (uploadError) {
          throw new Error(uploadError.message);
        }
        
        setBulkFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'success' } : f
        ));
      } catch (err) {
        setBulkFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' } : f
        ));
      }
    }
    
    setBulkUploading(false);
    queryClient.invalidateQueries({ queryKey: ['admin-video-music-tracks'] });
    
    const successCount = bulkFiles.filter(f => f.status === 'success').length;
    if (successCount > 0) {
      toast({ title: `Successfully uploaded ${successCount} track${successCount !== 1 ? 's' : ''}` });
    }
  };

  const closeBulkUpload = () => {
    setIsBulkUploadOpen(false);
    setBulkFiles([]);
  };

  const bulkUploadProgress = bulkFiles.length > 0
    ? Math.round((bulkFiles.filter(f => f.status === 'success' || f.status === 'error').length / bulkFiles.length) * 100)
    : 0;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasSuperAdminAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-muted-foreground">You don't have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Music className="h-6 w-6" />
            Video Music Library
          </h1>
          <p className="text-muted-foreground">
            Manage music tracks available for video generation across all organizations.
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsBulkUploadOpen(true)} data-testid="button-bulk-import">
              <Upload className="h-4 w-4 mr-2" />
              Bulk Import
            </Button>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="button-add-track">
              <Plus className="h-4 w-4 mr-2" />
              Add Track
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Music Tracks</CardTitle>
          <CardDescription>
            {tracks?.length || 0} track{(tracks?.length || 0) !== 1 ? 's' : ''} in the library
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-32 text-destructive gap-2">
              <AlertCircle className="h-5 w-5" />
              <span>Failed to load tracks</span>
            </div>
          ) : !tracks?.length ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
              <Music className="h-8 w-8" />
              <p>No music tracks yet</p>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(true)}>
                  Add your first track
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Genre</TableHead>
                  <TableHead>Mood</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  {canEdit && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tracks.map((track) => (
                  <TableRow key={track.id} data-testid={`row-track-${track.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePlayPause(track)}
                          disabled={audioLoading && playingTrackId === track.id}
                          data-testid={`button-play-track-${track.id}`}
                        >
                          {audioLoading && playingTrackId === track.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : playingTrackId === track.id ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <div>
                          <span>{track.name}</span>
                          {track.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-xs">
                              {track.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {track.genre ? (
                        <Badge variant="secondary">{track.genre}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {track.mood ? (
                        <Badge variant="outline">{track.mood}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDuration(track.duration_seconds)}</TableCell>
                    <TableCell>{formatFileSize(track.file_size_bytes)}</TableCell>
                    <TableCell>
                      <Badge variant={track.is_active ? 'default' : 'secondary'}>
                        {track.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(track.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(track)}
                            data-testid={`button-edit-track-${track.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirm(track.id)}
                            data-testid={`button-delete-track-${track.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen || !!editingTrack} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTrack ? 'Edit Track' : 'Add New Track'}</DialogTitle>
            <DialogDescription>
              {editingTrack
                ? 'Update the details of this music track.'
                : 'Upload a new music track to the library.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!editingTrack && (
              <div className="space-y-2">
                <Label>Music File</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    data-testid="input-music-file"
                  />
                </div>
                {selectedFile && (
                  <p className="text-xs text-muted-foreground">
                    {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Track name"
                data-testid="input-track-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
                data-testid="input-track-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Genre</Label>
                <Select
                  value={formData.genre}
                  onValueChange={(value) => setFormData({ ...formData, genre: value })}
                >
                  <SelectTrigger data-testid="select-genre">
                    <SelectValue placeholder="Select genre" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENRES.map((genre) => (
                      <SelectItem key={genre.value} value={genre.value}>
                        {genre.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Mood</Label>
                <Select
                  value={formData.mood}
                  onValueChange={(value) => setFormData({ ...formData, mood: value })}
                >
                  <SelectTrigger data-testid="select-mood">
                    <SelectValue placeholder="Select mood" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOODS.map((mood) => (
                      <SelectItem key={mood.value} value={mood.value}>
                        {mood.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  placeholder="Add a tag"
                  data-testid="input-tag"
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddTag}>
                  Add
                </Button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Active</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                data-testid="switch-is-active"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !formData.name ||
                (!editingTrack && !selectedFile) ||
                createMutation.isPending ||
                updateMutation.isPending ||
                uploading
              }
              data-testid="button-submit-track"
            >
              {(createMutation.isPending || updateMutation.isPending || uploading) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingTrack ? 'Save Changes' : 'Upload Track'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Track</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this music track? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkUploadOpen} onOpenChange={closeBulkUpload}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Import Music Tracks</DialogTitle>
            <DialogDescription>
              Drag and drop audio files or click to browse. Track names will be extracted from filenames.
            </DialogDescription>
          </DialogHeader>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-md p-8 text-center transition-colors cursor-pointer
              ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'}
            `}
            onClick={() => document.getElementById('bulk-file-input')?.click()}
            data-testid="dropzone-bulk-upload"
          >
            <input
              id="bulk-file-input"
              type="file"
              accept="audio/*"
              multiple
              className="hidden"
              onChange={handleBulkFileSelect}
            />
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Drop audio files here</p>
            <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
          </div>

          {bulkFiles.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {bulkUploading && (
                <Progress value={bulkUploadProgress} className="mb-2" />
              )}
              {bulkFiles.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50"
                  data-testid={`bulk-file-${index}`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {item.status === 'pending' && <Music className="h-4 w-4 text-muted-foreground shrink-0" />}
                    {item.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
                    {item.status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                    {item.status === 'error' && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
                    <span className="text-sm truncate">{extractTrackName(item.file.name)}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      ({formatFileSize(item.file.size)})
                    </span>
                  </div>
                  {item.status === 'pending' && !bulkUploading && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); removeBulkFile(index); }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeBulkUpload} disabled={bulkUploading}>
              {bulkFiles.some(f => f.status === 'success') ? 'Done' : 'Cancel'}
            </Button>
            {bulkFiles.some(f => f.status === 'pending') && (
              <Button
                onClick={handleBulkUpload}
                disabled={bulkUploading || !bulkFiles.some(f => f.status === 'pending')}
                data-testid="button-start-bulk-upload"
              >
                {bulkUploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Upload {bulkFiles.filter(f => f.status === 'pending').length} File{bulkFiles.filter(f => f.status === 'pending').length !== 1 ? 's' : ''}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
