import { useState, useEffect } from 'react';
import { ChevronDown, PlayCircle, GraduationCap } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { useSidebar } from '@/components/ui/sidebar';
import {
  academyVideos,
  getWatchedVideoIds,
  markVideoWatched,
} from '@/lib/academyVideos';

export function AcademySection() {
  const { open: sidebarOpen } = useSidebar();
  const [isOpen, setIsOpen] = useState(false);
  const [watchedIds, setWatchedIds] = useState<string[]>([]);

  useEffect(() => {
    setWatchedIds(getWatchedVideoIds());
  }, []);

  if (!sidebarOpen) return null;

  const sortedVideos = [...academyVideos].sort((a, b) =>
    b.addedAt.localeCompare(a.addedAt)
  );
  const hasUnwatched = sortedVideos.some((v) => !watchedIds.includes(v.id));

  const handleVideoClick = (id: string, url: string) => {
    setWatchedIds(markVideoWatched(id));
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="px-3 pt-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button
            className="flex items-center gap-2 w-full rounded-md px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            data-testid="academy-toggle"
          >
            <GraduationCap className="h-4 w-4 text-slate-500 flex-shrink-0" />
            <span className="flex-1 text-left">Academy</span>
            {hasUnwatched && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-600 border-cyan-300/50 font-medium"
                data-testid="badge-academy-new"
              >
                New
              </Badge>
            )}
            <ChevronDown
              className={`h-4 w-4 text-slate-400 flex-shrink-0 transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="mt-1 space-y-1 pl-1">
            {sortedVideos.map((video) => {
              const isNew = !watchedIds.includes(video.id);
              return (
                <li key={video.id}>
                  <button
                    onClick={() => handleVideoClick(video.id, video.url)}
                    className="w-full text-left rounded-md px-2 py-2 hover:bg-slate-100 transition-colors group"
                    data-testid={`academy-video-${video.id}`}
                  >
                    <div className="flex items-start gap-2">
                      <PlayCircle className="h-4 w-4 text-slate-400 group-hover:text-primary flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-800 truncate">
                            {video.title}
                          </span>
                          {isNew && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 h-3.5 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-600 border-cyan-300/50 font-medium flex-shrink-0"
                            >
                              New
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                          {video.description}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
