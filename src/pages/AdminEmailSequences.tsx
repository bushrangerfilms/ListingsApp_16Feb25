import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Pause, Trash2, BarChart } from "lucide-react";
import { toast } from "sonner";
import { EmailSequenceBuilder } from "@/components/EmailSequenceBuilder";
import { SEO } from "@/components/SEO";

interface EmailSequence {
  id: string;
  name: string;
  profile_type: 'seller' | 'buyer';
  trigger_stage: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminEmailSequences() {
  const { organization } = useOrganization();
  const { viewAsOrganizationId, selectedOrganization, isOrganizationView } = useOrganizationView();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingSequence, setEditingSequence] = useState<string | null>(null);

  const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;

  const { data: sequences = [], isLoading: loading } = useQuery({
    queryKey: ['email-sequences', targetOrg?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('email_sequences')
        .select('id, name, profile_type, trigger_stage, is_active')
        .eq('organization_id', targetOrg!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as EmailSequence[];
    },
    enabled: !!targetOrg,
  });

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from('email_sequences')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      toast.success(currentStatus ? 'Sequence paused' : 'Sequence activated');
      queryClient.invalidateQueries({ queryKey: ['email-sequences'] });
    } catch (error) {
      console.error('Error toggling sequence:', error);
      toast.error('Failed to update sequence');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sequence?')) return;

    try {
      const { error } = await (supabase as any)
        .from('email_sequences')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Sequence deleted');
      queryClient.invalidateQueries({ queryKey: ['email-sequences'] });
    } catch (error) {
      console.error('Error deleting sequence:', error);
      toast.error('Failed to delete sequence');
    }
  };

  if (showBuilder) {
    return (
      <EmailSequenceBuilder
        sequenceId={editingSequence}
        onClose={() => {
          setShowBuilder(false);
          setEditingSequence(null);
          queryClient.invalidateQueries({ queryKey: ['email-sequences'] });
        }}
      />
    );
  }

  return (
    <>
      <SEO 
        title="Email Sequences - Admin"
        description="Manage automated email sequences and follow-ups"
      />
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Email Sequences</h1>
            <p className="text-muted-foreground mt-1">
              Automated email campaigns for sellers and buyers
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => navigate('/admin/sequence-analytics')}
              className="gap-2"
            >
              <BarChart className="h-4 w-4" />
              View Analytics
            </Button>
            <Button onClick={() => setShowBuilder(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Sequence
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading sequences...</div>
        ) : sequences.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No email sequences yet</p>
              <Button onClick={() => setShowBuilder(true)}>
                Create Your First Sequence
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {sequences.map((sequence) => (
              <Card key={sequence.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle>{sequence.name}</CardTitle>
                        <Badge variant={sequence.is_active ? "default" : "secondary"}>
                          {sequence.is_active ? 'Active' : 'Paused'}
                        </Badge>
                        <Badge variant="outline">
                          {sequence.profile_type === 'seller' ? 'Sellers' : 'Buyers'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Triggered at stage: <span className="font-medium">{sequence.trigger_stage}</span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleToggleActive(sequence.id, sequence.is_active)}
                      >
                        {sequence.is_active ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingSequence(sequence.id);
                          setShowBuilder(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDelete(sequence.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
