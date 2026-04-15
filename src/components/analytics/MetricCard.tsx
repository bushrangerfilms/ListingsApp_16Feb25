import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  trend?: number;
  icon: LucideIcon;
  onClick?: () => void;
}

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  onClick,
}: MetricCardProps) {
  return (
    <Card 
      className={`${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`} 
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
        {trend !== undefined && (
          <div className="flex items-center mt-2 text-xs">
            {trend >= 0 ? (
              <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
            )}
            <span className={trend >= 0 ? "text-green-500" : "text-red-500"}>
              {Math.abs(trend)}% from last period
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
