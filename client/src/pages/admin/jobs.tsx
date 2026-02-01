import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as XLSX from "xlsx";
import {
  Briefcase,
  Plus,
  Edit2,
  Trash2,
  Save,
  Loader2,
  Upload,
  Download,
  FileSpreadsheet,
  Building,
  MapPin,
  Hash,
  ChevronRight,
  DollarSign,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocation } from "wouter";
import type { Job, PanelRegister, Project } from "@shared/schema";

const jobSchema = z.object({
  jobNumber: z.string().min(1, "Job number is required"),
  name: z.string().min(1, "Name is required"),
  client: z.string().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]),
  projectId: z.string().optional(),
});

type JobFormData = z.infer<typeof jobSchema>;

interface JobWithPanels extends Job {
  panels: PanelRegister[];
  project?: Project;
}

interface CostOverride {
  id: string;
  jobId: string;
  panelTypeId: string;
  componentName: string;
  defaultPercentage: string;
  revisedPercentage: string | null;
  notes: string | null;
}

interface PanelTypeInfo {
  id: string;
  code: string;
  name: string;
}

export default function AdminJobsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [costOverridesDialogOpen, setCostOverridesDialogOpen] = useState(false);
  const [costOverridesJob, setCostOverridesJob] = useState<JobWithPanels | null>(null);
  const [localOverrides, setLocalOverrides] = useState<CostOverride[]>([]);

  const { data: jobs, isLoading } = useQuery<JobWithPanels[]>({
    queryKey: ["/api/admin/jobs"],
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/admin/projects"],
  });

  const jobForm = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      jobNumber: "",
      name: "",
      client: "",
      address: "",
      description: "",
      status: "ACTIVE",
      projectId: "",
    },
  });

  const createJobMutation = useMutation({
    mutationFn: async (data: JobFormData) => {
      const submitData = { ...data, projectId: data.projectId === "none" ? undefined : data.projectId };
      return apiRequest("POST", "/api/admin/jobs", submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: "Job created successfully" });
      setJobDialogOpen(false);
      jobForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create job", description: error.message, variant: "destructive" });
    },
  });

  const updateJobMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: JobFormData }) => {
      const submitData = { ...data, projectId: data.projectId === "none" ? null : data.projectId };
      return apiRequest("PUT", `/api/admin/jobs/${id}`, submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: "Job updated successfully" });
      setJobDialogOpen(false);
      setEditingJob(null);
      jobForm.reset();
    },
    onError: () => {
      toast({ title: "Failed to update job", variant: "destructive" });
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/jobs/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: "Job deleted" });
      setDeleteDialogOpen(false);
      setDeletingJobId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete job", variant: "destructive" });
    },
  });

  const { data: panelTypes } = useQuery<PanelTypeInfo[]>({
    queryKey: ["/api/panel-types"],
  });

  const { data: costOverrides, refetch: refetchCostOverrides } = useQuery<CostOverride[]>({
    queryKey: ["/api/jobs", costOverridesJob?.id, "cost-overrides"],
    queryFn: async () => {
      if (!costOverridesJob?.id) return [];
      const res = await fetch(`/api/jobs/${costOverridesJob.id}/cost-overrides`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cost overrides");
      return res.json();
    },
    enabled: !!costOverridesJob?.id && costOverridesDialogOpen,
  });

  useEffect(() => {
    if (costOverrides) {
      setLocalOverrides(costOverrides);
    }
  }, [costOverrides]);

  const initializeCostOverridesMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiRequest("POST", `/api/jobs/${jobId}/cost-overrides/initialize`, {});
    },
    onSuccess: () => {
      refetchCostOverrides();
      toast({ title: "Cost overrides initialized from panel type defaults" });
    },
    onError: () => {
      toast({ title: "Failed to initialize cost overrides", variant: "destructive" });
    },
  });

  const updateCostOverrideMutation = useMutation({
    mutationFn: async ({ jobId, id, data }: { jobId: string; id: string; data: { revisedPercentage: string | null; notes: string | null } }) => {
      return apiRequest("PUT", `/api/jobs/${jobId}/cost-overrides/${id}`, data);
    },
    onSuccess: () => {
      refetchCostOverrides();
      toast({ title: "Cost override updated" });
    },
    onError: () => {
      toast({ title: "Failed to update cost override", variant: "destructive" });
    },
  });

  const handleOpenCostOverrides = (job: JobWithPanels) => {
    setCostOverridesJob(job);
    setLocalOverrides([]);
    setCostOverridesDialogOpen(true);
  };

  const handleUpdateOverride = (id: string, field: "revisedPercentage" | "notes", value: string | null) => {
    setLocalOverrides(prev => prev.map(o => o.id === id ? { ...o, [field]: value } : o));
  };

  const handleSaveOverride = (override: CostOverride) => {
    if (!costOverridesJob) return;
    updateCostOverrideMutation.mutate({
      jobId: costOverridesJob.id,
      id: override.id,
      data: { revisedPercentage: override.revisedPercentage, notes: override.notes },
    });
  };

  const getPanelTypeName = (panelTypeId: string) => {
    return panelTypes?.find(pt => pt.id === panelTypeId)?.name || "Unknown";
  };

  const groupedOverrides = localOverrides.reduce((acc, override) => {
    if (!acc[override.panelTypeId]) {
      acc[override.panelTypeId] = [];
    }
    acc[override.panelTypeId].push(override);
    return acc;
  }, {} as Record<string, CostOverride[]>);

  const importJobsMutation = useMutation({
    mutationFn: async (data: any[]) => {
      return apiRequest("POST", "/api/admin/jobs/import", { data });
    },
    onSuccess: async (response) => {
      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: `Imported ${result.imported} jobs, ${result.skipped} skipped` });
      setImportDialogOpen(false);
      setImportData([]);
    },
    onError: () => {
      toast({ title: "Import failed", variant: "destructive" });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      setImportData(jsonData);
      setImportDialogOpen(true);
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadTemplate = () => {
    const template = [
      { "Job Number": "JOB001", "Name": "Example Job", "Client": "Example Client", "Address": "123 Example St", "Description": "Description here" },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jobs");
    XLSX.writeFile(wb, "jobs_template.xlsx");
  };

  const openCreateDialog = () => {
    setEditingJob(null);
    jobForm.reset({
      jobNumber: "",
      name: "",
      client: "",
      address: "",
      description: "",
      status: "ACTIVE",
      projectId: "",
    });
    setJobDialogOpen(true);
  };

  const openEditDialog = (job: Job) => {
    setEditingJob(job);
    jobForm.reset({
      jobNumber: job.jobNumber,
      name: job.name,
      client: job.client || "",
      address: job.address || "",
      description: job.description || "",
      status: job.status,
      projectId: job.projectId || "none",
    });
    setJobDialogOpen(true);
  };

  const onSubmit = (data: JobFormData) => {
    if (editingJob) {
      updateJobMutation.mutate({ id: editingJob.id, data });
    } else {
      createJobMutation.mutate(data);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      ACTIVE: "default",
      ON_HOLD: "secondary",
      COMPLETED: "outline",
      ARCHIVED: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-jobs-title">Jobs</h1>
          <p className="text-muted-foreground">Manage job list for panel tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
            data-testid="input-file-upload"
          />
          <Button variant="outline" onClick={downloadTemplate} data-testid="button-download-template">
            <Download className="h-4 w-4 mr-2" />
            Template
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="button-import">
            <Upload className="h-4 w-4 mr-2" />
            Import Excel
          </Button>
          <Button onClick={openCreateDialog} data-testid="button-create-job">
            <Plus className="h-4 w-4 mr-2" />
            Add Job
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Job List
          </CardTitle>
          <CardDescription>
            {jobs?.length || 0} jobs in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job Number</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Panels</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs?.map((job) => (
                <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono font-medium">{job.jobNumber}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{job.name}</div>
                      {job.address && (
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {job.address}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {job.client && (
                      <div className="flex items-center gap-1">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        {job.client}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(job.status)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/admin/panels?jobId=${job.id}`)}
                      data-testid={`button-view-panels-${job.id}`}
                    >
                      {job.panels.length} panels
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenCostOverrides(job)}
                        title="Cost Overrides"
                        data-testid={`button-cost-overrides-${job.id}`}
                      >
                        <DollarSign className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(job)}
                        data-testid={`button-edit-job-${job.id}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeletingJobId(job.id);
                          setDeleteDialogOpen(true);
                        }}
                        data-testid={`button-delete-job-${job.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!jobs || jobs.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No jobs found. Add a job or import from Excel.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={jobDialogOpen} onOpenChange={setJobDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingJob ? "Edit Job" : "Create New Job"}</DialogTitle>
            <DialogDescription>
              {editingJob ? "Update job details" : "Add a new job to the system"}
            </DialogDescription>
          </DialogHeader>
          <Form {...jobForm}>
            <form onSubmit={jobForm.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={jobForm.control}
                name="jobNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Number</FormLabel>
                    <FormControl>
                      <Input placeholder="JOB001" {...field} data-testid="input-job-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={jobForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Project name" {...field} data-testid="input-job-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={jobForm.control}
                  name="client"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client</FormLabel>
                      <FormControl>
                        <Input placeholder="Client name" {...field} data-testid="input-job-client" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={jobForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-job-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ACTIVE">Active</SelectItem>
                          <SelectItem value="ON_HOLD">On Hold</SelectItem>
                          <SelectItem value="COMPLETED">Completed</SelectItem>
                          <SelectItem value="ARCHIVED">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={jobForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Project address" {...field} data-testid="input-job-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={jobForm.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link to Project (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "none"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-job-project">
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No project</SelectItem>
                        {projects?.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.code ? `${project.code} - ${project.name}` : project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={jobForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Job description" {...field} data-testid="input-job-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setJobDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createJobMutation.isPending || updateJobMutation.isPending}
                  data-testid="button-save-job"
                >
                  {(createJobMutation.isPending || updateJobMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Save className="h-4 w-4 mr-2" />
                  {editingJob ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Jobs from Excel
            </DialogTitle>
            <DialogDescription>
              Review the data before importing. {importData.length} rows found.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[300px] overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Number</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importData.slice(0, 10).map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono">{row.jobNumber || row["Job Number"] || row.job_number || "-"}</TableCell>
                    <TableCell>{row.name || row["Name"] || row["Job Name"] || "-"}</TableCell>
                    <TableCell>{row.client || row["Client"] || "-"}</TableCell>
                    <TableCell>{row.address || row["Address"] || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {importData.length > 10 && (
              <div className="p-2 text-center text-sm text-muted-foreground">
                ... and {importData.length - 10} more rows
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => importJobsMutation.mutate(importData)}
              disabled={importJobsMutation.isPending}
              data-testid="button-confirm-import"
            >
              {importJobsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Upload className="h-4 w-4 mr-2" />
              Import {importData.length} Jobs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this job and all associated panel register entries.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingJobId && deleteJobMutation.mutate(deletingJobId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteJobMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={costOverridesDialogOpen} onOpenChange={setCostOverridesDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Cost Overrides - {costOverridesJob?.name}
            </DialogTitle>
            <DialogDescription>
              Modify cost ratios for this job. Default values come from panel type settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {Object.keys(groupedOverrides).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No cost overrides initialized for this job yet.
                </p>
                <Button
                  onClick={() => costOverridesJob && initializeCostOverridesMutation.mutate(costOverridesJob.id)}
                  disabled={initializeCostOverridesMutation.isPending}
                  data-testid="button-initialize-overrides"
                >
                  {initializeCostOverridesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Initialize from Panel Type Defaults
                </Button>
              </div>
            ) : (
              Object.entries(groupedOverrides).map(([panelTypeId, overrides]) => (
                <Card key={panelTypeId}>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">{getPanelTypeName(panelTypeId)}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Component</TableHead>
                          <TableHead className="text-right w-24">Default %</TableHead>
                          <TableHead className="text-right w-32">Revised %</TableHead>
                          <TableHead className="w-48">Notes</TableHead>
                          <TableHead className="w-20">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {overrides.map((override) => (
                          <TableRow key={override.id}>
                            <TableCell className="font-medium">{override.componentName}</TableCell>
                            <TableCell className="text-right font-mono">
                              {parseFloat(override.defaultPercentage).toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="relative">
                                <Input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  placeholder={override.defaultPercentage}
                                  value={override.revisedPercentage || ""}
                                  onChange={(e) => handleUpdateOverride(override.id, "revisedPercentage", e.target.value || null)}
                                  className="w-20 text-right pr-5"
                                  data-testid={`input-revised-${override.id}`}
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                placeholder="Reason for change..."
                                value={override.notes || ""}
                                onChange={(e) => handleUpdateOverride(override.id, "notes", e.target.value || null)}
                                className="text-sm"
                                data-testid={`input-notes-${override.id}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSaveOverride(override)}
                                disabled={updateCostOverrideMutation.isPending}
                                data-testid={`button-save-override-${override.id}`}
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCostOverridesDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
