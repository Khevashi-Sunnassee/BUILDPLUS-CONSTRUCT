import { useState, useEffect } from "react";
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
  Users,
  UserPlus,
  X,
  Shield,
  Eye,
  Edit3,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { KbUploadDialog } from "./KbUploadDialog";
import type { KbProject, KbProjectDetail, KbMember, KbCompanyUser } from "./types";

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
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newProjectInstructions, setNewProjectInstructions] = useState("");
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectDesc, setEditProjectDesc] = useState("");
  const [editProjectInstructions, setEditProjectInstructions] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("EDITOR");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");

  const { data: projectDetail } = useQuery<KbProjectDetail>({
    queryKey: ["/api/kb/projects", selectedProjectId],
    enabled: !!selectedProjectId,
  });

  useEffect(() => {
    if (projectDetail?.instructions !== undefined) {
      setEditProjectInstructions(projectDetail.instructions || "");
    }
  }, [projectDetail?.instructions]);

  const { data: companyUsers = [] } = useQuery<KbCompanyUser[]>({
    queryKey: ["/api/kb/company-users"],
  });

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/kb/projects", {
        name: newProjectName.trim(),
        description: newProjectDesc.trim() || null,
        instructions: newProjectInstructions.trim() || null,
      });
      return res.json();
    },
    onSuccess: (project: KbProject) => {
      queryClient.invalidateQueries({ queryKey: ["/api/kb/projects"] });
      setShowProjectDialog(false);
      setNewProjectName("");
      setNewProjectDesc("");
      setNewProjectInstructions("");
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
        instructions: editProjectInstructions.trim() || null,
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

  const addMembersMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProjectId || selectedUserIds.length === 0) return;
      const res = await apiRequest("POST", `/api/kb/projects/${selectedProjectId}/members`, {
        userIds: selectedUserIds,
        role: inviteRole,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/kb/projects", selectedProjectId] });
      setShowInviteDialog(false);
      setSelectedUserIds([]);
      setUserSearch("");
      toast({ title: `${data?.added || 0} member(s) added` });
    },
    onError: () => toast({ title: "Failed to add members", variant: "destructive" }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      if (!selectedProjectId) return;
      await apiRequest("DELETE", `/api/kb/projects/${selectedProjectId}/members/${memberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kb/projects", selectedProjectId] });
      toast({ title: "Member removed" });
    },
    onError: () => toast({ title: "Failed to remove member", variant: "destructive" }),
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      if (!selectedProjectId) return;
      await apiRequest("PATCH", `/api/kb/projects/${selectedProjectId}/members/${memberId}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kb/projects", selectedProjectId] });
      toast({ title: "Role updated" });
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

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "OWNER": return <Crown className="h-3.5 w-3.5" />;
      case "EDITOR": return <Edit3 className="h-3.5 w-3.5" />;
      default: return <Eye className="h-3.5 w-3.5" />;
    }
  };

  const filteredUsers = companyUsers.filter(u => {
    if (selectedUserIds.includes(u.id)) return false;
    if (projectDetail?.members?.some(m => m.userId === u.id)) return false;
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const isOwner = projectDetail?.userRole === "OWNER";
  const canEdit = isOwner || projectDetail?.userRole === "EDITOR";

  return (
    <div className="flex-1 overflow-auto p-6" data-testid="kb-projects-view">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Knowledge Base</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your projects, documents, and team access
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
                          setEditProjectInstructions(project.instructions || "");
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
            <Tabs defaultValue="documents">
              <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
                <h2 className="text-lg font-semibold">{projectDetail.name}</h2>
                <TabsList>
                  <TabsTrigger value="documents" data-testid="tab-documents">
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                    Documents
                  </TabsTrigger>
                  <TabsTrigger value="members" data-testid="tab-members">
                    <Users className="h-3.5 w-3.5 mr-1.5" />
                    Members
                    {projectDetail.members?.length > 0 && (
                      <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{projectDetail.members.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="settings" data-testid="tab-settings">
                    <Shield className="h-3.5 w-3.5 mr-1.5" />
                    Settings
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="documents">
                <div className="flex items-center justify-end mb-4 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/kb/projects", selectedProjectId] })}
                    data-testid="btn-refresh-docs"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  {canEdit && (
                    <Button
                      size="sm"
                      onClick={() => setShowUploadDialog(true)}
                      data-testid="btn-add-document"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Add Document
                    </Button>
                  )}
                </div>

                {projectDetail.documents.length === 0 ? (
                  <Card className="p-8 text-center">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No documents yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Add documents to build your knowledge base</p>
                    {canEdit && (
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => setShowUploadDialog(true)}
                        data-testid="btn-add-first-doc"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Add Document
                      </Button>
                    )}
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
                          {canEdit && (
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
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="members">
                <div className="space-y-4">
                  {canEdit && (
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => setShowInviteDialog(true)}
                        data-testid="btn-invite-members"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Members
                      </Button>
                    </div>
                  )}

                  {(!projectDetail.members || projectDetail.members.length === 0) ? (
                    <Card className="p-8 text-center">
                      <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">No members yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Add team members to share this project and its conversations
                      </p>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {projectDetail.members.map(member => (
                        <Card key={member.id} className="p-3" data-testid={`member-card-${member.id}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <Avatar className="h-8 w-8 shrink-0">
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                  {member.userName?.charAt(0)?.toUpperCase() || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm truncate">{member.userName}</p>
                                <p className="text-xs text-muted-foreground truncate">{member.userEmail}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant={member.role === "OWNER" ? "default" : "secondary"} className="text-[10px] gap-1">
                                {getRoleIcon(member.role)}
                                {member.role}
                              </Badge>
                              {member.status === "INVITED" && (
                                <Badge variant="outline" className="text-[10px]">Pending</Badge>
                              )}
                              {isOwner && member.role !== "OWNER" && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" data-testid={`btn-member-menu-${member.id}`}>
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => updateMemberRoleMutation.mutate({
                                        memberId: member.id,
                                        role: member.role === "EDITOR" ? "VIEWER" : "EDITOR",
                                      })}
                                    >
                                      {member.role === "EDITOR" ? (
                                        <><Eye className="h-4 w-4 mr-2" /> Change to Viewer</>
                                      ) : (
                                        <><Edit3 className="h-4 w-4 mr-2" /> Change to Editor</>
                                      )}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => removeMemberMutation.mutate(member.id)}
                                    >
                                      <X className="h-4 w-4 mr-2" />
                                      Remove
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="settings">
                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-3">Project Instructions</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Custom instructions that apply to all conversations in this project.
                    The AI will follow these guidelines when responding.
                  </p>
                  {canEdit ? (
                    <div className="space-y-3">
                      <Textarea
                        value={editProjectInstructions}
                        onChange={(e) => setEditProjectInstructions(e.target.value)}
                        placeholder="e.g., Always respond with references to Australian building standards. Focus on safety compliance..."
                        rows={5}
                        data-testid="input-project-instructions"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!selectedProjectId) return;
                          apiRequest("PATCH", `/api/kb/projects/${selectedProjectId}`, {
                            instructions: editProjectInstructions.trim() || null,
                          }).then(() => {
                            queryClient.invalidateQueries({ queryKey: ["/api/kb/projects", selectedProjectId] });
                            toast({ title: "Instructions saved" });
                          });
                        }}
                        data-testid="btn-save-instructions"
                      >
                        Save Instructions
                      </Button>
                    </div>
                  ) : (
                    <div className="bg-muted/50 rounded-md p-3 text-sm">
                      {projectDetail.instructions || "No custom instructions set."}
                    </div>
                  )}
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Knowledge Base Project</DialogTitle>
            <DialogDescription>Group documents and conversations in a shared project</DialogDescription>
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
                rows={2}
                data-testid="input-project-description"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Instructions (optional)</label>
              <p className="text-xs text-muted-foreground mb-1">Custom guidelines the AI should follow in this project</p>
              <Textarea
                value={newProjectInstructions}
                onChange={(e) => setNewProjectInstructions(e.target.value)}
                placeholder="e.g., Always cite building codes. Focus on NSW regulations..."
                rows={3}
                data-testid="input-project-instructions-create"
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
            <DialogDescription>Update the project details and instructions</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Project Name</label>
              <Input value={editProjectName} onChange={(e) => setEditProjectName(e.target.value)} data-testid="input-edit-project-name" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={editProjectDesc} onChange={(e) => setEditProjectDesc(e.target.value)} rows={2} data-testid="input-edit-project-description" />
            </div>
            <div>
              <label className="text-sm font-medium">Instructions</label>
              <Textarea
                value={editProjectInstructions}
                onChange={(e) => setEditProjectInstructions(e.target.value)}
                placeholder="Custom AI instructions for this project..."
                rows={3}
                data-testid="input-edit-project-instructions"
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

      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Members</DialogTitle>
            <DialogDescription>
              Invite team members to this project. They will be able to see all documents and conversations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Role</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger data-testid="select-invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EDITOR">Editor - can add documents and chat</SelectItem>
                  <SelectItem value="VIEWER">Viewer - can view and chat only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Search Users</label>
              <Input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by name or email..."
                data-testid="input-search-users"
              />
            </div>

            {selectedUserIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedUserIds.map(uid => {
                  const user = companyUsers.find(u => u.id === uid);
                  return (
                    <Badge key={uid} variant="secondary" className="gap-1 pr-1">
                      {user?.name || uid}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-4 w-4 rounded-full"
                        onClick={() => setSelectedUserIds(ids => ids.filter(id => id !== uid))}
                      >
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </Badge>
                  );
                })}
              </div>
            )}

            <ScrollArea className="h-48 border rounded-md">
              <div className="p-2 space-y-1">
                {filteredUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No users available</p>
                ) : (
                  filteredUsers.slice(0, 50).map(user => (
                    <div
                      key={user.id}
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                      onClick={() => setSelectedUserIds(ids => [...ids, user.id])}
                      data-testid={`user-option-${user.id}`}
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px]">{user.name?.charAt(0)?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
            <Button
              onClick={() => addMembersMutation.mutate()}
              disabled={selectedUserIds.length === 0 || addMembersMutation.isPending}
              data-testid="btn-confirm-invite"
            >
              {addMembersMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add {selectedUserIds.length} Member{selectedUserIds.length !== 1 ? "s" : ""}
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
