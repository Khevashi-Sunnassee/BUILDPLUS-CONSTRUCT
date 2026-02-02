import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { useRoute, useLocation } from "wouter";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import defaultLogo from "@/assets/lte-logo.png";
import {
  Factory,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  ArrowLeft,
  Calendar,
  Layers,
  Box,
  Square,
  LayoutGrid,
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileDown,
  CheckCircle2,
  Circle,
  CheckSquare,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Job, PanelRegister, ProductionEntry, User } from "@shared/schema";

const productionEntrySchema = z.object({
  panelId: z.string().min(1, "Panel is required"),
  jobId: z.string().min(1, "Job is required"),
  productionDate: z.string().min(1, "Date is required"),
  bayNumber: z.string().optional(),
  volumeM3: z.string().optional(),
  areaM2: z.string().optional(),
  factory: z.string().default("QLD"),
  notes: z.string().optional(),
  loadWidth: z.string().optional(),
  loadHeight: z.string().optional(),
  panelThickness: z.string().optional(),
  panelVolume: z.string().optional(),
  panelMass: z.string().optional(),
});

type ProductionEntryFormData = z.infer<typeof productionEntrySchema>;

interface ProductionEntryWithDetails extends ProductionEntry {
  panel: PanelRegister;
  job: Job;
  user: User;
  labourCost?: number;
  supplyCost?: number;
  totalCost?: number;
  revenue?: number;
  profit?: number;
}

interface ProductionSummaryWithCosts {
  entries: ProductionEntryWithDetails[];
  totals: {
    labourCost: number;
    supplyCost: number;
    totalCost: number;
    revenue: number;
    profit: number;
    volumeM3: number;
    areaM2: number;
    panelCount: number;
  };
}

export default function ProductionReportDetailPage() {
  const [, params] = useRoute("/production-report/:date");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const selectedDate = params?.date || format(new Date(), "yyyy-MM-dd");
  
  // Get factory from URL query params
  const urlParams = new URLSearchParams(window.location.search);
  const factory = urlParams.get("factory") || "QLD";
  
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ProductionEntryWithDetails | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [deleteDayDialogOpen, setDeleteDayDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: summaryData, isLoading: entriesLoading } = useQuery<ProductionSummaryWithCosts>({
    queryKey: ["/api/production-summary-with-costs", selectedDate, factory],
    queryFn: async () => {
      const res = await fetch(`/api/production-summary-with-costs?date=${selectedDate}&factory=${factory}`);
      if (!res.ok) throw new Error("Failed to fetch entries");
      return res.json();
    },
  });

  const entries = summaryData?.entries;
  const totals = summaryData?.totals;

  const { data: jobs } = useQuery<(Job & { panels: PanelRegister[] })[]>({
    queryKey: ["/api/admin/jobs"],
  });

  const { data: brandingSettings } = useQuery<{ logoBase64: string | null; companyName: string }>({
    queryKey: ["/api/settings/logo"],
  });
  const reportLogo = brandingSettings?.logoBase64 || defaultLogo;
  const companyName = brandingSettings?.companyName || "LTE Precast Concrete Structures";

  const activeJobs = jobs?.filter(j => j.status === "ACTIVE") || [];

  const selectedJobPanels = useMemo(() => {
    if (!selectedJobId || !jobs) return [];
    const job = jobs.find(j => j.id === selectedJobId);
    return (job?.panels || []).filter(p => p.approvedForProduction);
  }, [selectedJobId, jobs]);

  const entryForm = useForm<ProductionEntryFormData>({
    resolver: zodResolver(productionEntrySchema),
    defaultValues: {
      panelId: "",
      jobId: "",
      productionDate: selectedDate,
      bayNumber: "",
      volumeM3: "",
      areaM2: "",
      factory: factory,
      notes: "",
      loadWidth: "",
      loadHeight: "",
      panelThickness: "",
      panelVolume: "",
      panelMass: "",
    },
  });

  const createEntryMutation = useMutation({
    mutationFn: async (data: ProductionEntryFormData) => {
      return apiRequest("POST", "/api/production-entries", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-summary-with-costs", selectedDate, factory] });
      queryClient.invalidateQueries({ queryKey: ["/api/production-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/panels"] });
      toast({ title: "Production entry created successfully" });
      setEntryDialogOpen(false);
      entryForm.reset();
      setSelectedJobId("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to create entry", description: error.message, variant: "destructive" });
    },
  });

  const updateEntryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProductionEntryFormData }) => {
      return apiRequest("PUT", `/api/production-entries/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-summary-with-costs", selectedDate, factory] });
      queryClient.invalidateQueries({ queryKey: ["/api/production-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/panels"] });
      toast({ title: "Production entry updated successfully" });
      setEntryDialogOpen(false);
      setEditingEntry(null);
      entryForm.reset();
      setSelectedJobId("");
    },
    onError: () => {
      toast({ title: "Failed to update entry", variant: "destructive" });
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/production-entries/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-summary-with-costs", selectedDate, factory] });
      queryClient.invalidateQueries({ queryKey: ["/api/production-reports"] });
      toast({ title: "Entry deleted" });
      setDeleteDialogOpen(false);
      setDeletingEntryId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete entry", variant: "destructive" });
    },
  });

  const deleteDayMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/production-days/${selectedDate}?factory=${factory}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-reports"] });
      toast({ title: "Production day deleted" });
      setDeleteDayDialogOpen(false);
      setLocation("/production-report");
    },
    onError: () => {
      toast({ title: "Failed to delete production day", variant: "destructive" });
    },
  });

  // Update single entry status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PUT", `/api/production-entries/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-summary-with-costs", selectedDate, factory] });
      queryClient.invalidateQueries({ queryKey: ["/api/production-reports"] });
      toast({ title: "Status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  // Batch update all entries to COMPLETED
  const markAllCompletedMutation = useMutation({
    mutationFn: async (entryIds: string[]) => {
      return apiRequest("PUT", "/api/production-entries/batch-status", { entryIds, status: "COMPLETED" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-summary-with-costs", selectedDate, factory] });
      queryClient.invalidateQueries({ queryKey: ["/api/production-reports"] });
      toast({ title: "All entries marked as completed" });
    },
    onError: () => {
      toast({ title: "Failed to update statuses", variant: "destructive" });
    },
  });

  // Filter entries by status
  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    if (statusFilter === "all") return entries;
    return entries.filter(e => e.status === statusFilter);
  }, [entries, statusFilter]);

  // Status counts
  const statusCounts = useMemo(() => {
    if (!entries) return { draft: 0, completed: 0, total: 0 };
    return {
      draft: entries.filter(e => e.status === "DRAFT").length,
      completed: entries.filter(e => e.status === "COMPLETED").length,
      total: entries.length,
    };
  }, [entries]);

  const openCreateDialog = () => {
    setEditingEntry(null);
    setSelectedJobId("");
    entryForm.reset({
      panelId: "",
      jobId: "",
      productionDate: selectedDate,
      bayNumber: "",
      volumeM3: "",
      areaM2: "",
      factory: factory,
      notes: "",
      loadWidth: "",
      loadHeight: "",
      panelThickness: "",
      panelVolume: "",
      panelMass: "",
    });
    setEntryDialogOpen(true);
  };

  const openEditDialog = (entry: ProductionEntryWithDetails) => {
    setEditingEntry(entry);
    setSelectedJobId(entry.jobId);
    entryForm.reset({
      panelId: entry.panelId,
      jobId: entry.jobId,
      productionDate: entry.productionDate,
      bayNumber: entry.bayNumber || "",
      volumeM3: entry.volumeM3 || "",
      areaM2: entry.areaM2 || "",
      factory: entry.factory || factory,
      notes: entry.notes || "",
      loadWidth: entry.panel.loadWidth || "",
      loadHeight: entry.panel.loadHeight || "",
      panelThickness: entry.panel.panelThickness || "",
      panelVolume: entry.panel.panelVolume || "",
      panelMass: entry.panel.panelMass || "",
    });
    setEntryDialogOpen(true);
  };

  const onSubmit = (data: ProductionEntryFormData) => {
    if (editingEntry) {
      updateEntryMutation.mutate({ id: editingEntry.id, data });
    } else {
      createEntryMutation.mutate(data);
    }
  };

  const handleJobChange = (jobId: string) => {
    setSelectedJobId(jobId);
    entryForm.setValue("jobId", jobId);
    entryForm.setValue("panelId", "");
    entryForm.setValue("loadWidth", "");
    entryForm.setValue("loadHeight", "");
    entryForm.setValue("panelThickness", "");
    entryForm.setValue("panelVolume", "");
    entryForm.setValue("panelMass", "");
    entryForm.setValue("volumeM3", "");
    entryForm.setValue("areaM2", "");
  };

  const handlePanelChange = (panelId: string) => {
    entryForm.setValue("panelId", panelId);
    const panel = selectedJobPanels.find(p => p.id === panelId);
    if (panel) {
      entryForm.setValue("loadWidth", panel.loadWidth || "");
      entryForm.setValue("loadHeight", panel.loadHeight || "");
      entryForm.setValue("panelThickness", panel.panelThickness || "");
      entryForm.setValue("panelVolume", panel.panelVolume || "");
      entryForm.setValue("panelMass", panel.panelMass || "");
      entryForm.setValue("volumeM3", panel.panelVolume || "");
      const width = parseFloat(panel.loadWidth || "0") / 1000;
      const height = parseFloat(panel.loadHeight || "0") / 1000;
      if (width > 0 && height > 0) {
        entryForm.setValue("areaM2", (width * height).toFixed(2));
      }
    }
  };

  const panelTypeCounts = useMemo(() => {
    if (!entries) return { walls: 0, columns: 0, cubeBases: 0, cubeRings: 0, landingWalls: 0, other: 0 };
    
    let walls = 0, columns = 0, cubeBases = 0, cubeRings = 0, landingWalls = 0, other = 0;
    
    for (const entry of entries) {
      const type = entry.panel.panelType || "OTHER";
      if (type === "WALL") walls++;
      else if (type === "COLUMN") columns++;
      else if (type === "CUBE_BASE") cubeBases++;
      else if (type === "CUBE_RING") cubeRings++;
      else if (type === "LANDING_WALL") landingWalls++;
      else other++;
    }
    
    return { walls, columns, cubeBases, cubeRings, landingWalls, other };
  }, [entries]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDateDisplay = (dateStr: string) => {
    try {
      const date = new Date(dateStr + "T00:00:00");
      return format(date, "EEEE, dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  const exportToPDF = async () => {
    if (!reportRef.current) return;
    
    setIsExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 1200,
        onclone: (clonedDoc) => {
          clonedDoc.documentElement.classList.remove("dark");
          clonedDoc.documentElement.style.colorScheme = "light";
          const clonedElement = clonedDoc.body.querySelector("[data-pdf-content]") || clonedDoc.body;
          if (clonedElement instanceof HTMLElement) {
            clonedElement.style.backgroundColor = "#ffffff";
            clonedElement.style.color = "#000000";
          }
          clonedDoc.querySelectorAll("*").forEach((el) => {
            if (el instanceof HTMLElement) {
              const computed = window.getComputedStyle(el);
              if (computed.backgroundColor.includes("rgb(") && !computed.backgroundColor.includes("255, 255, 255")) {
                const bg = computed.backgroundColor;
                if (bg.includes("rgb(0,") || bg.includes("rgb(10,") || bg.includes("rgb(20,") || bg.includes("rgb(30,") || bg.includes("hsl(")) {
                  el.style.backgroundColor = "#ffffff";
                }
              }
            }
          });
        },
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const headerHeight = 35;
      const margin = 10;
      const footerHeight = 12;
      const usableHeight = pdfHeight - headerHeight - footerHeight - margin;
      const usableWidth = pdfWidth - (margin * 2);
      
      // Clean header with logo - proper aspect ratio
      const logoHeight = 12;
      const logoWidth = 24; // 2:1 aspect ratio for typical logo
      try {
        pdf.addImage(reportLogo, "PNG", margin, 6, logoWidth, logoHeight);
      } catch (e) {}
      
      // Report title
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Production Schedule", margin + logoWidth + 6, 12);
      
      // Subtitle info
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(formatDateDisplay(selectedDate), margin + logoWidth + 6, 19);
      
      // Generated date on the right
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text(`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pdfWidth - margin, 19, { align: "right" });
      
      // Draw a simple line under header
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, 24, pdfWidth - margin, 24);
      
      pdf.setTextColor(0, 0, 0);
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const imgRatio = imgWidth / imgHeight;
      let scaledWidth = usableWidth;
      let scaledHeight = scaledWidth / imgRatio;
      
      if (scaledHeight > usableHeight) {
        scaledHeight = usableHeight;
        scaledWidth = scaledHeight * imgRatio;
      }
      
      const imgX = (pdfWidth - scaledWidth) / 2;
      pdf.addImage(imgData, "PNG", imgX, headerHeight, scaledWidth, scaledHeight);
      
      pdf.setFillColor(248, 250, 252);
      pdf.rect(0, pdfHeight - footerHeight, pdfWidth, footerHeight, "F");
      pdf.setDrawColor(226, 232, 240);
      pdf.line(0, pdfHeight - footerHeight, pdfWidth, pdfHeight - footerHeight);
      
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`${companyName} - Confidential`, margin, pdfHeight - 5);
      pdf.text("Page 1 of 1", pdfWidth - margin, pdfHeight - 5, { align: "right" });
      
      pdf.save(`LTE-Production-Report-${selectedDate}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  if (entriesLoading) {
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
          <Button variant="ghost" size="icon" onClick={() => setLocation("/production-report")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-production-title">
              Production Schedule
              <Badge variant={factory === "QLD" ? "default" : "secondary"} className="text-sm">
                {factory}
              </Badge>
            </h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {formatDateDisplay(selectedDate)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={exportToPDF} 
            disabled={isExporting || entriesLoading}
            data-testid="button-export-pdf"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            Export PDF
          </Button>
          <Button onClick={openCreateDialog} data-testid="button-add-entry">
            <Plus className="h-4 w-4 mr-2" />
            Add Panel
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => setDeleteDayDialogOpen(true)}
            disabled={deleteDayMutation.isPending}
            data-testid="button-delete-day"
          >
            {deleteDayMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Delete Day
          </Button>
        </div>
      </div>

      <div ref={reportRef}>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" />
            PRODUCTION REPORT - {factory}
          </CardTitle>
          <CardDescription>{formatDateDisplay(selectedDate)}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Layers className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <div className="text-2xl font-bold">{totals?.panelCount || 0}</div>
                <div className="text-xs text-muted-foreground">Total Panels</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Box className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                <div className="text-2xl font-bold">{totals?.volumeM3?.toFixed(2) || "0.00"}</div>
                <div className="text-xs text-muted-foreground">Total m³</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Square className="h-5 w-5 mx-auto mb-1 text-purple-500" />
                <div className="text-2xl font-bold">{totals?.areaM2?.toFixed(2) || "0.00"}</div>
                <div className="text-xs text-muted-foreground">Total m²</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <LayoutGrid className="h-5 w-5 mx-auto mb-1 text-green-500" />
                <div className="text-sm">
                  <span className="text-muted-foreground">W:</span> {panelTypeCounts.walls} {" "}
                  <span className="text-muted-foreground">C:</span> {panelTypeCounts.columns} {" "}
                  <span className="text-muted-foreground">CB:</span> {panelTypeCounts.cubeBases}
                </div>
                <div className="text-xs text-muted-foreground">Panel Types</div>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card className="border-red-200 dark:border-red-900">
              <CardContent className="p-4 text-center">
                <DollarSign className="h-5 w-5 mx-auto mb-1 text-red-500" />
                <div className="text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totals?.totalCost || 0)}</div>
                <div className="text-xs text-muted-foreground">Total Cost</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Labour: {formatCurrency(totals?.labourCost || 0)} | Supply: {formatCurrency(totals?.supplyCost || 0)}
                </div>
              </CardContent>
            </Card>
            <Card className="border-green-200 dark:border-green-900">
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-500" />
                <div className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totals?.revenue || 0)}</div>
                <div className="text-xs text-muted-foreground">Revenue</div>
              </CardContent>
            </Card>
            <Card className={`${(totals?.profit || 0) >= 0 ? "border-green-200 dark:border-green-900" : "border-red-200 dark:border-red-900"}`}>
              <CardContent className="p-4 text-center">
                {(totals?.profit || 0) >= 0 ? (
                  <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 mx-auto mb-1 text-red-500" />
                )}
                <div className={`text-xl font-bold ${(totals?.profit || 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {formatCurrency(totals?.profit || 0)}
                </div>
                <div className="text-xs text-muted-foreground">Profit</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-xl font-bold">
                  {totals && totals.revenue > 0 ? ((totals.profit / totals.revenue) * 100).toFixed(1) : "0.0"}%
                </div>
                <div className="text-xs text-muted-foreground">Margin</div>
              </CardContent>
            </Card>
          </div>

          <div className="border rounded-lg">
            <div className="bg-muted/50 px-4 py-2 border-b flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="font-medium">PRODUCTION SCHEDULE</span>
                <div className="flex items-center gap-2">
                  <Badge variant={statusCounts.draft > 0 ? "secondary" : "outline"} className="gap-1">
                    <Circle className="h-3 w-3" />
                    Draft: {statusCounts.draft}
                  </Badge>
                  <Badge variant={statusCounts.completed > 0 ? "default" : "outline"} className="gap-1 bg-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Completed: {statusCounts.completed}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32" data-testid="select-status-filter">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                  </SelectContent>
                </Select>
                {statusCounts.draft > 0 && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const draftIds = entries?.filter(e => e.status === "DRAFT").map(e => e.id) || [];
                      if (draftIds.length > 0) {
                        markAllCompletedMutation.mutate(draftIds);
                      }
                    }}
                    disabled={markAllCompletedMutation.isPending}
                    data-testid="button-mark-all-completed"
                  >
                    <CheckSquare className="h-4 w-4 mr-1" />
                    {markAllCompletedMutation.isPending ? "Updating..." : "Mark All Completed"}
                  </Button>
                )}
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead>Bay</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Panel ID</TableHead>
                  <TableHead>Panel Type</TableHead>
                  <TableHead className="text-right">m³</TableHead>
                  <TableHead className="text-right">m²</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries?.map((entry) => (
                  <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`gap-1 ${entry.status === "COMPLETED" ? "text-green-600" : "text-muted-foreground"}`}
                        onClick={() => {
                          const newStatus = entry.status === "COMPLETED" ? "DRAFT" : "COMPLETED";
                          updateStatusMutation.mutate({ id: entry.id, status: newStatus });
                        }}
                        disabled={updateStatusMutation.isPending}
                        data-testid={`button-toggle-status-${entry.id}`}
                      >
                        {entry.status === "COMPLETED" ? (
                          <><CheckCircle2 className="h-4 w-4" /> Done</>
                        ) : (
                          <><Circle className="h-4 w-4" /> Draft</>
                        )}
                      </Button>
                    </TableCell>
                    <TableCell data-testid={`cell-bay-${entry.id}`}>
                      <span className="font-mono text-sm">{entry.bayNumber || "-"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{entry.job.jobNumber} - {entry.job.name}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-medium">{entry.panel.panelMark}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.panel.panelType?.replace("_", " ") || "WALL"}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.volumeM3 ? parseFloat(entry.volumeM3).toFixed(2) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.areaM2 ? parseFloat(entry.areaM2).toFixed(2) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-600 dark:text-red-400">
                      {formatCurrency(entry.totalCost || 0)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-green-600 dark:text-green-400">
                      {formatCurrency(entry.revenue || 0)}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${(entry.profit || 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatCurrency(entry.profit || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(entry)}
                          data-testid={`button-edit-entry-${entry.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingEntryId(entry.id);
                            setDeleteDialogOpen(true);
                          }}
                          data-testid={`button-delete-entry-${entry.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!filteredEntries || filteredEntries.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      No production entries for this date. Click "Add Panel" to record production.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </div>

      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Production Entry" : "Add Production Entry"}</DialogTitle>
            <DialogDescription>
              {editingEntry ? "Update production details" : "Record production work for a panel"}
            </DialogDescription>
          </DialogHeader>
          <Form {...entryForm}>
            <form onSubmit={entryForm.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={entryForm.control}
                name="productionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Production Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-entry-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Job</FormLabel>
                <Select onValueChange={handleJobChange} value={selectedJobId}>
                  <SelectTrigger data-testid="select-entry-job">
                    <SelectValue placeholder="Select job" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeJobs?.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.jobNumber} - {job.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
              <FormField
                control={entryForm.control}
                name="panelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Panel (Approved for Production)</FormLabel>
                    <Select 
                      onValueChange={handlePanelChange} 
                      value={field.value}
                      disabled={!selectedJobId || selectedJobPanels.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-entry-panel">
                          <SelectValue placeholder={
                            !selectedJobId 
                              ? "Select job first" 
                              : selectedJobPanels.length === 0 
                                ? "No approved panels" 
                                : "Select panel"
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {selectedJobPanels.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            No panels approved for production.<br/>
                            Use the Panel Register to approve panels.
                          </div>
                        ) : (
                          selectedJobPanels.map((panel) => (
                            <SelectItem key={panel.id} value={panel.id}>
                              {panel.panelMark} - {panel.panelType?.replace("_", " ") || "WALL"}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={entryForm.control}
                name="bayNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bay Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Bay 1, Bay A" data-testid="input-entry-bay" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                <h4 className="font-medium text-sm">Panel Dimensions</h4>
                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={entryForm.control}
                    name="loadWidth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Width (mm)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            data-testid="input-entry-load-width" 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={entryForm.control}
                    name="loadHeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Length (mm)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            data-testid="input-entry-load-height" 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={entryForm.control}
                    name="panelThickness"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Thickness (mm)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            data-testid="input-entry-thickness" 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={entryForm.control}
                    name="panelVolume"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Volume (m³)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            {...field} 
                            data-testid="input-entry-panel-volume" 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={entryForm.control}
                    name="panelMass"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Mass (kg)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            {...field} 
                            data-testid="input-entry-panel-mass" 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={entryForm.control}
                  name="volumeM3"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Production Volume (m³)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="2.50" 
                          {...field} 
                          data-testid="input-entry-volume" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={entryForm.control}
                  name="areaM2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Area (m²)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="10.00" 
                          {...field} 
                          data-testid="input-entry-area" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={entryForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Additional notes..." data-testid="input-entry-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEntryDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createEntryMutation.isPending || updateEntryMutation.isPending}
                  data-testid="button-save-entry"
                >
                  {(createEntryMutation.isPending || updateEntryMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingEntry ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this production entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingEntryId && deleteEntryMutation.mutate(deletingEntryId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteEntryMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDayDialogOpen} onOpenChange={setDeleteDayDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Production Day?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the production day for {formatDateDisplay(selectedDate)} ({factory}) and all its entries. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDayMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-day"
            >
              {deleteDayMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
