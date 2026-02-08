import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { format, subDays, startOfWeek, endOfWeek } from "date-fns";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  Calendar,
  ChevronRight,
  ChevronDown,
  Clock,
  Filter,
  Search,
  AlertTriangle,
  FolderOpen,
  Plus,
  FileDown,
  Loader2,
  Trash2,
  Factory,
  User,
  MapPin,
  Layers,
  Play,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { DAILY_LOGS_ROUTES, DRAFTING_ROUTES, SETTINGS_ROUTES, TIMER_ROUTES, USER_ROUTES, ADMIN_ROUTES } from "@shared/api-routes";
import { PageHelpButton } from "@/components/help/page-help-button";

type GroupBy = "none" | "user" | "date";

interface UserWorkHours {
  mondayStartTime?: string;
  mondayHours?: string;
  tuesdayStartTime?: string;
  tuesdayHours?: string;
  wednesdayStartTime?: string;
  wednesdayHours?: string;
  thursdayStartTime?: string;
  thursdayHours?: string;
  fridayStartTime?: string;
  fridayHours?: string;
  saturdayStartTime?: string;
  saturdayHours?: string;
  sundayStartTime?: string;
  sundayHours?: string;
}

interface DailyLogSummary {
  id: string;
  logDay: string;
  factory: string;
  status: string;
  totalMinutes: number;
  idleMinutes: number;
  missingPanelMarkMinutes: number;
  missingProjectMinutes: number;
  rowCount: number;
  userName?: string;
  userEmail?: string;
  userId?: string;
  lastEntryEndTime?: string | null;
  userWorkHours?: UserWorkHours;
}

const getDayOfWeekKey = (dateString: string): keyof UserWorkHours => {
  const date = new Date(dateString + "T00:00:00");
  const dayOfWeek = date.getDay();
  const dayKeys: (keyof UserWorkHours)[] = [
    "sundayHours", "mondayHours", "tuesdayHours", "wednesdayHours",
    "thursdayHours", "fridayHours", "saturdayHours"
  ];
  return dayKeys[dayOfWeek];
};

const getExpectedHoursForDay = (log: DailyLogSummary): number => {
  if (!log.userWorkHours) return 8;
  const dayKey = getDayOfWeekKey(log.logDay);
  const hours = log.userWorkHours[dayKey];
  return hours ? parseFloat(hours) : 8;
};

const getRemainingHours = (log: DailyLogSummary): number => {
  const expectedHours = getExpectedHoursForDay(log);
  const loggedHours = log.totalMinutes / 60;
  return Math.max(0, expectedHours - loggedHours);
};

export default function DailyReportsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("week");
  const [factoryFilter, setFactoryFilter] = useState<string>("all");
  const [factoryFilterInitialized, setFactoryFilterInitialized] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isNewDayDialogOpen, setIsNewDayDialogOpen] = useState(false);
  const [newDayDate, setNewDayDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newDayFactory, setNewDayFactory] = useState("QLD");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: userSettings } = useQuery<{ selectedFactoryIds: string[]; defaultFactoryId: string | null }>({
    queryKey: [USER_ROUTES.SETTINGS],
  });

  const { data: factoriesList } = useQuery<{ id: string; name: string; code: string; state: string }[]>({
    queryKey: [ADMIN_ROUTES.FACTORIES],
  });

  useEffect(() => {
    if (!factoryFilterInitialized && userSettings && factoriesList) {
      if (userSettings.defaultFactoryId) {
        const defaultFactory = factoriesList.find(f => f.id === userSettings.defaultFactoryId);
        if (defaultFactory) {
          setFactoryFilter(defaultFactory.state || defaultFactory.code);
        }
      }
      setFactoryFilterInitialized(true);
    }
  }, [userSettings, factoriesList, factoryFilterInitialized]);

  const { data: logs, isLoading } = useQuery<DailyLogSummary[]>({
    queryKey: [DAILY_LOGS_ROUTES.LIST, { status: statusFilter, dateRange }],
  });

  const { data: allocatedData } = useQuery<{
    programs: any[];
    stats: {
      total: number;
      completed: number;
      inProgress: number;
      scheduled: number;
      notScheduled: number;
      onHold: number;
      totalActualHours: number;
      totalEstimatedHours: number;
    };
  }>({
    queryKey: [DRAFTING_ROUTES.MY_ALLOCATED],
  });

  const [showAllocatedPanels, setShowAllocatedPanels] = useState(true);
  const [showDraftingRegister, setShowDraftingRegister] = useState(true);
  const [allocatedPanelTab, setAllocatedPanelTab] = useState<"pending" | "ifc">("pending");
  const [allocatedSearch, setAllocatedSearch] = useState("");
  const [allocatedStatusFilter, setAllocatedStatusFilter] = useState<string>("all");
  const [collapsedPanelTypes, setCollapsedPanelTypes] = useState<Set<string>>(new Set());

  const togglePanelTypeGroup = (panelType: string) => {
    setCollapsedPanelTypes(prev => {
      const next = new Set(prev);
      if (next.has(panelType)) {
        next.delete(panelType);
      } else {
        next.add(panelType);
      }
      return next;
    });
  };

  const { data: brandingSettings } = useQuery<{ logoBase64: string | null; companyName: string }>({
    queryKey: [SETTINGS_ROUTES.LOGO],
  });
  const reportLogo = brandingSettings?.logoBase64 || null;
  const companyName = brandingSettings?.companyName || "BuildPlusAI";

  const getNextAvailableDate = () => {
    if (!logs || logs.length === 0) {
      return format(new Date(), "yyyy-MM-dd");
    }
    const sortedDates = logs
      .map(log => new Date(log.logDay + "T00:00:00"))
      .sort((a, b) => b.getTime() - a.getTime());
    const latestDate = sortedDates[0];
    const nextDate = new Date(latestDate);
    nextDate.setDate(nextDate.getDate() + 1);
    return format(nextDate, "yyyy-MM-dd");
  };

  const createDailyLogMutation = useMutation({
    mutationFn: async (data: { logDay: string; factory: string }) => {
      return await apiRequest("POST", DAILY_LOGS_ROUTES.LIST, data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [DAILY_LOGS_ROUTES.LIST] });
      setIsNewDayDialogOpen(false);
      toast({
        title: "Daily log created",
        description: `Created log for ${format(new Date(newDayDate + "T00:00:00"), "dd/MM/yyyy")} - ${newDayFactory}`,
      });
      if (data?.id) {
        setLocation(`/daily-report/${data.id}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create daily log",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const deleteDailyLogMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", DAILY_LOGS_ROUTES.BY_ID(id), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DAILY_LOGS_ROUTES.LIST] });
      setDeleteDialogOpen(false);
      setDeletingLogId(null);
      toast({ title: "Daily log deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete daily log", variant: "destructive" });
    },
  });

  const startTimerMutation = useMutation({
    mutationFn: async (data: { jobId: string; panelRegisterId: string }) => {
      return await apiRequest("POST", TIMER_ROUTES.START, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TIMER_ROUTES.ACTIVE] });
      toast({ 
        title: "Timer started",
        description: "Panel drafting timer is now running"
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to start timer", 
        description: error.message || "You may already have an active timer",
        variant: "destructive" 
      });
    },
  });

  const filteredLogs = logs?.filter((log) => {
    // Filter by factory
    if (factoryFilter !== "all" && log.factory !== factoryFilter) {
      return false;
    }
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.logDay.includes(query) ||
        log.userName?.toLowerCase().includes(query) ||
        log.userEmail?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      PENDING: { variant: "secondary", label: "Pending" },
      SUBMITTED: { variant: "default", label: "Submitted" },
      APPROVED: { variant: "outline", label: "Approved" },
      REJECTED: { variant: "destructive", label: "Rejected" },
    };
    const config = variants[status] || variants.PENDING;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

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

  const groupedLogs = (() => {
    if (groupBy === "none" || !filteredLogs) return null;
    
    const groups: Record<string, { label: string; logs: DailyLogSummary[] }> = {};
    
    for (const log of filteredLogs) {
      let key: string;
      let label: string;
      
      if (groupBy === "user") {
        key = log.userId || log.userEmail || "unknown";
        label = log.userName || log.userEmail || "Unknown User";
      } else {
        key = log.logDay;
        label = format(new Date(log.logDay), "dd/MM/yyyy");
      }
      
      if (!groups[key]) {
        groups[key] = { label, logs: [] };
      }
      groups[key].logs.push(log);
    }
    
    return groups;
  })();

  // Expand all groups by default when grouping changes
  useEffect(() => {
    if (groupedLogs) {
      setExpandedGroups(new Set(Object.keys(groupedLogs)));
    }
  }, [groupBy, filteredLogs?.length]);

  const formatEndTime = (endTime: string | null | undefined) => {
    if (!endTime) return "-";
    try {
      return format(new Date(endTime), "HH:mm");
    } catch {
      return "-";
    }
  };

  const getPeriodLabel = () => {
    switch (dateRange) {
      case "today": return "Today";
      case "week": return "This Week";
      case "month": return "This Month";
      case "all": return "All Time";
      default: return dateRange;
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
        orientation: "portrait",
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
        if (reportLogo) pdf.addImage(reportLogo, "PNG", margin, 6, logoWidth, logoHeight);
      } catch (e) {}
      
      // Report title
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Drafting Register", margin + logoWidth + 6, 12);
      
      // Subtitle info
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(getPeriodLabel(), margin + logoWidth + 6, 19);
      
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
      
      pdf.save(`LTE-Drafting-Register-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  // Check if there's a timesheet for today
  const today = format(new Date(), "yyyy-MM-dd");
  const hasTodayTimesheet = logs?.some(log => log.logDay === today);

  return (
    <div className="space-y-6">
      {/* Warning banner if no timesheet for today */}
      {!isLoading && !hasTodayTimesheet && (
        <div className="bg-red-100 dark:bg-red-950 border border-red-300 dark:border-red-800 rounded-lg p-4 flex items-center gap-3" data-testid="alert-no-timesheet">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-800 dark:text-red-200">No drafting timesheet started for today</p>
            <p className="text-sm text-red-600 dark:text-red-400">Remember to log your drafting time for {format(new Date(), "dd/MM/yyyy")}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-daily-reports-title">
            Drafting Register
          </h1>
            <PageHelpButton pageHelpKey="page.daily-reports" />
          </div>
          <p className="text-muted-foreground">
            Review and manage your drafting time entries
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline"
            onClick={exportToPDF} 
            disabled={isExporting || isLoading}
            data-testid="button-export-pdf"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            Export PDF
          </Button>
          <Dialog open={isNewDayDialogOpen} onOpenChange={(open) => {
              setIsNewDayDialogOpen(open);
              if (open) {
                setNewDayDate(getNextAvailableDate());
              }
            }}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-start-new-day">
                <Plus className="h-4 w-4 mr-2" />
                Start New Day
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start New Daily Log</DialogTitle>
                <DialogDescription>
                  Create a new daily log for a specific date. You can add time entries afterwards.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="logDay">Date</Label>
                    <Input
                      id="logDay"
                      type="date"
                      value={newDayDate}
                      onChange={(e) => setNewDayDate(e.target.value)}
                      data-testid="input-new-day-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Factory</Label>
                    <Select value={newDayFactory} onValueChange={setNewDayFactory}>
                      <SelectTrigger data-testid="select-new-day-factory">
                        <SelectValue placeholder="Select factory" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="QLD">QLD</SelectItem>
                        <SelectItem value="VIC">Victoria</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsNewDayDialogOpen(false)}
                  data-testid="button-cancel-new-day"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    createDailyLogMutation.mutate({
                      logDay: newDayDate,
                      factory: newDayFactory,
                    })
                  }
                  disabled={createDailyLogMutation.isPending}
                  data-testid="button-create-new-day"
                >
                  {createDailyLogMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {allocatedData && (
        <>
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4" />
                My Drafting Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const ifcCount = allocatedData.programs.filter(p => 
                  p.panel?.documentStatus === "IFC" || p.panel?.documentStatus === "APPROVED"
                ).length;
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Panels Allocated</div>
                      <div className="text-2xl font-bold" data-testid="text-total-allocated">{allocatedData.stats.total}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">IFC</div>
                      <div className="text-2xl font-bold text-green-600" data-testid="text-ifc-count">{ifcCount}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">In Progress</div>
                      <div className="text-2xl font-bold text-amber-500" data-testid="text-in-progress-count">{allocatedData.stats.inProgress}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Hours Spent</div>
                      <div className="text-2xl font-bold" data-testid="text-hours-spent">{allocatedData.stats.totalActualHours.toFixed(1)}h</div>
                      {allocatedData.stats.totalEstimatedHours > 0 && (
                        <div className="text-xs text-muted-foreground">of {allocatedData.stats.totalEstimatedHours.toFixed(1)}h estimated</div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {allocatedData.stats.total > 0 && (() => {
            const pendingPanels = allocatedData.programs.filter(p => 
              p.status !== "COMPLETED" && 
              p.panel?.documentStatus !== "IFC" && 
              p.panel?.documentStatus !== "APPROVED"
            );
            const ifcPanels = allocatedData.programs.filter(p => 
              p.status !== "COMPLETED" && 
              (p.panel?.documentStatus === "IFC" || p.panel?.documentStatus === "APPROVED")
            );
            const basePanels = allocatedPanelTab === "pending" ? pendingPanels : ifcPanels;
            const currentPanels = basePanels.filter(p => {
              // Apply search filter
              const searchLower = allocatedSearch.toLowerCase();
              const matchesSearch = !allocatedSearch || 
                p.panel?.panelMark?.toLowerCase().includes(searchLower) ||
                p.job?.jobNumber?.toLowerCase().includes(searchLower) ||
                p.level?.toLowerCase().includes(searchLower);
              
              // Apply status filter
              const matchesStatus = allocatedStatusFilter === "all" || p.status === allocatedStatusFilter;
              
              return matchesSearch && matchesStatus;
            });
            
            return (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  My Allocated Panels
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowAllocatedPanels(!showAllocatedPanels)}
                  data-testid="button-toggle-allocated"
                >
                  {showAllocatedPanels ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  {showAllocatedPanels ? "Hide" : "Show"}
                </Button>
              </div>
              {showAllocatedPanels && (
                <div className="space-y-3 mt-3">
                  <div className="flex gap-2">
                    <Button
                      variant={allocatedPanelTab === "pending" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAllocatedPanelTab("pending")}
                      data-testid="button-tab-pending"
                    >
                      Pending ({pendingPanels.length})
                    </Button>
                    <Button
                      variant={allocatedPanelTab === "ifc" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAllocatedPanelTab("ifc")}
                      data-testid="button-tab-ifc"
                    >
                      IFC ({ifcPanels.length})
                    </Button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search panel or job..."
                        value={allocatedSearch}
                        onChange={(e) => setAllocatedSearch(e.target.value)}
                        className="pl-8 h-8"
                        data-testid="input-allocated-search"
                      />
                    </div>
                    <Select value={allocatedStatusFilter} onValueChange={setAllocatedStatusFilter}>
                      <SelectTrigger className="w-[140px] h-8" data-testid="select-allocated-status">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                        <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                        <SelectItem value="ON_HOLD">On Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardHeader>
            {showAllocatedPanels && (
              <CardContent className="pt-0 space-y-3">
                {(() => {
                  // Group panels by panel type
                  const groupedByType = currentPanels.reduce((acc, program) => {
                    const panelType = program.panel?.panelType || "Unknown";
                    if (!acc[panelType]) acc[panelType] = [];
                    acc[panelType].push(program);
                    return acc;
                  }, {} as Record<string, typeof currentPanels>);
                  
                  const sortedTypes = Object.keys(groupedByType).sort();
                  
                  if (currentPanels.length === 0) {
                    return (
                      <div className="text-center text-muted-foreground py-4">
                        {allocatedPanelTab === "pending" 
                          ? "No pending panels in this category" 
                          : "No IFC panels in this category"}
                      </div>
                    );
                  }
                  
                  return sortedTypes.map(panelType => {
                    const panelsInGroup = groupedByType[panelType].sort((a: any, b: any) => {
                      const dateA = a.drawingDueDate ? new Date(a.drawingDueDate).getTime() : Infinity;
                      const dateB = b.drawingDueDate ? new Date(b.drawingDueDate).getTime() : Infinity;
                      return dateA - dateB;
                    });
                    const isCollapsed = collapsedPanelTypes.has(panelType);
                    
                    return (
                      <div key={panelType} className="border rounded-md overflow-hidden">
                        <button
                          type="button"
                          className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 hover-elevate text-left"
                          onClick={() => togglePanelTypeGroup(panelType)}
                          data-testid={`button-toggle-group-${panelType}`}
                        >
                          <div className="flex items-center gap-2">
                            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            <span className="font-medium">{panelType}</span>
                            <Badge variant="secondary" className="text-xs">{panelsInGroup.length}</Badge>
                          </div>
                        </button>
                        {!isCollapsed && (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Panel</TableHead>
                                <TableHead>Job</TableHead>
                                <TableHead>Level</TableHead>
                                <TableHead>Drawing Due</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {panelsInGroup.map((program: any) => {
                                const dueDate = program.drawingDueDate ? new Date(program.drawingDueDate) : null;
                                const today = new Date();
                                const daysUntil = dueDate ? Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
                                const isOverdue = daysUntil !== null && daysUntil < 0;
                                const isUrgent = daysUntil !== null && daysUntil >= 0 && daysUntil <= 5;
                                
                                return (
                                  <TableRow 
                                    key={program.id}
                                    style={program.job?.productionSlotColor ? { 
                                      backgroundColor: `${program.job.productionSlotColor}15`,
                                      borderLeft: `4px solid ${program.job.productionSlotColor}` 
                                    } : undefined}
                                  >
                                    <TableCell className="font-medium">{program.panel?.panelMark}</TableCell>
                                    <TableCell>{program.job?.jobNumber}</TableCell>
                                    <TableCell>{program.level}</TableCell>
                                    <TableCell className={isOverdue ? "text-red-600 font-semibold" : isUrgent ? "text-orange-500 font-medium" : ""}>
                                      {dueDate ? format(dueDate, "dd/MM/yyyy") : "-"}
                                      {isOverdue && <span className="ml-1 text-xs">({Math.abs(daysUntil!)} days overdue)</span>}
                                      {isUrgent && !isOverdue && <span className="ml-1 text-xs">({daysUntil} days)</span>}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={
                                        program.status === "IN_PROGRESS" ? "default" :
                                        program.status === "SCHEDULED" ? "outline" :
                                        program.status === "ON_HOLD" ? "destructive" : "secondary"
                                      }>
                                        {program.status.replace("_", " ")}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="default"
                                          size="sm"
                                          onClick={() => {
                                            if (program.panel?.id && program.jobId) {
                                              const params = new URLSearchParams();
                                              params.set("date", format(new Date(), "yyyy-MM-dd"));
                                              params.set("jobId", program.jobId);
                                              params.set("panelId", program.panel.id);
                                              if (program.panel?.panelMark) {
                                                params.set("panelMark", program.panel.panelMark);
                                              }
                                              params.set("startTimer", "true");
                                              setLocation(`/manual-entry?${params.toString()}`);
                                            }
                                          }}
                                          data-testid={`button-draft-now-${program.id}`}
                                        >
                                          <Play className="h-3 w-3 mr-1" />
                                          Draft Now
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    );
                  });
                })()}
              </CardContent>
            )}
          </Card>
            );
          })()}
        </>
      )}

      <div ref={reportRef}>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Drafting Register</span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowDraftingRegister(!showDraftingRegister)}
                data-testid="button-toggle-register"
              >
                {showDraftingRegister ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {showDraftingRegister ? "Hide" : "Show"}
              </Button>
            </div>
            {showDraftingRegister && (
            <div className="flex flex-wrap gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-48"
                  data-testid="input-search"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="SUBMITTED">Submitted</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-36" data-testid="select-date-range">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
              <Select value={factoryFilter} onValueChange={setFactoryFilter}>
                <SelectTrigger className="w-36" data-testid="select-factory-filter">
                  <SelectValue placeholder="Factory" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Factories</SelectItem>
                  <SelectItem value="QLD">QLD</SelectItem>
                  <SelectItem value="VIC">Victoria</SelectItem>
                </SelectContent>
              </Select>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                <SelectTrigger className="w-36" data-testid="select-group-by">
                  <SelectValue placeholder="Group By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Grouping</SelectItem>
                  <SelectItem value="user">Group by User</SelectItem>
                  <SelectItem value="date">Group by Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            )}
          </div>
        </CardHeader>
        {showDraftingRegister && (
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 flex-1" />
                </div>
              ))}
            </div>
          ) : filteredLogs && filteredLogs.length > 0 ? (
            groupBy !== "none" && groupedLogs ? (
              <div className="space-y-2">
                {Object.entries(groupedLogs).map(([groupKey, { label, logs: groupLogs }]) => (
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
                        {groupBy === "user" ? <User className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                        <span className="font-medium">{label}</span>
                        <Badge variant="secondary" className="ml-auto">{groupLogs.length} log{groupLogs.length !== 1 ? "s" : ""}</Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-4 mt-2 border-l-2 pl-4">
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {groupBy !== "date" && <TableHead className="w-32">Date</TableHead>}
                                <TableHead className="w-24">Factory</TableHead>
                                {groupBy !== "user" && (user?.role === "MANAGER" || user?.role === "ADMIN") && (
                                  <TableHead>User</TableHead>
                                )}
                                <TableHead className="text-right">Total Time</TableHead>
                                <TableHead className="text-right">Expected</TableHead>
                                <TableHead className="text-right">Remaining</TableHead>
                                <TableHead className="text-right">Last Entry</TableHead>
                                <TableHead className="text-right">Idle</TableHead>
                                <TableHead className="text-right">Missing Panel</TableHead>
                                <TableHead className="text-right">Missing Job</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="w-10"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {groupLogs.map((log) => (
                                <TableRow key={log.id} className="cursor-pointer hover-elevate" data-testid={`row-log-${log.id}`}>
                                  {groupBy !== "date" && (
                                    <TableCell>
                                      <Link href={`/daily-reports/${log.id}`}>
                                        <div className="flex items-center gap-2">
                                          <Calendar className="h-4 w-4 text-muted-foreground" />
                                          <span className="font-medium">
                                            {format(new Date(log.logDay), "dd/MM/yyyy")}
                                          </span>
                                        </div>
                                      </Link>
                                    </TableCell>
                                  )}
                                  <TableCell>
                                    <div className="flex items-center gap-1.5">
                                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                      <Badge variant={log.factory === "QLD" ? "default" : "secondary"}>
                                        {log.factory}
                                      </Badge>
                                    </div>
                                  </TableCell>
                                  {groupBy !== "user" && (user?.role === "MANAGER" || user?.role === "ADMIN") && (
                                    <TableCell className="text-muted-foreground">
                                      {log.userName || log.userEmail}
                                    </TableCell>
                                  )}
                                  <TableCell className="text-right font-medium">
                                    <div className="flex items-center justify-end gap-1">
                                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                      {formatMinutes(log.totalMinutes)}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {getExpectedHoursForDay(log).toFixed(1)}h
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {getRemainingHours(log) > 0 ? (
                                      <span className="text-amber-600 font-medium">
                                        {getRemainingHours(log).toFixed(1)}h
                                      </span>
                                    ) : (
                                      <span className="text-green-600 font-medium">Done</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {formatEndTime(log.lastEntryEndTime)}
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {formatMinutes(log.idleMinutes)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {log.missingPanelMarkMinutes > 0 ? (
                                      <div className="flex items-center justify-end gap-1 text-amber-600">
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                        {formatMinutes(log.missingPanelMarkMinutes)}
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {log.missingProjectMinutes > 0 ? (
                                      <div className="flex items-center justify-end gap-1 text-amber-600">
                                        <FolderOpen className="h-3.5 w-3.5" />
                                        {formatMinutes(log.missingProjectMinutes)}
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {getStatusBadge(log.status)}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Link href={`/daily-reports/${log.id}`}>
                                        <Button variant="ghost" size="icon" data-testid={`button-view-${log.id}`}>
                                          <ChevronRight className="h-4 w-4" />
                                        </Button>
                                      </Link>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeletingLogId(log.id);
                                          setDeleteDialogOpen(true);
                                        }}
                                        data-testid={`button-delete-${log.id}`}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Date</TableHead>
                      <TableHead className="w-24">Factory</TableHead>
                      {(user?.role === "MANAGER" || user?.role === "ADMIN") && (
                        <TableHead>User</TableHead>
                      )}
                      <TableHead className="text-right">Total Time</TableHead>
                      <TableHead className="text-right">Expected</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                      <TableHead className="text-right">Last Entry</TableHead>
                      <TableHead className="text-right">Idle</TableHead>
                      <TableHead className="text-right">Missing Panel</TableHead>
                      <TableHead className="text-right">Missing Job</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id} className="cursor-pointer hover-elevate" data-testid={`row-log-${log.id}`}>
                        <TableCell>
                          <Link href={`/daily-reports/${log.id}`}>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {format(new Date(log.logDay), "dd/MM/yyyy")}
                              </span>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            <Badge variant={log.factory === "QLD" ? "default" : "secondary"}>
                              {log.factory}
                            </Badge>
                          </div>
                        </TableCell>
                        {(user?.role === "MANAGER" || user?.role === "ADMIN") && (
                          <TableCell className="text-muted-foreground">
                            {log.userName || log.userEmail}
                          </TableCell>
                        )}
                        <TableCell className="text-right font-medium">
                          <div className="flex items-center justify-end gap-1">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatMinutes(log.totalMinutes)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {getExpectedHoursForDay(log).toFixed(1)}h
                        </TableCell>
                        <TableCell className="text-right">
                          {getRemainingHours(log) > 0 ? (
                            <span className="text-amber-600 font-medium">
                              {getRemainingHours(log).toFixed(1)}h
                            </span>
                          ) : (
                            <span className="text-green-600 font-medium">Done</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatEndTime(log.lastEntryEndTime)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatMinutes(log.idleMinutes)}
                        </TableCell>
                        <TableCell className="text-right">
                          {log.missingPanelMarkMinutes > 0 ? (
                            <div className="flex items-center justify-end gap-1 text-amber-600">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {formatMinutes(log.missingPanelMarkMinutes)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {log.missingProjectMinutes > 0 ? (
                            <div className="flex items-center justify-end gap-1 text-amber-600">
                              <FolderOpen className="h-3.5 w-3.5" />
                              {formatMinutes(log.missingProjectMinutes)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(log.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Link href={`/daily-reports/${log.id}`}>
                              <Button variant="ghost" size="icon" data-testid={`button-view-${log.id}`}>
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingLogId(log.id);
                                setDeleteDialogOpen(true);
                              }}
                              data-testid={`button-delete-${log.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No drafting entries found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Time entries from your Windows Agent will appear here
              </p>
            </div>
          )}
        </CardContent>
        )}
      </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Daily Log?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this daily log and all its time entries. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingLogId && deleteDailyLogMutation.mutate(deletingLogId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteDailyLogMutation.isPending ? (
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
