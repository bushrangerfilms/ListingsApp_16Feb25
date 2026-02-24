import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { adminApi, isCreditsRedacted } from '@/lib/admin/adminApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  TrendingUp,
  Users,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Coins,
  Clock,
  Tag,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { useSuperAdminPermissions } from '@/hooks/useSuperAdminPermissions';
import { useToast } from '@/hooks/use-toast';

export default function BillingDashboardPage() {
  const { hasPermission, userRole, hasSuperAdminAccess, loading: authLoading } = useSuperAdminPermissions();
  const isSuperAdmin = userRole === 'super_admin';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [grantCreditsOpen, setGrantCreditsOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');

  const { data: analytics, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin', 'analytics', 'overview'],
    queryFn: () => adminApi.analytics.getOverview(),
    staleTime: 60000,
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const { data: orgsData } = useQuery({
    queryKey: ['admin-organizations-list'],
    queryFn: () => adminApi.organizations.list({ pageSize: 100 }),
    staleTime: 60000,
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const grantCreditsMutation = useMutation({
    mutationFn: () => adminApi.credits.grant({
      organization_id: selectedOrgId,
      amount: parseFloat(creditAmount),
      reason: creditReason || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      setGrantCreditsOpen(false);
      setSelectedOrgId('');
      setCreditAmount('');
      setCreditReason('');
      toast({ title: 'Credits granted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to grant credits', description: error.message, variant: 'destructive' });
    },
  });

  const formatCurrency = (num: number | undefined) => {
    if (num === undefined) return '--';
    return new Intl.NumberFormat('en-IE', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  const creditsRedacted = isCreditsRedacted(analytics?.credits);
  const creditsData = !creditsRedacted && analytics?.credits 
    ? analytics.credits as { granted: number; used: number; balance: number } 
    : null;

  const stats = [
    {
      title: 'Total Organizations',
      value: analytics?.organizations?.total?.toString() ?? '-',
      description: 'All registered tenants',
      icon: Users,
      trend: analytics?.organizations ? `${analytics.organizations.active ?? 0} active, ${analytics.organizations.trial ?? 0} trial` : null,
    },
    {
      title: 'Active Users',
      value: analytics?.users?.total?.toString() ?? '-',
      description: 'Users across all orgs',
      icon: CheckCircle2,
      trend: analytics?.users ? `${analytics.users.admins ?? 0} admins` : null,
    },
    {
      title: 'Credit Balance',
      value: creditsRedacted ? 'Restricted' : formatCurrency(creditsData?.balance),
      description: creditsRedacted ? 'Revenue data restricted' : 'Platform-wide balance',
      icon: CreditCard,
      trend: creditsData ? `${formatCurrency(creditsData.granted ?? 0)} granted` : null,
      restricted: creditsRedacted,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Billing Dashboard</h1>
          <p className="text-muted-foreground">Revenue metrics and billing overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {!hasPermission('canAccessBilling') && (
            <Badge variant="secondary">View-only (limited permissions)</Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stat.restricted ? 'text-muted-foreground' : ''}`}>
                {isLoading ? '-' : stat.value}
              </div>
              {stat.description && (
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              )}
              {stat.trend && (
                <p className="text-xs text-muted-foreground mt-1">{stat.trend}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Credit Usage
          </CardTitle>
          <CardDescription>
            Platform credit consumption
          </CardDescription>
        </CardHeader>
        <CardContent>
          {creditsRedacted ? (
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Revenue Data Restricted</p>
                <p className="text-sm text-muted-foreground">
                  Credit tracking is only available to super admins.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm">Total Granted</span>
                <span className="font-medium">{formatCurrency(creditsData?.granted)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm">Total Used</span>
                <span className="font-medium">{formatCurrency(creditsData?.used)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm">Current Balance</span>
                <span className="font-bold text-lg">{formatCurrency(creditsData?.balance)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common billing operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-center gap-2"
              onClick={() => setGrantCreditsOpen(true)}
              disabled={!isSuperAdmin}
              data-testid="button-quick-grant-credits"
            >
              <Coins className="h-6 w-6" />
              <span className="font-medium">Grant Credits</span>
              <span className="text-xs text-muted-foreground">
                {isSuperAdmin ? 'Add credits to org' : 'Super admin only'}
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-center gap-2"
              onClick={() => navigate('/internal/organizations')}
              data-testid="button-quick-extend-trial"
            >
              <Clock className="h-6 w-6" />
              <span className="font-medium">Extend Trial</span>
              <span className="text-xs text-muted-foreground">Go to Organizations</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-center gap-2"
              onClick={() => navigate('/internal/discount-codes')}
              data-testid="button-quick-create-discount"
            >
              <Tag className="h-6 w-6" />
              <span className="font-medium">Create Discount</span>
              <span className="text-xs text-muted-foreground">Go to Discount Codes</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={grantCreditsOpen} onOpenChange={setGrantCreditsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Credits</DialogTitle>
            <DialogDescription>
              Add credits to an organization's balance
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Organization</Label>
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                <SelectTrigger data-testid="select-org">
                  <SelectValue placeholder="Select organization..." />
                </SelectTrigger>
                <SelectContent>
                  {orgsData?.organizations?.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.business_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount (EUR)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="100.00"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                data-testid="input-credit-amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Textarea
                placeholder="e.g., Promotional credit, compensation..."
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                rows={2}
                data-testid="input-credit-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantCreditsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const amount = parseFloat(creditAmount);
                if (isNaN(amount) || amount <= 0) {
                  toast({ title: 'Invalid amount', description: 'Please enter a valid positive number', variant: 'destructive' });
                  return;
                }
                grantCreditsMutation.mutate();
              }}
              disabled={!selectedOrgId || !creditAmount || grantCreditsMutation.isPending}
              data-testid="button-confirm-grant"
            >
              {grantCreditsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Grant Credits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
