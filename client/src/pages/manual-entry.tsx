import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { JOBS_ROUTES, PANELS_ROUTES, SETTINGS_ROUTES, DAILY_LOGS_ROUTES, MANUAL_ENTRY_ROUTES, ADMIN_ROUTES } from "@shared/api-routes";
import {
  Plus,
  Clock,
  FolderOpen,
  FileText,
  Save,
  ArrowLeft,
  ClipboardList,
  Briefcase,
  AlertCircle,
  Ruler,
  Hammer,
  Upload,
  XCircle,
  Sparkles,
  Loader2,
  CheckCircle2,
  Download,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import type { Job, PanelRegister, WorkType } from "@shared/schema";

interface LogRowWithTimes {
  id: string;
  endAt: Date | string;
}

interface DailyLogWithRows {
  id: string;
  userId: string;
  logDay: string;
  status: string;
  rows: LogRowWithTimes[];
}

const manualEntrySchema = z.object({
  logDay: z.string().min(1, "Date is required"),
  jobId: z.string().optional(),
  panelRegisterId: z.string().optional(),
  workTypeId: z.string().optional(),
  app: z.enum(["revit", "acad"]),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  fileName: z.string().optional(),
  filePath: z.string().optional(),
  revitViewName: z.string().optional(),
  revitSheetNumber: z.string().optional(),
  revitSheetName: z.string().optional(),
  acadLayoutName: z.string().optional(),
  panelMark: z.string().optional(),
  drawingCode: z.string().optional(),
  notes: z.string().optional(),
  // Panel details fields
  panelLoadWidth: z.string().optional(),
  panelLoadHeight: z.string().optional(),
  panelThickness: z.string().optional(),
  panelVolume: z.string().optional(),
  panelMass: z.string().optional(),
  panelArea: z.string().optional(),
  panelDay28Fc: z.string().optional(),
  panelLiftFcm: z.string().optional(),
  panelRotationalLifters: z.string().optional(),
  panelPrimaryLifters: z.string().optional(),
});

type ManualEntryForm = z.infer<typeof manualEntrySchema>;

interface PanelWithJob extends PanelRegister {
  job: Job;
}

export default function ManualEntryPage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  
  const canApproveForProduction = user?.role === "MANAGER" || user?.role === "ADMIN";
  
  // Parse date, logId, jobId and panelMark from URL query parameters if present
  const urlParams = new URLSearchParams(searchString);
  const dateFromUrl = urlParams.get("date");
  const logIdFromUrl = urlParams.get("logId");
  const jobIdFromUrl = urlParams.get("jobId");
  const panelMarkFromUrl = urlParams.get("panelMark");
  const initialDate = dateFromUrl && /^\d{4}-\d{2}-\d{2}$/.test(dateFromUrl) ? dateFromUrl : today;
  
  const [selectedJobId, setSelectedJobId] = useState<string | null>(jobIdFromUrl);
  const [addNewPanel, setAddNewPanel] = useState(false);
  const [newPanelMark, setNewPanelMark] = useState("");
  const [selectedDate, setSelectedDate] = useState(initialDate);

  // Production approval dialog state
  const [productionDialogOpen, setProductionDialogOpen] = useState(false);
  const [productionPanel, setProductionPanel] = useState<PanelWithJob | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [productionFormData, setProductionFormData] = useState({
    loadWidth: "",
    loadHeight: "",
    panelThickness: "",
    panelVolume: "",
    panelMass: "",
    panelArea: "",
    liftFcm: "",
    concreteStrengthMpa: "",
    rotationalLifters: "",
    primaryLifters: "",
    productionPdfUrl: "",
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const { data: jobs } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  const { data: panels } = useQuery<PanelWithJob[]>({
    queryKey: [PANELS_ROUTES.LIST],
  });

  const { data: workTypes } = useQuery<WorkType[]>({
    queryKey: [SETTINGS_ROUTES.WORK_TYPES],
  });

  // Fetch existing daily logs to find the latest end time
  const { data: dailyLogs } = useQuery<DailyLogWithRows[]>({
    queryKey: [DAILY_LOGS_ROUTES.LIST],
  });

  // Calculate the latest end time from existing entries for the selected date
  const latestEndTime = useMemo(() => {
    if (!dailyLogs) return "09:00";
    
    // Find the log for the selected date
    const logForDay = dailyLogs.find(log => log.logDay === selectedDate);
    if (!logForDay || !logForDay.rows || logForDay.rows.length === 0) return "09:00";
    
    // Find the latest end time from all rows
    let latestDate: Date | null = null;
    for (const row of logForDay.rows) {
      if (row.endAt) {
        const endDate = new Date(row.endAt);
        if (!latestDate || endDate > latestDate) {
          latestDate = endDate;
        }
      }
    }
    
    if (!latestDate) return "09:00";
    
    // Format the time as HH:MM in Melbourne timezone
    // The Date object from UTC timestamp will be automatically converted to local time
    // For server-side Melbourne times, we need to format using the Intl API
    const formatter = new Intl.DateTimeFormat('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Australia/Melbourne'
    });
    
    const parts = formatter.formatToParts(latestDate);
    const hours = parts.find(p => p.type === 'hour')?.value || '09';
    const minutes = parts.find(p => p.type === 'minute')?.value || '00';
    return `${hours}:${minutes}`;
  }, [dailyLogs, selectedDate]);

  // Calculate end time (30 minutes after start)
  const calculateEndTime = (startTime: string): string => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + 30;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  };

  const filteredPanels = panels?.filter(p => 
    !selectedJobId || selectedJobId === "none" || p.jobId === selectedJobId
  )?.sort((a, b) => {
    // Sort by Building first, then by Level, then by Panel Mark
    const buildingA = a.building || "";
    const buildingB = b.building || "";
    if (buildingA !== buildingB) {
      return buildingA.localeCompare(buildingB, undefined, { numeric: true });
    }
    const levelA = a.level || "";
    const levelB = b.level || "";
    if (levelA !== levelB) {
      return levelA.localeCompare(levelB, undefined, { numeric: true });
    }
    return a.panelMark.localeCompare(b.panelMark, undefined, { numeric: true });
  });

  // Group panels by Building and Level for display
  const groupedPanels = filteredPanels?.filter(p => p.status !== "COMPLETED").reduce((acc, panel) => {
    const building = panel.building || "No Building";
    const level = panel.level || "No Level";
    const key = `${building}|${level}`;
    if (!acc[key]) {
      acc[key] = { building, level, panels: [] };
    }
    acc[key].panels.push(panel);
    return acc;
  }, {} as Record<string, { building: string; level: string; panels: typeof filteredPanels }>);

  const form = useForm<ManualEntryForm>({
    resolver: zodResolver(manualEntrySchema),
    defaultValues: {
      logDay: initialDate,
      app: "acad",
      startTime: "09:00",
      endTime: "09:30",
      jobId: "",
      panelRegisterId: "",
      workTypeId: "",
      fileName: "",
      filePath: "",
      revitViewName: "",
      revitSheetNumber: "",
      revitSheetName: "",
      acadLayoutName: "",
      panelMark: "",
      drawingCode: "",
      notes: "",
      // Panel details defaults
      panelLoadWidth: "",
      panelLoadHeight: "",
      panelThickness: "",
      panelVolume: "",
      panelMass: "",
      panelArea: "",
      panelDay28Fc: "",
      panelLiftFcm: "",
      panelRotationalLifters: "",
      panelPrimaryLifters: "",
    },
  });

  // Update start and end times when latest end time changes or date changes
  useEffect(() => {
    const newStartTime = latestEndTime;
    const newEndTime = calculateEndTime(newStartTime);
    form.setValue("startTime", newStartTime);
    form.setValue("endTime", newEndTime);
  }, [latestEndTime, form]);

  // Handle date change - update selectedDate state
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    form.setValue("logDay", newDate);
  };

  // Prevent Enter key from submitting form on date input
  const handleDateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  const watchedPanelRegisterId = form.watch("panelRegisterId");

  // Get the selected panel for display
  const selectedPanel = panels?.find(p => p.id === watchedPanelRegisterId);

  useEffect(() => {
    if (watchedPanelRegisterId && watchedPanelRegisterId !== "none") {
      const panel = panels?.find(p => p.id === watchedPanelRegisterId);
      if (panel) {
        // Populate panel mark from selected panel
        form.setValue("panelMark", panel.panelMark || "");
        // Populate drawing code
        if (panel.drawingCode) {
          form.setValue("drawingCode", panel.drawingCode);
        }
        // Populate sheet information from panel
        if (panel.sheetNumber) {
          form.setValue("revitSheetNumber", panel.sheetNumber);
        }
        // Populate panel details
        form.setValue("panelLoadWidth", panel.loadWidth || "");
        form.setValue("panelLoadHeight", panel.loadHeight || "");
        form.setValue("panelThickness", panel.panelThickness || "");
        form.setValue("panelVolume", panel.panelVolume || "");
        form.setValue("panelMass", panel.panelMass || "");
        form.setValue("panelArea", panel.panelArea || "");
        form.setValue("panelDay28Fc", panel.day28Fc || "");
        form.setValue("panelLiftFcm", panel.liftFcm || "");
        form.setValue("panelRotationalLifters", panel.rotationalLifters || "");
        form.setValue("panelPrimaryLifters", panel.primaryLifters || "");
      }
    } else {
      // Clear panel details when no panel selected
      form.setValue("panelMark", "");
      form.setValue("revitSheetNumber", "");
      form.setValue("panelLoadWidth", "");
      form.setValue("panelLoadHeight", "");
      form.setValue("panelThickness", "");
      form.setValue("panelVolume", "");
      form.setValue("panelMass", "");
      form.setValue("panelArea", "");
      form.setValue("panelDay28Fc", "");
      form.setValue("panelLiftFcm", "");
      form.setValue("panelRotationalLifters", "");
      form.setValue("panelPrimaryLifters", "");
    }
  }, [watchedPanelRegisterId, panels, form]);

  // Auto-select panel from URL parameters
  useEffect(() => {
    if (panelMarkFromUrl && panels && panels.length > 0 && selectedJobId) {
      const matchingPanel = panels.find(
        p => p.panelMark === panelMarkFromUrl && p.jobId === selectedJobId
      );
      if (matchingPanel && form.getValues("panelRegisterId") !== matchingPanel.id) {
        form.setValue("panelRegisterId", matchingPanel.id);
      }
    }
  }, [panelMarkFromUrl, panels, selectedJobId, form]);

  const createEntryMutation = useMutation({
    mutationFn: async (data: ManualEntryForm) => {
      const res = await apiRequest("POST", MANUAL_ENTRY_ROUTES.ENTRY, data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.newPanelCreated) {
        toast({ 
          title: "Time entry created", 
          description: `Panel "${newPanelMark}" has been added to the Panel Register.`
        });
      } else {
        toast({ title: "Time entry created successfully" });
      }
      queryClient.invalidateQueries({ queryKey: [DAILY_LOGS_ROUTES.LIST] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PANELS] });
      queryClient.invalidateQueries({ queryKey: [PANELS_ROUTES.LIST] });
      // Navigate back to the daily report detail if we came from there, otherwise to the list
      if (logIdFromUrl) {
        navigate(`/daily-reports/${logIdFromUrl}`);
      } else {
        navigate("/daily-reports");
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateDocumentStatusMutation = useMutation({
    mutationFn: async ({ panelId, documentStatus }: { panelId: string; documentStatus: string }) => {
      const res = await apiRequest("PUT", PANELS_ROUTES.DOCUMENT_STATUS(panelId), { documentStatus });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Document status updated successfully" });
      queryClient.invalidateQueries({ queryKey: [PANELS_ROUTES.LIST] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PANELS] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // PDF Upload mutation
  const uploadPdfMutation = useMutation({
    mutationFn: async ({ panelId, pdfBase64, fileName }: { panelId: string; pdfBase64: string; fileName: string }) => {
      const res = await apiRequest("POST", ADMIN_ROUTES.PANEL_UPLOAD_PDF(panelId), { pdfBase64, fileName });
      return res.json();
    },
  });

  // PDF Analysis mutation
  const analyzePdfMutation = useMutation({
    mutationFn: async ({ panelId, pdfBase64 }: { panelId: string; pdfBase64: string }) => {
      const res = await apiRequest("POST", ADMIN_ROUTES.PANEL_ANALYZE_PDF(panelId), { pdfBase64 });
      return res.json();
    },
    onSuccess: (result) => {
      if (result.extracted) {
        setProductionFormData((prev) => ({
          ...prev,
          loadWidth: result.extracted.loadWidth || prev.loadWidth,
          loadHeight: result.extracted.loadHeight || prev.loadHeight,
          panelThickness: result.extracted.panelThickness || prev.panelThickness,
          panelVolume: result.extracted.panelVolume || prev.panelVolume,
          panelMass: result.extracted.panelMass || prev.panelMass,
          panelArea: result.extracted.panelArea || prev.panelArea,
          liftFcm: result.extracted.liftFcm || prev.liftFcm,
          concreteStrengthMpa: result.extracted.concreteStrengthMpa || result.extracted.day28Fc || prev.concreteStrengthMpa,
          rotationalLifters: result.extracted.rotationalLifters || prev.rotationalLifters,
          primaryLifters: result.extracted.primaryLifters || prev.primaryLifters,
        }));
        toast({ title: "PDF analyzed successfully" });
      }
      setIsAnalyzing(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error analyzing PDF", description: error.message, variant: "destructive" });
      setIsAnalyzing(false);
    },
  });

  // Production approval mutation
  const approveProductionMutation = useMutation({
    mutationFn: async ({ panelId, data }: { panelId: string; data: typeof productionFormData }) => {
      const res = await apiRequest("POST", ADMIN_ROUTES.PANEL_APPROVE_PRODUCTION(panelId), data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Panel approved for production" });
      queryClient.invalidateQueries({ queryKey: [PANELS_ROUTES.LIST] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PANELS] });
      closeProductionDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Production dialog handlers
  const openProductionDialog = (panel: PanelWithJob) => {
    setProductionPanel(panel);
    setProductionFormData({
      loadWidth: panel.loadWidth || "",
      loadHeight: panel.loadHeight || "",
      panelThickness: panel.panelThickness || "",
      panelVolume: panel.panelVolume || "",
      panelMass: panel.panelMass || "",
      panelArea: panel.panelArea || "",
      liftFcm: panel.liftFcm || "",
      concreteStrengthMpa: panel.concreteStrengthMpa || panel.day28Fc || "",
      rotationalLifters: panel.rotationalLifters || "",
      primaryLifters: panel.primaryLifters || "",
      productionPdfUrl: panel.productionPdfUrl || "",
    });
    setPdfFile(null);
    setValidationErrors([]);
    setProductionDialogOpen(true);
  };

  const closeProductionDialog = () => {
    setProductionDialogOpen(false);
    setProductionPanel(null);
    setPdfFile(null);
    setValidationErrors([]);
    setProductionFormData({
      loadWidth: "",
      loadHeight: "",
      panelThickness: "",
      panelVolume: "",
      panelMass: "",
      panelArea: "",
      liftFcm: "",
      concreteStrengthMpa: "",
      rotationalLifters: "",
      primaryLifters: "",
      productionPdfUrl: "",
    });
  };

  const handlePdfDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
    }
  }, []);

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFile(file);
    }
  };

  const analyzePdf = async () => {
    if (!pdfFile || !productionPanel) return;
    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const uploadResult = await uploadPdfMutation.mutateAsync({ 
          panelId: productionPanel.id, 
          pdfBase64: base64,
          fileName: pdfFile.name 
        });
        if (uploadResult.objectPath) {
          setProductionFormData((prev) => ({
            ...prev,
            productionPdfUrl: uploadResult.objectPath,
          }));
        }
        analyzePdfMutation.mutate({ panelId: productionPanel.id, pdfBase64: base64 });
      } catch (error: any) {
        toast({ title: "Error uploading PDF", description: error.message, variant: "destructive" });
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(pdfFile);
  };

  const handleApproveProduction = () => {
    if (!productionPanel) return;

    const errors: string[] = [];
    if (!productionFormData.loadWidth) errors.push("Load Width is required");
    if (!productionFormData.loadHeight) errors.push("Load Height is required");
    if (!productionFormData.panelThickness) errors.push("Panel Thickness is required");
    if (!productionFormData.concreteStrengthMpa) errors.push("Concrete Strength f'c (MPa) is required");
    if (!productionFormData.liftFcm) errors.push("Lift f'cm is required");

    if (errors.length > 0) {
      setValidationErrors(errors);
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    // First update document status to IFC, then approve for production
    updateDocumentStatusMutation.mutate({ 
      panelId: productionPanel.id, 
      documentStatus: "IFC" 
    }, {
      onSuccess: () => {
        approveProductionMutation.mutate({ panelId: productionPanel.id, data: productionFormData });
      }
    });
  };

  // Calculate panel metrics when dimensions change
  useEffect(() => {
    const width = parseFloat(productionFormData.loadWidth);
    const height = parseFloat(productionFormData.loadHeight);
    const thickness = parseFloat(productionFormData.panelThickness);
    
    if (!isNaN(width) && !isNaN(height) && !isNaN(thickness)) {
      const areaM2 = (width * height) / 1000000;
      const volumeM3 = areaM2 * (thickness / 1000);
      const massKg = volumeM3 * 2500;
      
      setProductionFormData((prev) => ({
        ...prev,
        panelArea: areaM2.toFixed(3),
        panelVolume: volumeM3.toFixed(3),
        panelMass: Math.round(massKg).toString(),
      }));
    }
  }, [productionFormData.loadWidth, productionFormData.loadHeight, productionFormData.panelThickness]);

  const onSubmit = (data: ManualEntryForm) => {
    const submitData = {
      ...data,
      jobId: data.jobId === "none" ? undefined : data.jobId,
      panelRegisterId: addNewPanel ? undefined : (data.panelRegisterId === "none" ? undefined : data.panelRegisterId),
      workTypeId: data.workTypeId && data.workTypeId !== "none" ? parseInt(data.workTypeId) : undefined,
      createNewPanel: addNewPanel && newPanelMark ? true : undefined,
      newPanelMark: addNewPanel && newPanelMark ? newPanelMark : undefined,
      // Include panel details for update
      panelDetails: data.panelRegisterId && data.panelRegisterId !== "none" ? {
        loadWidth: data.panelLoadWidth || undefined,
        loadHeight: data.panelLoadHeight || undefined,
        panelThickness: data.panelThickness || undefined,
        panelVolume: data.panelVolume || undefined,
        panelMass: data.panelMass || undefined,
        panelArea: data.panelArea || undefined,
        day28Fc: data.panelDay28Fc || undefined,
        liftFcm: data.panelLiftFcm || undefined,
        rotationalLifters: data.panelRotationalLifters || undefined,
        primaryLifters: data.panelPrimaryLifters || undefined,
      } : undefined,
    };
    createEntryMutation.mutate(submitData as ManualEntryForm);
  };

  const handleJobChange = (jobId: string) => {
    setSelectedJobId(jobId === "none" ? null : jobId);
    form.setValue("jobId", jobId);
    form.setValue("panelRegisterId", "");
    form.setValue("panelMark", "");
    form.setValue("drawingCode", "");
    form.setValue("revitSheetNumber", "");
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      NOT_STARTED: "outline",
      IN_PROGRESS: "default",
      COMPLETED: "secondary",
      ON_HOLD: "destructive",
    };
    return <Badge variant={variants[status] || "default"} className="ml-2 text-xs">{status.replace("_", " ")}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => logIdFromUrl ? navigate(`/daily-reports/${logIdFromUrl}`) : navigate("/daily-reports")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-manual-entry-title">
            Manual Time Entry
          </h1>
          <p className="text-muted-foreground">
            Log time manually when the add-in is not available
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            New Time Entry
          </CardTitle>
          <CardDescription>
            Enter your time worked with the same detail as the automatic tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="logDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          onChange={(e) => handleDateChange(e.target.value)}
                          onKeyDown={handleDateKeyDown}
                          data-testid="input-log-day" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} data-testid="input-start-time" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} data-testid="input-end-time" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="app"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Application</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-app">
                            <SelectValue placeholder="Select application" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="revit">Revit</SelectItem>
                          <SelectItem value="acad">AutoCAD</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              </div>

              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Panel Register Selection
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Link this entry to a panel from the register for automatic tracking
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="add-new-panel" 
                      checked={addNewPanel}
                      onCheckedChange={(checked) => {
                        setAddNewPanel(checked === true);
                        if (checked) {
                          form.setValue("panelRegisterId", "");
                        } else {
                          setNewPanelMark("");
                        }
                      }}
                      disabled={!selectedJobId || selectedJobId === "none"}
                      data-testid="checkbox-add-new-panel"
                    />
                    <label 
                      htmlFor="add-new-panel" 
                      className={`text-sm font-medium leading-none ${(!selectedJobId || selectedJobId === "none") ? 'text-muted-foreground' : 'cursor-pointer'}`}
                    >
                      Add new panel to register
                    </label>
                  </div>

                  {addNewPanel && newPanelMark && (
                    <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                      <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <AlertDescription className="text-blue-800 dark:text-blue-200">
                        Panel "<strong>{newPanelMark}</strong>" will be automatically added to the Panel Register for this job when you save this entry.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="jobId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            Job
                          </FormLabel>
                          <Select onValueChange={handleJobChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger data-testid="select-job">
                                <SelectValue placeholder="Select job (optional)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No job selected</SelectItem>
                              {jobs?.filter(j => j.status === "ACTIVE").map((job) => (
                                <SelectItem key={job.id} value={job.id}>
                                  {job.jobNumber} - {job.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-xs">Select job to filter panels</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {!addNewPanel ? (
                      <FormField
                        control={form.control}
                        name="panelRegisterId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1">
                              <ClipboardList className="h-3 w-3" />
                              Panel
                            </FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              value={field.value || ""}
                              disabled={!selectedJobId || selectedJobId === "none"}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-panel">
                                  <SelectValue placeholder={selectedJobId ? "Select panel" : "Select job first"} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="max-h-[400px]">
                                <SelectItem value="none">No panel selected</SelectItem>
                                {groupedPanels && Object.entries(groupedPanels)
                                  .sort(([keyA], [keyB]) => keyA.localeCompare(keyB, undefined, { numeric: true }))
                                  .map(([key, { building, level, panels: groupPanels }]) => (
                                  <SelectGroup key={key}>
                                    <SelectLabel className="bg-muted/50 text-xs font-semibold py-1.5">
                                      Bldg: {building} / Level: {level}
                                    </SelectLabel>
                                    {groupPanels?.map((panel) => (
                                      <SelectItem key={panel.id} value={panel.id}>
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono font-medium">{panel.panelMark}</span>
                                          <span className="text-muted-foreground text-xs">
                                            {panel.panelType || "WALL"}
                                          </span>
                                          {getStatusBadge(panel.status)}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription className="text-xs">Auto-fills drawing code when selected</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <div className="space-y-2">
                        <FormLabel className="flex items-center gap-1">
                          <ClipboardList className="h-3 w-3" />
                          New Panel Mark
                        </FormLabel>
                        <Input 
                          placeholder="e.g., PM-001" 
                          value={newPanelMark}
                          onChange={(e) => setNewPanelMark(e.target.value)}
                          disabled={!selectedJobId || selectedJobId === "none"}
                          data-testid="input-new-panel-mark"
                        />
                        <p className="text-xs text-muted-foreground">Enter the panel mark for the new panel</p>
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="workTypeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            Work Type
                          </FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value || ""}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-work-type">
                                <SelectValue placeholder="Select work type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No work type</SelectItem>
                              {workTypes?.map((wt) => (
                                <SelectItem key={wt.id} value={String(wt.id)}>
                                  {wt.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-xs">Categorize the type of drafting work</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Panel Details Section - shows when panel is selected */}
              {selectedPanel && watchedPanelRegisterId && watchedPanelRegisterId !== "none" && (
                <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Ruler className="h-4 w-4" />
                      Panel Details - {selectedPanel.panelMark}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      Review and update panel specifications. Changes will be saved to the panel record.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Document Status Section */}
                    <div className="flex items-center gap-4 p-3 bg-background rounded-md border">
                      <div className="flex-1">
                        <Label className="text-sm font-medium">Document Status</Label>
                        <p className="text-xs text-muted-foreground">
                          Track the document approval workflow: DRAFT → IFA → IFC → Approved for Production
                        </p>
                      </div>
                      <Select
                        value={selectedPanel.documentStatus || "DRAFT"}
                        onValueChange={(value) => {
                          if (value === "IFC" && selectedPanel.documentStatus !== "IFC") {
                            // Open production dialog when changing to IFC
                            openProductionDialog(selectedPanel);
                          } else {
                            updateDocumentStatusMutation.mutate({ 
                              panelId: selectedPanel.id, 
                              documentStatus: value 
                            });
                          }
                        }}
                        disabled={updateDocumentStatusMutation.isPending}
                      >
                        <SelectTrigger className="w-[180px]" data-testid="select-document-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DRAFT">DRAFT</SelectItem>
                          <SelectItem value="IFA">IFA (Issued for Approval)</SelectItem>
                          <SelectItem value="IFC">IFC (Issued for Construction)</SelectItem>
                          <SelectItem 
                            value="APPROVED" 
                            disabled={!canApproveForProduction || selectedPanel.documentStatus !== "IFC"}
                          >
                            Approved for Production {!canApproveForProduction && "(Manager/Admin only)"}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <FormField
                        control={form.control}
                        name="panelLoadWidth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Load Width (mm)</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 2400" {...field} data-testid="input-panel-load-width" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="panelLoadHeight"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Load Height (mm)</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 3000" {...field} data-testid="input-panel-load-height" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="panelThickness"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Thickness (mm)</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 200" {...field} data-testid="input-panel-thickness" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <FormField
                        control={form.control}
                        name="panelVolume"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Volume (m³)</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 1.44" {...field} data-testid="input-panel-volume" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="panelMass"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mass (kg)</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 3600" {...field} data-testid="input-panel-mass" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="panelArea"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Area (m²)</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 7.2" {...field} data-testid="input-panel-area" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="panelDay28Fc"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>28-Day Fc (MPa)</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 40" {...field} data-testid="input-panel-day28fc" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="panelLiftFcm"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lift Fcm (MPa)</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 25" {...field} data-testid="input-panel-lift-fcm" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="panelRotationalLifters"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rotational Lifters</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 2x Rotational" {...field} data-testid="input-panel-rotational-lifters" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="panelPrimaryLifters"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Primary Lifters</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 4x Primary" {...field} data-testid="input-panel-primary-lifters" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              <FormField
                control={form.control}
                name="drawingCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Drawing Code</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., DWG-001" {...field} data-testid="input-drawing-code" />
                    </FormControl>
                    <FormDescription>Drawing reference code (auto-filled when panel selected)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Any additional notes about this time entry..." 
                        className="resize-none"
                        {...field} 
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => logIdFromUrl ? navigate(`/daily-reports/${logIdFromUrl}`) : navigate("/daily-reports")}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createEntryMutation.isPending}
                  data-testid="button-save-entry"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {createEntryMutation.isPending ? "Saving..." : "Save Entry"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Production Approval Dialog */}
      <Dialog open={productionDialogOpen} onOpenChange={(open) => !open && closeProductionDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hammer className="h-5 w-5" />
              Set Up for Production - IFC Approval
            </DialogTitle>
            <DialogDescription>
              {productionPanel && (
                <span>
                  Panel: <strong className="font-mono">{productionPanel.panelMark}</strong>
                  {productionPanel.approvedForProduction && (
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
                  Analyze PDF with AI
                </Button>
              )}
              {productionFormData.productionPdfUrl && !pdfFile && productionApprovalPanel && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">IFC Document Attached</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    data-testid="button-view-pdf"
                  >
                    <a href={ADMIN_ROUTES.PANEL_DOWNLOAD_PDF(productionApprovalPanel.id)} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      View PDF
                    </a>
                  </Button>
                </div>
              )}
            </div>

            {/* Panel Dimensions */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prod-loadWidth">Load Width (mm) <span className="text-red-500">*</span></Label>
                <Input
                  id="prod-loadWidth"
                  value={productionFormData.loadWidth}
                  onChange={(e) => setProductionFormData({ ...productionFormData, loadWidth: e.target.value })}
                  placeholder="e.g., 3000"
                  data-testid="input-prod-load-width"
                  className={validationErrors.includes("Load Width is required") ? "border-red-500" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-loadHeight">Load Height (mm) <span className="text-red-500">*</span></Label>
                <Input
                  id="prod-loadHeight"
                  value={productionFormData.loadHeight}
                  onChange={(e) => setProductionFormData({ ...productionFormData, loadHeight: e.target.value })}
                  placeholder="e.g., 2800"
                  data-testid="input-prod-load-height"
                  className={validationErrors.includes("Load Height is required") ? "border-red-500" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-panelThickness">Panel Thickness (mm) <span className="text-red-500">*</span></Label>
                <Input
                  id="prod-panelThickness"
                  value={productionFormData.panelThickness}
                  onChange={(e) => setProductionFormData({ ...productionFormData, panelThickness: e.target.value })}
                  placeholder="e.g., 200"
                  data-testid="input-prod-thickness"
                  className={validationErrors.includes("Panel Thickness is required") ? "border-red-500" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-panelArea">Panel Area (m²)</Label>
                <Input
                  id="prod-panelArea"
                  value={productionFormData.panelArea}
                  readOnly
                  className="bg-muted"
                  placeholder="Auto-calculated"
                  data-testid="input-prod-area"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-panelVolume">Panel Volume (m³)</Label>
                <Input
                  id="prod-panelVolume"
                  value={productionFormData.panelVolume}
                  readOnly
                  className="bg-muted"
                  placeholder="Auto-calculated"
                  data-testid="input-prod-volume"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-panelMass">Panel Mass (kg)</Label>
                <Input
                  id="prod-panelMass"
                  value={productionFormData.panelMass}
                  readOnly
                  className="bg-muted"
                  placeholder="Auto-calculated"
                  data-testid="input-prod-mass"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-concreteStrengthMpa">Concrete Strength f'c (MPa) <span className="text-red-500">*</span></Label>
                <Input
                  id="prod-concreteStrengthMpa"
                  value={productionFormData.concreteStrengthMpa}
                  onChange={(e) => setProductionFormData({ ...productionFormData, concreteStrengthMpa: e.target.value })}
                  placeholder="e.g., 40, 50, 65"
                  data-testid="input-prod-concrete-strength"
                  className={validationErrors.includes("Concrete Strength f'c (MPa) is required") ? "border-red-500" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-liftFcm">Lift f'cm (MPa) <span className="text-red-500">*</span></Label>
                <Input
                  id="prod-liftFcm"
                  value={productionFormData.liftFcm}
                  onChange={(e) => setProductionFormData({ ...productionFormData, liftFcm: e.target.value })}
                  placeholder="e.g., 25"
                  data-testid="input-prod-lift-fcm"
                  className={validationErrors.includes("Lift f'cm is required") ? "border-red-500" : ""}
                />
              </div>
            </div>

            {/* Validation Errors Display */}
            {validationErrors.length > 0 && (
              <div className="border border-red-200 bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
                <p className="font-medium text-sm text-red-600 dark:text-red-400 mb-2">Please complete all required fields:</p>
                <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-400 space-y-1">
                  {validationErrors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Lifters */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prod-rotationalLifters">Rotational Lifters</Label>
                <Input
                  id="prod-rotationalLifters"
                  value={productionFormData.rotationalLifters}
                  onChange={(e) => setProductionFormData({ ...productionFormData, rotationalLifters: e.target.value })}
                  placeholder="e.g., 2x ERH-2.5T"
                  data-testid="input-prod-rotational-lifters"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-primaryLifters">Primary Lifters</Label>
                <Input
                  id="prod-primaryLifters"
                  value={productionFormData.primaryLifters}
                  onChange={(e) => setProductionFormData({ ...productionFormData, primaryLifters: e.target.value })}
                  placeholder="e.g., 4x Anchor Point"
                  data-testid="input-prod-primary-lifters"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={closeProductionDialog} data-testid="button-cancel-production">
              Cancel
            </Button>
            <Button 
              onClick={handleApproveProduction}
              disabled={approveProductionMutation.isPending || updateDocumentStatusMutation.isPending}
              data-testid="button-approve-production"
            >
              {(approveProductionMutation.isPending || updateDocumentStatusMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approve for Production
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
