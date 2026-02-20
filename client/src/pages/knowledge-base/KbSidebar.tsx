import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus,
  MessageSquare,
  Trash2,
  Loader2,
  Settings2,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { KbProject, KbConversation } from "./types";

interface KbSidebarProps {
  projects: KbProject[];
  conversations: KbConversation[];
  loadingConvos: boolean;
  selectedProjectId: string | null;
  selectedConvoId: string | null;
  onSelectProject: (projectId: string | null) => void;
  onSelectConvo: (convoId: string) => void;
  onDeleteConvo: (convoId: string) => void;
  onNewChat: () => void;
  onShowProjects: () => void;
  newChatPending: boolean;
}

export function KbSidebar({
  projects,
  conversations,
  loadingConvos,
  selectedProjectId,
  selectedConvoId,
  onSelectProject,
  onSelectConvo,
  onDeleteConvo,
  onNewChat,
  onShowProjects,
  newChatPending,
}: KbSidebarProps) {
  return (
    <div className="flex flex-col h-full border-r bg-sidebar" data-testid="kb-sidebar">
      <div className="p-3 flex items-center justify-between gap-2 border-b">
        <h2 className="font-semibold text-sm truncate">Knowledge Base</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              onClick={onNewChat}
              disabled={newChatPending}
              data-testid="btn-new-chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Chat</TooltipContent>
        </Tooltip>
      </div>

      <div className="p-2">
        <Select
          value={selectedProjectId || "all"}
          onValueChange={(val) => onSelectProject(val === "all" ? null : val)}
        >
          <SelectTrigger className="h-8 text-xs" data-testid="select-project-filter">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {loadingConvos ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No conversations yet</p>
              <p className="text-xs mt-1">Start a new chat</p>
            </div>
          ) : (
            conversations.map(convo => (
              <div
                key={convo.id}
                className={cn(
                  "group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm",
                  selectedConvoId === convo.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover-elevate"
                )}
                onClick={() => onSelectConvo(convo.id)}
                data-testid={`convo-item-${convo.id}`}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="truncate flex-1">{convo.title}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0 invisible group-hover:visible"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConvo(convo.id);
                  }}
                  data-testid={`btn-delete-convo-${convo.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <Separator />

      <div className="p-2">
        <Button
          variant="ghost"
          className="w-full justify-start text-xs gap-2"
          onClick={onShowProjects}
          data-testid="btn-manage-projects"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Manage Projects & Documents
        </Button>
      </div>
    </div>
  );
}
