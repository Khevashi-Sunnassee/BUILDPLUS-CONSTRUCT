import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus,
  FolderOpen,
  Trash2,
  MoreHorizontal,
  Upload,
  Loader2,
  BookOpen,
  RefreshCw,
  Pencil,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { KbUploadDialog } from "./KbUploadDialog";
import type { KbProject, KbDocument } from "./types";

interface KbProjectsProps {
  projects: KbProject[];
  loadingProjects: boolean;
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onStartChat: (projectId: string | null) => void;
}

export function KbProjects({
  projects,
  loadingProjects,
  selectedProjectId,
  onSelectProject,
  onStartChat,
}: KbProjectsProps) {
  const { toast } = useToast();
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showDeleteProject, setShowDeleteProject] = useState<string | null>(null);
  const [showEditProject, setShowEditProject] = useState<KbProject | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectDesc, setEditProjectDesc] = useState("");

  const { data: projectDetail } = useQuery<KbProject & { documents: KbDocument[] }>({
    queryKey: ["/api/kb/projects", selectedProjectId],
    enabled: !!selectedProjectId,
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
      onSelectProject(project.id);
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
      setShowDeleteProject(null);
      toast({ title: "Project deleted" });
    },
    onError: () => toast({ title: "Failed to delete project", variant: "destructive" }),
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

  const getDocStatusIcon = (status: string) => {
    switch (status) {
      case "READY": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "PROCESSING": return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "FAILED": return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6" data-testid="kb-projects-view">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Knowledge Base</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your projects and documents, then chat with your knowledge base
            </p>
          </div>
          <Button onClick={() => setShowProjectDialog(true)} data-testid="btn-create-project">
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
                  "p-4 cursor-pointer transition-all",
                  selectedProjectId === project.id
                    ? "ring-2 ring-primary shadow-md"
                    : "hover:shadow-sm"
                )}
                onClick={() => onSelectProject(project.id)}
                data-testid={`project-card-${project.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                      <h3 className="font-semibold truncate">{project.name}</h3>
                    </div>
                    {project.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <p className="text-xs text-muted-foreground">
                        Created {new Date(project.createdAt).toLocaleDateString()}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs gap-1"
                        onClick={(e) => { e.stopPropagation(); onStartChat(project.id); }}
                        data-testid={`btn-chat-project-${project.id}`}
                      >
                        <MessageSquare className="h-3 w-3" />
                        Chat
                      </Button>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" onClick={(e) => e.stopPropagation()} data-testid={`btn-project-menu-${project.id}`}>
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
                        onClick={(e) => { e.stopPropagation(); setShowDeleteProject(project.id); }}
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
              <h2 className="text-lg font-semibold">Documents in {projectDetail.name}</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/kb/projects", selectedProjectId] })}
                  data-testid="btn-refresh-docs"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowUploadDialog(true)}
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
                <p className="text-xs text-muted-foreground mt-1">Add documents to build your knowledge base</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setShowUploadDialog(true)}
                  data-testid="btn-add-first-doc"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Add Document
                </Button>
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
                            <Badge variant="secondary" className="text-[10px]">{doc.status}</Badge>
                            <Badge variant="outline" className="text-[10px]">{doc.sourceType}</Badge>
                            {doc.chunkCount > 0 && (
                              <span className="text-xs text-muted-foreground">{doc.chunkCount} chunks</span>
                            )}
                            {doc.errorMessage && (
                              <span className="text-xs text-destructive truncate max-w-48">{doc.errorMessage}</span>
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

      <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Knowledge Base Project</DialogTitle>
            <DialogDescription>Group documents together in a project for focused Q&A</DialogDescription>
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
            <Button variant="outline" onClick={() => setShowProjectDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createProjectMutation.mutate()}
              disabled={!newProjectName.trim() || createProjectMutation.isPending}
              data-testid="btn-confirm-create-project"
            >
              {createProjectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
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
              <Input value={editProjectName} onChange={(e) => setEditProjectName(e.target.value)} data-testid="input-edit-project-name" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={editProjectDesc} onChange={(e) => setEditProjectDesc(e.target.value)} rows={3} data-testid="input-edit-project-description" />
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

      {selectedProjectId && projectDetail && (
        <KbUploadDialog
          open={showUploadDialog}
          onOpenChange={setShowUploadDialog}
          projectId={selectedProjectId}
          projectName={projectDetail.name}
        />
      )}

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
    </div>
  );
}
