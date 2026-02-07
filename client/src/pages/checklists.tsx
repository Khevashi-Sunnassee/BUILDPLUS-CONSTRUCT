import { useState, useMemo } from "react";
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
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import type { ChecklistInstance, ChecklistTemplate, Job } from "@shared/schema";
import { CHECKLIST_ROUTES, JOBS_ROUTES } from "@shared/api-routes";
import { format } from "date-fns";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  draft: { label: "Draft", variant: "secondary", icon: FileText },
  in_progress: { label: "In Progress", variant: "default", icon: Clock },
  completed: { label: "Completed", variant: "outline", icon: CheckCircle },
  signed_off: { label: "Signed Off", variant: "default", icon: CheckCircle },
  cancelled: { label: "Cancelled", variant: "destructive", icon: AlertCircle },
};

const STATUS_ORDER = ["in_progress", "draft", "completed", "signed_off", "cancelled"];

export default function ChecklistsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});
  const [collapsedStatuses, setCollapsedStatuses] = useState<Record<string, boolean>>({});
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
    if (!jobId) return null;
    const job = jobs?.find((j) => j.id === jobId);
    return job ? (job.jobNumber ? `${job.jobNumber} - ${job.name}` : job.name) : "Unknown Job";
  };

  const filteredInstances = useMemo(() => {
    if (!instances) return [];
    return instances.filter((instance) => {
      const templateName = getTemplateName(instance.templateId);
      const jobName = getJobName(instance.jobId) || "";
      const matchesSearch =
        searchTerm === "" ||
        templateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        instance.instanceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        jobName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || instance.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [instances, searchTerm, statusFilter, templates, jobs]);

  type StatusGroup = {
    status: string;
    label: string;
    icon: React.ElementType;
    variant: "default" | "secondary" | "destructive" | "outline";
    items: ChecklistInstance[];
  };

  type ModuleGroup = {
    templateId: string;
    templateName: string;
    totalCount: number;
    statusGroups: StatusGroup[];
  };

  const groupedByModule = useMemo((): ModuleGroup[] => {
    if (!filteredInstances.length) return [];

    const moduleMap: Record<string, ChecklistInstance[]> = {};
    filteredInstances.forEach((instance) => {
      const key = instance.templateId;
      if (!moduleMap[key]) moduleMap[key] = [];
      moduleMap[key].push(instance);
    });

    return Object.entries(moduleMap)
      .map(([templateId, items]) => {
        const templateName = getTemplateName(templateId);

        const statusMap: Record<string, ChecklistInstance[]> = {};
        items.forEach((item) => {
          if (!statusMap[item.status]) statusMap[item.status] = [];
          statusMap[item.status].push(item);
        });

        const statusGroups: StatusGroup[] = STATUS_ORDER
          .filter((s) => statusMap[s]?.length > 0)
          .map((s) => {
            const config = STATUS_CONFIG[s];
            const sortedItems = [...statusMap[s]].sort(
              (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
            );
            return {
              status: s,
              label: config?.label || s,
              icon: config?.icon || FileText,
              variant: config?.variant || ("secondary" as const),
              items: sortedItems,
            };
          });

        return {
          templateId,
          templateName,
          totalCount: items.length,
          statusGroups,
        };
      })
      .sort((a, b) => a.templateName.localeCompare(b.templateName));
  }, [filteredInstances, templates]);

  const toggleModuleCollapse = (key: string) => {
    setCollapsedModules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleStatusCollapse = (key: string) => {
    setCollapsedStatuses((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const activeTemplates = templates?.filter((t) => t.isActive) || [];

  if (instancesLoading || templatesLoading) {
    return (
      <div className="space-y-6">
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
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-checklists-title">
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

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by template, job, or checklist number..."
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
        <div className="space-y-4">
          {groupedByModule.map((module) => {
            const isModuleCollapsed = collapsedModules[module.templateId] === true;

            return (
              <Card key={module.templateId} data-testid={`module-group-${module.templateId}`}>
                <button
                  onClick={() => toggleModuleCollapse(module.templateId)}
                  className="flex items-center gap-3 w-full py-3 px-4 text-left hover-elevate rounded-t-md"
                  data-testid={`button-toggle-module-${module.templateId}`}
                >
                  {isModuleCollapsed ? (
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <FileText className="h-5 w-5 shrink-0 text-primary" />
                  <span className="font-semibold text-base truncate" data-testid={`text-module-name-${module.templateId}`}>
                    {module.templateName}
                  </span>
                  <Badge variant="secondary" className="shrink-0 ml-auto" data-testid={`badge-module-count-${module.templateId}`}>
                    {module.totalCount}
                  </Badge>
                </button>

                {!isModuleCollapsed && (
                  <CardContent className="pt-0 pb-3 px-3">
                    <div className="space-y-2">
                      {module.statusGroups.map((sg) => {
                        const statusKey = `${module.templateId}-${sg.status}`;
                        const isStatusCollapsed = collapsedStatuses[statusKey] === true;
                        const StatusIcon = sg.icon;

                        return (
                          <div key={sg.status} className="border rounded-md" data-testid={`status-group-${statusKey}`}>
                            <button
                              onClick={() => toggleStatusCollapse(statusKey)}
                              className="flex items-center gap-2 w-full py-2 px-3 text-left text-sm hover-elevate rounded-md"
                              data-testid={`button-toggle-status-${statusKey}`}
                            >
                              {isStatusCollapsed ? (
                                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                              <Badge variant={sg.variant} className="shrink-0">
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {sg.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground ml-auto shrink-0">
                                {sg.items.length} item{sg.items.length !== 1 ? "s" : ""}
                              </span>
                            </button>

                            {!isStatusCollapsed && (
                              <div className="border-t">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-xs text-muted-foreground border-b">
                                      <th className="text-left py-2 px-3 font-medium">Checklist #</th>
                                      <th className="text-left py-2 px-3 font-medium">Job</th>
                                      <th className="text-left py-2 px-3 font-medium">Progress</th>
                                      <th className="text-left py-2 px-3 font-medium">Date</th>
                                      <th className="text-right py-2 px-3 font-medium">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sg.items.map((instance, idx) => {
                                      const completionRate = Number(instance.completionRate || 0);
                                      return (
                                        <tr
                                          key={instance.id}
                                          className={idx % 2 === 0 ? "bg-muted/30" : ""}
                                          data-testid={`row-checklist-${instance.id}`}
                                        >
                                          <td className="py-2 px-3 font-medium">
                                            {instance.instanceNumber ? `#${instance.instanceNumber}` : "-"}
                                          </td>
                                          <td className="py-2 px-3">
                                            {instance.jobId ? (
                                              <span className="text-sm">{getJobName(instance.jobId)}</span>
                                            ) : (
                                              <span className="text-muted-foreground">-</span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3">
                                            <div className="flex items-center gap-2">
                                              <Progress value={completionRate} className="h-2 w-20" />
                                              <span className="text-xs text-muted-foreground w-10">
                                                {completionRate.toFixed(0)}%
                                              </span>
                                            </div>
                                          </td>
                                          <td className="py-2 px-3 text-muted-foreground">
                                            {format(new Date(instance.startedAt), "dd/MM/yyyy")}
                                          </td>
                                          <td className="py-2 px-3 text-right">
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
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
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
              <Select value={selectedJobId || "__none__"} onValueChange={(v) => setSelectedJobId(v === "__none__" ? "" : v)}>
                <SelectTrigger data-testid="select-job">
                  <SelectValue placeholder="Select a job" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" data-testid="option-job-none">None</SelectItem>
                  {jobs?.map((job) => (
                    <SelectItem key={job.id} value={job.id} data-testid={`option-job-${job.id}`}>
                      {job.jobNumber ? `${job.jobNumber} - ${job.name}` : job.name}
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
