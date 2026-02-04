import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, AlertTriangle, Check, RefreshCw, BookOpen, ListPlus, Eye, History, ChevronDown, ChevronRight, Briefcase, Building2, CalendarDays, Search, Layers, CalendarPlus, CalendarX, Factory as FactoryIcon, LayoutGrid, ChevronLeft } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO, differenceInDays, addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, getDay } from "date-fns";
import type { Job, ProductionSlot, ProductionSlotAdjustment, User, PanelRegister, GlobalSettings, Factory } from "@shared/schema";

interface ProductionSlotWithDetails extends ProductionSlot {
  job: Job;
}

interface ProductionSlotAdjustmentWithDetails extends ProductionSlotAdjustment {
  changedBy: User;
}

type StatusFilter = "ALL" | "SCHEDULED" | "PENDING_UPDATE" | "BOOKED" | "COMPLETED";
type GroupBy = "none" | "job" | "client" | "week" | "factory";

const getWeekBoundaries = (date: Date, weekStartDay: number) => {
  const weekStart = startOfWeek(date, { weekStartsOn: weekStartDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
  const weekEnd = endOfWeek(date, { weekStartsOn: weekStartDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
  return { weekStart, weekEnd };
};

const getWeekKey = (date: Date, weekStartDay: number) => {
  const { weekStart } = getWeekBoundaries(new Date(date), weekStartDay);
  return format(weekStart, "yyyy-MM-dd");
};

const getWeekLabel = (weekStartStr: string) => {
  const weekStart = parseISO(weekStartStr);
  const weekEnd = addDays(weekStart, 6);
  return `${format(weekStart, "dd MMM")} - ${format(weekEnd, "dd MMM yyyy")}`;
};

// Generate a color based on string (for job/level coloring)
const stringToColor = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = hash % 360;
  return `hsl(${h}, 70%, 45%)`;
};

interface CalendarViewProps {
  slots: ProductionSlotWithDetails[];
  factories: Factory[];
  getFactory: (factoryId: string | null | undefined) => Factory | undefined;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  calendarViewMode: "week" | "month";
  setCalendarViewMode: (mode: "week" | "month") => void;
  weekStartDay: number;
  onSlotClick: (slot: ProductionSlotWithDetails) => void;
}

function CalendarView({
  slots,
  factories,
  getFactory,
  currentDate,
  setCurrentDate,
  calendarViewMode,
  setCalendarViewMode,
  weekStartDay,
  onSlotClick,
}: CalendarViewProps) {
  // Memoize date range calculation
  const { start, end, days } = useMemo(() => {
    let start: Date, end: Date;
    if (calendarViewMode === "week") {
      start = startOfWeek(currentDate, { weekStartsOn: weekStartDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
      end = endOfWeek(currentDate, { weekStartsOn: weekStartDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
    } else {
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
    }
    return { start, end, days: eachDayOfInterval({ start, end }) };
  }, [currentDate, calendarViewMode, weekStartDay]);

  // Pre-group slots by date key for O(1) lookup instead of O(n) filtering per day
  const slotsByDate = useMemo(() => {
    const grouped: Record<string, ProductionSlotWithDetails[]> = {};
    for (const slot of slots) {
      const dateKey = format(new Date(slot.productionSlotDate), "yyyy-MM-dd");
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(slot);
    }
    return grouped;
  }, [slots]);

  // Memoize color cache to avoid recalculating on every render
  const colorCache = useMemo(() => {
    const cache: Record<string, string> = {};
    for (const slot of slots) {
      const jobKey = slot.job.jobNumber;
      const levelKey = `${slot.job.jobNumber}-${slot.level}`;
      if (!cache[jobKey]) cache[jobKey] = stringToColor(jobKey);
      if (!cache[levelKey]) cache[levelKey] = stringToColor(levelKey);
    }
    return cache;
  }, [slots]);

  // O(1) lookup for slots on a specific day
  const getSlotsForDay = useCallback((day: Date) => {
    const dateKey = format(day, "yyyy-MM-dd");
    return slotsByDate[dateKey] || [];
  }, [slotsByDate]);

  // Navigate to previous/next period
  const navigate = useCallback((direction: "prev" | "next") => {
    const amount = calendarViewMode === "week" ? 7 : 30;
    setCurrentDate(direction === "prev" ? subDays(currentDate, amount) : addDays(currentDate, amount));
  }, [calendarViewMode, currentDate, setCurrentDate]);

  // Get header label
  const headerLabel = useMemo(() => {
    if (calendarViewMode === "week") {
      return `${format(start, "dd MMM")} - ${format(end, "dd MMM yyyy")}`;
    }
    return format(currentDate, "MMMM yyyy");
  }, [calendarViewMode, start, end, currentDate]);

  // Day names for header - memoized
  const orderedDayNames = useMemo(() => {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return [...dayNames.slice(weekStartDay), ...dayNames.slice(0, weekStartDay)];
  }, [weekStartDay]);

  // Memoize today's date to avoid creating new Date objects in render
  const today = useMemo(() => new Date(), []);

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate("prev")} data-testid="button-calendar-prev">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate("next")} data-testid="button-calendar-next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-lg ml-2">{headerLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={calendarViewMode === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setCalendarViewMode("week")}
            data-testid="button-calendar-week"
          >
            Week
          </Button>
          <Button
            variant={calendarViewMode === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setCalendarViewMode("month")}
            data-testid="button-calendar-month"
          >
            Month
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} data-testid="button-calendar-today">
            Today
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      {calendarViewMode === "week" ? (
        <div className="grid grid-cols-7 gap-2">
          {/* Day headers */}
          {orderedDayNames.map((name, i) => (
            <div key={i} className="text-center text-sm font-medium text-muted-foreground py-2">
              {name}
            </div>
          ))}
          {/* Day cells */}
          {days.map((day) => {
            const daySlots = getSlotsForDay(day);
            const isToday = isSameDay(day, today);
            return (
              <div
                key={day.toISOString()}
                className={`min-h-32 p-2 border rounded-lg ${isToday ? "border-primary bg-primary/5" : "bg-muted/20"}`}
              >
                <div className={`text-sm font-medium mb-1 ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                  {format(day, "d")}
                </div>
                <div className="space-y-1 overflow-y-auto max-h-28">
                  {daySlots.map((slot) => {
                    const factory = getFactory(slot.job.factoryId);
                    const jobColor = colorCache[slot.job.jobNumber] || stringToColor(slot.job.jobNumber);
                    const levelColor = colorCache[`${slot.job.jobNumber}-${slot.level}`] || stringToColor(`${slot.job.jobNumber}-${slot.level}`);
                    return (
                      <div
                        key={slot.id}
                        onClick={() => onSlotClick(slot)}
                        className="p-1.5 rounded text-xs cursor-pointer hover-elevate"
                        style={{
                          backgroundColor: `${levelColor}20`,
                          borderLeft: `3px solid ${jobColor}`,
                        }}
                        title={`${slot.job.jobNumber} - ${slot.job.name} | Level ${slot.level} | ${slot.panelCount} panels`}
                        data-testid={`calendar-slot-${slot.id}`}
                      >
                        <div className="font-medium truncate" style={{ color: jobColor }}>
                          {slot.job.jobNumber}
                        </div>
                        <div className="text-muted-foreground truncate">
                          Lvl {slot.level}
                        </div>
                        {factory && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1 py-0 mt-0.5"
                            style={{
                              backgroundColor: factory.color ? `${factory.color}20` : undefined,
                              borderColor: factory.color || undefined,
                              color: factory.color || undefined,
                            }}
                          >
                            {factory.code}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          {/* Month view header */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {orderedDayNames.map((name, i) => (
              <div key={i} className="text-center text-sm font-medium text-muted-foreground py-2">
                {name}
              </div>
            ))}
          </div>
          {/* Month grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Padding for days before the start of month */}
            {Array.from({ length: (getDay(start) - weekStartDay + 7) % 7 }).map((_, i) => (
              <div key={`pad-${i}`} className="min-h-24 p-1 bg-muted/10 rounded" />
            ))}
            {/* Day cells */}
            {days.map((day) => {
              const daySlots = getSlotsForDay(day);
              const isToday = isSameDay(day, today);
              const isCurrentMonth = isSameMonth(day, currentDate);
              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-24 p-1 border rounded ${
                    isToday ? "border-primary bg-primary/5" : isCurrentMonth ? "bg-background" : "bg-muted/30"
                  }`}
                >
                  <div className={`text-xs font-medium mb-0.5 ${isToday ? "text-primary" : isCurrentMonth ? "" : "text-muted-foreground"}`}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5 overflow-y-auto max-h-20">
                    {daySlots.slice(0, 3).map((slot) => {
                      const jobColor = colorCache[slot.job.jobNumber] || stringToColor(slot.job.jobNumber);
                      return (
                        <div
                          key={slot.id}
                          onClick={() => onSlotClick(slot)}
                          className="p-0.5 rounded text-[10px] cursor-pointer hover-elevate truncate"
                          style={{
                            backgroundColor: `${jobColor}20`,
                            borderLeft: `2px solid ${jobColor}`,
                          }}
                          title={`${slot.job.jobNumber} - Level ${slot.level}`}
                          data-testid={`calendar-slot-${slot.id}`}
                        >
                          <span style={{ color: jobColor }}>{slot.job.jobNumber}</span>
                          <span className="text-muted-foreground ml-1">L{slot.level}</span>
                        </div>
                      );
                    })}
                    {daySlots.length > 3 && (
                      <div className="text-[10px] text-muted-foreground text-center">
                        +{daySlots.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
        <span>Colors represent job numbers and levels. Click on a slot to view panel details.</span>
      </div>
    </div>
  );
}

export default function ProductionSlotsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isManagerOrAdmin = user?.role === "MANAGER" || user?.role === "ADMIN";
  
  const { data: globalSettings } = useQuery<GlobalSettings>({
    queryKey: ["/api/admin/settings"],
  });
  
  const weekStartDay = globalSettings?.weekStartDay ?? 1;
  const productionWindowDays = globalSettings?.productionWindowDays ?? 10;
  
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [factoryFilter, setFactoryFilter] = useState<string>("all");
  const [dateFromFilter, setDateFromFilter] = useState<string>("");
  const [dateToFilter, setDateToFilter] = useState<string>("");
  const [groupBy, setGroupBy] = useState<GroupBy>("week");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // View mode: grid or calendar
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
  
  // Panel breakdown search/filter state
  const [panelSearchQuery, setPanelSearchQuery] = useState<string>("");
  const [panelStatusFilter, setPanelStatusFilter] = useState<string>("all");
  const [panelTypeFilter, setPanelTypeFilter] = useState<string>("all");
  const [expandedPanelTypes, setExpandedPanelTypes] = useState<Set<string>>(new Set());
  
  // Per-panel booking state
  const [bookingPanelId, setBookingPanelId] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState<string>("");
  
  // Level mismatch confirmation state
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
  
  // Drafting program update confirmation state
  const [showDraftingUpdateDialog, setShowDraftingUpdateDialog] = useState(false);
  const [showDraftingWarningDialog, setShowDraftingWarningDialog] = useState(false);

  const { data: slots = [], isLoading: loadingSlots } = useQuery<ProductionSlotWithDetails[]>({
    queryKey: ["/api/production-slots", { status: statusFilter !== "ALL" ? statusFilter : undefined, jobId: jobFilter !== "all" ? jobFilter : undefined, factoryId: factoryFilter !== "all" ? factoryFilter : undefined, dateFrom: dateFromFilter || undefined, dateTo: dateToFilter || undefined }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (jobFilter !== "all") params.append("jobId", jobFilter);
      if (factoryFilter !== "all") params.append("factoryId", factoryFilter);
      if (dateFromFilter) params.append("dateFrom", dateFromFilter);
      if (dateToFilter) params.append("dateTo", dateToFilter);
      const response = await fetch(`/api/production-slots?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch production slots");
      return response.json();
    },
  });

  const { data: jobsWithoutSlots = [], isLoading: loadingJobsWithoutSlots } = useQuery<Job[]>({
    queryKey: ["/api/production-slots/jobs-without-slots"],
  });

  const { data: allJobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    select: (data: any) => data.map((j: any) => ({ id: j.id, jobNumber: j.jobNumber, name: j.name, client: j.client, factoryId: j.factoryId })),
  });

  const { data: factories = [] } = useQuery<Factory[]>({
    queryKey: ["/api/admin/factories"],
  });

  const getFactory = (factoryId: string | null | undefined): Factory | undefined => {
    if (!factoryId || !factories) return undefined;
    return factories.find(f => f.id === factoryId);
  };

  const getFactoryName = (factoryId: string | null | undefined): string => {
    const factory = getFactory(factoryId);
    return factory?.name || "-";
  };

  const FactoryBadge = ({ factoryId }: { factoryId: string | null | undefined }) => {
    const factory = getFactory(factoryId);
    if (!factory) return <span>-</span>;
    return (
      <Badge
        variant="outline"
        style={{
          backgroundColor: factory.color ? `${factory.color}20` : undefined,
          borderColor: factory.color || undefined,
          color: factory.color || undefined,
        }}
      >
        {factory.code}
      </Badge>
    );
  };

  const { data: slotAdjustments = [] } = useQuery<ProductionSlotAdjustmentWithDetails[]>({
    queryKey: ["/api/production-slots", selectedSlot?.id, "adjustments"],
    queryFn: async () => {
      if (!selectedSlot) return [];
      const response = await fetch(`/api/production-slots/${selectedSlot.id}/adjustments`);
      if (!response.ok) throw new Error("Failed to fetch adjustments");
      return response.json();
    },
    enabled: !!selectedSlot && showHistoryDialog,
  });

  const { data: panelsForSlot = [] } = useQuery<PanelRegister[]>({
    queryKey: ["/api/panels", { jobId: selectedSlot?.jobId, level: selectedSlot?.level }],
    queryFn: async () => {
      if (!selectedSlot) return [];
      const response = await fetch(`/api/panels?jobId=${selectedSlot.jobId}&level=${encodeURIComponent(selectedSlot.level)}`);
      if (!response.ok) throw new Error("Failed to fetch panels");
      return response.json();
    },
    enabled: !!selectedSlot && showPanelBreakdownDialog,
  });
  
  // Fetch production entries for panels in this slot
  const { data: panelEntries = {} } = useQuery<Record<string, { productionDate: string; entryId: string }>>({
    queryKey: ["/api/production-slots", selectedSlot?.id, "panel-entries"],
    queryFn: async () => {
      if (!selectedSlot) return {};
      const response = await fetch(`/api/production-slots/${selectedSlot.id}/panel-entries`);
      if (!response.ok) throw new Error("Failed to fetch panel entries");
      return response.json();
    },
    enabled: !!selectedSlot && showPanelBreakdownDialog,
  });

  const generateSlotsMutation = useMutation({
    mutationFn: async ({ jobId, skipEmptyLevels }: { jobId: string; skipEmptyLevels?: boolean }) => {
      return apiRequest("POST", `/api/production-slots/generate/${jobId}`, { skipEmptyLevels });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-slots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/production-slots/jobs-without-slots"] });
      toast({ title: "Success", description: "Production slots generated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to generate slots", variant: "destructive" });
    },
  });

  const updateDraftingProgramMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/drafting-program/generate");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafting-program"] });
      toast({ title: "Success", description: "Drafting program updated successfully" });
      setShowDraftingUpdateDialog(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update drafting program", variant: "destructive" });
    },
  });

  const adjustSlotMutation = useMutation({
    mutationFn: async (data: { id: string; newDate: string; reason: string; clientConfirmed: boolean; cascadeToLater: boolean }) => {
      return apiRequest("POST", `/api/production-slots/${data.id}/adjust`, {
        newDate: data.newDate,
        reason: data.reason,
        clientConfirmed: data.clientConfirmed,
        cascadeToLater: data.cascadeToLater,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-slots"] });
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
      return apiRequest("POST", `/api/production-slots/${id}/book`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-slots"] });
      toast({ title: "Success", description: "Production slot booked successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to book slot", variant: "destructive" });
    },
  });

  const completeSlotMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/production-slots/${id}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-slots"] });
      toast({ title: "Success", description: "Production slot marked as completed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to complete slot", variant: "destructive" });
    },
  });

  const bookPanelMutation = useMutation({
    mutationFn: async ({ slotId, panelId, productionDate }: { slotId: string; panelId: string; productionDate: string }) => {
      return apiRequest("POST", `/api/production-slots/${slotId}/assign-panels`, { 
        panelAssignments: [{ panelId, productionDate }] 
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-slots", selectedSlot?.id, "panel-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/production-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/panels"] });
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
      return apiRequest("DELETE", `/api/production-entries/${entryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-slots", selectedSlot?.id, "panel-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/production-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/panels"] });
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
      // Check for level mismatch if not already confirmed
      if (!skipEmptyLevels && pendingJobsForGeneration.length === 0) {
        try {
          const response = await fetch(`/api/production-slots/check-levels/${jobId}`);
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
              return; // Stop and wait for user confirmation
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
    
    // Show drafting program update dialog after successful generation
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

  const groupedByPanelType = (panels: PanelRegister[]) => {
    const groups: Record<string, number> = {};
    for (const panel of panels) {
      const type = panel.panelType || "Unknown";
      groups[type] = (groups[type] || 0) + 1;
    }
    return groups;
  };
  
  // Get unique panel types and statuses for filter dropdowns
  const uniquePanelTypes = [...new Set(panelsForSlot.map(p => p.panelType || "Unknown"))].sort();
  const uniquePanelStatuses = [...new Set(panelsForSlot.map(p => p.status || "NOT_STARTED"))].sort();
  
  // Filter and group panels
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
  
  
  // Expand all panel type groups when dialog opens
  useEffect(() => {
    if (showPanelBreakdownDialog && panelsForSlot.length > 0) {
      const types = [...new Set(panelsForSlot.map(p => p.panelType || "Unknown"))];
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
    
    // Sort by week key if grouping by week
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

  // Expand all groups by default when grouping changes
  useEffect(() => {
    if (groupedSlots) {
      setExpandedGroups(new Set(Object.keys(groupedSlots)));
    }
  }, [groupBy, slots.length]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Production Slots</h1>
          <p className="text-muted-foreground">Manage and schedule panel production by level</p>
        </div>
        {isManagerOrAdmin && jobsWithoutSlots.length > 0 && (
          <Button onClick={() => setShowGenerateDialog(true)} data-testid="button-generate-slots">
            <ListPlus className="h-4 w-4 mr-2" />
            Generate Slots ({jobsWithoutSlots.length} jobs ready)
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  <SelectItem value="PENDING_UPDATE">Pending Update</SelectItem>
                  <SelectItem value="BOOKED">Booked</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Job</Label>
              <Select value={jobFilter} onValueChange={setJobFilter}>
                <SelectTrigger data-testid="select-job-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Jobs</SelectItem>
                  {allJobs.map((job: any) => (
                    <SelectItem key={job.id} value={job.id}>{job.jobNumber} - {job.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Factory</Label>
              <Select value={factoryFilter} onValueChange={setFactoryFilter}>
                <SelectTrigger data-testid="select-factory-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Factories</SelectItem>
                  {factories.filter(f => f.isActive).map((factory) => (
                    <SelectItem key={factory.id} value={factory.id}>{factory.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Group By</Label>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                <SelectTrigger data-testid="select-group-by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Group by Week</SelectItem>
                  <SelectItem value="job">Group by Job</SelectItem>
                  <SelectItem value="factory">Group by Factory</SelectItem>
                  <SelectItem value="client">Group by Client</SelectItem>
                  <SelectItem value="none">No Grouping</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date From</Label>
              <Input 
                type="date" 
                value={dateFromFilter} 
                onChange={(e) => setDateFromFilter(e.target.value)} 
                data-testid="input-date-from-filter"
              />
            </div>
            <div>
              <Label>Date To</Label>
              <Input 
                type="date" 
                value={dateToFilter} 
                onChange={(e) => setDateToFilter(e.target.value)} 
                data-testid="input-date-to-filter"
              />
            </div>
          </div>
        </CardContent>
      </Card>

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
            />
          ) : loadingSlots ? (
            <div className="text-center py-8">Loading...</div>
          ) : slots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No production slots found. {jobsWithoutSlots.length > 0 && "Click 'Generate Slots' to create slots for available jobs."}
            </div>
          ) : groupBy !== "none" && groupedSlots ? (
            <div className="space-y-2">
              {Object.entries(groupedSlots).map(([groupKey, { label, slots: groupSlots }]) => (
                <Collapsible 
                  key={groupKey} 
                  open={expandedGroups.has(groupKey)}
                  onOpenChange={() => toggleGroup(groupKey)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer hover-elevate" data-testid={`trigger-group-${groupKey}`}>
                      {expandedGroups.has(groupKey) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      {groupBy === "job" ? <Briefcase className="h-4 w-4" /> : groupBy === "week" ? <CalendarDays className="h-4 w-4" /> : groupBy === "factory" ? <FactoryIcon className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                      <span className="font-medium">{label}</span>
                      <Badge variant="secondary" className="ml-auto">{groupSlots.length} slot{groupSlots.length !== 1 ? "s" : ""}</Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-4 mt-2 border-l-2 pl-4">
                      {groupBy === "job" && (
                        <div className="mb-4 p-3 bg-muted/30 rounded-lg border" data-testid={`timeline-summary-${groupKey}`}>
                          <div className="text-sm font-medium mb-2 text-muted-foreground">Production Timeline vs Onsite Requirements</div>
                          <div className="grid grid-cols-5 gap-2">
                            {getTimelineDates().map(({ label, date, days }) => {
                              const nearestSlot = getSlotForDateRange(groupSlots, date);
                              const isUrgent = nearestSlot && isWithinOnsiteWindow(nearestSlot);
                              return (
                                <div 
                                  key={days} 
                                  className={`p-2 rounded text-center text-sm ${
                                    isUrgent 
                                      ? "bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-500" 
                                      : "bg-background border"
                                  }`}
                                >
                                  <div className="font-medium">{label}</div>
                                  <div className="text-xs text-muted-foreground">{format(date, "dd/MM")}</div>
                                  {nearestSlot ? (
                                    <div className={`mt-1 font-semibold ${isUrgent ? "text-amber-700 dark:text-amber-400" : ""}`}>
                                      Level {nearestSlot.level}
                                    </div>
                                  ) : (
                                    <div className="mt-1 text-muted-foreground">-</div>
                                  )}
                                  {nearestSlot && (
                                    <div className="text-xs text-muted-foreground">
                                      {nearestSlot.panelCount} panels
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {groupSlots.some(s => isWithinOnsiteWindow(s)) && (
                            <div className="mt-2 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-4 w-4" />
                              <span>Highlighted slots are within 10 days of onsite requirement</span>
                            </div>
                          )}
                        </div>
                      )}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Panel Production Due</TableHead>
                            <TableHead>Onsite Start Date</TableHead>
                            {groupBy !== "job" && <TableHead>Job</TableHead>}
                            {groupBy !== "factory" && <TableHead>Factory</TableHead>}
                            {groupBy !== "client" && <TableHead>Client</TableHead>}
                            <TableHead>Building</TableHead>
                            <TableHead>Level</TableHead>
                            <TableHead>Panels</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupSlots.map((slot) => {
                            const isUrgentSlot = isWithinOnsiteWindow(slot);
                            return (
                            <TableRow 
                              key={slot.id} 
                              data-testid={`row-slot-${slot.id}`}
                              className={isUrgentSlot ? "ring-2 ring-amber-500 ring-inset" : ""}
                              style={slot.job.productionSlotColor ? { 
                                backgroundColor: isUrgentSlot ? undefined : `${slot.job.productionSlotColor}15`,
                                borderLeft: `4px solid ${slot.job.productionSlotColor}` 
                              } : undefined}
                            >
                              <TableCell className={isUrgentSlot ? "bg-amber-100 dark:bg-amber-900/30" : getDateColorClass(slot)}>
                                {format(new Date(slot.productionSlotDate), "dd/MM/yyyy")}
                                {differenceInDays(new Date(slot.productionSlotDate), new Date()) < 0 && slot.status !== "COMPLETED" && (
                                  <AlertTriangle className="h-4 w-4 inline ml-1 text-red-600" />
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {format(addDays(new Date(slot.productionSlotDate), slot.job.productionDaysInAdvance ?? 10), "dd/MM/yyyy")}
                              </TableCell>
                              {groupBy !== "job" && <TableCell>{slot.job.jobNumber}</TableCell>}
                              {groupBy !== "factory" && <TableCell><FactoryBadge factoryId={slot.job.factoryId} /></TableCell>}
                              {groupBy !== "client" && <TableCell>{slot.job.client || "-"}</TableCell>}
                              <TableCell>{slot.buildingNumber}</TableCell>
                              <TableCell>{slot.level}</TableCell>
                              <TableCell>
                                <Button 
                                  variant="ghost" 
                                  className="p-0 h-auto text-blue-600 underline hover:text-blue-800" 
                                  onClick={() => openPanelBreakdown(slot)}
                                  data-testid={`button-panel-count-${slot.id}`}
                                >
                                  {slot.panelCount} panels
                                </Button>
                              </TableCell>
                              <TableCell>{getSlotStatusBadge(slot.status)}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {isManagerOrAdmin && slot.status !== "COMPLETED" && (
                                    <>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => openAdjustDialog(slot)}
                                        data-testid={`button-adjust-${slot.id}`}
                                      >
                                        <Calendar className="h-4 w-4" />
                                      </Button>
                                      {slot.status !== "BOOKED" && (
                                        <Button 
                                          size="sm" 
                                          variant="default"
                                          onClick={() => bookSlotMutation.mutate(slot.id)}
                                          disabled={bookSlotMutation.isPending}
                                          data-testid={`button-book-${slot.id}`}
                                        >
                                          <BookOpen className="h-4 w-4" />
                                        </Button>
                                      )}
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => completeSlotMutation.mutate(slot.id)}
                                        disabled={completeSlotMutation.isPending}
                                        data-testid={`button-complete-${slot.id}`}
                                      >
                                        <Check className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => openHistory(slot)}
                                    data-testid={`button-history-${slot.id}`}
                                  >
                                    <History className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Panel Production Due</TableHead>
                  <TableHead>Onsite Start Date</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Factory</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Building</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Panels</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slots.map((slot) => (
                  <TableRow 
                    key={slot.id} 
                    data-testid={`row-slot-${slot.id}`}
                    style={slot.job.productionSlotColor ? { 
                      backgroundColor: `${slot.job.productionSlotColor}15`,
                      borderLeft: `4px solid ${slot.job.productionSlotColor}` 
                    } : undefined}
                  >
                    <TableCell className={getDateColorClass(slot)}>
                      {format(new Date(slot.productionSlotDate), "dd/MM/yyyy")}
                      {differenceInDays(new Date(slot.productionSlotDate), new Date()) < 0 && slot.status !== "COMPLETED" && (
                        <AlertTriangle className="h-4 w-4 inline ml-1 text-red-600" />
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(addDays(new Date(slot.productionSlotDate), slot.job.productionDaysInAdvance ?? 10), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>{slot.job.jobNumber}</TableCell>
                    <TableCell><FactoryBadge factoryId={slot.job.factoryId} /></TableCell>
                    <TableCell>{slot.job.client || "-"}</TableCell>
                    <TableCell>{slot.buildingNumber}</TableCell>
                    <TableCell>{slot.level}</TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        className="p-0 h-auto text-blue-600 underline hover:text-blue-800" 
                        onClick={() => openPanelBreakdown(slot)}
                        data-testid={`button-panel-count-${slot.id}`}
                      >
                        {slot.panelCount} panels
                      </Button>
                    </TableCell>
                    <TableCell>{getSlotStatusBadge(slot.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {isManagerOrAdmin && slot.status !== "COMPLETED" && (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => openAdjustDialog(slot)}
                              data-testid={`button-adjust-${slot.id}`}
                            >
                              <Calendar className="h-4 w-4" />
                            </Button>
                            {slot.status !== "BOOKED" && (
                              <Button 
                                size="sm" 
                                variant="default"
                                onClick={() => bookSlotMutation.mutate(slot.id)}
                                disabled={bookSlotMutation.isPending}
                                data-testid={`button-book-${slot.id}`}
                              >
                                <BookOpen className="h-4 w-4" />
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => completeSlotMutation.mutate(slot.id)}
                              disabled={completeSlotMutation.isPending}
                              data-testid={`button-complete-${slot.id}`}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => openHistory(slot)}
                          data-testid={`button-history-${slot.id}`}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Production Slots</DialogTitle>
            <DialogDescription>Select jobs to generate production slots for</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-80 overflow-y-auto">
            {jobsWithoutSlots.map((job) => (
              <div key={job.id} className="flex items-center space-x-2">
                <Checkbox 
                  id={`job-${job.id}`}
                  checked={selectedJobsForGeneration.includes(job.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedJobsForGeneration([...selectedJobsForGeneration, job.id]);
                    } else {
                      setSelectedJobsForGeneration(selectedJobsForGeneration.filter(id => id !== job.id));
                    }
                  }}
                />
                <Label htmlFor={`job-${job.id}`} className="flex-1 cursor-pointer">
                  {job.jobNumber} - {job.name}
                  <span className="text-muted-foreground text-sm block">
                    {job.client} | Start: {job.productionStartDate ? format(new Date(job.productionStartDate), "dd/MM/yyyy") : "-"}
                  </span>
                </Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>Cancel</Button>
            <Button 
              onClick={() => handleGenerateSlots()} 
              disabled={selectedJobsForGeneration.length === 0 || generateSlotsMutation.isPending}
              data-testid="button-confirm-generate"
            >
              Generate for {selectedJobsForGeneration.length} Job(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLevelMismatchDialog} onOpenChange={(open) => { 
        if (!open) { 
          setPendingJobsForGeneration([]); 
          setLevelMismatchInfo(null); 
        }
        setShowLevelMismatchDialog(open); 
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Panel Level Mismatch Detected
            </DialogTitle>
            <DialogDescription>
              The job has more levels configured than panels registered
            </DialogDescription>
          </DialogHeader>
          {levelMismatchInfo && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="font-medium">{levelMismatchInfo.jobName}</p>
                <p className="text-sm">
                  The job contains <span className="font-semibold text-primary">{levelMismatchInfo.jobLevels} levels</span> (up to Level {levelMismatchInfo.highestJobLevel}) 
                  but you have only added panels to <span className="font-semibold text-primary">{levelMismatchInfo.panelLevels} levels</span> (up to Level {levelMismatchInfo.highestPanelLevel}).
                </p>
                <p className="text-sm text-muted-foreground">
                  Empty levels: {levelMismatchInfo.emptyLevels.join(", ")}
                </p>
              </div>
              <p className="text-sm">
                Do you wish to create production slots for only the panel levels (skip empty levels)?
              </p>
            </div>
          )}
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowLevelMismatchDialog(false);
                setPendingJobsForGeneration([]);
                setLevelMismatchInfo(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="secondary"
              onClick={() => handleLevelMismatchConfirm(false)}
              disabled={generateSlotsMutation.isPending}
            >
              Create All Slots
            </Button>
            <Button 
              onClick={() => handleLevelMismatchConfirm(true)}
              disabled={generateSlotsMutation.isPending}
            >
              Skip Empty Levels
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDraftingUpdateDialog} onOpenChange={setShowDraftingUpdateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Update Drafting Program
            </DialogTitle>
            <DialogDescription>
              Production slots have been created/updated
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              Would you like to update the drafting program to reflect the new production schedule?
            </p>
            <p className="text-sm text-muted-foreground">
              This will update all panels with "Not Scheduled" status to match the new production dates.
            </p>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => handleDraftingUpdateConfirm(false)}
            >
              No, Skip Update
            </Button>
            <Button 
              onClick={() => handleDraftingUpdateConfirm(true)}
              disabled={updateDraftingProgramMutation.isPending}
            >
              {updateDraftingProgramMutation.isPending ? "Updating..." : "Yes, Update Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDraftingWarningDialog} onOpenChange={setShowDraftingWarningDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Drafting Program Out of Date
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              The drafting program will not be updated and may show outdated information.
            </p>
            <p className="text-sm font-medium">
              Are you sure you don't want to update the drafting program?
            </p>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => handleDraftingWarningConfirm(false)}
            >
              Yes, Leave Outdated
            </Button>
            <Button 
              onClick={() => handleDraftingWarningConfirm(true)}
              disabled={updateDraftingProgramMutation.isPending}
            >
              {updateDraftingProgramMutation.isPending ? "Updating..." : "Update Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAdjustDialog} onOpenChange={(open) => { if (!open) resetAdjustForm(); setShowAdjustDialog(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Production Slot</DialogTitle>
            <DialogDescription>
              {selectedSlot && `${selectedSlot.job.jobNumber} - ${selectedSlot.level}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>New Production Due Date</Label>
              <Input 
                type="date" 
                value={adjustNewDate} 
                onChange={(e) => setAdjustNewDate(e.target.value)}
                data-testid="input-adjust-new-date"
              />
            </div>
            <div>
              <Label>Reason for Adjustment</Label>
              <Textarea 
                value={adjustReason} 
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Enter the reason for this date adjustment..."
                data-testid="input-adjust-reason"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="clientConfirmed"
                checked={adjustClientConfirmed}
                onCheckedChange={(checked) => setAdjustClientConfirmed(checked === true)}
              />
              <Label htmlFor="clientConfirmed">Client Confirmed</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="cascadeToLater"
                checked={adjustCascade}
                onCheckedChange={(checked) => setAdjustCascade(checked === true)}
              />
              <Label htmlFor="cascadeToLater">Cascade adjustment to later levels</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetAdjustForm(); setShowAdjustDialog(false); }}>Cancel</Button>
            <Button 
              onClick={handleAdjustSubmit} 
              disabled={adjustSlotMutation.isPending}
              data-testid="button-confirm-adjust"
            >
              Adjust Slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPanelBreakdownDialog} onOpenChange={(open) => {
        setShowPanelBreakdownDialog(open);
        if (!open) {
          setPanelSearchQuery("");
          setPanelStatusFilter("all");
          setPanelTypeFilter("all");
          setBookingPanelId(null);
          setBookingDate("");
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Panel Breakdown & Assignment</DialogTitle>
            <DialogDescription>
              {selectedSlot && (
                <span>
                  {selectedSlot.job.jobNumber} - Level {selectedSlot.level} ({selectedSlot.panelCount} panels)
                  <br />
                  <span className="text-xs">
                    Panel Production Due: {format(new Date(selectedSlot.productionSlotDate), "dd/MM/yyyy")}
                    {" → "}
                    Onsite Start: {format(addDays(new Date(selectedSlot.productionSlotDate), selectedSlot.job.productionDaysInAdvance ?? 10), "dd/MM/yyyy")}
                  </span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {/* Search and Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by panel mark or type..."
                value={panelSearchQuery}
                onChange={(e) => setPanelSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-panel-search"
              />
            </div>
            <div>
              <Select value={panelTypeFilter} onValueChange={setPanelTypeFilter}>
                <SelectTrigger data-testid="select-panel-type-filter">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniquePanelTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={panelStatusFilter} onValueChange={setPanelStatusFilter}>
                <SelectTrigger data-testid="select-panel-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {uniquePanelStatuses.map(status => (
                    <SelectItem key={status} value={status}>{status.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          
          <div className="max-h-[50vh] overflow-y-auto">
            {panelsForSlot.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No panels found for this level</p>
            ) : filteredPanels.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No panels match your search criteria</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(panelsByType).sort(([a], [b]) => a.localeCompare(b)).map(([type, panels]) => (
                  <Collapsible 
                    key={type}
                    open={expandedPanelTypes.has(type)}
                    onOpenChange={() => togglePanelTypeGroup(type)}
                  >
                    <CollapsibleTrigger asChild>
                      <div 
                        className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer hover-elevate"
                        data-testid={`trigger-panel-type-${type}`}
                      >
                        {expandedPanelTypes.has(type) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <Layers className="h-4 w-4" />
                        <span className="font-medium">{type}</span>
                        <Badge variant="secondary" className="ml-auto">
                          {panels.length} panel{panels.length !== 1 ? "s" : ""}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {panels.filter(p => panelEntries[p.id]).length} booked
                        </Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-4 mt-1 border-l-2 pl-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Panel Mark</TableHead>
                              <TableHead>Production Date</TableHead>
                              <TableHead>Load Width</TableHead>
                              <TableHead>Load Height</TableHead>
                              <TableHead>Thickness</TableHead>
                              <TableHead>Status</TableHead>
                              {selectedSlot?.status === "BOOKED" && isManagerOrAdmin && (
                                <TableHead className="w-20 text-center">Action</TableHead>
                              )}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {panels.map((panel) => {
                              const entry = panelEntries[panel.id];
                              const isBooked = !!entry;
                              return (
                                <TableRow key={panel.id} data-testid={`row-panel-${panel.id}`}>
                                  <TableCell className="font-medium">{panel.panelMark || "-"}</TableCell>
                                  <TableCell>
                                    {isBooked ? (
                                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                        {format(new Date(entry.productionDate), "dd/MM/yyyy")}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>{panel.loadWidth || "-"}</TableCell>
                                  <TableCell>{panel.loadHeight || "-"}</TableCell>
                                  <TableCell>{panel.panelThickness || "-"}</TableCell>
                                  <TableCell>
                                    <Badge variant={isBooked ? "default" : "secondary"} className={isBooked ? "bg-blue-600" : ""}>
                                      {isBooked ? "BOOKED" : (panel.status || "NOT_STARTED")}
                                    </Badge>
                                  </TableCell>
                                  {selectedSlot?.status === "BOOKED" && isManagerOrAdmin && (
                                    <TableCell className="text-center">
                                      {isBooked ? (
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => unbookPanelMutation.mutate(entry.entryId)}
                                          disabled={unbookPanelMutation.isPending}
                                          title="Remove from production"
                                          data-testid={`button-unbook-${panel.id}`}
                                        >
                                          <CalendarX className="h-4 w-4 text-red-500" />
                                        </Button>
                                      ) : (
                                        <Popover open={bookingPanelId === panel.id} onOpenChange={(open) => {
                                          if (open) {
                                            setBookingPanelId(panel.id);
                                            setBookingDate("");
                                          } else {
                                            setBookingPanelId(null);
                                            setBookingDate("");
                                          }
                                        }}>
                                          <PopoverTrigger asChild>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              title="Book for production"
                                              data-testid={`button-book-${panel.id}`}
                                            >
                                              <CalendarPlus className="h-4 w-4 text-green-600" />
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-auto p-3" align="end">
                                            <div className="space-y-2">
                                              <Label className="text-sm font-medium">Select Production Date</Label>
                                              <Input
                                                type="date"
                                                value={bookingDate}
                                                onChange={(e) => setBookingDate(e.target.value)}
                                                min={format(subDays(new Date(selectedSlot.productionSlotDate), productionWindowDays), "yyyy-MM-dd")}
                                                max={format(new Date(selectedSlot.productionSlotDate), "yyyy-MM-dd")}
                                                data-testid={`input-booking-date-${panel.id}`}
                                              />
                                              <p className="text-xs text-muted-foreground">
                                                {format(subDays(new Date(selectedSlot.productionSlotDate), productionWindowDays), "dd/MM")} - {format(new Date(selectedSlot.productionSlotDate), "dd/MM/yyyy")}
                                              </p>
                                              <Button
                                                size="sm"
                                                className="w-full"
                                                onClick={() => {
                                                  if (bookingDate) {
                                                    bookPanelMutation.mutate({
                                                      slotId: selectedSlot.id,
                                                      panelId: panel.id,
                                                      productionDate: bookingDate,
                                                    });
                                                  }
                                                }}
                                                disabled={!bookingDate || bookPanelMutation.isPending}
                                                data-testid={`button-confirm-book-${panel.id}`}
                                              >
                                                {bookPanelMutation.isPending ? "Booking..." : "Book Panel"}
                                              </Button>
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      )}
                                    </TableCell>
                                  )}
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="flex justify-between items-center gap-2">
            <div className="text-sm text-muted-foreground">
              Total: {panelsForSlot.length} panels | Showing: {filteredPanels.length} | Booked: {Object.keys(panelEntries).length}
            </div>
            <Button variant="outline" onClick={() => setShowPanelBreakdownDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adjustment History</DialogTitle>
            <DialogDescription>
              {selectedSlot && `${selectedSlot.job.jobNumber} - ${selectedSlot.level}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-80 overflow-y-auto">
            {slotAdjustments.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No adjustments recorded</p>
            ) : (
              slotAdjustments.map((adj) => (
                <div key={adj.id} className="border rounded-md p-3 space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="font-medium">
                      {format(new Date(adj.previousDate), "dd/MM/yyyy")} → {format(new Date(adj.newDate), "dd/MM/yyyy")}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {format(new Date(adj.createdAt), "dd/MM/yyyy HH:mm")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{adj.reason}</p>
                  <div className="text-xs text-muted-foreground">
                    By: {adj.changedBy.email}
                    {adj.clientConfirmed && " | Client Confirmed"}
                    {adj.cascadedToOtherSlots && " | Cascaded"}
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
