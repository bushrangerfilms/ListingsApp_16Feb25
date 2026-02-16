import { useNavigate, useLocation } from "react-router-dom";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationView } from "@/contexts/OrganizationViewContext";
import { Button } from "@/components/ui/button";
import { List, LogOut, BarChart3, MessageSquare, Eye, Menu, Share2, Bell, Mail, Users, Coins, Settings } from "lucide-react";
import { OrganizationLogo } from "@/components/OrganizationLogo";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { OrganizationViewSelector } from "@/components/OrganizationViewSelector";
import { CreditBalanceBadge } from "@/components/billing/CreditBalanceBadge";
import { PurchaseCreditsModal } from "@/components/billing/PurchaseCreditsModal";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Enquiry {
  id: string;
  name: string;
  property_title: string;
  created_at: string;
  status: string;
}

interface ValuationRequest {
  id: string;
  name: string;
  property_address: string;
  created_at: string;
  status: string;
}

export const PlatformHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { organization } = useOrganization();
  const { isSuperAdmin } = useOrganizationView();
  const [open, setOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [recentEnquiries, setRecentEnquiries] = useState<Enquiry[]>([]);
  const [recentValuations, setRecentValuations] = useState<ValuationRequest[]>([]);

  const fetchNotificationData = async () => {
    // CRITICAL: Must filter by organization_id for multi-tenant security
    if (!organization?.id) return;
    
    try {
      const { data: enquiries, count: enquiriesCount } = await supabase
        .schema('crm')
        .from('property_enquiries')
        .select('*', { count: 'exact' })
        .eq('organization_id', organization.id)
        .eq('status', 'new')
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: valuations, count: valuationsCount } = await supabase
        .schema('crm')
        .from('valuation_requests')
        .select('*', { count: 'exact' })
        .eq('organization_id', organization.id)
        .eq('status', 'new')
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentEnquiries((enquiries as Enquiry[]) || []);
      setRecentValuations((valuations as ValuationRequest[]) || []);
      setNotificationCount((enquiriesCount || 0) + (valuationsCount || 0));
    } catch (error) {
      console.error('Error fetching notification data:', error);
    }
  };

  useEffect(() => {
    if (!organization?.id) return;
    
    fetchNotificationData();

    const channel = supabase
      .channel('admin-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'crm', table: 'property_enquiries' },
        fetchNotificationData
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'crm', table: 'valuation_requests' },
        fetchNotificationData
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organization?.id]);

  const handleLogout = async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  const markEnquiryAsRead = async (enquiryId: string) => {
    // CRITICAL: Filter by organization_id for multi-tenant security
    if (!organization?.id) return;
    
    try {
      await supabase
        .schema('crm')
        .from('property_enquiries')
        .update({ status: 'contacted' })
        .eq('id', enquiryId)
        .eq('organization_id', organization.id);
      fetchNotificationData();
    } catch (error) {
      console.error('Error marking enquiry as read:', error);
    }
  };

  const markValuationAsRead = async (valuationId: string) => {
    // CRITICAL: Filter by organization_id for multi-tenant security
    if (!organization?.id) return;
    
    try {
      await supabase
        .schema('crm')
        .from('valuation_requests')
        .update({ status: 'contacted' })
        .eq('id', valuationId)
        .eq('organization_id', organization.id);
      fetchNotificationData();
    } catch (error) {
      console.error('Error marking valuation as read:', error);
    }
  };

  const markAllAsRead = async () => {
    // CRITICAL: Filter by organization_id for multi-tenant security
    if (!organization?.id) return;
    
    try {
      await Promise.all([
        supabase
          .schema('crm')
          .from('property_enquiries')
          .update({ status: 'contacted' })
          .eq('organization_id', organization.id)
          .eq('status', 'new'),
        supabase
          .schema('crm')
          .from('valuation_requests')
          .update({ status: 'contacted' })
          .eq('organization_id', organization.id)
          .eq('status', 'new')
      ]);
      fetchNotificationData();
      setNotificationOpen(false);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Compute the public site URL - prefer custom domain if set, otherwise use org slug
  const getPublicSiteUrl = () => {
    if (organization?.custom_domain) {
      return `https://${organization.custom_domain}`;
    }
    if (organization?.slug) {
      return `https://app.autolisting.io/${organization.slug}`;
    }
    return 'https://app.autolisting.io';
  };

  const isBillingExempt = organization?.is_comped === true;
  
  const navItems = [
    { path: '/admin/listings', label: 'Listings', icon: List },
    { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/admin/crm', label: 'CRM', icon: Users },
    { path: '/admin/communications', label: 'Communications', icon: MessageSquare },
    // Only show billing for non-comped organizations
    ...(isBillingExempt ? [] : [{ path: '/admin/billing', label: 'Billing', icon: Coins }]),
    { path: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="bg-card border-b border-border w-full overflow-hidden">
      <div className="px-4">
        <div className="flex justify-between items-center h-14 gap-2">
          {/* Left: Client Branding */}
          <div className="flex items-center gap-3 flex-shrink min-w-0">
            <OrganizationLogo
              logoUrl={organization?.logo_url}
              businessName={organization?.business_name}
              className="max-h-9 w-auto flex-shrink-0"
              onClick={() => navigate('/admin/listings')}
            />
            <span className="hidden sm:block text-sm font-medium text-foreground truncate">
              {organization?.business_name || "Admin Portal"}
            </span>
          </div>

          {/* Right: Super Admin Selector + Credits + Notifications + Menu */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Super Admin Organization Selector - hidden on mobile */}
            <div className="hidden md:block">
              {isSuperAdmin && <OrganizationViewSelector />}
            </div>
            
            {/* Credit Balance Badge - hidden for pilot/comped organizations */}
            {organization && !organization.is_comped && (
              <CreditBalanceBadge 
                organizationId={organization.id}
                onClick={() => setShowPurchaseModal(true)}
                variant="compact"
              />
            )}
            
            {/* Notification Bell */}
            <Popover open={notificationOpen} onOpenChange={setNotificationOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="relative"
                >
                  <Bell className="h-4 w-4" />
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold">
                      {notificationCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between gap-2 p-4 border-b">
                  <h3 className="font-semibold">Notifications</h3>
                  <div className="flex items-center gap-2">
                    {notificationCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={markAllAsRead}
                        className="text-xs h-7"
                        data-testid="button-mark-all-read"
                      >
                        Mark all read
                      </Button>
                    )}
                    <span className="text-sm text-muted-foreground">{notificationCount} new</span>
                  </div>
                </div>
                <ScrollArea className="h-[400px]">
                  {recentEnquiries.length === 0 && recentValuations.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      No new notifications
                    </div>
                  ) : (
                    <div className="p-2">
                      {recentEnquiries.length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            Property Enquiries
                          </div>
                          {recentEnquiries.map((enquiry) => (
                            <button
                              key={enquiry.id}
                              onClick={() => {
                                markEnquiryAsRead(enquiry.id);
                                navigate('/admin/communications');
                                setNotificationOpen(false);
                              }}
                              className="w-full text-left p-3 hover:bg-accent rounded-md transition-colors"
                              data-testid={`notification-enquiry-${enquiry.id}`}
                            >
                              <div className="flex items-start gap-2">
                                <MessageSquare className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{enquiry.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{enquiry.property_title}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(enquiry.created_at).toLocaleDateString('en-US', { 
                                      month: 'short', 
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                      
                      {recentEnquiries.length > 0 && recentValuations.length > 0 && (
                        <Separator className="my-2" />
                      )}
                      
                      {recentValuations.length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            Valuation Requests
                          </div>
                          {recentValuations.map((valuation) => (
                            <button
                              key={valuation.id}
                              onClick={() => {
                                markValuationAsRead(valuation.id);
                                navigate('/admin/communications');
                                setNotificationOpen(false);
                              }}
                              className="w-full text-left p-3 hover:bg-accent rounded-md transition-colors"
                              data-testid={`notification-valuation-${valuation.id}`}
                            >
                              <div className="flex items-start gap-2">
                                <Mail className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{valuation.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{valuation.property_address}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(valuation.created_at).toLocaleDateString('en-US', { 
                                      month: 'short', 
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </ScrollArea>
                {notificationCount > 0 && (
                  <>
                    <Separator />
                    <div className="p-2">
                      <Button
                        variant="ghost"
                        className="w-full justify-center"
                        onClick={() => {
                          navigate('/admin/communications');
                          setNotificationOpen(false);
                        }}
                        data-testid="button-view-all-communications"
                      >
                        View All Communications
                      </Button>
                    </div>
                  </>
                )}
              </PopoverContent>
            </Popover>

            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px]">
                <SheetHeader>
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2 mt-6">
                  {navItems.map((item) => (
                    <Button
                      key={item.path}
                      variant={location.pathname === item.path ? 'default' : 'ghost'}
                      onClick={() => {
                        navigate(item.path);
                        setOpen(false);
                      }}
                      className="justify-start"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {item.label}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.open(getPublicSiteUrl(), '_blank');
                      setOpen(false);
                    }}
                    className="justify-start"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Public Site
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Use SSO redirect to the socials app (configurable via env)
                      window.location.href = import.meta.env.VITE_SOCIALS_HUB_URL || 'https://socials.autolisting.io';
                    }}
                    className="justify-start bg-blue-600/10 text-blue-600 border-blue-600/20 hover:bg-blue-600/20"
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    Socials Hub
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleLogout();
                      setOpen(false);
                    }}
                    className="justify-start"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

        </div>
      </div>

      {/* Purchase Credits Modal */}
      {organization && (
        <PurchaseCreditsModal
          open={showPurchaseModal}
          onOpenChange={setShowPurchaseModal}
          organizationId={organization.id}
        />
      )}
    </header>
  );
};
