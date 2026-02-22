import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { QueryErrorState } from "@/components/query-error-state";
import { ErrorBoundary } from "@/components/error-boundary";
import { useToast } from "@/hooks/use-toast";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MessageSquare } from "lucide-react";
import { CHAT_ROUTES, USER_ROUTES, JOBS_ROUTES, PANELS_ROUTES } from "@shared/api-routes";
import { playNotificationSound } from "@/lib/notification-sound";
import { useAuth } from "@/lib/auth";
import type { User, Job, PanelRegister } from "@shared/schema";
import type { Conversation, ChatTopic, Message } from "./chat/chat-types";
import { ChatSidebar } from "./chat/ChatSidebar";
import { ChatHeader } from "./chat/ChatHeader";
import { MessageList } from "./chat/MessageList";
import { MessageComposer } from "./chat/MessageComposer";
import { useDebouncedValue } from "./chat/useDebouncedValue";

export default function ChatPage() {
  useDocumentTitle("Chat");
  const { user: currentUser } = useAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const prevMessageIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  const { data: conversations = [], isLoading: conversationsLoading, isError, error, refetch } = useQuery<Conversation[]>({
    queryKey: [CHAT_ROUTES.CONVERSATIONS],
    refetchInterval: 10000,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: [USER_ROUTES.LIST],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  const { data: panels = [] } = useQuery<PanelRegister[]>({
    queryKey: [PANELS_ROUTES.LIST],
  });

  const { data: topics = [] } = useQuery<ChatTopic[]>({
    queryKey: [CHAT_ROUTES.TOPICS],
  });

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: [CHAT_ROUTES.CONVERSATIONS, selectedConversationId, "messages"],
    enabled: !!selectedConversationId,
    refetchInterval: 5000,
  });

  useEffect(() => {
    setTimeout(() => {
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      }
    }, 100);
  }, [messages, selectedConversationId]);

  useEffect(() => {
    if (!messages.length) {
      prevMessageIdsRef.current = new Set();
      initialLoadRef.current = true;
      return;
    }

    const currentIds = new Set(messages.map(m => m.id));

    if (initialLoadRef.current) {
      prevMessageIdsRef.current = currentIds;
      initialLoadRef.current = false;
      return;
    }

    const newMessages = messages.filter(
      m => !prevMessageIdsRef.current.has(m.id) && m.senderId !== String(currentUser?.id)
    );

    if (newMessages.length > 0) {
      playNotificationSound();
    }

    prevMessageIdsRef.current = currentIds;
  }, [messages, currentUser?.id]);

  useEffect(() => {
    initialLoadRef.current = true;
    prevMessageIdsRef.current = new Set();
  }, [selectedConversationId]);

  const markAsReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest("POST", CHAT_ROUTES.MARK_READ, { conversationId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.CONVERSATIONS] });
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.TOTAL_UNREAD] });
    },
  });

  const handleSelectConversation = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
    markAsReadMutation.mutate(conversationId);
  }, [markAsReadMutation]);

  const filteredConversations = useMemo(() => conversations.filter(c => {
    if (!debouncedSearchQuery) return true;
    const query = debouncedSearchQuery.toLowerCase();
    return (
      c.name?.toLowerCase().includes(query) ||
      c.job?.jobNumber?.toLowerCase().includes(query) ||
      c.panel?.panelMark?.toLowerCase().includes(query)
    );
  }), [conversations, debouncedSearchQuery]);

  if (isError) {
    return (
      <div className="flex h-full min-h-0 overflow-hidden items-center justify-center" role="main" aria-label="Chat">
        <QueryErrorState error={error} onRetry={refetch} message="Failed to load conversations" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-full min-h-0 overflow-hidden" data-testid="chat-page" role="main" aria-label="Chat">
        <ChatSidebar
          conversations={conversations}
          filteredConversations={filteredConversations}
          topics={topics}
          users={users}
          jobs={jobs}
          panels={panels}
          selectedConversationId={selectedConversationId}
          searchQuery={searchQuery}
          conversationsLoading={conversationsLoading}
          onSearchChange={setSearchQuery}
          onSelectConversation={handleSelectConversation}
        />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {selectedConversation ? (
            <>
              <ChatHeader
                selectedConversation={selectedConversation}
                topics={topics}
                users={users}
                onConversationDeleted={() => setSelectedConversationId(null)}
              />

              <MessageList
                messages={messages}
                messagesLoading={messagesLoading}
                selectedConversation={selectedConversation}
                currentUserId={currentUser?.id}
                scrollAreaRef={scrollAreaRef as React.RefObject<HTMLDivElement>}
                messagesEndRef={messagesEndRef as React.RefObject<HTMLDivElement>}
              />

              <MessageComposer
                selectedConversationId={selectedConversation.id}
                users={users}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a conversation to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
