import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CHAT_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { MessageSquare, Users, Hash, Send, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  createdAt: string;
  sender?: User;
}

interface Conversation {
  id: string;
  name: string | null;
  type: "DM" | "GROUP" | "CHANNEL";
  unreadCount: number;
  unreadMentions: number;
  lastMessage?: {
    body: string | null;
    createdAt: string;
    sender?: { name: string | null };
  } | null;
  members?: Array<{ user?: User }>;
}

export default function MobileChatPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: [CHAT_ROUTES.CONVERSATIONS],
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: [CHAT_ROUTES.MESSAGES(selectedConversationId || "")],
    enabled: !!selectedConversationId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", CHAT_ROUTES.MESSAGES(selectedConversationId!), { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.MESSAGES(selectedConversationId!)] });
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.CONVERSATIONS] });
      setMessageContent("");
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest("POST", CHAT_ROUTES.MARK_READ_CONVERSATION(conversationId), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.CONVERSATIONS] });
    },
  });

  useEffect(() => {
    if (selectedConversationId) {
      markReadMutation.mutate(selectedConversationId);
    }
  }, [selectedConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!selectedConversationId) return;

    const handleResize = () => {
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        const keyboardOffset = windowHeight - viewportHeight;
        setKeyboardHeight(keyboardOffset > 50 ? keyboardOffset : 0);
      }
    };

    window.visualViewport?.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('scroll', handleResize);
    
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, [selectedConversationId]);

  const sortedConversations = [...conversations].sort((a, b) => {
    if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
    if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
    const aTime = a.lastMessage?.createdAt || "";
    const bTime = b.lastMessage?.createdAt || "";
    return bTime.localeCompare(aTime);
  });

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  const getConversationName = (conv: Conversation): string => {
    if (conv.name) return conv.name;
    const otherMember = conv.members?.find(m => m.user?.id !== currentUser?.id);
    return otherMember?.user?.name || otherMember?.user?.email || "Conversation";
  };

  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getConversationIcon = (type: string) => {
    switch (type) {
      case "CHANNEL": return Hash;
      case "GROUP": return Users;
      default: return MessageSquare;
    }
  };

  const handleSendMessage = () => {
    if (messageContent.trim() && selectedConversationId) {
      sendMessageMutation.mutate(messageContent.trim());
    }
  };

  if (selectedConversationId && selectedConversation) {
    const convName = getConversationName(selectedConversation);
    
    return (
      <div 
        className="fixed inset-0 flex flex-col bg-[#070B12]"
        style={{ height: keyboardHeight > 0 ? `calc(100% - ${keyboardHeight}px)` : '100%' }}
      >
        <header className="flex-shrink-0 flex items-center gap-2 px-2 py-3 bg-[#0D1117] border-b border-white/10 safe-area-top">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedConversationId(null)}
            className="text-white"
            data-testid="button-back-chat"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-purple-500/20 text-purple-400 text-sm">
              {selectedConversation.type === "DM" ? getInitials(convName) : <Users className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-white text-lg font-semibold flex-1 truncate">
            {convName}
          </h1>
        </header>

        <main 
          className="flex-1 overflow-y-auto px-4 py-4" 
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {messagesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 rounded-2xl bg-white/10" />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto text-white/30 mb-3" />
              <p className="text-white/60">No messages yet</p>
              <p className="text-sm text-white/40">Start the conversation!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => {
                const isOwn = message.senderId === currentUser?.id;
                const senderName = message.sender?.name || message.sender?.email || "Unknown";

                return (
                  <div
                    key={message.id}
                    className={cn("flex", isOwn ? "justify-end" : "justify-start")}
                  >
                    <div className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2",
                      isOwn 
                        ? "bg-purple-500 text-white rounded-br-md" 
                        : "bg-white/10 text-white rounded-bl-md"
                    )}>
                      {!isOwn && selectedConversation.type !== "DM" && (
                        <p className="text-xs font-medium text-white/60 mb-1">
                          {senderName}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.body}
                      </p>
                      <p className={cn(
                        "text-xs mt-1",
                        isOwn ? "text-white/70" : "text-white/50"
                      )}>
                        {format(new Date(message.createdAt), "HH:mm")}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        <footer className="flex-shrink-0 px-4 py-3 border-t border-white/10 bg-[#0D1117]">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 rounded-full bg-white/10 border-white/20 text-white placeholder:text-white/40"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              data-testid="input-message"
            />
            <Button
              size="icon"
              onClick={handleSendMessage}
              disabled={!messageContent.trim() || sendMessageMutation.isPending}
              className="rounded-full bg-purple-500 hover:bg-purple-600"
              data-testid="button-send"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-4 py-4">
          <div className="text-2xl font-bold" data-testid="text-chat-title">Messages</div>
          <div className="text-sm text-white/60">
            {conversations.length} {conversations.length === 1 ? 'conversation' : 'conversations'}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 rounded-2xl bg-white/10" />
            ))}
          </div>
        ) : sortedConversations.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 mx-auto text-white/30 mb-3" />
            <p className="text-white/60">No conversations yet</p>
            <p className="text-sm text-white/40">Start a chat from the desktop app</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedConversations.map((conv) => {
              const name = getConversationName(conv);
              const Icon = getConversationIcon(conv.type);
              
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversationId(conv.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-2xl border border-white/10 text-left active:scale-[0.99]",
                    conv.unreadCount > 0 ? "bg-white/5" : "bg-white/[0.03]"
                  )}
                  data-testid={`conversation-${conv.id}`}
                >
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarFallback className="bg-purple-500/20 text-purple-400">
                      {conv.type === "DM" ? getInitials(name) : <Icon className="h-5 w-5" />}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={cn(
                        "font-medium text-sm truncate text-white",
                        conv.unreadCount > 0 && "font-semibold"
                      )}>
                        {name}
                      </h3>
                      {conv.lastMessage?.createdAt && (
                        <span className="text-xs text-white/50 flex-shrink-0">
                          {format(new Date(conv.lastMessage.createdAt), "HH:mm")}
                        </span>
                      )}
                    </div>
                    {conv.lastMessage?.body && (
                      <p className={cn(
                        "text-sm truncate",
                        conv.unreadCount > 0 ? "text-white/80" : "text-white/50"
                      )}>
                        {conv.lastMessage.body}
                      </p>
                    )}
                  </div>

                  {conv.unreadCount > 0 && (
                    <span className="inline-flex min-w-[22px] h-[22px] items-center justify-center rounded-full bg-red-500 px-2 text-[12px] font-semibold text-white flex-shrink-0">
                      {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
}
