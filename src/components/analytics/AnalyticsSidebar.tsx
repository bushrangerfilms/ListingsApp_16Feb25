import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { BarChart3, Home, Target, Mail, Users, TrendingUp } from "lucide-react";

interface AnalyticsSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const sections = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "listings", label: "Listings", icon: Home },
  { id: "attribution", label: "Attribution", icon: Target },
  { id: "email", label: "Email Performance", icon: Mail },
  { id: "team", label: "Team & Predictions", icon: Users },
  { id: "matching", label: "Buyer Matching", icon: TrendingUp },
];

export function AnalyticsSidebar({ activeSection, onSectionChange }: AnalyticsSidebarProps) {
  const { open: sidebarOpen } = useSidebar();

  return (
    <Sidebar className={sidebarOpen ? "w-60" : "w-14"} collapsible="icon">
      <SidebarContent>
        <div className="p-4 border-b">
          <SidebarTrigger className="-ml-1" />
        </div>
        <SidebarGroup>
          {sidebarOpen && <SidebarGroupLabel>Analytics</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {sections.map((section) => (
                <SidebarMenuItem key={section.id}>
                  <SidebarMenuButton
                    onClick={() => onSectionChange(section.id)}
                    className={activeSection === section.id ? "bg-muted text-primary font-medium" : "hover:bg-muted/50"}
                    tooltip={!sidebarOpen ? section.label : undefined}
                  >
                    <section.icon className="h-4 w-4" />
                    {sidebarOpen && <span>{section.label}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
