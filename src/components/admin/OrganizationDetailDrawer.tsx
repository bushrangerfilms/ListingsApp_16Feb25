import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { adminApi, isOrgCreditsRedacted, OrganizationCreditsResponse } from '@/lib/admin/adminApi';
import { useAuth } from '@/contexts/AuthContext';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Building2, Mail, Phone, MapPin, Globe, Calendar, Users, Home, Clock, Coins, Eye, Loader2, TrendingUp, TrendingDown, CreditCard, ArrowUpRight, ArrowDownRight, Crown, ArrowUpCircle, Gift, Languages, Rocket } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { OrganizationLocaleSelector } from './OrganizationLocaleSelector';

interface OrganizationDetailDrawerProps {
  organizationId: string | null;
  open: boolean;
  onClose: () => void;
}

export function OrganizationDetailDrawer({
  organizationId,
  open,
  onClose,
}: OrganizationDetailDrawerProps) {
  const navigate = useNavigate();
  const { user, startImpersonation } = useAuth();
  const { hasPermission } = useSuperAdminPermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('overview');
  const [extendTrialOpen, setExtendTrialOpen] = useState(false);
  const [grantCreditsOpen, setGrantCreditsOpen] = useState(false);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [regionSettingsOpen, setRegionSettingsOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [isSponsored, setIsSponsored] = useState(false);
  const [sponsoredReason, setSponsoredReason] = useState('');
  const [trialDays, setTrialDays] = useState('14');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');

  const canExtendTrial = hasPermission('canExtendTrial');
  const canGrantCredits = hasPermission('canGrantCredits');
  const canGrantCreditsOver100 = hasPermission('canGrantCreditsOver100');
  const canImpersonate = hasPermission('canImpersonateUsers');
  const { isSuperAdmin } = useSuperAdminPermissions();

  const { data: orgDetail, isLoading } = useQuery({
    queryKey: ['admin-organization-detail', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      return adminApi.organizations.getDetail(organizationId);
    },
    enabled: !!organizationId,
  });

  const org = orgDetail?.organization;
  const stats = orgDetail?.stats;
  const users = orgDetail?.users || [];
  const billingProfile = orgDetail?.billing_profile;

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
      toast({ title: 'Credits granted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to grant credits', description: error.message, variant: 'destructive' });
    },
  });

  const changePlanMutation = useMutation({
    mutationFn: async (data: { plan: string; is_sponsored: boolean; sponsored_reason: string }) => {
      if (!organizationId) throw new Error('Missing organization ID');
      return adminApi.organizations.changePlan(organizationId, data.plan, {
        is_sponsored: data.is_sponsored,
        sponsored_reason: data.sponsored_reason,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-organization-detail', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      setChangePlanOpen(false);
      setSelectedPlan('');
      setIsSponsored(false);
      setSponsoredReason('');
      const sponsoredMsg = result.is_sponsored ? ' (Complimentary)' : '';
      toast({ title: 'Plan updated successfully', description: `Now on ${result.new_plan}${sponsoredMsg}` });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update plan', description: error.message, variant: 'destructive' });
    },
  });

  const toggleCompedMutation = useMutation({
    mutationFn: async (isComped: boolean) => {
      if (!organizationId) throw new Error('Missing organization ID');
      const { error } = await supabase
        .schema('public')
        .from('organizations')
        .update({ is_comped: isComped })
        .eq('id', organizationId);
      
      if (error) throw error;
      return isComped;
    },
    onSuccess: (isComped) => {
      queryClient.invalidateQueries({ queryKey: ['admin-organization-detail', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['comped-organizations'] });
      toast({ 
        title: isComped ? 'Organization marked as comped' : 'Comped status removed',
        description: isComped ? 'This organization now has pilot access' : 'Standard billing will apply'
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update comped status', description: error.message, variant: 'destructive' });
    },
  });

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
              {billingProfile?.subscription_plan && (
                <Badge variant="outline" className="gap-1">
                  <Crown className="h-3 w-3" />
                  {billingProfile.subscription_plan === 'pro' ? 'Pro' : 'Starter'}
                </Badge>
              )}
              {billingProfile?.is_sponsored && (
                <Badge variant="secondary" className="gap-1 text-green-600 dark:text-green-400" title={billingProfile.sponsored_reason || 'Complimentary access'}>
                  <Gift className="h-3 w-3" />
                  Sponsored
                </Badge>
              )}
              {org.account_status && (
                <Badge 
                  variant="secondary"
                  className={
                    org.account_status === 'trial' ? 'text-blue-600 dark:text-blue-400' :
                    org.account_status === 'active' ? 'text-green-600 dark:text-green-400' :
                    org.account_status === 'trial_expired' ? 'text-orange-600 dark:text-orange-400' :
                    org.account_status === 'payment_failed' ? 'text-red-600 dark:text-red-400' :
                    'text-muted-foreground'
                  }
                >
                  {org.account_status.replace('_', ' ')}
                </Badge>
              )}
              {(org as any).is_comped && (
                <Badge variant="secondary" className="gap-1 text-purple-600 dark:text-purple-400">
                  <Rocket className="h-3 w-3" />
                  Comped
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
                {canGrantCredits && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGrantCreditsOpen(true)}
                    data-testid="button-grant-credits"
                  >
                    <Coins className="h-4 w-4 mr-2" />
                    Grant Credits
                  </Button>
                )}
                {canExtendTrial && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExtendTrialOpen(true)}
                    data-testid="button-extend-trial"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Extend Trial
                  </Button>
                )}
                {isSuperAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedPlan(billingProfile?.subscription_plan || 'starter');
                      setIsSponsored(billingProfile?.is_sponsored ?? false);
                      setSponsoredReason(billingProfile?.sponsored_reason || '');
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
                    onClick={() => setRegionSettingsOpen(true)}
                    data-testid="button-region-settings"
                  >
                    <Languages className="h-4 w-4 mr-2" />
                    Region
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
                <div className="grid grid-cols-3 gap-4">
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
                      {users.map((user) => (
                        <div
                          key={user.user_id}
                          className="flex items-center justify-between text-sm bg-muted rounded-lg px-3 py-2"
                        >
                          <code className="text-xs">{user.user_id.slice(0, 8)}...</code>
                          <Badge variant="outline" className="text-xs">
                            {user.role}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No team members</p>
                  )}
                </div>

                <Separator />

                {isSuperAdmin && (
                  <>
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium flex items-center gap-2">
                          <Rocket className="h-4 w-4" />
                          Pilot Status
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Comped organizations have free access during the pilot phase
                        </p>
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="space-y-0.5">
                          <Label htmlFor="comped-toggle" className="text-sm font-medium">
                            Comped Organization
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Exempt from billing and credit requirements
                          </p>
                        </div>
                        <Switch
                          id="comped-toggle"
                          checked={(org as any).is_comped ?? false}
                          onCheckedChange={(checked) => toggleCompedMutation.mutate(checked)}
                          disabled={toggleCompedMutation.isPending}
                          data-testid="switch-comped-org"
                        />
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

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
                    <div className="grid grid-cols-3 gap-3">
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
                              <Area 
                                type="monotone" 
                                dataKey="credits" 
                                stackId="1" 
                                stroke="#22c55e" 
                                fill="#22c55e" 
                                fillOpacity={0.3}
                                name="Credits In"
                              />
                              <Area 
                                type="monotone" 
                                dataKey="debits" 
                                stackId="2" 
                                stroke="#f97316" 
                                fill="#f97316" 
                                fillOpacity={0.3}
                                name="Credits Out"
                              />
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
              Add bonus credits to {org?.business_name}
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
                reason: creditReason 
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

      <Dialog open={extendTrialOpen} onOpenChange={setExtendTrialOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Trial</DialogTitle>
            <DialogDescription>
              Extend the trial period for {org?.business_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="trial-days">Additional Days</Label>
              <Input
                id="trial-days"
                type="number"
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
                placeholder="14"
                data-testid="input-trial-days"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Note: Trial extension requires the organization to have an active trial subscription.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendTrialOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast({ title: 'Trial extension', description: 'This feature requires Stripe integration to modify subscription trial period.' });
                setExtendTrialOpen(false);
              }}
              disabled={!trialDays || parseInt(trialDays) <= 0}
              data-testid="button-confirm-extend"
            >
              Extend Trial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={changePlanOpen} onOpenChange={(open) => {
        setChangePlanOpen(open);
        if (!open) {
          setSelectedPlan('');
          setIsSponsored(false);
          setSponsoredReason('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Plan</DialogTitle>
            <DialogDescription>
              Update the subscription plan for {org?.business_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Plan</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="gap-1">
                  <Crown className="h-3 w-3" />
                  {billingProfile?.subscription_plan === 'pro' ? 'Pro' : billingProfile?.subscription_plan || 'None'}
                </Badge>
                {billingProfile?.is_sponsored && (
                  <Badge variant="secondary" className="gap-1 text-green-600 dark:text-green-400">
                    <Gift className="h-3 w-3" />
                    Sponsored
                  </Badge>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-plan">New Plan</Label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger data-testid="select-plan">
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="sponsored-toggle" className="text-base">Complimentary Access</Label>
                <p className="text-sm text-muted-foreground">
                  Skip billing for this organization
                </p>
              </div>
              <Switch
                id="sponsored-toggle"
                checked={isSponsored}
                onCheckedChange={setIsSponsored}
                data-testid="switch-sponsored"
              />
            </div>
            {isSponsored && (
              <div className="space-y-2">
                <Label htmlFor="sponsored-reason">Reason for Sponsorship</Label>
                <Input
                  id="sponsored-reason"
                  value={sponsoredReason}
                  onChange={(e) => setSponsoredReason(e.target.value)}
                  placeholder="e.g., Founding partner, Beta tester"
                  data-testid="input-sponsored-reason"
                />
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {isSponsored 
                ? 'This organization will have full access without being billed.'
                : 'Note: This updates the plan in the database. For subscription billing changes, update via Stripe dashboard.'
              }
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePlanOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => changePlanMutation.mutate({ plan: selectedPlan, is_sponsored: isSponsored, sponsored_reason: sponsoredReason })}
              disabled={!selectedPlan || (selectedPlan === billingProfile?.subscription_plan && isSponsored === !!billingProfile?.is_sponsored) || changePlanMutation.isPending}
              data-testid="button-confirm-change-plan"
            >
              {changePlanMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OrganizationLocaleSelector
        open={regionSettingsOpen}
        onClose={() => setRegionSettingsOpen(false)}
        organizationId={organizationId || ''}
        organizationName={org?.business_name || ''}
        currentLocale={org?.locale || 'en-IE'}
        currentCurrency={org?.currency || 'EUR'}
        currentTimezone={org?.timezone || 'Europe/Dublin'}
      />
    </Sheet>
  );
}
