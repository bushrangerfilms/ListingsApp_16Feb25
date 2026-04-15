import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Loader2, Users, Building2, Mail, Rocket, Shield, Check, X, Trash2, KeyRound, Copy, Plus, Power, PowerOff, CreditCard, ExternalLink } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSuperAdminPermissions } from '@/hooks/useSuperAdminPermissions';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

interface InviteCode {
  id: string;
  code: string;
  label: string | null;
  is_active: boolean;
  usage_count: number;
  created_at: string;
}

interface WaitlistEntry {
  id: string;
  email: string;
  name: string | null;
  source: string | null;
  created_at: string;
  converted_at: string | null;
  is_converted: boolean;
}

interface FeatureFlag {
  id: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
}

interface Organization {
  id: string;
  slug: string;
  business_name: string;
  is_comped: boolean | null;
  is_active: boolean;
  created_at: string;
}

const PILOT_CHECKOUT_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL || 'https://sjcfcxjpukgeaxxkffpq.supabase.co'}/functions/v1/pilot-checkout`;
const PILOT_CHECKOUT_KEY = '305ffd8fd1d3d1183e61753e96e266908a44a41a4ecb881c8ea49bd58db6410d';

const PILOT_PLANS = [
  { priceId: 'price_1T5YUQIncirHB4pnb6Mi7eO4', label: 'AutoListing — \u20AC60/week' },
  { priceId: 'price_1T5YRtIncirHB4pnYzxb7Baf', label: 'AutoListing — \u20AC70/week' },
  { priceId: 'price_1T5YVDIncirHB4pnl4FqCLRV', label: 'AutoListing — \u20AC100/week' },
];

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function PilotSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole, hasSuperAdminAccess, loading: authLoading } = useSuperAdminPermissions();
  const isSuperAdmin = userRole === 'super_admin';
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showCreateCode, setShowCreateCode] = useState(false);
  const [newCodeLabel, setNewCodeLabel] = useState('');
  const [newCodeValue, setNewCodeValue] = useState('');

  // Checkout link generator state
  const [checkoutPriceId, setCheckoutPriceId] = useState(PILOT_PLANS[0].priceId);
  const [checkoutEmail, setCheckoutEmail] = useState('');
  const [checkoutClientRef, setCheckoutClientRef] = useState('');
  const [checkoutTrialDays, setCheckoutTrialDays] = useState(7);
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const pilotFlagKeys = [
    FEATURE_FLAGS.PILOT_MODE,
    FEATURE_FLAGS.PUBLIC_SIGNUP_ENABLED,
    FEATURE_FLAGS.MARKETING_VISIBLE,
    FEATURE_FLAGS.BILLING_ENFORCEMENT,
  ];

  const { data: pilotFlags, isLoading: flagsLoading } = useQuery({
    queryKey: ['pilot-feature-flags'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('feature_flags')
        .select('id, name, description, is_enabled')
        .in('name', pilotFlagKeys);

      if (error) throw error;
      return data as FeatureFlag[];
    },
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const { data: waitlistEntries, isLoading: waitlistLoading } = useQuery({
    queryKey: ['waitlist-entries'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('waitlist_signups')
        .select('id, email, name, source, created_at, converted_at, is_converted')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as WaitlistEntry[];
    },
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const { data: compedOrgs, isLoading: orgsLoading } = useQuery({
    queryKey: ['comped-organizations'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .schema('public')
        .from('organizations')
        .select('id, slug, business_name, is_comped, is_active, created_at')
        .eq('is_comped', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Organization[];
    },
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const { data: inviteCodes, isLoading: codesLoading } = useQuery({
    queryKey: ['pilot-invite-codes'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('pilot_invite_codes')
        .select('id, code, label, is_active, usage_count, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as InviteCode[];
    },
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const createCodeMutation = useMutation({
    mutationFn: async ({ code, label }: { code: string; label: string }) => {
      const { error } = await (supabase as any)
        .from('pilot_invite_codes')
        .insert({ code: code.toUpperCase(), label: label || null });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pilot-invite-codes'] });
      setShowCreateCode(false);
      setNewCodeLabel('');
      setNewCodeValue('');
      toast({ title: 'Invite code created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create code', description: error.message, variant: 'destructive' });
    },
  });

  const toggleCodeMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from('pilot_invite_codes')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pilot-invite-codes'] });
      toast({ title: 'Invite code updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update code', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCodeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('pilot_invite_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pilot-invite-codes'] });
      toast({ title: 'Invite code deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete code', description: error.message, variant: 'destructive' });
    },
  });

  const toggleFlagMutation = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const { error } = await (supabase as any)
        .from('feature_flags')
        .update({ is_enabled, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pilot-feature-flags'] });
      toast({ title: 'Flag updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update flag', description: error.message, variant: 'destructive' });
    },
  });

  const deleteWaitlistMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('waitlist_signups')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist-entries'] });
      setDeleteConfirm(null);
      toast({ title: 'Entry removed from waitlist' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to remove entry', description: error.message, variant: 'destructive' });
    },
  });

  const generateCheckoutLink = async () => {
    if (!checkoutEmail.trim()) {
      toast({ title: 'Email is required', variant: 'destructive' });
      return;
    }
    setCheckoutLoading(true);
    setCheckoutUrl('');
    setCheckoutError('');
    try {
      const res = await fetch(PILOT_CHECKOUT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': PILOT_CHECKOUT_KEY,
        },
        body: JSON.stringify({
          priceId: checkoutPriceId,
          customerEmail: checkoutEmail.trim(),
          trialDays: checkoutTrialDays,
          clientRef: checkoutClientRef.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setCheckoutUrl(data.url);
        toast({ title: 'Checkout link generated' });
      } else {
        setCheckoutError(data.error || 'Failed to generate link');
        toast({ title: 'Failed to generate link', description: data.error, variant: 'destructive' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setCheckoutError(msg);
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const getFlagDisplayName = (name: string) => {
    switch (name) {
      case FEATURE_FLAGS.PILOT_MODE:
        return 'Pilot Mode';
      case FEATURE_FLAGS.PUBLIC_SIGNUP_ENABLED:
        return 'Public Signup';
      case FEATURE_FLAGS.MARKETING_VISIBLE:
        return 'Marketing Pages';
      case FEATURE_FLAGS.BILLING_ENFORCEMENT:
        return 'Billing Enforcement';
      default:
        return name;
    }
  };

  const getFlagDescription = (name: string) => {
    switch (name) {
      case FEATURE_FLAGS.PILOT_MODE:
        return 'When enabled, only comped organizations can access the app';
      case FEATURE_FLAGS.PUBLIC_SIGNUP_ENABLED:
        return 'When enabled, new users can sign up publicly';
      case FEATURE_FLAGS.MARKETING_VISIBLE:
        return 'When enabled, marketing pages are visible';
      case FEATURE_FLAGS.BILLING_ENFORCEMENT:
        return 'When enabled, credit consumption is enforced';
      default:
        return '';
    }
  };

  const isLoading = flagsLoading || waitlistLoading || orgsLoading || codesLoading;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingWaitlist = waitlistEntries?.filter(e => !e.is_converted) || [];
  const convertedWaitlist = waitlistEntries?.filter(e => e.is_converted) || [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Pilot Program Settings</h1>
        <p className="text-muted-foreground">Manage pilot mode, waitlist, and comped organizations</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Rocket className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pilotFlags?.find(f => f.name === FEATURE_FLAGS.PILOT_MODE)?.is_enabled ? 'Active' : 'Inactive'}</p>
                <p className="text-sm text-muted-foreground">Pilot Mode</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{compedOrgs?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Comped Orgs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/20">
                <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingWaitlist.length}</p>
                <p className="text-sm text-muted-foreground">Waitlist</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                <Mail className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{convertedWaitlist.length}</p>
                <p className="text-sm text-muted-foreground">Converted</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Pilot Feature Flags
          </CardTitle>
          <CardDescription>
            Control access and features during the pilot phase
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pilotFlags?.map((flag) => (
              <div key={flag.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`flag-row-${flag.name}`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{getFlagDisplayName(flag.name)}</span>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{flag.name}</code>
                  </div>
                  <p className="text-sm text-muted-foreground">{getFlagDescription(flag.name)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`flag-${flag.id}`} className="text-sm text-muted-foreground">
                      {flag.is_enabled ? 'On' : 'Off'}
                    </Label>
                    <Switch
                      id={`flag-${flag.id}`}
                      checked={flag.is_enabled}
                      onCheckedChange={(checked) => {
                        toggleFlagMutation.mutate({
                          id: flag.id,
                          is_enabled: checked,
                        });
                      }}
                      disabled={!isSuperAdmin}
                      data-testid={`switch-flag-${flag.name}`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Generate Checkout Link
          </CardTitle>
          <CardDescription>
            Create a Stripe checkout URL to send to a customer. They enter card details and get a 7-day free trial.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="checkoutPlan">Plan</Label>
              <Select value={checkoutPriceId} onValueChange={setCheckoutPriceId}>
                <SelectTrigger id="checkoutPlan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PILOT_PLANS.map((plan) => (
                    <SelectItem key={plan.priceId} value={plan.priceId}>
                      {plan.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkoutEmail">Customer Email</Label>
              <Input
                id="checkoutEmail"
                type="email"
                value={checkoutEmail}
                onChange={(e) => setCheckoutEmail(e.target.value)}
                placeholder="client@agency.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkoutRef">Client Reference (optional)</Label>
              <Input
                id="checkoutRef"
                value={checkoutClientRef}
                onChange={(e) => setCheckoutClientRef(e.target.value)}
                placeholder="e.g. Agency Name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkoutTrial">Free Trial (days)</Label>
              <Input
                id="checkoutTrial"
                type="number"
                min={0}
                max={730}
                value={checkoutTrialDays}
                onChange={(e) => setCheckoutTrialDays(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <Button onClick={generateCheckoutLink} disabled={checkoutLoading || !checkoutEmail.trim()}>
            {checkoutLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Generate Link
          </Button>

          {checkoutUrl && (
            <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800 space-y-3">
              <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">Checkout URL</p>
              <p className="text-sm text-green-800 dark:text-green-300 break-all font-mono">{checkoutUrl}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(checkoutUrl);
                    toast({ title: 'URL copied to clipboard' });
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy URL
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(checkoutUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open
                </Button>
              </div>
            </div>
          )}

          {checkoutError && (
            <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-400">{checkoutError}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Pilot Invite Codes ({inviteCodes?.filter(c => c.is_active).length || 0} active)
            </CardTitle>
            <CardDescription>
              Create and manage invite codes for pilot participants
            </CardDescription>
          </div>
          {isSuperAdmin && (
            <Button
              onClick={() => {
                setNewCodeValue(generateInviteCode());
                setShowCreateCode(true);
              }}
              data-testid="button-create-invite-code"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Code
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showCreateCode && (
            <div className="mb-6 p-4 border rounded-lg bg-muted/50 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newCodeValue">Code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="newCodeValue"
                      value={newCodeValue}
                      onChange={(e) => setNewCodeValue(e.target.value.toUpperCase())}
                      placeholder="INVITECODE"
                      className="font-mono uppercase"
                      data-testid="input-new-code-value"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setNewCodeValue(generateInviteCode())}
                      title="Generate random code"
                      data-testid="button-regenerate-code"
                    >
                      <Rocket className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newCodeLabel">Label (optional)</Label>
                  <Input
                    id="newCodeLabel"
                    value={newCodeLabel}
                    onChange={(e) => setNewCodeLabel(e.target.value)}
                    placeholder="e.g. Partner Agency, Beta Testers"
                    data-testid="input-new-code-label"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateCode(false);
                    setNewCodeLabel('');
                    setNewCodeValue('');
                  }}
                  data-testid="button-cancel-create-code"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createCodeMutation.mutate({ code: newCodeValue, label: newCodeLabel })}
                  disabled={!newCodeValue.trim() || createCodeMutation.isPending}
                  data-testid="button-save-invite-code"
                >
                  {createCodeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Code
                </Button>
              </div>
            </div>
          )}

          {inviteCodes && inviteCodes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inviteCodes.map((code) => (
                  <TableRow key={code.id} data-testid={`row-invite-code-${code.id}`}>
                    <TableCell>
                      <code className="text-sm font-mono font-semibold bg-muted px-2 py-1 rounded">
                        {code.code}
                      </code>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {code.label || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={code.is_active ? 'default' : 'secondary'}>
                        {code.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {code.usage_count}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(code.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            navigator.clipboard.writeText(code.code);
                            toast({ title: 'Code copied to clipboard' });
                          }}
                          title="Copy code"
                          data-testid={`button-copy-code-${code.id}`}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        {isSuperAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleCodeMutation.mutate({ id: code.id, is_active: !code.is_active })}
                              title={code.is_active ? 'Deactivate' : 'Activate'}
                              data-testid={`button-toggle-code-${code.id}`}
                            >
                              {code.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteCodeMutation.mutate(code.id)}
                              title="Delete code"
                              data-testid={`button-delete-code-${code.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <KeyRound className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No invite codes yet</p>
              <p className="text-sm mt-1">Create your first invite code to get started</p>
            </div>
          )}

          <div className="mt-4 text-sm text-muted-foreground space-y-2">
            <p>When a user enters an active invite code on the pilot access page, they will be redirected to sign up with:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Automatic <Badge variant="secondary">is_comped</Badge> status (billing exempt)</li>
              <li>Full access to all platform features</li>
              <li>Each code can be used unlimited times</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Comped Organizations ({compedOrgs?.length || 0})
          </CardTitle>
          <CardDescription>
            Organizations with billing exemptions (pilot participants)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {compedOrgs && compedOrgs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {compedOrgs.map((org) => (
                  <TableRow key={org.id} data-testid={`row-org-${org.id}`}>
                    <TableCell className="font-medium">{org.business_name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{org.slug}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={org.is_active ? 'default' : 'secondary'}>
                        {org.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(org.created_at), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No comped organizations yet</p>
              <p className="text-sm mt-1">Mark organizations as comped in the Organizations page</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Waitlist ({pendingWaitlist.length} pending)
          </CardTitle>
          <CardDescription>
            Users who signed up for the waitlist
          </CardDescription>
        </CardHeader>
        <CardContent>
          {waitlistEntries && waitlistEntries.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  {isSuperAdmin && <TableHead className="w-[80px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {waitlistEntries.map((entry) => (
                  <TableRow key={entry.id} data-testid={`row-waitlist-${entry.id}`}>
                    <TableCell className="font-medium">{entry.email}</TableCell>
                    <TableCell>{entry.name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.source || 'unknown'}</Badge>
                    </TableCell>
                    <TableCell>
                      {entry.is_converted ? (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                          <Check className="h-3 w-3 mr-1" />
                          Converted
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(entry.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirm(entry.id)}
                          data-testid={`button-delete-waitlist-${entry.id}`}
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
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No waitlist signups yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from Waitlist</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this entry from the waitlist? This action cannot be undone.
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
                  deleteWaitlistMutation.mutate(deleteConfirm);
                }
              }}
              disabled={deleteWaitlistMutation.isPending}
              data-testid="button-confirm-delete-waitlist"
            >
              {deleteWaitlistMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
