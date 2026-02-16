import { Link } from 'react-router-dom';
import { Check, ChevronRight, ExternalLink, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TaskItemProps {
  title: string;
  description?: string;
  isComplete: boolean;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
  external?: boolean;
}

export function TaskItem({ 
  title, 
  description, 
  isComplete, 
  href, 
  icon: Icon,
  disabled = false,
  external = false
}: TaskItemProps) {
  const content = (
    <div 
      className={cn(
        "flex items-center gap-3 p-2 rounded-md transition-colors",
        !disabled && !isComplete && "hover-elevate cursor-pointer",
        isComplete && "opacity-60"
      )}
      data-testid={`task-item-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div 
        className={cn(
          "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center border",
          isComplete 
            ? "bg-green-500 border-green-500 text-white" 
            : "border-muted-foreground/30 text-muted-foreground"
        )}
      >
        {isComplete ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <Icon className="w-3 h-3" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium truncate text-foreground",
          isComplete && "line-through text-muted-foreground"
        )}>
          {title}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground/80 truncate">
            {description}
          </p>
        )}
      </div>
      
      {!isComplete && !disabled && (
        external ? (
          <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )
      )}
    </div>
  );

  if (isComplete || disabled) {
    return content;
  }

  if (external) {
    return (
      <a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="block"
      >
        {content}
      </a>
    );
  }

  return (
    <Link to={href} className="block">
      {content}
    </Link>
  );
}
