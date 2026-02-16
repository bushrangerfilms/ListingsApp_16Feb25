import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Download, ArrowDownCircle, ArrowUpCircle, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCreditHistory } from '@/lib/billing/billingClient';
import type { CreditTransaction } from '@/lib/billing/types';
import { useLocale } from '@/hooks/useLocale';

interface BillingHistoryTableProps {
  organizationId: string;
}

export function BillingHistoryTable({ organizationId }: BillingHistoryTableProps) {
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const { t } = useLocale();

  const { data, isLoading } = useQuery({
    queryKey: ['/api/billing/history', organizationId, page],
    queryFn: () => getCreditHistory(organizationId, pageSize, page * pageSize),
  });

  const handleExportCSV = () => {
    if (!data?.transactions) return;

    const csv = [
      [t('billing.history.date'), t('billing.history.type'), t('billing.credits.amount'), t('billing.history.balanceAfter'), 'Source', t('billing.credits.description')].join(','),
      ...data.transactions.map(t => [
        new Date(t.created_at).toLocaleString(),
        t.transaction_type,
        t.amount,
        t.balance_after,
        t.source,
        `"${t.description}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credit-history-${new Date().toISOString()}.csv`;
    a.click();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            View your credit purchases and usage
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleExportCSV}
          disabled={!data?.transactions?.length}
          data-testid="button-export-csv"
        >
          <Download className="h-4 w-4 mr-2" />
          {t('billing.history.exportCsv')}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.transactions?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            {t('billing.history.noTransactions')}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('billing.history.date')}</TableHead>
                  <TableHead>{t('billing.history.type')}</TableHead>
                  <TableHead>{t('billing.credits.description')}</TableHead>
                  <TableHead className="text-right">{t('billing.credits.amount')}</TableHead>
                  <TableHead className="text-right">{t('billing.history.balanceAfter')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.transactions.map((transaction: CreditTransaction) => (
                  <TableRow key={transaction.id} data-testid={`row-transaction-${transaction.id}`}>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(transaction.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      {transaction.transaction_type === 'credit' ? (
                        <Badge variant="default" className="gap-1">
                          <ArrowUpCircle className="h-3 w-3" />
                          {t('billing.history.credit')}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <ArrowDownCircle className="h-3 w-3" />
                          {t('billing.history.debit')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{transaction.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {transaction.source.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {transaction.transaction_type === 'credit' ? '+' : '-'}
                      {Math.abs(transaction.amount)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {transaction.balance_after}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {data.has_more && (
              <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  data-testid="button-previous-page"
                >
                  {t('billing.history.previous')}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {t('billing.history.page', { number: page + 1 })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  data-testid="button-next-page"
                >
                  {t('billing.history.next')}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
