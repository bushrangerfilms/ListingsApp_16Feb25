import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Phone, Home, Calendar, FileText, DollarSign, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { SequenceControls } from "@/components/SequenceControls";
import { EmailAnalytics } from "@/components/EmailAnalytics";
import { useState, useEffect } from "react";

interface BuyerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  bedrooms_required: number[] | null;
  stage: string;
  source: string;
  notes: string | null;
  created_at: string;
  last_contact_at: string | null;
  interested_properties: string[] | null;
  budget_min: number | null;
  budget_max: number | null;
}

interface BuyerProfileCardProps {
  buyer: BuyerProfile;
  onUpdate: () => void;
}

const BUYER_STAGES = [
  { value: 'lead', label: 'Lead' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'viewing_scheduled', label: 'Viewing Scheduled' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'offer_made', label: 'Offer Made' },
  { value: 'sale_agreed', label: 'Sale Agreed' },
  { value: 'purchased', label: 'Purchased' },
  { value: 'lost', label: 'Lost' },
];

export function BuyerProfileCard({ buyer, onUpdate }: BuyerProfileCardProps) {
  const [showTimeline, setShowTimeline] = useState(false);
  const [automationStatus, setAutomationStatus] = useState<{ active: boolean; sequence_name: string } | null>(null);

  useEffect(() => {
    fetchAutomationStatus();
  }, [buyer.id]);

  const fetchAutomationStatus = async () => {
    const { data } = await (supabase as any)
      .from('profile_email_queue')
      .select('*, email_sequence:email_sequences(name)')
      .eq('buyer_profile_id', buyer.id)
      .eq('status', 'pending')
      .maybeSingle();
    
    if (data) {
      setAutomationStatus({ 
        active: true, 
        sequence_name: data.email_sequence?.name || 'Active Sequence' 
      });
    }
  };

  const handleStageChange = async (newStage: string) => {
    try {
      const { error } = await supabase
        .from('buyer_profiles')
        .update({ stage: newStage as any })
        .eq('id', buyer.id);

      if (error) throw error;

      // Log stage change activity
      await supabase.from('crm_activities').insert({
        buyer_profile_id: buyer.id,
        activity_type: 'stage_change',
        title: `Stage changed to ${BUYER_STAGES.find(s => s.value === newStage)?.label}`,
      });

      toast.success('Stage updated');
      onUpdate();
    } catch (error) {
      console.error('Error updating stage:', error);
      toast.error('Failed to update stage');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatBedrooms = (bedrooms: number[] | null) => {
    if (!bedrooms || bedrooms.length === 0) return 'Not specified';
    return bedrooms.map(b => b === 5 ? '5+' : b).join(', ') + ' bed';
  };

  const formatBudget = () => {
    if (!buyer.budget_min && !buyer.budget_max) return null;
    if (buyer.budget_min && buyer.budget_max) {
      return `€${buyer.budget_min.toLocaleString()} - €${buyer.budget_max.toLocaleString()}`;
    }
    if (buyer.budget_min) return `From €${buyer.budget_min.toLocaleString()}`;
    if (buyer.budget_max) return `Up to €${buyer.budget_max.toLocaleString()}`;
  };

  const getSourceBadge = (source: string) => {
    const badges: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      property_alert: { label: 'Property Alert', variant: 'default' },
      property_enquiry: { label: 'Property Enquiry', variant: 'secondary' },
      manual: { label: 'Manual', variant: 'outline' },
    };
    const badge = badges[source] || { label: source, variant: 'outline' };
    return <Badge variant={badge.variant}>{badge.label}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl font-semibold">{buyer.name}</h3>
              {getSourceBadge(buyer.source)}
              {automationStatus?.active && (
                <Badge variant="secondary" className="gap-1">
                  <Zap className="h-3 w-3" />
                  {automationStatus.sequence_name}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                <span>{formatBedrooms(buyer.bedrooms_required)}</span>
              </div>
              {formatBudget() && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  <span>{formatBudget()}</span>
                </div>
              )}
            </div>
          </div>
          <Select value={buyer.stage} onValueChange={handleStageChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUYER_STAGES.map((stage) => (
                <SelectItem key={stage.value} value={stage.value}>
                  {stage.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${buyer.email}`} className="hover:underline">
                {buyer.email}
              </a>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a href={`tel:${buyer.phone}`} className="hover:underline">
                {buyer.phone}
              </a>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Added: {formatDate(buyer.created_at)}</span>
            </div>
            {buyer.last_contact_at && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Last Contact: {formatDate(buyer.last_contact_at)}</span>
              </div>
            )}
          </div>
        </div>

        {buyer.interested_properties && buyer.interested_properties.length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-sm font-semibold mb-2">Interested Properties:</p>
            <p className="text-sm text-muted-foreground">
              {buyer.interested_properties.length} propert{buyer.interested_properties.length === 1 ? 'y' : 'ies'}
            </p>
          </div>
        )}

        {buyer.notes && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Notes:</p>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {buyer.notes}
            </p>
          </div>
        )}

        <div className="pt-4 border-t flex gap-2">
          <Button 
            variant="outline"
            onClick={() => window.location.href = `mailto:${buyer.email}`}
            className="gap-2"
          >
            <Mail className="h-4 w-4" />
            Email
          </Button>
          <Button 
            variant="outline"
            onClick={() => setShowTimeline(!showTimeline)}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            {showTimeline ? 'Hide' : 'Show'} Activity
          </Button>
        </div>

        <div className="pt-4 border-t space-y-4">
          <div>
            <h4 className="text-sm font-semibold mb-3">Email Automation</h4>
            <SequenceControls
              profileId={buyer.id}
              profileType="buyer"
              automationStatus={automationStatus}
              onUpdate={() => {
                fetchAutomationStatus();
                onUpdate();
              }}
            />
          </div>
          <EmailAnalytics profileId={buyer.id} profileType="buyer" />
        </div>

        {showTimeline && (
          <div className="pt-4 border-t">
            <ActivityTimeline profileId={buyer.id} profileType="buyer" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
