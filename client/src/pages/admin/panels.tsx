import { useState, useRef, useEffect, Fragment, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as XLSX from "xlsx";
import {
  ClipboardList,
  Plus,
  Edit2,
  Trash2,
  Save,
  Loader2,
  Upload,
  Download,
  FileSpreadsheet,
  Hash,
  ArrowLeft,
  Filter,
  CheckCircle,
  Clock as ClockIcon,
  AlertCircle,
  Pause,
  Layers,
  ChevronDown,
  ChevronRight,
  Hammer,
  FileText,
  CheckCircle2,
  XCircle,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { useLocation, useSearch } from "wouter";
import type { Job, PanelRegister, PanelTypeConfig } from "@shared/schema";

const panelSchema = z.object({
  jobId: z.string().min(1, "Job is required"),
  panelMark: z.string().min(1, "Panel mark is required"),
  panelType: z.string().min(1, "Panel type is required"),
  description: z.string().optional(),
  drawingCode: z.string().optional(),
  sheetNumber: z.string().optional(),
  estimatedHours: z.number().optional(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ON_HOLD"]),
});

type PanelFormData = z.infer<typeof panelSchema>;

interface PanelWithJob extends PanelRegister {
  job: Job;
}

export default function AdminPanelsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const filterJobId = urlParams.get("jobId");
  
  const [panelDialogOpen, setPanelDialogOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<PanelRegister | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPanelId, setDeletingPanelId] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [selectedJobForImport, setSelectedJobForImport] = useState<string>("");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [groupByJob, setGroupByJob] = useState<boolean>(true);
  const [collapsedJobs, setCollapsedJobs] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Build dialog state
  const [buildDialogOpen, setBuildDialogOpen] = useState(false);
  const [buildingPanel, setBuildingPanel] = useState<PanelRegister | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [buildFormData, setBuildFormData] = useState({
    loadWidth: "",
    loadHeight: "",
    panelThickness: "",
    panelVolume: "",
    panelMass: "",
    panelArea: "",
    day28Fc: "",
    liftFcm: "",
    rotationalLifters: "",
    primaryLifters: "",
  });
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const { data: panels, isLoading: panelsLoading } = useQuery<PanelWithJob[]>({
    queryKey: ["/api/admin/panels"],
  });

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ["/api/admin/jobs"],
  });

  const { data: panelTypes } = useQuery<PanelTypeConfig[]>({
    queryKey: ["/api/panel-types"],
  });

  const filteredPanels = panels?.filter(panel => {
    if (filterJobId && panel.jobId !== filterJobId) return false;
    if (jobFilter !== "all" && panel.jobId !== jobFilter) return false;
    if (statusFilter !== "all" && panel.status !== statusFilter) return false;
    return true;
  });

  // Group panels by job for grouped view
  const panelsByJob = filteredPanels?.reduce((acc, panel) => {
    const jobId = panel.jobId;
    if (!acc[jobId]) {
      acc[jobId] = { job: panel.job, panels: [] };
    }
    acc[jobId].panels.push(panel);
    return acc;
  }, {} as Record<string, { job: Job; panels: PanelWithJob[] }>) || {};

  const toggleJobCollapse = (jobId: string) => {
    setCollapsedJobs(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const currentJob = jobs?.find(j => j.id === filterJobId);

  const panelForm = useForm<PanelFormData>({
    resolver: zodResolver(panelSchema),
    defaultValues: {
      jobId: filterJobId || "",
      panelMark: "",
      panelType: "WALL",
      description: "",
      drawingCode: "",
      sheetNumber: "",
      estimatedHours: undefined,
      status: "NOT_STARTED",
    },
  });

  useEffect(() => {
    if (filterJobId) {
      panelForm.setValue("jobId", filterJobId);
    }
  }, [filterJobId, panelForm]);

  const createPanelMutation = useMutation({
    mutationFn: async (data: PanelFormData) => {
      return apiRequest("POST", "/api/admin/panels", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/panels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: "Panel created successfully" });
      setPanelDialogOpen(false);
      panelForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create panel", description: error.message, variant: "destructive" });
    },
  });

  const updatePanelMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PanelFormData }) => {
      return apiRequest("PUT", `/api/admin/panels/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/panels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: "Panel updated successfully" });
      setPanelDialogOpen(false);
      setEditingPanel(null);
      panelForm.reset();
    },
    onError: () => {
      toast({ title: "Failed to update panel", variant: "destructive" });
    },
  });

  const deletePanelMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/panels/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/panels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: "Panel deleted" });
      setDeleteDialogOpen(false);
      setDeletingPanelId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete panel", variant: "destructive" });
    },
  });

  const importPanelsMutation = useMutation({
    mutationFn: async ({ data, jobId }: { data: any[]; jobId?: string }) => {
      return apiRequest("POST", "/api/admin/panels/import", { data, jobId: jobId || undefined });
    },
    onSuccess: async (response) => {
      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/panels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      let message = `Imported ${result.imported} panels, ${result.skipped} skipped`;
      if (result.errors && result.errors.length > 0) {
        message += `. ${result.errors.length} errors.`;
      }
      toast({ title: message });
      setImportDialogOpen(false);
      setImportData([]);
      setSelectedJobForImport("");
    },
    onError: async (error: any) => {
      const errorData = error.response ? await error.response.json().catch(() => ({})) : {};
      toast({ 
        title: "Import failed", 
        description: errorData.error || error.message,
        variant: "destructive" 
      });
    },
  });

  // PDF analysis mutation
  const analyzePdfMutation = useMutation({
    mutationFn: async ({ panelId, pdfBase64 }: { panelId: string; pdfBase64: string }) => {
      return apiRequest("POST", `/api/admin/panels/${panelId}/analyze-pdf`, { pdfBase64 });
    },
    onSuccess: async (response) => {
      const result = await response.json();
      if (result.extracted) {
        setBuildFormData({
          loadWidth: result.extracted.loadWidth || "",
          loadHeight: result.extracted.loadHeight || "",
          panelThickness: result.extracted.panelThickness || "",
          panelVolume: result.extracted.panelVolume || "",
          panelMass: result.extracted.panelMass || "",
          panelArea: result.extracted.panelArea || "",
          day28Fc: result.extracted.day28Fc || "",
          liftFcm: result.extracted.liftFcm || "",
          rotationalLifters: result.extracted.rotationalLifters || "",
          primaryLifters: result.extracted.primaryLifters || "",
        });
        toast({ title: "PDF analyzed successfully" });
      }
      setIsAnalyzing(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to analyze PDF", description: error.message, variant: "destructive" });
      setIsAnalyzing(false);
    },
  });

  // Approve for production mutation
  const approveProductionMutation = useMutation({
    mutationFn: async ({ panelId, data }: { panelId: string; data: typeof buildFormData }) => {
      return apiRequest("POST", `/api/admin/panels/${panelId}/approve-production`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/panels"] });
      // Also invalidate jobs cache since Production Report uses it to get panel data
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: "Panel approved for production" });
      closeBuildDialog();
    },
    onError: (error: any) => {
      toast({ title: "Failed to approve panel", description: error.message, variant: "destructive" });
    },
  });

  // Revoke production approval mutation
  const revokeApprovalMutation = useMutation({
    mutationFn: async (panelId: string) => {
      return apiRequest("POST", `/api/admin/panels/${panelId}/revoke-production`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/panels"] });
      // Also invalidate jobs cache since Production Report uses it to get panel data
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: "Production approval revoked" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to revoke approval", description: error.message, variant: "destructive" });
    },
  });

  // Build dialog functions
  const openBuildDialog = (panel: PanelRegister) => {
    setBuildingPanel(panel);
    setBuildFormData({
      loadWidth: panel.loadWidth || "",
      loadHeight: panel.loadHeight || "",
      panelThickness: panel.panelThickness || "",
      panelVolume: panel.panelVolume || "",
      panelMass: panel.panelMass || "",
      panelArea: panel.panelArea || "",
      day28Fc: panel.day28Fc || "",
      liftFcm: panel.liftFcm || "",
      rotationalLifters: panel.rotationalLifters || "",
      primaryLifters: panel.primaryLifters || "",
    });
    setPdfFile(null);
    setBuildDialogOpen(true);
  };

  const closeBuildDialog = () => {
    setBuildDialogOpen(false);
    setBuildingPanel(null);
    setPdfFile(null);
    setBuildFormData({
      loadWidth: "",
      loadHeight: "",
      panelThickness: "",
      panelVolume: "",
      panelMass: "",
      panelArea: "",
      day28Fc: "",
      liftFcm: "",
      rotationalLifters: "",
      primaryLifters: "",
    });
  };

  const handlePdfDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type === "application/pdf" || file.name.endsWith(".pdf"))) {
      setPdfFile(file);
    } else {
      toast({ title: "Please upload a PDF file", variant: "destructive" });
    }
  }, [toast]);

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFile(file);
    }
  };

  const analyzePdf = async () => {
    if (!pdfFile || !buildingPanel) return;
    
    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string)?.split(",")[1];
      if (base64) {
        analyzePdfMutation.mutate({ panelId: buildingPanel.id, pdfBase64: base64 });
      }
    };
    reader.readAsDataURL(pdfFile);
  };

  const handleApproveProduction = () => {
    if (!buildingPanel) return;
    approveProductionMutation.mutate({ panelId: buildingPanel.id, data: buildFormData });
  };

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
      setSelectedJobForImport(filterJobId || "");
      setImportDialogOpen(true);
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadTemplate = () => {
    // Check if jobs exist
    if (!jobs || jobs.length === 0) {
      toast({
        title: "No Jobs in System",
        description: "Please load jobs into the system before downloading the template. No panels can be added for jobs that don't exist.",
        variant: "destructive",
      });
      return;
    }
    
    // Create panels template sheet with example rows
    const template = [
      { "Job Number": jobs[0]?.jobNumber || "JOB-001", "Panel Mark": "PM-001", "Panel Type": "WALL", "Description": "Panel description", "Drawing Code": "DWG-001", "Sheet Number": "A001", "Estimated Hours": 8 },
      { "Job Number": jobs[0]?.jobNumber || "JOB-001", "Panel Mark": "PM-002", "Panel Type": "COLUMN", "Description": "Column panel", "Drawing Code": "DWG-001", "Sheet Number": "A002", "Estimated Hours": 6 },
    ];
    const panelsSheet = XLSX.utils.json_to_sheet(template);
    
    // Create jobs reference sheet with existing jobs
    const jobsData = jobs.map(j => ({
      "Job Number": j.jobNumber,
      "Job Name": j.name,
      "Client": j.client || "",
      "Status": j.status,
    }));
    const jobsSheet = XLSX.utils.json_to_sheet(jobsData);
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, panelsSheet, "Panels");
    XLSX.utils.book_append_sheet(wb, jobsSheet, "Jobs Reference");
    XLSX.writeFile(wb, "panels_import_template.xlsx");
    
    setTemplateDialogOpen(false);
  };

  const openCreateDialog = () => {
    setEditingPanel(null);
    panelForm.reset({
      jobId: filterJobId || "",
      panelMark: "",
      panelType: "WALL",
      description: "",
      drawingCode: "",
      sheetNumber: "",
      estimatedHours: undefined,
      status: "NOT_STARTED",
    });
    setPanelDialogOpen(true);
  };

  const openEditDialog = (panel: PanelRegister) => {
    setEditingPanel(panel);
    panelForm.reset({
      jobId: panel.jobId,
      panelMark: panel.panelMark,
      panelType: panel.panelType || "WALL",
      description: panel.description || "",
      drawingCode: panel.drawingCode || "",
      sheetNumber: panel.sheetNumber || "",
      estimatedHours: panel.estimatedHours || undefined,
      status: panel.status,
    });
    setPanelDialogOpen(true);
  };

  const onSubmit = (data: PanelFormData) => {
    if (editingPanel) {
      updatePanelMutation.mutate({ id: editingPanel.id, data });
    } else {
      createPanelMutation.mutate(data);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      NOT_STARTED: { variant: "outline", icon: AlertCircle },
      IN_PROGRESS: { variant: "default", icon: ClockIcon },
      COMPLETED: { variant: "secondary", icon: CheckCircle },
      ON_HOLD: { variant: "destructive", icon: Pause },
    };
    const { variant, icon: Icon } = config[status] || config.NOT_STARTED;
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const getProgress = (panel: PanelRegister) => {
    if (!panel.estimatedHours || panel.estimatedHours === 0) return null;
    const percent = Math.min(100, ((panel.actualHours || 0) / panel.estimatedHours) * 100);
    return percent;
  };

  const statusCounts = {
    total: filteredPanels?.length || 0,
    notStarted: filteredPanels?.filter(p => p.status === "NOT_STARTED").length || 0,
    inProgress: filteredPanels?.filter(p => p.status === "IN_PROGRESS").length || 0,
    completed: filteredPanels?.filter(p => p.status === "COMPLETED").length || 0,
    onHold: filteredPanels?.filter(p => p.status === "ON_HOLD").length || 0,
  };

  if (panelsLoading) {
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
        <div className="flex items-center gap-4">
          {filterJobId && (
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/jobs")} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-panels-title">
              Panel Register
              {currentJob && <span className="text-muted-foreground ml-2">- {currentJob.jobNumber}</span>}
            </h1>
            <p className="text-muted-foreground">
              {filterJobId ? `Panels for ${currentJob?.name || "job"}` : "Manage panel register for all jobs"}
            </p>
          </div>
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
          <Button variant="outline" onClick={() => setTemplateDialogOpen(true)} data-testid="button-download-template">
            <Download className="h-4 w-4 mr-2" />
            Template
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="button-import">
            <Upload className="h-4 w-4 mr-2" />
            Import Excel
          </Button>
          <Button onClick={openCreateDialog} data-testid="button-create-panel">
            <Plus className="h-4 w-4 mr-2" />
            Add Panel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter("all")} data-testid="card-filter-all">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{statusCounts.total}</div>
            <div className="text-sm text-muted-foreground">Total Panels</div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter("NOT_STARTED")} data-testid="card-filter-not-started">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-muted-foreground">{statusCounts.notStarted}</div>
            <div className="text-sm text-muted-foreground">Not Started</div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter("IN_PROGRESS")} data-testid="card-filter-in-progress">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-500">{statusCounts.inProgress}</div>
            <div className="text-sm text-muted-foreground">In Progress</div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter("COMPLETED")} data-testid="card-filter-completed">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-500">{statusCounts.completed}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter("ON_HOLD")} data-testid="card-filter-on-hold">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-500">{statusCounts.onHold}</div>
            <div className="text-sm text-muted-foreground">On Hold</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Panel List
              </CardTitle>
              <CardDescription>
                {filteredPanels?.length || 0} panels {statusFilter !== "all" && `(${statusFilter.replace("_", " ")})`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Switch 
                  id="group-by-job" 
                  checked={groupByJob} 
                  onCheckedChange={setGroupByJob}
                  data-testid="switch-group-by-job"
                />
                <Label htmlFor="group-by-job" className="text-sm cursor-pointer">
                  Group by Job
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                {!filterJobId && (
                  <Select value={jobFilter} onValueChange={setJobFilter}>
                    <SelectTrigger className="w-[180px]" data-testid="select-job-filter">
                      <SelectValue placeholder="All Jobs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Jobs</SelectItem>
                      {jobs?.filter(j => j.status === "ACTIVE").map(job => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.jobNumber} - {job.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="ON_HOLD">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {!filterJobId && !groupByJob && <TableHead>Job</TableHead>}
                <TableHead>Panel Mark</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Drawing / Sheet</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupByJob && !filterJobId ? (
                // Grouped by job view
                Object.entries(panelsByJob).length > 0 ? (
                  Object.entries(panelsByJob).map(([jobId, { job, panels: jobPanels }]) => {
                    const isCollapsed = collapsedJobs.has(jobId);
                    return (
                      <Fragment key={jobId}>
                        <TableRow 
                          className="bg-muted/50 hover:bg-muted cursor-pointer"
                          onClick={() => toggleJobCollapse(jobId)}
                          data-testid={`row-job-group-${jobId}`}
                        >
                          <TableCell colSpan={7}>
                            <div className="flex items-center gap-2">
                              {isCollapsed ? (
                                <ChevronRight className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                              <Layers className="h-4 w-4 text-primary" />
                              <span className="font-semibold">{job.jobNumber}</span>
                              <span className="text-muted-foreground">- {job.name}</span>
                              <Badge variant="secondary" className="ml-2">
                                {jobPanels.length} panel{jobPanels.length !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                        {!isCollapsed && jobPanels.map((panel) => (
                          <TableRow key={panel.id} data-testid={`row-panel-${panel.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-2 pl-6">
                                <Hash className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono font-medium">{panel.panelMark}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{panel.panelType?.replace("_", " ") || "WALL"}</Badge>
                            </TableCell>
                            <TableCell>{panel.description || "-"}</TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {panel.drawingCode && <div>Drawing: {panel.drawingCode}</div>}
                                {panel.sheetNumber && <div>Sheet: {panel.sheetNumber}</div>}
                                {!panel.drawingCode && !panel.sheetNumber && "-"}
                              </div>
                            </TableCell>
                            <TableCell>{getStatusBadge(panel.status)}</TableCell>
                            <TableCell>
                              {panel.estimatedHours ? (
                                <div className="space-y-1 w-24">
                                  <Progress value={getProgress(panel) || 0} className="h-2" />
                                  <div className="text-xs text-muted-foreground">
                                    {panel.actualHours || 0} / {panel.estimatedHours}h
                                  </div>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  {panel.actualHours || 0}h logged
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {panel.approvedForProduction ? (
                                  <Badge variant="secondary" className="gap-1 mr-2">
                                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                                    Approved
                                  </Badge>
                                ) : null}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => { e.stopPropagation(); openBuildDialog(panel); }}
                                  title={panel.approvedForProduction ? "Edit production details" : "Set up for production"}
                                  data-testid={`button-build-panel-${panel.id}`}
                                >
                                  <Hammer className="h-4 w-4 text-primary" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => { e.stopPropagation(); openEditDialog(panel); }}
                                  data-testid={`button-edit-panel-${panel.id}`}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingPanelId(panel.id);
                                    setDeleteDialogOpen(true);
                                  }}
                                  data-testid={`button-delete-panel-${panel.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No panels found. Add a panel or import from Excel.
                    </TableCell>
                  </TableRow>
                )
              ) : (
                // Flat list view
                <>
                  {filteredPanels?.map((panel) => (
                    <TableRow key={panel.id} data-testid={`row-panel-${panel.id}`}>
                      {!filterJobId && (
                        <TableCell>
                          <span className="font-mono text-sm">{panel.job.jobNumber}</span>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono font-medium">{panel.panelMark}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{panel.panelType?.replace("_", " ") || "WALL"}</Badge>
                      </TableCell>
                      <TableCell>{panel.description || "-"}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {panel.drawingCode && <div>Drawing: {panel.drawingCode}</div>}
                          {panel.sheetNumber && <div>Sheet: {panel.sheetNumber}</div>}
                          {!panel.drawingCode && !panel.sheetNumber && "-"}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(panel.status)}</TableCell>
                      <TableCell>
                        {panel.estimatedHours ? (
                          <div className="space-y-1 w-24">
                            <Progress value={getProgress(panel) || 0} className="h-2" />
                            <div className="text-xs text-muted-foreground">
                              {panel.actualHours || 0} / {panel.estimatedHours}h
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {panel.actualHours || 0}h logged
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {panel.approvedForProduction ? (
                            <Badge variant="secondary" className="gap-1 mr-2">
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              Approved
                            </Badge>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openBuildDialog(panel)}
                            title={panel.approvedForProduction ? "Edit production details" : "Set up for production"}
                            data-testid={`button-build-panel-${panel.id}`}
                          >
                            <Hammer className="h-4 w-4 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(panel)}
                            data-testid={`button-edit-panel-${panel.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingPanelId(panel.id);
                              setDeleteDialogOpen(true);
                            }}
                            data-testid={`button-delete-panel-${panel.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!filteredPanels || filteredPanels.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={filterJobId ? 7 : 8} className="text-center py-8 text-muted-foreground">
                        No panels found. Add a panel or import from Excel.
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={panelDialogOpen} onOpenChange={setPanelDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPanel ? "Edit Panel" : "Create New Panel"}</DialogTitle>
            <DialogDescription>
              {editingPanel ? "Update panel details" : "Add a new panel to the register"}
            </DialogDescription>
          </DialogHeader>
          <Form {...panelForm}>
            <form onSubmit={panelForm.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={panelForm.control}
                name="jobId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!!filterJobId}>
                      <FormControl>
                        <SelectTrigger data-testid="select-panel-job">
                          <SelectValue placeholder="Select job" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {jobs?.map((job) => (
                          <SelectItem key={job.id} value={job.id}>
                            {job.jobNumber} - {job.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={panelForm.control}
                  name="panelMark"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Panel Mark</FormLabel>
                      <FormControl>
                        <Input placeholder="PM-001" {...field} data-testid="input-panel-mark" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={panelForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-panel-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                          <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                          <SelectItem value="COMPLETED">Completed</SelectItem>
                          <SelectItem value="ON_HOLD">On Hold</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={panelForm.control}
                name="panelType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Panel Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-panel-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {panelTypes && panelTypes.length > 0 ? (
                          panelTypes.map((pt) => (
                            <SelectItem key={pt.id} value={pt.code}>{pt.name}</SelectItem>
                          ))
                        ) : (
                          <>
                            <SelectItem value="WALL">Wall</SelectItem>
                            <SelectItem value="COLUMN">Column</SelectItem>
                            <SelectItem value="CUBE_BASE">Cube Base</SelectItem>
                            <SelectItem value="CUBE_RING">Cube Ring</SelectItem>
                            <SelectItem value="LANDING_WALL">Landing Wall</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={panelForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Panel description" {...field} data-testid="input-panel-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={panelForm.control}
                  name="drawingCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Drawing Code</FormLabel>
                      <FormControl>
                        <Input placeholder="DWG-001" {...field} data-testid="input-panel-drawing" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={panelForm.control}
                  name="sheetNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sheet Number</FormLabel>
                      <FormControl>
                        <Input placeholder="A001" {...field} data-testid="input-panel-sheet" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={panelForm.control}
                name="estimatedHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Hours</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="8"
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-panel-hours"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPanelDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createPanelMutation.isPending || updatePanelMutation.isPending}
                  data-testid="button-save-panel"
                >
                  {(createPanelMutation.isPending || updatePanelMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Save className="h-4 w-4 mr-2" />
                  {editingPanel ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Panels from Excel
            </DialogTitle>
            <DialogDescription>
              Review the data before importing. {importData.length} rows found.
              {importData.some(r => r["Job Number"] || r.jobNumber || r.job_number || r["Job"]) 
                ? " Job numbers detected in Excel."
                : " No job numbers in Excel - select a fallback job below."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Fallback Job (used when Excel row has no Job Number)</label>
              <Select value={selectedJobForImport} onValueChange={setSelectedJobForImport}>
                <SelectTrigger className="mt-1" data-testid="select-import-job">
                  <SelectValue placeholder="Select fallback job (optional if job in Excel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No fallback - require job in Excel</SelectItem>
                  {jobs?.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.jobNumber} - {job.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="max-h-[250px] overflow-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Number</TableHead>
                    <TableHead>Panel Mark</TableHead>
                    <TableHead>Panel Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Est. Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importData.slice(0, 10).map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-sm">{row["Job Number"] || row.jobNumber || row.job_number || row["Job"] || "-"}</TableCell>
                      <TableCell className="font-mono">{row.panelMark || row["Panel Mark"] || row["Mark"] || "-"}</TableCell>
                      <TableCell>{row.panelType || row["Panel Type"] || row["Type"] || "WALL"}</TableCell>
                      <TableCell>{row.description || row["Description"] || "-"}</TableCell>
                      <TableCell>{row.estimatedHours || row["Estimated Hours"] || "-"}</TableCell>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => importPanelsMutation.mutate({ 
                data: importData, 
                jobId: selectedJobForImport === "none" ? undefined : selectedJobForImport 
              })}
              disabled={importPanelsMutation.isPending}
              data-testid="button-confirm-import"
            >
              {importPanelsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Upload className="h-4 w-4 mr-2" />
              Import {importData.length} Panels
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Panel?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this panel from the register.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPanelId && deletePanelMutation.mutate(deletingPanelId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deletePanelMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Build/Production Approval Dialog */}
      <Dialog open={buildDialogOpen} onOpenChange={(open) => !open && closeBuildDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hammer className="h-5 w-5" />
              {buildingPanel?.approvedForProduction ? "Edit Production Details" : "Set Up for Production"}
            </DialogTitle>
            <DialogDescription>
              {buildingPanel && (
                <span>
                  Panel: <strong className="font-mono">{buildingPanel.panelMark}</strong>
                  {buildingPanel.approvedForProduction && (
                    <Badge variant="secondary" className="ml-2 gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Currently Approved
                    </Badge>
                  )}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* PDF Upload Section */}
            <div className="space-y-2">
              <Label>Production Drawing PDF</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handlePdfDrop}
              >
                {pdfFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">{pdfFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPdfFile(null)}
                      data-testid="button-remove-pdf"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Drag and drop a PDF here, or click to browse
                    </p>
                    <input
                      type="file"
                      ref={pdfInputRef}
                      accept=".pdf"
                      onChange={handlePdfSelect}
                      className="hidden"
                      data-testid="input-pdf-upload"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => pdfInputRef.current?.click()}
                      data-testid="button-browse-pdf"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Browse
                    </Button>
                  </div>
                )}
              </div>
              {pdfFile && (
                <Button
                  onClick={analyzePdf}
                  disabled={isAnalyzing}
                  className="w-full"
                  data-testid="button-analyze-pdf"
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  {isAnalyzing ? "Analyzing PDF..." : "Analyze PDF with AI"}
                </Button>
              )}
            </div>

            {/* Panel Specifications Form */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="loadWidth">Load Width (mm)</Label>
                <Input
                  id="loadWidth"
                  value={buildFormData.loadWidth}
                  onChange={(e) => setBuildFormData({ ...buildFormData, loadWidth: e.target.value })}
                  placeholder="e.g., 3000"
                  data-testid="input-load-width"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loadHeight">Load Height (mm)</Label>
                <Input
                  id="loadHeight"
                  value={buildFormData.loadHeight}
                  onChange={(e) => setBuildFormData({ ...buildFormData, loadHeight: e.target.value })}
                  placeholder="e.g., 2500"
                  data-testid="input-load-height"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="panelThickness">Panel Thickness (mm)</Label>
                <Input
                  id="panelThickness"
                  value={buildFormData.panelThickness}
                  onChange={(e) => setBuildFormData({ ...buildFormData, panelThickness: e.target.value })}
                  placeholder="e.g., 200"
                  data-testid="input-panel-thickness"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="panelVolume">Panel Volume (m³)</Label>
                <Input
                  id="panelVolume"
                  value={buildFormData.panelVolume}
                  onChange={(e) => setBuildFormData({ ...buildFormData, panelVolume: e.target.value })}
                  placeholder="e.g., 1.5"
                  data-testid="input-panel-volume"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="panelMass">Panel Mass (kg)</Label>
                <Input
                  id="panelMass"
                  value={buildFormData.panelMass}
                  onChange={(e) => setBuildFormData({ ...buildFormData, panelMass: e.target.value })}
                  placeholder="e.g., 3750"
                  data-testid="input-panel-mass"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="panelArea">Panel Area (m²)</Label>
                <Input
                  id="panelArea"
                  value={buildFormData.panelArea}
                  onChange={(e) => setBuildFormData({ ...buildFormData, panelArea: e.target.value })}
                  placeholder="e.g., 7.5"
                  data-testid="input-panel-area"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="day28Fc">28-Day f'c (MPa)</Label>
                <Input
                  id="day28Fc"
                  value={buildFormData.day28Fc}
                  onChange={(e) => setBuildFormData({ ...buildFormData, day28Fc: e.target.value })}
                  placeholder="e.g., 40"
                  data-testid="input-day28-fc"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="liftFcm">Lift f'cm (MPa)</Label>
                <Input
                  id="liftFcm"
                  value={buildFormData.liftFcm}
                  onChange={(e) => setBuildFormData({ ...buildFormData, liftFcm: e.target.value })}
                  placeholder="e.g., 25"
                  data-testid="input-lift-fcm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rotationalLifters">Rotational Lifters</Label>
                <Input
                  id="rotationalLifters"
                  value={buildFormData.rotationalLifters}
                  onChange={(e) => setBuildFormData({ ...buildFormData, rotationalLifters: e.target.value })}
                  placeholder="e.g., 2x ERH-2.5T"
                  data-testid="input-rotational-lifters"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="primaryLifters">Primary Lifters</Label>
                <Input
                  id="primaryLifters"
                  value={buildFormData.primaryLifters}
                  onChange={(e) => setBuildFormData({ ...buildFormData, primaryLifters: e.target.value })}
                  placeholder="e.g., 4x Anchor Point"
                  data-testid="input-primary-lifters"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            {buildingPanel?.approvedForProduction && (
              <Button
                variant="destructive"
                onClick={() => buildingPanel && revokeApprovalMutation.mutate(buildingPanel.id)}
                disabled={revokeApprovalMutation.isPending}
                data-testid="button-revoke-approval"
              >
                {revokeApprovalMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <XCircle className="h-4 w-4 mr-2" />
                Revoke Approval
              </Button>
            )}
            <Button variant="outline" onClick={closeBuildDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleApproveProduction}
              disabled={approveProductionMutation.isPending}
              data-testid="button-approve-production"
            >
              {approveProductionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {buildingPanel?.approvedForProduction ? "Update & Keep Approved" : "Approve for Production"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Download Confirmation Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Download Panel Import Template
            </DialogTitle>
            <DialogDescription>
              Before downloading the template, please confirm:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Have you loaded jobs into the system?
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
                No panels can be added for jobs that do not exist in the system. The template will include a "Jobs Reference" sheet with all current jobs.
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              <p><strong>Current Jobs in System:</strong> {jobs?.length || 0}</p>
              {jobs && jobs.length > 0 && (
                <ul className="mt-2 list-disc list-inside max-h-32 overflow-auto">
                  {jobs.slice(0, 10).map(j => (
                    <li key={j.id}>{j.jobNumber} - {j.name}</li>
                  ))}
                  {jobs.length > 10 && <li className="text-muted-foreground">...and {jobs.length - 10} more</li>}
                </ul>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={downloadTemplate} disabled={!jobs || jobs.length === 0} data-testid="button-confirm-download-template">
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
