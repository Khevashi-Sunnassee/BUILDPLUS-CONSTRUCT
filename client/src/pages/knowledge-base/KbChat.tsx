import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Send,
  Bot,
  User,
  ChevronLeft,
  Loader2,
  Sparkles,
  BookOpen,
  FileText,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { queryClient, getCsrfToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { renderMarkdown } from "./KbMarkdown";
import type { KbMessage, KbConversation, KbSource, AnswerMode } from "./types";

interface KbChatProps {
  selectedConvoId: string | null;
  conversations: KbConversation[];
  selectedProjectId: string | null;
  onBack: () => void;
}

export function KbChat({
  selectedConvoId,
  conversations,
  selectedProjectId,
  onBack,
}: KbChatProps) {
  const { toast } = useToast();
  const [chatInput, setChatInput] = useState("");
  const [answerMode, setAnswerMode] = useState<AnswerMode>("HYBRID");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingSources, setStreamingSources] = useState<KbSource[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const { data: messages = [] } = useQuery<KbMessage[]>({
    queryKey: ["/api/kb/conversations", selectedConvoId, "messages"],
    queryFn: async () => {
      if (!selectedConvoId) return [];
      const res = await fetch(`/api/kb/conversations/${selectedConvoId}/messages`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!selectedConvoId,
  });

  const sendMessage = useCallback(async () => {
    if (!chatInput.trim() || !selectedConvoId || isStreaming) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setIsStreaming(true);
    setStreamingContent("");
    setStreamingSources([]);

    queryClient.setQueryData(
      ["/api/kb/conversations", selectedConvoId, "messages"],
      (old: KbMessage[] = []) => [
        ...old,
        {
          id: `temp-${Date.now()}`,
          role: "USER" as const,
          content: userMessage,
          mode: answerMode,
          sourceChunkIds: null,
          createdAt: new Date().toISOString(),
        },
      ]
    );

    try {
      const token = getCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["x-csrf-token"] = token;

      const res = await fetch(`/api/kb/conversations/${selectedConvoId}/messages`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ content: userMessage, mode: answerMode }),
      });

      if (!res.ok) throw new Error("Failed to send message");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let accumulated = "";
      let lineBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        lineBuffer += text;
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              accumulated += data.content;
              setStreamingContent(accumulated);
            }
            if (data.sources) {
              setStreamingSources(data.sources);
            }
            if (data.titleUpdate) {
              queryClient.invalidateQueries({ queryKey: ["/api/kb/conversations"] });
            }
            if (data.error) {
              toast({ title: data.error, variant: "destructive" });
            }
          } catch {}
        }
      }

      queryClient.invalidateQueries({
        queryKey: ["/api/kb/conversations", selectedConvoId, "messages"],
      });
    } catch {
      toast({ title: "Failed to get response", variant: "destructive" });
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  }, [chatInput, selectedConvoId, isStreaming, answerMode, toast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleMode = () => {
    setAnswerMode(prev => prev === "KB_ONLY" ? "HYBRID" : "KB_ONLY");
  };

  const allMessages = [...messages];
  if (isStreaming && streamingContent) {
    allMessages.push({
      id: "streaming",
      role: "ASSISTANT",
      content: streamingContent,
      mode: answerMode,
      sourceChunkIds: null,
      createdAt: new Date().toISOString(),
    });
  }

  const currentConvo = conversations.find(c => c.id === selectedConvoId);

  return (
    <div className="flex-1 flex flex-col h-full" data-testid="kb-chat-view">
      <div className="flex items-center justify-between px-4 py-3 border-b gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            size="icon"
            variant="ghost"
            className="md:hidden shrink-0"
            onClick={onBack}
            data-testid="btn-back-to-convos"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Bot className="h-5 w-5 text-primary shrink-0" />
          <span className="font-semibold text-sm truncate">
            {currentConvo?.title || "AI Assistant"}
          </span>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={answerMode === "KB_ONLY" ? "default" : "outline"}
              size="sm"
              onClick={toggleMode}
              className="gap-1.5 text-xs shrink-0"
              data-testid="btn-toggle-mode"
            >
              {answerMode === "KB_ONLY" ? (
                <>
                  <BookOpen className="h-3.5 w-3.5" />
                  KB Only
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  AI + KB
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {answerMode === "KB_ONLY"
              ? "Answers only from Knowledge Base documents. Click to enable general AI knowledge."
              : "Uses both Knowledge Base and general AI knowledge. Click to restrict to KB only."}
          </TooltipContent>
        </Tooltip>
      </div>

      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto p-4">
          {allMessages.length === 0 && !isStreaming ? (
            <div className="flex flex-col items-center justify-center text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">How can I help you?</h3>
              <p className="text-sm text-muted-foreground max-w-md mb-6">
                Ask me anything about your documents, procedures, or how to use the system.
                I can search your Knowledge Base or use my general knowledge.
              </p>
              <div className="flex flex-wrap gap-2 justify-center mb-6">
                <Badge variant="outline" className="px-3 py-1.5 cursor-pointer hover:bg-muted" onClick={() => setChatInput("How do I create a new job?")}>
                  How do I create a new job?
                </Badge>
                <Badge variant="outline" className="px-3 py-1.5 cursor-pointer hover:bg-muted" onClick={() => setChatInput("What are the panel production stages?")}>
                  Panel production stages
                </Badge>
                <Badge variant="outline" className="px-3 py-1.5 cursor-pointer hover:bg-muted" onClick={() => setChatInput("Explain the approval workflow")}>
                  Approval workflow
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>KB Only = Answers from documents</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>AI + KB = Documents + general knowledge</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {allMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3",
                    msg.role === "USER" ? "flex-row-reverse" : "flex-row"
                  )}
                  data-testid={`message-${msg.id}`}
                >
                  <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                    <AvatarFallback className={cn(
                      "text-xs",
                      msg.role === "USER"
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-primary text-primary-foreground"
                    )}>
                      {msg.role === "USER" ? <User className="h-4 w-4" /> : "AI"}
                    </AvatarFallback>
                  </Avatar>

                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 max-w-[80%] text-sm",
                      msg.role === "USER"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted rounded-tl-sm"
                    )}
                  >
                    <div className="whitespace-pre-wrap break-words leading-relaxed">
                      {renderMarkdown(msg.content)}
                    </div>
                    {msg.id === "streaming" && (
                      <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5 rounded-full" />
                    )}
                  </div>
                </div>
              ))}

              {streamingSources.length > 0 && (
                <div className="flex items-start gap-3 ml-11" data-testid="sources-panel">
                  <div className="bg-muted/50 border rounded-xl px-4 py-3 text-xs">
                    <p className="font-semibold mb-2 text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      Sources
                    </p>
                    <div className="space-y-1.5">
                      {streamingSources.map((s) => (
                        <div key={s.id} className="flex items-center gap-2">
                          <span className="truncate">{s.documentTitle}</span>
                          {s.section && (
                            <span className="text-muted-foreground truncate">&gt; {s.section}</span>
                          )}
                          <Badge variant="outline" className="ml-auto text-[10px] shrink-0">
                            {s.similarity}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <Textarea
                ref={chatInputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  answerMode === "KB_ONLY"
                    ? "Ask about your documents..."
                    : "Ask anything..."
                }
                className="resize-none min-h-[44px] max-h-32 pr-12 rounded-xl"
                rows={1}
                disabled={isStreaming || !selectedConvoId}
                data-testid="input-chat-message"
              />
            </div>
            <Button
              size="icon"
              className="h-10 w-10 rounded-xl shrink-0"
              onClick={sendMessage}
              disabled={!chatInput.trim() || isStreaming || !selectedConvoId}
              data-testid="btn-send-message"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            {answerMode === "KB_ONLY" ? "Answering from Knowledge Base only" : "Using Knowledge Base + general AI knowledge"}
          </p>
        </div>
      </div>
    </div>
  );
}
