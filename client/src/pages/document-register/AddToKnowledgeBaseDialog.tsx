import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, BookOpen, FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { DOCUMENT_ROUTES } from "@shared/api-routes";
import type { DocumentWithDetails } from "./types";

interface KbProject {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

interface AddToKnowledgeBaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DocumentWithDetails | null;
}

export function AddToKnowledgeBaseDialog({
  open,
  onOpenChange,
  document,
}: AddToKnowledgeBaseDialogProps) {
  const { toast } = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const { data: projects = [], isLoading: loadingProjects } = useQuery<KbProject[]>({
    queryKey: ["/api/kb/projects"],
    enabled: open,
  });

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/kb/projects", {
        name: newProjectName.trim(),
      });
      return res.json();
    },
    onSuccess: (project: KbProject) => {
      queryClient.invalidateQueries({ queryKey: ["/api/kb/projects"] });
      setSelectedProjectId(project.id);
      setShowNewProject(false);
      setNewProjectName("");
      toast({ title: "Project created" });
    },
    onError: () => toast({ title: "Failed to create project", variant: "destructive" }),
  });

  const addToKbMutation = useMutation({
    mutationFn: async () => {
      if (!document) throw new Error("No document selected");
      const res = await apiRequest("POST", DOCUMENT_ROUTES.ADD_TO_KB(document.id), {
        projectId: selectedProjectId,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Added to Knowledge Base", description: "Document is being processed and chunked for the Knowledge Base." });
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.LIST] });
      onOpenChange(false);
      setSelectedProjectId("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!selectedProjectId) {
      toast({ title: "Please select a project", variant: "destructive" });
      return;
    }
    addToKbMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-add-to-kb">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-violet-500" />
            Add to Knowledge Base
          </DialogTitle>
          <DialogDescription>
            Add this document to a Knowledge Base project. Text content will be automatically chunked and indexed for AI search.
          </DialogDescription>
        </DialogHeader>

        {document && (
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <p className="font-medium">{document.title}</p>
            <p className="text-muted-foreground text-xs mt-1">{document.originalName}</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Knowledge Base Project</Label>
            {loadingProjects ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading projects...
              </div>
            ) : (
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger data-testid="select-kb-project">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-3.5 w-3.5" />
                        {p.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {!showNewProject ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setShowNewProject(true)}
              data-testid="button-new-kb-project"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Create New Project
            </Button>
          ) : (
            <div className="space-y-2 border rounded-md p-3">
              <Label className="text-xs">New Project Name</Label>
              <div className="flex gap-2">
                <Input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Enter project name"
                  data-testid="input-new-kb-project-name"
                />
                <Button
                  size="sm"
                  onClick={() => createProjectMutation.mutate()}
                  disabled={!newProjectName.trim() || createProjectMutation.isPending}
                  data-testid="button-create-kb-project"
                >
                  {createProjectMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Create"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-add-kb">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedProjectId || addToKbMutation.isPending}
            data-testid="button-confirm-add-kb"
          >
            {addToKbMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <BookOpen className="h-4 w-4 mr-2" />
                Add to Knowledge Base
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
