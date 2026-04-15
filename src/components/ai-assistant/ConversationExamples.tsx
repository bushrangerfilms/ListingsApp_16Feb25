import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ThumbsUp, ThumbsDown, Loader2, MessageSquare, Trash2 } from "lucide-react";
import { format } from "date-fns";

export const ConversationExamples = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ratingNotes, setRatingNotes] = useState("");

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["ai-test-conversations"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("ai_test_conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  const rateMutation = useMutation({
    mutationFn: async ({ id, rating, notes }: { id: string; rating: number; notes?: string }) => {
      const { error } = await supabase
        .from("ai_test_conversations")
        .update({ rating, notes })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-test-conversations"] });
      setRatingNotes("");
      toast({
        title: "Rating Saved",
        description: "Your feedback has been recorded",
      });
    },
    onError: (error) => {
      toast({
        title: "Rating Failed",
        description: error instanceof Error ? error.message : "Failed to save rating",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ai_test_conversations")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-test-conversations"] });
      toast({
        title: "Conversation Deleted",
        description: "Test conversation has been removed",
      });
    },
  });

  const saveTestConversation = async (messages: any[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("ai_test_conversations").insert({
      user_id: user.id,
      messages,
    });

    queryClient.invalidateQueries({ queryKey: ["ai-test-conversations"] });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!conversations || conversations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conversation Examples</CardTitle>
          <CardDescription>
            Test conversations will appear here for review and rating
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No test conversations yet. Use the chat tester above to create some!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversation Examples</CardTitle>
        <CardDescription>
          Review and rate past test conversations to improve performance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {conversations.map((conv) => {
          const messages = conv.messages as any[];
          const isExpanded = expandedId === conv.id;

          return (
            <div key={conv.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {messages.length} messages
                    </span>
                    <span className="text-sm text-muted-foreground">
                      • {format(new Date(conv.created_at), "MMM d, yyyy")}
                    </span>
                    {conv.rating && (
                      <Badge variant="secondary">
                        {conv.rating} / 5
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {messages[0]?.content || "No messages"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedId(isExpanded ? null : conv.id)}
                  >
                    {isExpanded ? "Collapse" : "Expand"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(conv.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <div className="space-y-4 mt-4 pt-4 border-t">
                  <div className="space-y-2">
                    {messages.map((msg, i) => (
                      <div
                        key={i}
                        className={`p-2 rounded text-sm ${
                          msg.role === "user" ? "bg-primary/10" : "bg-muted"
                        }`}
                      >
                        <span className="font-medium">
                          {msg.role === "user" ? "User" : "Assistant"}:
                        </span>{" "}
                        {msg.content}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Rate this conversation:</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <Button
                            key={rating}
                            variant={conv.rating === rating ? "default" : "outline"}
                            size="sm"
                            onClick={() =>
                              rateMutation.mutate({
                                id: conv.id,
                                rating,
                                notes: ratingNotes,
                              })
                            }
                            disabled={rateMutation.isPending}
                          >
                            {rating}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <Textarea
                      placeholder="Add notes about this conversation (optional)"
                      value={conv.notes || ratingNotes}
                      onChange={(e) => setRatingNotes(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
