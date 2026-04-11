import { PlayCircle } from 'lucide-react';

interface GuidanceVideoLinkProps {
  url: string;
  label: string;
  duration?: string;
  variant?: 'pill' | 'inline';
}

export function GuidanceVideoLink({ url, label, duration, variant = 'pill' }: GuidanceVideoLinkProps) {
  if (variant === 'inline') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <PlayCircle className="h-4 w-4" />
        <span>{label}</span>
        {duration && <span className="text-xs">({duration})</span>}
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-colors"
    >
      <PlayCircle className="h-4 w-4" />
      <span>{label}</span>
      {duration && <span className="text-xs opacity-70">({duration})</span>}
    </a>
  );
}
