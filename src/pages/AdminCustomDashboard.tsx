import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PlatformHeader } from "@/components/PlatformHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { DashboardWidget, WidgetType } from "@/components/dashboard/DashboardWidget";
import { WidgetSelector } from "@/components/dashboard/WidgetSelector";
import { ListingsOverviewWidget } from "@/components/dashboard/widgets/ListingsOverviewWidget";
import { RecentEnquiriesWidget } from "@/components/dashboard/widgets/RecentEnquiriesWidget";
import { EmailPerformanceWidget } from "@/components/dashboard/widgets/EmailPerformanceWidget";
import { PipelineWidget } from "@/components/dashboard/widgets/PipelineWidget";
import { Save, Plus, Layout, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
}

const getWidgetTitle = (type: WidgetType): string => {
  const titles: Record<WidgetType, string> = {
    listings_overview: "Listings Overview",
    recent_enquiries: "Recent Enquiries",
    email_performance: "Email Performance",
    buyer_pipeline: "Buyer Pipeline",
    seller_pipeline: "Seller Pipeline",
    recent_activities: "Recent Activities",
    conversion_rates: "Conversion Rates",
    team_performance: "Team Performance",
  };
  return titles[type];
};

const renderWidget = (type: WidgetType) => {
  switch (type) {
    case "listings_overview":
      return <ListingsOverviewWidget />;
    case "recent_enquiries":
      return <RecentEnquiriesWidget />;
    case "email_performance":
      return <EmailPerformanceWidget />;
    case "buyer_pipeline":
      return <PipelineWidget type="buyer" />;
    case "seller_pipeline":
      return <PipelineWidget type="seller" />;
    default:
      return <div className="text-sm text-muted-foreground">Widget content coming soon</div>;
  }
};

const AdminCustomDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [widgets, setWidgets] = useState<WidgetConfig[]>([
    { id: "1", type: "listings_overview", title: "Listings Overview" },
    { id: "2", type: "recent_enquiries", title: "Recent Enquiries" },
  ]);
  const [dashboardName, setDashboardName] = useState("");
  const [dashboardDescription, setDashboardDescription] = useState("");
  const [selectedDashboard, setSelectedDashboard] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  const { data: dashboards } = useQuery({
    queryKey: ["dashboard-configurations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboard_configurations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const saveDashboard = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");

      const { error } = await supabase.from("dashboard_configurations").insert([{
        user_id: user.id,
        name: dashboardName,
        description: dashboardDescription,
        layout: widgets as any,
        is_default: false,
        is_shared: false,
      }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-configurations"] });
      toast.success("Dashboard saved successfully");
      setSaveDialogOpen(false);
      setDashboardName("");
      setDashboardDescription("");
    },
    onError: () => {
      toast.error("Failed to save dashboard");
    },
  });

  const deleteDashboard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dashboard_configurations")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-configurations"] });
      toast.success("Dashboard deleted");
      setSelectedDashboard(null);
    },
  });

  const loadDashboard = (dashboardId: string) => {
    const dashboard = dashboards?.find((d) => d.id === dashboardId);
    if (dashboard && dashboard.layout) {
      setWidgets(dashboard.layout as unknown as WidgetConfig[]);
      setSelectedDashboard(dashboardId);
      toast.success(`Loaded "${dashboard.name}"`);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setWidgets((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newItems = [...items];
        const [removed] = newItems.splice(oldIndex, 1);
        newItems.splice(newIndex, 0, removed);

        return newItems;
      });
    }
  };

  const addWidget = (type: WidgetType) => {
    const newWidget: WidgetConfig = {
      id: `widget-${Date.now()}`,
      type,
      title: getWidgetTitle(type),
    };
    setWidgets([...widgets, newWidget]);
    toast.success(`Added ${getWidgetTitle(type)}`);
  };

  const removeWidget = (id: string) => {
    setWidgets(widgets.filter((w) => w.id !== id));
    toast.success("Widget removed");
  };

  return (
    <div className="min-h-screen bg-background">
      <PlatformHeader />
      <main className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Custom Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage your personalized dashboard layouts
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={selectedDashboard || ""} onValueChange={loadDashboard}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Load dashboard" />
              </SelectTrigger>
              <SelectContent>
                {dashboards?.map((dashboard) => (
                  <SelectItem key={dashboard.id} value={dashboard.id}>
                    {dashboard.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedDashboard && (
              <Button
                variant="destructive"
                size="icon"
                onClick={() => deleteDashboard.mutate(selectedDashboard)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <WidgetSelector onAddWidget={addWidget} />
          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Save className="h-4 w-4 mr-2" />
                Save Layout
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Dashboard Layout</DialogTitle>
                <DialogDescription>
                  Give your dashboard a name and save the current layout
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Dashboard Name</Label>
                  <Input
                    id="name"
                    value={dashboardName}
                    onChange={(e) => setDashboardName(e.target.value)}
                    placeholder="e.g., Sales Dashboard"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Input
                    id="description"
                    value={dashboardDescription}
                    onChange={(e) => setDashboardDescription(e.target.value)}
                    placeholder="e.g., Dashboard for tracking sales metrics"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => saveDashboard.mutate()}
                  disabled={!dashboardName}
                >
                  Save Dashboard
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {widgets.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <Layout className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No widgets added</h3>
            <p className="text-muted-foreground mb-4">
              Start building your dashboard by adding widgets
            </p>
            <WidgetSelector onAddWidget={addWidget} />
          </div>
        ) : (
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {widgets.map((widget) => (
                  <DashboardWidget
                    key={widget.id}
                    id={widget.id}
                    type={widget.type}
                    title={widget.title}
                    onRemove={() => removeWidget(widget.id)}
                  >
                    {renderWidget(widget.type)}
                  </DashboardWidget>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>
    </div>
  );
};

export default AdminCustomDashboard;
