import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, UserPlus, Trash2, Shield, Users as UsersIcon } from "lucide-react";
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

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  email?: string;
}

export default function AdminTeamManagement() {
  const { organization, loading: orgLoading } = useOrganization();
  const { viewAsOrganizationId, selectedOrganization, isOrganizationView } = useOrganizationView();
  const { user } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "user">("user");
  const [isInviting, setIsInviting] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);

  // Use the viewed organization if super admin is viewing as another org
  const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;

  useEffect(() => {
    if (targetOrg) {
      loadTeamMembers();
    }
  }, [targetOrg, viewAsOrganizationId]);

  const loadTeamMembers = async () => {
    if (!targetOrg) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_organizations')
        .select('id, user_id, role, created_at')
        .eq('organization_id', targetOrg.id);

      if (error) throw error;

      // Fetch user emails from auth metadata
      const membersWithEmails = await Promise.all(
        (data || []).map(async (member) => {
          try {
            const { data: userData } = await supabase.auth.admin.getUserById(member.user_id);
            return { ...member, email: userData?.user?.email };
          } catch {
            return member;
          }
        })
      );

      setTeamMembers(membersWithEmails);
    } catch (error) {
      console.error('Failed to load team members:', error);
      toast({
        title: "Failed to load team members",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!targetOrg || !inviteEmail.trim()) return;

    setIsInviting(true);

    try {
      // Get user ID from email
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) throw authError;

      const userToInvite = authData.users.find((u: any) => u.email === inviteEmail);

      if (!userToInvite) {
        toast({
          title: "User not found",
          description: "This user must sign up first before being added to the organization",
          variant: "destructive",
        });
        return;
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('user_organizations')
        .select('id')
        .eq('organization_id', targetOrg.id)
        .eq('user_id', userToInvite.id)
        .maybeSingle();

      if (existingMember) {
        toast({
          title: "Already a member",
          description: "This user is already part of your organization",
          variant: "destructive",
        });
        return;
      }

      // Add to organization
      const { error: insertError } = await supabase
        .from('user_organizations')
        .insert({
          organization_id: targetOrg.id,
          user_id: userToInvite.id,
          role: inviteRole,
        });

      if (insertError) throw insertError;

      toast({
        title: "Member added",
        description: `${inviteEmail} has been added to your organization`,
      });

      setInviteEmail("");
      loadTeamMembers();
    } catch (error) {
      console.error('Failed to invite member:', error);
      toast({
        title: "Failed to add member",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove || !organization) return;

    try {
      // Prevent removing yourself
      if (memberToRemove.user_id === user?.id) {
        toast({
          title: "Cannot remove yourself",
          description: "You cannot remove yourself from the organization",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('user_organizations')
        .delete()
        .eq('id', memberToRemove.id);

      if (error) throw error;

      toast({
        title: "Member removed",
        description: "The team member has been removed from your organization",
      });

      loadTeamMembers();
    } catch (error) {
      console.error('Failed to remove member:', error);
      toast({
        title: "Failed to remove member",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setMemberToRemove(null);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: "admin" | "user" | "super_admin") => {
    if (!targetOrg) return;

    try {
      const { error } = await supabase
        .from('user_organizations')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: "Role updated",
        description: "The team member's role has been changed",
      });

      loadTeamMembers();
    } catch (error) {
      console.error('Failed to update role:', error);
      toast({
        title: "Failed to update role",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  if (orgLoading || loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!targetOrg) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Organization Found</CardTitle>
          <CardDescription>You are not associated with any organization</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Team Management</h2>
        <p className="text-muted-foreground">
          Manage team members for {isOrganizationView && selectedOrganization ? selectedOrganization.business_name : targetOrg.business_name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Team Member
          </CardTitle>
          <CardDescription>Invite existing users to join your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={isInviting}
              />
            </div>
            <div className="w-40">
              <Label htmlFor="role">Role</Label>
              <Select value={inviteRole} onValueChange={(value: "admin" | "user") => setInviteRole(value)}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleInviteMember} disabled={isInviting || !inviteEmail.trim()}>
                {isInviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Member
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            Team Members ({teamMembers.length})
          </CardTitle>
          <CardDescription>Manage roles and remove team members</CardDescription>
        </CardHeader>
        <CardContent>
          {teamMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UsersIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No team members yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.email || member.user_id}
                      {member.user_id === user?.id && (
                        <Badge variant="outline" className="ml-2">You</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={member.role}
                        onValueChange={(value: "admin" | "user" | "super_admin") => handleRoleChange(member.id, value)}
                        disabled={member.user_id === user?.id}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="super_admin">Super Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {new Date(member.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMemberToRemove(member)}
                        disabled={member.user_id === user?.id}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToRemove?.email} from your organization?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
