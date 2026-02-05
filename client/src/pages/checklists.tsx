import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Plus,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Search,
  Filter,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ChecklistInstance, ChecklistTemplate, Job } from "@shared/schema";
import { CHECKLIST_ROUTES, JOBS_ROUTES } from "@shared/api-routes";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  draft: { label: "Draft", variant: "secondary", icon: FileText },
  in_progress: { label: "In Progress", variant: "default", icon: Clock },
  completed: { label: "Completed", variant: "outline", icon: CheckCircle },
  signed_off: { label: "Signed Off", variant: "default", icon: CheckCircle },
  cancelled: { label: "Cancelled", variant: "destructive", icon: AlertCircle },
};

export default function ChecklistsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [newChecklistDialogOpen, setNewChecklistDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingInstanceId, setDeletingInstanceId] = useState<string | null>(null);

  const { data: instances, isLoading: instancesLoading } = useQuery<ChecklistInstance[]>({
    queryKey: [CHECKLIST_ROUTES.INSTANCES],
  });

  const { data: templates, isLoading: templatesLoading } = useQuery<ChecklistTemplate[]>({
    queryKey: [CHECKLIST_ROUTES.TEMPLATES],
  });

  const { data: jobs } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  const createInstanceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", CHECKLIST_ROUTES.INSTANCES, {
        templateId: selectedTemplateId,
        jobId: selectedJobId || null,
        status: "draft",
        responses: {},
      });
      return response.json() as Promise<ChecklistInstance>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.INSTANCES] });
      setNewChecklistDialogOpen(false);
      setSelectedTemplateId("");
      setSelectedJobId("");
      toast({ title: "Created", description: "New checklist created successfully" });
      navigate(`/checklists/${data.id}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create checklist", variant: "destructive" });
    },
  });

  const deleteInstanceMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", CHECKLIST_ROUTES.INSTANCE_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.INSTANCES] });
      setDeleteDialogOpen(false);
      setDeletingInstanceId(null);
      toast({ title: "Deleted", description: "Checklist deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete checklist", variant: "destructive" });
    },
  });

  const getTemplateName = (templateId: string) => {
    const template = templates?.find((t) => t.id === templateId);
    return template?.name || "Unknown Template";
  };

  const getJobName = (jobId: string | null) => {
    if (!jobId) return "-";
    const job = jobs?.find((j) => j.id === jobId);
    return job?.name || "Unknown Job";
  };

  const filteredInstances = instances?.filter((instance) => {
    const matchesSearch =
      searchTerm === "" ||
      getTemplateName(instance.templateId).toLowerCase().includes(searchTerm.toLowerCase()) ||
      instance.instanceNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || instance.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeTemplates = templates?.filter((t) => t.isActive) || [];

  if (instancesLoading || templatesLoading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Skeleton className="h-8 w-64 mb-4" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Checklists
          </h1>
          <p className="text-muted-foreground">
            View and fill out checklists based on templates
          </p>
        </div>
        <Button
          onClick={() => setNewChecklistDialogOpen(true)}
          disabled={activeTemplates.length === 0}
          data-testid="button-new-checklist"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Checklist
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search checklists..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-checklists"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-status-all">All Statuses</SelectItem>
                <SelectItem value="draft" data-testid="option-status-draft">Draft</SelectItem>
                <SelectItem value="in_progress" data-testid="option-status-in-progress">In Progress</SelectItem>
                <SelectItem value="completed" data-testid="option-status-completed">Completed</SelectItem>
                <SelectItem value="signed_off" data-testid="option-status-signed-off">Signed Off</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {(!filteredInstances || filteredInstances.length === 0) ? (
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {instances?.length === 0 ? "No Checklists Yet" : "No Results Found"}
          </h3>
          <p className="text-muted-foreground mb-4">
            {instances?.length === 0
              ? "Create your first checklist from a template"
              : "Try adjusting your search or filter"}
          </p>
          {instances?.length === 0 && activeTemplates.length > 0 && (
            <Button onClick={() => setNewChecklistDialogOpen(true)} data-testid="button-create-first-checklist">
              <Plus className="h-4 w-4 mr-2" />
              Create Checklist
            </Button>
          )}
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Job</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Started</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInstances.map((instance) => {
              const statusConfig = STATUS_CONFIG[instance.status];
              const StatusIcon = statusConfig?.icon || FileText;
              const completionRate = Number(instance.completionRate || 0);

              return (
                <TableRow key={instance.id} data-testid={`row-checklist-${instance.id}`}>
                  <TableCell className="font-medium">
                    {getTemplateName(instance.templateId)}
                  </TableCell>
                  <TableCell>{getJobName(instance.jobId)}</TableCell>
                  <TableCell>
                    <Badge variant={statusConfig?.variant || "secondary"}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig?.label || instance.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <Progress value={completionRate} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground w-10">
                        {completionRate.toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(instance.startedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" asChild data-testid={`button-open-checklist-${instance.id}`}>
                        <Link href={`/checklists/${instance.id}`}>
                          {instance.status === "completed" || instance.status === "signed_off"
                            ? "View"
                            : "Continue"}
                        </Link>
                      </Button>
                      {instance.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingInstanceId(instance.id);
                            setDeleteDialogOpen(true);
                          }}
                          data-testid={`button-delete-checklist-${instance.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={newChecklistDialogOpen} onOpenChange={setNewChecklistDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Checklist</DialogTitle>
            <DialogDescription>
              Select a template to start a new checklist
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Template</label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger data-testid="select-template">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {activeTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id} data-testid={`option-template-${template.id}`}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Job (Optional)</label>
              <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                <SelectTrigger data-testid="select-job">
                  <SelectValue placeholder="Select a job" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="" data-testid="option-job-none">None</SelectItem>
                  {jobs?.map((job) => (
                    <SelectItem key={job.id} value={job.id} data-testid={`option-job-${job.id}`}>
                      {job.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewChecklistDialogOpen(false)} data-testid="button-cancel-new-checklist">
              Cancel
            </Button>
            <Button
              onClick={() => createInstanceMutation.mutate()}
              disabled={!selectedTemplateId || createInstanceMutation.isPending}
              data-testid="button-create-checklist"
            >
              {createInstanceMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Checklist?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The checklist and all its data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingInstanceId && deleteInstanceMutation.mutate(deletingInstanceId)}
              data-testid="button-confirm-delete"
            >
              {deleteInstanceMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
