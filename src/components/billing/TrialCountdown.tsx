import { Link } from 'react-router-dom';
import { Sparkles, Clock, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  AccountStatus, 
  getTrialDaysRemaining,
  getAccountStatusLabel,
  getAccountStatusColor
} from '@/lib/billing/types';
import { useLocale } from '@/hooks/useLocale';

interface TrialCountdownProps {
  accountStatus: AccountStatus;
  trialEndsAt: string | null;
  trialStartedAt: string | null;
  compact?: boolean;
  className?: string;
}

export function TrialCountdown({ 
  accountStatus, 
  trialEndsAt,
  trialStartedAt,
  compact = false,
  className = ''
}: TrialCountdownProps) {
  const { t } = useLocale();
  
  if (accountStatus !== 'trial' || !trialEndsAt) {
    if (accountStatus === 'active') {
      if (compact) {
        return (
          <Badge variant="outline" className={`text-green-600 dark:text-green-400 ${className}`}>
            {t('billing.status.active')}
          </Badge>
        );
      }
      return null;
    }

    if (compact) {
      return (
        <Badge 
          variant="outline" 
          className={`${getAccountStatusColor(accountStatus)} ${className}`}
        >
          {getAccountStatusLabel(accountStatus)}
        </Badge>
      );
    }

    return (
      <div className={`p-3 rounded-lg bg-muted ${className}`}>
        <div className="flex items-center gap-2 text-sm">
          <Badge 
            variant="outline" 
            className={getAccountStatusColor(accountStatus)}
          >
            {getAccountStatusLabel(accountStatus)}
          </Badge>
        </div>
        <div className="mt-2">
          <Button asChild size="sm" variant="outline" className="w-full">
            <Link to="/admin/billing/manage">
              {t('billing.trial.manageSubscription')}
              <ArrowRight className="w-3 h-3 ml-1" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const daysRemaining = getTrialDaysRemaining(trialEndsAt);
  const totalTrialDays = 14;
  
  let daysElapsed = 0;
  if (trialStartedAt) {
    const startDate = new Date(trialStartedAt);
    const now = new Date();
    daysElapsed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  } else {
    daysElapsed = totalTrialDays - daysRemaining;
  }
  
  const progressPercent = Math.min(100, Math.max(0, (daysElapsed / totalTrialDays) * 100));
  
  const urgencyClass = daysRemaining <= 3 
    ? 'text-orange-600 dark:text-orange-400' 
    : daysRemaining <= 7 
      ? 'text-yellow-600 dark:text-yellow-400' 
      : 'text-blue-600 dark:text-blue-400';

  const dayUnit = daysRemaining === 1 ? t('billing.trial.day') : t('billing.trial.days');

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Clock className={`w-4 h-4 ${urgencyClass}`} />
        <span className={`text-sm font-medium ${urgencyClass}`}>
          {daysRemaining} {dayUnit} left
        </span>
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-lg bg-muted ${className}`} data-testid="trial-countdown">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className={`w-4 h-4 ${urgencyClass}`} />
        <span className="text-sm font-medium text-foreground">{t('billing.trial.freeTrial')}</span>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('billing.trial.daysRemaining')}</span>
          <span className={`font-medium ${urgencyClass}`}>
            {daysRemaining} {dayUnit}
          </span>
        </div>
        
        <Progress value={progressPercent} className="h-1.5" />
        
        <div className="text-xs text-muted-foreground">
          {t('billing.trial.dayOf', { current: Math.min(daysElapsed + 1, totalTrialDays), total: totalTrialDays })}
        </div>
      </div>
      
      {daysRemaining <= 7 && (
        <div className="mt-3">
          <Button asChild size="sm" className="w-full" data-testid="button-subscribe-countdown">
            <Link to="/admin/billing/manage">
              {daysRemaining <= 3 ? t('billing.subscription.subscribeNow') : t('billing.subscription.choosePlan')}
              <ArrowRight className="w-3 h-3 ml-1" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
