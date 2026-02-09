import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PRODUCTION_ROUTES, JOBS_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Check, ChevronDown, ChevronRight, Search, Plus, ClipboardList, FileCheck, FileClock, FileEdit, Package } from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import type { Job } from "@shared/schema";
import { PageHelpButton } from "@/components/help/page-help-button";

interface PanelStats {
  draft: number;
  ifa: number;
  ifc: number;
  approved: number;
  scheduled: number;
  completed: number;
}

interface ReadyPanel {
  id: string;
  panelMark: string;
  jobId: string;
  jobNumber: string;
  jobName: string;
  level: string | null;
  documentStatus: string;
  productionWindowDate: string | null;
  dueDate: string | null;
  daysDue: number | null;
  isOverdue: boolean;
}

interface ScheduledProductionDay {
  date: string;
  factoryId: string | null;
  factoryName: string | null;
  panelCount: number;
  panels: {
    id: string;
    panelMark: string;
    jobNumber: string;
    status: string;
  }[];
}

type GroupBy = "none" | "job" | "date";

export default function ProductionSchedulePage() {
  const { toast } = useToast();
  
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [groupBy, setGroupBy] = useState<GroupBy>("job");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedPanelIds, setSelectedPanelIds] = useState<Set<string>>(new Set());
  const [showAddToScheduleDialog, setShowAddToScheduleDialog] = useState(false);
  const [productionDate, setProductionDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  
  const today = new Date();
  const [scheduleStartDate, setScheduleStartDate] = useState<string>(format(today, "yyyy-MM-dd"));
  const [scheduleEndDate, setScheduleEndDate] = useState<string>(format(addDays(today, 30), "yyyy-MM-dd"));
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [showReadyForProduction, setShowReadyForProduction] = useState(true);
  const [showProductionDaysRegister, setShowProductionDaysRegister] = useState(true);

  const { data: stats, isLoading: loadingStats } = useQuery<PanelStats>({
    queryKey: [PRODUCTION_ROUTES.SCHEDULE_STATS, { jobId: jobFilter !== "all" ? jobFilter : undefined }],
  });

  const { data: readyPanels = [], isLoading: loadingPanels } = useQuery<ReadyPanel[]>({
    queryKey: [PRODUCTION_ROUTES.SCHEDULE_READY_PANELS, { 
      jobId: jobFilter !== "all" ? jobFilter : undefined,
      search: searchQuery || undefined,
    }],
  });

  const { data: scheduledDays = [], isLoading: loadingDays } = useQuery<ScheduledProductionDay[]>({
    queryKey: [PRODUCTION_ROUTES.SCHEDULE_DAYS, { 
      startDate: scheduleStartDate,
      endDate: scheduleEndDate,
    }],
  });

  const { data: allJobs = [] } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
    select: (data: any) => data.map((j: any) => ({ id: j.id, jobNumber: j.jobNumber, name: j.name })),
  });

  const addPanelsMutation = useMutation({
    mutationFn: async (data: { panelIds: string[]; productionDate: string }) => {
      return apiRequest("POST", PRODUCTION_ROUTES.SCHEDULE_ADD_PANELS, data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [PRODUCTION_ROUTES.SCHEDULE_STATS] });
      queryClient.invalidateQueries({ queryKey: [PRODUCTION_ROUTES.SCHEDULE_READY_PANELS] });
      queryClient.invalidateQueries({ queryKey: [PRODUCTION_ROUTES.SCHEDULE_DAYS] });
      setSelectedPanelIds(new Set());
      setShowAddToScheduleDialog(false);
      toast({ 
        title: "Success", 
        description: `Added ${data.created} panel(s) to production schedule${data.errors?.length ? `. ${data.errors.length} error(s).` : ""}` 
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add panels to schedule", variant: "destructive" });
    },
  });

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

  const toggleDay = (dateKey: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  const togglePanelSelection = (panelId: string) => {
    setSelectedPanelIds(prev => {
      const next = new Set(prev);
      if (next.has(panelId)) {
        next.delete(panelId);
      } else {
        next.add(panelId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPanelIds.size === filteredPanels.length) {
      setSelectedPanelIds(new Set());
    } else {
      setSelectedPanelIds(new Set(filteredPanels.map(p => p.id)));
    }
  };

  const handleAddToSchedule = () => {
    if (selectedPanelIds.size === 0) {
      toast({ title: "Error", description: "Please select at least one panel", variant: "destructive" });
      return;
    }
    addPanelsMutation.mutate({
      panelIds: Array.from(selectedPanelIds),
      productionDate,
    });
  };

  const filteredPanels = readyPanels.filter(panel => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      panel.panelMark?.toLowerCase().includes(query) ||
      panel.jobNumber?.toLowerCase().includes(query) ||
      panel.jobName?.toLowerCase().includes(query) ||
      panel.level?.toLowerCase().includes(query)
    );
  });

  const groupedPanels = (() => {
    if (groupBy === "none") return null;
    
    const groups: Record<string, { label: string; entries: ReadyPanel[] }> = {};
    
    for (const panel of filteredPanels) {
      let key: string;
      let label: string;
      
      if (groupBy === "job") {
        key = panel.jobId;
        label = `${panel.jobNumber} - ${panel.jobName || ""}`;
      } else if (groupBy === "date" && panel.productionWindowDate) {
        key = panel.productionWindowDate;
        label = format(parseISO(panel.productionWindowDate), "dd MMM yyyy");
      } else {
        key = "no-date";
        label = "No Production Date";
      }
      
      if (!groups[key]) {
        groups[key] = { label, entries: [] };
      }
      groups[key].entries.push(panel);
    }
    
    if (groupBy === "date") {
      const sortedEntries = Object.entries(groups).sort(([a], [b]) => {
        if (a === "no-date") return 1;
        if (b === "no-date") return -1;
        return a.localeCompare(b);
      });
      return Object.fromEntries(sortedEntries);
    }
    
    return groups;
  })();

  useEffect(() => {
    if (groupedPanels) {
      setExpandedGroups(new Set(Object.keys(groupedPanels)));
    }
  }, [groupBy, filteredPanels.length]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      PENDING: "outline",
      COMPLETED: "default",
    };
    const colors: Record<string, string> = {
      PENDING: "text-amber-600",
      COMPLETED: "text-green-600 bg-green-100",
    };
    return <Badge variant={variants[status] || "secondary"} className={colors[status]}>{status}</Badge>;
  };

  const getDocStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      DRAFT: "secondary",
      IFA: "outline",
      IFC: "default",
      APPROVED: "default",
    };
    const colors: Record<string, string> = {
      DRAFT: "",
      IFA: "text-blue-600",
      IFC: "text-green-600 bg-green-100",
      APPROVED: "text-emerald-700 bg-emerald-100",
    };
    return <Badge variant={variants[status] || "secondary"} className={colors[status]}>{status}</Badge>;
  };

  const getDueDateColor = (daysDue: number | null): string => {
    if (daysDue === null) return "";
    if (daysDue < 0) return "text-red-600 font-semibold";
    if (daysDue <= 5) return "text-orange-500 font-medium";
    if (daysDue <= 10) return "text-yellow-600";
    return "";
  };

  const totalPanels = stats ? stats.draft + stats.ifa + stats.ifc + stats.approved + stats.scheduled + stats.completed : 0;

  return (
    <div className="space-y-6" data-testid="page-production-schedule">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Production Schedule</h1>
            <PageHelpButton pageHelpKey="page.production-schedule" />
          </div>
          <p className="text-muted-foreground">
            Manage panel production scheduling and track progress
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card data-testid="stat-card-draft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft</CardTitle>
            <FileEdit className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.draft ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="stat-card-ifa">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">IFA</CardTitle>
            <FileClock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-blue-600">{stats?.ifa ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="stat-card-ifc">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">IFC</CardTitle>
            <FileCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-green-600">{stats?.ifc ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="stat-card-approved">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <Check className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-emerald-700">{stats?.approved ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="stat-card-scheduled">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Calendar className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-purple-600">{stats?.scheduled ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="stat-card-completed">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Package className="h-4 w-4 text-teal-500" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-teal-600">{stats?.completed ?? 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Panels Ready for Production
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowReadyForProduction(!showReadyForProduction)}
              data-testid="button-toggle-ready-production"
            >
              {showReadyForProduction ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {showReadyForProduction ? "Hide" : "Show"}
            </Button>
          </div>
          {showReadyForProduction && (
          <div className="flex flex-wrap items-center gap-4 pt-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search panels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-panels"
              />
            </div>
            
            <Select value={jobFilter} onValueChange={setJobFilter}>
              <SelectTrigger className="w-[200px]" data-testid="select-job-filter">
                <SelectValue placeholder="All Jobs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                {[...allJobs].sort((a, b) => (a.jobNumber || a.name || '').localeCompare(b.jobNumber || b.name || '')).map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.jobNumber} - {job.name || ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
              <SelectTrigger className="w-[150px]" data-testid="select-group-by">
                <SelectValue placeholder="Group By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Grouping</SelectItem>
                <SelectItem value="job">By Job</SelectItem>
                <SelectItem value="date">By Date</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              onClick={() => setShowAddToScheduleDialog(true)}
              disabled={selectedPanelIds.size === 0}
              data-testid="button-add-to-schedule"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add to Schedule ({selectedPanelIds.size})
            </Button>
          </div>
          )}
        </CardHeader>
        {showReadyForProduction && (
        <CardContent>
          {loadingPanels ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredPanels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No panels ready for production scheduling
            </div>
          ) : groupedPanels ? (
            <div className="space-y-2">
              {Object.entries(groupedPanels).map(([key, group]) => (
                <Collapsible key={key} open={expandedGroups.has(key)} onOpenChange={() => toggleGroup(key)}>
                  <CollapsibleTrigger className="flex items-center gap-2 p-2 w-full hover-elevate rounded-md">
                    {expandedGroups.has(key) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="font-medium">{group.label}</span>
                    <Badge variant="secondary">{group.entries.length}</Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-6 border-l pl-4 mt-2 space-y-1">
                      {group.entries.map((panel) => (
                        <div
                          key={panel.id}
                          className="flex items-center gap-4 p-2 rounded-md hover-elevate"
                          data-testid={`panel-row-${panel.id}`}
                        >
                          <Checkbox
                            checked={selectedPanelIds.has(panel.id)}
                            onCheckedChange={() => togglePanelSelection(panel.id)}
                            data-testid={`checkbox-panel-${panel.id}`}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{panel.panelMark}</span>
                            {groupBy !== "job" && (
                              <span className="text-muted-foreground ml-2 text-sm">
                                ({panel.jobNumber})
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {panel.level || "-"}
                          </div>
                          {getDocStatusBadge(panel.documentStatus)}
                          <div className={`text-sm ${getDueDateColor(panel.daysDue)}`}>
                            {panel.dueDate ? (
                              <>
                                {format(parseISO(panel.dueDate), "dd MMM")}
                                {panel.daysDue !== null && (
                                  <span className="ml-1">
                                    ({panel.daysDue > 0 ? `${panel.daysDue}d` : panel.daysDue === 0 ? "Today" : `${Math.abs(panel.daysDue)}d late`})
                                  </span>
                                )}
                              </>
                            ) : (
                              "-"
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-4 p-2 border-b font-medium text-sm text-muted-foreground">
                <Checkbox
                  checked={selectedPanelIds.size === filteredPanels.length && filteredPanels.length > 0}
                  onCheckedChange={toggleSelectAll}
                  data-testid="checkbox-select-all"
                />
                <div className="flex-1">Panel Mark</div>
                <div className="w-24">Job</div>
                <div className="w-16">Level</div>
                <div className="w-20">Status</div>
                <div className="w-32">Due</div>
              </div>
              {filteredPanels.map((panel) => (
                <div
                  key={panel.id}
                  className="flex items-center gap-4 p-2 rounded-md hover-elevate"
                  data-testid={`panel-row-${panel.id}`}
                >
                  <Checkbox
                    checked={selectedPanelIds.has(panel.id)}
                    onCheckedChange={() => togglePanelSelection(panel.id)}
                    data-testid={`checkbox-panel-${panel.id}`}
                  />
                  <div className="flex-1 font-medium">{panel.panelMark}</div>
                  <div className="w-24 text-sm text-muted-foreground">{panel.jobNumber}</div>
                  <div className="w-16 text-sm">{panel.level || "-"}</div>
                  {getDocStatusBadge(panel.documentStatus)}
                  <div className={`w-32 text-sm ${getDueDateColor(panel.daysDue)}`}>
                    {panel.dueDate ? (
                      <>
                        {format(parseISO(panel.dueDate), "dd MMM")}
                        {panel.daysDue !== null && (
                          <span className="ml-1">
                            ({panel.daysDue > 0 ? `${panel.daysDue}d` : panel.daysDue === 0 ? "Today" : `${Math.abs(panel.daysDue)}d late`})
                          </span>
                        )}
                      </>
                    ) : (
                      "-"
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Production Days Register
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowProductionDaysRegister(!showProductionDaysRegister)}
              data-testid="button-toggle-production-register"
            >
              {showProductionDaysRegister ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {showProductionDaysRegister ? "Hide" : "Show"}
            </Button>
          </div>
          {showProductionDaysRegister && (
          <div className="flex flex-wrap items-center gap-4 pt-4">
            <div className="flex items-center gap-2">
              <Label>From:</Label>
              <Input
                type="date"
                value={scheduleStartDate}
                onChange={(e) => setScheduleStartDate(e.target.value)}
                className="w-[160px]"
                data-testid="input-schedule-start-date"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label>To:</Label>
              <Input
                type="date"
                value={scheduleEndDate}
                onChange={(e) => setScheduleEndDate(e.target.value)}
                className="w-[160px]"
                data-testid="input-schedule-end-date"
              />
            </div>
          </div>
          )}
        </CardHeader>
        {showProductionDaysRegister && (
        <CardContent>
          {loadingDays ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : scheduledDays.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No panels scheduled in this date range
            </div>
          ) : (
            <div className="space-y-2">
              {scheduledDays.map((day) => (
                <Collapsible key={day.date} open={expandedDays.has(day.date)} onOpenChange={() => toggleDay(day.date)}>
                  <CollapsibleTrigger className="flex items-center gap-4 p-3 w-full hover-elevate rounded-md border">
                    {expandedDays.has(day.date) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{format(parseISO(day.date), "EEEE, dd MMMM yyyy")}</span>
                    {day.factoryName && (
                      <Badge variant="outline">{day.factoryName}</Badge>
                    )}
                    <Badge variant="secondary">{day.panelCount} panel{day.panelCount !== 1 ? "s" : ""}</Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-6 border-l pl-4 mt-2 space-y-1">
                      {day.panels.map((panel) => (
                        <div
                          key={panel.id}
                          className="flex items-center gap-4 p-2 rounded-md hover-elevate"
                          data-testid={`scheduled-panel-${panel.id}`}
                        >
                          <div className="flex-1 font-medium">{panel.panelMark}</div>
                          <div className="text-sm text-muted-foreground">{panel.jobNumber}</div>
                          {getStatusBadge(panel.status)}
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
        )}
      </Card>

      <Dialog open={showAddToScheduleDialog} onOpenChange={setShowAddToScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Panels to Production Schedule</DialogTitle>
            <DialogDescription>
              Schedule {selectedPanelIds.size} selected panel{selectedPanelIds.size !== 1 ? "s" : ""} for production
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="productionDate">Production Date</Label>
              <Input
                id="productionDate"
                type="date"
                value={productionDate}
                onChange={(e) => setProductionDate(e.target.value)}
                data-testid="input-production-date"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddToScheduleDialog(false)} data-testid="button-cancel-add">
              Cancel
            </Button>
            <Button 
              onClick={handleAddToSchedule} 
              disabled={addPanelsMutation.isPending}
              data-testid="button-confirm-add"
            >
              {addPanelsMutation.isPending ? "Adding..." : "Add to Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
