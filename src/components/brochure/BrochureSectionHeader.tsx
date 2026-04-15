import { ChevronDown, ChevronRight, Eye, EyeOff, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BrochureSectionHeaderProps {
  title: string;
  isExpanded: boolean;
  isVisible: boolean;
  onToggleExpand: () => void;
  onToggleVisible: () => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

export function BrochureSectionHeader({
  title,
  isExpanded,
  isVisible,
  onToggleExpand,
  onToggleVisible,
  onRegenerate,
  isRegenerating = false,
}: BrochureSectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 py-2 px-3 bg-muted/50 rounded-lg cursor-pointer select-none">
      <button onClick={onToggleExpand} className="flex items-center gap-2 flex-1 min-w-0">
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="font-semibold text-sm truncate">{title}</span>
      </button>
      <div className="flex items-center gap-1">
        {onRegenerate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={(e) => { e.stopPropagation(); onRegenerate(); }}
            disabled={isRegenerating}
            title="Regenerate with AI"
          >
            {isRegenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={(e) => { e.stopPropagation(); onToggleVisible(); }}
          title={isVisible ? 'Hide in brochure' : 'Show in brochure'}
        >
          {isVisible ? (
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <EyeOff className="h-3.5 w-3.5 text-muted-foreground/50" />
          )}
        </Button>
      </div>
    </div>
  );
}
