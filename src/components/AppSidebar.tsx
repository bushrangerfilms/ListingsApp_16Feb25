import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  List, 
  BarChart3, 
  Users, 
  MessageSquare, 
  Coins, 
  Settings,
  Eye,
  EyeOff,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  UserPlus,
  Loader2,
  ChevronsUpDown,
  Check,
  Building2
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { Shield } from "lucide-react";
import { OnboardingChecklist } from "@/components/onboarding";
import { useLocale } from "@/hooks/useLocale";
import { toast } from "sonner";
import { FeedbackDialog } from "@/components/FeedbackDialog";

interface NavItem {
  path: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { path: '/admin/listings', labelKey: 'nav.listings', icon: List },
  { path: '/admin/analytics', labelKey: 'nav.analytics', icon: BarChart3 },
  { path: '/admin/crm', labelKey: 'nav.crm', icon: Users },
  { path: '/admin/communications', labelKey: 'nav.communications', icon: MessageSquare },
  { path: '/admin/billing', labelKey: 'nav.billing', icon: Coins, adminOnly: true },
  { path: '/admin/team', labelKey: 'nav.team', icon: UserPlus, adminOnly: true },
  { path: '/admin/settings', labelKey: 'nav.settings', icon: Settings, adminOnly: true },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { open, toggleSidebar } = useSidebar();
  const { organization, userOrganizations, switchOrganization } = useOrganization();
  const { isAdmin, isSuperAdmin, impersonationState } = useAuth();
  const hasMultipleOrgs = userOrganizations.length > 1;
  const { t } = useLocale();
  
  const [hidePublicSite, setHidePublicSite] = useState(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);

  // Load hide_public_site setting from organization
  useEffect(() => {
    if (organization?.id) {
      loadPublicSiteVisibility();
    }
  }, [organization?.id]);

  const loadPublicSiteVisibility = async () => {
    if (!organization?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('hide_public_site')
        .eq('id', organization.id)
        .single();
      
      if (!error && data) {
        setHidePublicSite((data as any).hide_public_site ?? false);
      }
    } catch (error) {
      console.error('Failed to load public site visibility:', error);
    }
  };

  const handleTogglePublicSiteVisibility = async (checked: boolean) => {
    if (!organization?.id) return;
    
    setIsUpdatingVisibility(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ hide_public_site: !checked, updated_at: new Date().toISOString() } as any)
        .eq('id', organization.id);
      
      if (error) {
        throw error;
      }
      
      setHidePublicSite(!checked);
      toast.success(checked ? 'Public site is now visible' : 'Public site is now hidden');
    } catch (error) {
      console.error('Failed to update public site visibility:', error);
      toast.error('Failed to update visibility setting');
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  const canAccessAdminItems = isAdmin || isSuperAdmin;
  const isBillingExempt = organization?.is_comped === true;
  
  const filteredNavItems = navItems.filter(item => {
    if (item.adminOnly && !canAccessAdminItems) {
      return false;
    }
    // Hide billing menu for pilot/comped organizations
    if (item.path === '/admin/billing' && isBillingExempt) {
      return false;
    }
    return true;
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  const getPublicSiteUrl = () => {
    if (organization?.custom_domain) {
      return `https://${organization.custom_domain}`;
    }
    if (organization?.slug) {
      return `https://app.autolisting.io/${organization.slug}`;
    }
    return 'https://app.autolisting.io';
  };

  const isActive = (path: string) => {
    if (path === '/admin/listings') {
      return location.pathname === path || location.pathname === '/admin/create' || location.pathname === '/admin/review-listing';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-200 bg-white">
      <SidebarHeader className="px-4 py-5">
        {open ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <img 
                  src="/favicon.png" 
                  alt="AutoListing.io" 
                  className="h-10 w-10 flex-shrink-0"
                />
                <span className="font-bold text-lg tracking-tight text-slate-900">
                  AutoListing<span className="text-[#4338CA]">.io</span>
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-7 w-7 text-slate-400 hover:text-slate-900 hover:bg-slate-100 flex-shrink-0"
                data-testid="button-toggle-sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Badge 
                variant="secondary"
                className="text-xs px-2.5 py-0.5 bg-blue-600/10 text-blue-600 border-0 font-semibold"
                data-testid="badge-listings-hub"
              >
                {t('nav.listingsHub')}
              </Badge>
              <Badge 
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-600 border-cyan-300/50 font-medium"
                data-testid="badge-beta"
              >
                {t('nav.beta')}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <img 
              src="/favicon.png" 
              alt="AutoListing.io" 
              className="h-8 w-8"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-7 w-7 text-slate-400 hover:text-slate-900 hover:bg-slate-100"
              data-testid="button-toggle-sidebar-collapsed"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SidebarHeader>

      {hasMultipleOrgs && open && (
        <div className="px-3 pb-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm hover-elevate transition-colors"
                data-testid="button-org-switcher"
              >
                {organization?.logo_url ? (
                  <img src={organization.logo_url} alt="" className="h-5 w-5 rounded object-contain flex-shrink-0" />
                ) : (
                  <Building2 className="h-4 w-4 text-slate-500 flex-shrink-0" />
                )}
                <span className="truncate flex-1 font-medium text-slate-700">
                  {organization?.business_name || 'Select Organization'}
                </span>
                <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Switch Organization</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {userOrganizations.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => {
                    if (org.id !== organization?.id) {
                      switchOrganization(org.id);
                      navigate('/admin/listings');
                    }
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                  data-testid={`org-switch-${org.slug}`}
                >
                  {org.logo_url ? (
                    <img src={org.logo_url} alt="" className="h-5 w-5 rounded object-contain flex-shrink-0" />
                  ) : (
                    <Building2 className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  )}
                  <span className="truncate flex-1">{org.business_name}</span>
                  {org.id === organization?.id && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.path)}
                    isActive={isActive(item.path)}
                    tooltip={item.adminOnly ? `${t(item.labelKey)} (${t('nav.admin')})` : t(item.labelKey)}
                    data-testid={`nav-${item.labelKey.split('.')[1]}`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="flex items-center gap-2">
                      {t(item.labelKey)}
                      {item.adminOnly && open && (
                        <Badge 
                          variant="outline" 
                          className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-600 border-amber-300/50 font-medium"
                          data-testid={`badge-admin-${item.labelKey.split('.')[1]}`}
                        >
                          <Shield className="h-2.5 w-2.5 mr-0.5" />
                          {t('nav.admin')}
                        </Badge>
                      )}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2 pb-20">
        {open && (
          <OnboardingChecklist className="mb-2" />
        )}
        
        {open && (
          <div className="space-y-2 mb-2">
            {isSuperAdmin && !impersonationState && (
              <button
                onClick={() => navigate('/internal')}
                className="flex items-center gap-2 w-fit hover:opacity-80 transition-opacity"
                data-testid="link-super-admin-portal"
              >
                <Badge 
                  variant="secondary"
                  className="text-sm px-3 py-1 bg-violet-600/10 text-violet-600 border-0 font-semibold"
                >
                  <Shield className="h-3 w-3 mr-1" />
                  {t('nav.superAdmin')}
                </Badge>
                <ArrowRight className="h-4 w-4 text-violet-600" />
              </button>
            )}
            <a
              href={import.meta.env.VITE_SOCIALS_HUB_URL || 'https://socials.autolisting.io'}
              className="flex items-center gap-2 w-fit hover:opacity-80 transition-opacity"
              data-testid="link-socials-hub"
            >
              <Badge 
                variant="secondary"
                className="text-sm px-3 py-1 bg-blue-600/10 text-blue-600 border-0 font-semibold"
              >
                {t('nav.socialsHub')}
              </Badge>
              <ArrowRight className="h-4 w-4 text-blue-600" />
            </a>
          </div>
        )}
        
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between w-full">
              <SidebarMenuButton
                onClick={() => window.open(getPublicSiteUrl(), '_blank')}
                tooltip={t('nav.publicSite')}
                data-testid="nav-public-site"
                className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex-1"
              >
                {hidePublicSite ? (
                  <EyeOff className="h-4 w-4 text-slate-400" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                <span className={hidePublicSite ? "text-slate-400" : ""}>{t('nav.publicSite')}</span>
              </SidebarMenuButton>
              {open && canAccessAdminItems && (
                <div className="flex items-center gap-1 pr-2" title={hidePublicSite ? "Site hidden - click to show" : "Site visible - click to hide"}>
                  {isUpdatingVisibility ? (
                    <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                  ) : (
                    <Switch
                      checked={!hidePublicSite}
                      onCheckedChange={handleTogglePublicSiteVisibility}
                      className="scale-75"
                      data-testid="toggle-public-site-visibility"
                    />
                  )}
                </div>
              )}
            </div>
          </SidebarMenuItem>
          {open && (
            <SidebarMenuItem>
              <FeedbackDialog />
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              tooltip={t('nav.logout')}
              data-testid="nav-logout"
              className="text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
              <span>{t('nav.logout')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
