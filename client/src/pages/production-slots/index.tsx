import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PRODUCTION_ROUTES, DRAFTING_ROUTES, JOBS_ROUTES, ADMIN_ROUTES, FACTORIES_ROUTES, PANELS_ROUTES, USER_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Calendar, ListPlus, LayoutGrid, FileDown } from "lucide-react";
import { format, differenceInDays, addDays } from "date-fns";
import type { Job, PanelRegister, GlobalSettings, Factory } from "@shared/schema";
import { PageHelpButton } from "@/components/help/page-help-button";
import type { ProductionSlotWithDetails, ProductionSlotAdjustmentWithDetails, StatusFilter, GroupBy } from "./types";
import { getWeekKey, getWeekLabel } from "./utils";
import { CalendarView } from "./CalendarView";
import { SlotFilters } from "./SlotFilters";
import { SlotTable } from "./SlotTable";
import { ProductionSlotDialogs } from "./ProductionSlotDialogs";

export default function ProductionSlotsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isManagerOrAdmin = user?.role === "MANAGER" || user?.role === "ADMIN";
  
  const { data: globalSettings } = useQuery<GlobalSettings>({
    queryKey: [ADMIN_ROUTES.SETTINGS],
  });
  
  const weekStartDay = globalSettings?.weekStartDay ?? 1;
  const productionWindowDays = globalSettings?.productionWindowDays ?? 10;
  
  const { data: userSettings } = useQuery<{ selectedFactoryIds: string[]; defaultFactoryId: string | null }>({
    queryKey: [USER_ROUTES.SETTINGS],
  });

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [factoryFilter, setFactoryFilter] = useState<string>("all");
  const [factoryFilterInitialized, setFactoryFilterInitialized] = useState(false);
  const [dateFromFilter, setDateFromFilter] = useState<string>("");
  const [dateToFilter, setDateToFilter] = useState<string>("");

  const [groupBy, setGroupBy] = useState<GroupBy>("week");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  const [viewMode, setViewMode] = useState<"grid" | "calendar">("grid");
  const [calendarViewMode, setCalendarViewMode] = useState<"week" | "month">("week");
  const [calendarCurrentDate, setCalendarCurrentDate] = useState<Date>(new Date());
  
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showPanelBreakdownDialog, setShowPanelBreakdownDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<ProductionSlotWithDetails | null>(null);
  const [selectedJobsForGeneration, setSelectedJobsForGeneration] = useState<string[]>([]);
  
  const [adjustNewDate, setAdjustNewDate] = useState<string>("");
  const [adjustReason, setAdjustReason] = useState<string>("");
  const [adjustClientConfirmed, setAdjustClientConfirmed] = useState<boolean>(false);
  const [adjustCascade, setAdjustCascade] = useState<boolean>(false);
  
  const [panelSearchQuery, setPanelSearchQuery] = useState<string>("");
  const [panelStatusFilter, setPanelStatusFilter] = useState<string>("all");
  const [panelTypeFilter, setPanelTypeFilter] = useState<string>("all");
  const [expandedPanelTypes, setExpandedPanelTypes] = useState<Set<string>>(new Set());
  
  const [bookingPanelId, setBookingPanelId] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState<string>("");
  
  const [showLevelMismatchDialog, setShowLevelMismatchDialog] = useState(false);
  const [levelMismatchInfo, setLevelMismatchInfo] = useState<{
    jobId: string;
    jobName: string;
    jobLevels: number;
    panelLevels: number;
    highestJobLevel: string;
    highestPanelLevel: string;
    emptyLevels: string[];
  } | null>(null);
  const [pendingJobsForGeneration, setPendingJobsForGeneration] = useState<string[]>([]);
  
  const [showDraftingUpdateDialog, setShowDraftingUpdateDialog] = useState(false);
  const [showDraftingWarningDialog, setShowDraftingWarningDialog] = useState(false);

  const { data: slots = [], isLoading: loadingSlots } = useQuery<ProductionSlotWithDetails[]>({
    queryKey: [PRODUCTION_ROUTES.SLOTS, { status: statusFilter !== "ALL" ? statusFilter : undefined, jobId: jobFilter !== "all" ? jobFilter : undefined, factoryId: factoryFilter !== "all" ? factoryFilter : undefined, dateFrom: dateFromFilter || undefined, dateTo: dateToFilter || undefined }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (jobFilter !== "all") params.append("jobId", jobFilter);
      if (factoryFilter !== "all") params.append("factoryId", factoryFilter);
      if (dateFromFilter) params.append("dateFrom", dateFromFilter);
      if (dateToFilter) params.append("dateTo", dateToFilter);
      const response = await fetch(`${PRODUCTION_ROUTES.SLOTS}?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch production slots");
      return response.json();
    },
  });

  const { data: jobsWithoutSlots = [] } = useQuery<Job[]>({
    queryKey: [PRODUCTION_ROUTES.SLOTS_JOBS_WITHOUT],
  });

  const { data: allJobs = [] } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
    select: (data: any) => data.map((j: any) => ({ id: j.id, jobNumber: j.jobNumber, name: j.name, client: j.client, factoryId: j.factoryId })),
  });

  const { data: factories = [] } = useQuery<Factory[]>({
    queryKey: [ADMIN_ROUTES.FACTORIES],
  });

  useEffect(() => {
    if (!factoryFilterInitialized && userSettings && factories) {
      if (userSettings.defaultFactoryId && factories.some(f => f.id === userSettings.defaultFactoryId)) {
        setFactoryFilter(userSettings.defaultFactoryId);
      }
      setFactoryFilterInitialized(true);
    }
  }, [userSettings, factoryFilterInitialized, factories]);

  const getFactory = (factoryId: string | null | undefined): Factory | undefined => {
    if (!factoryId || !factories) return undefined;
    return factories.find(f => f.id === factoryId);
  };

  const getFactoryName = (factoryId: string | null | undefined): string => {
    const factory = getFactory(factoryId);
    return factory?.name || "-";
  };

  const exportGridToPDF = useCallback(async () => {
    const { default: jsPDF } = await import("jspdf");
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const rowHeight = 7;
    const colWidths = [35, 25, 20, 25, 30, 25, 25, 25, 40];
    
    pdf.setFontSize(14);
    pdf.setTextColor(0, 0, 0);
    pdf.text("Production Slots Report", margin, margin + 6);
    
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    const dateInfo = dateFromFilter || dateToFilter 
      ? `Date Range: ${dateFromFilter || "Start"} to ${dateToFilter || "End"}`
      : `Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`;
    pdf.text(dateInfo, margin, margin + 12);
    
    const headers = ["Job", "Level", "Panels", "Status", "Factory", "Prod Date", "Delivery", "Days", "Notes"];
    let currentY = margin + 18;
    
    pdf.setFillColor(243, 244, 246);
    pdf.rect(margin, currentY, pageWidth - margin * 2, rowHeight, "F");
    pdf.setFontSize(8);
    pdf.setTextColor(0, 0, 0);
    
    let currentX = margin;
    headers.forEach((header, i) => {
      pdf.text(header, currentX + 1, currentY + 5);
      currentX += colWidths[i];
    });
    
    pdf.setDrawColor(200, 200, 200);
    pdf.rect(margin, currentY, pageWidth - margin * 2, rowHeight);
    
    currentY += rowHeight;
    
    const drawColumnSeparators = (startY: number, endY: number) => {
      pdf.setDrawColor(200, 200, 200);
      let x = margin;
      colWidths.forEach((width) => {
        x += width;
        if (x < pageWidth - margin) {
          pdf.line(x, startY, x, endY);
        }
      });
    };
    
    let pageStartY = currentY;
    
    slots.forEach((slot) => {
      if (currentY + rowHeight > pageHeight - margin) {
        drawColumnSeparators(pageStartY, currentY);
        
        pdf.addPage();
        currentY = margin;
        
        pdf.setFillColor(243, 244, 246);
        pdf.rect(margin, currentY, pageWidth - margin * 2, rowHeight, "F");
        pdf.setFontSize(8);
        pdf.setTextColor(0, 0, 0);
        
        let hx = margin;
        headers.forEach((header, i) => {
          pdf.text(header, hx + 1, currentY + 5);
          hx += colWidths[i];
        });
        pdf.setDrawColor(200, 200, 200);
        pdf.rect(margin, currentY, pageWidth - margin * 2, rowHeight);
        currentY += rowHeight;
        pageStartY = currentY - rowHeight;
      }
      
      const factory = getFactory(slot.job.factoryId);
      const prodDate = format(new Date(slot.productionSlotDate), "dd/MM/yyyy");
      const cycleDays = slot.levelCycleTime ?? slot.job.productionDaysInAdvance ?? 10;
      const deliveryDate = format(addDays(new Date(slot.productionSlotDate), cycleDays), "dd/MM/yyyy");
      
      const rowData = [
        slot.job.jobNumber,
        `Level ${slot.level}`,
        String(slot.panelCount),
        slot.status,
        factory?.code || "-",
        prodDate,
        deliveryDate,
        `${cycleDays}d`,
        ""
      ];
      
      if (slot.status === "COMPLETED") {
        pdf.setFillColor(220, 252, 231);
        pdf.rect(margin, currentY, pageWidth - margin * 2, rowHeight, "F");
      } else if (slot.status === "BOOKED") {
        pdf.setFillColor(254, 243, 199);
        pdf.rect(margin, currentY, pageWidth - margin * 2, rowHeight, "F");
      }
      
      pdf.setFontSize(7);
      pdf.setTextColor(0, 0, 0);
      
      currentX = margin;
      rowData.forEach((data, i) => {
        const text = data.length > 12 ? data.substring(0, 11) + "..." : data;
        pdf.text(text, currentX + 1, currentY + 5);
        currentX += colWidths[i];
      });
      
      pdf.setDrawColor(220, 220, 220);
      pdf.rect(margin, currentY, pageWidth - margin * 2, rowHeight);
      
      currentY += rowHeight;
    });
    
    drawColumnSeparators(pageStartY, currentY);
    
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Total: ${slots.length} production slots`, margin, pageHeight - 5);
    
    pdf.save(`production-slots-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  }, [slots, dateFromFilter, dateToFilter, getFactory]);

  const { data: slotAdjustments = [] } = useQuery<ProductionSlotAdjustmentWithDetails[]>({
    queryKey: [PRODUCTION_ROUTES.SLOTS, selectedSlot?.id, "adjustments"],
    queryFn: async () => {
      if (!selectedSlot) return [];
      const response = await fetch(PRODUCTION_ROUTES.SLOT_ADJUSTMENTS(selectedSlot.id));
      if (!response.ok) throw new Error("Failed to fetch adjustments");
      return response.json();
    },
    enabled: !!selectedSlot && showHistoryDialog,
  });

  const { data: panelsForSlot = [] } = useQuery<PanelRegister[]>({
    queryKey: [PANELS_ROUTES.LIST, { jobId: selectedSlot?.jobId, level: selectedSlot?.level }],
    queryFn: async () => {
      if (!selectedSlot) return [];
      const response = await fetch(`${PANELS_ROUTES.LIST}?jobId=${selectedSlot.jobId}&level=${encodeURIComponent(selectedSlot.level)}`);
      if (!response.ok) throw new Error("Failed to fetch panels");
      return response.json();
    },
    enabled: !!selectedSlot && showPanelBreakdownDialog,
  });
  
  const { data: panelEntries = {} } = useQuery<Record<string, { productionDate: string; entryId: string }>>({
    queryKey: [PRODUCTION_ROUTES.SLOTS, selectedSlot?.id, "panel-entries"],
    queryFn: async () => {
      if (!selectedSlot) return {};
      const response = await fetch(PRODUCTION_ROUTES.SLOT_PANEL_ENTRIES(selectedSlot.id));
      if (!response.ok) throw new Error("Failed to fetch panel entries");
      return response.json();
    },
    enabled: !!selectedSlot && showPanelBreakdownDialog,
  });

  const generateSlotsMutation = useMutation({
    mutationFn: async ({ jobId, skipEmptyLevels }: { jobId: string; skipEmptyLevels?: boolean }) => {
      return apiRequest("POST", PRODUCTION_ROUTES.SLOTS_GENERATE_FOR_JOB(jobId), { skipEmptyLevels });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRODUCTION_ROUTES.SLOTS] });
      queryClient.invalidateQueries({ queryKey: [PRODUCTION_ROUTES.SLOTS_JOBS_WITHOUT] });
      toast({ title: "Success", description: "Production slots generated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to generate slots", variant: "destructive" });
    },
  });

  const updateDraftingProgramMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", DRAFTING_ROUTES.GENERATE);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DRAFTING_ROUTES.PROGRAM] });
      toast({ title: "Success", description: "Drafting program updated successfully" });
      setShowDraftingUpdateDialog(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update drafting program", variant: "destructive" });
    },
  });

  const adjustSlotMutation = useMutation({
    mutationFn: async (data: { id: string; newDate: string; reason: string; clientConfirmed: boolean; cascadeToLater: boolean }) => {
      return apiRequest("POST", PRODUCTION_ROUTES.SLOT_ADJUST(data.id), {
        newDate: data.newDate,
        reason: data.reason,
        clientConfirmed: data.clientConfirmed,
        cascadeToLater: data.cascadeToLater,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRODUCTION_ROUTES.SLOTS] });
      setShowAdjustDialog(false);
      resetAdjustForm();
      toast({ title: "Success", description: "Production slot adjusted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to adjust slot", variant: "destructive" });
    },
  });

  const bookSlotMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", PRODUCTION_ROUTES.SLOT_BOOK(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRODUCTION_ROUTES.SLOTS] });
      toast({ title: "Success", description: "Production slot booked successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to book slot", variant: "destructive" });
    },
  });

  const completeSlotMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", PRODUCTION_ROUTES.SLOT_COMPLETE(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRODUCTION_ROUTES.SLOTS] });
      toast({ title: "Success", description: "Production slot marked as completed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to complete slot", variant: "destructive" });
    },
  });

  const bookPanelMutation = useMutation({
    mutationFn: async ({ slotId, panelId, productionDate }: { slotId: string; panelId: string; productionDate: string }) => {
      return apiRequest("POST", PRODUCTION_ROUTES.SLOT_ASSIGN_PANELS(slotId), { 
        panelAssignments: [{ panelId, productionDate }] 
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [PRODUCTION_ROUTES.SLOTS, selectedSlot?.id, "panel-entries"] });
      queryClient.invalidateQueries({ queryKey: [PRODUCTION_ROUTES.REPORTS] });
      queryClient.invalidateQueries({ queryKey: [PANELS_ROUTES.LIST] });
      setBookingPanelId(null);
      setBookingDate("");
      if (data.created > 0) {
        toast({ title: "Booked", description: "Panel assigned to production schedule" });
      }
      if (data.errors && data.errors.length > 0) {
        toast({ title: "Error", description: data.errors[0], variant: "destructive" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to book panel", variant: "destructive" });
    },
  });
  
  const unbookPanelMutation = useMutation({
    mutationFn: async (entryId: string) => {
      return apiRequest("DELETE", PRODUCTION_ROUTES.ENTRY_BY_ID(entryId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRODUCTION_ROUTES.SLOTS, selectedSlot?.id, "panel-entries"] });
      queryClient.invalidateQueries({ queryKey: [PRODUCTION_ROUTES.REPORTS] });
      queryClient.invalidateQueries({ queryKey: [PANELS_ROUTES.LIST] });
      toast({ title: "Unbooked", description: "Panel removed from production schedule" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to unbook panel", variant: "destructive" });
    },
  });

  const resetAdjustForm = () => {
    setAdjustNewDate("");
    setAdjustReason("");
    setAdjustClientConfirmed(false);
    setAdjustCascade(false);
    setSelectedSlot(null);
  };

  const openAdjustDialog = (slot: ProductionSlotWithDetails) => {
    setSelectedSlot(slot);
    setAdjustNewDate(format(new Date(slot.productionSlotDate), "yyyy-MM-dd"));
    setShowAdjustDialog(true);
  };

  const openPanelBreakdown = (slot: ProductionSlotWithDetails) => {
    setSelectedSlot(slot);
    setShowPanelBreakdownDialog(true);
  };

  const openHistory = (slot: ProductionSlotWithDetails) => {
    setSelectedSlot(slot);
    setShowHistoryDialog(true);
  };

  const handleGenerateSlots = async (skipEmptyLevels: boolean = false) => {
    const jobsToProcess = pendingJobsForGeneration.length > 0 ? pendingJobsForGeneration : selectedJobsForGeneration;
    
    for (const jobId of jobsToProcess) {
      if (!skipEmptyLevels && pendingJobsForGeneration.length === 0) {
        try {
          const response = await fetch(PRODUCTION_ROUTES.SLOTS_CHECK_LEVELS(jobId));
          if (response.ok) {
            const coverage = await response.json();
            if (coverage.hasMismatch) {
              const job = jobsWithoutSlots.find(j => j.id === jobId) || allJobs.find(j => j.id === jobId);
              setLevelMismatchInfo({
                jobId,
                jobName: job?.name || job?.jobNumber || "Unknown Job",
                jobLevels: coverage.jobLevels,
                panelLevels: coverage.panelLevels,
                highestJobLevel: coverage.highestJobLevel,
                highestPanelLevel: coverage.highestPanelLevel,
                emptyLevels: coverage.emptyLevels,
              });
              setPendingJobsForGeneration([jobId]);
              setShowLevelMismatchDialog(true);
              return;
            }
          }
        } catch (error) {
          console.error("Error checking level coverage:", error);
        }
      }
      
      await generateSlotsMutation.mutateAsync({ jobId, skipEmptyLevels });
    }
    
    setShowGenerateDialog(false);
    setShowLevelMismatchDialog(false);
    setSelectedJobsForGeneration([]);
    setPendingJobsForGeneration([]);
    setLevelMismatchInfo(null);
    
    setShowDraftingUpdateDialog(true);
  };
  
  const handleLevelMismatchConfirm = (skipEmpty: boolean) => {
    handleGenerateSlots(skipEmpty);
  };
  
  const handleDraftingUpdateConfirm = (update: boolean) => {
    if (update) {
      updateDraftingProgramMutation.mutate();
    } else {
      setShowDraftingUpdateDialog(false);
      setShowDraftingWarningDialog(true);
    }
  };
  
  const handleDraftingWarningConfirm = (update: boolean) => {
    setShowDraftingWarningDialog(false);
    if (update) {
      updateDraftingProgramMutation.mutate();
    }
  };

  const handleAdjustSubmit = () => {
    if (!selectedSlot || !adjustNewDate || !adjustReason) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    adjustSlotMutation.mutate({
      id: selectedSlot.id,
      newDate: adjustNewDate,
      reason: adjustReason,
      clientConfirmed: adjustClientConfirmed,
      cascadeToLater: adjustCascade,
    });
  };

  const getSlotStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      SCHEDULED: "secondary",
      PENDING_UPDATE: "outline",
      BOOKED: "default",
      COMPLETED: "outline",
    };
    const colors: Record<string, string> = {
      SCHEDULED: "",
      PENDING_UPDATE: "text-yellow-600",
      BOOKED: "bg-blue-600",
      COMPLETED: "text-green-600",
    };
    return <Badge variant={variants[status]} className={colors[status]}>{status.replace("_", " ")}</Badge>;
  };

  const getDateColorClass = (slot: ProductionSlotWithDetails): string => {
    if (slot.status === "COMPLETED") return "";
    const today = new Date();
    const slotDate = new Date(slot.productionSlotDate);
    const daysUntil = differenceInDays(slotDate, today);
    
    if (daysUntil < 0) return "text-red-600 font-semibold";
    if (daysUntil <= 5) return "text-orange-500 font-medium";
    return "";
  };

  const uniquePanelTypes = Array.from(new Set(panelsForSlot.map(p => p.panelType || "Unknown"))).sort();
  const uniquePanelStatuses = Array.from(new Set(panelsForSlot.map(p => p.status || "NOT_STARTED"))).sort();
  
  const filteredPanels = panelsForSlot.filter(panel => {
    const matchesSearch = panelSearchQuery === "" || 
      (panel.panelMark?.toLowerCase().includes(panelSearchQuery.toLowerCase())) ||
      (panel.panelType?.toLowerCase().includes(panelSearchQuery.toLowerCase()));
    const matchesStatus = panelStatusFilter === "all" || (panel.status || "NOT_STARTED") === panelStatusFilter;
    const matchesType = panelTypeFilter === "all" || (panel.panelType || "Unknown") === panelTypeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });
  
  const panelsByType = filteredPanels.reduce((acc, panel) => {
    const type = panel.panelType || "Unknown";
    if (!acc[type]) acc[type] = [];
    acc[type].push(panel);
    return acc;
  }, {} as Record<string, PanelRegister[]>);
  
  const togglePanelTypeGroup = (type: string) => {
    setExpandedPanelTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };
  
  useEffect(() => {
    if (showPanelBreakdownDialog && panelsForSlot.length > 0) {
      const types = Array.from(new Set(panelsForSlot.map(p => p.panelType || "Unknown")));
      setExpandedPanelTypes(new Set(types));
    }
  }, [showPanelBreakdownDialog, panelsForSlot]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const groupedSlots = (() => {
    if (groupBy === "none") return null;
    
    const groups: Record<string, { label: string; slots: ProductionSlotWithDetails[]; job?: Job }> = {};
    
    for (const slot of slots) {
      let key: string;
      let label: string;
      
      if (groupBy === "job") {
        key = slot.jobId;
        label = `${slot.job.jobNumber} - ${slot.job.name || ""}`;
      } else if (groupBy === "week") {
        key = getWeekKey(new Date(slot.productionSlotDate), weekStartDay);
        label = getWeekLabel(key);
      } else if (groupBy === "factory") {
        key = slot.job.factoryId || "no-factory";
        label = getFactoryName(slot.job.factoryId);
      } else {
        key = slot.job.client || "No Client";
        label = slot.job.client || "No Client";
      }
      
      if (!groups[key]) {
        groups[key] = { label, slots: [], job: groupBy === "job" ? slot.job : undefined };
      }
      groups[key].slots.push(slot);
    }
    
    if (groupBy === "week") {
      const sortedEntries = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
      return Object.fromEntries(sortedEntries);
    }
    
    return groups;
  })();

  const getSlotForDateRange = (jobSlots: ProductionSlotWithDetails[], targetDate: Date) => {
    const sorted = [...jobSlots].sort((a, b) => 
      new Date(a.productionSlotDate).getTime() - new Date(b.productionSlotDate).getTime()
    );
    
    for (const slot of sorted) {
      const slotDate = new Date(slot.productionSlotDate);
      const daysDiff = differenceInDays(slotDate, targetDate);
      if (daysDiff >= -3 && daysDiff <= 3) {
        return slot;
      }
    }
    
    for (const slot of sorted) {
      const slotDate = new Date(slot.productionSlotDate);
      if (slotDate >= targetDate) {
        return slot;
      }
    }
    return null;
  };

  const getTimelineDates = () => {
    const today = new Date();
    return [
      { label: "Today", date: today, days: 0 },
      { label: "+7 Days", date: addDays(today, 7), days: 7 },
      { label: "+14 Days", date: addDays(today, 14), days: 14 },
      { label: "+21 Days", date: addDays(today, 21), days: 21 },
      { label: "+28 Days", date: addDays(today, 28), days: 28 },
    ];
  };

  const isWithinOnsiteWindow = (slot: ProductionSlotWithDetails) => {
    if (!slot.job.daysInAdvance) return false;
    const slotDate = new Date(slot.productionSlotDate);
    const today = new Date();
    const daysUntilSlot = differenceInDays(slotDate, today);
    return daysUntilSlot <= 10 && daysUntilSlot >= 0 && slot.status !== "COMPLETED";
  };

  useEffect(() => {
    if (groupedSlots) {
      setExpandedGroups(new Set(Object.keys(groupedSlots)));
    }
  }, [groupBy, slots.length]);

  return (
    <div className="space-y-6" role="main" aria-label="Production Slots">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Production Slots</h1>
            <PageHelpButton pageHelpKey="page.production-slots" />
          </div>
          <p className="text-muted-foreground">Manage and schedule panel production by level</p>
        </div>
        {isManagerOrAdmin && jobsWithoutSlots.length > 0 && (
          <Button onClick={() => setShowGenerateDialog(true)} data-testid="button-generate-slots">
            <ListPlus className="h-4 w-4 mr-2" />
            Generate Slots ({jobsWithoutSlots.length} jobs ready)
          </Button>
        )}
      </div>

      <SlotFilters
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        jobFilter={jobFilter}
        setJobFilter={setJobFilter}
        factoryFilter={factoryFilter}
        setFactoryFilter={setFactoryFilter}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        dateFromFilter={dateFromFilter}
        setDateFromFilter={setDateFromFilter}
        dateToFilter={dateToFilter}
        setDateToFilter={setDateToFilter}
        allJobs={allJobs}
        factories={factories}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Production Slots</CardTitle>
              <CardDescription>View and manage production slots ordered by date</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
                data-testid="button-view-grid"
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                Grid
              </Button>
              <Button
                variant={viewMode === "calendar" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("calendar")}
                data-testid="button-view-calendar"
              >
                <Calendar className="h-4 w-4 mr-1" />
                Calendar
              </Button>
              {viewMode === "grid" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={exportGridToPDF} data-testid="button-export-grid-pdf">
                      <FileDown className="h-4 w-4 mr-1" />
                      Export PDF
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Export grid as vector PDF</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "calendar" ? (
            <CalendarView 
              slots={slots}
              factories={factories}
              getFactory={getFactory}
              currentDate={calendarCurrentDate}
              setCurrentDate={setCalendarCurrentDate}
              calendarViewMode={calendarViewMode}
              setCalendarViewMode={setCalendarViewMode}
              weekStartDay={weekStartDay}
              onSlotClick={(slot) => {
                setSelectedSlot(slot);
                setShowPanelBreakdownDialog(true);
              }}
              selectedFactoryId={factoryFilter !== "all" ? factoryFilter : (factories.length === 1 ? factories[0].id : null)}
            />
          ) : loadingSlots ? (
            <div className="text-center py-8">Loading...</div>
          ) : slots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No production slots found. {jobsWithoutSlots.length > 0 && "Click 'Generate Slots' to create slots for available jobs."}
            </div>
          ) : (
            <SlotTable
              slots={slots}
              groupBy={groupBy}
              groupedSlots={groupedSlots}
              expandedGroups={expandedGroups}
              toggleGroup={toggleGroup}
              isManagerOrAdmin={isManagerOrAdmin}
              getDateColorClass={getDateColorClass}
              getSlotStatusBadge={getSlotStatusBadge}
              openAdjustDialog={openAdjustDialog}
              openPanelBreakdown={openPanelBreakdown}
              openHistory={openHistory}
              bookSlotMutation={bookSlotMutation}
              completeSlotMutation={completeSlotMutation}
              getFactory={getFactory}
              getTimelineDates={getTimelineDates}
              getSlotForDateRange={getSlotForDateRange}
              isWithinOnsiteWindow={isWithinOnsiteWindow}
            />
          )}
        </CardContent>
      </Card>

      <ProductionSlotDialogs
        showGenerateDialog={showGenerateDialog}
        setShowGenerateDialog={setShowGenerateDialog}
        showLevelMismatchDialog={showLevelMismatchDialog}
        setShowLevelMismatchDialog={setShowLevelMismatchDialog}
        showDraftingUpdateDialog={showDraftingUpdateDialog}
        setShowDraftingUpdateDialog={setShowDraftingUpdateDialog}
        showDraftingWarningDialog={showDraftingWarningDialog}
        setShowDraftingWarningDialog={setShowDraftingWarningDialog}
        showAdjustDialog={showAdjustDialog}
        setShowAdjustDialog={setShowAdjustDialog}
        showPanelBreakdownDialog={showPanelBreakdownDialog}
        setShowPanelBreakdownDialog={setShowPanelBreakdownDialog}
        showHistoryDialog={showHistoryDialog}
        setShowHistoryDialog={setShowHistoryDialog}
        selectedSlot={selectedSlot}
        jobsWithoutSlots={jobsWithoutSlots}
        selectedJobsForGeneration={selectedJobsForGeneration}
        setSelectedJobsForGeneration={setSelectedJobsForGeneration}
        generateSlotsMutation={generateSlotsMutation}
        handleGenerateSlots={handleGenerateSlots}
        levelMismatchInfo={levelMismatchInfo}
        setPendingJobsForGeneration={setPendingJobsForGeneration}
        setLevelMismatchInfo={setLevelMismatchInfo}
        handleLevelMismatchConfirm={handleLevelMismatchConfirm}
        handleDraftingUpdateConfirm={handleDraftingUpdateConfirm}
        handleDraftingWarningConfirm={handleDraftingWarningConfirm}
        updateDraftingProgramMutation={updateDraftingProgramMutation}
        adjustNewDate={adjustNewDate}
        setAdjustNewDate={setAdjustNewDate}
        adjustReason={adjustReason}
        setAdjustReason={setAdjustReason}
        adjustClientConfirmed={adjustClientConfirmed}
        setAdjustClientConfirmed={setAdjustClientConfirmed}
        adjustCascade={adjustCascade}
        setAdjustCascade={setAdjustCascade}
        handleAdjustSubmit={handleAdjustSubmit}
        adjustSlotMutation={adjustSlotMutation}
        resetAdjustForm={resetAdjustForm}
        panelsForSlot={panelsForSlot}
        panelEntries={panelEntries}
        panelSearchQuery={panelSearchQuery}
        setPanelSearchQuery={setPanelSearchQuery}
        panelStatusFilter={panelStatusFilter}
        setPanelStatusFilter={setPanelStatusFilter}
        panelTypeFilter={panelTypeFilter}
        setPanelTypeFilter={setPanelTypeFilter}
        expandedPanelTypes={expandedPanelTypes}
        togglePanelTypeGroup={togglePanelTypeGroup}
        filteredPanels={filteredPanels}
        panelsByType={panelsByType}
        uniquePanelTypes={uniquePanelTypes}
        uniquePanelStatuses={uniquePanelStatuses}
        isManagerOrAdmin={isManagerOrAdmin}
        productionWindowDays={productionWindowDays}
        bookingPanelId={bookingPanelId}
        setBookingPanelId={setBookingPanelId}
        bookingDate={bookingDate}
        setBookingDate={setBookingDate}
        bookPanelMutation={bookPanelMutation}
        unbookPanelMutation={unbookPanelMutation}
        slotAdjustments={slotAdjustments}
      />
    </div>
  );
}
