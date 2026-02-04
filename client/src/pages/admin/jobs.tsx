import { useState, useRef, useEffect, Fragment } from "react";
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
  User,
  Phone,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  FileUp,
  CheckCircle2,
  XCircle,
  BarChart3,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type { Job, PanelRegister, User as UserType } from "@shared/schema";

const AUSTRALIAN_STATES = ["VIC", "NSW", "QLD", "SA", "WA", "TAS", "NT", "ACT"] as const;

const JOB_COLOR_PALETTE = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#22c55e", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#84cc16", // lime
  "#a855f7", // purple
];

const jobSchema = z.object({
  jobNumber: z.string().min(1, "Job number is required"),
  name: z.string().min(1, "Name is required"),
  client: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.enum(AUSTRALIAN_STATES).optional().nullable(),
  description: z.string().optional(),
  craneCapacity: z.string().optional(),
  numberOfBuildings: z.number().int().min(0).optional().nullable(),
  levels: z.string().optional(),
  lowestLevel: z.string().optional(),
  highestLevel: z.string().optional(),
  productionStartDate: z.string().optional(),
  expectedCycleTimePerFloor: z.number().int().min(1).optional().nullable(),
  daysInAdvance: z.number().int().min(1).optional().nullable(),
  siteContact: z.string().optional(),
  siteContactPhone: z.string().optional(),
  status: z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]),
  projectManagerId: z.string().optional().nullable(),
  productionSlotColor: z.string().optional().nullable(),
});

type JobFormData = z.infer<typeof jobSchema>;

interface JobWithPanels extends Job {
  panels: PanelRegister[];
  panelCount?: number;
  completedPanelCount?: number;
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

type SortField = "jobNumber" | "client" | "status";
type SortDirection = "asc" | "desc";

export default function AdminJobsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [deletingJobPanelCount, setDeletingJobPanelCount] = useState(0);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [costOverridesDialogOpen, setCostOverridesDialogOpen] = useState(false);
  const [costOverridesJob, setCostOverridesJob] = useState<JobWithPanels | null>(null);
  const [localOverrides, setLocalOverrides] = useState<CostOverride[]>([]);
  
  // Estimate import state
  const [estimateDialogOpen, setEstimateDialogOpen] = useState(false);
  const [estimateJob, setEstimateJob] = useState<JobWithPanels | null>(null);
  const [estimateFile, setEstimateFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const estimateFileInputRef = useRef<HTMLInputElement>(null);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("jobNumber");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [groupByState, setGroupByState] = useState(true);
  
  // Level cycle times state (integrated into Edit Job dialog)
  const [levelCycleTimes, setLevelCycleTimes] = useState<{ buildingNumber: number; level: string; levelOrder: number; cycleDays: number }[]>([]);
  const [isLoadingLevelData, setIsLoadingLevelData] = useState(false);
  const [editDialogTab, setEditDialogTab] = useState("details");
  
  // Cycle times confirmation dialog state
  const [cycleTimesConfirmOpen, setCycleTimesConfirmOpen] = useState(false);
  const [productionSlotStatus, setProductionSlotStatus] = useState<{
    hasSlots: boolean;
    hasNonStartedSlots: boolean;
    allStarted: boolean;
    totalSlots: number;
    nonStartedCount: number;
  } | null>(null);

  const { data: jobs, isLoading } = useQuery<JobWithPanels[]>({
    queryKey: ["/api/admin/jobs"],
  });

  const { data: users } = useQuery<UserType[]>({
    queryKey: ["/api/admin/users"],
  });

  // Filter and sort jobs
  const filteredAndSortedJobs = (jobs || [])
    .filter((job) => {
      // Status filter
      if (statusFilter !== "all" && job.status !== statusFilter) return false;
      
      // State filter
      if (stateFilter !== "all") {
        if (stateFilter === "none" && job.state) return false;
        if (stateFilter !== "none" && job.state !== stateFilter) return false;
      }
      
      // Search filter (job number, name, client, address, city)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          job.jobNumber.toLowerCase().includes(query) ||
          job.name.toLowerCase().includes(query) ||
          (job.client && job.client.toLowerCase().includes(query)) ||
          (job.address && job.address.toLowerCase().includes(query)) ||
          (job.city && job.city.toLowerCase().includes(query))
        );
      }
      return true;
    })
    .sort((a, b) => {
      // If grouping by state, sort by state first
      if (groupByState) {
        const stateA = a.state || "ZZZ"; // Put null states at end
        const stateB = b.state || "ZZZ";
        if (stateA !== stateB) return stateA.localeCompare(stateB);
      }
      
      let comparison = 0;
      switch (sortField) {
        case "jobNumber":
          comparison = a.jobNumber.localeCompare(b.jobNumber);
          break;
        case "client":
          comparison = (a.client || "").localeCompare(b.client || "");
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

  // Group jobs by state for display
  const groupedJobs = groupByState
    ? filteredAndSortedJobs.reduce((acc, job) => {
        const state = job.state || "No State";
        if (!acc[state]) acc[state] = [];
        acc[state].push(job);
        return acc;
      }, {} as Record<string, JobWithPanels[]>)
    : { "All Jobs": filteredAndSortedJobs };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    return sortDirection === "asc" 
      ? <ArrowUp className="h-4 w-4 ml-1" /> 
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const jobForm = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      jobNumber: "",
      name: "",
      client: "",
      address: "",
      description: "",
      siteContact: "",
      siteContactPhone: "",
      status: "ACTIVE",
      projectManagerId: null,
      productionSlotColor: null,
    },
  });

  const createJobMutation = useMutation({
    mutationFn: async (data: JobFormData) => {
      return apiRequest("POST", "/api/admin/jobs", data);
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
      return apiRequest("PUT", `/api/admin/jobs/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: "Job updated successfully" });
      setJobDialogOpen(false);
      setEditingJob(null);
      jobForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to update job", description: error.message, variant: "destructive" });
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/jobs/${id}`, {});
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || "Failed to delete job");
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: "Job deleted successfully" });
      setDeleteDialogOpen(false);
      setDeletingJobId(null);
      setDeletingJobPanelCount(0);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Cannot delete job", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Job totals query
  const { data: jobTotals, refetch: refetchJobTotals } = useQuery<{
    totalAreaM2: number;
    totalVolumeM3: number;
    totalElements: number;
    pendingCount: number;
    validatedCount: number;
    panelCount: number;
  }>({
    queryKey: ["/api/jobs", estimateJob?.id, "totals"],
    queryFn: async () => {
      if (!estimateJob?.id) return null;
      const res = await fetch(`/api/jobs/${estimateJob.id}/totals`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch totals");
      return res.json();
    },
    enabled: !!estimateJob?.id && estimateDialogOpen,
  });

  // Estimate import mutation
  const importEstimateMutation = useMutation({
    mutationFn: async ({ jobId, file, replace }: { jobId: string; file: File; replace: boolean }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("replace", String(replace));
      
      const res = await fetch(`/api/jobs/${jobId}/panels/import-estimate`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to import estimate");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/panels"] });
      refetchJobTotals();
      toast({ 
        title: "Estimate imported successfully",
        description: `Imported ${data.totals.imported} panels from ${data.totals.sheetsProcessed} sheets`,
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Import failed", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleOpenEstimateImport = (job: JobWithPanels) => {
    setEstimateJob(job);
    setEstimateFile(null);
    setReplaceExisting(false);
    setImportResult(null);
    setEstimateDialogOpen(true);
  };

  const handleEstimateFileSelect = (file: File) => {
    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      setEstimateFile(file);
      setImportResult(null);
    } else {
      toast({ title: "Invalid file type", description: "Please select an Excel file (.xlsx or .xls)", variant: "destructive" });
    }
  };

  const handleEstimateDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleEstimateFileSelect(file);
  };

  const handleRunEstimateImport = () => {
    if (!estimateJob || !estimateFile) return;
    importEstimateMutation.mutate({
      jobId: estimateJob.id,
      file: estimateFile,
      replace: replaceExisting,
    });
  };

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
      { 
        "Job Number": "JOB001", 
        "Name": "Example Job", 
        "Client": "Example Client", 
        "Address": "123 Example St", 
        "City": "Melbourne",
        "State": "VIC",
        "Site Contact": "John Smith",
        "Site Contact Phone": "0412 345 678",
        "Description": "Description here",
        "Number of Buildings": 2,
        "Levels": "Ground,L1,L2,Roof",
        "Status": "ACTIVE"
      },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jobs");
    XLSX.writeFile(wb, "jobs_template.xlsx");
  };

  const getNextAvailableColor = () => {
    const usedColors = new Set(jobs?.map(j => j.productionSlotColor).filter(Boolean) || []);
    const availableColor = JOB_COLOR_PALETTE.find(c => !usedColors.has(c));
    return availableColor || JOB_COLOR_PALETTE[(jobs?.length || 0) % JOB_COLOR_PALETTE.length];
  };

  const openCreateDialog = () => {
    setEditingJob(null);
    jobForm.reset({
      jobNumber: "",
      name: "",
      client: "",
      address: "",
      city: "",
      state: null,
      description: "",
      craneCapacity: "",
      numberOfBuildings: null,
      levels: "",
      lowestLevel: "",
      highestLevel: "",
      productionStartDate: "",
      expectedCycleTimePerFloor: null,
      daysInAdvance: 7,
      siteContact: "",
      siteContactPhone: "",
      status: "ACTIVE",
      projectManagerId: null,
      productionSlotColor: getNextAvailableColor(),
    });
    setJobDialogOpen(true);
  };

  const openEditDialog = async (job: Job) => {
    setEditingJob(job);
    setEditDialogTab("details");
    jobForm.reset({
      jobNumber: job.jobNumber,
      name: job.name,
      client: job.client || "",
      address: job.address || "",
      city: job.city || "",
      state: job.state || null,
      description: job.description || "",
      craneCapacity: job.craneCapacity || "",
      numberOfBuildings: job.numberOfBuildings ?? null,
      levels: job.levels || "",
      lowestLevel: job.lowestLevel || "",
      highestLevel: job.highestLevel || "",
      productionStartDate: job.productionStartDate ? new Date(job.productionStartDate).toISOString().split('T')[0] : "",
      expectedCycleTimePerFloor: job.expectedCycleTimePerFloor ?? null,
      daysInAdvance: job.daysInAdvance ?? 7,
      siteContact: job.siteContact || "",
      siteContactPhone: job.siteContactPhone || "",
      status: job.status,
      projectManagerId: job.projectManagerId || null,
      productionSlotColor: job.productionSlotColor || getNextAvailableColor(),
    });
    setJobDialogOpen(true);
    
    // Load level cycle times in background
    setLevelCycleTimes([]);
    setIsLoadingLevelData(true);
    try {
      const response = await fetch(`/api/admin/jobs/${job.id}/build-levels`);
      if (response.ok) {
        const data = await response.json();
        setLevelCycleTimes(data);
      }
    } catch (error) {
      console.error("Failed to load level cycle times:", error);
    } finally {
      setIsLoadingLevelData(false);
    }
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

  // Level cycle times functions
  const saveLevelCycleTimesMutation = useMutation({
    mutationFn: async ({ jobId, cycleTimes }: { jobId: string; cycleTimes: typeof levelCycleTimes }) => {
      const res = await apiRequest("POST", `/api/admin/jobs/${jobId}/level-cycle-times`, { cycleTimes });
      return res.json();
    },
    onSuccess: async () => {
      toast({ title: "Saved", description: "Level cycle times updated successfully" });
      
      if (!editingJob) return;
      
      try {
        const res = await fetch(`/api/admin/jobs/${editingJob.id}/production-slot-status`);
        if (res.ok) {
          const status = await res.json();
          setProductionSlotStatus(status);
          setCycleTimesConfirmOpen(true);
        }
      } catch (error) {
        console.error("Failed to check production slot status:", error);
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateProductionSlotsMutation = useMutation({
    mutationFn: async ({ jobId, action }: { jobId: string; action: "create" | "update" }) => {
      const res = await apiRequest("POST", `/api/admin/jobs/${jobId}/update-production-slots`, { action });
      return res.json();
    },
    onSuccess: (data) => {
      setCycleTimesConfirmOpen(false);
      if (data.action === "created") {
        toast({ title: "Success", description: `Created ${data.count} production slots` });
      } else if (data.action === "updated") {
        toast({ title: "Success", description: `Updated ${data.count} production slots` });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleLevelCycleTimeChange = (index: number, value: number) => {
    setLevelCycleTimes(prev => prev.map((item, i) => 
      i === index ? { ...item, cycleDays: value } : item
    ));
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
            Job Register
          </CardTitle>
          <CardDescription>
            {filteredAndSortedJobs.length} of {jobs?.length || 0} jobs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-jobs"
              />
            </div>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-[120px]" data-testid="select-state-filter">
                <SelectValue placeholder="Filter by state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                <SelectItem value="none">No State</SelectItem>
                {AUSTRALIAN_STATES.map((state) => (
                  <SelectItem key={state} value={state}>{state}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="ON_HOLD">On Hold</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={groupByState ? "default" : "outline"}
              size="sm"
              onClick={() => setGroupByState(!groupByState)}
              data-testid="button-toggle-grouping"
            >
              <MapPin className="h-4 w-4 mr-1" />
              Group by State
            </Button>
            {(searchQuery || statusFilter !== "all" || stateFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearchQuery(""); setStatusFilter("all"); setStateFilter("all"); }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            )}
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1 p-0" />
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-medium hover:bg-transparent"
                    onClick={() => handleSort("jobNumber")}
                    data-testid="button-sort-job-number"
                  >
                    Job Number {getSortIcon("jobNumber")}
                  </Button>
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-medium hover:bg-transparent"
                    onClick={() => handleSort("client")}
                    data-testid="button-sort-client"
                  >
                    Client {getSortIcon("client")}
                  </Button>
                </TableHead>
                <TableHead>Location</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-medium hover:bg-transparent"
                    onClick={() => handleSort("status")}
                    data-testid="button-sort-status"
                  >
                    Status {getSortIcon("status")}
                  </Button>
                </TableHead>
                <TableHead>Panels</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(groupedJobs).map(([stateGroup, stateJobs]) => (
                <Fragment key={stateGroup}>
                  {groupByState && stateGroup !== "All Jobs" && (
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={8} className="py-2">
                        <div className="flex items-center gap-2 font-semibold">
                          <MapPin className="h-4 w-4" />
                          {stateGroup}
                          <Badge variant="secondary" className="ml-2">{stateJobs.length}</Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {stateJobs.map((job) => (
                    <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                      <TableCell className="w-1 p-0">
                        <div 
                          className="h-full w-1 min-h-[40px] rounded-r-sm"
                          style={{ backgroundColor: job.productionSlotColor || 'transparent' }}
                          title={`${job.jobNumber} - ${job.name}`}
                        />
                      </TableCell>
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
                            <div className="text-sm text-muted-foreground">{job.address}</div>
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
                      <TableCell>
                        <div className="text-sm">
                          {job.city && <span>{job.city}</span>}
                          {job.city && job.state && <span>, </span>}
                          {job.state && <span className="font-medium">{job.state}</span>}
                          {!job.city && !job.state && <span className="text-muted-foreground">-</span>}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(job.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/panels?jobId=${job.id}`)}
                          data-testid={`button-view-panels-${job.id}`}
                        >
                          <span className="text-green-500">{job.completedPanelCount || 0}</span>
                          <span className="mx-1">/</span>
                          <span>{job.panelCount || 0}</span>
                          <span className="ml-1 text-muted-foreground">panels</span>
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEstimateImport(job)}
                            title="Import from Estimate"
                            data-testid={`button-import-estimate-${job.id}`}
                          >
                            <FileUp className="h-4 w-4 text-blue-600" />
                          </Button>
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
                              setDeletingJobPanelCount(job.panelCount || 0);
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
                </Fragment>
              ))}
              {filteredAndSortedJobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {jobs?.length ? "No jobs match your filters." : "No jobs found. Add a job or import from Excel."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={jobDialogOpen} onOpenChange={setJobDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingJob ? "Edit Job" : "Create New Job"}</DialogTitle>
            <DialogDescription>
              {editingJob ? "Update job details" : "Add a new job to the system"}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={editDialogTab} onValueChange={setEditDialogTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details" data-testid="tab-job-details">Job Details</TabsTrigger>
              <TabsTrigger value="levelCycleTimes" disabled={!editingJob} data-testid="tab-level-cycle-times">
                Level Cycle Times
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="mt-4">
          <Form {...jobForm}>
            <form onSubmit={jobForm.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground">Basic Information</h3>
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
                          <Input placeholder="Job name" {...field} data-testid="input-job-name" />
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
                          <Input placeholder="Street address" {...field} data-testid="input-job-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={jobForm.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="City" {...field} data-testid="input-job-city" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={jobForm.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <Select 
                            onValueChange={(val) => field.onChange(val === "none" ? null : val)} 
                            value={field.value || "none"}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-job-state">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">-</SelectItem>
                              {AUSTRALIAN_STATES.map((state) => (
                                <SelectItem key={state} value={state}>{state}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={jobForm.control}
                      name="siteContact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Site Contact</FormLabel>
                          <FormControl>
                            <Input placeholder="Contact name" {...field} data-testid="input-job-site-contact" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={jobForm.control}
                      name="siteContactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Site Contact Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="Phone number" {...field} data-testid="input-job-site-contact-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
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
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground">Production Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={jobForm.control}
                      name="craneCapacity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Crane Capacity</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 50T" {...field} data-testid="input-job-crane-capacity" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={jobForm.control}
                      name="numberOfBuildings"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Number of Buildings</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min={0}
                              placeholder="e.g. 3" 
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : null)}
                              data-testid="input-job-number-of-buildings" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={jobForm.control}
                    name="levels"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Levels</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g. Ground,L1,L2,L3,Roof" 
                            {...field} 
                            onChange={(e) => {
                              field.onChange(e);
                              const levelsValue = e.target.value;
                              const levelsCount = parseInt(levelsValue, 10);
                              const lowestLevel = parseInt(jobForm.getValues("lowestLevel") || "0", 10);
                              if (!isNaN(levelsCount) && levelsCount > 0 && !isNaN(lowestLevel)) {
                                const calculatedHighest = lowestLevel + levelsCount - 1;
                                jobForm.setValue("highestLevel", String(calculatedHighest));
                              }
                            }}
                            data-testid="input-job-levels" 
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Comma-separated list of level names</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={jobForm.control}
                      name="lowestLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lowest Level</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g. Ground" 
                              {...field} 
                              onChange={(e) => {
                                field.onChange(e);
                                const lowestLevel = parseInt(e.target.value, 10);
                                const levelsValue = jobForm.getValues("levels");
                                const levelsCount = parseInt(levelsValue || "0", 10);
                                if (!isNaN(lowestLevel) && !isNaN(levelsCount) && levelsCount > 0) {
                                  const calculatedHighest = lowestLevel + levelsCount - 1;
                                  jobForm.setValue("highestLevel", String(calculatedHighest));
                                }
                              }}
                              data-testid="input-job-lowest-level" 
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">Starting level</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={jobForm.control}
                      name="highestLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Highest Level</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g. Roof" 
                              {...field} 
                              onChange={(e) => {
                                field.onChange(e);
                                const highestLevel = parseInt(e.target.value, 10);
                                const lowestLevel = parseInt(jobForm.getValues("lowestLevel") || "0", 10);
                                if (!isNaN(highestLevel) && !isNaN(lowestLevel) && highestLevel >= lowestLevel) {
                                  const calculatedLevels = highestLevel - lowestLevel + 1;
                                  jobForm.setValue("levels", String(calculatedLevels));
                                }
                              }}
                              data-testid="input-job-highest-level" 
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">Final level</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={jobForm.control}
                    name="productionStartDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Production Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-job-production-start-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={jobForm.control}
                      name="expectedCycleTimePerFloor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cycle Time (days)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1"
                              placeholder="e.g., 5"
                              value={field.value ?? ""} 
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                              data-testid="input-job-cycle-time-per-floor" 
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">Days per floor</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={jobForm.control}
                      name="daysInAdvance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Days in Advance</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1"
                              placeholder="e.g., 7"
                              value={field.value ?? ""} 
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                              data-testid="input-job-days-in-advance" 
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">Lead time before site</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={jobForm.control}
                    name="projectManagerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Manager</FormLabel>
                        <Select 
                          onValueChange={(val) => field.onChange(val === "none" ? null : val)} 
                          value={field.value || "none"}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-job-project-manager">
                              <SelectValue placeholder="Select project manager" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No Project Manager</SelectItem>
                            {users?.map((user) => (
                              <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={jobForm.control}
                    name="productionSlotColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Production Slot Color</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <input
                              type="color"
                              value={field.value || "#3b82f6"}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="h-9 w-14 cursor-pointer rounded border border-input"
                              data-testid="input-job-production-slot-color"
                            />
                          </FormControl>
                          <Input
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value)}
                            placeholder="#3b82f6"
                            className="flex-1 font-mono text-sm"
                            data-testid="input-job-production-slot-color-text"
                          />
                          {field.value && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => field.onChange(null)}
                              data-testid="button-clear-job-color"
                            >
                              Clear
                            </Button>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
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
            </TabsContent>
            
            <TabsContent value="levelCycleTimes" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Level-Specific Cycle Times</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure different production cycle times for each building level
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!editingJob) return;
                        setIsLoadingLevelData(true);
                        try {
                          const response = await fetch(`/api/admin/jobs/${editingJob.id}/generate-levels`);
                          if (response.ok) {
                            const data = await response.json();
                            setLevelCycleTimes(data);
                            toast({ title: "Levels generated from job settings" });
                          } else {
                            const error = await response.json();
                            toast({ title: "Error", description: error.error || "Failed to generate levels", variant: "destructive" });
                          }
                        } catch (error) {
                          toast({ title: "Error", description: "Failed to generate levels", variant: "destructive" });
                        } finally {
                          setIsLoadingLevelData(false);
                        }
                      }}
                      disabled={isLoadingLevelData}
                      data-testid="button-generate-from-settings"
                    >
                      {isLoadingLevelData ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate from Job Settings"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!editingJob) return;
                        setIsLoadingLevelData(true);
                        try {
                          const response = await fetch(`/api/admin/jobs/${editingJob.id}/build-levels`);
                          if (response.ok) {
                            const data = await response.json();
                            setLevelCycleTimes(data);
                            toast({ title: "Levels refreshed from panels" });
                          }
                        } catch (error) {
                          toast({ title: "Error", description: "Failed to refresh levels", variant: "destructive" });
                        } finally {
                          setIsLoadingLevelData(false);
                        }
                      }}
                      disabled={isLoadingLevelData}
                      data-testid="button-refresh-levels"
                    >
                      {isLoadingLevelData ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh from Panels"}
                    </Button>
                  </div>
                </div>
                
                {isLoadingLevelData ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : levelCycleTimes.length === 0 ? (
                  <div className="py-8 text-center border rounded-md bg-muted/30">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-muted-foreground">No panels registered for this job yet.</p>
                    <p className="text-sm text-muted-foreground">Add panels to configure level-specific cycle times.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Building</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead className="w-32">Cycle Days</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {levelCycleTimes.map((item, index) => (
                        <TableRow key={`${item.buildingNumber}-${item.level}`}>
                          <TableCell>
                            <Badge variant="outline">B{item.buildingNumber}</Badge>
                          </TableCell>
                          <TableCell>{item.level}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              value={item.cycleDays}
                              onChange={(e) => handleLevelCycleTimeChange(index, parseInt(e.target.value) || 1)}
                              className="w-20"
                              data-testid={`input-cycle-days-${item.buildingNumber}-${item.level}`}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                
                <DialogFooter>
                  <Button
                    onClick={() => {
                      if (!editingJob) return;
                      saveLevelCycleTimesMutation.mutate({
                        jobId: editingJob.id,
                        cycleTimes: levelCycleTimes,
                      });
                    }}
                    disabled={saveLevelCycleTimesMutation.isPending || levelCycleTimes.length === 0}
                    data-testid="button-save-level-cycle-times"
                  >
                    {saveLevelCycleTimesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Cycle Times
                  </Button>
                </DialogFooter>
              </div>
            </TabsContent>
          </Tabs>
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
            {deletingJobPanelCount > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-md">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-800 dark:text-red-200">
                    This job has <strong>{deletingJobPanelCount} panel(s)</strong> registered and cannot be deleted.
                    Please delete or reassign the panels first.
                  </p>
                </div>
              </div>
            ) : (
              <AlertDialogDescription>
                This will permanently delete this job. This action cannot be undone.
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {deletingJobPanelCount === 0 && (
              <AlertDialogAction
                onClick={() => deletingJobId && deleteJobMutation.mutate(deletingJobId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                {deleteJobMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete
              </AlertDialogAction>
            )}
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

      {/* Estimate Import Dialog */}
      <Dialog open={estimateDialogOpen} onOpenChange={setEstimateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              Import from Estimate - {estimateJob?.name}
            </DialogTitle>
            <DialogDescription>
              Upload an estimate Excel file to automatically create panels from TakeOff sheets.
              Panels will be set to PENDING status until validated.
            </DialogDescription>
          </DialogHeader>

          {/* Job Totals Summary */}
          {jobTotals && (
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4" />
                  <span className="font-medium">Current Job Totals</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total Elements</div>
                    <div className="font-semibold text-lg">{jobTotals.totalElements}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Total Area (m²)</div>
                    <div className="font-semibold text-lg">{jobTotals.totalAreaM2.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Total Volume (m³)</div>
                    <div className="font-semibold text-lg">{jobTotals.totalVolumeM3.toFixed(3)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                      Pending: {jobTotals.pendingCount}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                      Validated: {jobTotals.validatedCount}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* File Upload Area */}
          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragging ? "border-primary bg-primary/10" : "border-muted-foreground/25 hover:border-primary/50"}
              ${estimateFile ? "bg-muted/50" : ""}
            `}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleEstimateDrop}
            onClick={() => estimateFileInputRef.current?.click()}
            data-testid="dropzone-estimate-file"
          >
            <input
              ref={estimateFileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleEstimateFileSelect(file);
              }}
              data-testid="input-estimate-file"
            />
            {estimateFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-green-600" />
                <div className="text-left">
                  <div className="font-medium">{estimateFile.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {(estimateFile.size / 1024).toFixed(1)} KB
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEstimateFile(null);
                    setImportResult(null);
                  }}
                  data-testid="button-remove-file"
                >
                  <XCircle className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <div className="font-medium">Drop estimate Excel file here</div>
                <div className="text-sm text-muted-foreground mt-1">
                  or click to browse (.xlsx, .xls)
                </div>
              </>
            )}
          </div>

          {/* Replace existing checkbox */}
          {estimateFile && !importResult && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="replaceExisting"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="h-4 w-4"
                data-testid="checkbox-replace-existing"
              />
              <label htmlFor="replaceExisting" className="text-sm">
                Replace existing imported panels (source=3) for this job
              </label>
            </div>
          )}

          {/* Import Results */}
          {importResult && (
            <Card className="border-green-200 dark:border-green-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-700 dark:text-green-400">Import Complete</span>
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm mb-4">
                  <div>
                    <div className="text-muted-foreground">Sheets</div>
                    <div className="font-semibold">{importResult.totals.sheetsProcessed}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Imported</div>
                    <div className="font-semibold text-green-600">{importResult.totals.imported}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Duplicates</div>
                    <div className="font-semibold text-yellow-600">{importResult.totals.duplicates}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Skipped</div>
                    <div className="font-semibold text-muted-foreground">{importResult.totals.skipped}</div>
                  </div>
                </div>

                {/* Per-sheet summary */}
                <div className="space-y-2 max-h-40 overflow-auto">
                  {importResult.sheets?.map((sheet: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-sm bg-muted/50 rounded px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{sheet.takeoffCategory}</Badge>
                        <span className="text-muted-foreground">{sheet.sheetName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-green-600">{sheet.created} added</span>
                        {sheet.duplicates > 0 && (
                          <span className="text-yellow-600">{sheet.duplicates} dup</span>
                        )}
                        {sheet.errors?.length > 0 && (
                          <span className="text-destructive">{sheet.errors.length} errors</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {/* Show error details */}
                  {importResult.sheets?.some((s: any) => s.errors?.length > 0) && (
                    <div className="mt-3 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
                      <p className="text-sm font-medium text-destructive mb-2">Error Details:</p>
                      <ul className="text-sm text-destructive/80 list-disc list-inside space-y-1">
                        {importResult.sheets?.flatMap((sheet: any) => 
                          sheet.errors?.map((error: string, idx: number) => (
                            <li key={`${sheet.sheetName}-${idx}`}>
                              <span className="font-medium">{sheet.sheetName}:</span> {error}
                            </li>
                          )) || []
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEstimateDialogOpen(false)}
              data-testid="button-close-estimate-dialog"
            >
              {importResult ? "Close" : "Cancel"}
            </Button>
            {!importResult && (
              <Button
                onClick={handleRunEstimateImport}
                disabled={!estimateFile || importEstimateMutation.isPending}
                data-testid="button-run-estimate-import"
              >
                {importEstimateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {importEstimateMutation.isPending ? "Importing..." : "Import Panels"}
              </Button>
            )}
            {importResult && (
              <Button
                onClick={() => navigate(`/admin/panels?jobId=${estimateJob?.id}`)}
                data-testid="button-view-imported-panels"
              >
                View Imported Panels
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cycleTimesConfirmOpen} onOpenChange={setCycleTimesConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Production Slots?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {productionSlotStatus && !productionSlotStatus.hasSlots ? (
                  <p>No production slots exist for this job. Would you like to create them now using the new cycle times?</p>
                ) : productionSlotStatus?.hasNonStartedSlots ? (
                  <p>
                    This job has {productionSlotStatus.nonStartedCount} production slot(s) that haven't started yet. 
                    Would you like to update their dates based on the new cycle times?
                  </p>
                ) : (
                  <p>All production slots for this job have already started or been completed. No updates needed.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-skip-production-update">
              {productionSlotStatus?.hasSlots && !productionSlotStatus?.hasNonStartedSlots ? "Close" : "Skip"}
            </AlertDialogCancel>
            {productionSlotStatus && (!productionSlotStatus.hasSlots || productionSlotStatus.hasNonStartedSlots) && (
              <AlertDialogAction
                onClick={() => {
                  if (!editingJob) return;
                  const action = productionSlotStatus.hasSlots ? "update" : "create";
                  updateProductionSlotsMutation.mutate({ jobId: editingJob.id, action });
                }}
                disabled={updateProductionSlotsMutation.isPending}
                data-testid="button-confirm-production-update"
              >
                {updateProductionSlotsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {productionSlotStatus.hasSlots ? "Update Slots" : "Create Slots"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
