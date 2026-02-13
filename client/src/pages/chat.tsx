import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHelpButton } from "@/components/help/page-help-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { apiRequest, getCsrfToken } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { CHAT_ROUTES, USER_ROUTES, JOBS_ROUTES, PANELS_ROUTES } from "@shared/api-routes";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  Plus,
  Send,
  Paperclip,
  X,
  Users,
  Hash,
  MessageSquare,
  FileText,
  Image,
  File,
  Download,
  Search,
  Briefcase,
  ClipboardList,
  MoreVertical,
  Trash2,
  UserPlus,
  Smile,
  ImageOff,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Pencil,
  Tag,
  Palette,
  Check,
} from "lucide-react";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { compressImages } from "@/lib/image-compress";
import { playNotificationSound } from "@/lib/notification-sound";
import { useAuth } from "@/lib/auth";
import type { User, Job, PanelRegister } from "@shared/schema";

const TOPIC_COLOR_PALETTE = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
  "#0ea5e9", "#3b82f6", "#2563eb", "#7c3aed", "#c026d3",
  "#e11d48", "#ea580c", "#ca8a04", "#16a34a", "#0891b2",
  "#4f46e5", "#9333ea", "#db2777", "#dc2626", "#d97706",
  "#65a30d", "#059669", "#0d9488", "#0284c7", "#1d4ed8",
];

interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  role: string;
  joinedAt: string;
  user?: User;
}

interface Conversation {
  id: string;
  name: string | null;
  type: "DM" | "GROUP" | "CHANNEL";
  topicId: string | null;
  jobId: string | null;
  panelId: string | null;
  createdAt: string;
  createdById?: string;
  members?: ConversationMember[];
  lastMessage?: Message;
  unreadCount?: number;
  unreadMentions?: number;
  job?: Job;
  panel?: PanelRegister;
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

interface MessageAttachment {
  id: string;
  messageId: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  storageKey?: string;
  url?: string;
  fileType?: string;
  fileSize?: number;
  filePath?: string;
}

interface MessageMention {
  id: string;
  messageId: string;
  userId: string;
  user?: User;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  createdAt: string;
  sender?: User;
  attachments?: MessageAttachment[];
  mentions?: MessageMention[];
}

function ChatImageAttachment({ att, fileUrl }: { att: MessageAttachment; fileUrl: string }) {
  const [removed, setRemoved] = useState(false);

  if (removed) {
    return (
      <div
        className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border border-dashed border-muted-foreground/30 text-muted-foreground max-w-xs"
        data-testid={`attachment-removed-${att.id}`}
      >
        <ImageOff className="h-4 w-4 shrink-0" />
        <span className="text-sm">Image removed</span>
      </div>
    );
  }

  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
      data-testid={`attachment-${att.id}`}
    >
      <img
        src={fileUrl}
        alt={att.fileName}
        className="max-w-xs max-h-64 rounded-md border cursor-pointer hover:opacity-90"
        onError={() => setRemoved(true)}
      />
    </a>
  );
}

function DraggableConversation({ conv, isDragging, children }: { conv: Conversation; isDragging: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: conv.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={cn(isDragging && "opacity-30")}>
      {children}
    </div>
  );
}

function DroppableTopicZone({ topicId, isDragging, children }: { topicId: string; isDragging: boolean; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: topicId });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-md transition-colors",
        isDragging && "ring-1 ring-dashed ring-muted-foreground/30",
        isOver && "bg-accent/50 ring-2 ring-primary/50"
      )}
    >
      {children}
    </div>
  );
}

export default function ChatPage() {
  useDocumentTitle("Chat");
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [showNewConversationDialog, setShowNewConversationDialog] = useState(false);
  const [showAddMembersDialog, setShowAddMembersDialog] = useState(false);
  const [addingMemberIds, setAddingMemberIds] = useState<Set<string>>(new Set());
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionCursorPosition, setMentionCursorPosition] = useState(0);
  const [collapsedTopics, setCollapsedTopics] = useState<Set<string>>(new Set());
  const [showNewTopicInput, setShowNewTopicInput] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTopicName, setEditingTopicName] = useState("");
  const [draggingConvId, setDraggingConvId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const prevMessageIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  const [newConversation, setNewConversation] = useState({
    name: "",
    type: "GROUP" as "DM" | "GROUP" | "CHANNEL",
    memberIds: [] as string[],
    jobId: null as string | null,
    panelId: null as string | null,
  });

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
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

  const createConversationMutation = useMutation({
    mutationFn: async (data: typeof newConversation) => {
      return apiRequest("POST", CHAT_ROUTES.CONVERSATIONS, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.CONVERSATIONS] });
      setShowNewConversationDialog(false);
      setNewConversation({
        name: "",
        type: "GROUP" as "DM" | "GROUP" | "CHANNEL",
        memberIds: [],
        jobId: null,
        panelId: null,
      });
      toast({ title: "Conversation created" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create conversation", description: error.message, variant: "destructive" });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest("POST", CHAT_ROUTES.MARK_READ, { conversationId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.CONVERSATIONS] });
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.TOTAL_UNREAD] });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, files }: { content: string; files: File[] }) => {
      const mentionMatches = content.match(/@(\w+)/g) || [];
      const mentionedUserIds: string[] = [];
      mentionMatches.forEach(mention => {
        const username = mention.slice(1).toLowerCase();
        const user = users.find(u =>
          u.name?.toLowerCase().includes(username) || u.email.toLowerCase().includes(username)
        );
        if (user) mentionedUserIds.push(String(user.id));
      });

      if (files.length > 0) {
        const formData = new FormData();
        formData.append("content", content);
        formData.append("mentionedUserIds", JSON.stringify(mentionedUserIds));
        files.forEach(f => formData.append("files", f));

        const csrfToken = getCsrfToken();
        const res = await fetch(CHAT_ROUTES.MESSAGES(selectedConversationId!), {
          method: "POST",
          headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
          body: formData,
          credentials: "include",
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      } else {
        return apiRequest("POST", CHAT_ROUTES.MESSAGES(selectedConversationId!), {
          content,
          mentionedUserIds,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.CONVERSATIONS, selectedConversationId, "messages"] });
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.CONVERSATIONS] });
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.TOTAL_UNREAD] });
      setMessageContent("");
      setPendingFiles([]);
      if (selectedConversationId) {
        markAsReadMutation.mutate(selectedConversationId);
      }
    },
    onError: (error: any) => {
      toast({ title: "Failed to send message", description: error.message, variant: "destructive" });
    },
  });

  const addMembersMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      setAddingMemberIds(prev => new Set([...prev, ...userIds]));
      return apiRequest("POST", CHAT_ROUTES.MEMBERS(selectedConversationId!), { userIds });
    },
    onSuccess: (_data, userIds) => {
      setAddingMemberIds(prev => {
        const next = new Set(prev);
        userIds.forEach(id => next.delete(id));
        return next;
      });
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.CONVERSATIONS] });
      toast({ title: "Member added" });
    },
    onError: (error: any, userIds) => {
      setAddingMemberIds(prev => {
        const next = new Set(prev);
        userIds.forEach(id => next.delete(id));
        return next;
      });
      toast({ title: "Failed to add member", description: error.message, variant: "destructive" });
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest("DELETE", CHAT_ROUTES.CONVERSATION_BY_ID(conversationId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.CONVERSATIONS] });
      setSelectedConversationId(null);
      toast({ title: "Conversation deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete conversation", description: error.message, variant: "destructive" });
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

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggingConvId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDraggingConvId(null);
    const { active, over } = event;
    if (!over) return;
    const conversationId = String(active.id);
    const droppableId = String(over.id);
    const topicId = droppableId === "ungrouped-drop" ? null : droppableId;
    const conv = conversations.find(c => c.id === conversationId);
    if (conv && conv.topicId !== topicId) {
      assignTopicMutation.mutate({ conversationId, topicId });
    }
  }, [conversations, assignTopicMutation]);

  const deleteMessageMutation = useMutation({
    mutationFn: async ({ conversationId, messageId }: { conversationId: string; messageId: string }) => {
      return apiRequest("DELETE", CHAT_ROUTES.MESSAGE_BY_ID(conversationId, messageId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.CONVERSATIONS, selectedConversationId, "messages"] });
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.CONVERSATIONS] });
      toast({ title: "Message deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete message", description: error.message, variant: "destructive" });
    },
  });

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    markAsReadMutation.mutate(conversationId);
  };

  const handleSendMessage = () => {
    if (!messageContent.trim() && pendingFiles.length === 0) return;
    sendMessageMutation.mutate({ content: messageContent, files: pendingFiles });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files || []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (rawFiles.length === 0) return;
    setIsCompressing(true);
    try {
      const compressed = await compressImages(rawFiles);
      setPendingFiles(prev => [...prev, ...compressed]);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleRemoveFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessageContent(value);

    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionCursorPosition(cursorPos);
      setShowMentionDropdown(true);
    } else {
      setShowMentionDropdown(false);
    }
  };

  const handleMentionSelect = (user: User) => {
    const beforeMention = messageContent.slice(0, mentionCursorPosition).replace(/@\w*$/, "");
    const afterMention = messageContent.slice(mentionCursorPosition);
    const displayName = user.name || user.email.split("@")[0];
    setMessageContent(`${beforeMention}@${displayName} ${afterMention}`);
    setShowMentionDropdown(false);
    messageInputRef.current?.focus();
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      setIsCompressing(true);
      try {
        const compressed = await compressImages(imageFiles);
        setPendingFiles(prev => [...prev, ...compressed]);
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessageContent(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
    messageInputRef.current?.focus();
  };

  const filteredMentionUsers = users.filter(u => {
    const query = mentionQuery.toLowerCase();
    return (
      u.name?.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)
    );
  }).slice(0, 5);

  const filteredConversations = conversations.filter(c => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      c.name?.toLowerCase().includes(query) ||
      c.job?.jobNumber?.toLowerCase().includes(query) ||
      c.panel?.panelMark?.toLowerCase().includes(query)
    );
  });

  const getConversationDisplayName = (conv: Conversation) => {
    if (conv.name) return conv.name;
    if (conv.jobId && conv.job) return `Job: ${conv.job.jobNumber}`;
    if (conv.panelId && conv.panel) return `Panel: ${conv.panel.panelMark}`;
    if (conv.type === "DM" && conv.members) {
      const otherMembers = conv.members.filter(m => m.user);
      return otherMembers.map(m => m.user?.name || m.user?.email).join(", ");
    }
    return "Conversation";
  };

  const getConversationIcon = (conv: Conversation) => {
    if (conv.jobId) return <Briefcase className="h-4 w-4" />;
    if (conv.panelId) return <ClipboardList className="h-4 w-4" />;
    switch (conv.type) {
      case "DM": return <MessageSquare className="h-4 w-4" />;
      case "GROUP": return <Users className="h-4 w-4" />;
      case "CHANNEL": return <Hash className="h-4 w-4" />;
      default: return <Hash className="h-4 w-4" />;
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (fileType.includes("pdf")) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getInitials = (name?: string | null, email?: string) => {
    if (name) return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    return email?.slice(0, 2).toUpperCase() || "?";
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden" data-testid="chat-page" role="main" aria-label="Chat">
      <div className="w-80 shrink-0 border-r flex flex-col overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-lg font-semibold">Messages</h2>
            <PageHelpButton pageHelpKey="page.chat" />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => { setShowNewTopicInput(!showNewTopicInput); setNewTopicName(""); }}
              data-testid="button-add-topic"
              title="Add Topic"
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
            <Dialog open={showNewConversationDialog} onOpenChange={setShowNewConversationDialog}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" data-testid="button-new-conversation">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Conversation</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={newConversation.type}
                      onValueChange={(v) => setNewConversation(prev => ({ ...prev, type: v as "DM" | "GROUP" | "CHANNEL", jobId: null, panelId: null }))}
                    >
                      <SelectTrigger data-testid="select-conversation-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DM">Direct Message</SelectItem>
                        <SelectItem value="GROUP">Group Chat</SelectItem>
                        <SelectItem value="CHANNEL">Channel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(newConversation.type === "GROUP" || newConversation.type === "CHANNEL") && (
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={newConversation.name}
                        onChange={(e) => setNewConversation(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Conversation name"
                        data-testid="input-conversation-name"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Link to Job (optional)</Label>
                    <Select
                      value={newConversation.jobId || "none"}
                      onValueChange={(v) => setNewConversation(prev => ({ ...prev, jobId: v === "none" ? null : v }))}
                    >
                      <SelectTrigger data-testid="select-job">
                        <SelectValue placeholder="Select a job" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {jobs.slice().sort((a, b) => (a.jobNumber || '').localeCompare(b.jobNumber || '') || (a.name || '').localeCompare(b.name || '')).map(job => (
                          <SelectItem key={job.id} value={job.id.toString()}>
                            {job.jobNumber} - {job.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Link to Panel (optional)</Label>
                    <Select
                      value={newConversation.panelId || "none"}
                      onValueChange={(v) => setNewConversation(prev => ({ ...prev, panelId: v === "none" ? null : v }))}
                    >
                      <SelectTrigger data-testid="select-panel">
                        <SelectValue placeholder="Select a panel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {panels.slice(0, 100).sort((a, b) => (a.panelMark || '').localeCompare(b.panelMark || '')).map(panel => (
                          <SelectItem key={panel.id} value={panel.id.toString()}>
                            {panel.panelMark}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Members (select at least one)</Label>
                    <ScrollArea className="h-48 border rounded-md p-2">
                      {users.slice().sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || '')).map(user => (
                        <div key={user.id} className="flex items-center gap-2 py-1">
                          <Checkbox
                            checked={newConversation.memberIds.includes(String(user.id))}
                            onCheckedChange={(checked) => {
                              setNewConversation(prev => ({
                                ...prev,
                                memberIds: checked
                                  ? [...prev.memberIds, String(user.id)]
                                  : prev.memberIds.filter(id => id !== String(user.id)),
                              }));
                            }}
                            data-testid={`checkbox-member-${user.id}`}
                          />
                          <span className="text-sm">{user.name || user.email}</span>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                </div>
                <DialogFooter>
                  {newConversation.memberIds.length === 0 && (
                    <p className="text-sm text-muted-foreground mr-auto">Please select at least one member</p>
                  )}
                  <Button
                    onClick={() => createConversationMutation.mutate(newConversation)}
                    disabled={createConversationMutation.isPending || newConversation.memberIds.length === 0}
                    data-testid="button-create-conversation"
                  >
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
              data-testid="input-search-conversations"
            />
          </div>
        </div>

        {showNewTopicInput && (
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
            <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTopicName.trim()) createTopicMutation.mutate(newTopicName.trim());
                if (e.key === "Escape") { setShowNewTopicInput(false); setNewTopicName(""); }
              }}
              placeholder="Enter topic name..."
              className="h-8 text-sm"
              autoFocus
              data-testid="input-new-topic"
            />
            <Button
              size="sm"
              onClick={() => newTopicName.trim() && createTopicMutation.mutate(newTopicName.trim())}
              disabled={!newTopicName.trim() || createTopicMutation.isPending}
              data-testid="button-create-topic"
            >
              Create
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setShowNewTopicInput(false); setNewTopicName(""); }}
              data-testid="button-cancel-topic"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        <ScrollArea className="flex-1">
          {conversationsLoading ? (
            <div className="p-4 text-center text-muted-foreground">Loading...</div>
          ) : filteredConversations.length === 0 && topics.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">No conversations</div>
          ) : (
            <DndContext sensors={dndSensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="p-2">
              {(() => {
                const ungrouped = filteredConversations.filter(c => !c.topicId);
                const grouped = topics.map(topic => ({
                  topic,
                  convs: filteredConversations.filter(c => c.topicId === topic.id),
                }));

                const renderConvItem = (conv: Conversation) => {
                  const hasUnread = (conv.unreadCount ?? 0) > 0;
                  return (
                  <DraggableConversation key={conv.id} conv={conv} isDragging={draggingConvId === conv.id}>
                    <div className="group flex items-start" data-testid={`conversation-row-${conv.id}`}>
                      <button
                        onClick={() => handleSelectConversation(conv.id)}
                        className={cn(
                          "flex-1 flex items-center gap-3 p-3 rounded-md text-left hover-elevate transition-colors overflow-hidden",
                          selectedConversationId === conv.id && "bg-accent",
                          hasUnread && "bg-accent/30"
                        )}
                        data-testid={`conversation-${conv.id}`}
                      >
                        <div className="relative text-muted-foreground shrink-0">
                          {getConversationIcon(conv)}
                          {hasUnread && (
                            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className={cn("truncate text-sm", hasUnread ? "font-semibold" : "font-medium")}>
                            {getConversationDisplayName(conv)}
                          </div>
                          {conv.lastMessage && (
                            <div className={cn("text-xs truncate", hasUnread ? "text-foreground/70 font-medium" : "text-muted-foreground")}>
                              {conv.lastMessage.body}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {hasUnread ? (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 min-w-[20px] h-[20px] flex items-center justify-center rounded-full" data-testid={`badge-unread-${conv.id}`}>
                              {(conv.unreadCount ?? 0) > 99 ? "99+" : conv.unreadCount}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              {conv.type}
                            </Badge>
                          )}
                        </div>
                      </button>
                      {topics.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="mt-2 shrink-0 invisible group-hover:visible"
                              data-testid={`button-assign-topic-${conv.id}`}
                            >
                              <Tag className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => assignTopicMutation.mutate({ conversationId: conv.id, topicId: null })}
                              data-testid={`topic-assign-none-${conv.id}`}
                            >
                              No Topic
                            </DropdownMenuItem>
                            {topics.map(topic => (
                              <DropdownMenuItem
                                key={topic.id}
                                onClick={() => assignTopicMutation.mutate({ conversationId: conv.id, topicId: topic.id })}
                                data-testid={`topic-assign-${topic.id}-${conv.id}`}
                              >
                                <FolderOpen className="h-3 w-3 mr-2" />
                                {topic.name}
                                {conv.topicId === topic.id && <span className="ml-auto text-xs text-muted-foreground">current</span>}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </DraggableConversation>
                  );
                };

                return (
                  <>
                    {grouped.map(({ topic, convs }) => {
                      const isCollapsed = collapsedTopics.has(topic.id);
                      const topicUnread = convs.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
                      const isEditing = editingTopicId === topic.id;
                      return (
                        <DroppableTopicZone key={topic.id} topicId={topic.id} isDragging={!!draggingConvId}>
                          <div className="mb-1" data-testid={`topic-group-${topic.id}`}>
                            <div
                              className="group/topic flex items-center gap-1 px-2 py-1.5 rounded-md hover-elevate"
                              style={{ backgroundColor: `${topic.color || '#6366f1'}20`, borderLeft: `3px solid ${topic.color || '#6366f1'}` }}
                            >
                              <button
                                onClick={() => toggleTopicCollapse(topic.id)}
                                className="shrink-0 p-0.5"
                                data-testid={`button-toggle-topic-${topic.id}`}
                              >
                                {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </button>
                              <FolderOpen className="h-3.5 w-3.5 shrink-0" style={{ color: topic.color || '#6366f1' }} />
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
                                  className="h-6 text-xs px-1 py-0 flex-1"
                                  autoFocus
                                  data-testid={`input-rename-topic-${topic.id}`}
                                />
                              ) : (
                                <button
                                  onClick={() => toggleTopicCollapse(topic.id)}
                                  className="text-xs font-semibold uppercase tracking-wider truncate flex-1 text-left"
                                  style={{ color: topic.color || '#6366f1' }}
                                  data-testid={`text-topic-name-${topic.id}`}
                                >
                                  {topic.name}
                                </button>
                              )}
                              {topicUnread > 0 && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 min-w-[18px] h-[18px] flex items-center justify-center">
                                  {topicUnread > 99 ? "99+" : topicUnread}
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-[16px]">{convs.length}</Badge>
                              {!isEditing && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 invisible group-hover/topic:visible" data-testid={`button-topic-menu-${topic.id}`}>
                                      <MoreVertical className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => { setEditingTopicId(topic.id); setEditingTopicName(topic.name); }}
                                      data-testid={`button-edit-topic-${topic.id}`}
                                    >
                                      <Pencil className="h-3 w-3 mr-2" />
                                      Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuSub>
                                      <DropdownMenuSubTrigger data-testid={`menu-color-topic-${topic.id}`}>
                                        <Palette className="h-3 w-3 mr-2" />
                                        Change color
                                      </DropdownMenuSubTrigger>
                                      <DropdownMenuSubContent className="p-2">
                                        <div className="grid grid-cols-7 gap-1.5" data-testid={`color-picker-topic-${topic.id}`}>
                                          {TOPIC_COLOR_PALETTE.map((color) => {
                                            const isUsed = topics.some((t: ChatTopic) => t.id !== topic.id && t.color?.toLowerCase() === color.toLowerCase());
                                            const isSelected = (topic.color || '#6366f1').toLowerCase() === color.toLowerCase();
                                            return (
                                              <button
                                                key={color}
                                                className={cn(
                                                  "w-6 h-6 rounded-md flex items-center justify-center",
                                                  isUsed ? "opacity-25 cursor-not-allowed" : "cursor-pointer",
                                                  isSelected && "ring-2 ring-offset-1 ring-foreground"
                                                )}
                                                style={{ backgroundColor: color }}
                                                onClick={() => { if (!isUsed) updateTopicMutation.mutate({ id: topic.id, color }); }}
                                                disabled={isUsed}
                                                title={isUsed ? "Already used by another topic" : isSelected ? "Current color" : ""}
                                                data-testid={`color-swatch-topic-${topic.id}-${color.replace("#", "")}`}
                                              >
                                                {isSelected && <Check className="h-3.5 w-3.5 text-white drop-shadow-sm" />}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => { if (confirm("Delete this topic? Conversations will be ungrouped.")) deleteTopicMutation.mutate(topic.id); }}
                                      data-testid={`button-delete-topic-${topic.id}`}
                                    >
                                      <Trash2 className="h-3 w-3 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                            {!isCollapsed && (
                              <div className="ml-2 pl-1" style={{ borderLeft: `2px solid ${topic.color || '#6366f1'}40` }}>
                                {convs.map(renderConvItem)}
                              </div>
                            )}
                          </div>
                        </DroppableTopicZone>
                      );
                    })}
                    {ungrouped.length > 0 && grouped.length > 0 && (
                      <DroppableTopicZone topicId="ungrouped-drop" isDragging={!!draggingConvId}>
                        <div className="px-2 py-1.5">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ungrouped</span>
                        </div>
                      </DroppableTopicZone>
                    )}
                    {ungrouped.map(renderConvItem)}
                  </>
                );
              })()}
            </div>
            <DragOverlay>
              {draggingConvId && (() => {
                const conv = filteredConversations.find(c => c.id === draggingConvId);
                if (!conv) return null;
                return (
                  <div className="flex items-center gap-3 p-3 rounded-md bg-card border shadow-lg opacity-90 max-w-[280px]">
                    <div className="text-muted-foreground shrink-0">{getConversationIcon(conv)}</div>
                    <div className="font-medium truncate text-sm">{getConversationDisplayName(conv)}</div>
                  </div>
                );
              })()}
            </DragOverlay>
            </DndContext>
          )}
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selectedConversation ? (
          <>
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-muted-foreground">
                  {getConversationIcon(selectedConversation)}
                </div>
                <div>
                  <h3 className="font-semibold">{getConversationDisplayName(selectedConversation)}</h3>
                  <div className="text-xs text-muted-foreground truncate max-w-md">
                    {selectedConversation.members && selectedConversation.members.length > 0
                      ? selectedConversation.members.map(m => m.user?.name || m.user?.email || "Unknown").join(", ")
                      : "No members"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Dialog open={showAddMembersDialog} onOpenChange={setShowAddMembersDialog}>
                  <DialogTrigger asChild>
                    <Button size="icon" variant="ghost" data-testid="button-add-members">
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Members</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="h-60 border rounded-md p-2">
                      {(() => {
                        const availableUsers = users.filter(u =>
                          !selectedConversation.members?.some(m => m.userId === String(u.id)) &&
                          !addingMemberIds.has(String(u.id))
                        );
                        if (availableUsers.length === 0) {
                          return <div className="p-4 text-center text-muted-foreground text-sm">All users are already members</div>;
                        }
                        return availableUsers.map(user => (
                          <div key={user.id} className="flex items-center justify-between py-2">
                            <span className="text-sm">{user.name || user.email}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addMembersMutation.mutate([String(user.id)])}
                              disabled={addingMemberIds.has(String(user.id))}
                              data-testid={`button-add-member-${user.id}`}
                            >
                              Add
                            </Button>
                          </div>
                        ));
                      })()}
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" data-testid="button-conversation-options">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {topics.length > 0 && (
                      <>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger data-testid="button-move-to-topic">
                            <Tag className="h-4 w-4 mr-2" />
                            Move to Topic
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem
                              onClick={() => assignTopicMutation.mutate({ conversationId: selectedConversation.id, topicId: null })}
                              data-testid="topic-move-none"
                            >
                              No Topic
                              {!selectedConversation.topicId && <span className="ml-auto text-xs text-muted-foreground">current</span>}
                            </DropdownMenuItem>
                            {topics.map(topic => (
                              <DropdownMenuItem
                                key={topic.id}
                                onClick={() => assignTopicMutation.mutate({ conversationId: selectedConversation.id, topicId: topic.id })}
                                data-testid={`topic-move-${topic.id}`}
                              >
                                <FolderOpen className="h-3 w-3 mr-2" />
                                {topic.name}
                                {selectedConversation.topicId === topic.id && <span className="ml-auto text-xs text-muted-foreground">current</span>}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this conversation? This action cannot be undone.")) {
                          deleteConversationMutation.mutate(selectedConversation.id);
                        }
                      }}
                      data-testid="button-delete-conversation"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Conversation
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto" ref={scrollAreaRef}>
              {messagesLoading ? (
                <div className="text-center text-muted-foreground">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground">No messages yet</div>
              ) : (
                <div className="space-y-1">
                  {messages.map((msg, idx) => {
                    const isMe = msg.senderId === String(currentUser?.id);
                    const msgDate = new Date(msg.createdAt);
                    const prevMsg = idx > 0 ? messages[idx - 1] : null;
                    const showDateSeparator = !prevMsg || format(new Date(prevMsg.createdAt), "yyyy-MM-dd") !== format(msgDate, "yyyy-MM-dd");
                    const timeStr = format(msgDate, "dd/MM/yyyy h:mm a");

                    return (
                      <div key={msg.id} data-testid={`message-${msg.id}`}>
                        {showDateSeparator && (
                          <div className="flex items-center justify-center my-4">
                            <div className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                              {format(msgDate, "EEEE, d MMMM yyyy")}
                            </div>
                          </div>
                        )}
                        {isMe ? (
                          <div className="flex flex-col items-end group mb-2">
                            <div className="text-[11px] text-muted-foreground mb-0.5 mr-1">{timeStr}</div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 invisible group-hover:visible shrink-0"
                                onClick={() => {
                                  if (confirm("Delete this message?")) {
                                    deleteMessageMutation.mutate({
                                      conversationId: selectedConversation.id,
                                      messageId: msg.id,
                                    });
                                  }
                                }}
                                data-testid={`button-delete-message-${msg.id}`}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                              <div className="bg-primary text-primary-foreground rounded-md rounded-tr-none px-3 py-2 max-w-[75%]">
                                {msg.body && <p className="text-sm whitespace-pre-wrap">{msg.body}</p>}
                                {msg.attachments && msg.attachments.length > 0 && (
                                  <div className="mt-1 space-y-1">
                                    {msg.attachments.map(att => {
                                      const isImage = att.mimeType?.startsWith("image/");
                                      const fileUrl = att.url || att.filePath;
                                      const fileType = att.mimeType || att.fileType || "";
                                      const fileSize = att.sizeBytes || att.fileSize || 0;
                                      return isImage ? (
                                        <ChatImageAttachment key={att.id} att={att} fileUrl={fileUrl || ""} />
                                      ) : (
                                        <a key={att.id} href={fileUrl} target="_blank" rel="noopener noreferrer"
                                          className="flex items-center gap-2 p-2 rounded-md bg-primary-foreground/20 text-sm"
                                          data-testid={`attachment-${att.id}`}>
                                          {getFileIcon(fileType)}
                                          <span className="truncate flex-1">{att.fileName}</span>
                                          <span className="text-xs opacity-70">{formatFileSize(fileSize)}</span>
                                          <Download className="h-4 w-4" />
                                        </a>
                                      );
                                    })}
                                  </div>
                                )}
                                {msg.mentions && msg.mentions.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {msg.mentions.map(mention => (
                                      <Badge key={mention.id} variant="secondary" className="text-xs">
                                        @{mention.user?.name || mention.user?.email || "unknown"}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2 group mb-2">
                            <Avatar className="h-8 w-8 shrink-0 mt-5">
                              <AvatarFallback className="text-xs">
                                {getInitials(msg.sender?.name, msg.sender?.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="max-w-[75%]">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-medium text-xs">{msg.sender?.name || msg.sender?.email || "Unknown"}</span>
                                <span className="text-[11px] text-muted-foreground">{timeStr}</span>
                              </div>
                              <div className="bg-muted rounded-md rounded-tl-none px-3 py-2">
                                {msg.body && <p className="text-sm whitespace-pre-wrap">{msg.body}</p>}
                                {msg.attachments && msg.attachments.length > 0 && (
                                  <div className="mt-1 space-y-1">
                                    {msg.attachments.map(att => {
                                      const isImage = att.mimeType?.startsWith("image/");
                                      const fileUrl = att.url || att.filePath;
                                      const fileType = att.mimeType || att.fileType || "";
                                      const fileSize = att.sizeBytes || att.fileSize || 0;
                                      return isImage ? (
                                        <ChatImageAttachment key={att.id} att={att} fileUrl={fileUrl || ""} />
                                      ) : (
                                        <a key={att.id} href={fileUrl} target="_blank" rel="noopener noreferrer"
                                          className="flex items-center gap-2 p-2 rounded-md bg-background hover-elevate text-sm"
                                          data-testid={`attachment-${att.id}`}>
                                          {getFileIcon(fileType)}
                                          <span className="truncate flex-1">{att.fileName}</span>
                                          <span className="text-xs text-muted-foreground">{formatFileSize(fileSize)}</span>
                                          <Download className="h-4 w-4" />
                                        </a>
                                      );
                                    })}
                                  </div>
                                )}
                                {msg.mentions && msg.mentions.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {msg.mentions.map(mention => (
                                      <Badge key={mention.id} variant="secondary" className="text-xs">
                                        @{mention.user?.name || mention.user?.email || "unknown"}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 invisible group-hover:visible shrink-0 mt-5"
                              onClick={() => {
                                if (confirm("Delete this message?")) {
                                  deleteMessageMutation.mutate({
                                    conversationId: selectedConversation.id,
                                    messageId: msg.id,
                                  });
                                }
                              }}
                              data-testid={`button-delete-message-${msg.id}`}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="p-4 border-t">
              {pendingFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {pendingFiles.map((file, i) => (
                    file.type.startsWith("image/") ? (
                      <div key={i} className="relative group">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="h-16 w-16 object-cover rounded border"
                        />
                        <button
                          onClick={() => handleRemoveFile(i)}
                          className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                          data-testid={`button-remove-file-${i}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <Badge key={i} variant="secondary" className="flex items-center gap-1">
                        {getFileIcon(file.type)}
                        <span className="max-w-32 truncate">{file.name}</span>
                        <button onClick={() => handleRemoveFile(i)} className="ml-1" data-testid={`button-remove-file-${i}`}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  ))}
                </div>
              )}

              <div className="relative">
                {showMentionDropdown && filteredMentionUsers.length > 0 && (
                  <Card className="absolute bottom-full mb-2 left-0 w-64 z-10">
                    <CardContent className="p-1">
                      {filteredMentionUsers.map(user => (
                        <button
                          key={user.id}
                          onClick={() => handleMentionSelect(user)}
                          className="w-full flex items-center gap-2 p-2 rounded hover-elevate text-left"
                          data-testid={`mention-user-${user.id}`}
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {getInitials(user.name, user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{user.name || user.email}</span>
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <div className="flex items-end gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    multiple
                    className="hidden"
                    data-testid="input-file-upload"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-attach-file"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <div className="relative">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      data-testid="button-emoji-picker"
                    >
                      <Smile className="h-4 w-4" />
                    </Button>
                    {showEmojiPicker && (
                      <div className="absolute bottom-12 left-0 z-50">
                        <EmojiPicker
                          onEmojiClick={handleEmojiClick}
                          theme={Theme.AUTO}
                          width={300}
                          height={400}
                        />
                      </div>
                    )}
                  </div>
                  <Textarea
                    ref={messageInputRef}
                    value={messageContent}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder="Type a message... Use @ to mention someone. Paste images directly!"
                    className="flex-1 min-h-[40px] max-h-32 resize-none"
                    data-testid="input-message"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={sendMessageMutation.isPending || isCompressing || (!messageContent.trim() && pendingFiles.length === 0)}
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
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
  );
}
