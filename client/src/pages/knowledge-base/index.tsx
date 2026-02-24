import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { KbSidebar } from "./KbSidebar";
import { KbChat } from "./KbChat";
import { KbProjects } from "./KbProjects";
import type { KbProject, KbConversation } from "./types";

export default function KnowledgeBasePage() {
  useDocumentTitle("Knowledge Base");
  const { toast } = useToast();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);
  const [view, setView] = useState<"projects" | "chat">("chat");
  const [showDeleteConvo, setShowDeleteConvo] = useState<string | null>(null);

  const { data: projects = [], isLoading: loadingProjects } = useQuery<KbProject[]>({
    queryKey: ["/api/kb/projects"],
  });

  const { data: conversationsResponse, isLoading: loadingConvos } = useQuery<{ data: KbConversation[]; pagination: { page: number; total: number; totalPages: number } }>({
    queryKey: ["/api/kb/conversations", selectedProjectId],
    queryFn: async () => {
      const url = selectedProjectId
        ? `/api/kb/conversations?projectId=${selectedProjectId}`
        : "/api/kb/conversations";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
  });
  const conversations = conversationsResponse?.data ?? [];

  const createConvoMutation = useMutation({
    mutationFn: async (projectId?: string | null) => {
      const res = await apiRequest("POST", "/api/kb/conversations", {
        title: "New Chat",
        projectId: projectId !== undefined ? projectId : selectedProjectId,
      });
      return res.json();
    },
    onSuccess: (convo: KbConversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/kb/conversations"] });
      setSelectedConvoId(convo.id);
      setView("chat");
    },
    onError: () => toast({ title: "Failed to create conversation", variant: "destructive" }),
  });

  const deleteConvoMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/kb/conversations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kb/conversations"] });
      if (selectedConvoId === showDeleteConvo) setSelectedConvoId(null);
      setShowDeleteConvo(null);
      toast({ title: "Conversation deleted" });
    },
    onError: () => toast({ title: "Failed to delete conversation", variant: "destructive" }),
  });

  const handleNewChat = () => {
    createConvoMutation.mutate(undefined);
  };

  const handleSelectConvo = (convoId: string) => {
    setSelectedConvoId(convoId);
    setView("chat");
  };

  const handleSelectProject = (projectId: string | null) => {
    setSelectedProjectId(projectId);
    setSelectedConvoId(null);
  };

  const handleStartChat = (projectId: string | null) => {
    setSelectedProjectId(projectId);
    createConvoMutation.mutate(projectId);
  };

  return (
    <div className="flex h-full" role="main" aria-label="Knowledge Base" data-testid="knowledge-base-page">
      <div className="w-64 shrink-0 hidden md:flex flex-col">
        <KbSidebar
          projects={projects}
          conversations={conversations}
          loadingConvos={loadingConvos}
          selectedProjectId={selectedProjectId}
          selectedConvoId={selectedConvoId}
          onSelectProject={handleSelectProject}
          onSelectConvo={handleSelectConvo}
          onDeleteConvo={(id) => setShowDeleteConvo(id)}
          onNewChat={handleNewChat}
          onShowProjects={() => { setView("projects"); setSelectedConvoId(null); }}
          newChatPending={createConvoMutation.isPending}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {view === "projects" && !selectedConvoId ? (
          <KbProjects
            projects={projects}
            loadingProjects={loadingProjects}
            selectedProjectId={selectedProjectId}
            onSelectProject={(id) => setSelectedProjectId(id)}
            onStartChat={handleStartChat}
          />
        ) : (
          <KbChat
            selectedConvoId={selectedConvoId}
            conversations={conversations}
            selectedProjectId={selectedProjectId}
            onBack={() => setSelectedConvoId(null)}
            onDeleteConvo={(id) => setShowDeleteConvo(id)}
          />
        )}
      </div>

      <AlertDialog open={!!showDeleteConvo} onOpenChange={(open) => !open && setShowDeleteConvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showDeleteConvo && deleteConvoMutation.mutate(showDeleteConvo)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
