import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adminApi,
  isOrgCreditsRedacted,
  OrganizationCreditsResponse,
  BillingOverride,
  PlanDefinition,
} from '@/lib/admin/adminApi';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_LOCALE } from '@/lib/locale/config';
import { useSuperAdminPermissions } from '@/hooks/useSuperAdminPermissions';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  Calendar,
  Users,
  Home,
  Coins,
  Eye,
  Loader2,
  TrendingUp,
  TrendingDown,
  CreditCard,
  ArrowUpRight,
  ArrowUpCircle,
  Gift,
  Languages,
  ShieldCheck,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { OrganizationLocaleSelector } from './OrganizationLocaleSelector';

interface OrganizationDetailDrawerProps {
  organizationId: string | null;
  open: boolean;
  onClose: () => void;
}

interface OverrideFormState {
  type: 'pilot' | 'comp';
  plan_equivalent: string;
  notes: string;
  price_weekly_cents: string;
  currency: string;
  expires_at: string;
}

const EMPTY_OVERRIDE_FORM: OverrideFormState = {
  type: 'comp',
  plan_equivalent: 'professional',
  notes: '',
  price_weekly_cents: '',
  currency: '',
  expires_at: '',
};

function accountStatusClass(status: string | null | undefined): string {
  switch (status) {
    case 'active':
      return 'text-green-600 dark:text-green-400';
    case 'free':
      return 'text-slate-600 dark:text-slate-300';
    case 'trial':
      return 'text-blue-600 dark:text-blue-400';
    case 'trial_expired':
      return 'text-orange-600 dark:text-orange-400';
    case 'payment_failed':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-muted-foreground';
  }
}

function formatCents(cents: number | null | undefined, currency: string | null | undefined): string {
  if (cents == null || cents <= 0) return 'Free';
  const amount = cents / 100;
  const cur = (currency || 'EUR').toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount.toFixed(0)} ${cur}`;
  }
}

export function OrganizationDetailDrawer({
  organizationId,
  open,
  onClose,
}: OrganizationDetailDrawerProps) {
  const navigate = useNavigate();
  const { startImpersonation } = useAuth();
  const { hasPermission, isSuperAdmin } = useSuperAdminPermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('overview');
  const [grantCreditsOpen, setGrantCreditsOpen] = useState(false);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [billingOverrideOpen, setBillingOverrideOpen] = useState(false);
  const [regionSettingsOpen, setRegionSettingsOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [overrideForm, setOverrideForm] = useState<OverrideFormState>(EMPTY_OVERRIDE_FORM);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');

  const canGrantCredits = hasPermission('canGrantCredits');
  const canImpersonate = hasPermission('canImpersonateUsers');

  const { data: orgDetail, isLoading } = useQuery({
    queryKey: ['admin-organization-detail', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      return adminApi.organizations.getDetail(organizationId);
    },
    enabled: !!organizationId,
  });

  const { data: plansData } = useQuery({
    queryKey: ['admin-plan-definitions'],
    queryFn: () => adminApi.plans.list(),
    enabled: open && isSuperAdmin,
  });

  const org = orgDetail?.organization;
  const stats = orgDetail?.stats;
  const users = orgDetail?.users || [];
  const planSummary = orgDetail?.plan_summary;
  const billingOverride: BillingOverride | null = org?.billing_override ?? null;
  const hasOverride = !!billingOverride;
  const plans: PlanDefinition[] = plansData?.plans || [];

  const { data: creditsData, isLoading: creditsLoading } = useQuery({
    queryKey: ['admin-organization-credits', organizationId],
    queryFn: () => organizationId ? adminApi.organizations.getCredits(organizationId) : null,
    enabled: !!organizationId && activeTab === 'credits',
  });

  const credits = !isOrgCreditsRedacted(creditsData) ? creditsData as OrganizationCreditsResponse : null;
  const creditsRedacted = isOrgCreditsRedacted(creditsData);

  const grantCreditsMutation = useMutation({
    mutationFn: async ({ amount, reason }: { amount: number; reason: string }) => {
      if (!organizationId) throw new Error('Missing organization ID');
      return adminApi.credits.grant({
        organization_id: organizationId,
        amount,
        reason: reason || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-organization-detail', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['admin-organization-credits', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      setGrantCreditsOpen(false);
      setCreditAmount('');
      setCreditReason('');
      toast({ title: 'Credits granted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to grant credits', description: error.message, variant: 'destructive' });
    },
  });

  const changePlanMutation = useMutation({
    mutationFn: async (plan: string) => {
      if (!organizationId) throw new Error('Missing organization ID');
      return adminApi.organizations.changePlan(organizationId, plan);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-organization-detail', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      setChangePlanOpen(false);
      setSelectedPlan('');
      toast({ title: 'Plan updated', description: `Now on ${result.new_plan}` });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update plan', description: error.message, variant: 'destructive' });
    },
  });

  const setOverrideMutation = useMutation({
    mutationFn: async (override: BillingOverride | null) => {
      if (!organizationId) throw new Error('Missing organization ID');
      return adminApi.organizations.setBillingOverride(organizationId, override);
    },
    onSuccess: (_, override) => {
      queryClient.invalidateQueries({ queryKey: ['admin-organization-detail', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['comped-organizations'] });
      setBillingOverrideOpen(false);
      toast({
        title: override ? 'Billing override saved' : 'Billing override cleared',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update billing override', description: error.message, variant: 'destructive' });
    },
  });

  useEffect(() => {
    if (!billingOverrideOpen) return;
    if (billingOverride) {
      setOverrideForm({
        type: (billingOverride.type as 'pilot' | 'comp') ?? 'comp',
        plan_equivalent: billingOverride.plan_equivalent ?? 'professional',
        notes: billingOverride.notes ?? '',
        price_weekly_cents: billingOverride.price_weekly_cents != null ? String(billingOverride.price_weekly_cents) : '',
        currency: billingOverride.currency ?? '',
        expires_at: billingOverride.expires_at ?? '',
      });
    } else {
      setOverrideForm(EMPTY_OVERRIDE_FORM);
    }
  }, [billingOverrideOpen, billingOverride]);

  const handleImpersonate = async () => {
    if (!organizationId) return;
    try {
      await startImpersonation(organizationId, 'Admin portal access');
      onClose();
      toast({ title: 'Impersonation started', description: `Now viewing as ${org?.business_name}` });
      navigate('/admin/listings');
    } catch (error) {
      toast({ title: 'Failed to start impersonation', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const currentPlan = org?.current_plan_name || planSummary?.effective_plan_name || 'free';
  const currentPlanDisplay = planSummary?.plan_display_name || currentPlan;

  const usageRows = useMemo(() => {
    if (!planSummary) return [];
    const rows: Array<{ label: string; used?: number; max: number | null; suffix?: string }> = [
      { label: 'Listings', used: planSummary.listing_count ?? 0, max: planSummary.max_listings },
      { label: 'Social hubs', used: planSummary.hub_count ?? 0, max: planSummary.max_social_hubs },
      { label: 'Posts / listing / week', max: planSummary.max_posts_per_listing_per_week },
      { label: 'Lead magnets / week', max: planSummary.max_lead_magnets_per_week },
      { label: 'Team members', max: planSummary.max_users },
    ];
    return rows;
  }, [planSummary]);

  const submitOverride = () => {
    const payload: BillingOverride = {
      type: overrideForm.type,
      plan_equivalent: overrideForm.plan_equivalent || null,
      notes: overrideForm.notes || null,
      price_weekly_cents: overrideForm.price_weekly_cents ? parseInt(overrideForm.price_weekly_cents, 10) : null,
      currency: overrideForm.currency ? overrideForm.currency.toLowerCase() : null,
      expires_at: overrideForm.expires_at || null,
    };
    setOverrideMutation.mutate(payload);
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            {org?.logo_url ? (
              <img
                src={org.logo_url}
                alt={org.business_name}
                className="h-10 w-10 rounded object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                <Building2 className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <div>{org?.business_name || 'Loading...'}</div>
              {org?.slug && (
                <code className="text-xs font-normal text-muted-foreground">{org.slug}</code>
              )}
            </div>
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : org ? (
          <div className="mt-6 space-y-4">
            <div className="flex gap-2 flex-wrap items-center">
              <Badge variant={org.is_active ? 'default' : 'secondary'}>
                {org.is_active ? 'Active' : 'Inactive'}
              </Badge>
              <Badge variant="outline" className="gap-1" data-testid="badge-plan">
                {currentPlanDisplay}
              </Badge>
              {planSummary?.account_status && (
                <Badge
                  variant="secondary"
                  className={accountStatusClass(planSummary.account_status)}
                >
                  {planSummary.account_status.replace('_', ' ')}
                </Badge>
              )}
              {hasOverride && (
                <Badge variant="secondary" className="gap-1 text-purple-600 dark:text-purple-400" data-testid="badge-override">
                  <Gift className="h-3 w-3" />
                  Comped ({billingOverride?.type})
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground">Quick Actions</h3>
              <div className="flex flex-wrap gap-2">
                {canImpersonate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleImpersonate}
                    data-testid="button-impersonate-org"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View As
                  </Button>
                )}
                {isSuperAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedPlan(currentPlan);
                      setChangePlanOpen(true);
                    }}
                    data-testid="button-change-plan"
                  >
                    <ArrowUpCircle className="h-4 w-4 mr-2" />
                    Change Plan
                  </Button>
                )}
                {isSuperAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBillingOverrideOpen(true)}
                    data-testid="button-comp-override"
                  >
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    {hasOverride ? 'Manage Comp' : 'Set Comp'}
                  </Button>
                )}
                {isSuperAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRegionSettingsOpen(true)}
                    data-testid="button-region-settings"
                  >
                    <Languages className="h-4 w-4 mr-2" />
                    Region
                  </Button>
                )}
                {canGrantCredits && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setGrantCreditsOpen(true)}
                    data-testid="button-grant-credits"
                  >
                    <Coins className="h-4 w-4 mr-2" />
                    Grant Credits
                  </Button>
                )}
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="credits" data-testid="tab-credits">
                  <Coins className="h-4 w-4 mr-1" />
                  Credits
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-muted rounded-lg p-3 text-center">
                    <Users className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                    <div className="text-2xl font-semibold">{stats?.users ?? '-'}</div>
                    <div className="text-xs text-muted-foreground">Users</div>
                  </div>
                  <div className="bg-muted rounded-lg p-3 text-center">
                    <Home className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                    <div className="text-2xl font-semibold">{stats?.listings ?? '-'}</div>
                    <div className="text-xs text-muted-foreground">Listings</div>
                  </div>
                  <div className="bg-muted rounded-lg p-3 text-center">
                    <Home className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                    <div className="text-2xl font-semibold">{stats?.activeListings ?? '-'}</div>
                    <div className="text-xs text-muted-foreground">Active</div>
                  </div>
                </div>

                {isSuperAdmin && (
                  <Card>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-sm">Plan & Billing</h3>
                          <p className="text-xs text-muted-foreground">
                            Current tier and billing override state
                          </p>
                        </div>
                        <Badge variant="outline">{currentPlanDisplay}</Badge>
                      </div>
                      {hasOverride && billingOverride && (
                        <div className="rounded-md border border-purple-500/30 bg-purple-500/5 p-3 text-xs space-y-1">
                          <div className="flex items-center gap-2 font-medium text-purple-700 dark:text-purple-300">
                            <Gift className="h-3 w-3" />
                            Billing override active ({billingOverride.type})
                          </div>
                          {billingOverride.plan_equivalent && (
                            <div>
                              Plan equivalent: <span className="font-medium">{billingOverride.plan_equivalent}</span>
                            </div>
                          )}
                          {billingOverride.price_weekly_cents != null && (
                            <div>
                              Price / week: <span className="font-medium">
                                {formatCents(billingOverride.price_weekly_cents, billingOverride.currency)}
                              </span>
                            </div>
                          )}
                          {billingOverride.expires_at && (
                            <div>
                              Expires: <span className="font-medium">{format(new Date(billingOverride.expires_at), 'PPP')}</span>
                            </div>
                          )}
                          {billingOverride.notes && (
                            <div className="text-muted-foreground">{billingOverride.notes}</div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {planSummary && (
                  <Card>
                    <CardContent className="pt-4 space-y-2">
                      <h3 className="font-medium text-sm">Plan Usage</h3>
                      <div className="space-y-1 text-sm">
                        {usageRows.map((row) => (
                          <div key={row.label} className="flex items-center justify-between">
                            <span className="text-muted-foreground">{row.label}</span>
                            <span className="font-medium">
                              {row.used != null ? `${row.used} / ` : ''}
                              {row.max == null ? '—' : row.max === -1 ? 'Unlimited' : row.max}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-medium">Contact Information</h3>
                  <div className="space-y-3 text-sm">
                    {org.contact_name && (
                      <div className="flex items-center gap-3">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{org.contact_name}</span>
                      </div>
                    )}
                    {org.contact_email && (
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${org.contact_email}`} className="text-primary hover:underline">
                          {org.contact_email}
                        </a>
                      </div>
                    )}
                    {org.contact_phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{org.contact_phone}</span>
                      </div>
                    )}
                    {org.business_address && (
                      <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span>{org.business_address}</span>
                      </div>
                    )}
                    {org.domain && (
                      <div className="flex items-center gap-3">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={`https://${org.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {org.domain}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-medium">Team Members</h3>
                  {users && users.length > 0 ? (
                    <div className="space-y-2">
                      {users.map((u) => (
                        <div
                          key={u.user_id}
                          className="flex items-center justify-between text-sm bg-muted rounded-lg px-3 py-2"
                        >
                          <code className="text-xs">{u.user_id.slice(0, 8)}...</code>
                          <Badge variant="outline" className="text-xs">
                            {u.role}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No team members</p>
                  )}
                </div>

                <Separator />

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {org.created_at ? format(new Date(org.created_at), 'PPP') : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Last Updated</span>
                    <span>
                      {org.updated_at ? format(new Date(org.updated_at), 'PPP') : '-'}
                    </span>
                  </div>
                  {org.psr_licence_number && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">PSR Licence</span>
                      <span>{org.psr_licence_number}</span>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="credits" className="space-y-6 mt-4">
                <p className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2">
                  Credits run under the hood of the tier model — kept for usage monitoring and audit only.
                </p>
                {creditsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : creditsRedacted ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Credit data restricted to super admins</p>
                  </div>
                ) : credits ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-muted rounded-lg p-3 text-center">
                        <CreditCard className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                        <div className="text-2xl font-semibold" data-testid="text-org-balance">
                          {credits.balance.toFixed(0)}
                        </div>
                        <div className="text-xs text-muted-foreground">Balance</div>
                      </div>
                      <div className="bg-muted rounded-lg p-3 text-center">
                        <TrendingUp className="h-5 w-5 mx-auto text-green-600 mb-1" />
                        <div className="text-2xl font-semibold text-green-600">
                          {credits.total_granted.toFixed(0)}
                        </div>
                        <div className="text-xs text-muted-foreground">Granted</div>
                      </div>
                      <div className="bg-muted rounded-lg p-3 text-center">
                        <TrendingDown className="h-5 w-5 mx-auto text-orange-600 mb-1" />
                        <div className="text-2xl font-semibold text-orange-600">
                          {credits.total_used.toFixed(0)}
                        </div>
                        <div className="text-xs text-muted-foreground">Used</div>
                      </div>
                    </div>

                    {credits.last_top_up && (
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ArrowUpRight className="h-4 w-4 text-green-600" />
                              <span className="text-sm font-medium">Last Top-up</span>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-green-600">+{credits.last_top_up.amount.toFixed(0)}</div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(credits.last_top_up.date), 'MMM d, yyyy')}
                              </div>
                            </div>
                          </div>
                          {credits.last_top_up.description && (
                            <p className="text-xs text-muted-foreground mt-2">{credits.last_top_up.description}</p>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {credits.usage_timeline.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Usage Timeline (30 days)</h4>
                        <div className="h-[180px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={credits.usage_timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis
                                dataKey="week"
                                tick={{ fontSize: 10 }}
                                tickFormatter={(val) => format(new Date(val), 'MMM d')}
                              />
                              <YAxis tick={{ fontSize: 10 }} width={40} />
                              <Tooltip
                                labelFormatter={(val) => format(new Date(val), 'MMM d, yyyy')}
                                formatter={(value: number, name: string) => [value.toFixed(0), name === 'credits' ? 'Credits In' : 'Credits Out']}
                              />
                              <Legend />
                              <Area type="monotone" dataKey="credits" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} name="Credits In" />
                              <Area type="monotone" dataKey="debits" stackId="2" stroke="#f97316" fill="#f97316" fillOpacity={0.3} name="Credits Out" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Recent Transactions</h4>
                      {credits.transactions.length > 0 ? (
                        <ScrollArea className="h-[200px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[100px]">Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {credits.transactions.slice(0, 20).map((tx) => (
                                <TableRow key={tx.id}>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {format(new Date(tx.created_at), 'MMM d')}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {tx.description || tx.source || tx.type}
                                  </TableCell>
                                  <TableCell className={`text-right font-medium ${tx.type === 'credit' ? 'text-green-600' : 'text-orange-600'}`}>
                                    {tx.type === 'credit' ? '+' : '-'}{Math.abs(tx.amount).toFixed(0)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No transactions yet</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No credit data available</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            Organization not found
          </div>
        )}
      </SheetContent>

      <Dialog open={grantCreditsOpen} onOpenChange={setGrantCreditsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Credits</DialogTitle>
            <DialogDescription>
              Add credits to {org?.business_name} — internal monitoring / audit only
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="credit-amount">Amount</Label>
              <Input
                id="credit-amount"
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="50"
                data-testid="input-credit-amount"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="credit-reason">Reason</Label>
              <Textarea
                id="credit-reason"
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                placeholder="Customer support compensation, promotional bonus, etc."
                data-testid="input-credit-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantCreditsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => grantCreditsMutation.mutate({
                amount: parseFloat(creditAmount),
                reason: creditReason,
              })}
              disabled={!creditAmount || parseFloat(creditAmount) <= 0 || grantCreditsMutation.isPending}
              data-testid="button-confirm-grant"
            >
              {grantCreditsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Grant Credits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={changePlanOpen} onOpenChange={(isOpen) => {
        setChangePlanOpen(isOpen);
        if (!isOpen) setSelectedPlan('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Plan</DialogTitle>
            <DialogDescription>
              Update the subscription tier for {org?.business_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label>Current Plan</Label>
              <Badge variant="outline" data-testid="badge-current-plan">
                {currentPlanDisplay}
              </Badge>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-plan">New Plan</Label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger data-testid="select-plan">
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => {
                    const limits = (p.limits || {}) as Record<string, number>;
                    const priceLabel = formatCents(p.monthly_price_cents, 'EUR');
                    const listings = limits.max_listings;
                    const hubs = limits.max_social_hubs;
                    return (
                      <SelectItem key={p.name} value={p.name}>
                        <div className="flex flex-col">
                          <span>
                            {p.display_name} — {priceLabel}/mo
                          </span>
                          {(listings != null || hubs != null) && (
                            <span className="text-xs text-muted-foreground">
                              {listings != null ? `${listings === -1 ? '∞' : listings} listings` : ''}
                              {listings != null && hubs != null ? ' · ' : ''}
                              {hubs != null ? `${hubs === -1 ? '∞' : hubs} hubs` : ''}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {selectedPlan === 'free' && currentPlan !== 'free' && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Demoting to Free will disable AI motion video styles (VS2, VS4) for this org.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Pilot / comped deals are managed via the Comp control, not the plan tier.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePlanOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => changePlanMutation.mutate(selectedPlan)}
              disabled={!selectedPlan || selectedPlan === currentPlan || changePlanMutation.isPending}
              data-testid="button-confirm-change-plan"
            >
              {changePlanMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={billingOverrideOpen} onOpenChange={setBillingOverrideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{hasOverride ? 'Manage Comp / Billing Override' : 'Set Comp / Billing Override'}</DialogTitle>
            <DialogDescription>
              Billing overrides bypass the standard tier — used for pilot customers and complimentary accounts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="override-type">Type</Label>
                <Select
                  value={overrideForm.type}
                  onValueChange={(v) => setOverrideForm({ ...overrideForm, type: v as 'pilot' | 'comp' })}
                >
                  <SelectTrigger id="override-type" data-testid="select-override-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comp">Complimentary</SelectItem>
                    <SelectItem value="pilot">Pilot deal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="override-plan">Plan equivalent</Label>
                <Select
                  value={overrideForm.plan_equivalent}
                  onValueChange={(v) => setOverrideForm({ ...overrideForm, plan_equivalent: v })}
                >
                  <SelectTrigger id="override-plan" data-testid="select-override-plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.filter(p => p.name !== 'free').map((p) => (
                      <SelectItem key={p.name} value={p.name}>{p.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {overrideForm.type === 'pilot' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="override-price">Price / week (cents)</Label>
                  <Input
                    id="override-price"
                    type="number"
                    value={overrideForm.price_weekly_cents}
                    onChange={(e) => setOverrideForm({ ...overrideForm, price_weekly_cents: e.target.value })}
                    placeholder="7000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="override-currency">Currency</Label>
                  <Input
                    id="override-currency"
                    value={overrideForm.currency}
                    onChange={(e) => setOverrideForm({ ...overrideForm, currency: e.target.value })}
                    placeholder="eur"
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="override-expires">Expires at (optional)</Label>
              <Input
                id="override-expires"
                type="date"
                value={overrideForm.expires_at ? overrideForm.expires_at.slice(0, 10) : ''}
                onChange={(e) => setOverrideForm({ ...overrideForm, expires_at: e.target.value ? new Date(e.target.value).toISOString() : '' })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="override-notes">Notes</Label>
              <Textarea
                id="override-notes"
                value={overrideForm.notes}
                onChange={(e) => setOverrideForm({ ...overrideForm, notes: e.target.value })}
                placeholder="Why this org is comped — founding partner, pilot, support gesture, etc."
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            {hasOverride ? (
              <Button
                variant="ghost"
                onClick={() => setOverrideMutation.mutate(null)}
                disabled={setOverrideMutation.isPending}
                data-testid="button-clear-override"
              >
                Clear override
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setBillingOverrideOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={submitOverride}
                disabled={setOverrideMutation.isPending || !overrideForm.type}
                data-testid="button-save-override"
              >
                {setOverrideMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OrganizationLocaleSelector
        open={regionSettingsOpen}
        onClose={() => setRegionSettingsOpen(false)}
        organizationId={organizationId || ''}
        organizationName={org?.business_name || ''}
        currentLocale={org?.locale || DEFAULT_LOCALE}
        currentCurrency={org?.currency || 'EUR'}
        currentTimezone={org?.timezone || 'Europe/Dublin'}
      />
    </Sheet>
  );
}
