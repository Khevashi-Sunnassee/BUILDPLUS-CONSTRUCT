import { useState, useRef, useEffect } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getCsrfToken } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { CHAT_ROUTES, USER_ROUTES, JOBS_ROUTES, PANELS_ROUTES } from "@shared/api-routes";
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
} from "lucide-react";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { compressImages } from "@/lib/image-compress";
import type { User, Job, PanelRegister } from "@shared/schema";

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

export default function ChatPage() {
  const { toast } = useToast();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [showNewConversationDialog, setShowNewConversationDialog] = useState(false);
  const [showAddMembersDialog, setShowAddMembersDialog] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionCursorPosition, setMentionCursorPosition] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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
      setMessageContent("");
      setPendingFiles([]);
    },
    onError: (error: any) => {
      toast({ title: "Failed to send message", description: error.message, variant: "destructive" });
    },
  });

  const addMembersMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      return apiRequest("POST", CHAT_ROUTES.MEMBERS(selectedConversationId!), { userIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.CONVERSATIONS] });
      setShowAddMembersDialog(false);
      toast({ title: "Members added" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add members", description: error.message, variant: "destructive" });
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

  const markAsReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest("POST", CHAT_ROUTES.MARK_READ, { conversationId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.CONVERSATIONS] });
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.TOTAL_UNREAD] });
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
    <div className="flex h-full min-h-0 overflow-hidden" data-testid="chat-page">
      <div className="w-80 shrink-0 border-r flex flex-col overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-lg font-semibold">Messages</h2>
            <PageHelpButton pageHelpKey="page.chat" />
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

        <ScrollArea className="flex-1">
          {conversationsLoading ? (
            <div className="p-4 text-center text-muted-foreground">Loading...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">No conversations</div>
          ) : (
            <div className="p-2">
              {filteredConversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 rounded-md text-left hover-elevate transition-colors overflow-hidden",
                    selectedConversationId === conv.id && "bg-accent"
                  )}
                  data-testid={`conversation-${conv.id}`}
                >
                  <div className="mt-0.5 text-muted-foreground shrink-0">
                    {getConversationIcon(conv)}
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="font-medium truncate text-sm">
                      {getConversationDisplayName(conv)}
                    </div>
                    {conv.lastMessage && (
                      <div className="text-xs text-muted-foreground truncate">
                        {conv.lastMessage.body}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="outline" className="text-xs">
                      {conv.type}
                    </Badge>
                    {(conv.unreadCount ?? 0) > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 min-w-[18px] h-[18px] flex items-center justify-center" data-testid={`badge-unread-${conv.id}`}>
                        {(conv.unreadCount ?? 0) > 99 ? "99+" : conv.unreadCount}
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
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
                      {users
                        .filter(u => !selectedConversation.members?.some(m => m.userId === String(u.id)))
                        .map(user => (
                          <div key={user.id} className="flex items-center justify-between py-2">
                            <span className="text-sm">{user.name || user.email}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addMembersMutation.mutate([String(user.id)])}
                              disabled={addMembersMutation.isPending}
                              data-testid={`button-add-member-${user.id}`}
                            >
                              Add
                            </Button>
                          </div>
                        ))}
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
                <div className="space-y-4">
                  {messages.map(msg => (
                    <div key={msg.id} className="flex gap-3 group" data-testid={`message-${msg.id}`}>
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-xs">
                          {getInitials(msg.sender?.name, msg.sender?.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {msg.sender?.name || msg.sender?.email || "Unknown"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
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
                        <p className="text-sm mt-1 whitespace-pre-wrap">{msg.body}</p>
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {msg.attachments.map(att => {
                              const isImage = att.mimeType?.startsWith("image/");
                              const fileUrl = att.url || att.filePath;
                              const fileType = att.mimeType || att.fileType || "";
                              const fileSize = att.sizeBytes || att.fileSize || 0;
                              
                              return isImage ? (
                                <ChatImageAttachment key={att.id} att={att} fileUrl={fileUrl || ""} />
                              ) : (
                                <a
                                  key={att.id}
                                  href={fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 p-2 rounded-md bg-muted hover-elevate text-sm"
                                  data-testid={`attachment-${att.id}`}
                                >
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
                  ))}
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
