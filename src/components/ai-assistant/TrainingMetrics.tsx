import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Database, FileText, Coins, Clock } from "lucide-react";
import { format } from "date-fns";

const statusColors = {
  ready: "default",
  training: "secondary",
  error: "destructive",
  needs_update: "outline",
} as const;

const statusLabels = {
  ready: "Ready",
  training: "Training...",
  error: "Error",
  needs_update: "Needs Update",
};

export const TrainingMetrics = () => {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["ai-training-metrics"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("ai_training_metrics")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      // Create default metrics if none exist
      if (!data) {
        const { data: newMetrics, error: insertError } = await supabase
          .from("ai_training_metrics")
          .insert({
            user_id: user.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        return newMetrics;
      }

      return data;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const status = metrics?.training_status || "ready";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Training Status</CardTitle>
              <CardDescription>Current state of your AI assistant knowledge base</CardDescription>
            </div>
            <Badge variant={statusColors[status as keyof typeof statusColors]}>
              {statusLabels[status as keyof typeof statusLabels]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {metrics?.last_trained_at ? (
            <p className="text-sm text-muted-foreground">
              Last trained: {format(new Date(metrics.last_trained_at), "MMM d, yyyy 'at' h:mm a")}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not yet trained - click "Train Assistant" to build the knowledge base
            </p>
          )}
          {metrics?.error_message && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive font-medium">Error:</p>
              <p className="text-sm text-destructive/80">{metrics.error_message}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Properties</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.properties_count || 0}</div>
            <p className="text-xs text-muted-foreground">In knowledge base</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.documents_count || 0}</div>
            <p className="text-xs text-muted-foreground">Uploaded files</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.total_tokens?.toLocaleString() || "0"}
            </div>
            <p className="text-xs text-muted-foreground">Training data size</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
