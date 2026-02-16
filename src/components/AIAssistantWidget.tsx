import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { X, Send, Bot, Loader2, Minimize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "@/hooks/useLocale";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type WidgetConfig = {
  widget_enabled: boolean;
  widget_color: string;
  welcome_message: string;
} | null;

export const AIAssistantWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t } = useLocale();

  // Check if widget is enabled
  const { data: config } = useQuery<WidgetConfig>({
    queryKey: ["ai-widget-config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ai_assistant_config")
        .select("widget_enabled, widget_color, welcome_message")
        .eq("widget_enabled", true)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as WidgetConfig;
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Add welcome message when chat opens
  useEffect(() => {
    if (isOpen && messages.length === 0 && config?.welcome_message) {
      setMessages([
        {
          role: "assistant",
          content: config.welcome_message,
        },
      ]);
    }
  }, [isOpen, config]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    const newMessages = [...messages, { role: "user" as const, content: userMessage }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("query-ai-assistant", {
        body: {
          query: userMessage,
          conversationHistory: messages,
        },
      });

      if (error) throw error;

      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: data.response,
        },
      ]);
    } catch (error) {
      console.error("AI query error:", error);
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: t('ai-assistant.widget.errorMessage'),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!config?.widget_enabled) return null;

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <Card
          className={`fixed bottom-24 right-6 w-96 shadow-2xl transition-all duration-300 z-50 ${
            isMinimized ? "h-14" : "h-[500px]"
          } flex flex-col`}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between p-4 border-b cursor-pointer"
            style={{ backgroundColor: config.widget_color }}
            onClick={() => !isMinimized && setIsMinimized(true)}
          >
            <div className="flex items-center gap-2 text-white">
              <Bot className="h-5 w-5" />
              <span className="font-semibold">{t('ai-assistant.widget.title')}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMinimized(!isMinimized);
                }}
                data-testid="button-widget-minimize"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  setIsMinimized(false);
                }}
                data-testid="button-widget-close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          {!isMinimized && (
            <>
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-4">
                  {messages.map((message, i) => (
                    <div
                      key={i}
                      className={`flex gap-2 ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {message.role === "assistant" && (
                        <div
                          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: `${config.widget_color}20` }}
                        >
                          <Bot className="h-4 w-4" style={{ color: config.widget_color }} />
                        </div>
                      )}
                      <div
                        className={`rounded-lg px-4 py-2 max-w-[80%] ${
                          message.role === "user"
                            ? "text-white"
                            : "bg-muted"
                        }`}
                        style={
                          message.role === "user"
                            ? { backgroundColor: config.widget_color }
                            : {}
                        }
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex gap-2 justify-start">
                      <div
                        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${config.widget_color}20` }}
                      >
                        <Bot className="h-4 w-4" style={{ color: config.widget_color }} />
                      </div>
                      <div className="bg-muted rounded-lg px-4 py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    placeholder={t('ai-assistant.widget.placeholder')}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSend()}
                    disabled={isLoading}
                    data-testid="input-chat-message"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    style={{ backgroundColor: config.widget_color }}
                    className="text-white hover:opacity-90"
                    data-testid="button-widget-send"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Chat Button */}
      {!isOpen && (
        <Button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl z-50 text-white hover:scale-110 transition-transform"
          style={{ backgroundColor: config.widget_color }}
          data-testid="button-widget-open"
        >
          <Bot className="h-6 w-6" />
        </Button>
      )}
    </>
  );
};
