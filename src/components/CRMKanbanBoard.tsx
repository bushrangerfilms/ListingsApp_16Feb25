import { useState, useMemo, useRef, useEffect } from "react";
import { DndContext, DragEndEvent, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProfileDetailDialog } from "@/components/ProfileDetailDialog";
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

interface CRMKanbanBoardProps {
  type: "seller" | "buyer";
  profiles: SellerProfile[] | BuyerProfile[];
  onUpdate: () => void;
}

const SELLER_STAGES = [
  { value: 'lead', labelKey: 'crm.stages.seller.lead', color: 'bg-blue-100 dark:bg-blue-950 border-blue-300 dark:border-blue-700' },
  { value: 'valuation_scheduled', labelKey: 'crm.stages.seller.valuation_scheduled', color: 'bg-purple-100 dark:bg-purple-950 border-purple-300 dark:border-purple-700' },
  { value: 'valuation_complete', labelKey: 'crm.stages.seller.valuation_complete', color: 'bg-indigo-100 dark:bg-indigo-950 border-indigo-300 dark:border-indigo-700' },
  { value: 'listed', labelKey: 'crm.stages.seller.listed', color: 'bg-orange-100 dark:bg-orange-950 border-orange-300 dark:border-orange-700' },
  { value: 'under_offer', labelKey: 'crm.stages.seller.under_offer', color: 'bg-amber-100 dark:bg-amber-950 border-amber-300 dark:border-amber-700' },
  { value: 'sold', labelKey: 'crm.stages.seller.sold', color: 'bg-green-100 dark:bg-green-950 border-green-300 dark:border-green-700' },
  { value: 'lost', labelKey: 'crm.stages.seller.lost', color: 'bg-gray-100 dark:bg-gray-950 border-gray-300 dark:border-gray-700' },
];

const BUYER_STAGES = [
  { value: 'lead', labelKey: 'crm.stages.buyer.lead', color: 'bg-blue-100 dark:bg-blue-950 border-blue-300 dark:border-blue-700' },
  { value: 'qualified', labelKey: 'crm.stages.buyer.qualified', color: 'bg-cyan-100 dark:bg-cyan-950 border-cyan-300 dark:border-cyan-700' },
  { value: 'viewing_scheduled', labelKey: 'crm.stages.buyer.viewing_scheduled', color: 'bg-purple-100 dark:bg-purple-950 border-purple-300 dark:border-purple-700' },
  { value: 'viewed', labelKey: 'crm.stages.buyer.viewed', color: 'bg-indigo-100 dark:bg-indigo-950 border-indigo-300 dark:border-indigo-700' },
  { value: 'offer_made', labelKey: 'crm.stages.buyer.offer_made', color: 'bg-orange-100 dark:bg-orange-950 border-orange-300 dark:border-orange-700' },
  { value: 'sale_agreed', labelKey: 'crm.stages.buyer.sale_agreed', color: 'bg-amber-100 dark:bg-amber-950 border-amber-300 dark:border-amber-700' },
  { value: 'purchased', labelKey: 'crm.stages.buyer.purchased', color: 'bg-green-100 dark:bg-green-950 border-green-300 dark:border-green-700' },
  { value: 'lost', labelKey: 'crm.stages.buyer.lost', color: 'bg-gray-100 dark:bg-gray-950 border-gray-300 dark:border-gray-700' },
];

export function CRMKanbanBoard({ type, profiles, onUpdate }: CRMKanbanBoardProps) {
  const { t } = useLocale();
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [activeProfile, setActiveProfile] = useState<SellerProfile | BuyerProfile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draggedProfile, setDraggedProfile] = useState<SellerProfile | BuyerProfile | null>(null);
  const [localProfiles, setLocalProfiles] = useState<(SellerProfile | BuyerProfile)[]>(profiles);
  const [pendingUpdate, setPendingUpdate] = useState<string | null>(null);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Sync local state when profiles prop changes (from parent refetch)
  // But preserve local changes if we have a pending optimistic update
  useEffect(() => {
    if (pendingUpdate) {
      // Merge: keep our optimistic stage change, update everything else
      setLocalProfiles((prev) => {
        const updatedProfile = prev.find((p) => p.id === pendingUpdate);
        if (!updatedProfile) return profiles;
        return profiles.map((p) =>
          p.id === pendingUpdate ? { ...p, stage: updatedProfile.stage } : p
        );
      });
    } else {
      setLocalProfiles(profiles);
    }
  }, [profiles, pendingUpdate]);
  
  // Reset scroll position to the left (Lead column) when component mounts or profiles change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, [type]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const stages = type === "seller" ? SELLER_STAGES : BUYER_STAGES;

  const filteredProfiles = useMemo(() => {
    return localProfiles.filter((profile) => {
      const matchesSearch =
        profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSource = sourceFilter === "all" || profile.source === sourceFilter;
      return matchesSearch && matchesSource;
    });
  }, [localProfiles, searchQuery, sourceFilter]);

  const getProfilesByStage = (stageValue: string) => {
    return filteredProfiles.filter((profile) => profile.stage === stageValue);
  };

  const handleDragStart = (event: any) => {
    const profile = profiles.find((p) => p.id === event.active.id);
    setDraggedProfile(profile || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggedProfile(null);
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const profileId = active.id as string;
    const newStage = over.id as string;
    
    // Find the profile and its old stage for potential rollback
    const profile = localProfiles.find((p) => p.id === profileId);
    if (!profile) return;
    const oldStage = profile.stage;
    
    // Mark this profile as having a pending update (prevents prop sync from overwriting)
    setPendingUpdate(profileId);
    
    // Optimistically update local state immediately
    setLocalProfiles((prevProfiles) =>
      prevProfiles.map((p) =>
        p.id === profileId ? { ...p, stage: newStage } : p
      )
    );

    try {
      const table = type === "seller" ? "seller_profiles" : "buyer_profiles";
      const { error } = await (supabase.schema('crm') as any).from(table).update({ stage: newStage }).eq("id", profileId);

      if (error) throw error;

      // Log stage change activity
      const newStageObj = stages.find((s) => s.value === newStage);
      const translatedStageName = newStageObj ? t(newStageObj.labelKey) : newStage;
      await (supabase.schema('crm') as any).from("crm_activities").insert({
        [`${type}_profile_id`]: profileId,
        activity_type: "stage_change",
        title: t('crm.activity.stageChange', { stage: translatedStageName }),
      });

      toast.success(t('crm.toast.stageUpdated'));
      
      // Clear pending update after a delay to allow realtime update to complete
      setTimeout(() => setPendingUpdate(null), 1000);
      onUpdate();
    } catch (error) {
      console.error("Error updating stage:", error);
      toast.error(t('crm.toast.stageUpdateFailed'));
      // Revert optimistic update on error
      setLocalProfiles((prevProfiles) =>
        prevProfiles.map((p) =>
          p.id === profileId ? { ...p, stage: oldStage } : p
        )
      );
      setPendingUpdate(null);
    }
  };

  const handleCardClick = (profile: SellerProfile | BuyerProfile) => {
    setActiveProfile(profile);
    setDialogOpen(true);
  };

  const getSourceBadge = (source: string) => {
    const badges: Record<string, { labelKey: string; variant: "default" | "secondary" | "outline" }> = {
      property_alert: { labelKey: "crm.sources.property_alert", variant: "default" },
      property_enquiry: { labelKey: "crm.sources.property_enquiry", variant: "secondary" },
      valuation_request: { labelKey: "crm.sources.valuation_request", variant: "default" },
      manual: { labelKey: "crm.sources.manual", variant: "outline" },
    };
    const badge = badges[source] || { labelKey: source, variant: "outline" };
    return <Badge variant={badge.variant} className="text-xs">{t(badge.labelKey)}</Badge>;
  };

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0 overflow-hidden">
      {/* Search and Filter Controls - Fixed, never scrolls */}
      <div className="flex flex-col sm:flex-row gap-4 flex-shrink-0 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('crm.search.placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder={t('crm.sources.filterBySource')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('crm.sources.all')}</SelectItem>
            <SelectItem value="manual">{t('crm.sources.manual')}</SelectItem>
            <SelectItem value="property_alert">{t('crm.sources.property_alert')}</SelectItem>
            <SelectItem value="property_enquiry">{t('crm.sources.property_enquiry')}</SelectItem>
            {type === "seller" && <SelectItem value="valuation_request">{t('crm.sources.valuation_request')}</SelectItem>}
          </SelectContent>
        </Select>
      </div>

      {/* Kanban Board - Only this scrolls horizontally */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div ref={scrollContainerRef} className="flex-1 min-h-0 min-w-0 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-4 w-max pb-4 h-full">
          {stages.map((stage) => {
            const stageProfiles = getProfilesByStage(stage.value);
            const stageLabel = t(stage.labelKey);
            return (
              <DroppableColumn
                key={stage.value}
                stageValue={stage.value}
                stageLabel={stageLabel}
                stageColor={stage.color}
                profileCount={stageProfiles.length}
                profileType={type}
              >
                {stageProfiles.length === 0 ? (
                  <div className="text-center py-8 px-3 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                    {stage.value === 'lead' ? (
                      type === 'seller' ? (
                        <span>{t('crm.sellers.leadHint')}</span>
                      ) : (
                        <span>{t('crm.buyers.leadHint')}</span>
                      )
                    ) : (
                      <span>{t('crm.stages.noProfilesYet', { stage: stageLabel })}</span>
                    )}
                  </div>
                ) : (
                  stageProfiles.map((profile) => (
                    <DraggableCard
                      key={profile.id}
                      profile={profile}
                      onClick={() => handleCardClick(profile)}
                      getSourceBadge={getSourceBadge}
                    />
                  ))
                )}
              </DroppableColumn>
            );
          })}
          </div>
        </div>

        <DragOverlay>
          {draggedProfile ? (
            <KanbanCard
              profile={draggedProfile}
              onClick={() => {}}
              getSourceBadge={getSourceBadge}
              isDragging
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Profile Detail Dialog */}
      <ProfileDetailDialog
        profile={activeProfile}
        type={type}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onUpdate={() => {
          onUpdate();
          setDialogOpen(false);
        }}
      />
    </div>
  );
}

interface DroppableColumnProps {
  stageValue: string;
  stageLabel: string;
  stageColor: string;
  profileCount: number;
  profileType: "seller" | "buyer";
  children: React.ReactNode;
}

function DroppableColumn({ stageValue, stageLabel, stageColor, profileCount, profileType, children }: DroppableColumnProps) {
  const { t } = useLocale();
  const { isOver, setNodeRef } = useDroppable({
    id: stageValue,
  });

  const profileKey = profileType === "seller" ? "crm.sellers" : "crm.buyers";

  return (
    <div className="flex-shrink-0 w-80">
      <div
        ref={setNodeRef}
        className={`rounded-lg border-2 ${stageColor} p-4 min-h-[600px] transition-colors ${
          isOver ? "ring-2 ring-primary ring-offset-2" : ""
        }`}
      >
        <div className="mb-4">
          <h3 className="font-semibold text-lg mb-1">{stageLabel}</h3>
          <p className="text-sm text-muted-foreground">
            {profileCount} {profileCount === 1 ? t(`${profileKey}.profile`) : t(`${profileKey}.profiles`)}
          </p>
        </div>
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  );
}

interface DraggableCardProps {
  profile: SellerProfile | BuyerProfile;
  onClick: () => void;
  getSourceBadge: (source: string) => JSX.Element;
}

function DraggableCard({ profile, onClick, getSourceBadge }: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: profile.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
        isDragging ? "opacity-50 z-50" : ""
      }`}
      {...listeners}
      {...attributes}
    >
      <CardContent className="p-4 space-y-2" onClick={onClick}>
        <div className="font-semibold truncate">{profile.name}</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
          <Mail className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{profile.email}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {getSourceBadge(profile.source)}
        </div>
      </CardContent>
    </Card>
  );
}

interface KanbanCardProps {
  profile: SellerProfile | BuyerProfile;
  onClick: () => void;
  getSourceBadge: (source: string) => JSX.Element;
  isDragging?: boolean;
}

function KanbanCard({ profile, onClick, getSourceBadge, isDragging = false }: KanbanCardProps) {
  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${
        isDragging ? "opacity-50 rotate-2" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-2">
        <div className="font-semibold truncate">{profile.name}</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
          <Mail className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{profile.email}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {getSourceBadge(profile.source)}
        </div>
      </CardContent>
    </Card>
  );
}
