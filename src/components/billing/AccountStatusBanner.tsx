import { Link } from 'react-router-dom';
import { 
  AlertTriangle, 
  Clock, 
  CreditCard, 
  XCircle,
  Sparkles,
  ArrowRight,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  AccountStatus, 
  getTrialDaysRemaining, 
  getGraceDaysRemaining 
} from '@/lib/billing/types';
import { useLocale } from '@/hooks/useLocale';

interface AccountStatusBannerProps {
  accountStatus: AccountStatus;
  trialEndsAt: string | null;
  gracePeriodEndsAt: string | null;
  readOnlyReason: string | null;
  className?: string;
}

export function AccountStatusBanner({ 
  accountStatus, 
  trialEndsAt, 
  gracePeriodEndsAt,
  readOnlyReason,
  className = ''
}: AccountStatusBannerProps) {
  const { t } = useLocale();
  
  if (accountStatus === 'active') {
    return null;
  }

  const trialDaysRemaining = getTrialDaysRemaining(trialEndsAt);
  const graceDaysRemaining = getGraceDaysRemaining(gracePeriodEndsAt);

  if (accountStatus === 'trial') {
    if (trialDaysRemaining > 3) {
      return null;
    }

    return (
      <div 
        className={`bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 rounded-lg ${className}`}
        data-testid="banner-trial-ending"
      >
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-blue-900 dark:text-blue-100">
              {trialDaysRemaining <= 1 
                ? t('billing.account.trial.endsTomorrow')
                : t('billing.account.trial.endsInDays', { days: trialDaysRemaining })}
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              {t('billing.account.trial.subscribePrompt')}
            </p>
            <div className="mt-3">
              <Button asChild size="sm" data-testid="button-subscribe-trial">
                <Link to="/admin/billing/manage">
                  {t('billing.subscription.choosePlan')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (accountStatus === 'trial_expired') {
    return (
      <div 
        className={`bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 p-4 rounded-lg ${className}`}
        data-testid="banner-trial-expired"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-orange-900 dark:text-orange-100">
              {t('billing.account.trialExpired.title')}
            </h4>
            <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
              {readOnlyReason || t('billing.account.trialExpired.description', { days: graceDaysRemaining })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" data-testid="button-subscribe-expired">
                <Link to="/admin/billing/manage">
                  {t('billing.subscription.subscribeNow')}
                  <Sparkles className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (accountStatus === 'payment_failed') {
    return (
      <div 
        className={`bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4 rounded-lg ${className}`}
        data-testid="banner-payment-failed"
      >
        <div className="flex items-start gap-3">
          <CreditCard className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-red-900 dark:text-red-100">
              {t('billing.account.paymentFailed.title')}
            </h4>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              {readOnlyReason || t('billing.account.paymentFailed.description', { days: graceDaysRemaining })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="destructive" data-testid="button-update-payment">
                <Link to="/admin/billing/manage">
                  {t('billing.subscription.updatePayment')}
                  <CreditCard className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (accountStatus === 'unsubscribed') {
    return (
      <div 
        className={`bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg ${className}`}
        data-testid="banner-unsubscribed"
      >
        <div className="flex items-start gap-3">
          <Calendar className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-yellow-900 dark:text-yellow-100">
              {t('billing.account.cancelled.title')}
            </h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              {readOnlyReason || t('billing.account.cancelled.description', { days: graceDaysRemaining })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" data-testid="button-resubscribe">
                <Link to="/admin/billing/manage">
                  {t('billing.subscription.reactivate')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (accountStatus === 'archived') {
    return (
      <div 
        className={`bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-4 rounded-lg ${className}`}
        data-testid="banner-archived"
      >
        <div className="flex items-start gap-3">
          <XCircle className="w-5 h-5 text-gray-600 dark:text-gray-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">
              {t('billing.account.archived.title')}
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
              {readOnlyReason || t('billing.account.archived.description')}
            </p>
            <div className="mt-3">
              <Button asChild size="sm" variant="outline" data-testid="button-contact-support">
                <a href="mailto:support@autolisting.io">
                  {t('billing.subscription.contactSupport')}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
