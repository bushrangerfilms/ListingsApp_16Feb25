/**
 * UK Preview Banner
 * Displays a prominent banner when Super Admin is in UK preview mode
 * Indicates that they're viewing the app as a UK organization
 */

import { AlertTriangle, Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/hooks/useLocale';
import { Badge } from '@/components/ui/badge';

interface UKPreviewBannerProps {
  onDisable?: () => void;
}

export function UKPreviewBanner({ onDisable }: UKPreviewBannerProps) {
  const { isPreviewMode, locale, currency } = useLocale();
  
  if (!isPreviewMode) {
    return null;
  }
  
  return (
    <div 
      className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2"
      data-testid="banner-uk-preview"
    >
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Eye className="h-4 w-4" />
            <span className="font-medium text-sm">UK Preview Mode</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-background">
              {locale}
            </Badge>
            <Badge variant="outline" className="text-xs bg-background">
              {currency}
            </Badge>
          </div>
          
          <span className="text-sm text-muted-foreground hidden sm:inline">
            Viewing as UK organization (session only)
          </span>
        </div>
        
        {onDisable && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDisable}
            className="text-amber-600 dark:text-amber-400"
            data-testid="button-disable-preview"
          >
            <X className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Exit Preview</span>
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Compact version for use in headers
 */
export function UKPreviewIndicator() {
  const { isPreviewMode, locale } = useLocale();
  
  if (!isPreviewMode) {
    return null;
  }
  
  return (
    <div 
      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400"
      data-testid="indicator-uk-preview"
    >
      <Eye className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">{locale}</span>
    </div>
  );
}

export default UKPreviewBanner;
