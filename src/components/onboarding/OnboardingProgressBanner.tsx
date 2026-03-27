import { Sparkles, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TaskItem } from './TaskItem';
import { useOnboarding } from '@/hooks/useOnboarding';
import { usePlanInfo } from '@/hooks/usePlanInfo';
import { useEndCardSetupCheck } from '@/hooks/useEndCardSetupCheck';

interface OnboardingProgressBannerProps {
  className?: string;
}

export function OnboardingProgressBanner({ className }: OnboardingProgressBannerProps) {
  const {
    tasks,
    tasksCompleted,
    completedCount,
    totalCount,
    isDismissed,
    isComplete,
    dismissOnboarding,
    isLoading,
    isUpdating,
  } = useOnboarding();

  const { planName, isLoading: planLoading } = usePlanInfo();
  const isPro = planName === 'pro';
  const { needsSetup: needsEndCardSetup } = useEndCardSetupCheck();

  if (isLoading || planLoading || isDismissed || isComplete) {
    return null;
  }

  const visibleTasks = tasks.filter(task => !task.proOnly || isPro);
  const visibleCompleted = visibleTasks.filter(t => tasksCompleted[t.id]).length;
  const visibleTotal = visibleTasks.length;

  if (visibleCompleted >= visibleTotal) {
    return null;
  }

  return (
    <Card className={className} data-testid="onboarding-progress-banner">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Get Started</h3>
            <span className="text-sm text-muted-foreground">
              {visibleCompleted} of {visibleTotal} complete
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={dismissOnboarding}
            disabled={isUpdating}
            data-testid="button-dismiss-progress-banner"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <Progress
          value={(visibleCompleted / visibleTotal) * 100}
          className="h-2 mb-4"
        />

        {needsEndCardSetup && (
          <a
            href="https://socials.autolisting.io/organization/settings/branding"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 mb-3 p-2 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 text-sm hover:bg-amber-500/20 transition-colors"
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="underline">Videos won't generate until you complete your branding setup in the Socials Hub.</span>
          </a>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
          {visibleTasks.map((task) => (
            <TaskItem
              key={task.id}
              title={task.title}
              description={task.description}
              isComplete={!!tasksCompleted[task.id]}
              href={task.href}
              icon={task.icon}
              external={task.external}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
