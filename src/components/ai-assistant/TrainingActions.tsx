import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useLocale } from "@/hooks/useLocale";

export const TrainingActions = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [validationResult, setValidationResult] = useState<any>(null);

  const trainMutation = useMutation({
    mutationFn: async () => {
      // Simulate progress for UI
      const progressInterval = setInterval(() => {
        setTrainingProgress((prev) => Math.min(prev + 10, 90));
      }, 300);

      try {
        const { data, error } = await supabase.functions.invoke('train-ai-assistant');

        clearInterval(progressInterval);
        setTrainingProgress(100);

        if (error) throw error;
        if (!data.success) throw new Error(data.error || 'Training failed');

        return data.metrics;
      } catch (error) {
        clearInterval(progressInterval);
        setTrainingProgress(0);
        throw error;
      }
    },
    onSuccess: (metrics) => {
      queryClient.invalidateQueries({ queryKey: ["ai-training-metrics"] });
      setTrainingProgress(0);
      toast({
        title: t('ai-assistant.actions.trainSuccess'),
        description: t('ai-assistant.actions.trainSuccessDesc'),
      });
    },
    onError: (error) => {
      setTrainingProgress(0);
      toast({
        title: t('ai-assistant.actions.trainFailed'),
        description: error instanceof Error ? error.message : t('ai-assistant.actions.trainFailed'),
        variant: "destructive",
      });

      // Update error status
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          (supabase as any)
            .from("ai_training_metrics")
            .update({
              training_status: "error",
              error_message: error instanceof Error ? error.message : "Training failed",
            })
            .eq("user_id", user.id);
        }
      });
    },
  });

  const validateMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check for documents
      const { data: documents, error: docsError } = await (supabase as any)
        .from("knowledge_documents")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active");

      if (docsError) throw docsError;

      // Check for config
      const { data: config, error: configError } = await (supabase as any)
        .from("ai_assistant_config")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (configError && configError.code !== "PGRST116") throw configError;

      const issues: string[] = [];
      const warnings: string[] = [];

      if (!documents || documents.length === 0) {
        warnings.push(t('ai-assistant.actions.noDocuments'));
      }

      if (!config?.include_active_listings && !config?.include_sold_listings) {
        warnings.push(t('ai-assistant.actions.noPropertySources'));
      }

      if (!config?.enabled_capabilities || (config.enabled_capabilities as string[]).length === 0) {
        issues.push(t('ai-assistant.actions.noCapabilities'));
      }

      return {
        status: issues.length > 0 ? "error" : warnings.length > 0 ? "warning" : "success",
        issues,
        warnings,
        documentsCount: documents?.length || 0,
      };
    },
    onSuccess: (result) => {
      setValidationResult(result);
      const hasIssues = result.issues.length > 0;
      toast({
        title: hasIssues ? t('ai-assistant.actions.validationIssues') : t('ai-assistant.actions.validationPassed'),
        description: hasIssues
          ? t('ai-assistant.actions.validationIssues')
          : result.warnings.length > 0
          ? t('ai-assistant.actions.validationWarnings')
          : t('ai-assistant.actions.validationPassed'),
        variant: hasIssues ? "destructive" : "default",
      });
    },
    onError: (error) => {
      toast({
        title: t('ai-assistant.toast.updateFailed'),
        description: error instanceof Error ? error.message : t('ai-assistant.toast.updateFailed'),
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('ai-assistant.actions.title')}</CardTitle>
        <CardDescription>
          {t('ai-assistant.actions.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {trainMutation.isPending && trainingProgress > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('ai-assistant.actions.training')}</span>
              <span className="font-medium">{trainingProgress}%</span>
            </div>
            <Progress value={trainingProgress} />
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => trainMutation.mutate()}
            disabled={trainMutation.isPending || validateMutation.isPending}
            data-testid="button-train-assistant"
          >
            {trainMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('ai-assistant.actions.training')}
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t('ai-assistant.actions.train')}
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={() => validateMutation.mutate()}
            disabled={trainMutation.isPending || validateMutation.isPending}
            data-testid="button-validate-config"
          >
            {validateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('ai-assistant.actions.validating')}
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {t('ai-assistant.actions.validate')}
              </>
            )}
          </Button>
        </div>

        {validationResult && (
          <div className="space-y-3 mt-4">
            {validationResult.status === "success" && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-primary">{t('ai-assistant.actions.validationPassed')}</p>
                  <p className="text-sm text-muted-foreground">
                    {validationResult.documentsCount} {t('ai-assistant.actions.documentsUploaded')}
                  </p>
                </div>
              </div>
            )}

            {validationResult.warnings.length > 0 && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-2">
                  {t('ai-assistant.actions.validationWarnings')}:
                </p>
                <ul className="text-sm text-yellow-600 dark:text-yellow-500 space-y-1">
                  {validationResult.warnings.map((warning: string, i: number) => (
                    <li key={i}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {validationResult.issues.length > 0 && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive mb-2">{t('ai-assistant.actions.validationIssues')}:</p>
                  <ul className="text-sm text-destructive/80 space-y-1">
                    {validationResult.issues.map((issue: string, i: number) => (
                      <li key={i}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
