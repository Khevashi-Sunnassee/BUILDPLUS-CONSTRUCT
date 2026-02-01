import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FolderOpen,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
  MapPin,
  Building,
  Hash,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import type { Project, MappingRule } from "@shared/schema";

const projectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  client: z.string().optional(),
  address: z.string().optional(),
});

const mappingRuleSchema = z.object({
  pathContains: z.string().min(1, "Path pattern is required"),
  priority: z.number().int().min(1).max(1000),
});

type ProjectFormData = z.infer<typeof projectSchema>;
type MappingRuleFormData = z.infer<typeof mappingRuleSchema>;

interface ProjectWithRules extends Project {
  mappingRules?: MappingRule[];
}

export default function AdminProjectsPage() {
  const { toast } = useToast();
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  const { data: projects, isLoading } = useQuery<ProjectWithRules[]>({
    queryKey: ["/api/admin/projects"],
  });

  const projectForm = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      code: "",
      client: "",
      address: "",
    },
  });

  const ruleForm = useForm<MappingRuleFormData>({
    resolver: zodResolver(mappingRuleSchema),
    defaultValues: {
      pathContains: "",
      priority: 100,
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      return apiRequest("POST", "/api/admin/projects", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      toast({ title: "Project created successfully" });
      setProjectDialogOpen(false);
      projectForm.reset();
    },
    onError: () => {
      toast({ title: "Failed to create project", variant: "destructive" });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProjectFormData }) => {
      return apiRequest("PUT", `/api/admin/projects/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      toast({ title: "Project updated successfully" });
      setProjectDialogOpen(false);
      setEditingProject(null);
      projectForm.reset();
    },
    onError: () => {
      toast({ title: "Failed to update project", variant: "destructive" });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/projects/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      toast({ title: "Project deleted" });
      setDeleteDialogOpen(false);
      setDeletingProjectId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete project", variant: "destructive" });
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: async ({ projectId, data }: { projectId: string; data: MappingRuleFormData }) => {
      return apiRequest("POST", `/api/admin/projects/${projectId}/rules`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      toast({ title: "Mapping rule created" });
      setRuleDialogOpen(false);
      ruleForm.reset();
    },
    onError: () => {
      toast({ title: "Failed to create rule", variant: "destructive" });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return apiRequest("DELETE", `/api/admin/mapping-rules/${ruleId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      toast({ title: "Mapping rule deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete rule", variant: "destructive" });
    },
  });

  const openEditProject = (project: Project) => {
    setEditingProject(project);
    projectForm.reset({
      name: project.name,
      code: project.code || "",
      client: project.client || "",
      address: project.address || "",
    });
    setProjectDialogOpen(true);
  };

  const openNewProject = () => {
    setEditingProject(null);
    projectForm.reset({ name: "", code: "", client: "", address: "" });
    setProjectDialogOpen(true);
  };

  const openAddRule = (projectId: string) => {
    setSelectedProjectId(projectId);
    ruleForm.reset({ pathContains: "", priority: 100 });
    setRuleDialogOpen(true);
  };

  const onProjectSubmit = (data: ProjectFormData) => {
    if (editingProject) {
      updateProjectMutation.mutate({ id: editingProject.id, data });
    } else {
      createProjectMutation.mutate(data);
    }
  };

  const onRuleSubmit = (data: MappingRuleFormData) => {
    if (selectedProjectId) {
      createRuleMutation.mutate({ projectId: selectedProjectId, data });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-projects-title">
            Projects & Mapping
          </h1>
          <p className="text-muted-foreground">
            Manage projects and file path mapping rules
          </p>
        </div>
        <Button onClick={openNewProject} data-testid="button-add-project">
          <Plus className="h-4 w-4 mr-2" />
          Add Project
        </Button>
      </div>

      <div className="space-y-4">
        {projects && projects.length > 0 ? (
          projects.map((project) => (
            <Card key={project.id} data-testid={`card-project-${project.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FolderOpen className="h-5 w-5" />
                      {project.name}
                      {project.code && (
                        <Badge variant="outline">{project.code}</Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1.5 flex items-center gap-4 flex-wrap">
                      {project.client && (
                        <span className="flex items-center gap-1">
                          <Building className="h-3.5 w-3.5" />
                          {project.client}
                        </span>
                      )}
                      {project.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {project.address}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAddRule(project.id)}
                      data-testid={`button-add-rule-${project.id}`}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Rule
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditProject(project)}
                      data-testid={`button-edit-${project.id}`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setDeletingProjectId(project.id);
                        setDeleteDialogOpen(true);
                      }}
                      data-testid={`button-delete-${project.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {project.mappingRules && project.mappingRules.length > 0 && (
                <CardContent className="pt-0">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Path Contains</TableHead>
                          <TableHead className="w-24">Priority</TableHead>
                          <TableHead className="w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {project.mappingRules.map((rule) => (
                          <TableRow key={rule.id}>
                            <TableCell className="font-mono text-sm">
                              {rule.pathContains}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{rule.priority}</Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => deleteRuleMutation.mutate(rule.id)}
                                data-testid={`button-delete-rule-${rule.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No projects yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create a project to start mapping files
              </p>
              <Button className="mt-4" onClick={openNewProject}>
                <Plus className="h-4 w-4 mr-2" />
                Add Project
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProject ? "Edit Project" : "New Project"}
            </DialogTitle>
            <DialogDescription>
              {editingProject
                ? "Update project details"
                : "Create a new project for time tracking"}
            </DialogDescription>
          </DialogHeader>
          <Form {...projectForm}>
            <form onSubmit={projectForm.handleSubmit(onProjectSubmit)} className="space-y-4">
              <FormField
                control={projectForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Project name" data-testid="input-project-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={projectForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Code</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="PRJ-001" data-testid="input-project-code" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={projectForm.control}
                name="client"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Client name" data-testid="input-project-client" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={projectForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Project address" data-testid="input-project-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setProjectDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createProjectMutation.isPending || updateProjectMutation.isPending}
                  data-testid="button-save-project"
                >
                  {(createProjectMutation.isPending || updateProjectMutation.isPending) ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {editingProject ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Mapping Rule</DialogTitle>
            <DialogDescription>
              Map files containing this path pattern to this project
            </DialogDescription>
          </DialogHeader>
          <Form {...ruleForm}>
            <form onSubmit={ruleForm.handleSubmit(onRuleSubmit)} className="space-y-4">
              <FormField
                control={ruleForm.control}
                name="pathContains"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Path Contains</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="\\Projects\\ProjectName\\" data-testid="input-path-contains" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={ruleForm.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        data-testid="input-priority"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRuleDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createRuleMutation.isPending}
                  data-testid="button-save-rule"
                >
                  {createRuleMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Add Rule
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project and all its mapping rules.
              Time entries will remain but lose their project association.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingProjectId && deleteProjectMutation.mutate(deletingProjectId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProjectMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
