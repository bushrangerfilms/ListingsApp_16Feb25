import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, AdminNote } from '@/lib/admin/adminApi';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { 
  Loader2, 
  Plus, 
  Trash2, 
  MessageSquare,
  User
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AdminNotesProps {
  targetType: 'user' | 'organization';
  targetId: string;
  targetName?: string;
}

export function AdminNotes({ targetType, targetId, targetName }: AdminNotesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);

  const { data: notes, isLoading } = useQuery({
    queryKey: ['admin', 'notes', targetType, targetId],
    queryFn: () => adminApi.support.getNotes(targetType, targetId),
    enabled: !!targetId,
  });

  const createNoteMutation = useMutation({
    mutationFn: (note: string) => 
      adminApi.support.createNote({ target_type: targetType, target_id: targetId, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'notes', targetType, targetId] });
      setNewNote('');
      setIsAddingNote(false);
      toast({ title: 'Note added successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to add note', description: error.message, variant: 'destructive' });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => adminApi.support.deleteNote(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'notes', targetType, targetId] });
      setDeleteNoteId(null);
      toast({ title: 'Note deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete note', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = () => {
    if (!newNote.trim()) return;
    createNoteMutation.mutate(newNote.trim());
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM d, yyyy h:mm a');
    } catch {
      return dateStr;
    }
  };

  return (
    <Card data-testid="card-admin-notes">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Admin Notes
            {targetName && <span className="text-muted-foreground font-normal">for {targetName}</span>}
          </CardTitle>
          {!isAddingNote && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setIsAddingNote(true)}
              data-testid="button-add-note"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Note
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAddingNote && (
          <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
            <Textarea
              placeholder="Enter your note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="min-h-[80px]"
              data-testid="input-new-note"
            />
            <div className="flex justify-end gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => { setIsAddingNote(false); setNewNote(''); }}
                data-testid="button-cancel-note"
              >
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={handleSubmit}
                disabled={!newNote.trim() || createNoteMutation.isPending}
                data-testid="button-save-note"
              >
                {createNoteMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Save Note
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !notes || notes.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No notes yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div 
                key={note.id} 
                className="p-3 rounded-lg border bg-card"
                data-testid={`note-${note.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-foreground whitespace-pre-wrap flex-1">
                    {note.note}
                  </p>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => setDeleteNoteId(note.id)}
                    data-testid={`button-delete-note-${note.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span>{note.created_by}</span>
                  <span className="text-muted-foreground/50">|</span>
                  <span>{formatDate(note.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleteNoteId} onOpenChange={() => setDeleteNoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteNoteId && deleteNoteMutation.mutate(deleteNoteId)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              {deleteNoteMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
