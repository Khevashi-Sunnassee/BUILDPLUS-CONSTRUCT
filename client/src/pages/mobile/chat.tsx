import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getCsrfToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CHAT_ROUTES, USER_ROUTES, JOBS_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format } from "date-fns";
import {
  MessageSquare, Users, Hash, Send, ChevronLeft, Plus, X, Image, Loader2,
  Check, Search as SearchIcon, ChevronDown, ChevronRight, FolderOpen, Tag,
  Pencil, Trash2, MoreVertical, ImageOff, Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { compressImages } from "@/lib/image-compress";
import { playNotificationSound } from "@/lib/notification-sound";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface Job {
  id: number;
  jobNumber: string;
  name: string;
}

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface ChatAttachment {
  id: string;
  messageId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  createdAt: string;
  sender?: User;
  attachments?: ChatAttachment[];
}

interface Conversation {
  id: string;
  name: string | null;
  type: "DM" | "GROUP" | "CHANNEL";
  topicId: string | null;
  unreadCount: number;
  unreadMentions: number;
  lastMessage?: {
    body: string | null;
    createdAt: string;
    sender?: { name: string | null };
  } | null;
  members?: Array<{ user?: User }>;
}

interface ChatTopic {
  id: string;
  companyId: string;
  name: string;
  color: string | null;
  sortOrder: number;
  createdAt: string;
  createdById: string | null;
}

const TOPIC_COLOR_PALETTE = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
  "#0ea5e9", "#3b82f6", "#2563eb", "#7c3aed", "#c026d3",
  "#e11d48", "#ea580c", "#ca8a04", "#16a34a", "#0891b2",
  "#4f46e5", "#9333ea", "#db2777", "#dc2626", "#d97706",
  "#65a30d", "#059669", "#0d9488", "#0284c7", "#1d4ed8",
];

function MobileChatImageAttachment({ att }: { att: ChatAttachment }) {
  const [removed, setRemoved] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  if (removed) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-lg bg-black/20 text-white/50 text-sm" data-testid={`attachment-removed-${att.id}`}>
        <ImageOff className="h-4 w-4 shrink-0" />
        <span>Image removed</span>
      </div>
    );
  }

  return (
    <>
      <img
        src={att.url}
        alt={att.fileName}
        className="rounded-lg max-w-full max-h-64 object-contain cursor-pointer"
        onClick={() => setPreviewOpen(true)}
        onError={() => setRemoved(true)}
        data-testid={`attachment-image-${att.id}`}
      />
      {previewOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewOpen(false)}
          data-testid="modal-image-preview"
        >
          <button
            onClick={() => setPreviewOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center z-10"
            data-testid="button-close-preview"
          >
            <X className="h-6 w-6 text-white" />
          </button>
          <img
            src={att.url}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

export default function MobileChatPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [newConvType, setNewConvType] = useState<"DM" | "GROUP" | "CHANNEL">("DM");
  const [newConvName, setNewConvName] = useState("");
  const [newConvMembers, setNewConvMembers] = useState<string[]>([]);
  const [newConvJobId, setNewConvJobId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [collapsedTopics, setCollapsedTopics] = useState<Set<string>>(new Set());
  const [showNewTopicInput, setShowNewTopicInput] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTopicName, setEditingTopicName] = useState("");
  const [colorPickerTopicId, setColorPickerTopicId] = useState<string | null>(null);
  const [showTopicAssign, setShowTopicAssign] = useState<string | null>(null);
  const [showManageMembers, setShowManageMembers] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState("");
  const [addingMemberIds, setAddingMemberIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevMessageIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: [CHAT_ROUTES.CONVERSATIONS],
    refetchInterval: 10000,
    select: (raw: any) => Array.isArray(raw) ? raw : (raw?.data ?? []),
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: [USER_ROUTES.LIST],
    enabled: showNewConversation || showManageMembers,
    select: (raw: any) => Array.isArray(raw) ? raw : (raw?.data ?? []),
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
    enabled: showNewConversation,
    select: (raw: any) => Array.isArray(raw) ? raw : (raw?.data ?? []),
  });

  const { data: topics = [] } = useQuery<ChatTopic[]>({
    queryKey: [CHAT_ROUTES.TOPICS],
    select: (raw: any) => Array.isArray(raw) ? raw : (raw?.data ?? []),
  });

  const filteredUsers = allUsers.filter(u => {
    if (String(u.id) === String(currentUser?.id)) return false;
    if (!memberSearch) return true;
    const search = memberSearch.toLowerCase();
    return (u.name?.toLowerCase().includes(search) || u.email.toLowerCase().includes(search));
  });

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", CHAT_ROUTES.CONVERSATIONS, {
        type: newConvType,
        name: newConvType !== "DM" ? newConvName : "",
        memberIds: newConvMembers,
        jobId: newConvJobId,
        panelId: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.CONVERSATIONS] });
      resetNewConversation();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create conversation", description: error.message, variant: "destructive" });
    },
  });

  const addMembersMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      setAddingMemberIds(prev => new Set([...prev, ...userIds]));
      return apiRequest("POST", CHAT_ROUTES.MEMBERS(selectedConversationId!), { userIds });
    },
    onSuccess: (_data: unknown, userIds: string[]) => {
      setAddingMemberIds(prev => {
        const next = new Set(prev);
        userIds.forEach(id => next.delete(id));
        return next;
      });
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.CONVERSATIONS] });
      toast({ title: "Member added" });
    },
    onError: (error: any, userIds: string[]) => {
      setAddingMemberIds(prev => {
        const next = new Set(prev);
        userIds.forEach(id => next.delete(id));
        return next;
      });
      toast({ title: "Failed to add member", description: error.message, variant: "destructive" });
    },
  });

  const resetNewConversation = () => {
    setShowNewConversation(false);
    setNewConvType("DM");
    setNewConvName("");
    setNewConvMembers([]);
    setNewConvJobId(null);
    setMemberSearch("");
  };

  const toggleMember = (userId: string) => {
    if (newConvType === "DM") {
      setNewConvMembers([userId]);
    } else {
      setNewConvMembers(prev =>
        prev.includes(userId)
          ? prev.filter(id => id !== userId)
          : [...prev, userId]
      );
    }
  };

  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: [CHAT_ROUTES.MESSAGES(selectedConversationId || "")],
    enabled: !!selectedConversationId,
    refetchInterval: 5000,
    select: (raw: any) => Array.isArray(raw) ? raw : (raw?.data ?? []),
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, files }: { content: string; files: File[] }) => {
      if (files.length > 0) {
        const formData = new FormData();
        formData.append("content", content);
        files.forEach(f => formData.append("files", f));
        const csrfToken = getCsrfToken();
        const res = await fetch(CHAT_ROUTES.MESSAGES(selectedConversationId!), {
          method: "POST",
          headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
          body: formData,
          credentials: "include",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(err.error || "Failed to send message");
        }
        return res.json();
      }
      return apiRequest("POST", CHAT_ROUTES.MESSAGES(selectedConversationId!), { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.MESSAGES(selectedConversationId!)] });
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.CONVERSATIONS] });
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.TOTAL_UNREAD] });
      setMessageContent("");
      clearSelectedFiles();
      if (selectedConversationId) {
        markReadMutation.mutate(selectedConversationId);
      }
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest("POST", CHAT_ROUTES.MARK_READ, { conversationId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.CONVERSATIONS] });
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.TOTAL_UNREAD] });
    },
  });

  const createTopicMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", CHAT_ROUTES.TOPICS, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.TOPICS] });
      setShowNewTopicInput(false);
      setNewTopicName("");
      toast({ title: "Topic created" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create topic", description: error.message, variant: "destructive" });
    },
  });

  const updateTopicMutation = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name?: string; color?: string }) => {
      const body: Record<string, string> = {};
      if (name) body.name = name;
      if (color) body.color = color;
      return apiRequest("PATCH", CHAT_ROUTES.TOPIC_BY_ID(id), body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.TOPICS] });
      setEditingTopicId(null);
      setEditingTopicName("");
      toast({ title: "Topic updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update topic", description: error.message, variant: "destructive" });
    },
  });

  const deleteTopicMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", CHAT_ROUTES.TOPIC_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.TOPICS] });
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.CONVERSATIONS] });
      toast({ title: "Topic deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete topic", description: error.message, variant: "destructive" });
    },
  });

  const assignTopicMutation = useMutation({
    mutationFn: async ({ conversationId, topicId }: { conversationId: string; topicId: string | null }) => {
      return apiRequest("PATCH", CHAT_ROUTES.CONVERSATION_TOPIC(conversationId), { topicId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.CONVERSATIONS] });
      setShowTopicAssign(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to assign topic", description: error.message, variant: "destructive" });
    },
  });

  const toggleTopicCollapse = useCallback((topicId: string) => {
    setCollapsedTopics(prev => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });
  }, []);

  const handleFilePick = async (e: { target: HTMLInputElement }) => {
    const rawFiles = Array.from(e.target.files || []);
    if (rawFiles.length === 0) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    setIsCompressing(true);
    try {
      const compressed = await compressImages(rawFiles);
      setSelectedFiles(prev => [...prev, ...compressed]);
      const newPreviews = compressed.map(f => URL.createObjectURL(f));
      setFilePreviews(prev => [...prev, ...newPreviews]);
    } finally {
      setIsCompressing(false);
    }
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(filePreviews[index]);
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setFilePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const clearSelectedFiles = () => {
    filePreviews.forEach(url => URL.revokeObjectURL(url));
    setSelectedFiles([]);
    setFilePreviews([]);
  };

  useEffect(() => {
    return () => {
      filePreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    clearSelectedFiles();
  }, [selectedConversationId]);

  useEffect(() => {
    if (selectedConversationId) {
      markReadMutation.mutate(selectedConversationId);
    }
  }, [selectedConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    if ((messageContent.trim() || selectedFiles.length > 0) && selectedConversationId) {
      sendMessageMutation.mutate({ content: messageContent.trim(), files: selectedFiles });
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
          {selectedConversation.type !== "DM" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setShowManageMembers(true); setAddMemberSearch(""); }}
              className="text-white/60"
              data-testid="button-manage-members"
            >
              <Users className="h-4 w-4" />
            </Button>
          )}
          {topics.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowTopicAssign(selectedConversation.id)}
              className="text-white/60"
              data-testid="button-assign-topic-header"
            >
              <Tag className="h-4 w-4" />
            </Button>
          )}
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
            <div className="space-y-1">
              {messages.map((message, idx) => {
                const isOwn = message.senderId === String(currentUser?.id);
                const senderName = message.sender?.name || message.sender?.email || "Unknown";
                const msgDate = new Date(message.createdAt);
                const prevMsg = idx > 0 ? messages[idx - 1] : null;
                const showDateSeparator = !prevMsg || format(new Date(prevMsg.createdAt), "yyyy-MM-dd") !== format(msgDate, "yyyy-MM-dd");
                const timeStr = format(msgDate, "dd/MM/yyyy h:mm a");

                return (
                  <div key={message.id} data-testid={`message-${message.id}`}>
                    {showDateSeparator && (
                      <div className="flex items-center gap-3 my-3">
                        <div className="flex-1 border-t border-white/10" />
                        <span className="text-xs text-white/40 font-medium">
                          {format(msgDate, "dd/MM/yyyy")}
                        </span>
                        <div className="flex-1 border-t border-white/10" />
                      </div>
                    )}
                    <div className={cn("flex gap-2 mb-1", isOwn ? "justify-end" : "justify-start")}>
                      {!isOwn && (
                        <Avatar className="h-7 w-7 mt-1 shrink-0">
                          <AvatarFallback className="bg-purple-500/20 text-purple-400 text-[10px]">
                            {getInitials(senderName)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className={cn(
                        "max-w-[75%] rounded-2xl px-3 py-2",
                        isOwn 
                          ? "bg-primary text-primary-foreground rounded-tr-none" 
                          : "bg-white/10 text-white rounded-tl-none"
                      )}>
                        {!isOwn && selectedConversation.type !== "DM" && (
                          <p className="text-xs font-medium text-white/60 mb-0.5">
                            {senderName}
                          </p>
                        )}
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="space-y-2 mb-1">
                            {message.attachments.map((att) => {
                              const isImage = att.mimeType.startsWith("image/");
                              return isImage ? (
                                <MobileChatImageAttachment key={att.id} att={att} />
                              ) : (
                                <a
                                  key={att.id}
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20 text-sm"
                                  data-testid={`attachment-file-${att.id}`}
                                >
                                  <Image className="h-4 w-4 flex-shrink-0" />
                                  <span className="truncate">{att.fileName}</span>
                                </a>
                              );
                            })}
                          </div>
                        )}
                        {message.body && (
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {message.body}
                          </p>
                        )}
                        <p className={cn(
                          "text-[10px] mt-0.5",
                          isOwn ? "text-primary-foreground/70" : "text-white/40"
                        )}>
                          {timeStr}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        <Sheet open={showTopicAssign === selectedConversation.id} onOpenChange={(open) => { if (!open) setShowTopicAssign(null); }}>
          <SheetContent side="bottom" className="bg-[#0D1117] border-white/10 text-white rounded-t-2xl max-h-[50vh] p-0 flex flex-col">
            <SheetHeader className="px-4 pt-4 pb-3 border-b border-white/10 flex-shrink-0">
              <SheetTitle className="text-white text-lg">Move to Topic</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
              <button
                onClick={() => assignTopicMutation.mutate({ conversationId: selectedConversation.id, topicId: null })}
                className={cn(
                  "w-full text-left text-sm px-3 py-3 rounded-xl active:scale-[0.99]",
                  !selectedConversation.topicId ? "bg-blue-400/10 text-blue-400" : "text-white/60"
                )}
                data-testid="topic-assign-none-mobile"
              >
                No Topic
                {!selectedConversation.topicId && <Check className="h-4 w-4 inline ml-2" />}
              </button>
              {topics.map(topic => (
                <button
                  key={topic.id}
                  onClick={() => assignTopicMutation.mutate({ conversationId: selectedConversation.id, topicId: topic.id })}
                  className={cn(
                    "w-full flex items-center gap-2 text-sm px-3 py-3 rounded-xl active:scale-[0.99]",
                    selectedConversation.topicId === topic.id ? "bg-blue-400/10 text-blue-400" : "text-white/60"
                  )}
                  data-testid={`topic-assign-${topic.id}-mobile`}
                >
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{topic.name}</span>
                  {selectedConversation.topicId === topic.id && <Check className="h-4 w-4 shrink-0" />}
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>

        <Sheet open={showManageMembers} onOpenChange={setShowManageMembers}>
          <SheetContent side="bottom" className="bg-[#0D1117] border-white/10 text-white rounded-t-2xl max-h-[70vh] p-0 flex flex-col">
            <SheetHeader className="px-4 pt-4 pb-3 border-b border-white/10 flex-shrink-0">
              <SheetTitle className="text-white text-lg">Members</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 pt-3 pb-2">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Current Members ({selectedConversation.members?.length || 0})</p>
                <div className="space-y-1">
                  {selectedConversation.members?.map(m => (
                    <div key={m.user?.id || Math.random()} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" data-testid={`member-${m.user?.id}`}>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-purple-500/20 text-purple-400 text-xs">
                          {getInitials(m.user?.name || m.user?.email || "?")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{m.user?.name || m.user?.email || "Unknown"}</p>
                        {m.user?.name && <p className="text-xs text-white/40 truncate">{m.user.email}</p>}
                      </div>
                      {String(m.user?.id) === String(currentUser?.id) && (
                        <Badge variant="outline" className="text-[10px] border-white/20 text-white/50">You</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-4 pt-2 pb-4 border-t border-white/10">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Add Members</p>
                <div className="relative mb-3">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input
                    value={addMemberSearch}
                    onChange={(e) => setAddMemberSearch(e.target.value)}
                    placeholder="Search users..."
                    className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="input-add-member-search"
                  />
                </div>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {(() => {
                    const available = allUsers.filter(u => {
                      if (String(u.id) === String(currentUser?.id)) return false;
                      if (selectedConversation.members?.some(m => String(m.user?.id) === String(u.id))) return false;
                      if (addingMemberIds.has(String(u.id))) return false;
                      if (addMemberSearch) {
                        const s = addMemberSearch.toLowerCase();
                        return (u.name?.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
                      }
                      return true;
                    });
                    if (available.length === 0) {
                      return (
                        <p className="text-center text-sm text-white/40 py-4">
                          {addMemberSearch ? "No matching users" : "All users are already members"}
                        </p>
                      );
                    }
                    return available.map(user => (
                      <div key={user.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" data-testid={`add-member-${user.id}`}>
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-blue-500/20 text-blue-400 text-xs">
                            {getInitials(user.name || user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{user.name || user.email}</p>
                          {user.name && <p className="text-xs text-white/40 truncate">{user.email}</p>}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addMembersMutation.mutate([String(user.id)])}
                          disabled={addingMemberIds.has(String(user.id))}
                          className="border-white/20 text-white bg-white/5"
                          data-testid={`button-add-member-${user.id}`}
                        >
                          {addingMemberIds.has(String(user.id)) ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                        </Button>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <footer className="flex-shrink-0 border-t border-white/10 bg-[#0D1117]">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.dwg,.dxf,.ifc"
            multiple
            className="hidden"
            onChange={handleFilePick}
            data-testid="input-file-picker"
          />
          {(selectedFiles.length > 0 || isCompressing) && (
            <div className="px-4 pt-3 pb-1">
              <div className="flex gap-2 overflow-x-auto items-center">
                {filePreviews.map((preview, i) => {
                  const file = selectedFiles[i];
                  const isImg = file?.type?.startsWith("image/");
                  return (
                    <div key={i} className="relative flex-shrink-0">
                      {isImg ? (
                        <img
                          src={preview}
                          alt={file?.name}
                          className="h-16 w-16 rounded-lg object-cover border border-white/20"
                          data-testid={`preview-image-${i}`}
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-lg border border-white/20 bg-white/10 flex flex-col items-center justify-center px-1" data-testid={`preview-file-${i}`}>
                          <Image className="h-4 w-4 text-white/50 mb-1" />
                          <span className="text-[9px] text-white/60 truncate w-full text-center">{file?.name?.split('.').pop()?.toUpperCase() || "FILE"}</span>
                        </div>
                      )}
                      <button
                        onClick={() => removeFile(i)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center"
                        data-testid={`button-remove-file-${i}`}
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  );
                })}
                {isCompressing && (
                  <div className="flex items-center gap-2 text-white/50 text-xs flex-shrink-0" data-testid="status-compressing">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Compressing...</span>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 px-4 py-3">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full text-white/60 flex-shrink-0"
              data-testid="button-attach-photo"
            >
              <Plus className="h-5 w-5" />
            </Button>
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
              disabled={(!messageContent.trim() && selectedFiles.length === 0) || sendMessageMutation.isPending || isCompressing}
              className="rounded-full bg-purple-500 flex-shrink-0"
              data-testid="button-send"
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </footer>
      </div>
    );
  }

  const renderConversationItem = (conv: Conversation) => {
    const name = getConversationName(conv);
    const Icon = getConversationIcon(conv.type);
    
    return (
      <div key={conv.id} className="flex items-center gap-1">
        <button
          onClick={() => setSelectedConversationId(conv.id)}
          className={cn(
            "flex-1 flex items-center gap-3 p-3 rounded-2xl border border-white/10 text-left active:scale-[0.99]",
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
        {topics.length > 0 && (
          <button
            onClick={() => setShowTopicAssign(conv.id)}
            className="p-2 text-white/30 active:text-white/60 shrink-0"
            data-testid={`button-assign-topic-${conv.id}`}
          >
            <Tag className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  };

  const ungrouped = sortedConversations.filter(c => !c.topicId);
  const grouped = topics.map(topic => ({
    topic,
    convs: sortedConversations.filter(c => c.topicId === topic.id),
  }));

  return (
    <div className="flex flex-col h-screen-safe bg-[#070B12] text-white overflow-hidden" role="main" aria-label="Mobile Chat">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-4 py-4 flex items-start justify-between gap-2">
          <div>
            <div className="text-2xl font-bold" data-testid="text-chat-title">Messages</div>
            <div className="text-sm text-white/60">
              {conversations.length} {conversations.length === 1 ? 'conversation' : 'conversations'}
            </div>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setShowNewTopicInput(!showNewTopicInput); setNewTopicName(""); }}
              className="text-white/60"
              data-testid="button-add-topic-mobile"
            >
              <FolderOpen className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowNewConversation(true)}
              className="text-blue-400"
              data-testid="button-new-conversation-mobile"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </div>

      {showNewTopicInput && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-white/5">
          <FolderOpen className="h-4 w-4 text-white/40 shrink-0" />
          <Input
            value={newTopicName}
            onChange={(e) => setNewTopicName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTopicName.trim()) createTopicMutation.mutate(newTopicName.trim());
              if (e.key === "Escape") { setShowNewTopicInput(false); setNewTopicName(""); }
            }}
            placeholder="Enter topic name..."
            className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/30 h-8 text-sm"
            autoFocus
            data-testid="input-new-topic-mobile"
          />
          <Button
            size="sm"
            onClick={() => newTopicName.trim() && createTopicMutation.mutate(newTopicName.trim())}
            disabled={!newTopicName.trim() || createTopicMutation.isPending}
            className="bg-blue-500"
            data-testid="button-create-topic-mobile"
          >
            Create
          </Button>
          <button
            onClick={() => { setShowNewTopicInput(false); setNewTopicName(""); }}
            className="p-1 text-white/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-40 pt-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 rounded-2xl bg-white/10" />
            ))}
          </div>
        ) : sortedConversations.length === 0 && topics.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 mx-auto text-white/30 mb-3" />
            <p className="text-white/60">No conversations yet</p>
            <button
              onClick={() => setShowNewConversation(true)}
              className="text-sm text-blue-400 mt-2 active:scale-[0.99]"
              data-testid="button-start-first-conversation"
            >
              Start a new conversation
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {grouped.map(({ topic, convs }) => {
              const isCollapsed = collapsedTopics.has(topic.id);
              const topicUnread = convs.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
              const isEditing = editingTopicId === topic.id;
              return (
                <div key={topic.id} data-testid={`topic-group-${topic.id}`}>
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ backgroundColor: `${topic.color || '#6366f1'}20`, borderLeft: `3px solid ${topic.color || '#6366f1'}` }}
                  >
                    <button
                      onClick={() => toggleTopicCollapse(topic.id)}
                      className="shrink-0"
                      data-testid={`button-toggle-topic-${topic.id}`}
                    >
                      {isCollapsed ? <ChevronRight className="h-4 w-4" style={{ color: topic.color || '#6366f1' }} /> : <ChevronDown className="h-4 w-4" style={{ color: topic.color || '#6366f1' }} />}
                    </button>
                    <FolderOpen className="h-4 w-4 shrink-0" style={{ color: topic.color || '#6366f1' }} />
                    {isEditing ? (
                      <Input
                        value={editingTopicName}
                        onChange={(e) => setEditingTopicName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && editingTopicName.trim()) updateTopicMutation.mutate({ id: topic.id, name: editingTopicName.trim() });
                          if (e.key === "Escape") { setEditingTopicId(null); setEditingTopicName(""); }
                        }}
                        onBlur={() => {
                          if (editingTopicName.trim() && editingTopicName.trim() !== topic.name) {
                            updateTopicMutation.mutate({ id: topic.id, name: editingTopicName.trim() });
                          } else {
                            setEditingTopicId(null); setEditingTopicName("");
                          }
                        }}
                        className="h-6 text-xs px-1 py-0 flex-1 bg-white/10 border-white/20 text-white"
                        autoFocus
                        data-testid={`input-rename-topic-${topic.id}-mobile`}
                      />
                    ) : (
                      <button
                        onClick={() => toggleTopicCollapse(topic.id)}
                        className="text-xs font-semibold uppercase tracking-wider flex-1 text-left truncate"
                        style={{ color: topic.color || '#6366f1' }}
                        data-testid={`text-topic-name-${topic.id}`}
                      >
                        {topic.name}
                      </button>
                    )}
                    {topicUnread > 0 && (
                      <span className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
                        {topicUnread > 99 ? "99+" : topicUnread}
                      </span>
                    )}
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-[16px] bg-white/10 text-white/50 border-0">{convs.length}</Badge>
                    {!isEditing && (
                      <div className="flex items-center shrink-0">
                        <button
                          onClick={() => setColorPickerTopicId(colorPickerTopicId === topic.id ? null : topic.id)}
                          className="p-1 text-white/30 active:text-white/60"
                          data-testid={`button-color-topic-${topic.id}-mobile`}
                        >
                          <Palette className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => { setEditingTopicId(topic.id); setEditingTopicName(topic.name); }}
                          className="p-1 text-white/30 active:text-white/60"
                          data-testid={`button-edit-topic-${topic.id}-mobile`}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => { if (confirm("Delete this topic? Conversations will be ungrouped.")) deleteTopicMutation.mutate(topic.id); }}
                          className="p-1 text-white/30 active:text-red-400"
                          data-testid={`button-delete-topic-${topic.id}-mobile`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  {colorPickerTopicId === topic.id && (
                    <div className="px-3 py-2 rounded-b-xl" style={{ backgroundColor: `${topic.color || '#6366f1'}10` }}>
                      <div className="grid grid-cols-7 gap-2" data-testid={`color-picker-topic-${topic.id}-mobile`}>
                        {TOPIC_COLOR_PALETTE.map((color) => {
                          const isUsed = topics.some((t: ChatTopic) => t.id !== topic.id && t.color?.toLowerCase() === color.toLowerCase());
                          const isSelected = (topic.color || '#6366f1').toLowerCase() === color.toLowerCase();
                          return (
                            <button
                              key={color}
                              className={cn(
                                "w-7 h-7 rounded-md flex items-center justify-center",
                                isUsed ? "opacity-25" : "cursor-pointer",
                                isSelected && "ring-2 ring-offset-1 ring-white"
                              )}
                              style={{ backgroundColor: color }}
                              onClick={() => { if (!isUsed) { updateTopicMutation.mutate({ id: topic.id, color }); setColorPickerTopicId(null); } }}
                              disabled={isUsed}
                              data-testid={`color-swatch-topic-${topic.id}-${color.replace("#", "")}-mobile`}
                            >
                              {isSelected && <Check className="h-3.5 w-3.5 text-white drop-shadow-sm" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {!isCollapsed && (
                    <div className="ml-4 pl-2 mt-1 space-y-2" style={{ borderLeft: `2px solid ${topic.color || '#6366f1'}40` }}>
                      {convs.map(renderConversationItem)}
                    </div>
                  )}
                </div>
              );
            })}
            {ungrouped.length > 0 && grouped.length > 0 && (
              <div className="px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/40">Ungrouped</span>
              </div>
            )}
            {ungrouped.map(renderConversationItem)}
          </div>
        )}
      </div>

      <Sheet open={showTopicAssign !== null && !selectedConversationId} onOpenChange={(open) => { if (!open) setShowTopicAssign(null); }}>
        <SheetContent side="bottom" className="bg-[#0D1117] border-white/10 text-white rounded-t-2xl max-h-[50vh] p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-white/10 flex-shrink-0">
            <SheetTitle className="text-white text-lg">Move to Topic</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
            <button
              onClick={() => showTopicAssign && assignTopicMutation.mutate({ conversationId: showTopicAssign, topicId: null })}
              className={cn(
                "w-full text-left text-sm px-3 py-3 rounded-xl active:scale-[0.99]",
                showTopicAssign && !conversations.find(c => c.id === showTopicAssign)?.topicId ? "bg-blue-400/10 text-blue-400" : "text-white/60"
              )}
              data-testid="topic-assign-none-list"
            >
              No Topic
            </button>
            {topics.map(topic => (
              <button
                key={topic.id}
                onClick={() => showTopicAssign && assignTopicMutation.mutate({ conversationId: showTopicAssign, topicId: topic.id })}
                className={cn(
                  "w-full flex items-center gap-2 text-sm px-3 py-3 rounded-xl active:scale-[0.99]",
                  showTopicAssign && conversations.find(c => c.id === showTopicAssign)?.topicId === topic.id ? "bg-blue-400/10 text-blue-400" : "text-white/60"
                )}
                data-testid={`topic-assign-${topic.id}-list`}
              >
                <FolderOpen className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{topic.name}</span>
                {showTopicAssign && conversations.find(c => c.id === showTopicAssign)?.topicId === topic.id && <Check className="h-4 w-4 shrink-0" />}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={showNewConversation} onOpenChange={(open) => { if (!open) resetNewConversation(); }}>
        <SheetContent side="bottom" className="bg-[#0D1117] border-white/10 text-white rounded-t-2xl h-[85vh] p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="text-white text-lg">New Conversation</SheetTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={resetNewConversation}
                className="text-white/60"
                data-testid="button-close-new-conversation"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="py-4 space-y-4">
              <div className="flex gap-2">
                {(["DM", "GROUP", "CHANNEL"] as const).map((type) => {
                  const TypeIcon = type === "DM" ? MessageSquare : type === "GROUP" ? Users : Hash;
                  const label = type === "DM" ? "Direct" : type === "GROUP" ? "Group" : "Channel";
                  return (
                    <button
                      key={type}
                      onClick={() => {
                        setNewConvType(type);
                        if (type === "DM") setNewConvMembers(prev => prev.slice(0, 1));
                      }}
                      className={cn(
                        "flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border active:scale-[0.99]",
                        newConvType === type
                          ? "border-blue-400/50 bg-blue-400/10"
                          : "border-white/10 bg-white/5"
                      )}
                      data-testid={`button-type-${type.toLowerCase()}`}
                    >
                      <TypeIcon className={cn("h-5 w-5", newConvType === type ? "text-blue-400" : "text-white/60")} />
                      <span className={cn("text-xs font-medium", newConvType === type ? "text-blue-400" : "text-white/60")}>{label}</span>
                    </button>
                  );
                })}
              </div>

              {newConvType !== "DM" && (
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-wider mb-1.5 block">Name</label>
                  <Input
                    value={newConvName}
                    onChange={(e) => setNewConvName(e.target.value)}
                    placeholder={newConvType === "GROUP" ? "Group name" : "Channel name"}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-blue-400/50"
                    data-testid="input-new-conversation-name"
                  />
                </div>
              )}

              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-1.5 block">Link to Job (optional)</label>
                <div className="space-y-1 max-h-32 overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-2">
                  <button
                    onClick={() => setNewConvJobId(null)}
                    className={cn(
                      "w-full text-left text-sm px-3 py-2 rounded-xl active:scale-[0.99]",
                      newConvJobId === null ? "bg-blue-400/10 text-blue-400" : "text-white/60"
                    )}
                    data-testid="button-job-none"
                  >
                    None
                  </button>
                  {jobs.slice(0, 50).map(job => (
                    <button
                      key={job.id}
                      onClick={() => setNewConvJobId(String(job.id))}
                      className={cn(
                        "w-full text-left text-sm px-3 py-2 rounded-xl truncate active:scale-[0.99]",
                        newConvJobId === String(job.id) ? "bg-blue-400/10 text-blue-400" : "text-white/60"
                      )}
                      data-testid={`button-job-${job.id}`}
                    >
                      {job.jobNumber} - {job.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-1.5 block">
                  {newConvType === "DM" ? "Select a person" : "Select members"}
                </label>
                <div className="relative mb-2">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  <Input
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search people..."
                    className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-blue-400/50"
                    data-testid="input-member-search"
                  />
                </div>

                {newConvMembers.length > 0 && newConvType !== "DM" && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {newConvMembers.map(id => {
                      const user = allUsers.find(u => String(u.id) === id);
                      return (
                        <button
                          key={id}
                          onClick={() => toggleMember(id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-400/15 text-blue-400 text-xs active:scale-[0.99]"
                          data-testid={`chip-member-${id}`}
                        >
                          <span>{user?.name || user?.email || "User"}</span>
                          <X className="h-3 w-3" />
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-1 max-h-48 overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-2">
                  {filteredUsers.length === 0 ? (
                    <p className="text-center text-sm text-white/40 py-4">No users found</p>
                  ) : (
                    filteredUsers.map(user => {
                      const isSelected = newConvMembers.includes(String(user.id));
                      return (
                        <button
                          key={user.id}
                          onClick={() => toggleMember(String(user.id))}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left active:scale-[0.99]",
                            isSelected ? "bg-blue-400/10" : ""
                          )}
                          data-testid={`button-member-${user.id}`}
                        >
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarFallback className="bg-purple-500/20 text-purple-400 text-xs">
                              {getInitials(user.name || user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">{user.name || user.email}</div>
                            {user.name && (
                              <div className="text-xs text-white/40 truncate">{user.email}</div>
                            )}
                          </div>
                          {isSelected && (
                            <div className="flex-shrink-0 h-5 w-5 rounded-full bg-blue-400 flex items-center justify-center">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 px-4 py-4 border-t border-white/10">
            <Button
              onClick={() => createConversationMutation.mutate()}
              disabled={
                createConversationMutation.isPending ||
                newConvMembers.length === 0 ||
                (newConvType !== "DM" && !newConvName.trim())
              }
              className="w-full bg-blue-500 hover:bg-blue-600 text-white"
              data-testid="button-create-conversation-submit"
            >
              {createConversationMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {newConvType === "DM" ? "Start Chat" : "Create " + (newConvType === "GROUP" ? "Group" : "Channel")}
            </Button>
            {newConvType !== "DM" && !newConvName.trim() && newConvMembers.length > 0 && (
              <p className="text-xs text-white/40 text-center mt-2">Please enter a name</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <MobileBottomNav />
    </div>
  );
}
