import { useState, useRef, useEffect, Fragment, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  Clock,
  CalendarRange,
  Wallet,
  ListChecks,
} from "lucide-react";
import { QueryErrorState } from "@/components/query-error-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest, getCsrfToken } from "@/lib/queryClient";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import type { Job, User as UserType, GlobalSettings, Factory, Customer, JobType } from "@shared/schema";
import { ADMIN_ROUTES, JOBS_ROUTES, PANELS_ROUTES, PANEL_TYPES_ROUTES, FACTORIES_ROUTES, PRODUCTION_ROUTES, DRAFTING_ROUTES, PROCUREMENT_ROUTES, PROJECT_ACTIVITIES_ROUTES } from "@shared/api-routes";
import {
  JOB_PHASES, JOB_STATUSES,
  PHASE_LABELS, STATUS_LABELS,
  PHASE_COLORS, STATUS_COLORS,
  PHASE_ALLOWED_STATUSES,
  isValidStatusForPhase,
  canAdvanceToPhase,
  getDefaultStatusForPhase,
  getPhaseLabel, getStatusLabel,
} from "@shared/job-phases";
import type { JobPhase, JobStatus } from "@shared/job-phases";
import { PageHelpButton } from "@/components/help/page-help-button";

import {
  AUSTRALIAN_STATES,
  JOB_COLOR_PALETTE,
  jobSchema,
  type JobFormData,
  type JobWithPanels,
  type CostOverride,
  type PanelTypeInfo,
  type SortField,
  type SortDirection,
  type ProductionSlotStatus,
  type LevelCycleTime,
} from "./types";
import { AuditLogPanel } from "./AuditLogPanel";
import { JobFormDialog } from "./JobFormDialog";
import { JobImportDialog } from "./JobImportDialog";
import { EstimateImportDialog } from "./EstimateImportDialog";
import { CostOverridesDialog } from "./CostOverridesDialog";
import {
  DeleteJobDialog,
  CycleTimesConfirmDialog,
  LevelChangeConfirmDialog,
  DaysInAdvanceConfirmDialog,
  QuickAddCustomerDialog,
} from "./JobConfirmationDialogs";
import { useDocumentTitle } from "@/hooks/use-document-title";

export default function AdminJobsPage() {
  useDocumentTitle("Jobs");
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isPrivileged = user?.role === "ADMIN" || user?.role === "MANAGER";
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [deletingJobPanelCount, setDeletingJobPanelCount] = useState(0);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<Record<string, unknown>[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [costOverridesDialogOpen, setCostOverridesDialogOpen] = useState(false);
  const [costOverridesJob, setCostOverridesJob] = useState<JobWithPanels | null>(null);
  const [localOverrides, setLocalOverrides] = useState<CostOverride[]>([]);
  
  const [estimateDialogOpen, setEstimateDialogOpen] = useState(false);
  const [estimateJob, setEstimateJob] = useState<JobWithPanels | null>(null);
  const [estimateFile, setEstimateFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("jobNumber");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [groupByState, setGroupByState] = useState(true);
  
  const [levelCycleTimes, setLevelCycleTimes] = useState<LevelCycleTime[]>([]);
  const [isLoadingLevelData, setIsLoadingLevelData] = useState(false);
  const [editDialogTab, setEditDialogTab] = useState("details");
  
  const [cycleTimesConfirmOpen, setCycleTimesConfirmOpen] = useState(false);
  const [hasExistingLevelCycleTimes, setHasExistingLevelCycleTimes] = useState(false);
  const [productionSlotStatus, setProductionSlotStatus] = useState<ProductionSlotStatus | null>(null);
  
  const [levelChangeConfirmOpen, setLevelChangeConfirmOpen] = useState(false);
  const [levelsChanged, setLevelsChanged] = useState(false);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  
  const [originalDaysInAdvance, setOriginalDaysInAdvance] = useState<number | null>(null);
  const [daysInAdvanceChanged, setDaysInAdvanceChanged] = useState(false);
  const [daysInAdvanceConfirmOpen, setDaysInAdvanceConfirmOpen] = useState(false);
  
  const [originalOnsiteDate, setOriginalOnsiteDate] = useState<string | null>(null);
  const [onsiteDateChanged, setOnsiteDateChanged] = useState(false);
  
  const [schedulingSettingsChanged, setSchedulingSettingsChanged] = useState(false);

  const [quickAddCustomerOpen, setQuickAddCustomerOpen] = useState(false);
  const [quickAddCustomerName, setQuickAddCustomerName] = useState("");

  const { data: jobs, isLoading, isError, error, refetch } = useQuery<JobWithPanels[]>({
    queryKey: [ADMIN_ROUTES.JOBS],
  });

  const { data: users } = useQuery<UserType[]>({
    queryKey: [ADMIN_ROUTES.USERS],
  });

  const { data: factories } = useQuery<Factory[]>({
    queryKey: [FACTORIES_ROUTES.LIST],
  });

  const { data: activeCustomers } = useQuery<Customer[]>({
    queryKey: [PROCUREMENT_ROUTES.CUSTOMERS_ACTIVE],
  });

  const { data: globalSettings } = useQuery<GlobalSettings>({
    queryKey: [ADMIN_ROUTES.SETTINGS],
  });

  const { data: jobTypes } = useQuery<JobType[]>({
    queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_TYPES],
  });

  const filteredAndSortedJobs = useMemo(() => (jobs || [])
    .filter((job) => {
      if (phaseFilter !== "all" && String(job.jobPhase) !== phaseFilter) return false;
      if (statusFilter !== "all" && job.status !== statusFilter) return false;
      if (stateFilter !== "all") {
        if (stateFilter === "none" && job.state) return false;
        if (stateFilter !== "none" && job.state !== stateFilter) return false;
      }
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
      if (groupByState) {
        const stateA = a.state || "ZZZ";
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
    }), [jobs, phaseFilter, statusFilter, stateFilter, searchQuery, groupByState, sortField, sortDirection]);

  const groupedJobs = useMemo(() => groupByState
    ? filteredAndSortedJobs.reduce((acc, job) => {
        const state = job.state || "No State";
        if (!acc[state]) acc[state] = [];
        acc[state].push(job);
        return acc;
      }, {} as Record<string, JobWithPanels[]>)
    : { "All Jobs": filteredAndSortedJobs }, [groupByState, filteredAndSortedJobs]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }, [sortField, sortDirection]);

  const getSortIcon = useCallback((field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    return sortDirection === "asc" 
      ? <ArrowUp className="h-4 w-4 ml-1" /> 
      : <ArrowDown className="h-4 w-4 ml-1" />;
  }, [sortField, sortDirection]);

  const jobForm = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      jobNumber: "",
      name: "",
      client: "",
      customerId: null,
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
      daysInAdvance: null,
      daysToAchieveIfc: null,
      productionWindowDays: null,
      productionDaysInAdvance: null,
      procurementDaysInAdvance: null,
      procurementTimeDays: null,
      siteContact: "",
      siteContactPhone: "",
      jobPhase: "OPPORTUNITY",
      status: "ACTIVE",
      projectManagerId: null,
      factoryId: null,
      productionSlotColor: null,
      jobTypeId: null,
      defectLiabilityEndDate: null,
    },
  });

  const createJobMutation = useMutation({
    mutationFn: async (data: JobFormData) => {
      return apiRequest("POST", ADMIN_ROUTES.JOBS, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.JOBS] });
      toast({ title: "Job created successfully" });
      setJobDialogOpen(false);
      jobForm.reset();
    },
    onError: (error: Error) => {
      let msg = error.message || "Unknown error";
      try {
        const jsonMatch = msg.match(/\{.*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          msg = parsed.error || parsed.message || msg;
        }
      } catch { /* non-critical error parsing - use fallback message */ }
      toast({ title: "Failed to create job", description: msg, variant: "destructive" });
    },
  });

  const updateJobMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: JobFormData }) => {
      return apiRequest("PUT", ADMIN_ROUTES.JOB_BY_ID(id), data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.JOBS] });
      toast({ title: "Job updated successfully" });
      
      if ((daysInAdvanceChanged || onsiteDateChanged || schedulingSettingsChanged) && productionSlotStatus?.hasSlots) {
        setPendingJobId(variables.id);
        setDaysInAdvanceConfirmOpen(true);
        setDaysInAdvanceChanged(false);
        setOnsiteDateChanged(false);
        setSchedulingSettingsChanged(false);
        return;
      }
      
      if (levelsChanged && (hasExistingLevelCycleTimes || productionSlotStatus?.hasSlots)) {
        setPendingJobId(variables.id);
        if (hasExistingLevelCycleTimes) {
          setLevelChangeConfirmOpen(true);
        } else if (productionSlotStatus?.hasSlots) {
          setCycleTimesConfirmOpen(true);
        }
        setLevelsChanged(false);
      } else {
        setJobDialogOpen(false);
        setEditingJob(null);
        jobForm.reset();
      }
    },
    onError: (error: Error) => {
      let msg = error.message || "Unknown error";
      try {
        const jsonMatch = msg.match(/\{.*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          msg = parsed.error || parsed.message || msg;
        }
      } catch { /* non-critical error parsing - use fallback message */ }
      toast({ title: "Failed to update job", description: msg, variant: "destructive" });
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", ADMIN_ROUTES.JOB_BY_ID(id), {});
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || "Failed to delete job");
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.JOBS] });
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

  const quickAddCustomerMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", PROCUREMENT_ROUTES.CUSTOMERS, { name, isActive: true });
      return res.json();
    },
    onSuccess: (customer: Customer) => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.CUSTOMERS_ACTIVE] });
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.CUSTOMERS] });
      jobForm.setValue("customerId", customer.id);
      jobForm.setValue("client", customer.name);
      setQuickAddCustomerOpen(false);
      setQuickAddCustomerName("");
      toast({ title: "Customer created and selected" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create customer", description: error.message, variant: "destructive" });
    },
  });

  const { data: jobTotals, refetch: refetchJobTotals } = useQuery<{
    totalAreaM2: number;
    totalVolumeM3: number;
    totalElements: number;
    pendingCount: number;
    validatedCount: number;
    panelCount: number;
  }>({
    queryKey: [JOBS_ROUTES.LIST, estimateJob?.id, "totals"],
    queryFn: async () => {
      if (!estimateJob?.id) return null;
      const res = await fetch(JOBS_ROUTES.TOTALS(estimateJob.id), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch totals");
      return res.json();
    },
    enabled: !!estimateJob?.id && estimateDialogOpen,
  });

  const importEstimateMutation = useMutation({
    mutationFn: async ({ jobId, file, replace }: { jobId: string; file: File; replace: boolean }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("replace", String(replace));
      
      const csrfToken = getCsrfToken();
      const res = await fetch(JOBS_ROUTES.PANELS_IMPORT_ESTIMATE(jobId), {
        method: "POST",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
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
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.JOBS] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PANELS] });
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
    queryKey: [PANEL_TYPES_ROUTES.LIST],
  });

  const { data: costOverrides, refetch: refetchCostOverrides } = useQuery<CostOverride[]>({
    queryKey: [JOBS_ROUTES.LIST, costOverridesJob?.id, "cost-overrides"],
    queryFn: async () => {
      if (!costOverridesJob?.id) return [];
      const res = await fetch(JOBS_ROUTES.COST_OVERRIDES(costOverridesJob.id), { credentials: "include" });
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
      return apiRequest("POST", JOBS_ROUTES.COST_OVERRIDES_INITIALIZE(jobId), {});
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
      return apiRequest("PUT", JOBS_ROUTES.COST_OVERRIDE_BY_ID(jobId, id), data);
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
    mutationFn: async (data: Record<string, unknown>[]) => {
      return apiRequest("POST", ADMIN_ROUTES.JOBS_IMPORT, { data });
    },
    onSuccess: async (response) => {
      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.JOBS] });
      toast({ title: `Imported ${result.imported} jobs, ${result.skipped} skipped` });
      setImportDialogOpen(false);
      setImportData([]);
    },
    onError: () => {
      toast({ title: "Import failed", variant: "destructive" });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const worksheet = workbook.worksheets[0];
    const headers: string[] = [];
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber] = String(cell.value || "");
    });
    const jsonData: Record<string, unknown>[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const rowObj: Record<string, unknown> = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (headers[colNumber]) {
          rowObj[headers[colNumber]] = cell.value;
        }
      });
      if (Object.keys(rowObj).length > 0) jsonData.push(rowObj);
    });
    setImportData(jsonData);
    setImportDialogOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadTemplate = async () => {
    const ExcelJS = (await import("exceljs")).default;
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
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Jobs");
    const headers = Object.keys(template[0]);
    ws.addRow(headers);
    template.forEach(row => ws.addRow(headers.map(h => row[h as keyof typeof row])));
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jobs_template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const getNextAvailableColor = () => {
    const usedColors = new Set(jobs?.map(j => j.productionSlotColor).filter(Boolean) || []);
    const availableColor = JOB_COLOR_PALETTE.find(c => !usedColors.has(c));
    return availableColor || JOB_COLOR_PALETTE[(jobs?.length || 0) % JOB_COLOR_PALETTE.length];
  };

  const openCreateDialog = () => {
    setEditingJob(null);
    const prefix = globalSettings?.jobNumberPrefix || "";
    const minDigits = globalSettings?.jobNumberMinDigits || 3;
    const nextSeq = globalSettings?.jobNumberNextSequence || 1;
    const autoJobNumber = prefix ? `${prefix}${String(nextSeq).padStart(minDigits, "0")}` : "";
    jobForm.reset({
      jobNumber: autoJobNumber,
      name: "",
      client: "",
      customerId: null,
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
      daysInAdvance: globalSettings?.ifcDaysInAdvance ?? 14,
      daysToAchieveIfc: globalSettings?.daysToAchieveIfc ?? 21,
      productionWindowDays: globalSettings?.productionWindowDays ?? 10,
      productionDaysInAdvance: globalSettings?.productionDaysInAdvance ?? 10,
      procurementDaysInAdvance: globalSettings?.procurementDaysInAdvance ?? 7,
      procurementTimeDays: globalSettings?.procurementTimeDays ?? 14,
      siteContact: "",
      siteContactPhone: "",
      jobPhase: "OPPORTUNITY",
      status: "ACTIVE",
      projectManagerId: null,
      factoryId: null,
      productionSlotColor: getNextAvailableColor(),
      jobTypeId: null,
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
      customerId: job.customerId || null,
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
      daysInAdvance: job.daysInAdvance ?? globalSettings?.ifcDaysInAdvance ?? 14,
      daysToAchieveIfc: job.daysToAchieveIfc ?? globalSettings?.daysToAchieveIfc ?? 21,
      productionWindowDays: job.productionWindowDays ?? globalSettings?.productionWindowDays ?? 10,
      productionDaysInAdvance: job.productionDaysInAdvance ?? globalSettings?.productionDaysInAdvance ?? 10,
      procurementDaysInAdvance: job.procurementDaysInAdvance ?? globalSettings?.procurementDaysInAdvance ?? 7,
      procurementTimeDays: job.procurementTimeDays ?? globalSettings?.procurementTimeDays ?? 14,
      siteContact: job.siteContact || "",
      siteContactPhone: job.siteContactPhone || "",
      jobPhase: String(job.jobPhase || "CONTRACTED"),
      status: job.status,
      projectManagerId: job.projectManagerId || null,
      factoryId: job.factoryId || null,
      productionSlotColor: job.productionSlotColor || getNextAvailableColor(),
      jobTypeId: job.jobTypeId || null,
      defectLiabilityEndDate: job.defectLiabilityEndDate ? new Date(job.defectLiabilityEndDate).toISOString().split('T')[0] : null,
    });
    setJobDialogOpen(true);
    
    setLevelsChanged(false);
    setPendingJobId(null);
    
    setOriginalDaysInAdvance(job.daysInAdvance ?? globalSettings?.ifcDaysInAdvance ?? 14);
    setDaysInAdvanceChanged(false);
    
    setOriginalOnsiteDate(job.productionStartDate ? new Date(job.productionStartDate).toISOString().split('T')[0] : null);
    setOnsiteDateChanged(false);
    
    setSchedulingSettingsChanged(false);
    
    setLevelCycleTimes([]);
    setHasExistingLevelCycleTimes(false);
    setIsLoadingLevelData(true);
    try {
      const response = await fetch(ADMIN_ROUTES.JOB_BUILD_LEVELS(job.id));
      if (response.ok) {
        const data = await response.json();
        setLevelCycleTimes(data);
        setHasExistingLevelCycleTimes(data.length > 0);
      }
    } catch (error) {
      console.error("Failed to load level cycle times:", error);
    } finally {
      setIsLoadingLevelData(false);
    }
    
    try {
      const slotResponse = await fetch(ADMIN_ROUTES.JOB_PRODUCTION_SLOT_STATUS(job.id));
      if (slotResponse.ok) {
        const status = await slotResponse.json();
        setProductionSlotStatus(status);
      }
    } catch (error) {
      console.error("Failed to load production slot status:", error);
    }
  };

  const onSubmit = (data: JobFormData) => {
    if (editDialogTab === "levelCycleTimes") {
      return;
    }
    if (editingJob) {
      updateJobMutation.mutate({ id: editingJob.id, data });
    } else {
      createJobMutation.mutate(data);
    }
  };

  const onFormError = (errors: Record<string, { message?: string }>) => {
    const errorMessages = Object.entries(errors)
      .map(([field, err]) => `${field}: ${err?.message || "invalid"}`)
      .join(", ");
    toast({ title: "Please fix form errors", description: errorMessages, variant: "destructive" });
  };

  const saveLevelCycleTimesMutation = useMutation({
    mutationFn: async ({ jobId, cycleTimes }: { jobId: string; cycleTimes: typeof levelCycleTimes }) => {
      const res = await apiRequest("POST", ADMIN_ROUTES.JOB_LEVEL_CYCLE_TIMES(jobId), { cycleTimes });
      return res.json();
    },
    onSuccess: async () => {
      toast({ title: "Saved", description: "Level cycle times updated successfully" });
      
      if (!editingJob) return;
      
      try {
        const res = await fetch(ADMIN_ROUTES.JOB_PRODUCTION_SLOT_STATUS(editingJob.id));
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
      const res = await apiRequest("POST", ADMIN_ROUTES.JOB_UPDATE_PRODUCTION_SLOTS(jobId), { action });
      return res.json();
    },
    onSuccess: (data) => {
      setCycleTimesConfirmOpen(false);
      if (data.action === "created") {
        toast({ title: "Success", description: `Created ${data.count} production slots` });
      } else if (data.action === "updated") {
        toast({ title: "Success", description: `Updated ${data.count} production slots` });
      }
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.JOBS] });
      queryClient.invalidateQueries({ queryKey: [PRODUCTION_ROUTES.SLOTS] });
      queryClient.invalidateQueries({ queryKey: [DRAFTING_ROUTES.PROGRAM] });
      
      setPendingJobId(null);
      setJobDialogOpen(false);
      setEditingJob(null);
      jobForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const regenerateSlotsAndDraftingMutation = useMutation({
    mutationFn: async (jobId: string) => {
      await apiRequest("DELETE", DRAFTING_ROUTES.BY_JOB(jobId), {});
      const slotsRes = await apiRequest("POST", PRODUCTION_ROUTES.SLOTS_GENERATE_FOR_JOB(jobId), {});
      const slotsData = await slotsRes.json();
      const draftingRes = await apiRequest("POST", DRAFTING_ROUTES.GENERATE, { jobId });
      const draftingData = await draftingRes.json();
      return { slots: slotsData, drafting: draftingData };
    },
    onSuccess: (data) => {
      setDaysInAdvanceConfirmOpen(false);
      toast({ 
        title: "Success", 
        description: `Updated ${Array.isArray(data.slots) ? data.slots.length : 0} production slots and ${data.drafting.created + data.drafting.updated} drafting entries` 
      });
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.JOBS] });
      queryClient.invalidateQueries({ queryKey: [PRODUCTION_ROUTES.SLOTS] });
      queryClient.invalidateQueries({ queryKey: [DRAFTING_ROUTES.PROGRAM] });
      
      setPendingJobId(null);
      setJobDialogOpen(false);
      setEditingJob(null);
      jobForm.reset();
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

  const regenerateLevelsMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const generateResponse = await fetch(ADMIN_ROUTES.JOB_GENERATE_LEVELS(jobId));
      if (!generateResponse.ok) {
        const error = await generateResponse.json();
        throw new Error(error.error || "Failed to generate levels");
      }
      const generatedLevels = await generateResponse.json();
      
      const saveResponse = await apiRequest("POST", ADMIN_ROUTES.JOB_LEVEL_CYCLE_TIMES(jobId), { 
        cycleTimes: generatedLevels 
      });
      if (!saveResponse.ok) {
        const error = await saveResponse.json();
        throw new Error(error.error || "Failed to save level cycle times");
      }
      
      return generatedLevels;
    },
    onSuccess: (data) => {
      setLevelCycleTimes(data);
      setHasExistingLevelCycleTimes(true);
      setLevelChangeConfirmOpen(false);
      toast({ title: "Level cycle times regenerated and saved" });
      
      if (productionSlotStatus?.hasSlots) {
        setCycleTimesConfirmOpen(true);
      } else {
        setPendingJobId(null);
        setJobDialogOpen(false);
        setEditingJob(null);
        jobForm.reset();
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLevelChangeConfirmOpen(false);
    },
  });

  const handleLevelFieldChange = () => {
    setLevelsChanged(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6" role="main" aria-label="Jobs Management" aria-busy="true">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6" role="main" aria-label="Jobs Management">
        <QueryErrorState error={error} onRetry={refetch} message="Failed to load jobs" />
      </div>
    );
  }

  return (
    <div className="space-y-6" role="main" aria-label="Jobs Management">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-jobs-title">Jobs</h1>
            <PageHelpButton pageHelpKey="page.jobs" />
          </div>
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
          {isPrivileged && (
            <>
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
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" aria-hidden="true" />
            Job Register
          </CardTitle>
          <CardDescription aria-live="polite">
            {filteredAndSortedJobs.length} of {jobs?.length || 0} jobs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-jobs"
                aria-label="Search jobs"
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
            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-phase-filter">
                <SelectValue placeholder="Filter by phase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Phases</SelectItem>
                {JOB_PHASES.map((phase) => (
                  <SelectItem key={phase} value={phase}>{getPhaseLabel(phase)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {JOB_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>{getStatusLabel(status)}</SelectItem>
                ))}
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
            {(searchQuery || phaseFilter !== "all" || statusFilter !== "all" || stateFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearchQuery(""); setPhaseFilter("all"); setStatusFilter("all"); setStateFilter("all"); }}
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
                <TableHead>Phase</TableHead>
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
                      <TableCell colSpan={9} className="py-2">
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
                      <TableCell>
                        {(() => {
                          const phase = (job.jobPhase || "CONTRACTED") as JobPhase;
                          const colors = PHASE_COLORS[phase] || PHASE_COLORS.CONTRACTED;
                          return (
                            <Badge variant="outline" className={`${colors} text-xs`} data-testid={`badge-phase-${job.id}`}>
                              {getPhaseLabel(phase)}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const status = (job.status || "STARTED") as JobStatus;
                          const colors = STATUS_COLORS[status as keyof typeof STATUS_COLORS];
                          const badge = (
                            <Badge variant="outline" className={`${colors || ""} text-xs`} data-testid={`badge-status-${job.id}`}>
                              {getStatusLabel(status)}
                            </Badge>
                          );
                          if (status === "DEFECT_LIABILITY_PERIOD" && job.defectLiabilityEndDate) {
                            const endDate = new Date(job.defectLiabilityEndDate);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const endDay = new Date(endDate);
                            endDay.setHours(0, 0, 0, 0);
                            const isExpired = endDay < today;
                            return (
                              <div className="flex flex-col gap-0.5">
                                {badge}
                                <span className={`text-[10px] ${isExpired ? "text-destructive font-medium" : "text-muted-foreground"}`} data-testid={`text-dlp-end-${job.id}`}>
                                  {isExpired ? "Expired" : "Ends"}: {endDate.toLocaleDateString()}
                                </span>
                              </div>
                            );
                          }
                          return badge;
                        })()}
                      </TableCell>
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
                            onClick={() => navigate(`/admin/jobs/${job.id}/programme`)}
                            title="Job Programme"
                            data-testid={`button-programme-${job.id}`}
                          >
                            <CalendarRange className="h-4 w-4 text-purple-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/jobs/${job.id}/budget`)}
                            title="Job Budget"
                            data-testid={`button-budget-${job.id}`}
                          >
                            <Wallet className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/jobs/${job.id}/boq`)}
                            title="Bill of Quantities"
                            data-testid={`button-boq-${job.id}`}
                          >
                            <ListChecks className="h-4 w-4 text-cyan-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEstimateImport(job)}
                            title="Import from Estimate"
                            data-testid={`button-import-estimate-${job.id}`}
                          >
                            <FileUp className="h-4 w-4 text-blue-600" />
                          </Button>
                          {isPrivileged && (
                            <>
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
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
              {filteredAndSortedJobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {jobs?.length ? "No jobs match your filters." : "No jobs found. Add a job or import from Excel."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <JobFormDialog
        open={jobDialogOpen}
        onOpenChange={setJobDialogOpen}
        editingJob={editingJob}
        jobForm={jobForm}
        editDialogTab={editDialogTab}
        setEditDialogTab={setEditDialogTab}
        onSubmit={onSubmit}
        onFormError={onFormError}
        createJobMutation={createJobMutation}
        updateJobMutation={updateJobMutation}
        users={users}
        factories={factories}
        activeCustomers={activeCustomers}
        globalSettings={globalSettings}
        levelCycleTimes={levelCycleTimes}
        handleLevelCycleTimeChange={handleLevelCycleTimeChange}
        isLoadingLevelData={isLoadingLevelData}
        setIsLoadingLevelData={setIsLoadingLevelData}
        setLevelCycleTimes={setLevelCycleTimes}
        saveLevelCycleTimesMutation={saveLevelCycleTimesMutation}
        handleLevelFieldChange={handleLevelFieldChange}
        originalDaysInAdvance={originalDaysInAdvance}
        originalOnsiteDate={originalOnsiteDate}
        setDaysInAdvanceChanged={setDaysInAdvanceChanged}
        setOnsiteDateChanged={setOnsiteDateChanged}
        setSchedulingSettingsChanged={setSchedulingSettingsChanged}
        setQuickAddCustomerName={setQuickAddCustomerName}
        setQuickAddCustomerOpen={setQuickAddCustomerOpen}
        jobTypes={jobTypes}
      />

      <JobImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        importData={importData}
        importJobsMutation={importJobsMutation}
      />

      <DeleteJobDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        deletingJobPanelCount={deletingJobPanelCount}
        deletingJobId={deletingJobId}
        deleteJobMutation={deleteJobMutation}
      />

      <CostOverridesDialog
        open={costOverridesDialogOpen}
        onOpenChange={setCostOverridesDialogOpen}
        costOverridesJob={costOverridesJob}
        groupedOverrides={groupedOverrides}
        getPanelTypeName={getPanelTypeName}
        handleUpdateOverride={handleUpdateOverride}
        handleSaveOverride={handleSaveOverride}
        initializeCostOverridesMutation={initializeCostOverridesMutation}
        updateCostOverrideMutation={updateCostOverrideMutation}
      />

      <EstimateImportDialog
        open={estimateDialogOpen}
        onOpenChange={setEstimateDialogOpen}
        estimateJob={estimateJob}
        estimateFile={estimateFile}
        setEstimateFile={setEstimateFile}
        isDragging={isDragging}
        setIsDragging={setIsDragging}
        replaceExisting={replaceExisting}
        setReplaceExisting={setReplaceExisting}
        importResult={importResult}
        setImportResult={setImportResult}
        jobTotals={jobTotals}
        importEstimateMutation={importEstimateMutation}
        onRunImport={handleRunEstimateImport}
        onFileSelect={handleEstimateFileSelect}
        onDrop={handleEstimateDrop}
        navigate={navigate}
      />

      <CycleTimesConfirmDialog
        open={cycleTimesConfirmOpen}
        onOpenChange={setCycleTimesConfirmOpen}
        productionSlotStatus={productionSlotStatus}
        pendingJobId={pendingJobId}
        editingJob={editingJob}
        jobForm={jobForm}
        setPendingJobId={setPendingJobId}
        setJobDialogOpen={setJobDialogOpen}
        setEditingJob={setEditingJob}
        updateProductionSlotsMutation={updateProductionSlotsMutation}
      />

      <LevelChangeConfirmDialog
        open={levelChangeConfirmOpen}
        onOpenChange={setLevelChangeConfirmOpen}
        pendingJobId={pendingJobId}
        productionSlotStatus={productionSlotStatus}
        jobForm={jobForm}
        setPendingJobId={setPendingJobId}
        setJobDialogOpen={setJobDialogOpen}
        setEditingJob={setEditingJob}
        setCycleTimesConfirmOpen={setCycleTimesConfirmOpen}
        regenerateLevelsMutation={regenerateLevelsMutation}
      />

      <DaysInAdvanceConfirmDialog
        open={daysInAdvanceConfirmOpen}
        onOpenChange={setDaysInAdvanceConfirmOpen}
        pendingJobId={pendingJobId}
        jobForm={jobForm}
        setPendingJobId={setPendingJobId}
        setJobDialogOpen={setJobDialogOpen}
        setEditingJob={setEditingJob}
        regenerateSlotsAndDraftingMutation={regenerateSlotsAndDraftingMutation}
      />

      <QuickAddCustomerDialog
        open={quickAddCustomerOpen}
        onOpenChange={setQuickAddCustomerOpen}
        quickAddCustomerName={quickAddCustomerName}
        setQuickAddCustomerName={setQuickAddCustomerName}
        quickAddCustomerMutation={quickAddCustomerMutation}
      />

    </div>
  );
}
