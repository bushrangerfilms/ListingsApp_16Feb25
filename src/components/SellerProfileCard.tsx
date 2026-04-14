import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Phone, MapPin, Calendar, FileText, Zap, Target, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { SequenceControls } from "@/components/SequenceControls";
import { EmailAnalytics } from "@/components/EmailAnalytics";
import { useState, useEffect, Fragment } from "react";
import { useLocale } from "@/hooks/useLocale";

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
  /** When true, renders a small red "NEW" badge next to the seller's name.
   * Set by AdminCRM for contacts created after the user's pre-mount
   * CRM-visit acknowledgement timestamp. */
  isNew?: boolean;
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

export function SellerProfileCard({ seller, onUpdate, isNew = false }: SellerProfileCardProps) {
  const { locale } = useLocale();
  const [showTimeline, setShowTimeline] = useState(false);
  const [automationStatus, setAutomationStatus] = useState<{ active: boolean; sequence_name: string } | null>(null);
  const [leadSubmission, setLeadSubmission] = useState<any>(null);

  useEffect(() => {
    fetchAutomationStatus();
    if (seller.source === "lead_magnet") {
      fetchLeadSubmission();
    }
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

  const fetchLeadSubmission = async () => {
    const { data } = await supabase
      .from("lead_submissions")
      .select(
        "id, created_at, score, band, confidence, estimate_low, estimate_high, " +
        "utm_source, utm_campaign, post_id, answers_json, resolved_town, " +
        "resolved_county, resolution_confidence, lead_magnets(type)"
      )
      .eq("seller_profile_id", seller.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) setLeadSubmission(data);
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
    return new Date(dateString).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getSourceBadge = (source: string) => {
    const badges: Record<string, { label: string; variant: "default" | "secondary" | "outline"; className?: string }> = {
      valuation_request: { label: 'Valuation Request', variant: 'default' },
      lead_magnet: { label: 'Lead Magnet', variant: 'default', className: 'bg-purple-600 hover:bg-purple-700' },
      manual: { label: 'Manual', variant: 'secondary' },
    };
    const badge = badges[source] || { label: source, variant: 'outline' as const };
    return <Badge variant={badge.variant} className={badge.className}>{badge.label}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl font-semibold">{seller.name}</h3>
              {isNew && (
                <Badge
                  variant="destructive"
                  className="text-[10px] px-1.5 py-0 h-4 font-bold uppercase tracking-wide"
                  data-testid="badge-new-seller"
                >
                  New
                </Badge>
              )}
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
            <SelectTrigger className="w-full sm:w-[200px]">
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

        {/* Lead Magnet Attribution */}
        {seller.source === "lead_magnet" && leadSubmission && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-purple-600" />
              <p className="text-sm font-semibold">Lead Source</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Type</div>
              <div className="font-medium">
                {(leadSubmission.lead_magnets as any)?.type?.replace(/_/g, " ") || "Lead Magnet"}
              </div>
              {leadSubmission.band && (
                <>
                  <div className="text-muted-foreground">Readiness</div>
                  <div className="font-medium flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{leadSubmission.band}</Badge>
                    {leadSubmission.score != null && <span className="text-xs text-muted-foreground">({leadSubmission.score}/100)</span>}
                  </div>
                </>
              )}
              {leadSubmission.estimate_low && leadSubmission.estimate_high && (
                <>
                  <div className="text-muted-foreground">Estimate</div>
                  <div className="font-medium flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                    {`€${leadSubmission.estimate_low.toLocaleString()} – €${leadSubmission.estimate_high.toLocaleString()}`}
                    {leadSubmission.confidence && (
                      <Badge variant="outline" className="text-[10px]">{leadSubmission.confidence}</Badge>
                    )}
                  </div>
                </>
              )}
              {leadSubmission.utm_source && (
                <>
                  <div className="text-muted-foreground">Source</div>
                  <div className="font-medium">{leadSubmission.utm_source}</div>
                </>
              )}
              {leadSubmission.utm_campaign && (
                <>
                  <div className="text-muted-foreground">Campaign</div>
                  <div className="font-medium">{leadSubmission.utm_campaign}</div>
                </>
              )}
              <div className="text-muted-foreground">Submitted</div>
              <div className="font-medium">{formatDate(leadSubmission.created_at)}</div>
            </div>

            {leadSubmission.answers_json && (
              <QuizResponsesSection
                answers={leadSubmission.answers_json as Record<string, unknown>}
                resolvedTown={leadSubmission.resolved_town}
                resolvedCounty={leadSubmission.resolved_county}
                resolutionConfidence={leadSubmission.resolution_confidence}
              />
            )}
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

// Key → display-label mapping mirrored from worthEstimateSteps in
// LeadMagnetQuiz.tsx. TODO (Issue #6): lift to shared locale config
// so non-Irish markets can swap labels.
const QUIZ_FIELD_LABELS: Record<string, string> = {
  eircode: "Eircode",
  town: "Town / area (user-typed)",
  county: "County (user-typed)",
  property_type: "Property type",
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  floor_area_sqm: "Floor area (sqm)",
  land_size_acres: "Land size (acres)",
  property_condition: "Condition",
  property_age: "Approximate age",
  recent_renovations: "Recent renovations",
  occupancy: "Current occupancy",
  ber_rating: "BER rating",
  parking: "Parking",
  outdoor_space: "Outdoor space",
};

const QUIZ_FIELD_ORDER = [
  "eircode",
  "town",
  "county",
  "property_type",
  "bedrooms",
  "bathrooms",
  "floor_area_sqm",
  "land_size_acres",
  "property_age",
  "property_condition",
  "ber_rating",
  "parking",
  "outdoor_space",
  "recent_renovations",
  "occupancy",
];

interface QuizResponsesSectionProps {
  answers: Record<string, unknown>;
  resolvedTown?: string | null;
  resolvedCounty?: string | null;
  resolutionConfidence?: string | null;
}

function QuizResponsesSection({
  answers,
  resolvedTown,
  resolvedCounty,
  resolutionConfidence,
}: QuizResponsesSectionProps) {
  const renderedKeys = QUIZ_FIELD_ORDER.filter((k) => {
    const v = answers[k];
    return v !== undefined && v !== null && v !== "";
  });

  if (renderedKeys.length === 0 && !resolvedTown) return null;

  return (
    <div className="space-y-2 pt-4 mt-3 border-t">
      <h4 className="text-sm font-semibold">Quiz Responses</h4>
      {resolvedTown && resolvedCounty && (
        <div className="p-3 rounded-md bg-muted/40 space-y-1">
          <p className="text-xs text-muted-foreground">AI-resolved location</p>
          <p className="text-sm font-medium">
            {resolvedTown}, Co. {resolvedCounty}
            {resolutionConfidence && (
              <Badge variant="outline" className="ml-2 text-[10px]">
                {resolutionConfidence} confidence
              </Badge>
            )}
          </p>
        </div>
      )}
      {renderedKeys.length > 0 && (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
          {renderedKeys.map((key) => (
            <Fragment key={key}>
              <dt className="text-muted-foreground">{QUIZ_FIELD_LABELS[key] ?? key}</dt>
              <dd className="font-medium">{String(answers[key])}</dd>
            </Fragment>
          ))}
        </dl>
      )}
    </div>
  );
}
