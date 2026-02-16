import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Send, Loader2, Bot, User, Clock, Coins, Zap } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useLocale } from "@/hooks/useLocale";

type Message = {
  role: "user" | "assistant";
  content: string;
  metadata?: {
    model?: string;
    responseTime?: number;
    tokens?: number;
  };
};


export const ChatTester = () => {
  const { toast } = useToast();
  const { t } = useLocale();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const sampleQuestions = [
    t('ai-assistant.sampleQuestions.q1'),
    t('ai-assistant.sampleQuestions.q2'),
    t('ai-assistant.sampleQuestions.q3'),
    t('ai-assistant.sampleQuestions.q4'),
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const startTime = Date.now();
      
      // Get user config
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: config } = await supabase
        .from("ai_assistant_config")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      // Simulate AI response (in production, this would call the actual edge function)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const responseTime = Date.now() - startTime;
      
      // Mock response based on question
      let mockResponse = "";
      if (userMessage.toLowerCase().includes("3-bed")) {
        mockResponse = "I'd be happy to help you find 3-bedroom houses under €300k! Based on our current listings, we have several great options in Waterford area. Would you like me to show you properties in specific neighbourhoods, or would you prefer to see all available options?";
      } else if (userMessage.toLowerCase().includes("market")) {
        mockResponse = "The Waterford property market has been quite active recently. We're seeing steady demand for family homes, with average prices holding stable. First-time buyers are particularly active, and properties with good energy ratings are attracting premium interest. Would you like more specific information about any particular area?";
      } else if (userMessage.toLowerCase().includes("services")) {
        mockResponse = "Bridge Auctioneers offers comprehensive property services including property sales, professional valuations, market analysis, and expert guidance throughout the buying or selling process. We specialize in the Waterford area and surrounding regions. Is there a specific service you're interested in learning more about?";
      } else if (userMessage.toLowerCase().includes("garden") || userMessage.toLowerCase().includes("family")) {
        mockResponse = "Perfect! Family homes with gardens are in high demand. We have several properties that would suit your needs. Can you tell me more about your requirements? For example, how many bedrooms, preferred location, and your budget range?";
      } else if (userMessage.toLowerCase().includes("first-time")) {
        mockResponse = "For first-time buyers, I'd recommend looking at areas like Newtown, Ardkeen, and Ballybeg which offer great value while still being well-connected to the city center. These areas have good schools, amenities, and public transport links. Would you like to see available properties in any of these areas?";
      } else {
        mockResponse = `Thank you for your question! I'm here to help you with property searches, market insights, and information about Bridge Auctioneers' services. Could you please provide more details about what you're looking for?`;
      }

      return {
        content: mockResponse,
        metadata: {
          model: config?.model_name || "google/gemini-2.5-flash",
          responseTime,
          tokens: Math.floor(mockResponse.length / 4),
        },
      };
    },
    onSuccess: (response) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.content,
          metadata: response.metadata,
        },
      ]);
    },
    onError: (error) => {
      toast({
        title: t('ai-assistant.testing.messageFailed'),
        description: error instanceof Error ? error.message : t('ai-assistant.testing.messageFailed'),
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!input.trim() || sendMessageMutation.isPending) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    sendMessageMutation.mutate(userMessage);
  };

  const handleSampleQuestion = (question: string) => {
    setInput(question);
  };

  const handleClear = () => {
    setMessages([]);
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>{t('ai-assistant.testing.title')}</CardTitle>
            <CardDescription>{t('ai-assistant.testing.description')}</CardDescription>
          </div>
          {messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClear} data-testid="button-clear-chat">
              {t('ai-assistant.testing.clearChat')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 min-h-0">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t('ai-assistant.testing.sampleQuestions')}:</p>
            <div className="flex flex-wrap gap-2">
              {sampleQuestions.map((question, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSampleQuestion(question)}
                  className="text-xs"
                  data-testid={`button-sample-question-${i}`}
                >
                  {question}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message, i) => (
              <div
                key={i}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`flex flex-col gap-2 max-w-[80%] ${
                    message.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`rounded-lg px-4 py-2 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                  {message.metadata && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {message.metadata.model && (
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          <span>{message.metadata.model.split("/")[1]}</span>
                        </div>
                      )}
                      {message.metadata.responseTime && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{message.metadata.responseTime}ms</span>
                        </div>
                      )}
                      {message.metadata.tokens && (
                        <div className="flex items-center gap-1">
                          <Coins className="h-3 w-3" />
                          <span>{message.metadata.tokens} tokens</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {message.role === "user" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
            {sendMessageMutation.isPending && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            placeholder={t('ai-assistant.testing.placeholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            disabled={sendMessageMutation.isPending}
            data-testid="input-chat-tester"
          />
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || sendMessageMutation.isPending}
            data-testid="button-send-test-message"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
