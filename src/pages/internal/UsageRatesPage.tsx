import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, UsageRate, UsageRateInput } from '@/lib/admin/adminApi';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Loader2, Coins, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useSuperAdminPermissions } from '@/hooks/useSuperAdminPermissions';

interface UsageRateForm {
  feature_type: string;
  credits_per_use: number;
  description: string;
}

const initialFormState: UsageRateForm = {
  feature_type: '',
  credits_per_use: 1,
  description: '',
};

const FEATURE_TYPE_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: 'video_generation', label: 'Video Generation (Horizontal & Vertical)', hint: 'Generate both 16:9 and 9:16 video versions' },
  { value: 'post_generation', label: 'Platform Post (Generic)', hint: 'Generic social media post' },
  { value: 'social_post_facebook', label: 'Facebook Post', hint: 'Post to Facebook' },
  { value: 'social_post_instagram', label: 'Instagram Post', hint: 'Post to Instagram' },
  { value: 'social_post_tiktok', label: 'TikTok Post', hint: 'Post to TikTok' },
  { value: 'social_post_youtube', label: 'YouTube Post', hint: 'Post to YouTube' },
  { value: 'social_post_linkedin', label: 'LinkedIn Post', hint: 'Post to LinkedIn' },
  { value: 'image_enhancement', label: 'Image Enhancement', hint: 'Image enhancement or editing' },
  { value: 'ai_assistant', label: 'AI Assistant (Generic)', hint: 'AI assistant query or conversation' },
  { value: 'ai_chat_message', label: 'AI Chat Message', hint: 'Single AI chat message' },
  { value: 'ai_listing_extraction', label: 'AI Listing Extraction', hint: 'Extract property details from images/text' },
  { value: 'property_extraction', label: 'Property Extraction (Generic)', hint: 'Extract property details' },
  { value: 'email_send', label: 'Email Send', hint: 'Email sent through the platform' },
];

const FEATURE_TYPE_LABELS: Record<string, { label: string; hint: string }> = Object.fromEntries(
  FEATURE_TYPE_OPTIONS.map(opt => [opt.value, { label: opt.label, hint: opt.hint }])
);

export default function UsageRatesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole, hasSuperAdminAccess, loading: authLoading } = useSuperAdminPermissions();
  const isSuperAdmin = userRole === 'super_admin';

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<UsageRate | null>(null);
  const [formData, setFormData] = useState<UsageRateForm>(initialFormState);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: usageRates, isLoading, error } = useQuery({
    queryKey: ['admin-usage-rates'],
    queryFn: () => adminApi.usageRates.list(),
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const createMutation = useMutation({
    mutationFn: async (data: UsageRateForm) => {
      return adminApi.usageRates.create({
        feature_type: data.feature_type,
        credits_per_use: data.credits_per_use,
        description: data.description || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-usage-rates'] });
      setIsCreateOpen(false);
      setFormData(initialFormState);
      toast({ title: 'Usage rate created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create usage rate', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ featureType, data }: { featureType: string; data: UsageRateForm }) => {
      return adminApi.usageRates.update(featureType, {
        credits_per_use: data.credits_per_use,
        description: data.description || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-usage-rates'] });
      setEditingRate(null);
      setFormData(initialFormState);
      toast({ title: 'Usage rate updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update usage rate', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (featureType: string) => {
      return adminApi.usageRates.delete(featureType);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-usage-rates'] });
      setDeleteConfirm(null);
      toast({ title: 'Usage rate deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete usage rate', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRate) {
      updateMutation.mutate({ featureType: editingRate.feature_type, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEditDialog = (rate: UsageRate) => {
    setFormData({
      feature_type: rate.feature_type,
      credits_per_use: rate.credits_per_use,
      description: rate.description || '',
    });
    setEditingRate(rate);
  };

  const getFeatureLabel = (featureType: string) => {
    return FEATURE_TYPE_LABELS[featureType]?.label || featureType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const getFeatureHint = (featureType: string) => {
    return FEATURE_TYPE_LABELS[featureType]?.hint || '';
  };

  const calculateEuroCost = (credits: number) => {
    return (credits * 0.25).toFixed(2);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasSuperAdminAccess) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">You do not have permission to view this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Coins className="h-8 w-8" />
            Usage Rates
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure credit costs for features across both CRM and Socials apps
          </p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-usage-rate">
            <Plus className="h-4 w-4 mr-2" />
            Add Usage Rate
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pricing Note</CardTitle>
          <CardDescription>
            At the current lowest pack price of €0.25 per credit, costs shown below are approximate Euro values.
            Changes apply immediately to both AutoListing.io and the Socials app.
          </CardDescription>
        </CardHeader>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Error loading usage rates: {(error as Error).message}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Active Usage Rates</CardTitle>
            <CardDescription>
              {usageRates?.length || 0} feature types configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead className="text-right">~Euro Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageRates?.map((rate) => (
                  <TableRow key={rate.feature_type} data-testid={`row-usage-rate-${rate.feature_type}`}>
                    <TableCell className="font-medium">
                      {getFeatureLabel(rate.feature_type)}
                      <p className="text-xs text-muted-foreground mt-1">
                        {rate.feature_type}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm text-muted-foreground truncate">
                        {rate.description || getFeatureHint(rate.feature_type) || '-'}
                      </p>
                    </TableCell>
                    <TableCell className="text-right font-mono text-lg">
                      {rate.credits_per_use}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      €{calculateEuroCost(rate.credits_per_use)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rate.is_active ? 'default' : 'secondary'}>
                        {rate.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {rate.updated_at ? format(new Date(rate.updated_at), 'dd MMM yyyy') : '-'}
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditDialog(rate)}
                            data-testid={`button-edit-rate-${rate.feature_type}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteConfirm(rate.feature_type)}
                            data-testid={`button-delete-rate-${rate.feature_type}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {(!usageRates || usageRates.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No usage rates configured. Click "Add Usage Rate" to create one.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={isCreateOpen || !!editingRate} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setEditingRate(null);
          setFormData(initialFormState);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRate ? 'Edit Usage Rate' : 'Create Usage Rate'}</DialogTitle>
            <DialogDescription>
              {editingRate 
                ? 'Update the credit cost for this feature type.'
                : 'Add a new feature type with its credit cost.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editingRate && (
              <div className="space-y-2">
                <Label htmlFor="feature_type">Feature Type</Label>
                <Select
                  value={formData.feature_type}
                  onValueChange={(value) => setFormData({ ...formData, feature_type: value })}
                >
                  <SelectTrigger data-testid="select-feature-type">
                    <SelectValue placeholder="Select a feature type" />
                  </SelectTrigger>
                  <SelectContent>
                    {FEATURE_TYPE_OPTIONS.filter(opt => 
                      !usageRates?.some(r => r.feature_type === opt.value)
                    ).map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.feature_type && FEATURE_TYPE_LABELS[formData.feature_type] && (
                  <p className="text-xs text-muted-foreground">
                    {FEATURE_TYPE_LABELS[formData.feature_type].hint}
                  </p>
                )}
              </div>
            )}
            {editingRate && (
              <div className="space-y-2">
                <Label>Feature Type</Label>
                <p className="font-medium">{getFeatureLabel(editingRate.feature_type)}</p>
                <p className="text-xs text-muted-foreground">{editingRate.feature_type}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="credits_per_use">Credits Per Use</Label>
              <Input
                id="credits_per_use"
                type="number"
                min="0"
                step="0.5"
                value={formData.credits_per_use}
                onChange={(e) => setFormData({ ...formData, credits_per_use: parseFloat(e.target.value) || 0 })}
                required
                data-testid="input-credits-per-use"
              />
              <p className="text-xs text-muted-foreground">
                Approximate cost: €{calculateEuroCost(formData.credits_per_use)} at €0.25/credit
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What does this feature charge for?"
                rows={3}
                data-testid="input-description"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingRate(null);
                  setFormData(initialFormState);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit-usage-rate"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                {editingRate ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Usage Rate
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the usage rate for "{deleteConfirm}"? 
              This will affect credit consumption for both apps.
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
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
