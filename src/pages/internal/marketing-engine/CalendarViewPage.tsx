import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface PostRow {
  id: string;
  topic: string;
  topic_category: string;
  status: string;
  channels: string[] | null;
  scheduled_for: string | null;
}

const STATUS_TONE: Record<string, string> = {
  review_queue: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  scheduled: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
  failed: "bg-red-500/10 text-red-600 border-red-500/20",
  posted: "bg-muted text-muted-foreground",
  planning: "bg-muted text-muted-foreground",
  rendering: "bg-muted text-muted-foreground",
};

export default function CalendarViewPage() {
  const navigate = useNavigate();

  const { data: posts } = useQuery<PostRow[]>({
    queryKey: ["marketing-engine-calendar"],
    queryFn: async () => {
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 14);
      const { data } = await supabase
        .from("marketing_engine_posts")
        .select("id, topic, topic_category, status, channels, scheduled_for")
        .not("scheduled_for", "is", null)
        .gte("scheduled_for", start.toISOString())
        .lte("scheduled_for", end.toISOString())
        .order("scheduled_for");
      return (data ?? []) as PostRow[];
    },
  });

  const days = buildDayBuckets(14);
  const byDate = new Map<string, PostRow[]>();
  for (const p of posts ?? []) {
    if (!p.scheduled_for) continue;
    const key = p.scheduled_for.slice(0, 10);
    byDate.set(key, [...(byDate.get(key) ?? []), p]);
  }

  return (
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
              Next 14 days. Approved posts publish at their scheduled time.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" /> 14-day forward view
            </CardTitle>
            <CardDescription>
              Click a post id to jump to the approval queue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {days.map((day) => {
              const items = byDate.get(day.iso) ?? [];
              return (
                <div key={day.iso} className="border rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{day.label}</span>
                      <span className="text-xs text-muted-foreground">{day.iso}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{items.length} post(s)</span>
                  </div>
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">no posts scheduled</p>
                  ) : (
                    <div className="space-y-1">
                      {items.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 text-sm py-1 hover:bg-muted/40 rounded px-2"
                        >
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground w-16 shrink-0">
                            {p.scheduled_for
                              ? new Date(p.scheduled_for).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-xs shrink-0 ${STATUS_TONE[p.status] ?? ""}`}
                          >
                            {p.status}
                          </Badge>
                          <code className="text-xs text-muted-foreground">{p.topic}</code>
                          <span className="text-xs text-muted-foreground">
                            ({p.topic_category})
                          </span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {(p.channels ?? []).join(", ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
  );
}

function buildDayBuckets(n: number): { iso: string; label: string }[] {
  const days: { iso: string; label: string }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    days.push({ iso, label });
  }
  return days;
}
