import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, UserWithDetails } from '@/lib/admin/adminApi';
import { useAuth } from '@/contexts/AuthContext';
import { useSuperAdminPermissions } from '@/hooks/useSuperAdminPermissions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Search, User, ChevronLeft, ChevronRight, Building2, MoreHorizontal, Eye, UserX, X, Mail, Trash2, Shield, KeyRound } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';

const PAGE_SIZE = 20;

export default function UsersPage() {
  const { startImpersonation } = useAuth();
  const { hasPermission, isSuperAdmin, hasSuperAdminAccess, loading: authLoading } = useSuperAdminPermissions();
  const { toast } = useToast();
  const canImpersonate = hasPermission('canImpersonateUsers');

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [usersToDelete, setUsersToDelete] = useState<{ ids: string[]; names: string[] }>({ ids: [], names: [] });
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [userToChangeRole, setUserToChangeRole] = useState<{ userId: string; name: string; currentRole: string } | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<string>('');
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [userToSetPassword, setUserToSetPassword] = useState<{ userId: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isSettingPassword, setIsSettingPassword] = useState(false);

  const handleImpersonate = async (user: UserWithDetails) => {
    if (user.organizations.length === 0) {
      toast({ title: 'Cannot impersonate', description: 'User has no organization memberships', variant: 'destructive' });
      return;
    }
    try {
      await startImpersonation(user.organizations[0].organization_id, `Viewing as user ${user.user_id.slice(0, 8)}`);
      toast({ title: 'Impersonation started', description: `Now viewing as user in ${user.organizations[0].organization_name || 'organization'}` });
    } catch (error) {
      toast({ title: 'Failed to start impersonation', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const { data: usersData, isLoading, error } = useQuery({
    queryKey: ['admin-users', searchQuery, roleFilter, currentPage],
    queryFn: () => adminApi.users.list({
      search: searchQuery || undefined,
      role: roleFilter !== 'all' ? roleFilter : undefined,
      page: currentPage,
      pageSize: PAGE_SIZE,
    }),
    enabled: !authLoading && hasSuperAdminAccess,
  });

  const users = usersData?.users;
  const totalCount = usersData?.total ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const currentPageUserIds = useMemo(() => {
    return users?.map(user => user.user_id) || [];
  }, [users]);

  const allSelected = currentPageUserIds.length > 0 && currentPageUserIds.every(id => selectedIds.has(id));
  const someSelected = currentPageUserIds.some(id => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      const newSelected = new Set(selectedIds);
      currentPageUserIds.forEach(id => newSelected.delete(id));
      setSelectedIds(newSelected);
    } else {
      const newSelected = new Set(selectedIds);
      currentPageUserIds.forEach(id => newSelected.add(id));
      setSelectedIds(newSelected);
    }
  };

  const toggleSelect = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedIds(newSelected);
  };

  const queryClient = useQueryClient();

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const bulkActionMutation = useMutation({
    mutationFn: (data: { action: 'suspend' | 'unsuspend'; reason?: string }) =>
      adminApi.users.bulkAction({
        userIds: Array.from(selectedIds),
        action: data.action,
        reason: data.reason,
      }),
    onSuccess: (result) => {
      toast({
        title: result.success ? 'Success' : 'Partial Success',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      
      // Only clear successful IDs, keep failed ones selected for retry
      if (result.success) {
        clearSelection();
      } else {
        const failedIds = result.results
          .filter((r) => !r.success)
          .map((r) => r.userId);
        setSelectedIds(new Set(failedIds));
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Action failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleBulkAction = (action: 'suspend' | 'unsuspend') => {
    if (selectedIds.size === 0) return;
    bulkActionMutation.mutate({ action });
  };

  const deleteUsersMutation = useMutation({
    mutationFn: (userIds: string[]) =>
      adminApi.users.deleteUsers({ userIds }),
    onSuccess: (result) => {
      toast({
        title: result.success ? 'Users deleted' : 'Partial deletion',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      clearSelection();
      setDeleteDialogOpen(false);
      setUsersToDelete({ ids: [], names: [] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const openDeleteDialog = (userIds: string[], userNames: string[]) => {
    setUsersToDelete({ ids: userIds, names: userNames });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (usersToDelete.ids.length > 0) {
      deleteUsersMutation.mutate(usersToDelete.ids);
    }
  };

  const handleBulkDelete = () => {
    const selectedUsersList = users?.filter(u => selectedIds.has(u.user_id)) || [];
    const names = selectedUsersList.map(u => u.name || u.email || u.user_id.slice(0, 8));
    openDeleteDialog(Array.from(selectedIds), names);
  };

  const changeRoleMutation = useMutation({
    mutationFn: (data: { userId: string; newRole: string }) =>
      adminApi.users.changeRole(data),
    onSuccess: (result) => {
      toast({
        title: 'Role changed',
        description: result.message,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setRoleDialogOpen(false);
      setUserToChangeRole(null);
      setSelectedNewRole('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to change role',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const openRoleDialog = (user: UserWithDetails) => {
    setUserToChangeRole({
      userId: user.user_id,
      name: user.name || user.email || user.user_id.slice(0, 8),
      currentRole: user.role,
    });
    setSelectedNewRole(user.role);
    setRoleDialogOpen(true);
  };

  const handleRoleChangeConfirm = () => {
    if (userToChangeRole && selectedNewRole && selectedNewRole !== userToChangeRole.currentRole) {
      changeRoleMutation.mutate({
        userId: userToChangeRole.userId,
        newRole: selectedNewRole,
      });
    }
  };

  const openPasswordDialog = (user: UserWithDetails) => {
    setUserToSetPassword({
      userId: user.user_id,
      name: user.name || user.email || user.user_id.slice(0, 8),
    });
    setNewPassword('');
    setPasswordDialogOpen(true);
  };

  const handleSetPasswordConfirm = async () => {
    if (!userToSetPassword || !newPassword || newPassword.length < 6) return;
    setIsSettingPassword(true);
    try {
      await adminApi.support.setPassword(userToSetPassword.userId, newPassword);
      toast({
        title: 'Password updated',
        description: `Password has been set for ${userToSetPassword.name}`,
      });
      setPasswordDialogOpen(false);
      setUserToSetPassword(null);
      setNewPassword('');
    } catch (error) {
      toast({
        title: 'Failed to set password',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsSettingPassword(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'destructive';
      case 'developer':
        return 'default';
      case 'admin':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Users</h1>
          <p className="text-muted-foreground">Manage platform users and their roles</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {totalCount ?? '...'} total
        </Badge>
      </div>

      {selectedIds.size > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Badge variant="default" data-testid="badge-selected-count">{selectedIds.size} selected</Badge>
              <Button variant="ghost" size="sm" onClick={clearSelection} data-testid="button-clear-selection">
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
            {isSuperAdmin && (
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => toast({ title: 'Send Email', description: 'Bulk email feature coming soon. Requires Resend API integration.' })}
                  data-testid="button-bulk-email"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleBulkAction('suspend')}
                  disabled={bulkActionMutation.isPending}
                  data-testid="button-bulk-suspend"
                >
                  <UserX className="h-4 w-4 mr-2" />
                  {bulkActionMutation.isPending ? 'Processing...' : 'Suspend'}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleBulkAction('unsuspend')}
                  disabled={bulkActionMutation.isPending}
                  data-testid="button-bulk-unsuspend"
                >
                  Unsuspend
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleBulkDelete}
                  disabled={deleteUsersMutation.isPending}
                  data-testid="button-bulk-delete"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deleteUsersMutation.isPending ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or user ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(0);
                }}
                className="pl-9"
                data-testid="input-search-users"
              />
            </div>
            <Select
              value={roleFilter}
              onValueChange={(value) => {
                setRoleFilter(value);
                setCurrentPage(0);
              }}
            >
              <SelectTrigger className="w-[150px]" data-testid="select-role-filter">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="developer">Developer</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">
              Failed to load users
            </div>
          ) : users?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No users found
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                        data-testid="checkbox-select-all"
                        className={someSelected && !allSelected ? 'opacity-50' : ''}
                      />
                    </TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Platform Role</TableHead>
                    <TableHead>Organizations</TableHead>
                    <TableHead>Created</TableHead>
                    {canImpersonate && <TableHead className="w-[80px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map((user) => (
                    <TableRow 
                      key={user.id} 
                      className={selectedIds.has(user.user_id) ? 'bg-primary/5' : ''}
                      data-testid={`row-user-${user.id}`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(user.user_id)}
                          onCheckedChange={() => {}}
                          onClick={(e) => toggleSelect(user.user_id, e)}
                          aria-label={`Select user ${user.user_id.slice(0, 8)}`}
                          data-testid={`checkbox-user-${user.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">
                              {user.name || 'Unnamed User'}
                            </span>
                            <code className="text-xs text-muted-foreground">{user.user_id.slice(0, 12)}...</code>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{user.email || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.organizations.length > 0 ? (
                            user.organizations.slice(0, 3).map((org) => (
                              <Badge
                                key={org.organization_id}
                                variant="outline"
                                className="text-xs"
                              >
                                <Building2 className="h-3 w-3 mr-1" />
                                {org.organization_name || org.organization_id.slice(0, 8)}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">None</span>
                          )}
                          {user.organizations.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{user.organizations.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {user.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : '-'}
                      </TableCell>
                      {canImpersonate && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-actions-${user.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleImpersonate(user)}
                                disabled={user.organizations.length === 0}
                                data-testid={`action-impersonate-${user.id}`}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View As User
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openRoleDialog(user)}
                                data-testid={`action-change-role-${user.id}`}
                              >
                                <Shield className="h-4 w-4 mr-2" />
                                Change Role
                              </DropdownMenuItem>
                              {isSuperAdmin && (
                                <DropdownMenuItem
                                  onClick={() => openPasswordDialog(user)}
                                  data-testid={`action-set-password-${user.id}`}
                                >
                                  <KeyRound className="h-4 w-4 mr-2" />
                                  Set Password
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => {
                                  adminApi.users.bulkAction({
                                    userIds: [user.user_id],
                                    action: 'suspend',
                                  }).then((result) => {
                                    toast({
                                      title: result.success ? 'User suspended' : 'Failed to suspend',
                                      description: result.message,
                                      variant: result.success ? 'default' : 'destructive',
                                    });
                                    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
                                  }).catch((error) => {
                                    toast({
                                      title: 'Failed to suspend',
                                      description: error.message,
                                      variant: 'destructive',
                                    });
                                  });
                                }}
                                data-testid={`action-suspend-${user.id}`}
                              >
                                <UserX className="h-4 w-4 mr-2" />
                                Suspend User
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => openDeleteDialog(
                                  [user.user_id], 
                                  [user.name || user.email || user.user_id.slice(0, 8)]
                                )}
                                className="text-destructive focus:text-destructive"
                                data-testid={`action-delete-${user.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage + 1} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={currentPage >= totalPages - 1}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {usersToDelete.ids.length === 1 ? 'User' : 'Users'}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Are you sure you want to permanently delete {usersToDelete.ids.length === 1 ? 'this user' : `these ${usersToDelete.ids.length} users`}?
              </p>
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-sm">
                <p className="font-medium text-destructive mb-2">This action cannot be undone. This will:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Permanently remove the user account(s) from authentication</li>
                  <li>Delete all associated organization memberships</li>
                  <li>Remove user role assignments</li>
                  <li>Delete any related data (notes, audit logs, etc.)</li>
                </ul>
              </div>
              {usersToDelete.names.length > 0 && (
                <div className="text-sm">
                  <p className="font-medium mb-1">Users to be deleted:</p>
                  <div className="flex flex-wrap gap-1">
                    {usersToDelete.names.slice(0, 5).map((name, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{name}</Badge>
                    ))}
                    {usersToDelete.names.length > 5 && (
                      <Badge variant="outline" className="text-xs">+{usersToDelete.names.length - 5} more</Badge>
                    )}
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUsersMutation.isPending} data-testid="button-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteUsersMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteUsersMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Change the platform role for {userToChangeRole?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Role</label>
              <Badge variant={getRoleBadgeVariant(userToChangeRole?.currentRole || 'user')}>
                {userToChangeRole?.currentRole}
              </Badge>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">New Role</label>
              <Select value={selectedNewRole} onValueChange={setSelectedNewRole}>
                <SelectTrigger data-testid="select-new-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedNewRole === 'super_admin' && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-sm">
                <p className="font-medium text-destructive">Warning: Super Admin Access</p>
                <p className="text-muted-foreground mt-1">
                  This role grants full access to the internal admin portal, including user management, billing, and all system settings.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setRoleDialogOpen(false)}
              disabled={changeRoleMutation.isPending}
              data-testid="button-cancel-role-change"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRoleChangeConfirm}
              disabled={changeRoleMutation.isPending || selectedNewRole === userToChangeRole?.currentRole}
              data-testid="button-confirm-role-change"
            >
              {changeRoleMutation.isPending ? 'Changing...' : 'Change Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Password</DialogTitle>
            <DialogDescription>
              Set a new password for {userToSetPassword?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Enter new password (min 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                data-testid="input-new-password"
              />
              {newPassword.length > 0 && newPassword.length < 6 && (
                <p className="text-sm text-destructive">Password must be at least 6 characters</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPasswordDialogOpen(false)}
              disabled={isSettingPassword}
              data-testid="button-cancel-set-password"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSetPasswordConfirm}
              disabled={isSettingPassword || newPassword.length < 6}
              data-testid="button-confirm-set-password"
            >
              {isSettingPassword ? 'Setting...' : 'Set Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
