import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Home, Mail, Users, Activity, TrendingUp, BarChart } from "lucide-react";
import { WidgetType } from "./DashboardWidget";

interface WidgetOption {
  type: WidgetType;
  title: string;
  description: string;
  icon: React.ElementType;
}

const widgetOptions: WidgetOption[] = [
  {
    type: "listings_overview",
    title: "Listings Overview",
    description: "View active listings, views, and sales metrics",
    icon: Home,
  },
  {
    type: "recent_enquiries",
    title: "Recent Enquiries",
    description: "Latest property enquiries from customers",
    icon: Mail,
  },
  {
    type: "email_performance",
    title: "Email Performance",
    description: "Track email opens, clicks, and engagement",
    icon: Mail,
  },
  {
    type: "buyer_pipeline",
    title: "Buyer Pipeline",
    description: "View buyer stages and conversion funnel",
    icon: Users,
  },
  {
    type: "seller_pipeline",
    title: "Seller Pipeline",
    description: "View seller stages and conversion funnel",
    icon: Users,
  },
  {
    type: "recent_activities",
    title: "Recent Activities",
    description: "Latest CRM activities and interactions",
    icon: Activity,
  },
  {
    type: "conversion_rates",
    title: "Conversion Rates",
    description: "Track conversion metrics across stages",
    icon: TrendingUp,
  },
  {
    type: "team_performance",
    title: "Team Performance",
    description: "Monitor team activities and response times",
    icon: BarChart,
  },
];

interface WidgetSelectorProps {
  onAddWidget: (type: WidgetType) => void;
}

export const WidgetSelector = ({ onAddWidget }: WidgetSelectorProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Widget
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Widget</DialogTitle>
          <DialogDescription>
            Choose a widget to add to your dashboard
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 mt-4">
          {widgetOptions.map((widget) => (
            <button
              key={widget.type}
              onClick={() => onAddWidget(widget.type)}
              className="flex items-start gap-3 p-4 rounded-lg border hover:bg-muted transition-colors text-left"
            >
              <div className="p-2 rounded-lg bg-primary/10">
                <widget.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm">{widget.title}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {widget.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
