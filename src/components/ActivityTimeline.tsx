import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Mail, Phone, FileText, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface Activity {
  id: string;
  activity_type: string;
  title: string;
  description: string | null;
  created_at: string;
}

interface ActivityTimelineProps {
  profileId: string;
  profileType: "seller" | "buyer";
}

const ACTIVITY_ICONS: Record<string, any> = {
  note: FileText,
  email: Mail,
  call: Phone,
  stage_change: TrendingUp,
  meeting: Calendar,
  email_sent: Mail,
  email_opened: Mail,
  email_clicked: Mail,
};

export function ActivityTimeline({ profileId, profileType }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchActivities();

    const channel = supabase
      .channel(`activities-${profileId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'crm_activities',
          filter: profileType === 'seller' 
            ? `seller_profile_id=eq.${profileId}`
            : `buyer_profile_id=eq.${profileId}`
        },
        fetchActivities
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, profileType]);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('crm_activities')
        .select('id, activity_type, title, description, created_at')
        .eq(profileType === 'seller' ? 'seller_profile_id' : 'buyer_profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setAdding(true);
    try {
      const { error } = await supabase
        .from('crm_activities')
        .insert({
          [profileType === 'seller' ? 'seller_profile_id' : 'buyer_profile_id']: profileId,
          activity_type: 'note',
          title: 'Note added',
          description: newNote,
        });

      if (error) throw error;

      toast.success('Note added');
      setNewNote("");
      fetchActivities();
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Failed to add note');
    } finally {
      setAdding(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading activities...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-semibold">Add Note</label>
        <Textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note about this contact..."
          rows={3}
        />
        <Button onClick={handleAddNote} disabled={adding || !newNote.trim()}>
          {adding ? 'Adding...' : 'Add Note'}
        </Button>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Activity History</h4>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activities yet</p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => {
              const Icon = ACTIVITY_ICONS[activity.activity_type] || FileText;
              return (
                <div key={activity.id} className="flex gap-3 text-sm">
                  <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">{activity.title}</p>
                    {activity.description && (
                      <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                        {activity.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(activity.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
