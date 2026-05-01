// Marketing engine calendar — month grid.
//
// Mirrors the customer-facing Socials > Scheduling MonthlyCalendarView
// layout: navigable month, 7-column day grid, posts shown as tinted
// pills inside each day cell. Tooltip on hover shows topic + status +
// channels.
//
// Reads from marketing_engine_posts where scheduled_for is set.
// Click a post pill → jump to /internal/marketing-engine/queue and
// scroll to that post (existing scroll-into-view hook on the
// approval page handles the rest).

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ArrowLeft, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface PostRow {
  id: string;
  topic: string;
  topic_category: string;
  status: string;
  channels: string[] | null;
  scheduled_for: string | null;
}

const STATUS_CHIP: Record<string, string> = {
  posted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  approved: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  scheduled: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  review_queue: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  pending_approval: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  rejected: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  failed: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  planning: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30",
};

const STATUS_DOT: Record<string, string> = {
  posted: "bg-emerald-500",
  approved: "bg-blue-500",
  scheduled: "bg-blue-500",
  review_queue: "bg-amber-500",
  pending_approval: "bg-amber-500",
  rejected: "bg-red-500",
  failed: "bg-red-500",
  planning: "bg-slate-400",
};

export default function CalendarViewPage() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Calendar window = full visible grid (overflow days from prev / next month).
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  // Use Monday as week start to match the Socials product default.
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const { data: posts } = useQuery<PostRow[]>({
    queryKey: ["me-calendar-posts", currentMonth.toISOString().slice(0, 7)],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_engine_posts")
        .select("id, topic, topic_category, status, channels, scheduled_for")
        .not("scheduled_for", "is", null)
        .gte("scheduled_for", calendarStart.toISOString())
        .lte("scheduled_for", calendarEnd.toISOString())
        .order("scheduled_for");
      return (data ?? []) as PostRow[];
    },
  });

  const days = useMemo(() => {
    const out: Date[] = [];
    let d = calendarStart;
    while (d <= calendarEnd) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [calendarStart, calendarEnd]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, PostRow[]>();
    for (const p of posts ?? []) {
      if (!p.scheduled_for) continue;
      const key = p.scheduled_for.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return map;
  }, [posts]);

  // Counts in the visible window.
  const total = posts?.length ?? 0;
  const posted = (posts ?? []).filter((p) => p.status === "posted").length;
  const upcoming = (posts ?? []).filter(
    (p) =>
      (p.status === "approved" || p.status === "scheduled") &&
      p.scheduled_for &&
      new Date(p.scheduled_for) > new Date(),
  ).length;

  const weekDayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const goToPostInQueue = (id: string) => {
    navigate(`/internal/marketing-engine/queue#post-${id}`);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/internal/marketing-engine")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
            <p className="text-muted-foreground mt-1">
              Marketing engine posts grouped by day. Approved + scheduled posts
              publish at their scheduled time once <code>publish_enabled</code> is on.
            </p>
          </div>
        </div>

        {/* Month nav + KPIs */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <CardTitle className="flex items-center gap-2 min-w-[200px] justify-center text-lg">
                  <CalendarIcon className="h-5 w-5" />
                  {format(currentMonth, "MMMM yyyy")}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  Today
                </Button>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <KpiPill label="Posts in view" value={total} />
                <KpiPill label="Posted" value={posted} tone="ok" />
                <KpiPill label="Upcoming" value={upcoming} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day-of-week header */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {weekDayHeaders.map((d) => (
                <div
                  key={d}
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-center py-2"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const inMonth = isSameMonth(day, currentMonth);
                const dayPosts = postsByDay.get(format(day, "yyyy-MM-dd")) ?? [];
                const today = isToday(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "min-h-[110px] border rounded-md p-1.5 transition-colors",
                      inMonth ? "bg-background" : "bg-muted/30",
                      today && "border-primary ring-1 ring-primary/40",
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div
                        className={cn(
                          "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                          inMonth ? "" : "text-muted-foreground",
                          today && "bg-primary text-primary-foreground",
                        )}
                      >
                        {format(day, "d")}
                      </div>
                      {dayPosts.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {dayPosts.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      {dayPosts.slice(0, 4).map((p) => (
                        <Tooltip key={p.id}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => goToPostInQueue(p.id)}
                              className={cn(
                                "w-full text-left text-[10px] leading-tight rounded px-1.5 py-1 border truncate hover:opacity-80 transition-opacity",
                                STATUS_CHIP[p.status] ?? STATUS_CHIP.planning,
                              )}
                            >
                              <div className="flex items-center gap-1">
                                <span
                                  className={cn(
                                    "h-1.5 w-1.5 rounded-full shrink-0",
                                    STATUS_DOT[p.status] ?? STATUS_DOT.planning,
                                  )}
                                />
                                <span className="truncate">
                                  {p.scheduled_for &&
                                    format(new Date(p.scheduled_for), "HH:mm")}
                                  {" · "}
                                  {p.topic}
                                </span>
                              </div>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {p.status}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {p.topic_category}
                                </span>
                              </div>
                              <div className="font-medium text-sm">{p.topic}</div>
                              <div className="text-xs text-muted-foreground">
                                {p.scheduled_for
                                  ? new Date(p.scheduled_for).toLocaleString()
                                  : "—"}
                              </div>
                              <div className="text-xs">
                                {(p.channels ?? []).join(", ") || "no channels"}
                              </div>
                              <div className="text-xs text-muted-foreground italic mt-1">
                                Click to open in approval queue
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                      {dayPosts.length > 4 && (
                        <button
                          onClick={() => goToPostInQueue(dayPosts[0].id)}
                          className="w-full text-[10px] text-muted-foreground text-center py-0.5 hover:text-foreground transition-colors"
                        >
                          +{dayPosts.length - 4} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

function KpiPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "default";
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted">
      <span className="text-muted-foreground uppercase tracking-wide text-[10px]">
        {label}
      </span>
      <span className={cn("font-semibold", tone === "ok" ? "text-emerald-600" : "")}>
        {value}
      </span>
    </div>
  );
}
