import { useQuery } from '@tanstack/react-query';
import { Coins, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getCreditBalance } from '@/lib/billing/billingClient';
import { getBalanceStatus, getBalanceColor } from '@/lib/billing/types';
import { cn } from '@/lib/utils';
import { useLocale } from '@/hooks/useLocale';

export interface UsageBreakdownItem {
  feature: string;
  label: string;
  credits: number;
}

interface CreditBalanceBadgeProps {
  organizationId: string;
  onClick?: () => void;
  className?: string;
  variant?: 'default' | 'compact';
  usageBreakdown?: UsageBreakdownItem[];
  tooltipTitle?: string;
}

export function CreditBalanceBadge({ 
  organizationId, 
  onClick,
  className,
  variant = 'default',
  usageBreakdown,
  tooltipTitle
}: CreditBalanceBadgeProps) {
  const { t } = useLocale();
  const { data: balance, isLoading } = useQuery({
    queryKey: ['/api/billing/balance', organizationId],
    queryFn: () => getCreditBalance(organizationId),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Badge variant="outline" className={cn('gap-1', className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        {variant === 'default' && <span>{t('billing.credits.loading')}</span>}
      </Badge>
    );
  }

  const currentBalance = balance ?? 0;
  const status = getBalanceStatus(currentBalance);
  const colorClass = getBalanceColor(status);

  const content = (
    <>
      <Coins className="h-3 w-3" />
      {variant === 'default' && <span className="font-medium">{currentBalance}</span>}
      {variant === 'compact' && <span className="font-medium">{currentBalance}</span>}
    </>
  );

  const tooltipContent = usageBreakdown && usageBreakdown.length > 0 ? (
    <div className="space-y-1.5">
      <p className="font-medium text-xs">{tooltipTitle || t('billing.credits.thisMonth')}</p>
      <div className="space-y-0.5">
        {usageBreakdown.map((item) => (
          <div key={item.feature} className="flex justify-between gap-4 text-xs">
            <span className="text-muted-foreground">{item.label}:</span>
            <span className="font-medium">{item.credits.toFixed(1)}</span>
          </div>
        ))}
      </div>
      <div className="border-t pt-1.5 mt-1.5">
        <div className="flex justify-between gap-4 text-xs">
          <span className="text-muted-foreground">{t('billing.credits.balance')}:</span>
          <span className="font-medium">{currentBalance}</span>
        </div>
      </div>
    </div>
  ) : (
    <p className="text-xs">{currentBalance} {t('billing.credits.remainingSimple')}</p>
  );

  const badgeElement = onClick ? (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn('gap-1.5 h-8', colorClass, className)}
      data-testid="button-credit-balance"
    >
      {content}
    </Button>
  ) : (
    <Badge 
      variant="outline" 
      className={cn('gap-1.5', colorClass, className)}
      data-testid="badge-credit-balance"
    >
      {content}
    </Badge>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {badgeElement}
      </TooltipTrigger>
      <TooltipContent>
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
}
