import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, DiscountCode } from '@/lib/admin/adminApi';
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
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Copy, Loader2, AlertCircle, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { useSuperAdminPermissions } from '@/hooks/useSuperAdminPermissions';

interface DiscountCodeForm {
  code: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: string;
  max_uses: string;
  max_uses_per_org: string;
  valid_until: string;
  applicable_plans: string[];
  min_months: string;
  is_active: boolean;
}

const initialFormState: DiscountCodeForm = {
  code: '',
  description: '',
  discount_type: 'percentage',
  discount_value: '',
  max_uses: '',
  max_uses_per_org: '1',
  valid_until: '',
  applicable_plans: [],
  min_months: '1',
  is_active: true,
};

export default function DiscountCodesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole, hasSuperAdminAccess, loading: authLoading } = useSuperAdminPermissions();
  const canEdit = userRole === 'super_admin';

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);
  const [formData, setFormData] = useState<DiscountCodeForm>(initialFormState);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: discountCodes, isLoading, error } = useQuery({
    queryKey: ['admin-discount-codes'],
    queryFn: () => adminApi.discounts.list(),
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const createMutation = useMutation({
    mutationFn: async (data: DiscountCodeForm) => {
      return adminApi.discounts.create({
        code: data.code.toUpperCase(),
        description: data.description || undefined,
        discount_type: data.discount_type,
        discount_value: parseFloat(data.discount_value),
        max_uses: data.max_uses ? parseInt(data.max_uses) : undefined,
        max_uses_per_org: parseInt(data.max_uses_per_org) || 1,
        valid_until: data.valid_until || undefined,
        applicable_plans: data.applicable_plans.length > 0 ? data.applicable_plans : undefined,
        min_months: parseInt(data.min_months) || 1,
        is_active: data.is_active,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-discount-codes'] });
      setIsCreateOpen(false);
      setFormData(initialFormState);
      toast({ title: 'Discount code created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create discount code', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: DiscountCodeForm }) => {
      return adminApi.discounts.update(id, {
        code: data.code.toUpperCase(),
        description: data.description || undefined,
        discount_type: data.discount_type,
        discount_value: parseFloat(data.discount_value),
        max_uses: data.max_uses ? parseInt(data.max_uses) : undefined,
        max_uses_per_org: parseInt(data.max_uses_per_org) || 1,
        valid_until: data.valid_until || undefined,
        applicable_plans: data.applicable_plans.length > 0 ? data.applicable_plans : undefined,
        min_months: parseInt(data.min_months) || 1,
        is_active: data.is_active,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-discount-codes'] });
      setEditingCode(null);
      setFormData(initialFormState);
      toast({ title: 'Discount code updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update discount code', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return adminApi.discounts.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-discount-codes'] });
      setDeleteConfirm(null);
      toast({ title: 'Discount code deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete discount code', description: error.message, variant: 'destructive' });
    },
  });

  const handleEdit = (code: DiscountCode) => {
    setEditingCode(code);
    setFormData({
      code: code.code,
      description: code.description || '',
      discount_type: code.discount_type,
      discount_value: code.discount_value.toString(),
      max_uses: code.max_uses?.toString() || '',
      max_uses_per_org: code.max_uses_per_org.toString(),
      valid_until: code.valid_until ? code.valid_until.split('T')[0] : '',
      applicable_plans: code.applicable_plans || [],
      min_months: code.min_months.toString(),
      is_active: code.is_active,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCode) {
      updateMutation.mutate({ id: editingCode.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: 'Code copied to clipboard' });
  };

  const isFormValid = formData.code && formData.discount_value && parseFloat(formData.discount_value) > 0;

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
            <span>Failed to load discount codes: {(error as Error).message}</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Discount Codes</h1>
          <p className="text-muted-foreground">Manage promotional discount codes</p>
        </div>
        {canEdit && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-discount">
                <Plus className="h-4 w-4 mr-2" />
                Create Code
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Create Discount Code</DialogTitle>
                  <DialogDescription>
                    Create a new promotional discount code
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Code</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="SUMMER2024"
                      data-testid="input-discount-code"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Summer promotion for new customers"
                      data-testid="input-discount-description"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={formData.discount_type}
                        onValueChange={(v) => setFormData({ ...formData, discount_type: v as 'percentage' | 'fixed' })}
                      >
                        <SelectTrigger data-testid="select-discount-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="value">Value</Label>
                      <Input
                        id="value"
                        type="number"
                        value={formData.discount_value}
                        onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                        placeholder={formData.discount_type === 'percentage' ? '20' : '10.00'}
                        data-testid="input-discount-value"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="max_uses">Max Uses (Total)</Label>
                      <Input
                        id="max_uses"
                        type="number"
                        value={formData.max_uses}
                        onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                        placeholder="Unlimited"
                        data-testid="input-max-uses"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_uses_per_org">Max Per Org</Label>
                      <Input
                        id="max_uses_per_org"
                        type="number"
                        value={formData.max_uses_per_org}
                        onChange={(e) => setFormData({ ...formData, max_uses_per_org: e.target.value })}
                        data-testid="input-max-per-org"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="valid_until">Valid Until</Label>
                    <Input
                      id="valid_until"
                      type="date"
                      value={formData.valid_until}
                      onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                      data-testid="input-valid-until"
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
                    data-testid="button-submit-discount"
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

      {!canEdit && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              You have read-only access to discount codes. Contact a super admin to make changes.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Active Codes ({discountCodes?.filter(c => c.is_active).length || 0})
          </CardTitle>
          <CardDescription>
            {discountCodes?.length || 0} total discount codes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {discountCodes && discountCodes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit && <TableHead className="w-[100px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {discountCodes.map((code) => (
                  <TableRow key={code.id} data-testid={`row-discount-${code.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-medium">{code.code}</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyCode(code.code)}
                          data-testid={`button-copy-${code.id}`}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      {code.description && (
                        <p className="text-xs text-muted-foreground mt-1">{code.description}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {code.discount_type === 'percentage' 
                          ? `${code.discount_value}%` 
                          : `${code.currency} ${code.discount_value.toFixed(2)}`}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {code.current_uses} / {code.max_uses || 'unlimited'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {code.valid_until 
                        ? format(new Date(code.valid_until), 'MMM d, yyyy')
                        : 'No expiry'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={code.is_active ? 'default' : 'secondary'}>
                        {code.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(code)}
                            data-testid={`button-edit-${code.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirm(code.id)}
                            data-testid={`button-delete-${code.id}`}
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
              <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No discount codes yet</p>
              {canEdit && <p className="text-sm mt-1">Create your first discount code to get started</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingCode} onOpenChange={(open) => !open && setEditingCode(null)}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Discount Code</DialogTitle>
              <DialogDescription>
                Update the discount code settings
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-code">Code</Label>
                <Input
                  id="edit-code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  data-testid="input-edit-code"
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={formData.discount_type}
                    onValueChange={(v) => setFormData({ ...formData, discount_type: v as 'percentage' | 'fixed' })}
                  >
                    <SelectTrigger data-testid="select-edit-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-value">Value</Label>
                  <Input
                    id="edit-value"
                    type="number"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                    data-testid="input-edit-value"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-valid-until">Valid Until</Label>
                <Input
                  id="edit-valid-until"
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  data-testid="input-edit-valid-until"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-is-active">Active</Label>
                <Switch
                  id="edit-is-active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  data-testid="switch-edit-active"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingCode(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isFormValid || updateMutation.isPending}
                data-testid="button-update-discount"
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
            <DialogTitle>Delete Discount Code</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this discount code? This action cannot be undone.
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
