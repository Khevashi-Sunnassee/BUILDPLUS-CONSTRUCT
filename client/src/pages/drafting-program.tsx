import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { DRAFTING_ROUTES, JOBS_ROUTES, ADMIN_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, AlertTriangle, Check, RefreshCw, Pencil, User, ChevronDown, ChevronRight, Briefcase, CalendarDays, Search, Layers, Play, Pause } from "lucide-react";
import { format, parseISO, differenceInDays, addDays, startOfWeek, endOfWeek } from "date-fns";
import type { Job, PanelRegister, ProductionSlot, User as UserType, GlobalSettings, DraftingProgram } from "@shared/schema";

interface DraftingProgramWithDetails extends DraftingProgram {
  panel: PanelRegister;
  job: Job;
  productionSlot?: ProductionSlot | null;
  assignedTo?: UserType | null;
}

type StatusFilter = "ALL" | "NOT_SCHEDULED" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD";
type GroupBy = "none" | "job" | "level" | "week" | "assignee";

const getWeekBoundaries = (date: Date, weekStartDay: number) => {
  const weekStart = startOfWeek(date, { weekStartsOn: weekStartDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
  const weekEnd = endOfWeek(date, { weekStartsOn: weekStartDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
  return { weekStart, weekEnd };
};

const getWeekKey = (date: Date, weekStartDay: number) => {
  const { weekStart } = getWeekBoundaries(date, weekStartDay);
  return format(weekStart, "yyyy-MM-dd");
};

const getWeekLabel = (weekStartStr: string) => {
  const weekStart = parseISO(weekStartStr);
  const weekEnd = addDays(weekStart, 6);
  return `${format(weekStart, "dd MMM")} - ${format(weekEnd, "dd MMM yyyy")}`;
};

export default function DraftingProgramPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isManagerOrAdmin = user?.role === "MANAGER" || user?.role === "ADMIN";
  
  const { data: globalSettings } = useQuery<GlobalSettings>({
    queryKey: [ADMIN_ROUTES.SETTINGS],
  });
  
  const weekStartDay = globalSettings?.weekStartDay ?? 1;
  const ifcDaysInAdvance = globalSettings?.ifcDaysInAdvance ?? 14;
  const daysToAchieveIfc = globalSettings?.daysToAchieveIfc ?? 21;
  const productionWindowDays = globalSettings?.productionWindowDays ?? 10;
  
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [groupBy, setGroupBy] = useState<GroupBy>("job");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showUpdateStatusDialog, setShowUpdateStatusDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<DraftingProgramWithDetails | null>(null);
  const [assignUserId, setAssignUserId] = useState<string>("");
  const [proposedStartDate, setProposedStartDate] = useState<string>("");
  const [newStatus, setNewStatus] = useState<string>("");

  const { data: programs = [], isLoading: loadingPrograms } = useQuery<DraftingProgramWithDetails[]>({
    queryKey: [DRAFTING_ROUTES.PROGRAM, { 
      status: statusFilter !== "ALL" ? statusFilter : undefined, 
      jobId: jobFilter !== "all" ? jobFilter : undefined, 
      assignedToId: assigneeFilter !== "all" ? assigneeFilter : undefined 
    }],
  });

  const { data: allJobs = [] } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
    select: (data: any) => data.map((j: any) => ({ id: j.id, jobNumber: j.jobNumber, name: j.name })),
  });

  const { data: allUsers = [] } = useQuery<UserType[]>({
    queryKey: [ADMIN_ROUTES.USERS],
    select: (data: any) => data.filter((u: UserType) => u.isActive),
  });

  const generateProgramMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", DRAFTING_ROUTES.GENERATE);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [DRAFTING_ROUTES.PROGRAM] });
      toast({ 
        title: "Success", 
        description: `Created ${data.created} new entries, updated ${data.updated} existing entries` 
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to generate drafting program", variant: "destructive" });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (data: { id: string; assignedToId: string; proposedStartDate: string }) => {
      return apiRequest("POST", DRAFTING_ROUTES.ASSIGN(data.id), {
        assignedToId: data.assignedToId,
        proposedStartDate: data.proposedStartDate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DRAFTING_ROUTES.PROGRAM] });
      setShowAssignDialog(false);
      resetAssignForm();
      toast({ title: "Success", description: "Resource assigned successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to assign resource", variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (data: { id: string; status: string }) => {
      return apiRequest("PATCH", DRAFTING_ROUTES.BY_PANEL(data.id), {
        status: data.status,
        completedAt: data.status === "COMPLETED" ? new Date().toISOString() : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DRAFTING_ROUTES.PROGRAM] });
      setShowUpdateStatusDialog(false);
      setSelectedEntry(null);
      toast({ title: "Success", description: "Status updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update status", variant: "destructive" });
    },
  });

  const resetAssignForm = () => {
    setAssignUserId("");
    setProposedStartDate("");
    setSelectedEntry(null);
  };

  const openAssignDialog = (entry: DraftingProgramWithDetails) => {
    setSelectedEntry(entry);
    if (entry.assignedToId) setAssignUserId(entry.assignedToId);
    if (entry.proposedStartDate) {
      setProposedStartDate(format(new Date(entry.proposedStartDate), "yyyy-MM-dd"));
    } else if (entry.draftingWindowStart) {
      setProposedStartDate(format(new Date(entry.draftingWindowStart), "yyyy-MM-dd"));
    }
    setShowAssignDialog(true);
  };

  const openUpdateStatusDialog = (entry: DraftingProgramWithDetails) => {
    setSelectedEntry(entry);
    setNewStatus(entry.status);
    setShowUpdateStatusDialog(true);
  };

  const handleAssignSubmit = () => {
    if (!selectedEntry || !assignUserId || !proposedStartDate) {
      toast({ title: "Error", description: "Please select a resource and proposed start date", variant: "destructive" });
      return;
    }
    assignMutation.mutate({
      id: selectedEntry.id,
      assignedToId: assignUserId,
      proposedStartDate,
    });
  };

  const handleStatusUpdate = () => {
    if (!selectedEntry || !newStatus) return;
    updateStatusMutation.mutate({
      id: selectedEntry.id,
      status: newStatus,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      NOT_SCHEDULED: "secondary",
      SCHEDULED: "outline",
      IN_PROGRESS: "default",
      COMPLETED: "outline",
      ON_HOLD: "destructive",
    };
    const colors: Record<string, string> = {
      NOT_SCHEDULED: "text-gray-500",
      SCHEDULED: "text-blue-600",
      IN_PROGRESS: "bg-amber-500",
      COMPLETED: "text-green-600",
      ON_HOLD: "",
    };
    return <Badge variant={variants[status]} className={colors[status]}>{status.replace("_", " ")}</Badge>;
  };

  const getDateColorClass = (dueDate: Date | null): string => {
    if (!dueDate) return "";
    const today = new Date();
    const daysUntil = differenceInDays(dueDate, today);
    
    if (daysUntil < 0) return "text-red-600 font-semibold";
    if (daysUntil <= 5) return "text-orange-500 font-medium";
    if (daysUntil <= 10) return "text-yellow-600";
    return "";
  };

  const filteredPrograms = programs.filter(entry => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      entry.panel.panelMark?.toLowerCase().includes(query) ||
      entry.job.jobNumber?.toLowerCase().includes(query) ||
      entry.job.name?.toLowerCase().includes(query) ||
      entry.level?.toLowerCase().includes(query)
    );
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

  const groupedPrograms = (() => {
    if (groupBy === "none") return null;
    
    const groups: Record<string, { label: string; entries: DraftingProgramWithDetails[] }> = {};
    
    for (const entry of filteredPrograms) {
      let key: string;
      let label: string;
      
      if (groupBy === "job") {
        key = entry.jobId;
        label = `${entry.job.jobNumber} - ${entry.job.name || ""}`;
      } else if (groupBy === "level") {
        key = `${entry.jobId}-${entry.level}`;
        label = `${entry.job.jobNumber} - ${entry.level}`;
      } else if (groupBy === "week" && entry.draftingWindowStart) {
        key = getWeekKey(new Date(entry.draftingWindowStart), weekStartDay);
        label = `Drafting: ${getWeekLabel(key)}`;
      } else if (groupBy === "assignee") {
        key = entry.assignedToId || "unassigned";
        label = entry.assignedTo?.name || entry.assignedTo?.email || "Unassigned";
      } else {
        key = "other";
        label = "Other";
      }
      
      if (!groups[key]) {
        groups[key] = { label, entries: [] };
      }
      groups[key].entries.push(entry);
    }
    
    if (groupBy === "week") {
      const sortedEntries = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
      return Object.fromEntries(sortedEntries);
    }
    
    return groups;
  })();

  useEffect(() => {
    if (groupedPrograms) {
      setExpandedGroups(new Set(Object.keys(groupedPrograms)));
    }
  }, [groupBy, filteredPrograms.length]);

  const uniqueAssignees = Array.from(new Map(
    programs
      .filter(p => p.assignedTo)
      .map(p => [p.assignedToId, p.assignedTo] as const)
  ).values());

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Drafting Program</h1>
          <p className="text-muted-foreground">
            Schedule and assign drafting resources to panels. 
            Drawing Due = Production Date - {productionWindowDays} - {ifcDaysInAdvance} days, 
            Drafting Start = Drawing Due - {daysToAchieveIfc} days
          </p>
        </div>
        {isManagerOrAdmin && (
          <Button 
            onClick={() => generateProgramMutation.mutate()} 
            disabled={generateProgramMutation.isPending}
            data-testid="button-generate-program"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${generateProgramMutation.isPending ? "animate-spin" : ""}`} />
            {generateProgramMutation.isPending ? "Generating..." : "Generate from Production Slots"}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="NOT_SCHEDULED">Not Scheduled</SelectItem>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="ON_HOLD">On Hold</SelectItem>
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
                  {allJobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.jobNumber} - {job.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Assignee</Label>
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger data-testid="select-assignee-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {uniqueAssignees.map((u: any) => (
                    <SelectItem key={u?.id} value={u?.id || ""}>
                      {u?.name || u?.email}
                    </SelectItem>
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
                  <SelectItem value="none">No Grouping</SelectItem>
                  <SelectItem value="job">Job</SelectItem>
                  <SelectItem value="level">Job + Level</SelectItem>
                  <SelectItem value="week">Drafting Week</SelectItem>
                  <SelectItem value="assignee">Assignee</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Panel, Job..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                  data-testid="input-search"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {loadingPrograms ? (
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading drafting program...</span>
            </div>
          </CardContent>
        </Card>
      ) : filteredPrograms.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No drafting program entries found.</p>
              <p className="text-sm mt-2">
                Click "Generate from Production Slots" to create entries from your production schedule.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : groupBy === "none" ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Panel</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Drafting Window</TableHead>
                  <TableHead>Drawing Due</TableHead>
                  <TableHead>Production Date</TableHead>
                  <TableHead>Proposed Start</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPrograms.map((entry) => (
                  <TableRow 
                    key={entry.id}
                    style={entry.job.productionSlotColor ? { 
                      backgroundColor: `${entry.job.productionSlotColor}15`,
                      borderLeft: `4px solid ${entry.job.productionSlotColor}` 
                    } : undefined}
                  >
                    <TableCell className="font-medium">{entry.panel.panelMark}</TableCell>
                    <TableCell>{entry.job.jobNumber}</TableCell>
                    <TableCell>{entry.level}</TableCell>
                    <TableCell>
                      {entry.draftingWindowStart ? format(new Date(entry.draftingWindowStart), "dd/MM/yyyy") : "-"}
                    </TableCell>
                    <TableCell className={getDateColorClass(entry.drawingDueDate ? new Date(entry.drawingDueDate) : null)}>
                      {entry.drawingDueDate ? format(new Date(entry.drawingDueDate), "dd/MM/yyyy") : "-"}
                    </TableCell>
                    <TableCell>
                      {entry.productionDate ? format(new Date(entry.productionDate), "dd/MM/yyyy") : "-"}
                    </TableCell>
                    <TableCell>
                      {entry.proposedStartDate ? format(new Date(entry.proposedStartDate), "dd/MM/yyyy") : "-"}
                    </TableCell>
                    <TableCell>
                      {entry.assignedTo ? (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {entry.assignedTo.name || entry.assignedTo.email}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(entry.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {isManagerOrAdmin && (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openAssignDialog(entry)}
                                  data-testid={`button-assign-${entry.id}`}
                                >
                                  <User className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Assign a drafter to this panel</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openUpdateStatusDialog(entry)}
                                  data-testid={`button-status-${entry.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Update drafting status</p>
                              </TooltipContent>
                            </Tooltip>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedPrograms || {}).map(([key, group]) => (
            <Card key={key}>
              <Collapsible open={expandedGroups.has(key)} onOpenChange={() => toggleGroup(key)}>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="cursor-pointer hover:bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {expandedGroups.has(key) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-base">{group.label}</CardTitle>
                        <Badge variant="secondary">{group.entries.length} panels</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const statuses = group.entries.reduce((acc, e) => {
                            acc[e.status] = (acc[e.status] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>);
                          return Object.entries(statuses).map(([status, count]) => (
                            <Badge key={status} variant="outline" className="text-xs">
                              {status.replace("_", " ")}: {count}
                            </Badge>
                          ));
                        })()}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Panel</TableHead>
                          <TableHead>Job</TableHead>
                          <TableHead>Level</TableHead>
                          <TableHead>Drafting Window</TableHead>
                          <TableHead>Drawing Due</TableHead>
                          <TableHead>Production Date</TableHead>
                          <TableHead>Proposed Start</TableHead>
                          <TableHead>Assigned To</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.entries.map((entry) => (
                          <TableRow 
                            key={entry.id}
                            style={entry.job.productionSlotColor ? { 
                              backgroundColor: `${entry.job.productionSlotColor}15`,
                              borderLeft: `4px solid ${entry.job.productionSlotColor}` 
                            } : undefined}
                          >
                            <TableCell className="font-medium">{entry.panel.panelMark}</TableCell>
                            <TableCell>{entry.job.jobNumber}</TableCell>
                            <TableCell>{entry.level}</TableCell>
                            <TableCell>
                              {entry.draftingWindowStart ? format(new Date(entry.draftingWindowStart), "dd/MM/yyyy") : "-"}
                            </TableCell>
                            <TableCell className={getDateColorClass(entry.drawingDueDate ? new Date(entry.drawingDueDate) : null)}>
                              {entry.drawingDueDate ? format(new Date(entry.drawingDueDate), "dd/MM/yyyy") : "-"}
                            </TableCell>
                            <TableCell>
                              {entry.productionDate ? format(new Date(entry.productionDate), "dd/MM/yyyy") : "-"}
                            </TableCell>
                            <TableCell>
                              {entry.proposedStartDate ? format(new Date(entry.proposedStartDate), "dd/MM/yyyy") : "-"}
                            </TableCell>
                            <TableCell>
                              {entry.assignedTo ? (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {entry.assignedTo.name || entry.assignedTo.email}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Unassigned</span>
                              )}
                            </TableCell>
                            <TableCell>{getStatusBadge(entry.status)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {isManagerOrAdmin && (
                                  <>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => openAssignDialog(entry)}
                                          data-testid={`button-assign-${entry.id}`}
                                        >
                                          <User className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Assign a drafter to this panel</p>
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => openUpdateStatusDialog(entry)}
                                          data-testid={`button-status-${entry.id}`}
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Update drafting status</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Drafting Resource</DialogTitle>
            <DialogDescription>
              Assign a drafter and set the proposed start date for {selectedEntry?.panel.panelMark}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Panel Information</Label>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Job: {selectedEntry?.job.jobNumber} - {selectedEntry?.job.name}</p>
                <p>Level: {selectedEntry?.level}</p>
                {selectedEntry?.productionDate && (
                  <p>Production Date: {format(new Date(selectedEntry.productionDate), "dd/MM/yyyy")}</p>
                )}
                {selectedEntry?.drawingDueDate && (
                  <p className="font-medium text-foreground">
                    Drawing Due: {format(new Date(selectedEntry.drawingDueDate), "dd/MM/yyyy")}
                  </p>
                )}
                {selectedEntry?.draftingWindowStart && (
                  <p>
                    Drafting Window: {format(new Date(selectedEntry.draftingWindowStart), "dd/MM/yyyy")} to{" "}
                    {selectedEntry?.drawingDueDate && format(new Date(selectedEntry.drawingDueDate), "dd/MM/yyyy")}
                  </p>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="assignee">Assign To</Label>
              <Select value={assignUserId} onValueChange={setAssignUserId}>
                <SelectTrigger data-testid="select-assign-user">
                  <SelectValue placeholder="Select a drafter" />
                </SelectTrigger>
                <SelectContent>
                  {allUsers.map((u: UserType) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="proposedStart">Proposed Start Date</Label>
              <Input
                id="proposedStart"
                type="date"
                value={proposedStartDate}
                onChange={(e) => setProposedStartDate(e.target.value)}
                data-testid="input-proposed-start"
              />
              {selectedEntry?.draftingWindowStart && selectedEntry?.drawingDueDate && (
                <p className="text-xs text-muted-foreground">
                  Should be between {format(new Date(selectedEntry.draftingWindowStart), "dd/MM/yyyy")} and{" "}
                  {format(new Date(selectedEntry.drawingDueDate), "dd/MM/yyyy")}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAssignSubmit} 
              disabled={assignMutation.isPending}
              data-testid="button-confirm-assign"
            >
              {assignMutation.isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showUpdateStatusDialog} onOpenChange={setShowUpdateStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Status</DialogTitle>
            <DialogDescription>
              Update the drafting status for {selectedEntry?.panel.panelMark}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger data-testid="select-new-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOT_SCHEDULED">Not Scheduled</SelectItem>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="ON_HOLD">On Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpdateStatusDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleStatusUpdate} 
              disabled={updateStatusMutation.isPending}
              data-testid="button-confirm-status"
            >
              {updateStatusMutation.isPending ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
