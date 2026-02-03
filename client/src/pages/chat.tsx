import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
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
  type: "DIRECT" | "GROUP" | "JOB" | "PANEL";
  jobId: number | null;
  panelId: number | null;
  createdAt: string;
  createdById: string;
  members?: ConversationMember[];
  lastMessage?: Message;
  job?: Job;
  panel?: PanelRegister;
}

interface MessageAttachment {
  id: string;
  messageId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
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
  content: string;
  createdAt: string;
  sender?: User;
  attachments?: MessageAttachment[];
  mentions?: MessageMention[];
}

export default function ChatPage() {
  const { toast } = useToast();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [showNewConversationDialog, setShowNewConversationDialog] = useState(false);
  const [showAddMembersDialog, setShowAddMembersDialog] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionCursorPosition, setMentionCursorPosition] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [newConversation, setNewConversation] = useState({
    name: "",
    type: "GROUP" as "DIRECT" | "GROUP" | "JOB" | "PANEL",
    memberIds: [] as string[],
    jobId: null as number | null,
    panelId: null as number | null,
  });

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/chat/conversations"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: panels = [] } = useQuery<PanelRegister[]>({
    queryKey: ["/api/panels"],
  });

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/chat/conversations", selectedConversationId, "messages"],
    enabled: !!selectedConversationId,
  });

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const createConversationMutation = useMutation({
    mutationFn: async (data: typeof newConversation) => {
      return apiRequest("POST", "/api/chat/conversations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      setShowNewConversationDialog(false);
      setNewConversation({
        name: "",
        type: "GROUP",
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

        const res = await fetch(`/api/chat/conversations/${selectedConversationId}/messages`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      } else {
        return apiRequest("POST", `/api/chat/conversations/${selectedConversationId}/messages`, {
          content,
          mentionedUserIds,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations", selectedConversationId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      setMessageContent("");
      setPendingFiles([]);
    },
    onError: (error: any) => {
      toast({ title: "Failed to send message", description: error.message, variant: "destructive" });
    },
  });

  const addMembersMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      return apiRequest("POST", `/api/chat/conversations/${selectedConversationId}/members`, { userIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      setShowAddMembersDialog(false);
      toast({ title: "Members added" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add members", description: error.message, variant: "destructive" });
    },
  });

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPendingFiles(prev => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
    if (conv.type === "JOB" && conv.job) return `Job: ${conv.job.jobNumber}`;
    if (conv.type === "PANEL" && conv.panel) return `Panel: ${conv.panel.panelMark}`;
    if (conv.type === "DIRECT" && conv.members) {
      const otherMembers = conv.members.filter(m => m.user);
      return otherMembers.map(m => m.user?.name || m.user?.email).join(", ");
    }
    return "Conversation";
  };

  const getConversationIcon = (type: string) => {
    switch (type) {
      case "DIRECT": return <MessageSquare className="h-4 w-4" />;
      case "GROUP": return <Users className="h-4 w-4" />;
      case "JOB": return <Briefcase className="h-4 w-4" />;
      case "PANEL": return <ClipboardList className="h-4 w-4" />;
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
    <div className="flex h-full" data-testid="chat-page">
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-lg font-semibold">Messages</h2>
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
                      onValueChange={(v) => setNewConversation(prev => ({ ...prev, type: v as any, jobId: null, panelId: null }))}
                    >
                      <SelectTrigger data-testid="select-conversation-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DIRECT">Direct Message</SelectItem>
                        <SelectItem value="GROUP">Group Chat</SelectItem>
                        <SelectItem value="JOB">Job Discussion</SelectItem>
                        <SelectItem value="PANEL">Panel Discussion</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(newConversation.type === "GROUP" || newConversation.type === "JOB" || newConversation.type === "PANEL") && (
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

                  {newConversation.type === "JOB" && (
                    <div className="space-y-2">
                      <Label>Link to Job</Label>
                      <Select
                        value={newConversation.jobId?.toString() || ""}
                        onValueChange={(v) => setNewConversation(prev => ({ ...prev, jobId: v ? parseInt(v) : null }))}
                      >
                        <SelectTrigger data-testid="select-job">
                          <SelectValue placeholder="Select a job" />
                        </SelectTrigger>
                        <SelectContent>
                          {jobs.map(job => (
                            <SelectItem key={job.id} value={job.id.toString()}>
                              {job.jobNumber} - {job.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {newConversation.type === "PANEL" && (
                    <div className="space-y-2">
                      <Label>Link to Panel</Label>
                      <Select
                        value={newConversation.panelId?.toString() || ""}
                        onValueChange={(v) => setNewConversation(prev => ({ ...prev, panelId: v ? parseInt(v) : null }))}
                      >
                        <SelectTrigger data-testid="select-panel">
                          <SelectValue placeholder="Select a panel" />
                        </SelectTrigger>
                        <SelectContent>
                          {panels.slice(0, 100).map(panel => (
                            <SelectItem key={panel.id} value={panel.id.toString()}>
                              {panel.panelMark}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Members</Label>
                    <ScrollArea className="h-40 border rounded-md p-2">
                      {users.map(user => (
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
                  <Button
                    onClick={() => createConversationMutation.mutate(newConversation)}
                    disabled={createConversationMutation.isPending}
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
                  onClick={() => setSelectedConversationId(conv.id)}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 rounded-md text-left hover-elevate transition-colors",
                    selectedConversationId === conv.id && "bg-accent"
                  )}
                  data-testid={`conversation-${conv.id}`}
                >
                  <div className="mt-0.5 text-muted-foreground">
                    {getConversationIcon(conv.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-sm">
                      {getConversationDisplayName(conv)}
                    </div>
                    {conv.lastMessage && (
                      <div className="text-xs text-muted-foreground truncate">
                        {conv.lastMessage.content}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {conv.type}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-muted-foreground">
                  {getConversationIcon(selectedConversation.type)}
                </div>
                <div>
                  <h3 className="font-semibold">{getConversationDisplayName(selectedConversation)}</h3>
                  <div className="text-xs text-muted-foreground">
                    {selectedConversation.members?.length || 0} members
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
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              {messagesLoading ? (
                <div className="text-center text-muted-foreground">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground">No messages yet</div>
              ) : (
                <div className="space-y-4">
                  {messages.map(msg => (
                    <div key={msg.id} className="flex gap-3" data-testid={`message-${msg.id}`}>
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-xs">
                          {getInitials(msg.sender?.name, msg.sender?.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-medium text-sm">
                            {msg.sender?.name || msg.sender?.email || "Unknown"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                          </span>
                        </div>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{msg.content}</p>
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {msg.attachments.map(att => (
                              <a
                                key={att.id}
                                href={att.filePath}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2 rounded-md bg-muted hover-elevate text-sm"
                                data-testid={`attachment-${att.id}`}
                              >
                                {getFileIcon(att.fileType)}
                                <span className="truncate flex-1">{att.fileName}</span>
                                <span className="text-xs text-muted-foreground">{formatFileSize(att.fileSize)}</span>
                                <Download className="h-4 w-4" />
                              </a>
                            ))}
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
            </ScrollArea>

            <div className="p-4 border-t">
              {pendingFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {pendingFiles.map((file, i) => (
                    <Badge key={i} variant="secondary" className="flex items-center gap-1">
                      {getFileIcon(file.type)}
                      <span className="max-w-32 truncate">{file.name}</span>
                      <button onClick={() => handleRemoveFile(i)} className="ml-1" data-testid={`button-remove-file-${i}`}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
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
                  <Textarea
                    ref={messageInputRef}
                    value={messageContent}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message... Use @ to mention someone"
                    className="flex-1 min-h-[40px] max-h-32 resize-none"
                    data-testid="input-message"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={sendMessageMutation.isPending || (!messageContent.trim() && pendingFiles.length === 0)}
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
