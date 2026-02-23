import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus,
  MessageSquare,
  Trash2,
  Loader2,
  Settings2,
  Users,
  Mail,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import type { KbProject, KbConversation, KbInvitation } from "./types";

const DEFAULT_PROJECT_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6",
  "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#06b6d4",
];

function getProjectColor(project: KbProject, index: number): string {
  return project.color || DEFAULT_PROJECT_COLORS[index % DEFAULT_PROJECT_COLORS.length];
}

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
  const { toast } = useToast();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 500);
  const isSearchActive = debouncedSearch.trim().length >= 3;

  const { data: searchResults, isLoading: searchLoading } = useQuery<any[]>({
    queryKey: ["/api/kb/search", debouncedSearch, selectedProjectId],
    queryFn: async () => {
      const res = await fetch("/api/kb/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          query: debouncedSearch.trim(),
          projectId: selectedProjectId,
          topK: 8,
        }),
      });
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: isSearchActive,
    staleTime: 60000,
  });

  const { data: invitations = [] } = useQuery<KbInvitation[]>({
    queryKey: ["/api/kb/invitations"],
    queryFn: async () => {
      const res = await fetch("/api/kb/invitations", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return [
        ...(data.projectInvites || []),
        ...(data.conversationInvites || []),
      ];
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (inv: KbInvitation) => {
      await apiRequest("POST", `/api/kb/invitations/${inv.id}/accept`, { type: inv.type });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kb/invitations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kb/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kb/conversations"] });
      toast({ title: "Invitation accepted" });
    },
  });

  const declineMutation = useMutation({
    mutationFn: async (inv: KbInvitation) => {
      await apiRequest("POST", `/api/kb/invitations/${inv.id}/decline`, { type: inv.type });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kb/invitations"] });
      toast({ title: "Invitation declined" });
    },
  });

  const pendingInvites = invitations.filter(inv => inv.status === "INVITED");

  const groupedConversations = useMemo(() => {
    const projectMap = new Map<string, KbProject>();
    projects.forEach(p => projectMap.set(p.id, p));

    const groups: { projectId: string | null; project: KbProject | null; convos: KbConversation[] }[] = [];
    const byProject = new Map<string | null, KbConversation[]>();

    conversations.forEach(c => {
      const key = c.projectId || null;
      if (!byProject.has(key)) byProject.set(key, []);
      byProject.get(key)!.push(c);
    });

    projects.forEach(p => {
      const convos = byProject.get(p.id) || [];
      if (convos.length > 0 || selectedProjectId === p.id) {
        groups.push({ projectId: p.id, project: p, convos });
      }
    });

    const ungrouped = byProject.get(null);
    if (ungrouped && ungrouped.length > 0) {
      groups.push({ projectId: null, project: null, convos: ungrouped });
    }

    return groups;
  }, [conversations, projects, selectedProjectId]);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const renderConvoItem = (convo: KbConversation) => (
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
  );

  const shouldShowGrouped = groupedConversations.length > 1 ||
    (groupedConversations.length === 1 && groupedConversations[0].projectId !== null);

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

      <div className="px-3 pt-2 pb-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search knowledge base..."
            className="h-8 pl-8 text-xs"
            data-testid="input-kb-search"
          />
        </div>
        {searchQuery.trim().length > 0 && searchQuery.trim().length < 3 && (
          <p className="text-[10px] text-muted-foreground mt-1" data-testid="text-kb-search-hint">
            Type at least 3 characters to search
          </p>
        )}
      </div>

      {isSearchActive && (
        <div className="px-2 pb-1">
          <Separator className="mb-1" />
          <div className="flex items-center gap-1.5 px-2 mb-1">
            <Search className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">Search Results</span>
          </div>
          {searchLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : searchResults && searchResults.length > 0 ? (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {searchResults.map((result: any, idx: number) => (
                <div
                  key={result.id || idx}
                  className="rounded-md border p-2 bg-muted/30 text-xs"
                  data-testid={`kb-search-result-${idx}`}
                >
                  <p className="font-medium truncate">{result.documentTitle || result.title || "Document"}</p>
                  {result.section && (
                    <p className="text-[10px] text-muted-foreground truncate">{result.section}</p>
                  )}
                  {result.similarity != null && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1 mt-1">
                      {typeof result.similarity === "number" ? `${Math.round(result.similarity * 100)}%` : result.similarity}
                    </Badge>
                  )}
                  {result.content && (
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{result.content}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">No results found</p>
          )}
          <Separator className="mt-1" />
        </div>
      )}

      {pendingInvites.length > 0 && (
        <div className="px-2 pt-2 pb-1">
          <div className="flex items-center gap-1.5 px-2 mb-1">
            <Mail className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">Invitations</span>
            <Badge variant="destructive" className="text-[9px] h-4 px-1 ml-auto">{pendingInvites.length}</Badge>
          </div>
          {pendingInvites.map(inv => (
            <div key={inv.id} className="rounded-md border p-2 mb-1 bg-muted/30" data-testid={`invitation-${inv.id}`}>
              <p className="text-xs font-medium truncate">
                {inv.type === "project" ? inv.projectName : inv.conversationTitle}
              </p>
              <p className="text-[10px] text-muted-foreground mb-1.5">
                {inv.type === "project" ? "Project" : "Conversation"} - {inv.role}
              </p>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="default"
                  className="h-6 text-[10px] flex-1"
                  onClick={() => acceptMutation.mutate(inv)}
                  disabled={acceptMutation.isPending}
                  data-testid={`btn-accept-invite-${inv.id}`}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] flex-1"
                  onClick={() => declineMutation.mutate(inv)}
                  disabled={declineMutation.isPending}
                  data-testid={`btn-decline-invite-${inv.id}`}
                >
                  <X className="h-3 w-3 mr-1" />
                  Decline
                </Button>
              </div>
            </div>
          ))}
          <Separator className="mt-1" />
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
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
          ) : shouldShowGrouped ? (
            groupedConversations.map((group, groupIdx) => {
              const groupKey = group.projectId || "_ungrouped";
              const isCollapsed = !!collapsedGroups[groupKey];
              const color = group.project
                ? getProjectColor(group.project, groupIdx)
                : "#6b7280";

              return (
                <div key={groupKey} className="mb-1" data-testid={`convo-group-${groupKey}`}>
                  <div
                    className="group/topic flex items-center gap-1 px-2 py-1.5 rounded-md hover-elevate"
                    style={{ backgroundColor: `${color}20`, borderLeft: `3px solid ${color}` }}
                  >
                    <button
                      onClick={() => toggleGroup(groupKey)}
                      className="shrink-0 p-0.5"
                      data-testid={`btn-toggle-group-${groupKey}`}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                    <FolderOpen className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                    <button
                      onClick={() => toggleGroup(groupKey)}
                      className="text-xs font-semibold uppercase tracking-wider truncate flex-1 text-left"
                      style={{ color }}
                    >
                      {group.project?.name || "Unassigned"}
                    </button>
                    <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-auto shrink-0">
                      {group.convos.length}
                    </Badge>
                  </div>
                  {!isCollapsed && (
                    <div className="ml-2 pl-1 mt-0.5 space-y-0.5" style={{ borderLeft: `2px solid ${color}40` }}>
                      {group.convos.map(c => renderConvoItem(c))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            conversations.map(convo => renderConvoItem(convo))
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
