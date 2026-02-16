import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListingCard } from "@/components/ListingCard";
import { StatusUpdateDialog } from "@/components/StatusUpdateDialog";
import { EditListingDialog } from "@/components/EditListingDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Download, Loader2, ArrowUpDown, Home, Key, Palmtree } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocale } from "@/hooks/useLocale";
import { usePropertyServices } from "@/hooks/usePropertyServices";
import { useEndCardSetupCheck } from "@/hooks/useEndCardSetupCheck";
import { EndCardSetupBanner } from "@/components/EndCardSetupBanner";
import { useSocialConnectionCheck } from "@/hooks/useSocialConnectionCheck";
import { SocialConnectionBanner } from "@/components/SocialConnectionBanner";

interface Listing {
  id: string;
  title: string;
  status: string;
  category?: string;
  price: number;
  addressLine1: string;
  addressTown: string;
  county: string;
  bedrooms: number;
  bathrooms: number;
  buildingType: string;
  heroPhoto: string;
  datePosted: string;
  statusChangedDate?: string;
  newStatusSetDate?: string;
  archived?: boolean;
}

const ListingsDashboard = () => {
  const { organization } = useOrganization();
  const { viewAsOrganizationId, selectedOrganization, isOrganizationView } = useOrganizationView();
  const navigate = useNavigate();
  const { t } = useLocale();
  const { enabledCategories, salesEnabled, rentalsEnabled, holidayRentalsEnabled } = usePropertyServices();
  const { needsSetup: needsEndCardSetup, isLoading: endCardCheckLoading } = useEndCardSetupCheck();
  const { needsConnection: needsSocialConnection, isLoading: socialCheckLoading } = useSocialConnectionCheck();
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [priceRange, setPriceRange] = useState<string>("all");
  const [bedroomFilter, setBedroomFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<{ id: string; status: string } | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingListing, setDeletingListing] = useState<{ id: string; title: string } | null>(null);
  
  // Determine which organization to use: viewAs takes precedence over user's organization
  const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;

  const fetchListings = async (filter: string = "All") => {
    // Determine which organization to use: viewAs takes precedence over user's organization
    const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;
    
    if (!targetOrg) {
      console.warn('[ListingsDashboard] Cannot fetch listings - no organization loaded');
      setIsLoading(false);
      return;
    }
    
    console.log('[ListingsDashboard] Fetching listings for organization:', targetOrg.slug, 'filter:', filter);
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-listings', {
        body: { 
          clientSlug: targetOrg.slug, 
          filter: filter === "All" || filter === "Archived" ? null : filter,
          archived: filter === "Archived" ? true : false,
        }
      });

      if (error) throw error;

      if (data?.success) {
        console.log('[ListingsDashboard] Loaded', data.listings?.length || 0, 'listings');
        setListings(data.listings);
      }
    } catch (error) {
      console.error('[ListingsDashboard] Error fetching listings:', error);
      toast({
        title: t('listings.toast.error'),
        description: t('listings.toast.loadFailed'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const targetOrg = isOrganizationView && selectedOrganization ? selectedOrganization : organization;
    if (targetOrg) {
      fetchListings(activeFilter);
    }
  }, [activeFilter, organization, viewAsOrganizationId, selectedOrganization, isOrganizationView]);

  const handleStatusChange = (id: string, currentStatus: string) => {
    setSelectedListing({ id, status: currentStatus });
    setStatusDialogOpen(true);
  };

  const handleConfirmStatusChange = async (newStatus: string) => {
    if (!selectedListing || !organization) return;

    try {
      const { data, error } = await supabase.functions.invoke('update-listing-status', {
        body: {
          clientSlug: organization.slug,
          recordId: selectedListing.id,
          newStatus,
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: t('listings.toast.statusUpdated'),
          description: t('listings.toast.statusChangedTo', { status: newStatus }),
        });
        await fetchListings(activeFilter);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: t('listings.toast.error'),
        description: t('listings.toast.statusUpdateFailed'),
        variant: "destructive",
      });
    }
  };

  const handleEdit = (listing: any) => {
    setEditingListing(listing);
    setEditDialogOpen(true);
  };

  const handleArchive = async (id: string, currentlyArchived: boolean) => {
    if (!organization) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('toggle-archive', {
        body: {
          clientSlug: organization.slug,
          recordId: id,
          archived: !currentlyArchived,
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: t('listings.toast.success'),
          description: !currentlyArchived ? t('listings.toast.archivedSuccessfully') : t('listings.toast.unarchivedSuccessfully'),
        });
        await fetchListings(activeFilter);
      }
    } catch (error) {
      console.error('Error archiving listing:', error);
      toast({
        title: t('listings.toast.error'),
        description: t('listings.toast.archiveFailed'),
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (id: string, title: string) => {
    setDeletingListing({ id, title });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingListing || !organization) return;

    try {
      const { data, error } = await supabase.functions.invoke('delete-listing', {
        body: {
          clientSlug: organization.slug,
          recordId: deletingListing.id,
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: t('listings.toast.success'),
          description: t('listings.toast.deletedSuccessfully'),
        });
        await fetchListings(activeFilter);
      }
    } catch (error) {
      console.error('Error deleting listing:', error);
      toast({
        title: t('listings.toast.error'),
        description: t('listings.toast.deleteFailed'),
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setDeletingListing(null);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      t('listings.csv.title'),
      t('listings.csv.status'),
      t('listings.csv.price'),
      t('listings.csv.address'),
      t('listings.csv.bedrooms'),
      t('listings.csv.bathrooms'),
      t('listings.csv.datePosted')
    ];
    const csvData = filteredListings.map(listing => [
      listing.title,
      listing.status,
      listing.price || '',
      `${listing.addressLine1}, ${listing.addressTown}, ${listing.county}`,
      listing.bedrooms || '',
      listing.bathrooms || '',
      listing.datePosted || ''
    ]);

    const csv = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `listings-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast({
      title: t('listings.toast.exportSuccessful'),
      description: t('listings.toast.exportedToCsv'),
    });
  };

  const filteredListings = listings.filter(listing => {
    // Category filter
    if (categoryFilter !== "all") {
      const listingCategory = listing.category || 'Listing';
      if (listingCategory !== categoryFilter) return false;
    }

    // Text search
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      const matchesSearch = 
        listing.title?.toLowerCase().includes(search) ||
        listing.addressLine1?.toLowerCase().includes(search) ||
        listing.addressTown?.toLowerCase().includes(search) ||
        listing.county?.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }

    // Price filter
    if (priceRange !== "all") {
      const price = listing.price || 0;
      switch (priceRange) {
        case "0-200000":
          if (price >= 200000) return false;
          break;
        case "200000-400000":
          if (price < 200000 || price >= 400000) return false;
          break;
        case "400000-600000":
          if (price < 400000 || price >= 600000) return false;
          break;
        case "600000+":
          if (price < 600000) return false;
          break;
      }
    }

    // Bedroom filter
    if (bedroomFilter !== "all") {
      const bedrooms = listing.bedrooms || 0;
      const targetBedrooms = parseInt(bedroomFilter);
      if (bedroomFilter === "5+") {
        if (bedrooms < 5) return false;
      } else {
        if (bedrooms !== targetBedrooms) return false;
      }
    }

    return true;
  });

  // Get count by category
  const getCategoryCount = (category: string) => {
    if (category === "all") return listings.length;
    return listings.filter(l => (l.category || 'Listing') === category).length;
  };

  // Sort listings
  const sortedListings = [...filteredListings].sort((a, b) => {
    let result = 0;
    switch (sortBy) {
      case "newest":
        result = new Date(b.datePosted).getTime() - new Date(a.datePosted).getTime();
        break;
      case "oldest":
        result = new Date(a.datePosted).getTime() - new Date(b.datePosted).getTime();
        break;
      case "price-low":
        result = (a.price || 0) - (b.price || 0);
        break;
      case "price-high":
        result = (b.price || 0) - (a.price || 0);
        break;
      case "title-az":
        result = a.title.localeCompare(b.title);
        break;
      case "title-za":
        result = b.title.localeCompare(a.title);
        break;
    }
    if (result === 0 && (sortBy === "newest" || sortBy === "oldest")) {
      return (b.id || '').localeCompare(a.id || '');
    }
    return result;
  });

  const getFilterCount = (status: string) => {
    if (status === "All") return listings.length;
    if (status === "Archived") return listings.filter((l) => l.archived === true).length;
    return listings.filter((l) => l.status === status).length;
  };

  // Show error state if organization failed to load
  if (!organization) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold mb-2">{t('listings.manage.organizationNotFound')}</h1>
              <p className="text-muted-foreground">
                {t('listings.manage.organizationNotFoundDescription')}
              </p>
            </div>
            <div className="flex justify-center gap-4">
              <Button onClick={() => window.location.reload()} variant="outline">
                {t('listings.manage.reloadPage')}
              </Button>
              <Button onClick={() => navigate('/admin/settings')}>
                {t('listings.manage.goToSettings')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('listings.propertyListings')}
          </h1>
          <p className="text-muted-foreground">
            {t('listings.manage.description', { 
              businessName: isOrganizationView && selectedOrganization 
                ? selectedOrganization.business_name 
                : organization.business_name 
            })}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button onClick={() => navigate('/admin/create')} size="lg" className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            {t('listings.newListing')}
          </Button>
          <Button onClick={handleExportCSV} variant="outline" size="lg" className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" />
            {t('listings.exportCsv')}
          </Button>
        </div>
      </div>

      {/* End Card Setup Banner - shown for new orgs without video branding */}
      {!endCardCheckLoading && needsEndCardSetup && (
        <EndCardSetupBanner className="mb-6" />
      )}

      {/* Social Connection Banner - shown for orgs without connected social accounts */}
      {!socialCheckLoading && needsSocialConnection && (
        <SocialConnectionBanner className="mb-6" />
      )}

      {/* Advanced Search & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Input
          placeholder={t('listings.filters.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="md:col-span-1"
        />
        
        <Select value={priceRange} onValueChange={setPriceRange}>
          <SelectTrigger>
            <SelectValue placeholder={t('listings.filters.priceRange')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('listings.filters.allPrices')}</SelectItem>
            <SelectItem value="0-200000">{t('listings.filters.under200k')}</SelectItem>
            <SelectItem value="200000-400000">{t('listings.filters.200kTo400k')}</SelectItem>
            <SelectItem value="400000-600000">{t('listings.filters.400kTo600k')}</SelectItem>
            <SelectItem value="600000+">{t('listings.filters.over600k')}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={bedroomFilter} onValueChange={setBedroomFilter}>
          <SelectTrigger>
            <SelectValue placeholder={t('listings.filters.bedrooms')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('listings.filters.allBedrooms')}</SelectItem>
            <SelectItem value="1">{t('listings.filters.bedroom', { count: 1 })}</SelectItem>
            <SelectItem value="2">{t('listings.filters.bedrooms_plural', { count: 2 })}</SelectItem>
            <SelectItem value="3">{t('listings.filters.bedrooms_plural', { count: 3 })}</SelectItem>
            <SelectItem value="4">{t('listings.filters.bedrooms_plural', { count: 4 })}</SelectItem>
            <SelectItem value="5+">{t('listings.filters.bedroomsPlus', { count: 5 })}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger>
            <SelectValue placeholder={t('listings.filters.sortBy')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4" />
                {t('listings.filters.newestFirst')}
              </div>
            </SelectItem>
            <SelectItem value="oldest">{t('listings.filters.oldestFirst')}</SelectItem>
            <SelectItem value="price-low">{t('listings.filters.priceLowHigh')}</SelectItem>
            <SelectItem value="price-high">{t('listings.filters.priceHighLow')}</SelectItem>
            <SelectItem value="title-az">{t('listings.filters.titleAZ')}</SelectItem>
            <SelectItem value="title-za">{t('listings.filters.titleZA')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Category Tabs - Only show if more than one service is enabled */}
      {enabledCategories.length > 1 && (
        <Tabs value={categoryFilter} onValueChange={setCategoryFilter} className="mb-4">
          <TabsList className="w-full h-auto flex-wrap gap-1 justify-start p-1">
            <TabsTrigger value="all" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 whitespace-nowrap" data-testid="tab-category-all">
              All Categories <span className="ml-1">({getCategoryCount("all")})</span>
            </TabsTrigger>
            {salesEnabled && (
              <TabsTrigger value="Listing" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 whitespace-nowrap" data-testid="tab-category-sales">
                <Home className="h-3 w-3 mr-1" />
                For Sale <span className="ml-1">({getCategoryCount("Listing")})</span>
              </TabsTrigger>
            )}
            {rentalsEnabled && (
              <TabsTrigger value="Rental" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 whitespace-nowrap" data-testid="tab-category-rentals">
                <Key className="h-3 w-3 mr-1" />
                To Let <span className="ml-1">({getCategoryCount("Rental")})</span>
              </TabsTrigger>
            )}
            {holidayRentalsEnabled && (
              <TabsTrigger value="Holiday Rental" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 whitespace-nowrap" data-testid="tab-category-holiday">
                <Palmtree className="h-3 w-3 mr-1" />
                Holiday Rentals <span className="ml-1">({getCategoryCount("Holiday Rental")})</span>
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
      )}

      {/* Status Filters */}
      <Tabs value={activeFilter} onValueChange={setActiveFilter} className="mb-8">
        <TabsList className="w-full h-auto flex-wrap gap-1 justify-start p-1">
          <TabsTrigger value="All" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 whitespace-nowrap">
            {t('listings.status.all')} <span className="ml-1">({getFilterCount("All")})</span>
          </TabsTrigger>
          <TabsTrigger value="New" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 whitespace-nowrap">
            {t('listings.status.new')} <span className="ml-1">({getFilterCount("New")})</span>
          </TabsTrigger>
          <TabsTrigger value="Published" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 whitespace-nowrap">
            {t('listings.status.forSale')} <span className="ml-1">({getFilterCount("Published")})</span>
          </TabsTrigger>
          <TabsTrigger value="Sale Agreed" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 whitespace-nowrap">
            {t('listings.status.saleAgreed')} <span className="ml-1">({getFilterCount("Sale Agreed")})</span>
          </TabsTrigger>
          <TabsTrigger value="Sold" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 whitespace-nowrap">
            {t('listings.status.sold')} <span className="ml-1">({getFilterCount("Sold")})</span>
          </TabsTrigger>
          <TabsTrigger value="Archived" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 whitespace-nowrap">
            {t('listings.status.archived')} <span className="ml-1">({getFilterCount("Archived")})</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Listings Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : sortedListings.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <p className="text-muted-foreground">
            {searchQuery || priceRange !== "all" || bedroomFilter !== "all" 
              ? t('listings.empty.noMatchingListings')
              : t('listings.empty.noListings')}
          </p>
          {!searchQuery && priceRange === "all" && bedroomFilter === "all" && (
            <Button className="mt-4" onClick={() => navigate('/admin/create')}>
              <Plus className="h-4 w-4 mr-2" />
              {t('listings.createFirst')}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedListings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onStatusChange={handleStatusChange}
              onEdit={handleEdit}
              onArchive={handleArchive}
              onDelete={handleDeleteClick}
              orgSlug={targetOrg?.slug}
              organizationDomain={targetOrg?.domain}
            />
          ))}
        </div>
      )}

      {/* Status Update Dialog */}
      <StatusUpdateDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        currentStatus={selectedListing?.status || ""}
        onConfirm={handleConfirmStatusChange}
      />

      {/* Edit Listing Dialog */}
      <EditListingDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        listing={editingListing}
        clientSlug={organization?.slug || ''}
        onSuccess={() => fetchListings(activeFilter)}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('listings.dialog.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('listings.dialog.deleteDescription', { title: deletingListing?.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('listings.dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('listings.dialog.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ListingsDashboard;
