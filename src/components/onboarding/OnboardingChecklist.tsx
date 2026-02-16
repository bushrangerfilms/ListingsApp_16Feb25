import { ChevronDown, ChevronUp, X, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { TaskItem } from './TaskItem';
import { useOnboarding } from '@/hooks/useOnboarding';
import { usePlanInfo } from '@/hooks/usePlanInfo';
import { cn } from '@/lib/utils';

interface OnboardingChecklistProps {
  className?: string;
  compact?: boolean;
}

export function OnboardingChecklist({ className, compact = false }: OnboardingChecklistProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { 
    tasks, 
    tasksCompleted, 
    completedCount, 
    totalCount, 
    percentComplete,
    isDismissed,
    isComplete,
    dismissOnboarding,
    isLoading,
    isUpdating
  } = useOnboarding();
  
  const { planName, isLoading: planLoading } = usePlanInfo();
  const isPro = planName === 'pro';

  if (isLoading || planLoading) {
    return null;
  }

  if (isDismissed || isComplete) {
    return null;
  }

  const visibleTasks = tasks.filter(task => !task.proOnly || isPro);
  const visibleCompleted = visibleTasks.filter(t => tasksCompleted[t.id]).length;
  const visibleTotal = visibleTasks.length;

  if (compact) {
    return (
      <div 
        className={cn("p-3 rounded-lg bg-card border", className)}
        data-testid="onboarding-checklist-compact"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Get Started</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {visibleCompleted}/{visibleTotal}
          </span>
        </div>
        <Progress value={(visibleCompleted / visibleTotal) * 100} className="h-1.5" />
      </div>
    );
  }

  return (
    <Collapsible 
      open={isOpen} 
      onOpenChange={setIsOpen}
      className={cn("rounded-lg bg-card border", className)}
      data-testid="onboarding-checklist"
    >
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-left flex-1">
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-sm font-medium text-foreground">Get Started</span>
              {isOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              dismissOnboarding();
            }}
            disabled={isUpdating}
            data-testid="button-dismiss-onboarding"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
        
        <div className="mt-2 space-y-1">
          <Progress value={(visibleCompleted / visibleTotal) * 100} className="h-1.5" />
          <p className="text-xs text-muted-foreground">
            {visibleCompleted} of {visibleTotal} complete
          </p>
        </div>
      </div>
      
      <CollapsibleContent>
        <div className="px-2 pb-3 space-y-0.5 max-h-[160px] overflow-y-auto">
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
      </CollapsibleContent>
    </Collapsible>
  );
}
