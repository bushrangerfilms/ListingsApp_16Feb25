import { Link } from 'react-router-dom';
import { Users, ArrowRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTeamLimit } from '@/hooks/useTeamLimit';
import { usePlanInfo } from '@/hooks/usePlanInfo';
import { useLocale } from '@/hooks/useLocale';

interface TeamLimitBannerProps {
  onUpgrade?: () => void;
  className?: string;
}

export function TeamLimitBanner({ onUpgrade, className = '' }: TeamLimitBannerProps) {
  const { currentUserCount, maxUsers, isAtLimit, isApproachingLimit, isLoading } = useTeamLimit();
  const { planName } = usePlanInfo();
  const { t } = useLocale();
  
  const isStarter = planName === 'starter';
  const isTrial = planName === 'trial';

  if (isLoading) {
    return null;
  }

  if (!isAtLimit && !isApproachingLimit) {
    return null;
  }

  const teamDescription = maxUsers === 1 
    ? t('billing.team.limitReachedDescription', { current: currentUserCount, max: maxUsers })
    : t('billing.team.limitReachedDescriptionPlural', { current: currentUserCount, max: maxUsers });

  if (isAtLimit) {
    return (
      <div 
        className={`bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 p-4 rounded-lg ${className}`}
        data-testid="banner-team-limit-reached"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-orange-900 dark:text-orange-100">
              {t('billing.team.limitReachedTitle')}
            </h4>
            <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
              {teamDescription}
              {(isStarter || isTrial) && ' ' + t('billing.team.upgradePrompt')}
            </p>
            {(isStarter || isTrial) && (
              <div className="mt-3">
                {onUpgrade ? (
                  <Button 
                    size="sm" 
                    onClick={onUpgrade}
                    data-testid="button-upgrade-team-limit"
                  >
                    {t('billing.team.upgradeToPro')}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button asChild size="sm" data-testid="button-upgrade-team-limit">
                    <Link to="/admin/billing/upgrade">
                      {t('billing.team.upgradeToPro')}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isApproachingLimit) {
    return (
      <div 
        className={`bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 rounded-lg ${className}`}
        data-testid="banner-team-limit-approaching"
      >
        <div className="flex items-start gap-3">
          <Users className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-blue-900 dark:text-blue-100">
              {t('billing.team.approachingLimitTitle')}
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              {t('billing.team.approachingLimitDescription', { current: currentUserCount, max: maxUsers })}
              {(isStarter || isTrial) && ' ' + t('billing.team.considerUpgrade')}
            </p>
            {(isStarter || isTrial) && (
              <div className="mt-3">
                {onUpgrade ? (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={onUpgrade}
                    data-testid="button-upgrade-team-approaching"
                  >
                    {t('billing.team.viewProPlan')}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button asChild size="sm" variant="outline" data-testid="button-upgrade-team-approaching">
                    <Link to="/admin/billing/upgrade">
                      {t('billing.team.viewProPlan')}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
