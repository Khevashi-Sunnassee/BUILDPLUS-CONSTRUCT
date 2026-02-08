import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, getCsrfToken } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, FileIcon, Send, UserPlus, Image, X, Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CHAT_ROUTES, USER_ROUTES } from "@shared/api-routes";
import type { User, PanelConversation, ChatMessage } from "./types";
import { COMMON_EMOJIS } from "./types";

export function PanelChatTab({ panelId, panelMark }: { panelId: string; panelMark: string }) {
  const { toast } = useToast();
  const [messageContent, setMessageContent] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showAddMembersDialog, setShowAddMembersDialog] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertEmoji = (emoji: string) => {
    setMessageContent((prev) => prev + emoji);
    setEmojiOpen(false);
    textareaRef.current?.focus();
  };

  const { data: conversation, isLoading: conversationLoading } = useQuery<PanelConversation>({
    queryKey: [CHAT_ROUTES.PANEL_CONVERSATION(panelId), panelId, "conversation"],
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<ChatMessage[]>({
    queryKey: [CHAT_ROUTES.MESSAGES(conversation?.id || ""), conversation?.id, "messages"],
    enabled: !!conversation?.id,
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: [USER_ROUTES.LIST],
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, files }: { content: string; files: File[] }) => {
      const formData = new FormData();
      formData.append("content", content);
      formData.append("mentionedUserIds", JSON.stringify([]));
      files.forEach((file) => formData.append("files", file));
      
      const csrfToken = getCsrfToken();
      const res = await fetch(CHAT_ROUTES.MESSAGES(conversation?.id || ""), {
        method: "POST",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || "Failed to send message");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.MESSAGES(conversation?.id || ""), conversation?.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.PANELS_COUNTS] });
      setMessageContent("");
      setPendingFiles([]);
    },
    onError: (error: any) => {
      toast({ title: "Failed to send message", description: error.message, variant: "destructive" });
    },
  });

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const newFile = new File([file], `screenshot-${timestamp}.png`, { type: file.type });
          imageFiles.push(newFile);
        }
      }
    }

    if (imageFiles.length > 0) {
      setPendingFiles((prev) => [...prev, ...imageFiles]);
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const addMembersMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      return apiRequest("POST", CHAT_ROUTES.MEMBERS(conversation?.id || ""), { userIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.PANEL_CONVERSATION(panelId), panelId, "conversation"] });
      setShowAddMembersDialog(false);
      setSelectedMemberIds([]);
      toast({ title: "Members added" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add members", description: error.message, variant: "destructive" });
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageContent.trim() && pendingFiles.length === 0) || !conversation?.id) return;
    sendMessageMutation.mutate({ content: messageContent, files: pendingFiles });
  };

  const existingMemberIds = conversation?.members?.map(m => m.userId) || [];
  const availableUsersToAdd = allUsers.filter(u => !existingMemberIds.includes(u.id));

  if (conversationLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[400px] border rounded-md">
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          <span className="font-medium text-sm">Panel: {panelMark}</span>
          <Badge variant="secondary" className="text-xs">
            {conversation?.members?.length || 0} members
          </Badge>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAddMembersDialog(true)}
          data-testid="button-add-chat-members"
        >
          <UserPlus className="h-4 w-4 mr-1" />
          Add Members
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {messagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageCircle className="h-8 w-8 mb-2" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs">Start the conversation about this panel</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {msg.sender?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{msg.sender?.name || "Unknown"}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.createdAt).toLocaleString("en-AU", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm mt-1">{msg.body}</p>
                  {msg.attachments?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {msg.attachments.map((att) => (
                        att.mimeType?.startsWith("image/") ? (
                          <a
                            key={att.id}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <img
                              src={att.url}
                              alt={att.fileName}
                              className="max-w-[200px] max-h-[150px] rounded border object-cover"
                            />
                          </a>
                        ) : (
                          <a
                            key={att.id}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            <FileIcon className="h-3 w-3" />
                            {att.fileName}
                          </a>
                        )
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

      <form onSubmit={handleSendMessage} className="p-3 border-t">
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {pendingFiles.map((file, index) => (
              <div key={index} className="relative group">
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="w-16 h-16 object-cover rounded border"
                />
                <button
                  type="button"
                  onClick={() => removePendingFile(index)}
                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              onPaste={handlePaste}
              placeholder="Type a message or paste a screenshot..."
              className="resize-none min-h-[40px] max-h-[80px] pr-10"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              data-testid="input-chat-message"
            />
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-7 w-7"
                  data-testid="button-emoji-picker"
                >
                  <Smile className="h-4 w-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="end">
                <div className="grid grid-cols-10 gap-1">
                  {COMMON_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      className="text-lg hover:bg-muted rounded p-1 transition-colors"
                      data-testid={`emoji-${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={(!messageContent.trim() && pendingFiles.length === 0) || sendMessageMutation.isPending}
            data-testid="button-send-message"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>

      <Dialog open={showAddMembersDialog} onOpenChange={setShowAddMembersDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Members to Chat</DialogTitle>
            <DialogDescription>
              Select users to add to this panel's conversation
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {availableUsersToAdd.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                All users are already members
              </p>
            ) : (
              availableUsersToAdd.map((user) => (
                <label
                  key={user.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedMemberIds.includes(user.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedMemberIds([...selectedMemberIds, user.id]);
                      } else {
                        setSelectedMemberIds(selectedMemberIds.filter(id => id !== user.id));
                      }
                    }}
                    className="rounded"
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {user.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{user.name || "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMembersDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addMembersMutation.mutate(selectedMemberIds)}
              disabled={selectedMemberIds.length === 0 || addMembersMutation.isPending}
            >
              {addMembersMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add {selectedMemberIds.length} Members
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
