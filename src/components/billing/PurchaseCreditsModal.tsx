import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Coins, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCreditPacks, createCheckoutSession } from '@/lib/billing/billingClient';
import { getPriceEur } from '@/lib/billing/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useLocale } from '@/hooks/useLocale';

interface PurchaseCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  currentBalance?: number;
}

export function PurchaseCreditsModal({
  open,
  onOpenChange,
  organizationId,
  currentBalance = 0
}: PurchaseCreditsModalProps) {
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { t, formatCurrency } = useLocale();

  const { data: packs, isLoading } = useQuery({
    queryKey: ['/api/billing/credit-packs'],
    queryFn: getCreditPacks,
    enabled: open,
  });

  const handlePurchase = async (pack: { id: string; stripe_price_id?: string; name: string }) => {
    if (!pack.stripe_price_id) {
      setError(t('billing.purchase.packUnavailable'));
      return;
    }

    setSelectedPackId(pack.id);
    setIsProcessing(true);
    setError(null);

    try {
      const { url } = await createCheckoutSession({
        priceId: pack.stripe_price_id,
        mode: 'payment',
        organizationId,
      });

      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error('Purchase failed:', err);
      setError(err instanceof Error ? err.message : t('billing.purchase.checkoutFailed'));
      toast({
        title: t('billing.payment.failed'),
        description: t('billing.purchase.checkoutFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setSelectedPackId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            {t('billing.purchase.title')}
          </DialogTitle>
          <DialogDescription>
            {t('billing.purchase.description')}{' '}
            {t('billing.purchase.currentBalance', { count: currentBalance })}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {packs?.map((pack) => {
              const isPopular = pack.credits === 500;
              const priceEur = getPriceEur(pack);
              const pricePerCredit = (priceEur / pack.credits).toFixed(3);

              return (
                <Card
                  key={pack.id}
                  className={cn(
                    'relative p-6 hover-elevate cursor-pointer transition-all',
                    isPopular && 'border-primary'
                  )}
                  onClick={() => handlePurchase(pack)}
                  data-testid={`card-credit-pack-${pack.credits}`}
                >
                  {isPopular && (
                    <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
                      <Sparkles className="h-3 w-3 mr-1" />
                      {t('billing.purchase.popular')}
                    </Badge>
                  )}

                  {pack.discount_percentage && pack.discount_percentage > 0 && (
                    <Badge 
                      variant="secondary" 
                      className="absolute -top-2 right-4"
                    >
                      {t('billing.purchase.save', { percent: pack.discount_percentage })}
                    </Badge>
                  )}

                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Coins className="h-6 w-6 text-primary" />
                        <h3 className="text-3xl font-bold">{pack.credits}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">{t('billing.purchase.credits')}</p>
                    </div>

                    <div className="text-center border-t pt-4">
                      <div className="text-3xl font-bold">{formatCurrency(priceEur)}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatCurrency(parseFloat(pricePerCredit))} {t('billing.credits.perCredit')}
                      </p>
                    </div>

                    <div className="space-y-2 border-t pt-4">
                      <div className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">
                          {t('billing.purchase.socialPosts', { count: Math.floor(pack.credits / 7) })}
                        </span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">
                          {t('billing.purchase.videos', { count: Math.floor(pack.credits / 14) })}
                        </span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">
                          {t('billing.credits.neverExpires')}
                        </span>
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      variant={isPopular ? 'default' : 'outline'}
                      disabled={isProcessing}
                      data-testid={`button-buy-pack-${pack.credits}`}
                    >
                      {isProcessing && selectedPackId === pack.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          {t('billing.purchase.processing')}
                        </>
                      ) : (
                        t('billing.purchase.purchase')
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <div className="border-t pt-4 space-y-2 text-sm text-muted-foreground">
          <p className="flex items-start gap-2">
            <Check className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            {t('billing.payment.secureStripe')}
          </p>
          <p className="flex items-start gap-2">
            <Check className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            {t('billing.purchase.sharedCredits')}
          </p>
          <p className="flex items-start gap-2">
            <Check className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            {t('billing.payment.instantActivation')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
