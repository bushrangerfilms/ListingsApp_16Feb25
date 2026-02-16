import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, AIInstructionSet, AIInstructionSetInput, AIInstructionHistory } from '@/lib/admin/adminApi';
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
  DialogTrigger,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Loader2, AlertCircle, Brain, Copy, History, X } from 'lucide-react';
import { format } from 'date-fns';
import { useSuperAdminPermissions } from '@/hooks/useSuperAdminPermissions';

const FEATURE_TYPES = [
  { value: 'listing_enhance_description', label: 'Listing Description Enhancement' },
  { value: 'listing_enhance_specs', label: 'Listing Specs Enhancement' },
  { value: 'property_extraction', label: 'Property Detail Extraction' },
  { value: 'chatbot_assistant', label: 'Chatbot Assistant' },
  { value: 'photo_captions', label: 'Photo Captions' },
  { value: 'social_media_posts', label: 'Social Media Posts' },
];

const LOCALES = [
  { value: '', label: 'All Locales (Default)' },
  { value: 'en-IE', label: 'English (Ireland)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-US', label: 'English (US)' },
];

interface InstructionForm {
  feature_type: string;
  name: string;
  description: string;
  banned_phrases: string[];
  tone_guidelines: string[];
  freeform_instructions: string;
  is_active: boolean;
  priority: number;
  locale: string;
  scope: 'global' | 'organization';
}

const initialFormState: InstructionForm = {
  feature_type: 'listing_enhance_description',
  name: '',
  description: '',
  banned_phrases: [],
  tone_guidelines: [],
  freeform_instructions: '',
  is_active: true,
  priority: 0,
  locale: '',
  scope: 'global',
};

export default function AITrainingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole, hasSuperAdminAccess, loading: authLoading } = useSuperAdminPermissions();
  const canEdit = userRole === 'super_admin';

  const [activeTab, setActiveTab] = useState<string>('listing_enhance_description');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingInstruction, setEditingInstruction] = useState<AIInstructionSet | null>(null);
  const [formData, setFormData] = useState<InstructionForm>(initialFormState);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [historyDialogId, setHistoryDialogId] = useState<string | null>(null);
  const [bannedPhraseInput, setBannedPhraseInput] = useState('');
  const [toneGuidelineInput, setToneGuidelineInput] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'global' | 'organization'>('all');
  const [localeFilter, setLocaleFilter] = useState<string>('all');

  const { data: instructions, isLoading, error } = useQuery({
    queryKey: ['admin-ai-instructions', activeTab],
    queryFn: () => adminApi.aiInstructions.list({ feature_type: activeTab }),
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['admin-ai-instruction-history', historyDialogId],
    queryFn: () => adminApi.aiInstructions.getHistory(historyDialogId!),
    enabled: !!historyDialogId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: AIInstructionSetInput) => {
      return adminApi.aiInstructions.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ai-instructions'] });
      setIsCreateOpen(false);
      setFormData(initialFormState);
      toast({ title: 'Instruction set created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create instruction set', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AIInstructionSetInput> }) => {
      return adminApi.aiInstructions.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ai-instructions'] });
      setEditingInstruction(null);
      setFormData(initialFormState);
      toast({ title: 'Instruction set updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update instruction set', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return adminApi.aiInstructions.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ai-instructions'] });
      setDeleteConfirm(null);
      toast({ title: 'Instruction set deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete instruction set', description: error.message, variant: 'destructive' });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      return adminApi.aiInstructions.duplicate(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ai-instructions'] });
      toast({ title: 'Instruction set duplicated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to duplicate instruction set', description: error.message, variant: 'destructive' });
    },
  });

  const handleEdit = (instruction: AIInstructionSet) => {
    setEditingInstruction(instruction);
    setFormData({
      feature_type: instruction.feature_type,
      name: instruction.name,
      description: instruction.description || '',
      banned_phrases: instruction.banned_phrases || [],
      tone_guidelines: instruction.tone_guidelines || [],
      freeform_instructions: instruction.freeform_instructions || '',
      is_active: instruction.is_active,
      priority: instruction.priority,
      locale: instruction.locale || '',
      scope: instruction.scope,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: AIInstructionSetInput = {
      feature_type: formData.feature_type,
      name: formData.name,
      description: formData.description || undefined,
      banned_phrases: formData.banned_phrases,
      tone_guidelines: formData.tone_guidelines,
      freeform_instructions: formData.freeform_instructions || undefined,
      is_active: formData.is_active,
      priority: formData.priority,
      locale: formData.locale || undefined,
      scope: formData.scope,
    };

    if (editingInstruction) {
      updateMutation.mutate({ id: editingInstruction.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const addBannedPhrase = () => {
    if (bannedPhraseInput.trim()) {
      setFormData({
        ...formData,
        banned_phrases: [...formData.banned_phrases, bannedPhraseInput.trim()],
      });
      setBannedPhraseInput('');
    }
  };

  const removeBannedPhrase = (index: number) => {
    setFormData({
      ...formData,
      banned_phrases: formData.banned_phrases.filter((_, i) => i !== index),
    });
  };

  const addToneGuideline = () => {
    if (toneGuidelineInput.trim()) {
      setFormData({
        ...formData,
        tone_guidelines: [...formData.tone_guidelines, toneGuidelineInput.trim()],
      });
      setToneGuidelineInput('');
    }
  };

  const removeToneGuideline = (index: number) => {
    setFormData({
      ...formData,
      tone_guidelines: formData.tone_guidelines.filter((_, i) => i !== index),
    });
  };

  const isFormValid = formData.name && formData.feature_type;

  const getFeatureTypeLabel = (type: string) => {
    const feature = FEATURE_TYPES.find((f) => f.value === type);
    return feature?.label || type;
  };

  const getChangeTypeColor = (type: string) => {
    switch (type) {
      case 'create': return 'default';
      case 'update': return 'secondary';
      case 'delete': return 'destructive';
      case 'duplicate': return 'outline';
      default: return 'secondary';
    }
  };

  // Filter instructions based on scope and locale
  const filteredInstructions = instructions?.filter((instruction) => {
    if (scopeFilter !== 'all' && instruction.scope !== scopeFilter) return false;
    if (localeFilter !== 'all') {
      if (localeFilter === 'global' && instruction.locale) return false;
      if (localeFilter !== 'global' && instruction.locale !== localeFilter) return false;
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load AI instructions: {(error as Error).message}</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formContent = (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="feature_type">Feature Type</Label>
        <Select
          value={formData.feature_type}
          onValueChange={(v) => setFormData({ ...formData, feature_type: v })}
          disabled={!!editingInstruction}
        >
          <SelectTrigger data-testid="select-feature-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FEATURE_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Professional Tone Instructions"
          data-testid="input-name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe the purpose of these instructions..."
          data-testid="input-description"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Locale</Label>
          <Select
            value={formData.locale || '__global__'}
            onValueChange={(v) => setFormData({ ...formData, locale: v === '__global__' ? '' : v })}
          >
            <SelectTrigger data-testid="select-locale">
              <SelectValue placeholder="All Locales" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__global__">All Locales (Default)</SelectItem>
              {LOCALES.filter(l => l.value).map((locale) => (
                <SelectItem key={locale.value} value={locale.value}>
                  {locale.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Input
            id="priority"
            type="number"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
            data-testid="input-priority"
          />
          <p className="text-xs text-muted-foreground">Higher = applied first</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Banned Phrases</Label>
        <div className="flex gap-2">
          <Input
            value={bannedPhraseInput}
            onChange={(e) => setBannedPhraseInput(e.target.value)}
            placeholder="Add a phrase to ban..."
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBannedPhrase())}
            data-testid="input-banned-phrase"
          />
          <Button type="button" variant="outline" onClick={addBannedPhrase}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {formData.banned_phrases.map((phrase, index) => (
            <Badge key={index} variant="secondary" className="gap-1">
              {phrase}
              <button
                type="button"
                onClick={() => removeBannedPhrase(index)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tone Guidelines</Label>
        <div className="flex gap-2">
          <Input
            value={toneGuidelineInput}
            onChange={(e) => setToneGuidelineInput(e.target.value)}
            placeholder="Add a tone guideline..."
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToneGuideline())}
            data-testid="input-tone-guideline"
          />
          <Button type="button" variant="outline" onClick={addToneGuideline}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {formData.tone_guidelines.map((guideline, index) => (
            <Badge key={index} variant="outline" className="gap-1">
              {guideline}
              <button
                type="button"
                onClick={() => removeToneGuideline(index)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="freeform_instructions">Freeform Instructions</Label>
        <Textarea
          id="freeform_instructions"
          value={formData.freeform_instructions}
          onChange={(e) => setFormData({ ...formData, freeform_instructions: e.target.value })}
          placeholder="Additional custom instructions for the AI..."
          className="min-h-[120px]"
          data-testid="input-freeform"
        />
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

      {/* Live Preview Section */}
      {(formData.banned_phrases.length > 0 || formData.tone_guidelines.length > 0 || formData.freeform_instructions) && (
        <div className="space-y-2 pt-4 border-t">
          <Label className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Prompt Preview
          </Label>
          <div className="bg-muted/50 rounded-md p-3 text-sm font-mono whitespace-pre-wrap max-h-[200px] overflow-y-auto">
            {formData.banned_phrases.length > 0 && (
              <>
                <span className="text-muted-foreground">BANNED PHRASES (Never use these):</span>
                {'\n'}- {formData.banned_phrases.join('\n- ')}
                {'\n\n'}
              </>
            )}
            {formData.tone_guidelines.length > 0 && (
              <>
                <span className="text-muted-foreground">TONE GUIDELINES:</span>
                {'\n'}- {formData.tone_guidelines.join('\n- ')}
                {'\n\n'}
              </>
            )}
            {formData.freeform_instructions && (
              <>
                <span className="text-muted-foreground">ADDITIONAL INSTRUCTIONS:</span>
                {'\n'}{formData.freeform_instructions}
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            This shows how your instructions will appear in the AI prompt
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">AI Training</h1>
          <p className="text-muted-foreground">Customize AI behavior with banned phrases, tone guidelines, and custom instructions</p>
        </div>
        {canEdit && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-instruction">
                <Plus className="h-4 w-4 mr-2" />
                New Instruction Set
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Create Instruction Set</DialogTitle>
                  <DialogDescription>
                    Create a new set of AI instructions to customize behavior
                  </DialogDescription>
                </DialogHeader>
                {formContent}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!isFormValid || createMutation.isPending}
                    data-testid="button-submit"
                  >
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          {FEATURE_TYPES.map((type) => (
            <TabsTrigger key={type.value} value={type.value} data-testid={`tab-${type.value}`}>
              {type.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {FEATURE_TYPES.map((type) => (
          <TabsContent key={type.value} value={type.value}>
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      {type.label} Instructions ({filteredInstructions?.length || 0})
                    </CardTitle>
                    <CardDescription>
                      {filteredInstructions?.filter((i) => i.is_active).length || 0} active instruction sets
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select value={scopeFilter} onValueChange={(v) => setScopeFilter(v as 'all' | 'global' | 'organization')}>
                      <SelectTrigger className="w-[140px]" data-testid="filter-scope">
                        <SelectValue placeholder="Scope" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Scopes</SelectItem>
                        <SelectItem value="global">Global Only</SelectItem>
                        <SelectItem value="organization">Organization Only</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={localeFilter} onValueChange={setLocaleFilter}>
                      <SelectTrigger className="w-[140px]" data-testid="filter-locale">
                        <SelectValue placeholder="Locale" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Locales</SelectItem>
                        <SelectItem value="global">Global (No Locale)</SelectItem>
                        {LOCALES.filter(l => l.value).map((locale) => (
                          <SelectItem key={locale.value} value={locale.value}>
                            {locale.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredInstructions && filteredInstructions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead>Locale</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Updated</TableHead>
                        {canEdit && <TableHead className="w-[140px]">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInstructions.map((instruction) => (
                        <TableRow key={instruction.id} data-testid={`row-instruction-${instruction.id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{instruction.name}</p>
                              {instruction.description && (
                                <p className="text-sm text-muted-foreground truncate max-w-xs">
                                  {instruction.description}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-1 mt-1">
                                {instruction.banned_phrases?.length > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    {instruction.banned_phrases.length} banned phrases
                                  </Badge>
                                )}
                                {instruction.tone_guidelines?.length > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    {instruction.tone_guidelines.length} tone guidelines
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={instruction.scope === 'global' ? 'default' : 'outline'}>
                              {instruction.scope === 'global' ? 'Global' : 'Org'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {instruction.locale || 'All'}
                            </Badge>
                          </TableCell>
                          <TableCell>{instruction.priority}</TableCell>
                          <TableCell>
                            <Badge variant={instruction.is_active ? 'default' : 'secondary'}>
                              {instruction.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(instruction.updated_at), 'MMM d, yyyy')}
                          </TableCell>
                          {canEdit && (
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(instruction)}
                                  data-testid={`button-edit-${instruction.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => duplicateMutation.mutate(instruction.id)}
                                  data-testid={`button-duplicate-${instruction.id}`}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setHistoryDialogId(instruction.id)}
                                  data-testid={`button-history-${instruction.id}`}
                                >
                                  <History className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleteConfirm(instruction.id)}
                                  data-testid={`button-delete-${instruction.id}`}
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
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No instruction sets for {type.label}</p>
                    {canEdit && <p className="text-sm mt-1">Create your first instruction set to customize AI behavior</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editingInstruction} onOpenChange={(open) => !open && setEditingInstruction(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Instruction Set</DialogTitle>
              <DialogDescription>
                Update the instruction set settings
              </DialogDescription>
            </DialogHeader>
            {formContent}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingInstruction(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isFormValid || updateMutation.isPending}
                data-testid="button-update"
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!historyDialogId} onOpenChange={(open) => !open && setHistoryDialogId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Change History</DialogTitle>
            <DialogDescription>
              View the history of changes made to this instruction set
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : history && history.length > 0 ? (
              <div className="space-y-4">
                {history.map((entry) => (
                  <div key={entry.id} className="border rounded-md p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={getChangeTypeColor(entry.change_type) as any}>
                        {entry.change_type}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(entry.created_at), 'MMM d, yyyy HH:mm')}
                      </span>
                    </div>
                    {entry.change_reason && (
                      <p className="text-sm mb-2">{entry.change_reason}</p>
                    )}
                    {entry.previous_values && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground">Previous values</summary>
                        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                          {JSON.stringify(entry.previous_values, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No history available</p>
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDialogId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Instruction Set</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this instruction set? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirm) {
                  deleteMutation.mutate(deleteConfirm);
                }
              }}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
