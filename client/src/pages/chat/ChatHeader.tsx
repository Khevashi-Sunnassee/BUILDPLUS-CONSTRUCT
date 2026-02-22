import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { MoreVertical, Trash2, UserPlus, Tag, FolderOpen } from "lucide-react";
import { CHAT_ROUTES } from "@shared/api-routes";
import type { Conversation, ChatTopic } from "./chat-types";
import { getConversationDisplayName, getConversationIcon } from "./chat-helpers";
import type { User } from "@shared/schema";

interface ChatHeaderProps {
  selectedConversation: Conversation;
  topics: ChatTopic[];
  users: User[];
  onConversationDeleted: () => void;
}

export function ChatHeader({ selectedConversation, topics, users, onConversationDeleted }: ChatHeaderProps) {
  const { toast } = useToast();
  const [showAddMembersDialog, setShowAddMembersDialog] = useState(false);
  const [addingMemberIds, setAddingMemberIds] = useState<Set<string>>(new Set());

  const addMembersMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      setAddingMemberIds(prev => new Set([...prev, ...userIds]));
      return apiRequest("POST", CHAT_ROUTES.MEMBERS(selectedConversation.id), { userIds });
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
    onError: (error: Error, userIds: string[]) => {
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
      onConversationDeleted();
      toast({ title: "Conversation deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete conversation", description: error.message, variant: "destructive" });
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

  return (
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
  );
}
