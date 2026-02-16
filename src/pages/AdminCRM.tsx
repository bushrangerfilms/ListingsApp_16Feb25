import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import { useLocale } from "@/hooks/useLocale";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, LayoutList, LayoutGrid, BarChart3, Home, X } from "lucide-react";
import { toast } from "sonner";
import { SellerProfileCard } from "@/components/SellerProfileCard";
import { BuyerProfileCard } from "@/components/BuyerProfileCard";
import { CreateProfileDialog } from "@/components/CreateProfileDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CRMKanbanBoard } from "@/components/CRMKanbanBoard";
import { CRMAnalyticsSection } from "@/components/crm/CRMAnalyticsSection";

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
  valuation_request_id: string | null;
  listed_property_id: string | null;
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
  property_alert_id: string | null;
  interested_properties: string[] | null;
  budget_min: number | null;
  budget_max: number | null;
}

interface Listing {
  id: string;
  title: string;
  address: string | null;
  airtable_record_id: string | null;
}

export default function AdminCRM() {
  const { organization } = useOrganization();
  const { viewAsOrganizationId, selectedOrganization, isOrganizationView } = useOrganizationView();
  const { t } = useLocale();
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [buyers, setBuyers] = useState<BuyerProfile[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("sellers");
  const [sellerFilter, setSellerFilter] = useState<string>("all");
  const [buyerFilter, setBuyerFilter] = useState<string>("all");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [profileType, setProfileType] = useState<"seller" | "buyer">("seller");
  const [viewMode, setViewMode] = useState<"list" | "kanban">(() => {
    return (localStorage.getItem("crm-view-mode") as "list" | "kanban") || "list";
  });

  // Persist view mode preference
  useEffect(() => {
    localStorage.setItem("crm-view-mode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;
    if (targetOrg) {
      fetchProfiles();
    }

    const channel = supabase
      .channel('crm-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'crm', table: 'seller_profiles' },
        fetchProfiles
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'crm', table: 'buyer_profiles' },
        fetchProfiles
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organization, viewAsOrganizationId, selectedOrganization, isOrganizationView]);

  const fetchProfiles = async () => {
    const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;
    if (!targetOrg) return;

    try {
      setLoading(true);
      
      const [sellersResult, buyersResult, listingsResult] = await Promise.all([
        (supabase.schema('crm') as any)
          .from('seller_profiles')
          .select('*')
          .eq('organization_id', targetOrg.id)
          .order('created_at', { ascending: false }),
        (supabase.schema('crm') as any)
          .from('buyer_profiles')
          .select('*')
          .eq('organization_id', targetOrg.id)
          .order('created_at', { ascending: false }),
        (supabase.schema('crm') as any)
          .from('listings')
          .select('id, title, address, airtable_record_id')
          .eq('organization_id', targetOrg.id)
          .order('created_at', { ascending: false })
      ]);

      if (sellersResult.error) throw sellersResult.error;
      if (buyersResult.error) throw buyersResult.error;

      setSellers(sellersResult.data || []);
      setBuyers(buyersResult.data || []);
      setListings(listingsResult.data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
      toast.error(t('crm.toast.profilesLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const filteredSellers = sellers.filter(seller => {
    if (sellerFilter === "all") return true;
    return seller.stage === sellerFilter;
  });

  const filteredBuyers = buyers.filter(buyer => {
    const stageMatch = buyerFilter === "all" || buyer.stage === buyerFilter;
    if (!stageMatch) return false;
    
    if (propertyFilter === "all") return true;
    
    const interestedProperties = buyer.interested_properties || [];
    const selectedListing = listings.find(l => l.id === propertyFilter || l.airtable_record_id === propertyFilter);
    
    if (!selectedListing) return false;
    
    return interestedProperties.includes(selectedListing.id) || 
           (selectedListing.airtable_record_id && interestedProperties.includes(selectedListing.airtable_record_id));
  });
  
  const propertiesWithInterestedBuyers = listings.filter(listing => {
    return buyers.some(buyer => {
      const interestedProperties = buyer.interested_properties || [];
      return interestedProperties.includes(listing.id) || 
             (listing.airtable_record_id && interestedProperties.includes(listing.airtable_record_id));
    });
  });

  const handleOpenCreateDialog = (type: "seller" | "buyer") => {
    setProfileType(type);
    setCreateDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-w-0 overflow-hidden">
      {/* Fixed Header Section */}
      <div className="flex-shrink-0 p-6 pb-4 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">{t('crm.pipeline.title')}</h1>
            <p className="text-muted-foreground">
              {t('crm.pipeline.subtitle')}
            </p>
          </div>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "kanban")}>
            <TabsList>
              <TabsTrigger value="list" className="gap-2">
                <LayoutList className="h-4 w-4" />
                {t('crm.views.list')}
              </TabsTrigger>
              <TabsTrigger value="kanban" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                {t('crm.views.kanban')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="sellers">
              {t('crm.tabs.sellers')} ({sellers.length})
            </TabsTrigger>
            <TabsTrigger value="buyers">
              {t('crm.tabs.buyers')} ({buyers.length})
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              {t('crm.tabs.analytics')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Scrollable Content Section */}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden px-6 pb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col min-w-0">

          {/* Sellers Tab */}
          <TabsContent value="sellers" className="flex-1 min-h-0 min-w-0 overflow-hidden mt-0 data-[state=active]:flex data-[state=active]:flex-col">
            {viewMode === "list" ? (
              <div className="space-y-4 overflow-y-auto flex-1">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <Tabs value={sellerFilter} onValueChange={setSellerFilter}>
                    <TabsList className="flex-wrap h-auto">
                      <TabsTrigger value="all">{t('crm.stages.all')} ({sellers.length})</TabsTrigger>
                      <TabsTrigger value="lead">{t('crm.stages.seller.lead')} ({sellers.filter(s => s.stage === 'lead').length})</TabsTrigger>
                      <TabsTrigger value="valuation_scheduled">{t('crm.stages.seller.valuation_scheduled')} ({sellers.filter(s => s.stage === 'valuation_scheduled').length})</TabsTrigger>
                      <TabsTrigger value="valuation_complete">{t('crm.stages.seller.valuation_complete')} ({sellers.filter(s => s.stage === 'valuation_complete').length})</TabsTrigger>
                      <TabsTrigger value="listed">{t('crm.stages.seller.listed')} ({sellers.filter(s => s.stage === 'listed').length})</TabsTrigger>
                      <TabsTrigger value="under_offer">{t('crm.stages.seller.under_offer')} ({sellers.filter(s => s.stage === 'under_offer').length})</TabsTrigger>
                      <TabsTrigger value="sold">{t('crm.stages.seller.sold')} ({sellers.filter(s => s.stage === 'sold').length})</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Button onClick={() => handleOpenCreateDialog("seller")} className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t('crm.sellers.new')}
                  </Button>
                </div>

                {filteredSellers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    {t('crm.sellers.noResults')}
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {filteredSellers.map((seller) => (
                      <SellerProfileCard key={seller.id} seller={seller} onUpdate={fetchProfiles} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col h-full min-h-0 min-w-0 overflow-hidden">
                <div className="flex items-center justify-between gap-4 mb-4 flex-shrink-0">
                  <span className="text-sm text-muted-foreground">{t('crm.pipeline.dragHint')}</span>
                  <Button onClick={() => handleOpenCreateDialog("seller")} className="gap-2 flex-shrink-0">
                    <Plus className="h-4 w-4" />
                    {t('crm.sellers.new')}
                  </Button>
                </div>
                <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
                  <CRMKanbanBoard type="seller" profiles={sellers} onUpdate={fetchProfiles} />
                </div>
              </div>
            )}
          </TabsContent>

          {/* Buyers Tab */}
          <TabsContent value="buyers" className="flex-1 min-h-0 min-w-0 overflow-hidden mt-0 data-[state=active]:flex data-[state=active]:flex-col">
            {viewMode === "list" ? (
              <div className="space-y-4 overflow-y-auto flex-1">
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Tabs value={buyerFilter} onValueChange={setBuyerFilter}>
                        <TabsList className="flex-wrap h-auto">
                          <TabsTrigger value="all">{t('crm.stages.all')} ({buyers.length})</TabsTrigger>
                          <TabsTrigger value="lead">{t('crm.stages.buyer.lead')} ({buyers.filter(b => b.stage === 'lead').length})</TabsTrigger>
                          <TabsTrigger value="qualified">{t('crm.stages.buyer.qualified')} ({buyers.filter(b => b.stage === 'qualified').length})</TabsTrigger>
                          <TabsTrigger value="viewing_scheduled">{t('crm.stages.buyer.viewing_scheduled')} ({buyers.filter(b => b.stage === 'viewing_scheduled').length})</TabsTrigger>
                          <TabsTrigger value="viewed">{t('crm.stages.buyer.viewed')} ({buyers.filter(b => b.stage === 'viewed').length})</TabsTrigger>
                          <TabsTrigger value="offer_made">{t('crm.stages.buyer.offer_made')} ({buyers.filter(b => b.stage === 'offer_made').length})</TabsTrigger>
                          <TabsTrigger value="sale_agreed">{t('crm.stages.buyer.sale_agreed')} ({buyers.filter(b => b.stage === 'sale_agreed').length})</TabsTrigger>
                          <TabsTrigger value="purchased">{t('crm.stages.buyer.purchased')} ({buyers.filter(b => b.stage === 'purchased').length})</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                    <Button onClick={() => handleOpenCreateDialog("buyer")} className="gap-2">
                      <Plus className="h-4 w-4" />
                      {t('crm.buyers.new')}
                    </Button>
                  </div>
                  
                  {propertiesWithInterestedBuyers.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Home className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{t('crm.buyers.filterByProperty')}</span>
                      <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                        <SelectTrigger className="w-[280px]" data-testid="select-property-filter">
                          <SelectValue placeholder={t('crm.buyers.allProperties')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('crm.buyers.allProperties')}</SelectItem>
                          {propertiesWithInterestedBuyers.map(listing => (
                            <SelectItem key={listing.id} value={listing.id}>
                              {listing.address || listing.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {propertyFilter !== "all" && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setPropertyFilter("all")}
                          data-testid="button-clear-property-filter"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      {propertyFilter !== "all" && (
                        <span className="text-sm text-muted-foreground">
                          {filteredBuyers.length === 1 
                            ? t('crm.buyers.showingInterested', { count: filteredBuyers.length })
                            : t('crm.buyers.showingInterestedPlural', { count: filteredBuyers.length })}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {filteredBuyers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    {t('crm.buyers.noResults')}
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {filteredBuyers.map((buyer) => (
                      <BuyerProfileCard key={buyer.id} buyer={buyer} onUpdate={fetchProfiles} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col h-full min-h-0 min-w-0 overflow-hidden">
                <div className="flex items-center justify-between gap-4 mb-4 flex-shrink-0">
                  <span className="text-sm text-muted-foreground">{t('crm.pipeline.dragHint')}</span>
                  <Button onClick={() => handleOpenCreateDialog("buyer")} className="gap-2 flex-shrink-0">
                    <Plus className="h-4 w-4" />
                    {t('crm.buyers.new')}
                  </Button>
                </div>
                <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
                  <CRMKanbanBoard type="buyer" profiles={buyers} onUpdate={fetchProfiles} />
                </div>
              </div>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="flex-1 overflow-y-auto mt-0">
            <CRMAnalyticsSection />
          </TabsContent>
        </Tabs>
      </div>

      <CreateProfileDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
        profileType={profileType}
        onSuccess={fetchProfiles}
      />
    </div>
  );
}
