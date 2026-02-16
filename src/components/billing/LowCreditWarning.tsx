import { Link } from 'react-router-dom';
import { AlertTriangle, Coins, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCreditCheck } from '@/hooks/useCreditCheck';
import { usePlanInfo } from '@/hooks/usePlanInfo';
import { useLocale } from '@/hooks/useLocale';

interface LowCreditWarningProps {
  onPurchase?: () => void;
  className?: string;
  threshold?: number;
}

export function LowCreditWarning({ 
  onPurchase, 
  className = '',
  threshold = 0.2
}: LowCreditWarningProps) {
  const { currentBalance, isLoading: creditLoading } = useCreditCheck('ai_assistant');
  const { monthlyCredits, isLoading: planLoading } = usePlanInfo();
  const { t } = useLocale();

  if (creditLoading || planLoading) {
    return null;
  }

  const lowThreshold = monthlyCredits * threshold;
  const criticalThreshold = monthlyCredits * 0.1;
  
  const isLow = currentBalance > 0 && currentBalance <= lowThreshold;
  const isCritical = currentBalance <= criticalThreshold;
  const isEmpty = currentBalance <= 0;

  if (!isLow && !isEmpty) {
    return null;
  }

  if (isEmpty) {
    return (
      <div 
        className={`bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4 rounded-lg ${className}`}
        data-testid="banner-credits-empty"
      >
        <div className="flex items-start gap-3">
          <Coins className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-red-900 dark:text-red-100">
              {t('billing.lowCredits.noCreditsTitle')}
            </h4>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              {t('billing.lowCredits.noCreditsDescription')}
            </p>
            <div className="mt-3">
              {onPurchase ? (
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={onPurchase}
                  data-testid="button-buy-credits-empty"
                >
                  {t('billing.lowCredits.buyCredits')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button asChild size="sm" variant="destructive" data-testid="button-buy-credits-empty">
                  <Link to="/admin/billing/manage">
                    {t('billing.lowCredits.buyCredits')}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isCritical) {
    return (
      <div 
        className={`bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 p-4 rounded-lg ${className}`}
        data-testid="banner-credits-critical"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-orange-900 dark:text-orange-100">
              {t('billing.lowCredits.criticalTitle')}
            </h4>
            <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
              {t('billing.lowCredits.criticalDescription', { balance: currentBalance.toFixed(2) })}
            </p>
            <div className="mt-3">
              {onPurchase ? (
                <Button 
                  size="sm"
                  onClick={onPurchase}
                  data-testid="button-buy-credits-critical"
                >
                  {t('billing.lowCredits.buyCredits')}
                  <Coins className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button asChild size="sm" data-testid="button-buy-credits-critical">
                  <Link to="/admin/billing/manage">
                    {t('billing.lowCredits.buyCredits')}
                    <Coins className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg ${className}`}
      data-testid="banner-credits-low"
    >
      <div className="flex items-start gap-3">
        <Coins className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-medium text-yellow-900 dark:text-yellow-100">
            {t('billing.lowCredits.lowTitle')}
          </h4>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
            {t('billing.lowCredits.lowDescription', { balance: currentBalance.toFixed(2) })}
          </p>
          <div className="mt-3">
            {onPurchase ? (
              <Button 
                size="sm"
                variant="outline"
                onClick={onPurchase}
                data-testid="button-buy-credits-low"
              >
                {t('billing.lowCredits.buyCredits')}
                <Coins className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline" data-testid="button-buy-credits-low">
                <Link to="/admin/billing/manage">
                  {t('billing.lowCredits.buyCredits')}
                  <Coins className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
