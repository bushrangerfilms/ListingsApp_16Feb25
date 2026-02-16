import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, AlertRule, AlertHistory, AlertRuleInput } from '@/lib/admin/adminApi';
import { useSuperAdminPermissions } from '@/hooks/useSuperAdminPermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Plus, 
  Bell,
  BellOff,
  MoreVertical,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  TrendingDown,
  TrendingUp,
  Users,
  CreditCard,
  Building2,
  PlayCircle
} from 'lucide-react';
import { format } from 'date-fns';

const METRIC_TYPES = [
  { value: 'new_signups', label: 'New Signups', icon: Users, description: 'Number of new organization signups' },
  { value: 'churned_orgs', label: 'Churned Organizations', icon: TrendingDown, description: 'Organizations that cancelled' },
  { value: 'credit_usage', label: 'Credit Usage', icon: CreditCard, description: 'Total credits consumed' },
  { value: 'failed_payments', label: 'Failed Payments', icon: AlertTriangle, description: 'Payment failures count' },
  { value: 'active_trials', label: 'Active Trials', icon: Clock, description: 'Organizations in trial period' },
  { value: 'expiring_trials', label: 'Expiring Trials', icon: TrendingDown, description: 'Trials expiring in 3 days' },
  { value: 'low_credit_orgs', label: 'Low Credit Orgs', icon: CreditCard, description: 'Orgs with credits below threshold' },
  { value: 'api_errors', label: 'API Errors', icon: AlertTriangle, description: 'API error rate percentage' },
];

const CONDITION_OPTIONS = [
  { value: 'gt', label: 'Greater than', symbol: '>' },
  { value: 'gte', label: 'Greater than or equal', symbol: '>=' },
  { value: 'lt', label: 'Less than', symbol: '<' },
  { value: 'lte', label: 'Less than or equal', symbol: '<=' },
  { value: 'eq', label: 'Equal to', symbol: '=' },
];

const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'slack', label: 'Slack' },
];

export default function AlertsPage() {
  const { hasPermission, isSuperAdmin, hasSuperAdminAccess, loading: authLoading } = useSuperAdminPermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<AlertRule | null>(null);

  const [formData, setFormData] = useState<AlertRuleInput>({
    name: '',
    description: '',
    metric_type: 'new_signups',
    condition: 'gt',
    threshold: 0,
    time_window_minutes: 60,
    notification_channels: ['email'],
    is_enabled: true,
  });

  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ['admin-alert-rules'],
    queryFn: () => adminApi.alerts.list(),
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['admin-alert-history'],
    queryFn: () => adminApi.alerts.getHistory(50),
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const createMutation = useMutation({
    mutationFn: (data: AlertRuleInput) => adminApi.alerts.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-alert-rules'] });
      setDialogOpen(false);
      resetForm();
      toast({ title: 'Alert rule created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create alert rule', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AlertRuleInput> }) => 
      adminApi.alerts.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-alert-rules'] });
      setDialogOpen(false);
      setEditingRule(null);
      resetForm();
      toast({ title: 'Alert rule updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update alert rule', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.alerts.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-alert-rules'] });
      setDeleteConfirmOpen(false);
      setRuleToDelete(null);
      toast({ title: 'Alert rule deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete alert rule', description: error.message, variant: 'destructive' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      adminApi.alerts.update(id, { is_enabled: enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-alert-rules'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to toggle alert', description: error.message, variant: 'destructive' });
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => adminApi.alerts.test(id),
    onSuccess: () => {
      toast({ title: 'Test alert sent successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to send test alert', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      metric_type: 'new_signups',
      condition: 'gt',
      threshold: 0,
      time_window_minutes: 60,
      notification_channels: ['email'],
      is_enabled: true,
    });
  };

  const openCreateDialog = () => {
    setEditingRule(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (rule: AlertRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      metric_type: rule.metric_type,
      condition: rule.condition,
      threshold: rule.threshold,
      time_window_minutes: rule.time_window_minutes,
      notification_channels: rule.notification_channels,
      is_enabled: rule.is_enabled,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.metric_type) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleChannelToggle = (channel: string) => {
    const current = formData.notification_channels || [];
    if (current.includes(channel)) {
      setFormData({ ...formData, notification_channels: current.filter(c => c !== channel) });
    } else {
      setFormData({ ...formData, notification_channels: [...current, channel] });
    }
  };

  const getMetricIcon = (metricType: string) => {
    const metric = METRIC_TYPES.find(m => m.value === metricType);
    return metric?.icon || Activity;
  };

  const getConditionSymbol = (condition: string) => {
    return CONDITION_OPTIONS.find(c => c.value === condition)?.symbol || condition;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (rulesLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-alerts-title">Alert Configuration</h1>
          <p className="text-muted-foreground">Configure automated alerts for platform events</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={openCreateDialog} data-testid="button-create-alert">
            <Plus className="h-4 w-4 mr-2" />
            Create Alert Rule
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rules</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-rules">{rules?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-rules">
              {rules?.filter(r => r.is_enabled).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alerts Today</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-alerts-today">
              {history?.filter(h => {
                const today = new Date();
                const alertDate = new Date(h.triggered_at);
                return alertDate.toDateString() === today.toDateString();
              }).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-failed-alerts">
              {history?.filter(h => h.notification_status === 'failed').length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules" data-testid="tab-rules">Alert Rules</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">Alert History</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alert Rules</CardTitle>
              <CardDescription>Manage automated alert triggers for platform monitoring</CardDescription>
            </CardHeader>
            <CardContent>
              {rules && rules.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Metric</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Channels</TableHead>
                      <TableHead>Window</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => {
                      const MetricIcon = getMetricIcon(rule.metric_type);
                      return (
                        <TableRow key={rule.id} data-testid={`row-alert-rule-${rule.id}`}>
                          <TableCell>
                            <Switch
                              checked={rule.is_enabled}
                              onCheckedChange={(checked) => toggleMutation.mutate({ id: rule.id, enabled: checked })}
                              disabled={!isSuperAdmin || toggleMutation.isPending}
                              data-testid={`switch-rule-enabled-${rule.id}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{rule.name}</div>
                            {rule.description && (
                              <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                                {rule.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MetricIcon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">
                                {METRIC_TYPES.find(m => m.value === rule.metric_type)?.label || rule.metric_type}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getConditionSymbol(rule.condition)} {rule.threshold}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {rule.notification_channels.map(channel => (
                                <Badge key={channel} variant="secondary" className="text-xs">
                                  {channel}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {rule.time_window_minutes}m
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`button-rule-actions-${rule.id}`}>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem 
                                  onClick={() => testMutation.mutate(rule.id)}
                                  disabled={testMutation.isPending}
                                  data-testid={`button-test-rule-${rule.id}`}
                                >
                                  <PlayCircle className="h-4 w-4 mr-2" />
                                  Test Alert
                                </DropdownMenuItem>
                                {isSuperAdmin && (
                                  <>
                                    <DropdownMenuItem 
                                      onClick={() => openEditDialog(rule)}
                                      data-testid={`button-edit-rule-${rule.id}`}
                                    >
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => { setRuleToDelete(rule); setDeleteConfirmOpen(true); }}
                                      className="text-destructive"
                                      data-testid={`button-delete-rule-${rule.id}`}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <BellOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No alert rules configured yet.</p>
                  {isSuperAdmin && (
                    <Button variant="outline" className="mt-4" onClick={openCreateDialog}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create your first alert rule
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alert History</CardTitle>
              <CardDescription>Recent alert notifications and their delivery status</CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : history && history.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Rule</TableHead>
                      <TableHead>Metric</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Threshold</TableHead>
                      <TableHead>Channels</TableHead>
                      <TableHead>Triggered At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((entry) => (
                      <TableRow key={entry.id} data-testid={`row-alert-history-${entry.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(entry.notification_status)}
                            <span className="text-sm capitalize">{entry.notification_status}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{entry.rule_name}</TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {METRIC_TYPES.find(m => m.value === entry.metric_type)?.label || entry.metric_type}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{entry.metric_value}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {getConditionSymbol(entry.condition)} {entry.threshold}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {(entry.notification_channels || []).map(channel => (
                              <Badge key={channel} variant="secondary" className="text-xs">
                                {channel}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(entry.triggered_at), 'MMM d, HH:mm')}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No alerts have been triggered yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Alert Rule' : 'Create Alert Rule'}</DialogTitle>
            <DialogDescription>
              Configure when and how you want to be notified about platform events.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Rule Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., High Churn Alert"
                data-testid="input-rule-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description of this alert rule"
                data-testid="input-rule-description"
              />
            </div>

            <div className="space-y-2">
              <Label>Metric Type *</Label>
              <Select
                value={formData.metric_type}
                onValueChange={(value) => setFormData({ ...formData, metric_type: value })}
              >
                <SelectTrigger data-testid="select-metric-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRIC_TYPES.map((metric) => (
                    <SelectItem key={metric.value} value={metric.value}>
                      <div className="flex items-center gap-2">
                        <metric.icon className="h-4 w-4" />
                        <span>{metric.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {METRIC_TYPES.find(m => m.value === formData.metric_type)?.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select
                  value={formData.condition}
                  onValueChange={(value) => setFormData({ ...formData, condition: value })}
                >
                  <SelectTrigger data-testid="select-condition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPTIONS.map((cond) => (
                      <SelectItem key={cond.value} value={cond.value}>
                        {cond.symbol} {cond.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="threshold">Threshold</Label>
                <Input
                  id="threshold"
                  type="number"
                  value={formData.threshold}
                  onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) || 0 })}
                  data-testid="input-threshold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time_window">Time Window (minutes)</Label>
              <Input
                id="time_window"
                type="number"
                value={formData.time_window_minutes}
                onChange={(e) => setFormData({ ...formData, time_window_minutes: parseInt(e.target.value) || 60 })}
                data-testid="input-time-window"
              />
              <p className="text-xs text-muted-foreground">
                How far back to look when evaluating the metric
              </p>
            </div>

            <div className="space-y-2">
              <Label>Notification Channels</Label>
              <div className="flex gap-4">
                {CHANNEL_OPTIONS.map((channel) => (
                  <label key={channel.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.notification_channels?.includes(channel.value)}
                      onChange={() => handleChannelToggle(channel.value)}
                      className="rounded"
                      data-testid={`checkbox-channel-${channel.value}`}
                    />
                    <span className="text-sm">{channel.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, is_enabled: checked })}
                id="is_enabled"
                data-testid="switch-rule-enabled"
              />
              <Label htmlFor="is_enabled">Enable this rule immediately</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-rule"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingRule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Alert Rule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{ruleToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => ruleToDelete && deleteMutation.mutate(ruleToDelete.id)}
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
