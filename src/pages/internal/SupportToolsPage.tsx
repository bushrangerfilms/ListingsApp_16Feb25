import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, AdminNote, EmailQueueItem } from '@/lib/admin/adminApi';
import { useAuth } from '@/contexts/AuthContext';
import { useSuperAdminPermissions } from '@/hooks/useSuperAdminPermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useToast } from '@/hooks/use-toast';
import { 
  Search, 
  Loader2, 
  AlertCircle, 
  StickyNote, 
  Mail, 
  RefreshCw, 
  Send,
  User,
  Building2,
  Plus,
  Clock,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';

export default function SupportToolsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission, userRole, hasSuperAdminAccess, loading: authLoading } = useSuperAdminPermissions();
  const isSuperAdmin = userRole === 'super_admin';
  const canManageSupport = isSuperAdmin;

  const [activeTab, setActiveTab] = useState('notes');
  const [searchQuery, setSearchQuery] = useState('');
  const [noteTargetType, setNoteTargetType] = useState<'organization' | 'user'>('organization');
  const [noteTargetId, setNoteTargetId] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [emailToResend, setEmailToResend] = useState('');
  const [userIdForVerification, setUserIdForVerification] = useState('');

  const { data: notes, isLoading: notesLoading, error: notesError } = useQuery({
    queryKey: ['admin-notes'],
    queryFn: () => adminApi.support.getNotes(),
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const { data: emailQueue, isLoading: emailLoading } = useQuery({
    queryKey: ['admin-email-queue'],
    queryFn: () => adminApi.support.getEmailQueue(50),
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const filteredNotes = notes?.filter(note => {
    if (!searchQuery) return true;
    return note.target_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
           note.note.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const addNoteMutation = useMutation({
    mutationFn: () => adminApi.support.createNote({
      target_type: noteTargetType,
      target_id: noteTargetId,
      note: noteContent,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notes'] });
      setIsAddNoteOpen(false);
      setNoteTargetId('');
      setNoteContent('');
      toast({ title: 'Note added successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to add note', description: error.message, variant: 'destructive' });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => adminApi.support.deleteNote(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notes'] });
      toast({ title: 'Note deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete note', description: error.message, variant: 'destructive' });
    },
  });

  const resendVerificationMutation = useMutation({
    mutationFn: (userId: string) => adminApi.support.resendVerification(userId),
    onSuccess: (data) => {
      setUserIdForVerification('');
      toast({ title: 'Verification email sent', description: `Email sent to ${data.email}` });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to send verification', description: error.message, variant: 'destructive' });
    },
  });

  const resendPasswordResetMutation = useMutation({
    mutationFn: (email: string) => adminApi.support.resetPassword(email),
    onSuccess: (data) => {
      setEmailToResend('');
      toast({ title: 'Password reset email sent', description: `Reset link sent to ${data.email}` });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to send password reset', description: error.message, variant: 'destructive' });
    },
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return 'default';
      case 'pending':
      case 'queued':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Support Tools</h1>
        <p className="text-muted-foreground">Customer support operations and utilities</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="notes" data-testid="tab-notes">
            <StickyNote className="h-4 w-4 mr-2" />
            Admin Notes
          </TabsTrigger>
          <TabsTrigger value="email" data-testid="tab-email">
            <Mail className="h-4 w-4 mr-2" />
            Email Operations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>Admin Notes</CardTitle>
                <CardDescription>Internal notes for organizations and users</CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                    data-testid="input-search-notes"
                  />
                </div>
                {canManageSupport && (
                  <Button onClick={() => setIsAddNoteOpen(true)} data-testid="button-add-note">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Note
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {notesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : notesError ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                  <AlertCircle className="h-5 w-5" />
                  <span>Failed to load notes</span>
                </div>
              ) : filteredNotes && filteredNotes.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Target ID</TableHead>
                      <TableHead className="min-w-[300px]">Note</TableHead>
                      <TableHead>Created</TableHead>
                      {canManageSupport && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNotes.map((note) => (
                      <TableRow key={note.id} data-testid={`row-note-${note.id}`}>
                        <TableCell>
                          <Badge variant="outline">
                            {note.target_type === 'organization' ? (
                              <Building2 className="h-3 w-3 mr-1" />
                            ) : (
                              <User className="h-3 w-3 mr-1" />
                            )}
                            {note.target_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{note.target_id}</TableCell>
                        <TableCell className="max-w-md">
                          <p className="line-clamp-2">{note.note}</p>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {format(new Date(note.created_at), 'MMM d, yyyy HH:mm')}
                        </TableCell>
                        {canManageSupport && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteNoteMutation.mutate(note.id)}
                              disabled={deleteNoteMutation.isPending}
                              data-testid={`button-delete-note-${note.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">No admin notes found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Resend Verification Email
                </CardTitle>
                <CardDescription>Resend email verification link to a user</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="userId">User ID</Label>
                  <Input
                    id="userId"
                    placeholder="Enter user UUID"
                    value={userIdForVerification}
                    onChange={(e) => setUserIdForVerification(e.target.value)}
                    data-testid="input-user-id-verification"
                  />
                </div>
                <Button
                  onClick={() => resendVerificationMutation.mutate(userIdForVerification)}
                  disabled={!userIdForVerification || resendVerificationMutation.isPending}
                  data-testid="button-resend-verification"
                >
                  {resendVerificationMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Send className="h-4 w-4 mr-2" />
                  Resend Verification
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Send Password Reset
                </CardTitle>
                <CardDescription>Send password reset email to a user</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={emailToResend}
                    onChange={(e) => setEmailToResend(e.target.value)}
                    data-testid="input-email-password-reset"
                  />
                </div>
                <Button
                  onClick={() => {
                    const trimmedEmail = emailToResend.trim();
                    if (trimmedEmail) {
                      resendPasswordResetMutation.mutate(trimmedEmail);
                    }
                  }}
                  disabled={!emailToResend.trim() || resendPasswordResetMutation.isPending}
                  data-testid="button-send-password-reset"
                >
                  {resendPasswordResetMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Send className="h-4 w-4 mr-2" />
                  Send Reset Email
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Email Queue</CardTitle>
              <CardDescription>Recent email delivery status</CardDescription>
            </CardHeader>
            <CardContent>
              {emailLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : emailQueue && emailQueue.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emailQueue.map((item) => (
                      <TableRow key={item.id} data-testid={`row-email-${item.id}`}>
                        <TableCell>{item.to_email}</TableCell>
                        <TableCell className="max-w-xs truncate">{item.subject}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(item.status)}>
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(item.created_at), 'MMM d, HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">No emails in queue</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isAddNoteOpen} onOpenChange={setIsAddNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Admin Note</DialogTitle>
            <DialogDescription>
              Create an internal note for an organization or user
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Target Type</Label>
              <Select
                value={noteTargetType}
                onValueChange={(v) => setNoteTargetType(v as 'organization' | 'user')}
              >
                <SelectTrigger data-testid="select-note-target-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="organization">Organization</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target ID</Label>
              <Input
                placeholder={noteTargetType === 'organization' ? 'Organization UUID' : 'User UUID'}
                value={noteTargetId}
                onChange={(e) => setNoteTargetId(e.target.value)}
                data-testid="input-note-target-id"
              />
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea
                placeholder="Enter your note..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={4}
                data-testid="input-note-content"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddNoteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addNoteMutation.mutate()}
              disabled={!noteTargetId.trim() || !noteContent.trim() || addNoteMutation.isPending}
              data-testid="button-submit-note"
            >
              {addNoteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
