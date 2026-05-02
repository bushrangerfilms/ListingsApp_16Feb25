// Marketing engine calendar — unified Month / Week / Review interface.
//
// Mirrors the customer-facing Socials Scheduling page (3-tab toggle):
//   - Month: 7-column day grid, posts as tinted pills inside each cell
//   - Week:  7 day-columns, posts as cards sorted by time within each day
//   - Review: vertical list of pending_approval / review_queue posts with
//             one-click approve / reject (the "human-in-the-loop" surface)
//
// Reads from marketing_engine_posts where scheduled_for is set (Month/Week)
// or where status is review_queue / pending_approval (Review).

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Grid3x3,
  Check,
  X,
  ExternalLink,
} from "lucide-react";
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
import { toast } from "sonner";

interface PostRow {
  id: string;
  topic: string;
  topic_category: string;
  status: string;
  channels: string[] | null;
  scheduled_for: string | null;
}

interface ReviewPostRow extends PostRow {
  copy_variants: Record<string, { caption: string }> | null;
  output_assets: Record<string, string[]> | null;
  reviewer_decision: string | null;
  reviewer_score: number | null;
  reviewer_feedback: string | null;
  variation_axes: { hook_style?: string; tone?: string; cta_style?: string } | null;
  approved_by: string | null;
  approved_at: string | null;
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
  drafting: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30",
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
  drafting: "bg-slate-400",
};

type ViewMode = "month" | "week" | "review";

export default function CalendarViewPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());

  // Pending approval count for the Review tab badge.
  const { data: pendingCount } = useQuery<number>({
    queryKey: ["me-calendar-pending-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("marketing_engine_posts")
        .select("id", { count: "exact", head: true })
        .in("status", ["review_queue", "pending_approval"]);
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });

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
          {/* View toggle — mirrors Socials Scheduling page pattern */}
          <div className="flex items-center bg-muted rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 px-3 gap-2",
                viewMode === "month" && "bg-background shadow-sm",
              )}
              onClick={() => setViewMode("month")}
              data-testid="tab-month"
            >
              <CalendarIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Month</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 px-3 gap-2",
                viewMode === "week" && "bg-background shadow-sm",
              )}
              onClick={() => setViewMode("week")}
              data-testid="tab-week"
            >
              <Grid3x3 className="h-4 w-4" />
              <span className="hidden sm:inline">Week</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 px-3 gap-2",
                viewMode === "review" && "bg-background shadow-sm",
              )}
              onClick={() => setViewMode("review")}
              data-testid="tab-review"
            >
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Review</span>
              {!!pendingCount && pendingCount > 0 && (
                <Badge
                  variant="destructive"
                  className="h-5 min-w-5 px-1 text-[10px] font-semibold"
                >
                  {pendingCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {viewMode === "month" && (
          <MonthView
            currentMonth={currentMonth}
            onPrev={() => setCurrentMonth(subMonths(currentMonth, 1))}
            onNext={() => setCurrentMonth(addMonths(currentMonth, 1))}
            onToday={() => setCurrentMonth(new Date())}
            onWeekClick={(d) => {
              setCurrentWeek(d);
              setViewMode("week");
            }}
            onPostClick={(id) =>
              navigate(`/internal/marketing-engine/queue#post-${id}`)
            }
          />
        )}
        {viewMode === "week" && (
          <WeekView
            currentWeek={currentWeek}
            onPrev={() => setCurrentWeek(subWeeks(currentWeek, 1))}
            onNext={() => setCurrentWeek(addWeeks(currentWeek, 1))}
            onToday={() => setCurrentWeek(new Date())}
            onBackToMonth={() => setViewMode("month")}
            onPostClick={(id) =>
              navigate(`/internal/marketing-engine/queue#post-${id}`)
            }
          />
        )}
        {viewMode === "review" && <ReviewView />}
      </div>
    </TooltipProvider>
  );
}

// ── Month view ─────────────────────────────────────────────────────

function MonthView({
  currentMonth,
  onPrev,
  onNext,
  onToday,
  onWeekClick,
  onPostClick,
}: {
  currentMonth: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onWeekClick: (weekStart: Date) => void;
  onPostClick: (id: string) => void;
}) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const { data: posts } = useQuery<PostRow[]>({
    queryKey: ["me-calendar-posts-month", currentMonth.toISOString().slice(0, 7)],
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

  const total = posts?.length ?? 0;
  const posted = (posts ?? []).filter((p) => p.status === "posted").length;
  const upcoming = (posts ?? []).filter(
    (p) =>
      (p.status === "approved" || p.status === "scheduled") &&
      p.scheduled_for &&
      new Date(p.scheduled_for) > new Date(),
  ).length;

  const weekDayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onPrev}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <CardTitle className="flex items-center gap-2 min-w-[200px] justify-center text-lg">
              <CalendarIcon className="h-5 w-5" />
              {format(currentMonth, "MMMM yyyy")}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onNext}>
              <ChevronRight className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="sm" onClick={onToday}>
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
                  <button
                    onClick={() =>
                      onWeekClick(startOfWeek(day, { weekStartsOn: 1 }))
                    }
                    className={cn(
                      "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full hover:bg-muted transition-colors",
                      inMonth ? "" : "text-muted-foreground",
                      today && "bg-primary text-primary-foreground hover:bg-primary",
                    )}
                    title="Open week view"
                  >
                    {format(day, "d")}
                  </button>
                  {dayPosts.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {dayPosts.length}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {dayPosts.slice(0, 4).map((p) => (
                    <PostPill key={p.id} post={p} onClick={() => onPostClick(p.id)} />
                  ))}
                  {dayPosts.length > 4 && (
                    <button
                      onClick={() =>
                        onWeekClick(startOfWeek(day, { weekStartsOn: 1 }))
                      }
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
  );
}

// ── Week view ──────────────────────────────────────────────────────

// 12 two-hour slot anchors per day, UTC. Mirrors the migration
// 20260502110900 contract: slot N anchors at hour N*2 UTC.
const SLOT_HOURS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22] as const;

// Look up the slot index (0..11) of a UTC timestamp.
function slotIndexOf(t: Date): number {
  return Math.floor(t.getUTCHours() / 2);
}

function WeekView({
  currentWeek,
  onPrev,
  onNext,
  onToday,
  onBackToMonth,
  onPostClick,
}: {
  currentWeek: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onBackToMonth: () => void;
  onPostClick: (id: string) => void;
}) {
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

  const { data: posts } = useQuery<PostRow[]>({
    queryKey: ["me-calendar-posts-week", weekStart.toISOString().slice(0, 10)],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_engine_posts")
        .select("id, topic, topic_category, status, channels, scheduled_for")
        .not("scheduled_for", "is", null)
        .gte("scheduled_for", weekStart.toISOString())
        .lte("scheduled_for", weekEnd.toISOString())
        .order("scheduled_for");
      return (data ?? []) as PostRow[];
    },
  });

  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < 7; i++) out.push(addDays(weekStart, i));
    return out;
  }, [weekStart]);

  // Slot grid: keyed by `${dayIso}|${slotIdx}`. Active posts collide-free
  // (one per slot via the unique partial index in DB); rejected/failed
  // can pile up but are visually distinct enough to share a cell.
  const postBySlot = useMemo(() => {
    const map = new Map<string, PostRow>();
    for (const p of posts ?? []) {
      if (!p.scheduled_for) continue;
      const dt = new Date(p.scheduled_for);
      const dayKey = format(dt, "yyyy-MM-dd");
      const key = `${dayKey}|${slotIndexOf(dt)}`;
      // First wins — should never collide for active posts due to DB
      // unique index on scheduled_for. Rejected/failed siblings get
      // dropped in this view (visible in Review tab + Recent failures).
      if (!map.has(key)) map.set(key, p);
    }
    return map;
  }, [posts]);

  const total = posts?.length ?? 0;
  const weekDayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onPrev}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <CardTitle className="flex items-center gap-2 min-w-[260px] justify-center text-lg">
              <Grid3x3 className="h-5 w-5" />
              {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onNext}>
              <ChevronRight className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="sm" onClick={onToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={onBackToMonth}>
              <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
              Month
            </Button>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <KpiPill label="Posts in view" value={total} />
            <span className="text-muted-foreground text-[10px]">
              12 slots/day · 2h each · UTC
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {/* Day header row: time-label gutter + 7 day columns */}
        <div
          className="grid gap-1 mb-1"
          style={{ gridTemplateColumns: "60px repeat(7, minmax(0, 1fr))" }}
        >
          <div /> {/* gutter spacer */}
          {days.map((day, i) => {
            const today = isToday(day);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "text-center py-1.5 border-b text-xs",
                  today && "bg-primary/5",
                )}
              >
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {weekDayHeaders[i]}
                </div>
                <div
                  className={cn(
                    "font-semibold",
                    today && "text-primary",
                  )}
                >
                  {format(day, "d MMM")}
                </div>
              </div>
            );
          })}
        </div>

        {/* Slot rows: one row per 2-hour slot, 12 rows */}
        {SLOT_HOURS.map((hour) => (
          <div
            key={hour}
            className="grid gap-1 mb-1"
            style={{ gridTemplateColumns: "60px repeat(7, minmax(0, 1fr))" }}
          >
            <div className="flex items-start justify-end pr-2 pt-1.5">
              <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                {String(hour).padStart(2, "0")}:00
              </span>
            </div>
            {days.map((day) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const slotIdx = SLOT_HOURS.indexOf(hour);
              const post = postBySlot.get(`${dayKey}|${slotIdx}`);
              const today = isToday(day);
              return (
                <div
                  key={`${dayKey}-${hour}`}
                  className={cn(
                    "min-h-[42px] border rounded p-0.5 transition-colors",
                    today && "bg-primary/5",
                    post ? "" : "bg-muted/20 border-dashed border-muted-foreground/15",
                  )}
                >
                  {post ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onPostClick(post.id)}
                          className={cn(
                            "w-full h-full text-left text-[10px] leading-tight rounded px-1.5 py-1 border truncate hover:opacity-80 transition-opacity",
                            STATUS_CHIP[post.status] ?? STATUS_CHIP.planning,
                          )}
                        >
                          <div className="flex items-center gap-1">
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full shrink-0",
                                STATUS_DOT[post.status] ?? STATUS_DOT.planning,
                              )}
                            />
                            <span className="truncate">{post.topic}</span>
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <PostTooltip post={post} />
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Review view ────────────────────────────────────────────────────

function ReviewView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: posts } = useQuery<ReviewPostRow[]>({
    queryKey: ["me-calendar-review-queue"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_engine_posts")
        .select(
          "id, topic, topic_category, status, channels, scheduled_for, copy_variants, output_assets, reviewer_decision, reviewer_score, reviewer_feedback, variation_axes, approved_by, approved_at",
        )
        .in("status", ["review_queue", "pending_approval"])
        .order("scheduled_for", { ascending: true, nullsFirst: false })
        .limit(50);
      return (data ?? []) as ReviewPostRow[];
    },
    refetchInterval: 30_000,
  });

  const updateStatus = useMutation({
    mutationFn: async (args: { id: string; status: string }) => {
      const updates: Record<string, unknown> = {
        status: args.status,
        updated_at: new Date().toISOString(),
      };
      if (args.status === "approved") {
        // Hard human-approval gate. Publisher refuses to ship without
        // approved_by — see memory/feedback_marketing_engine_human_approval_required.md.
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId) {
          throw new Error("Not authenticated — sign in again before approving");
        }
        updates.approved_at = new Date().toISOString();
        updates.approved_by = userId;
      }
      const { error } = await supabase
        .from("marketing_engine_posts")
        .update(updates)
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      toast.success(vars.status === "approved" ? "Approved" : "Rejected");
      queryClient.invalidateQueries({ queryKey: ["me-calendar-review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["me-calendar-pending-count"] });
    },
    onError: (err: Error) =>
      toast.error("Update failed", { description: err.message }),
  });

  const total = posts?.length ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardCheck className="h-5 w-5" />
            Review queue
            {total > 0 && (
              <Badge variant="outline" className="ml-1">
                {total} pending
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/internal/marketing-engine/queue")}
          >
            Full approval queue
            <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            No posts pending review.
          </div>
        ) : (
          <div className="space-y-2">
            {(posts ?? []).map((p) => (
              <ReviewRow
                key={p.id}
                post={p}
                onApprove={() =>
                  updateStatus.mutate({ id: p.id, status: "approved" })
                }
                onReject={() =>
                  updateStatus.mutate({ id: p.id, status: "rejected" })
                }
                onOpen={() =>
                  navigate(`/internal/marketing-engine/queue#post-${p.id}`)
                }
                isPending={updateStatus.isPending}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReviewRow({
  post,
  onApprove,
  onReject,
  onOpen,
  isPending,
}: {
  post: ReviewPostRow;
  onApprove: () => void;
  onReject: () => void;
  onOpen: () => void;
  isPending: boolean;
}) {
  const sampleCaption =
    post.copy_variants
      ? Object.values(post.copy_variants)[0]?.caption ?? null
      : null;
  return (
    <div className="flex items-start gap-3 p-3 border rounded-md hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Badge
            variant="outline"
            className={STATUS_CHIP[post.status] ?? STATUS_CHIP.review_queue}
          >
            {post.status}
          </Badge>
          <code className="text-xs">{post.topic}</code>
          <Badge variant="secondary" className="text-[10px] h-4 px-1">
            {post.topic_category}
          </Badge>
          {post.variation_axes?.hook_style && (
            <Badge
              variant="outline"
              className="text-[10px] h-4 px-1 text-amber-700 dark:text-amber-400 border-amber-500/30"
            >
              hook: {post.variation_axes.hook_style}
            </Badge>
          )}
          {typeof post.reviewer_score === "number" && (
            <Badge variant="outline" className="text-[10px] h-4 px-1">
              ai score {post.reviewer_score}/10
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {post.scheduled_for
              ? new Date(post.scheduled_for).toLocaleString()
              : "no schedule"}
          </span>
        </div>
        {sampleCaption && (
          <div className="text-xs text-muted-foreground line-clamp-2">
            {sampleCaption}
          </div>
        )}
        {post.reviewer_feedback && (
          <div className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 italic line-clamp-1">
            AI feedback: {post.reviewer_feedback}
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {(post.channels ?? []).map((ch) => (
            <Badge
              key={ch}
              variant="outline"
              className="text-[10px] h-4 px-1 text-muted-foreground"
            >
              {ch}
            </Badge>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="sm"
          variant="outline"
          onClick={onOpen}
          title="Open in full approval queue"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onReject}
          disabled={isPending}
          className="text-rose-700 dark:text-rose-400 hover:bg-rose-500/10"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Reject
        </Button>
        <Button size="sm" onClick={onApprove} disabled={isPending}>
          <Check className="h-3.5 w-3.5 mr-1" />
          Approve
        </Button>
      </div>
    </div>
  );
}

// ── Shared bits ────────────────────────────────────────────────────

function PostPill({
  post,
  onClick,
}: {
  post: PostRow;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "w-full text-left text-[10px] leading-tight rounded px-1.5 py-1 border truncate hover:opacity-80 transition-opacity",
            STATUS_CHIP[post.status] ?? STATUS_CHIP.planning,
          )}
        >
          <div className="flex items-center gap-1">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full shrink-0",
                STATUS_DOT[post.status] ?? STATUS_DOT.planning,
              )}
            />
            <span className="truncate">
              {post.scheduled_for &&
                format(new Date(post.scheduled_for), "HH:mm")}
              {" · "}
              {post.topic}
            </span>
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <PostTooltip post={post} />
      </TooltipContent>
    </Tooltip>
  );
}

// PostCard removed — Week view's old day-column layout was replaced
// with a slot grid (12 rows × 7 days) that renders posts inline.
// PostPill (above) handles the Month view; the slot grid uses
// dedicated inline rendering per cell.

function PostTooltip({ post }: { post: PostRow }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {post.status}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {post.topic_category}
        </span>
      </div>
      <div className="font-medium text-sm">{post.topic}</div>
      <div className="text-xs text-muted-foreground">
        {post.scheduled_for
          ? new Date(post.scheduled_for).toLocaleString()
          : "—"}
      </div>
      <div className="text-xs">
        {(post.channels ?? []).join(", ") || "no channels"}
      </div>
      <div className="text-xs text-muted-foreground italic mt-1">
        Click to open in approval queue
      </div>
    </div>
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
