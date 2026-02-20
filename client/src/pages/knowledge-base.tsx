import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Plus,
  Send,
  MessageSquare,
  FileText,
  Trash2,
  MoreHorizontal,
  Bot,
  User,
  FolderOpen,
  Upload,
  Loader2,
  ChevronLeft,
  BookOpen,
  Search,
  Settings2,
  Sparkles,
  Lock,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface KbProject {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface KbDocument {
  id: string;
  title: string;
  sourceType: string;
  status: string;
  chunkCount: number;
  errorMessage: string | null;
  createdAt: string;
}

interface KbConversation {
  id: string;
  projectId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface KbMessage {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  mode: "KB_ONLY" | "HYBRID" | null;
  sourceChunkIds: string[] | null;
  createdAt: string;
}

interface Source {
  id: string;
  documentTitle: string;
  section?: string;
  similarity: number;
}

type AnswerMode = "KB_ONLY" | "HYBRID";

export default function KnowledgeBasePage() {
  const { toast } = useToast();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showDocDialog, setShowDocDialog] = useState(false);
  const [showDeleteProject, setShowDeleteProject] = useState<string | null>(null);
  const [showDeleteConvo, setShowDeleteConvo] = useState<string | null>(null);
  const [showEditProject, setShowEditProject] = useState<KbProject | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectDesc, setEditProjectDesc] = useState("");
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocContent, setNewDocContent] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [answerMode, setAnswerMode] = useState<AnswerMode>("HYBRID");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingSources, setStreamingSources] = useState<Source[]>([]);
  const [view, setView] = useState<"projects" | "chat">("projects");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const { data: projects = [], isLoading: loadingProjects } = useQuery<KbProject[]>({
    queryKey: ["/api/kb/projects"],
  });

  const { data: conversations = [], isLoading: loadingConvos } = useQuery<KbConversation[]>({
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

  const { data: projectDetail } = useQuery<KbProject & { documents: KbDocument[] }>({
    queryKey: ["/api/kb/projects", selectedProjectId],
    enabled: !!selectedProjectId,
  });

  const { data: messages = [], isLoading: loadingMessages } = useQuery<KbMessage[]>({
    queryKey: ["/api/kb/conversations", selectedConvoId, "messages"],
    queryFn: async () => {
      if (!selectedConvoId) return [];
      const res = await fetch(`/api/kb/conversations/${selectedConvoId}/messages`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!selectedConvoId,
  });

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/kb/projects", {
        name: newProjectName.trim(),
        description: newProjectDesc.trim() || null,
      });
      return res.json();
    },
    onSuccess: (project: KbProject) => {
      queryClient.invalidateQueries({ queryKey: ["/api/kb/projects"] });
      setShowProjectDialog(false);
      setNewProjectName("");
      setNewProjectDesc("");
      setSelectedProjectId(project.id);
      toast({ title: "Project created" });
    },
    onError: () => toast({ title: "Failed to create project", variant: "destructive" }),
  });

  const updateProjectMutation = useMutation({
    mutationFn: async () => {
      if (!showEditProject) return;
      const res = await apiRequest("PATCH", `/api/kb/projects/${showEditProject.id}`, {
        name: editProjectName.trim(),
        description: editProjectDesc.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kb/projects"] });
      setShowEditProject(null);
      toast({ title: "Project updated" });
    },
    onError: () => toast({ title: "Failed to update project", variant: "destructive" }),
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/kb/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kb/projects"] });
      if (selectedProjectId === showDeleteProject) {
        setSelectedProjectId(null);
        setSelectedConvoId(null);
      }
      setShowDeleteProject(null);
      toast({ title: "Project deleted" });
    },
    onError: () => toast({ title: "Failed to delete project", variant: "destructive" }),
  });

  const addDocMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProjectId) throw new Error("No project selected");
      const res = await apiRequest("POST", `/api/kb/projects/${selectedProjectId}/documents`, {
        title: newDocTitle.trim(),
        content: newDocContent.trim(),
        sourceType: "TEXT",
      });
      return res.json();
    },
    onSuccess: async (doc: KbDocument) => {
      await apiRequest("POST", `/api/kb/documents/${doc.id}/process`);
      queryClient.invalidateQueries({ queryKey: ["/api/kb/projects", selectedProjectId] });
      setShowDocDialog(false);
      setNewDocTitle("");
      setNewDocContent("");
      toast({ title: "Document added and processing started" });
    },
    onError: () => toast({ title: "Failed to add document", variant: "destructive" }),
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      await apiRequest("DELETE", `/api/kb/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kb/projects", selectedProjectId] });
      toast({ title: "Document deleted" });
    },
  });

  const reprocessDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      await apiRequest("POST", `/api/kb/documents/${docId}/process`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kb/projects", selectedProjectId] });
      toast({ title: "Reprocessing started" });
    },
  });

  const createConvoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/kb/conversations", {
        title: "New Chat",
        projectId: selectedProjectId,
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
  });

  const sendMessage = useCallback(async () => {
    if (!chatInput.trim() || !selectedConvoId || isStreaming) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setIsStreaming(true);
    setStreamingContent("");
    setStreamingSources([]);

    queryClient.setQueryData(
      ["/api/kb/conversations", selectedConvoId, "messages"],
      (old: KbMessage[] = []) => [
        ...old,
        {
          id: `temp-${Date.now()}`,
          role: "USER" as const,
          content: userMessage,
          mode: answerMode,
          sourceChunkIds: null,
          createdAt: new Date().toISOString(),
        },
      ]
    );

    try {
      const res = await fetch(`/api/kb/conversations/${selectedConvoId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: userMessage, mode: answerMode }),
      });

      if (!res.ok) throw new Error("Failed to send message");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              accumulated += data.content;
              setStreamingContent(accumulated);
            }
            if (data.sources) {
              setStreamingSources(data.sources);
            }
            if (data.titleUpdate) {
              queryClient.invalidateQueries({ queryKey: ["/api/kb/conversations"] });
            }
            if (data.error) {
              toast({ title: data.error, variant: "destructive" });
            }
          } catch {}
        }
      }

      queryClient.invalidateQueries({
        queryKey: ["/api/kb/conversations", selectedConvoId, "messages"],
      });
    } catch (err) {
      toast({ title: "Failed to get response", variant: "destructive" });
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  }, [chatInput, selectedConvoId, isStreaming, answerMode, toast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getDocStatusIcon = (status: string) => {
    switch (status) {
      case "READY": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "PROCESSING": return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "FAILED": return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const renderSidebar = () => (
    <div className="flex flex-col h-full border-r bg-sidebar" data-testid="kb-sidebar">
      <div className="p-3 flex items-center justify-between gap-2 border-b">
        <h2 className="font-semibold text-sm truncate">Knowledge Base</h2>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => createConvoMutation.mutate()}
                disabled={createConvoMutation.isPending}
                data-testid="btn-new-chat"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New Chat</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="p-2">
        <Select
          value={selectedProjectId || "all"}
          onValueChange={(val) => {
            setSelectedProjectId(val === "all" ? null : val);
            setSelectedConvoId(null);
          }}
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
                onClick={() => {
                  setSelectedConvoId(convo.id);
                  setView("chat");
                }}
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
                    setShowDeleteConvo(convo.id);
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
          onClick={() => {
            setView("projects");
            setSelectedConvoId(null);
          }}
          data-testid="btn-manage-projects"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Manage Projects & Documents
        </Button>
      </div>
    </div>
  );

  const renderProjectsView = () => (
    <div className="flex-1 overflow-auto p-6" data-testid="kb-projects-view">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Knowledge Base Projects</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create projects, add documents, and chat with your knowledge base
            </p>
          </div>
          <Button
            onClick={() => setShowProjectDialog(true)}
            data-testid="btn-create-project"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>

        {loadingProjects ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <Card className="p-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first knowledge base project to get started
            </p>
            <Button onClick={() => setShowProjectDialog(true)} data-testid="btn-create-project-empty">
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {projects.map(project => (
              <Card
                key={project.id}
                className={cn(
                  "p-4 cursor-pointer hover-elevate",
                  selectedProjectId === project.id && "ring-2 ring-primary"
                )}
                onClick={() => {
                  setSelectedProjectId(project.id);
                }}
                data-testid={`project-card-${project.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                      <h3 className="font-semibold truncate">{project.name}</h3>
                    </div>
                    {project.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Created {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`btn-project-menu-${project.id}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowEditProject(project);
                          setEditProjectName(project.name);
                          setEditProjectDesc(project.description || "");
                        }}
                        data-testid={`btn-edit-project-${project.id}`}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteProject(project.id);
                        }}
                        data-testid={`btn-delete-project-${project.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            ))}
          </div>
        )}

        {selectedProjectId && projectDetail && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
              <h2 className="text-lg font-semibold">
                Documents in {projectDetail.name}
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/kb/projects", selectedProjectId] });
                  }}
                  data-testid="btn-refresh-docs"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button
                  onClick={() => setShowDocDialog(true)}
                  data-testid="btn-add-document"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Add Document
                </Button>
              </div>
            </div>

            {projectDetail.documents.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No documents yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add documents to build your knowledge base
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                {projectDetail.documents.map(doc => (
                  <Card key={doc.id} className="p-3" data-testid={`doc-card-${doc.id}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {getDocStatusIcon(doc.status)}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{doc.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className="text-[10px]">
                              {doc.status}
                            </Badge>
                            {doc.chunkCount > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {doc.chunkCount} chunks
                              </span>
                            )}
                            {doc.errorMessage && (
                              <span className="text-xs text-destructive truncate max-w-48">
                                {doc.errorMessage}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {(doc.status === "FAILED" || doc.status === "UPLOADED") && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => reprocessDocMutation.mutate(doc.id)}
                                disabled={reprocessDocMutation.isPending}
                                data-testid={`btn-reprocess-${doc.id}`}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Reprocess</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteDocMutation.mutate(doc.id)}
                              disabled={deleteDocMutation.isPending}
                              data-testid={`btn-delete-doc-${doc.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderChatView = () => {
    const allMessages = [...messages];
    if (isStreaming && streamingContent) {
      allMessages.push({
        id: "streaming",
        role: "ASSISTANT",
        content: streamingContent,
        mode: answerMode,
        sourceChunkIds: null,
        createdAt: new Date().toISOString(),
      });
    }

    return (
      <div className="flex-1 flex flex-col h-full" data-testid="kb-chat-view">
        <div className="flex items-center justify-between p-3 border-b gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              size="icon"
              variant="ghost"
              className="md:hidden"
              onClick={() => setSelectedConvoId(null)}
              data-testid="btn-back-to-convos"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Bot className="h-5 w-5 text-primary shrink-0" />
            <span className="font-semibold text-sm truncate">
              {conversations.find(c => c.id === selectedConvoId)?.title || "AI Assistant"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Select value={answerMode} onValueChange={(v) => setAnswerMode(v as AnswerMode)}>
              <SelectTrigger className="h-8 w-36 text-xs" data-testid="select-answer-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KB_ONLY">
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-3 w-3" />
                    KB Only
                  </div>
                </SelectItem>
                <SelectItem value="HYBRID">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    Hybrid
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          {allMessages.length === 0 && !isStreaming ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Ask me anything</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {selectedProjectId
                  ? "Ask questions about your knowledge base documents. I'll search for relevant information and provide answers."
                  : "Select a project to search its documents, or ask general questions."}
              </p>
              <div className="flex items-center gap-2 mt-4">
                <Badge variant="secondary">
                  <Lock className="h-3 w-3 mr-1" />
                  KB Only: Answers from documents only
                </Badge>
                <Badge variant="secondary">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Hybrid: Documents + AI knowledge
                </Badge>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {allMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn("flex gap-3", msg.role === "USER" ? "justify-end" : "justify-start")}
                  data-testid={`message-${msg.id}`}
                >
                  {msg.role !== "USER" && (
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        AI
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      "rounded-lg px-4 py-3 max-w-[80%] text-sm",
                      msg.role === "USER"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <div className="whitespace-pre-wrap break-words leading-relaxed">
                      {renderMarkdown(msg.content)}
                    </div>
                    {msg.id === "streaming" && (
                      <span className="inline-block w-2 h-4 bg-current animate-pulse ml-0.5" />
                    )}
                  </div>
                  {msg.role === "USER" && (
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              {streamingSources.length > 0 && (
                <div className="flex items-start gap-3" data-testid="sources-panel">
                  <div className="w-8" />
                  <div className="bg-muted/50 rounded-lg px-4 py-3 text-xs max-w-[80%]">
                    <p className="font-semibold mb-2 text-muted-foreground">Sources</p>
                    <div className="space-y-1">
                      {streamingSources.map((s, i) => (
                        <div key={s.id} className="flex items-center gap-2">
                          <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{s.documentTitle}</span>
                          {s.section && (
                            <span className="text-muted-foreground truncate">
                              &gt; {s.section}
                            </span>
                          )}
                          <Badge variant="outline" className="ml-auto text-[10px] shrink-0">
                            {s.similarity}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t">
          <div className="max-w-3xl mx-auto flex gap-2">
            <Textarea
              ref={chatInputRef}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                answerMode === "KB_ONLY"
                  ? "Ask about your documents..."
                  : "Ask anything..."
              }
              className="resize-none min-h-[44px] max-h-32"
              rows={1}
              disabled={isStreaming}
              data-testid="input-chat-message"
            />
            <Button
              onClick={sendMessage}
              disabled={!chatInput.trim() || isStreaming}
              data-testid="btn-send-message"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full" data-testid="knowledge-base-page">
      <div className="w-64 shrink-0 hidden md:flex flex-col">
        {renderSidebar()}
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {view === "projects" && !selectedConvoId ? renderProjectsView() : renderChatView()}
      </div>

      <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Knowledge Base Project</DialogTitle>
            <DialogDescription>
              Group documents together in a project for focused Q&A
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Project Name</label>
              <Input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g., Safety Procedures, Project Standards"
                data-testid="input-project-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Textarea
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
                placeholder="What is this project about?"
                rows={3}
                data-testid="input-project-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProjectDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createProjectMutation.mutate()}
              disabled={!newProjectName.trim() || createProjectMutation.isPending}
              data-testid="btn-confirm-create-project"
            >
              {createProjectMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showEditProject} onOpenChange={(open) => !open && setShowEditProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update the project name and description</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Project Name</label>
              <Input
                value={editProjectName}
                onChange={(e) => setEditProjectName(e.target.value)}
                data-testid="input-edit-project-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={editProjectDesc}
                onChange={(e) => setEditProjectDesc(e.target.value)}
                rows={3}
                data-testid="input-edit-project-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditProject(null)}>Cancel</Button>
            <Button
              onClick={() => updateProjectMutation.mutate()}
              disabled={!editProjectName.trim() || updateProjectMutation.isPending}
              data-testid="btn-confirm-edit-project"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDocDialog} onOpenChange={setShowDocDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Document</DialogTitle>
            <DialogDescription>
              Paste text content to add to your knowledge base. The system will automatically chunk and index it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Document Title</label>
              <Input
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                placeholder="e.g., Safety Manual 2024"
                data-testid="input-doc-title"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Content</label>
              <Textarea
                value={newDocContent}
                onChange={(e) => setNewDocContent(e.target.value)}
                placeholder="Paste your document content here..."
                rows={12}
                className="font-mono text-xs"
                data-testid="input-doc-content"
              />
              {newDocContent && (
                <p className="text-xs text-muted-foreground mt-1">
                  ~{Math.ceil(newDocContent.length / 3.5)} tokens
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDocDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addDocMutation.mutate()}
              disabled={!newDocTitle.trim() || !newDocContent.trim() || addDocMutation.isPending}
              data-testid="btn-confirm-add-doc"
            >
              {addDocMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Add & Process
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!showDeleteProject} onOpenChange={(open) => !open && setShowDeleteProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project, all its documents, chunks, and conversations. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showDeleteProject && deleteProjectMutation.mutate(showDeleteProject)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1');
}
