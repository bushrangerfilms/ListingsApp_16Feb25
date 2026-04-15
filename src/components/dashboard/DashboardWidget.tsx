import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GripVertical, X } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type WidgetType = 
  | "listings_overview"
  | "recent_enquiries"
  | "email_performance"
  | "buyer_pipeline"
  | "seller_pipeline"
  | "recent_activities"
  | "conversion_rates"
  | "team_performance";

interface DashboardWidgetProps {
  id: string;
  type: WidgetType;
  title: string;
  onRemove?: () => void;
  children: React.ReactNode;
}

export const DashboardWidget = ({ id, type, title, onRemove, children }: DashboardWidgetProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
          </div>
          {onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
};
