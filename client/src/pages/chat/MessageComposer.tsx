import { useState, useRef, useMemo, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getCsrfToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Paperclip, X, Smile } from "lucide-react";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { CHAT_ROUTES } from "@shared/api-routes";
import { compressImages } from "@/lib/image-compress";
import { getFileIcon, getInitials } from "./chat-helpers";
import type { User } from "@shared/schema";

interface MessageComposerProps {
  selectedConversationId: string;
  users: User[];
}

export function MessageComposer({ selectedConversationId, users }: MessageComposerProps) {
  const { toast } = useToast();
  const [messageContent, setMessageContent] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionCursorPosition, setMentionCursorPosition] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

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
        const res = await fetch(CHAT_ROUTES.MESSAGES(selectedConversationId), {
          method: "POST",
          headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
          body: formData,
          credentials: "include",
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      } else {
        return apiRequest("POST", CHAT_ROUTES.MESSAGES(selectedConversationId), {
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
      markAsReadMutation.mutate(selectedConversationId);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send message", description: error.message, variant: "destructive" });
    },
  });

  const handleSendMessage = useCallback(() => {
    if (!messageContent.trim() && pendingFiles.length === 0) return;
    sendMessageMutation.mutate({ content: messageContent, files: pendingFiles });
  }, [messageContent, pendingFiles, sendMessageMutation]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
  }, []);

  const handleMentionSelect = useCallback((user: User) => {
    const beforeMention = messageContent.slice(0, mentionCursorPosition).replace(/@\w*$/, "");
    const afterMention = messageContent.slice(mentionCursorPosition);
    const displayName = user.name || user.email.split("@")[0];
    setMessageContent(`${beforeMention}@${displayName} ${afterMention}`);
    setShowMentionDropdown(false);
    messageInputRef.current?.focus();
  }, [messageContent, mentionCursorPosition]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
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
  }, []);

  const handleEmojiClick = useCallback((emojiData: EmojiClickData) => {
    setMessageContent(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
    messageInputRef.current?.focus();
  }, []);

  const filteredMentionUsers = useMemo(() => users.filter(u => {
    const query = mentionQuery.toLowerCase();
    return (
      u.name?.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)
    );
  }).slice(0, 5), [users, mentionQuery]);

  return (
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
  );
}
