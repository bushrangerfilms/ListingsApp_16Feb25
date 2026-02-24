import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Phone, MapPin, Calendar, FileText, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { SequenceControls } from "@/components/SequenceControls";
import { EmailAnalytics } from "@/components/EmailAnalytics";
import { useState, useEffect } from "react";

interface SellerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  property_address: string | null;
  stage: string;
  source: string;
  notes: string | null;
  created_at: string;
  last_contact_at: string | null;
}

interface SellerProfileCardProps {
  seller: SellerProfile;
  onUpdate: () => void;
}

const SELLER_STAGES = [
  { value: 'lead', label: 'Lead' },
  { value: 'valuation_scheduled', label: 'Valuation Scheduled' },
  { value: 'valuation_complete', label: 'Valuation Complete' },
  { value: 'listed', label: 'Listed' },
  { value: 'under_offer', label: 'Under Offer' },
  { value: 'sold', label: 'Sold' },
  { value: 'lost', label: 'Lost' },
];

export function SellerProfileCard({ seller, onUpdate }: SellerProfileCardProps) {
  const [showTimeline, setShowTimeline] = useState(false);
  const [automationStatus, setAutomationStatus] = useState<{ active: boolean; sequence_name: string } | null>(null);

  useEffect(() => {
    fetchAutomationStatus();
  }, [seller.id]);

  const fetchAutomationStatus = async () => {
    const { data } = await (supabase as any)
      .from('profile_email_queue')
      .select('id, status, email_sequence:email_sequences(name)')
      .eq('seller_profile_id', seller.id)
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
        .from('seller_profiles')
        .update({ stage: newStage as any })
        .eq('id', seller.id);

      if (error) throw error;

      // Log stage change activity
      await supabase.from('crm_activities').insert({
        seller_profile_id: seller.id,
        activity_type: 'stage_change',
        title: `Stage changed to ${SELLER_STAGES.find(s => s.value === newStage)?.label}`,
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

  const getSourceBadge = (source: string) => {
    const badges: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      valuation_request: { label: 'Valuation Request', variant: 'default' },
      manual: { label: 'Manual', variant: 'secondary' },
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
              <h3 className="text-xl font-semibold">{seller.name}</h3>
              {getSourceBadge(seller.source)}
              {automationStatus?.active && (
                <Badge variant="secondary" className="gap-1">
                  <Zap className="h-3 w-3" />
                  {automationStatus.sequence_name}
                </Badge>
              )}
            </div>
            {seller.property_address && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{seller.property_address}</span>
              </div>
            )}
          </div>
          <Select value={seller.stage} onValueChange={handleStageChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SELLER_STAGES.map((stage) => (
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
              <a href={`mailto:${seller.email}`} className="hover:underline">
                {seller.email}
              </a>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a href={`tel:${seller.phone}`} className="hover:underline">
                {seller.phone}
              </a>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Added: {formatDate(seller.created_at)}</span>
            </div>
            {seller.last_contact_at && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Last Contact: {formatDate(seller.last_contact_at)}</span>
              </div>
            )}
          </div>
        </div>

        {seller.notes && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Notes:</p>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {seller.notes}
            </p>
          </div>
        )}

        <div className="pt-4 border-t flex gap-2">
          <Button 
            variant="outline"
            onClick={() => window.location.href = `mailto:${seller.email}`}
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
              profileId={seller.id}
              profileType="seller"
              automationStatus={automationStatus}
              onUpdate={() => {
                fetchAutomationStatus();
                onUpdate();
              }}
            />
          </div>
          <EmailAnalytics profileId={seller.id} profileType="seller" />
        </div>

        {showTimeline && (
          <div className="pt-4 border-t">
            <ActivityTimeline profileId={seller.id} profileType="seller" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
