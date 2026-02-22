import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trash2, Download, ImageOff } from "lucide-react";
import { format } from "date-fns";
import { CHAT_ROUTES } from "@shared/api-routes";
import type { Message, MessageAttachment, Conversation } from "./chat-types";
import { getFileIcon, formatFileSize, getInitials } from "./chat-helpers";

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
    <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block" data-testid={`attachment-${att.id}`}>
      <img
        src={fileUrl}
        alt={att.fileName}
        className="max-w-xs max-h-64 rounded-md border cursor-pointer hover:opacity-90"
        onError={() => setRemoved(true)}
      />
    </a>
  );
}

function MessageAttachments({ attachments, variant }: { attachments: MessageAttachment[]; variant: "sent" | "received" }) {
  return (
    <div className="mt-1 space-y-1">
      {attachments.map(att => {
        const isImage = att.mimeType?.startsWith("image/");
        const fileUrl = att.url || att.filePath;
        const fileType = att.mimeType || att.fileType || "";
        const fileSize = att.sizeBytes || att.fileSize || 0;
        return isImage ? (
          <ChatImageAttachment key={att.id} att={att} fileUrl={fileUrl || ""} />
        ) : (
          <a key={att.id} href={fileUrl} target="_blank" rel="noopener noreferrer"
            className={`flex items-center gap-2 p-2 rounded-md text-sm ${variant === "sent" ? "bg-primary-foreground/20" : "bg-background hover-elevate"}`}
            data-testid={`attachment-${att.id}`}>
            {getFileIcon(fileType)}
            <span className="truncate flex-1">{att.fileName}</span>
            <span className={`text-xs ${variant === "sent" ? "opacity-70" : "text-muted-foreground"}`}>{formatFileSize(fileSize)}</span>
            <Download className="h-4 w-4" />
          </a>
        );
      })}
    </div>
  );
}

interface MessageListProps {
  messages: Message[];
  messagesLoading: boolean;
  selectedConversation: Conversation;
  currentUserId: string | number | undefined;
  scrollAreaRef: React.RefObject<HTMLDivElement>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

export function MessageList({
  messages,
  messagesLoading,
  selectedConversation,
  currentUserId,
  scrollAreaRef,
  messagesEndRef,
}: MessageListProps) {
  const { toast } = useToast();

  const deleteMessageMutation = useMutation({
    mutationFn: async ({ conversationId, messageId }: { conversationId: string; messageId: string }) => {
      return apiRequest("DELETE", CHAT_ROUTES.MESSAGE_BY_ID(conversationId, messageId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.CONVERSATIONS, selectedConversation.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.CONVERSATIONS] });
      toast({ title: "Message deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete message", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="flex-1 p-4 overflow-y-auto" ref={scrollAreaRef}>
      {messagesLoading ? (
        <div className="text-center text-muted-foreground">Loading messages...</div>
      ) : messages.length === 0 ? (
        <div className="text-center text-muted-foreground">No messages yet</div>
      ) : (
        <div className="space-y-1">
          {messages.map((msg, idx) => {
            const isMe = msg.senderId === String(currentUserId);
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
                          <MessageAttachments attachments={msg.attachments} variant="sent" />
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
                          <MessageAttachments attachments={msg.attachments} variant="received" />
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
  );
}
