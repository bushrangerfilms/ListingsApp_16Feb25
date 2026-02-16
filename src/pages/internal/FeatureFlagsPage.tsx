import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, FeatureFlag, FeatureFlagOverride } from '@/lib/admin/adminApi';
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
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Loader2, AlertCircle, Flag, ToggleLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useSuperAdminPermissions } from '@/hooks/useSuperAdminPermissions';

interface FeatureFlagForm {
  key: string;
  name: string;
  description: string;
  flag_type: 'boolean' | 'percentage' | 'allowlist';
  default_state: boolean;
  rollout_percentage: number;
  is_active: boolean;
}

const initialFormState: FeatureFlagForm = {
  key: '',
  name: '',
  description: '',
  flag_type: 'boolean',
  default_state: false,
  rollout_percentage: 0,
  is_active: true,
};

export default function FeatureFlagsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole, hasSuperAdminAccess, loading: authLoading } = useSuperAdminPermissions();
  const canEdit = userRole === 'super_admin' || userRole === 'developer';
  const isSuperAdmin = userRole === 'super_admin';

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [formData, setFormData] = useState<FeatureFlagForm>(initialFormState);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectedFlag, setSelectedFlag] = useState<string | null>(null);

  const { data: featureFlags, isLoading, error } = useQuery({
    queryKey: ['admin-feature-flags'],
    queryFn: () => adminApi.flags.list(),
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const { data: overrides } = useQuery({
    queryKey: ['admin-feature-flag-overrides', selectedFlag],
    enabled: !!selectedFlag,
    queryFn: () => adminApi.flags.getOverrides(selectedFlag!),
  });

  const createMutation = useMutation({
    mutationFn: async (data: FeatureFlagForm) => {
      return adminApi.flags.create({
        key: data.key.toLowerCase().replace(/\s+/g, '_'),
        name: data.name,
        description: data.description || undefined,
        flag_type: data.flag_type,
        default_state: data.default_state,
        rollout_percentage: data.flag_type === 'percentage' ? data.rollout_percentage : undefined,
        is_active: data.is_active,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] });
      setIsCreateOpen(false);
      setFormData(initialFormState);
      toast({ title: 'Feature flag created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create feature flag', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FeatureFlagForm }) => {
      return adminApi.flags.update(id, {
        key: data.key.toLowerCase().replace(/\s+/g, '_'),
        name: data.name,
        description: data.description || undefined,
        flag_type: data.flag_type,
        default_state: data.default_state,
        rollout_percentage: data.flag_type === 'percentage' ? data.rollout_percentage : undefined,
        is_active: data.is_active,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] });
      setEditingFlag(null);
      setFormData(initialFormState);
      toast({ title: 'Feature flag updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update feature flag', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return adminApi.flags.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] });
      setDeleteConfirm(null);
      toast({ title: 'Feature flag deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete feature flag', description: error.message, variant: 'destructive' });
    },
  });

  const toggleFlagMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      return adminApi.flags.toggle(id, is_active);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to toggle feature flag', description: error.message, variant: 'destructive' });
    },
  });

  const handleEdit = (flag: FeatureFlag) => {
    setEditingFlag(flag);
    setFormData({
      key: flag.key,
      name: flag.name,
      description: flag.description || '',
      flag_type: flag.flag_type,
      default_state: flag.default_state,
      rollout_percentage: flag.rollout_percentage || 0,
      is_active: flag.is_active,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingFlag) {
      updateMutation.mutate({ id: editingFlag.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isFormValid = formData.key && formData.name;

  const getFlagTypeLabel = (type: string) => {
    switch (type) {
      case 'boolean': return 'On/Off';
      case 'percentage': return 'Gradual Rollout';
      case 'allowlist': return 'Allowlist';
      default: return type;
    }
  };

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
            <span>Failed to load feature flags: {(error as Error).message}</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Feature Flags</h1>
          <p className="text-muted-foreground">Control feature rollout without deployments</p>
        </div>
        {canEdit && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-flag">
                <Plus className="h-4 w-4 mr-2" />
                Create Flag
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Create Feature Flag</DialogTitle>
                  <DialogDescription>
                    Create a new feature flag to control feature availability
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="key">Key</Label>
                    <Input
                      id="key"
                      value={formData.key}
                      onChange={(e) => setFormData({ ...formData, key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                      placeholder="social_media_automation"
                      data-testid="input-flag-key"
                    />
                    <p className="text-xs text-muted-foreground">Unique identifier used in code</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Social Media Automation"
                      data-testid="input-flag-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Enable social media automation features"
                      data-testid="input-flag-description"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Flag Type</Label>
                    <Select
                      value={formData.flag_type}
                      onValueChange={(v) => setFormData({ ...formData, flag_type: v as FeatureFlagForm['flag_type'] })}
                    >
                      <SelectTrigger data-testid="select-flag-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="boolean">Boolean (On/Off)</SelectItem>
                        <SelectItem value="percentage">Percentage Rollout</SelectItem>
                        <SelectItem value="allowlist">Allowlist (Specific Orgs)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.flag_type === 'percentage' && (
                    <div className="space-y-2">
                      <Label>Rollout Percentage: {formData.rollout_percentage}%</Label>
                      <Slider
                        value={[formData.rollout_percentage]}
                        onValueChange={([v]) => setFormData({ ...formData, rollout_percentage: v })}
                        max={100}
                        step={5}
                        data-testid="slider-rollout-percentage"
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <Label htmlFor="default_state">Default State (On)</Label>
                    <Switch
                      id="default_state"
                      checked={formData.default_state}
                      onCheckedChange={(checked) => setFormData({ ...formData, default_state: checked })}
                      data-testid="switch-default-state"
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
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!isFormValid || createMutation.isPending}
                    data-testid="button-submit-flag"
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

      {userRole === 'developer' && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              As a developer, you can modify non-production feature flags. Production flag changes require super admin approval.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Feature Flags ({featureFlags?.length || 0})
          </CardTitle>
          <CardDescription>
            {featureFlags?.filter(f => f.is_active).length || 0} active flags
          </CardDescription>
        </CardHeader>
        <CardContent>
          {featureFlags && featureFlags.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Flag</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  {canEdit && <TableHead className="w-[100px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {featureFlags.map((flag) => (
                  <TableRow key={flag.id} data-testid={`row-flag-${flag.id}`}>
                    <TableCell>
                      <div>
                        <code className="font-mono text-sm font-medium">{flag.key}</code>
                        <p className="text-sm text-muted-foreground">{flag.name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getFlagTypeLabel(flag.flag_type)}
                        {flag.flag_type === 'percentage' && ` (${flag.rollout_percentage}%)`}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={flag.default_state ? 'default' : 'secondary'}>
                        {flag.default_state ? 'On' : 'Off'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {canEdit ? (
                        <Switch
                          checked={flag.is_active}
                          onCheckedChange={(checked) => toggleFlagMutation.mutate({ id: flag.id, is_active: checked })}
                          data-testid={`switch-toggle-${flag.id}`}
                        />
                      ) : (
                        <Badge variant={flag.is_active ? 'default' : 'secondary'}>
                          {flag.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(flag.updated_at), 'MMM d, yyyy')}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(flag)}
                            data-testid={`button-edit-${flag.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirm(flag.id)}
                            data-testid={`button-delete-${flag.id}`}
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
              <ToggleLeft className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No feature flags yet</p>
              {canEdit && <p className="text-sm mt-1">Create your first feature flag to control feature rollout</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingFlag} onOpenChange={(open) => !open && setEditingFlag(null)}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Feature Flag</DialogTitle>
              <DialogDescription>
                Update the feature flag settings
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-key">Key</Label>
                <Input
                  id="edit-key"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  data-testid="input-edit-key"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Display Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="input-edit-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  data-testid="input-edit-description"
                />
              </div>
              <div className="space-y-2">
                <Label>Flag Type</Label>
                <Select
                  value={formData.flag_type}
                  onValueChange={(v) => setFormData({ ...formData, flag_type: v as FeatureFlagForm['flag_type'] })}
                >
                  <SelectTrigger data-testid="select-edit-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boolean">Boolean (On/Off)</SelectItem>
                    <SelectItem value="percentage">Percentage Rollout</SelectItem>
                    <SelectItem value="allowlist">Allowlist (Specific Orgs)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.flag_type === 'percentage' && (
                <div className="space-y-2">
                  <Label>Rollout Percentage: {formData.rollout_percentage}%</Label>
                  <Slider
                    value={[formData.rollout_percentage]}
                    onValueChange={([v]) => setFormData({ ...formData, rollout_percentage: v })}
                    max={100}
                    step={5}
                    data-testid="slider-edit-rollout"
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-default">Default State (On)</Label>
                <Switch
                  id="edit-default"
                  checked={formData.default_state}
                  onCheckedChange={(checked) => setFormData({ ...formData, default_state: checked })}
                  data-testid="switch-edit-default"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-active">Active</Label>
                <Switch
                  id="edit-active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  data-testid="switch-edit-active"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingFlag(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isFormValid || updateMutation.isPending}
                data-testid="button-update-flag"
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Feature Flag</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this feature flag? This will also remove all organization overrides. This action cannot be undone.
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
