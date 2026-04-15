import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlayCircle, PauseCircle, StopCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SequenceControlsProps {
  profileId: string;
  profileType: 'buyer' | 'seller';
  automationStatus: { active: boolean; sequence_name?: string } | null;
  onUpdate: () => void;
}

interface EmailSequence {
  id: string;
  name: string;
  profile_type: string;
}

export const SequenceControls = ({ 
  profileId, 
  profileType, 
  automationStatus,
  onUpdate 
}: SequenceControlsProps) => {
  const [sequences, setSequences] = useState<EmailSequence[]>([]);
  const [selectedSequence, setSelectedSequence] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const fetchSequences = async () => {
    const { data } = await (supabase as any)
      .from('email_sequences')
      .select('id, name, profile_type')
      .eq('profile_type', profileType)
      .eq('is_active', true)
      .order('name');

    if (data) setSequences(data);
  };

  const handleAction = async (action: 'start' | 'pause' | 'stop') => {
    if (action === 'start' && !selectedSequence) {
      toast.error('Please select a sequence to start');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-profile-sequence', {
        body: {
          profileId,
          profileType,
          action,
          sequenceId: action === 'start' ? selectedSequence : undefined,
        },
      });

      if (error) throw error;

      toast.success(
        action === 'start' 
          ? 'Sequence started successfully'
          : action === 'pause'
          ? 'Sequence paused'
          : 'Sequence stopped'
      );
      
      onUpdate();
    } catch (error: any) {
      console.error('Error managing sequence:', error);
      toast.error(error.message || 'Failed to manage sequence');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        <span className="text-sm font-medium">
          {automationStatus?.active 
            ? `Active: ${automationStatus.sequence_name}`
            : 'No Active Sequence'}
        </span>
      </div>

      {!automationStatus?.active && (
        <div className="flex gap-2">
          <Select value={selectedSequence} onValueChange={setSelectedSequence} onOpenChange={(open) => open && fetchSequences()}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select sequence..." />
            </SelectTrigger>
            <SelectContent>
              {sequences.map((seq) => (
                <SelectItem key={seq.id} value={seq.id}>
                  {seq.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => handleAction('start')}
            disabled={loading || !selectedSequence}
          >
            <PlayCircle className="h-4 w-4 mr-1" />
            Start
          </Button>
        </div>
      )}

      {automationStatus?.active && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAction('pause')}
            disabled={loading}
          >
            <PauseCircle className="h-4 w-4 mr-1" />
            Pause
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleAction('stop')}
            disabled={loading}
          >
            <StopCircle className="h-4 w-4 mr-1" />
            Stop
          </Button>
        </div>
      )}
    </div>
  );
};
