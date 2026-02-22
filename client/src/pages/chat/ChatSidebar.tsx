import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageHelpButton } from "@/components/help/page-help-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
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
import { CHAT_ROUTES } from "@shared/api-routes";
import {
  Plus,
  X,
  Search,
  FolderOpen,
  MoreVertical,
  Trash2,
  Pencil,
  Tag,
  Palette,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { Conversation, ChatTopic } from "./chat-types";
import { TOPIC_COLOR_PALETTE } from "./chat-types";
import { getConversationDisplayName, getConversationIcon } from "./chat-helpers";
import type { User, Job, PanelRegister } from "@shared/schema";

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

interface ChatSidebarProps {
  conversations: Conversation[];
  filteredConversations: Conversation[];
  topics: ChatTopic[];
  users: User[];
  jobs: Job[];
  panels: PanelRegister[];
  selectedConversationId: string | null;
  searchQuery: string;
  conversationsLoading: boolean;
  onSearchChange: (query: string) => void;
  onSelectConversation: (id: string) => void;
}

export function ChatSidebar({
  conversations,
  filteredConversations,
  topics,
  users,
  jobs,
  panels,
  selectedConversationId,
  searchQuery,
  conversationsLoading,
  onSearchChange,
  onSelectConversation,
}: ChatSidebarProps) {
  const { toast } = useToast();
  const [showNewConversationDialog, setShowNewConversationDialog] = useState(false);
  const [collapsedTopics, setCollapsedTopics] = useState<Set<string>>(new Set());
  const [showNewTopicInput, setShowNewTopicInput] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTopicName, setEditingTopicName] = useState("");
  const [draggingConvId, setDraggingConvId] = useState<string | null>(null);

  const [newConversation, setNewConversation] = useState({
    name: "",
    type: "GROUP" as "DM" | "GROUP" | "CHANNEL",
    memberIds: [] as string[],
    jobId: null as string | null,
    panelId: null as string | null,
  });

  const createConversationMutation = useMutation({
    mutationFn: async (data: typeof newConversation) => {
      return apiRequest("POST", CHAT_ROUTES.CONVERSATIONS, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.CONVERSATIONS] });
      setShowNewConversationDialog(false);
      setNewConversation({ name: "", type: "GROUP", memberIds: [], jobId: null, panelId: null });
      toast({ title: "Conversation created" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create conversation", description: error.message, variant: "destructive" });
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
    onError: (error: Error) => {
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
    onError: (error: Error) => {
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
    onError: (error: Error) => {
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
    onError: (error: Error) => {
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

  const renderConvItem = (conv: Conversation) => {
    const hasUnread = (conv.unreadCount ?? 0) > 0;
    return (
      <DraggableConversation key={conv.id} conv={conv} isDragging={draggingConvId === conv.id}>
        <div className="group flex items-start" data-testid={`conversation-row-${conv.id}`}>
          <button
            onClick={() => onSelectConversation(conv.id)}
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
                <DialogDescription>Create a new direct message, group chat, or channel.</DialogDescription>
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
            onChange={(e) => onSearchChange(e.target.value)}
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
  );
}
