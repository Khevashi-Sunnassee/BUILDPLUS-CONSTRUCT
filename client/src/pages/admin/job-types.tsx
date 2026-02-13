import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Workflow, Loader2, Settings2, Layers, ArrowRight, Zap } from "lucide-react";
import { useLocation } from "wouter";
import { PROJECT_ACTIVITIES_ROUTES } from "@shared/api-routes";
import type { JobType } from "@shared/schema";
import { PageHelpButton } from "@/components/help/page-help-button";

export default function AdminJobTypesPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showDialog, setShowDialog] = useState(false);
  const [editingJobType, setEditingJobType] = useState<JobType | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<JobType | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  const { data: jobTypesData, isLoading } = useQuery<JobType[]>({
    queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_TYPES],
  });

  const { data: stagesData } = useQuery<any[]>({
    queryKey: [PROJECT_ACTIVITIES_ROUTES.STAGES],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; isActive: boolean }) => {
      return apiRequest("POST", PROJECT_ACTIVITIES_ROUTES.JOB_TYPES, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_TYPES] });
      toast({ title: "Job type created successfully" });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; description: string; isActive: boolean }) => {
      return apiRequest("PATCH", PROJECT_ACTIVITIES_ROUTES.JOB_TYPE_BY_ID(id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_TYPES] });
      toast({ title: "Job type updated successfully" });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", PROJECT_ACTIVITIES_ROUTES.JOB_TYPE_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_TYPES] });
      toast({ title: "Job type deleted" });
      setDeleteConfirm(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", PROJECT_ACTIVITIES_ROUTES.SEED);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_TYPES] });
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.STAGES] });
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.CONSULTANTS] });
      toast({ title: "Seed data loaded successfully", description: "Job types, stages, consultants, and activity templates have been created." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  function closeDialog() {
    setShowDialog(false);
    setEditingJobType(null);
    setFormName("");
    setFormDescription("");
    setFormIsActive(true);
  }

  function openCreateDialog() {
    setEditingJobType(null);
    setFormName("");
    setFormDescription("");
    setFormIsActive(true);
    setShowDialog(true);
  }

  function openEditDialog(jt: JobType) {
    setEditingJobType(jt);
    setFormName(jt.name);
    setFormDescription(jt.description || "");
    setFormIsActive(jt.isActive);
    setShowDialog(true);
  }

  function handleSubmit() {
    if (!formName.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (editingJobType) {
      updateMutation.mutate({ id: editingJobType.id, name: formName.trim(), description: formDescription.trim(), isActive: formIsActive });
    } else {
      createMutation.mutate({ name: formName.trim(), description: formDescription.trim(), isActive: formIsActive });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const hasNoData = !isLoading && (!jobTypesData || jobTypesData.length === 0);

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-6" role="main" aria-label="Job Types" aria-busy={isLoading}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Job Types & Workflows</h1>
            <PageHelpButton pageHelpKey="page.admin.job-types" />
          </div>
          <p className="text-muted-foreground">Manage job types and build activity workflows for each type</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasNoData && (
            <Button
              variant="outline"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              data-testid="button-seed-data"
            >
              {seedMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              Load Sample Data
            </Button>
          )}
          <Button onClick={openCreateDialog} data-testid="button-create-job-type">
            <Plus className="h-4 w-4 mr-2" />
            New Job Type
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : hasNoData ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Layers className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Job Types Yet</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Create job types to define different project categories, then build activity workflows for each type.
              You can also load sample data to get started quickly.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} data-testid="button-seed-data-empty">
                {seedMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                Load Sample Data
              </Button>
              <Button onClick={openCreateDialog} data-testid="button-create-job-type-empty">
                <Plus className="h-4 w-4 mr-2" />
                Create Job Type
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Job Types
              </CardTitle>
              <CardDescription>
                {jobTypesData?.length} job type{(jobTypesData?.length ?? 0) !== 1 ? "s" : ""} configured
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Activities</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobTypesData?.map((jt) => (
                  <TableRow key={jt.id} data-testid={`row-job-type-${jt.id}`}>
                    <TableCell className="font-medium" data-testid={`text-job-type-name-${jt.id}`}>{jt.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">{jt.description || "-"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" data-testid={`badge-activity-count-${jt.id}`}>
                        {(jt as any).activityCount ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={jt.isActive ? "default" : "secondary"} data-testid={`badge-status-${jt.id}`}>
                        {jt.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admin/job-types/${jt.id}/workflow`)}
                          data-testid={`button-workflow-${jt.id}`}
                        >
                          <Workflow className="h-4 w-4 mr-1" />
                          Workflow
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditDialog(jt)}
                          data-testid={`button-edit-${jt.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteConfirm(jt)}
                          data-testid={`button-delete-${jt.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingJobType ? "Edit Job Type" : "Create Job Type"}</DialogTitle>
            <DialogDescription>
              {editingJobType ? "Update the job type details." : "Add a new job type to categorise your projects."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="jt-name">Name</Label>
              <Input
                id="jt-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Construction Only"
                data-testid="input-job-type-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jt-desc">Description</Label>
              <Textarea
                id="jt-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description of this job type..."
                data-testid="input-job-type-description"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="jt-active"
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
                data-testid="switch-job-type-active"
              />
              <Label htmlFor="jt-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel">Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending} data-testid="button-save-job-type">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingJobType ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This will also remove all associated workflow templates. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
