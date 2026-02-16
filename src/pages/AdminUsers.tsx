import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTeamLimit } from "@/hooks/useTeamLimit";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, UserPlus, UserMinus, Key, Shield, Users as UsersIcon, Eye, EyeOff, ShieldAlert, Mail, Clock, X, Send, Trash2 } from "lucide-react";
import { TeamLimitBanner } from "@/components/billing/TeamLimitBanner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OrgUser {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const { organization, loading: orgLoading } = useOrganization();
  const { viewAsOrganizationId, selectedOrganization, isOrganizationView } = useOrganizationView();
  const { user, session, isSuperAdmin, isAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<OrgUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [inviteData, setInviteData] = useState({
    email: "",
    role: "user" as "admin" | "user",
  });

  const canManageUsers = isAdmin || isSuperAdmin;
  
  const { isAtLimit, currentUserCount, maxUsers, isLoading: teamLimitLoading } = useTeamLimit();
  
  const shouldDisableAddUser = !teamLimitLoading && isAtLimit;

  const [newUser, setNewUser] = useState({
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    role: "user" as "admin" | "user",
  });

  const [passwordChange, setPasswordChange] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;

  useEffect(() => {
    if (targetOrg && session?.access_token) {
      loadUsers();
      loadPendingInvitations();
    }
  }, [targetOrg, viewAsOrganizationId, session?.access_token]);

  const loadUsers = async () => {
    if (!targetOrg || !session?.access_token) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-org-users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            organizationId: targetOrg.id,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load users');
      }

      setUsers(result.users || []);
    } catch (error) {
      console.error('Failed to load users:', error);
      toast({
        title: "Failed to load users",
        description: error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPendingInvitations = async () => {
    if (!targetOrg) return;

    try {
      const { data, error } = await supabase
        .from('organization_invitations')
        .select('id, email, role, expires_at, created_at')
        .eq('organization_id', targetOrg.id)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingInvitations(data || []);
    } catch (error) {
      console.error('Failed to load invitations:', error);
    }
  };

  const handleSendInvitation = async () => {
    if (!targetOrg || !session?.access_token) return;

    if (!inviteData.email) {
      toast({
        title: "Email required",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invitation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email: inviteData.email,
            organizationId: targetOrg.id,
            role: inviteData.role,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send invitation');
      }

      toast({
        title: "Invitation sent",
        description: `An invitation has been sent to ${inviteData.email}`,
      });

      setInviteData({ email: "", role: "user" });
      setIsInviteDialogOpen(false);
      loadPendingInvitations();
    } catch (error) {
      console.error('Failed to send invitation:', error);
      toast({
        title: "Failed to send invitation",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('organization_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: "Invitation cancelled",
        description: "The invitation has been removed",
      });

      loadPendingInvitations();
    } catch (error) {
      console.error('Failed to cancel invitation:', error);
      toast({
        title: "Failed to cancel invitation",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleRemoveUser = async () => {
    if (!userToRemove || !targetOrg || !session?.access_token) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/remove-org-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            organizationId: targetOrg.id,
            userOrganizationId: userToRemove.id,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to remove user');
      }

      toast({
        title: "User removed",
        description: `${userToRemove.email} has been removed from the organization`,
      });

      setIsRemoveDialogOpen(false);
      setUserToRemove(null);
      await loadUsers();
    } catch (error) {
      console.error('Failed to remove user:', error);
      toast({
        title: "Failed to remove user",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmRemoveUser = (orgUser: OrgUser) => {
    setUserToRemove(orgUser);
    setIsRemoveDialogOpen(true);
  };

  const handleCreateUser = async () => {
    if (!targetOrg || !session?.access_token) return;

    if (!newUser.email || !newUser.firstName || !newUser.lastName || !newUser.password) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (newUser.password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-org-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            organizationId: targetOrg.id,
            email: newUser.email,
            password: newUser.password,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            role: newUser.role,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user');
      }

      toast({
        title: "User created",
        description: `${newUser.email} has been added to your organization`,
      });

      setNewUser({ email: "", firstName: "", lastName: "", password: "", role: "user" });
      setIsCreateDialogOpen(false);
      loadUsers();
    } catch (error) {
      console.error('Failed to create user:', error);
      toast({
        title: "Failed to create user",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordChange.newPassword || !passwordChange.confirmPassword) {
      toast({
        title: "Missing fields",
        description: "Please fill in all password fields",
        variant: "destructive",
      });
      return;
    }

    if (passwordChange.newPassword !== passwordChange.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirmation must match",
        variant: "destructive",
      });
      return;
    }

    if (passwordChange.newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordChange.newPassword,
      });

      if (error) throw error;

      toast({
        title: "Password updated",
        description: "Your password has been changed successfully",
      });

      setPasswordChange({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setIsPasswordDialogOpen(false);
    } catch (error) {
      console.error('Failed to change password:', error);
      toast({
        title: "Failed to change password",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendPasswordReset = async (userId: string) => {
    if (!session?.access_token) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            userId,
            organizationId: targetOrg?.id,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send reset email');
      }

      toast({
        title: "Password reset sent",
        description: `Password reset email has been sent to ${result.email}`,
      });
    } catch (error) {
      console.error('Failed to send password reset:', error);
      toast({
        title: "Failed to send reset",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'default';
      case 'admin':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (authLoading || orgLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-users">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canManageUsers) {
    return (
      <div className="p-6" data-testid="access-denied">
        <Card>
          <CardContent className="py-8 text-center">
            <ShieldAlert className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">
              You don't have permission to manage users. Only admins can access this page.
            </p>
            <Button onClick={() => navigate('/admin/listings')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!targetOrg) {
    return (
      <div className="p-6" data-testid="no-org-message">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No organization selected
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <TeamLimitBanner
        onUpgrade={() => navigate('/admin/billing/upgrade')}
      />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <UsersIcon className="h-6 w-6" />
            User Management
          </h1>
          <p className="text-muted-foreground" data-testid="text-org-name">
            Manage users for {targetOrg.business_name}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            onClick={() => setIsPasswordDialogOpen(true)}
            data-testid="button-change-password"
          >
            <Key className="h-4 w-4 mr-2" />
            Change My Password
          </Button>
          {(isAdmin || isSuperAdmin) && (
            <>
              {shouldDisableAddUser ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button 
                        variant="outline" 
                        disabled 
                        data-testid="button-invite-user"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Invite by Email
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Team limit reached ({currentUserCount}/{maxUsers} users). Upgrade to add more.</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={() => setIsInviteDialogOpen(true)} 
                  data-testid="button-invite-user"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Invite by Email
                </Button>
              )}
              {shouldDisableAddUser ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button 
                        disabled 
                        data-testid="button-create-user"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add User
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Team limit reached ({currentUserCount}/{maxUsers} users). Upgrade to add more.</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button 
                  onClick={() => setIsCreateDialogOpen(true)} 
                  data-testid="button-create-user"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization Users</CardTitle>
          <CardDescription>
            Users with access to this organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-users">
              No users found
            </div>
          ) : (
            <Table data-testid="table-users">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  {(isAdmin || isSuperAdmin) && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((orgUser) => (
                  <TableRow key={orgUser.id} data-testid={`row-user-${orgUser.user_id}`}>
                    <TableCell className="font-medium" data-testid={`text-name-${orgUser.user_id}`}>
                      {orgUser.first_name && orgUser.last_name 
                        ? `${orgUser.first_name} ${orgUser.last_name}`
                        : 'Unknown'}
                      {orgUser.user_id === user?.id && (
                        <Badge variant="outline" className="ml-2">You</Badge>
                      )}
                    </TableCell>
                    <TableCell data-testid={`text-email-${orgUser.user_id}`}>
                      {orgUser.email || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={getRoleBadgeVariant(orgUser.role)}
                        data-testid={`badge-role-${orgUser.user_id}`}
                      >
                        <Shield className="h-3 w-3 mr-1" />
                        {orgUser.role}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`text-joined-${orgUser.user_id}`}>
                      {new Date(orgUser.created_at).toLocaleDateString()}
                    </TableCell>
                    {(isAdmin || isSuperAdmin) && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {orgUser.user_id !== user?.id && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSendPasswordReset(orgUser.user_id)}
                                data-testid={`button-reset-password-${orgUser.user_id}`}
                              >
                                <Key className="h-4 w-4 mr-1" />
                                Reset Password
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => confirmRemoveUser(orgUser)}
                                className="text-destructive hover:text-destructive"
                                data-testid={`button-remove-user-${orgUser.user_id}`}
                              >
                                <UserMinus className="h-4 w-4 mr-1" />
                                Remove
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Pending Invitations
            </CardTitle>
            <CardDescription>
              Users who have been invited but haven't accepted yet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table data-testid="table-invitations">
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((invitation) => (
                  <TableRow key={invitation.id} data-testid={`row-invitation-${invitation.id}`}>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        <Shield className="h-3 w-3 mr-1" />
                        {invitation.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(invitation.expires_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelInvitation(invitation.id)}
                        data-testid={`button-cancel-invitation-${invitation.id}`}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation email to join {targetOrg.business_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Email Address</Label>
              <Input
                id="inviteEmail"
                type="email"
                value={inviteData.email}
                onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                placeholder="colleague@example.com"
                data-testid="input-invite-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteRole">Role</Label>
              <Select
                value={inviteData.role}
                onValueChange={(value: "admin" | "user") => setInviteData({ ...inviteData, role: value })}
              >
                <SelectTrigger data-testid="select-invite-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user" data-testid="option-invite-role-user">User</SelectItem>
                  <SelectItem value="admin" data-testid="option-invite-role-admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Admins can manage listings, users, and settings. Users can view and create listings.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)} data-testid="button-cancel-invite">
              Cancel
            </Button>
            <Button onClick={handleSendInvitation} disabled={isSubmitting} data-testid="button-submit-invite">
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Send className="h-4 w-4 mr-2" />
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account for {targetOrg.business_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={newUser.firstName}
                  onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                  placeholder="John"
                  data-testid="input-first-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={newUser.lastName}
                  onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                  placeholder="Doe"
                  data-testid="input-last-name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="john@example.com"
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  data-testid="input-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={newUser.role}
                onValueChange={(value: "admin" | "user") => setNewUser({ ...newUser, role: value })}
              >
                <SelectTrigger data-testid="select-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user" data-testid="option-role-user">User</SelectItem>
                  <SelectItem value="admin" data-testid="option-role-admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} data-testid="button-cancel-create">
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={isSubmitting} data-testid="button-submit-create">
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Your Password</DialogTitle>
            <DialogDescription>
              Enter your new password below
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordChange.newPassword}
                onChange={(e) => setPasswordChange({ ...passwordChange, newPassword: e.target.value })}
                placeholder="Minimum 6 characters"
                data-testid="input-new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordChange.confirmPassword}
                onChange={(e) => setPasswordChange({ ...passwordChange, confirmPassword: e.target.value })}
                placeholder="Confirm your new password"
                data-testid="input-confirm-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)} data-testid="button-cancel-password">
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={isSubmitting} data-testid="button-submit-password">
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{userToRemove?.email}</strong> from {targetOrg?.business_name}? 
              They will lose access to all organization data immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-remove">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSubmitting}
              data-testid="button-confirm-remove"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
