import { useNavigate, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  TicketPercent,
  Flag,
  Wrench,
  BarChart3,
  ShieldCheck,
  ScrollText,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Shield,
  Bell,
  Mail,
  Coins,
  Brain,
  Music,
  Rocket,
} from "lucide-react";
import { useAdminPermissions } from "@/hooks/admin/useAdminPermissions";

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: keyof import('@/lib/admin/types').AdminPermission;
  superAdminOnly?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { path: '/internal', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/internal/analytics', label: 'Analytics', icon: BarChart3 },
    ]
  },
  {
    label: 'Launch',
    items: [
      { path: '/internal/pilot', label: 'Pilot Program', icon: Rocket, superAdminOnly: true },
    ]
  },
  {
    label: 'Management',
    items: [
      { path: '/internal/organizations', label: 'Organizations', icon: Building2 },
      { path: '/internal/users', label: 'Users', icon: Users },
      { path: '/internal/feature-flags', label: 'Feature Flags', icon: Flag },
      { path: '/internal/ai-training', label: 'AI Training', icon: Brain, superAdminOnly: true },
      { path: '/internal/video-music', label: 'Video Music', icon: Music, superAdminOnly: true },
    ]
  },
  {
    label: 'Billing',
    items: [
      { path: '/internal/billing', label: 'Billing & Revenue', icon: CreditCard, permission: 'canAccessBilling' },
      { path: '/internal/usage-rates', label: 'Usage Rates', icon: Coins, superAdminOnly: true },
      { path: '/internal/discounts', label: 'Discount Codes', icon: TicketPercent, permission: 'canManageDiscounts' },
    ]
  },
  {
    label: 'Communications',
    items: [
      { path: '/internal/email-queue', label: 'Email Queue', icon: Mail },
    ]
  },
  {
    label: 'Support',
    items: [
      { path: '/internal/support', label: 'Support Tools', icon: Wrench },
    ]
  },
  {
    label: 'Compliance',
    items: [
      { path: '/internal/gdpr', label: 'GDPR Compliance', icon: ShieldCheck },
      { path: '/internal/alerts', label: 'Alerts', icon: Bell, superAdminOnly: true },
      { path: '/internal/audit-log', label: 'Audit Log', icon: ScrollText, permission: 'canViewAuditLog' },
    ]
  },
];

export function SuperAdminSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { open, toggleSidebar } = useSidebar();
  const { hasPermission, isSuperAdmin, isDeveloper } = useAdminPermissions();

  const filterItems = (items: NavItem[]) => {
    return items.filter(item => {
      if (item.superAdminOnly && !isSuperAdmin) {
        return false;
      }
      if (item.permission && !hasPermission(item.permission)) {
        return false;
      }
      return true;
    });
  };

  const isActive = (path: string) => {
    if (path === '/internal') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-200 bg-white dark:bg-slate-950 dark:border-slate-800">
      <SidebarHeader className="px-4 py-5">
        {open ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">
                  Super Admin
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex-shrink-0"
                data-testid="button-toggle-super-admin-sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
            <Badge 
              variant="secondary"
              className="text-xs px-2.5 py-0.5 bg-violet-100 text-violet-700 dark:bg-violet-600/20 dark:text-violet-300 border-0 font-semibold w-fit"
              data-testid="badge-super-admin-role"
            >
              {isSuperAdmin ? 'Super Admin' : isDeveloper ? 'Developer' : 'Unknown'}
            </Badge>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              data-testid="button-expand-super-admin-sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        {navSections.map((section) => {
          const filteredItems = filterItems(section.items);
          if (filteredItems.length === 0) return null;
          
          return (
            <SidebarGroup key={section.label}>
              <SidebarGroupLabel className="text-slate-500 text-xs uppercase tracking-wider px-2">
                {open ? section.label : ''}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredItems.map((item) => (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        onClick={() => navigate(item.path)}
                        isActive={isActive(item.path)}
                        className={`
                          text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white
                          data-[active=true]:bg-violet-100 data-[active=true]:text-violet-700
                          dark:data-[active=true]:bg-violet-600/20 dark:data-[active=true]:text-violet-300
                        `}
                        data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="px-4 py-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/admin/listings')}
          className="w-full justify-start text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          data-testid="button-back-to-app"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {open && <span>Back to App</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
