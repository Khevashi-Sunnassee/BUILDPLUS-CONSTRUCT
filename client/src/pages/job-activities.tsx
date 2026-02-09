import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ArrowLeft, ChevronDown, ChevronRight, Clock, User, FileText,
  Loader2, Filter, Search, Calendar, MessageSquare, Paperclip,
  Send, ChevronsDownUp, ChevronsUpDown, Download, AlertTriangle,
  ListChecks, BarChart3, TableProperties, Eye, EyeOff, CheckCircle,
  RefreshCw, Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PROJECT_ACTIVITIES_ROUTES } from "@shared/api-routes";
import type { JobType, ActivityStage, JobActivity } from "@shared/schema";
import { format, isAfter, isBefore, startOfDay } from "date-fns";

import { getStageColor } from "@/lib/stage-colors";
import { ActivityTasksPanel } from "@/pages/tasks/ActivityTasksPanel";
import { GanttChart } from "@/pages/job-activities-gantt";
import { PageHelpButton } from "@/components/help/page-help-button";

type ActivityWithAssignees = JobActivity & {
  assignees?: Array<{ id: string; activityId: string; userId: string }>;
};

const STATUS_OPTIONS = [
  { value: "NOT_STARTED", label: "Not Started", color: "bg-muted text-muted-foreground" },
  { value: "IN_PROGRESS", label: "In Progress", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "STUCK", label: "Stuck", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  { value: "DONE", label: "Done", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "ON_HOLD", label: "On Hold", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  { value: "SKIPPED", label: "Skipped", color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
];

function getStatusOption(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
}

function isOverdue(activity: ActivityWithAssignees): boolean {
  if (activity.status === "DONE" || activity.status === "SKIPPED") return false;
  if (!activity.endDate) return false;
  const today = startOfDay(new Date());
  const endDate = startOfDay(new Date(activity.endDate));
  return isBefore(endDate, today);
}

function getRowClassName(activity: ActivityWithAssignees): string {
  if (activity.status === "DONE") return "bg-green-50 dark:bg-green-950/20";
  if (isOverdue(activity)) return "bg-red-50 dark:bg-red-950/20";
  if (activity.status === "STUCK") return "bg-red-50/50 dark:bg-red-950/10";
  if (activity.status === "ON_HOLD") return "bg-yellow-50 dark:bg-yellow-950/20";
  if (activity.status === "IN_PROGRESS") return "bg-blue-50/50 dark:bg-blue-950/10";
  return "";
}

export default function JobActivitiesPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/jobs/:jobId/activities");
  const jobId = params?.jobId || "";

  const [searchTerm, setSearchTerm] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set());
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [selectedActivity, setSelectedActivity] = useState<ActivityWithAssignees | null>(null);
  const [showInstantiateDialog, setShowInstantiateDialog] = useState(false);
  const [selectedJobTypeId, setSelectedJobTypeId] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "gantt">("table");

  const { data: job } = useQuery<any>({
    queryKey: [`/api/admin/jobs/${jobId}`],
    enabled: !!jobId,
  });

  const { data: activities, isLoading: loadingActivities } = useQuery<ActivityWithAssignees[]>({
    queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_ACTIVITIES(jobId)],
    enabled: !!jobId,
  });

  const { data: stages } = useQuery<ActivityStage[]>({
    queryKey: [PROJECT_ACTIVITIES_ROUTES.STAGES],
  });

  const { data: jobTypesData } = useQuery<JobType[]>({
    queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_TYPES],
  });

  const { data: users } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: jobsList } = useQuery<any[]>({
    queryKey: ["/api/admin/jobs"],
  });

  const stageMap = useMemo(() => {
    const m = new Map<string, ActivityStage>();
    stages?.forEach(s => m.set(s.id, s));
    return m;
  }, [stages]);

  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    return activities.filter(a => {
      if (!a.parentId) {
        if (searchTerm && !a.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (phaseFilter !== "ALL" && a.jobPhase !== phaseFilter) return false;
        if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
        if (!showCompleted && a.status === "DONE") return false;
      }
      return true;
    });
  }, [activities, searchTerm, phaseFilter, statusFilter, showCompleted]);

  const parentActivities = useMemo(() => filteredActivities.filter(a => !a.parentId), [filteredActivities]);
  const childActivities = useMemo(() => {
    if (!activities) return new Map<string, ActivityWithAssignees[]>();
    const m = new Map<string, ActivityWithAssignees[]>();
    activities.filter(a => a.parentId).forEach(a => {
      if (!showCompleted && a.status === "DONE") return;
      const list = m.get(a.parentId!) || [];
      list.push(a);
      m.set(a.parentId!, list);
    });
    return m;
  }, [activities, showCompleted]);

  const activitiesByStage = useMemo(() => {
    const m = new Map<string, ActivityWithAssignees[]>();
    parentActivities.forEach(a => {
      const stageId = a.stageId || "ungrouped";
      const list = m.get(stageId) || [];
      list.push(a);
      m.set(stageId, list);
    });
    return m;
  }, [parentActivities]);

  const orderedStageIds = useMemo(() => {
    if (!stages) return Array.from(activitiesByStage.keys());
    const stageOrder = stages.map(s => s.id);
    const keys = Array.from(activitiesByStage.keys());
    return keys.sort((a, b) => {
      const ai = stageOrder.indexOf(a);
      const bi = stageOrder.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [stages, activitiesByStage]);

  const stageColorMap = useMemo(() => {
    const map = new Map<string, number>();
    if (stages) {
      stages.forEach((s, i) => map.set(s.id, i));
    }
    return map;
  }, [stages]);

  const instantiateMutation = useMutation({
    mutationFn: async (payload: { jobTypeId: string; startDate: string }) => {
      return apiRequest("POST", PROJECT_ACTIVITIES_ROUTES.JOB_ACTIVITIES_INSTANTIATE(jobId), payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_ACTIVITIES(jobId)] });
      toast({ title: "Activities loaded from workflow" });
      setShowInstantiateDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", PROJECT_ACTIVITIES_ROUTES.JOB_ACTIVITIES_RECALCULATE(jobId), {});
    },
    onSuccess: async (res: any) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_ACTIVITIES(jobId)] });
      toast({ title: "Dates recalculated", description: `${data.updated} activities updated` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: async ({ id, _recalculate, ...data }: any) => {
      const res = await apiRequest("PATCH", PROJECT_ACTIVITIES_ROUTES.ACTIVITY_BY_ID(id), data);
      return { res, _recalculate };
    },
    onSuccess: async ({ _recalculate }: any) => {
      await queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_ACTIVITIES(jobId)] });
      if (_recalculate) {
        recalculateMutation.mutate();
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  function toggleStageCollapse(stageId: string) {
    setCollapsedStages(prev => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  }

  function collapseAll() {
    setCollapsedStages(new Set(orderedStageIds));
  }

  function expandAll() {
    setCollapsedStages(new Set());
  }

  function expandAllActivities() {
    const ids = parentActivities.filter(a => (childActivities.get(a.id) || []).length > 0).map(a => a.id);
    setExpandedActivities(new Set(ids));
  }

  function collapseAllActivities() {
    setExpandedActivities(new Set());
  }

  function expandAllTasks() {
    setExpandedTasks(new Set(parentActivities.map(a => a.id)));
  }

  function collapseAllTasks() {
    setExpandedTasks(new Set());
  }

  function toggleActivityExpanded(activityId: string) {
    setExpandedActivities(prev => {
      const next = new Set(prev);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });
  }

  function toggleTasksExpanded(activityId: string) {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });
  }

  const uniquePhases = useMemo(() => {
    if (!activities) return [];
    const phases = new Set(activities.filter(a => a.jobPhase).map(a => a.jobPhase!));
    return Array.from(phases);
  }, [activities]);

  const hasActivities = activities && activities.length > 0;

  const allParentActivities = useMemo(() => (activities || []).filter(a => !a.parentId), [activities]);
  const totalActivities = allParentActivities.length;
  const doneCount = allParentActivities.filter(a => a.status === "DONE").length;
  const overdueCount = allParentActivities.filter(a => isOverdue(a)).length;
  const progressPct = totalActivities > 0 ? Math.round((doneCount / totalActivities) * 100) : 0;

  if (loadingActivities) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/tasks")} data-testid="button-back-to-tasks">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
                Project Activities
              </h1>
              <PageHelpButton pageHelpKey="page.job-activities" />
            </div>
            <p className="text-muted-foreground">
              {job ? `${job.jobNumber || ""} - ${job.name || ""}` : "Loading job..."}
              {hasActivities && ` | ${doneCount}/${totalActivities} complete (${progressPct}%)`}
              {overdueCount > 0 && (
                <span className="text-red-500 ml-2">
                  | {overdueCount} overdue
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {!hasActivities ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Activities Yet</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Load activities from a job type workflow to get started. Select the appropriate job type and all its activities will be created for this job.
            </p>
            <Button onClick={() => setShowInstantiateDialog(true)} data-testid="button-load-workflow">
              <Download className="h-4 w-4 mr-2" />
              Load from Workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-activities"
              />
            </div>

            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-phase-filter">
                <SelectValue placeholder="Phase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Phases</SelectItem>
                {uniquePhases.map(p => (
                  <SelectItem key={p} value={p}>{p.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {viewMode === "table" && (
              <>
                <Button variant="outline" size="sm" onClick={collapseAll} data-testid="button-collapse-all">
                  <ChevronsDownUp className="h-4 w-4 mr-1" />
                  Collapse All
                </Button>
                <Button variant="outline" size="sm" onClick={expandAll} data-testid="button-expand-all">
                  <ChevronsUpDown className="h-4 w-4 mr-1" />
                  Expand All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={expandedActivities.size > 0 ? collapseAllActivities : expandAllActivities}
                  data-testid="button-expand-activities"
                >
                  <ChevronDown className="h-4 w-4 mr-1" />
                  {expandedActivities.size > 0 ? "Collapse" : "Expand"} Activities
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={expandedTasks.size > 0 ? collapseAllTasks : expandAllTasks}
                  data-testid="button-expand-tasks"
                >
                  <ListChecks className="h-4 w-4 mr-1" />
                  {expandedTasks.size > 0 ? "Collapse" : "Expand"} Tasks
                </Button>
              </>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => recalculateMutation.mutate()}
              disabled={recalculateMutation.isPending}
              data-testid="button-recalculate-dates"
            >
              {recalculateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Recalculate Dates
            </Button>

            <Button
              variant={showCompleted ? "default" : "outline"}
              size="sm"
              onClick={() => setShowCompleted(!showCompleted)}
              data-testid="button-show-done"
            >
              {showCompleted ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
              Show Done
            </Button>

            <div className="flex items-center border rounded-md overflow-visible">
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                className="rounded-r-none gap-1"
                onClick={() => setViewMode("table")}
                data-testid="button-view-table"
              >
                <TableProperties className="h-4 w-4" />
                Table
              </Button>
              <Button
                variant={viewMode === "gantt" ? "default" : "ghost"}
                size="sm"
                className="rounded-l-none gap-1"
                onClick={() => setViewMode("gantt")}
                data-testid="button-view-gantt"
              >
                <BarChart3 className="h-4 w-4" />
                Gantt
              </Button>
            </div>
          </div>

          {hasActivities && (
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}

          {viewMode === "gantt" ? (
            <GanttChart
              activities={filteredActivities}
              stages={stages || []}
              stageColorMap={stageColorMap}
              onSelectActivity={setSelectedActivity}
            />
          ) : (
            <div className="space-y-3">
              {orderedStageIds.map((stageId) => {
                const stage = stageMap.get(stageId);
                const stageActivities = activitiesByStage.get(stageId) || [];
                const isCollapsed = collapsedStages.has(stageId);
                const stageDone = stageActivities.filter(a => a.status === "DONE").length;
                const stageOverdue = stageActivities.filter(a => isOverdue(a)).length;
                const colorIndex = stageColorMap.get(stageId) ?? 0;
                const colors = getStageColor(colorIndex);

                return (
                  <Card key={stageId} className="overflow-visible">
                    <div
                      className={`flex items-center justify-between gap-4 px-4 py-3 cursor-pointer ${colors.bg} rounded-t-md`}
                      onClick={() => toggleStageCollapse(stageId)}
                      data-testid={`stage-header-${stageId}`}
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {stage && <span className={`font-mono text-sm font-bold px-2 py-0.5 rounded ${colors.badge}`}>{stage.stageNumber}</span>}
                        <span className={`font-semibold ${colors.text}`}>{stage?.name || "Other"}</span>
                        <Badge variant="secondary">{stageDone}/{stageActivities.length}</Badge>
                        {stageOverdue > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {stageOverdue} overdue
                          </Badge>
                        )}
                      </div>
                    </div>

                    {!isCollapsed && (
                      <CardContent className="pt-0 pb-2 px-2">
                        <div className="border rounded-md overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-muted/50 text-left">
                                <th className="px-3 py-2 font-medium">Activity</th>
                                <th className="px-3 py-2 font-medium w-[100px]">Category</th>
                                <th className="px-3 py-2 font-medium w-[120px]">Status</th>
                                <th className="px-3 py-2 font-medium w-[80px]">Days</th>
                                <th className="px-3 py-2 font-medium w-[80px]">Pred</th>
                                <th className="px-3 py-2 font-medium w-[60px]">Rel</th>
                                <th className="px-3 py-2 font-medium w-[140px]">Consultant</th>
                                <th className="px-3 py-2 font-medium w-[120px]">Start Date</th>
                                <th className="px-3 py-2 font-medium w-[120px]">End Date</th>
                                <th className="px-3 py-2 font-medium w-[140px]">Deliverable</th>
                              </tr>
                            </thead>
                            <tbody>
                              {stageActivities.map((activity) => {
                                const children = childActivities.get(activity.id) || [];
                                return (
                                  <ActivityRow
                                    key={activity.id}
                                    activity={activity}
                                    children={children}
                                    allParentActivities={allParentActivities}
                                    onSelect={setSelectedActivity}
                                    onStatusChange={(id, status) => {
                                      updateActivityMutation.mutate({ id, status });
                                    }}
                                    onFieldChange={(id, data, recalculate) => {
                                      updateActivityMutation.mutate({ id, ...data, _recalculate: recalculate });
                                    }}
                                    users={users || []}
                                    jobs={jobsList || []}
                                    jobId={jobId}
                                    expanded={expandedActivities.has(activity.id)}
                                    tasksExpanded={expandedTasks.has(activity.id)}
                                    onToggleExpanded={() => toggleActivityExpanded(activity.id)}
                                    onToggleTasksExpanded={() => toggleTasksExpanded(activity.id)}
                                  />
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <InstantiateDialog
        open={showInstantiateDialog}
        onOpenChange={(open) => { if (!open) setShowInstantiateDialog(false); }}
        jobTypesData={jobTypesData || []}
        job={job}
        selectedJobTypeId={selectedJobTypeId}
        setSelectedJobTypeId={setSelectedJobTypeId}
        onConfirm={(jobTypeId, startDate) => instantiateMutation.mutate({ jobTypeId, startDate })}
        isPending={instantiateMutation.isPending}
      />

      <ActivitySidebar
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
        jobId={jobId}
        users={users || []}
        allParentActivities={allParentActivities}
      />
    </div>
  );
}

function ActivityRow({
  activity,
  children,
  allParentActivities,
  onSelect,
  onStatusChange,
  onFieldChange,
  users,
  jobs,
  jobId,
  expanded,
  tasksExpanded,
  onToggleExpanded,
  onToggleTasksExpanded,
}: {
  activity: ActivityWithAssignees;
  children: ActivityWithAssignees[];
  allParentActivities: ActivityWithAssignees[];
  onSelect: (a: ActivityWithAssignees) => void;
  onStatusChange: (id: string, status: string) => void;
  onFieldChange: (id: string, data: Record<string, any>, recalculate: boolean) => void;
  users: any[];
  jobs: any[];
  jobId: string;
  expanded: boolean;
  tasksExpanded: boolean;
  onToggleExpanded: () => void;
  onToggleTasksExpanded: () => void;
}) {
  const statusOpt = getStatusOption(activity.status);
  const overdue = isOverdue(activity);
  const rowBg = getRowClassName(activity);

  return (
    <>
      <tr
        className={`border-t cursor-pointer group ${rowBg}`}
        onClick={() => onSelect(activity)}
        data-testid={`activity-row-${activity.id}`}
      >
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            {children.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleExpanded(); }}
                className="p-0.5"
                data-testid={`button-expand-${activity.id}`}
              >
                {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
            )}
            <span className="font-medium" data-testid={`text-activity-name-${activity.id}`}>{activity.name}</span>
            {overdue && (
              <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleTasksExpanded(); }}
              className={cn(
                "p-0.5 rounded transition-colors",
                tasksExpanded ? "text-primary" : "text-muted-foreground opacity-0 group-hover:opacity-100",
              )}
              style={{ opacity: tasksExpanded ? 1 : undefined }}
              data-testid={`button-tasks-${activity.id}`}
            >
              <ListChecks className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
        <td className="px-3 py-2 text-muted-foreground text-xs">{activity.category || "-"}</td>
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusOpt.color}`}>
            {statusOpt.label}
          </span>
        </td>
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <Input
            type="number"
            className="h-7 text-xs w-[70px] text-center"
            defaultValue={activity.estimatedDays ?? ""}
            key={`days-${activity.id}-${activity.estimatedDays}`}
            min={1}
            onBlur={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val) && val > 0 && val !== activity.estimatedDays) {
                onFieldChange(activity.id, { estimatedDays: val }, true);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.target as HTMLInputElement).blur();
              }
            }}
            data-testid={`input-days-${activity.id}`}
          />
        </td>
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <Select
            value={activity.predecessorSortOrder != null ? String(activity.predecessorSortOrder) : "none"}
            onValueChange={(v) => {
              const predOrder = v === "none" ? null : parseInt(v);
              const rel = predOrder != null ? (activity.relationship || "FS") : null;
              onFieldChange(activity.id, { predecessorSortOrder: predOrder, relationship: rel }, true);
            }}
          >
            <SelectTrigger className="h-7 text-xs w-[70px]" data-testid={`select-pred-${activity.id}`}>
              <SelectValue placeholder="-" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-</SelectItem>
              {allParentActivities
                .filter(a => a.sortOrder < activity.sortOrder)
                .map(a => (
                  <SelectItem key={a.id} value={String(a.sortOrder)}>
                    {a.sortOrder + 1}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </td>
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <Select
            value={activity.relationship || "FS"}
            onValueChange={(v) => {
              onFieldChange(activity.id, { relationship: v }, true);
            }}
            disabled={activity.predecessorSortOrder == null}
          >
            <SelectTrigger className="h-7 text-xs w-[60px]" data-testid={`select-rel-${activity.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FS">FS</SelectItem>
              <SelectItem value="SS">SS</SelectItem>
              <SelectItem value="FF">FF</SelectItem>
              <SelectItem value="SF">SF</SelectItem>
            </SelectContent>
          </Select>
        </td>
        <td className="px-3 py-2 text-muted-foreground text-xs truncate max-w-[140px]">{activity.consultantName || "-"}</td>
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <Input
            type="date"
            className="h-7 text-xs w-[120px]"
            value={activity.startDate ? format(new Date(activity.startDate), "yyyy-MM-dd") : ""}
            onChange={(e) => onFieldChange(activity.id, { startDate: e.target.value || null }, true)}
            data-testid={`input-start-date-${activity.id}`}
          />
        </td>
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <Input
            type="date"
            className={`h-7 text-xs w-[120px] ${overdue ? "border-red-500 text-red-600 dark:text-red-400" : ""}`}
            value={activity.endDate ? format(new Date(activity.endDate), "yyyy-MM-dd") : ""}
            onChange={(e) => onFieldChange(activity.id, { endDate: e.target.value || null }, false)}
            data-testid={`input-end-date-${activity.id}`}
          />
        </td>
        <td className="px-3 py-2 text-muted-foreground text-xs truncate max-w-[140px]">{activity.deliverable || "-"}</td>
      </tr>

      {tasksExpanded && (
        <tr data-testid={`activity-tasks-row-${activity.id}`}>
          <td colSpan={10} className="px-4 py-2 bg-muted/30">
            <ActivityTasksPanel
              activityId={activity.id}
              jobId={jobId}
              activityStartDate={activity.startDate ? String(activity.startDate) : null}
              activityEndDate={activity.endDate ? String(activity.endDate) : null}
              users={users}
              jobs={jobs}
            />
          </td>
        </tr>
      )}

      {expanded && children.map(child => {
        const childOverdue = isOverdue(child);
        const childRowBg = getRowClassName(child);
        const childStatus = getStatusOption(child.status);
        return (
          <tr
            key={child.id}
            className={`border-t cursor-pointer ${childRowBg || "bg-muted/30"}`}
            onClick={() => onSelect(child)}
            data-testid={`activity-row-child-${child.id}`}
          >
            <td className="px-3 py-1.5 pl-10">
              <div className="flex items-center gap-2">
                <span className="text-sm">{child.name}</span>
                {childOverdue && <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />}
              </div>
            </td>
            <td className="px-3 py-1.5 text-muted-foreground text-xs">{child.category || "-"}</td>
            <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${childStatus.color}`}>
                {childStatus.label}
              </span>
            </td>
            <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
              <Input
                type="number"
                className="h-6 text-xs w-[70px] text-center"
                defaultValue={child.estimatedDays ?? ""}
                key={`days-${child.id}-${child.estimatedDays}`}
                min={1}
                onBlur={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val > 0 && val !== child.estimatedDays) {
                    onFieldChange(child.id, { estimatedDays: val }, false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
              />
            </td>
            <td className="px-3 py-1.5 text-center text-xs text-muted-foreground">-</td>
            <td className="px-3 py-1.5 text-center text-xs text-muted-foreground">-</td>
            <td className="px-3 py-1.5 text-muted-foreground text-xs">{child.consultantName || "-"}</td>
            <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
              <Input
                type="date"
                className="h-6 text-xs w-[120px]"
                value={child.startDate ? format(new Date(child.startDate), "yyyy-MM-dd") : ""}
                onChange={(e) => onFieldChange(child.id, { startDate: e.target.value || null }, false)}
              />
            </td>
            <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
              <Input
                type="date"
                className={`h-6 text-xs w-[120px] ${childOverdue ? "border-red-500 text-red-600 dark:text-red-400" : ""}`}
                value={child.endDate ? format(new Date(child.endDate), "yyyy-MM-dd") : ""}
                onChange={(e) => onFieldChange(child.id, { endDate: e.target.value || null }, false)}
              />
            </td>
            <td className="px-3 py-1.5 text-muted-foreground text-xs">{child.deliverable || "-"}</td>
          </tr>
        );
      })}
    </>
  );
}

function InstantiateDialog({
  open,
  onOpenChange,
  jobTypesData,
  job,
  selectedJobTypeId,
  setSelectedJobTypeId,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobTypesData: JobType[];
  job: any;
  selectedJobTypeId: string;
  setSelectedJobTypeId: (id: string) => void;
  onConfirm: (jobTypeId: string, startDate: string) => void;
  isPending: boolean;
}) {
  const [dateSource, setDateSource] = useState<"job" | "custom">("job");
  const [customStartDate, setCustomStartDate] = useState("");

  const jobStartDate = job?.estimatedStartDate
    ? format(new Date(job.estimatedStartDate), "yyyy-MM-dd")
    : job?.productionStartDate
      ? format(new Date(job.productionStartDate), "yyyy-MM-dd")
      : "";

  const effectiveStartDate = dateSource === "job" ? jobStartDate : customStartDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Load Activities from Workflow</DialogTitle>
          <DialogDescription>
            Select a job type and project start date. Activities will be scheduled sequentially (finish-to-start) based on their estimated durations.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Job Type</Label>
            <Select value={selectedJobTypeId} onValueChange={setSelectedJobTypeId}>
              <SelectTrigger data-testid="select-job-type-instantiate">
                <SelectValue placeholder="Select a job type" />
              </SelectTrigger>
              <SelectContent>
                {jobTypesData?.filter(jt => jt.isActive).map(jt => (
                  <SelectItem key={jt.id} value={jt.id}>{jt.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Project Start Date</Label>
            <RadioGroup
              value={dateSource}
              onValueChange={(v) => setDateSource(v as "job" | "custom")}
              className="space-y-2"
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="job" id="date-job" data-testid="radio-date-job" />
                <Label htmlFor="date-job" className="font-normal cursor-pointer">
                  Use job start date
                  {jobStartDate ? (
                    <span className="ml-2 text-muted-foreground">({format(new Date(jobStartDate), "dd MMM yyyy")})</span>
                  ) : (
                    <span className="ml-2 text-destructive text-xs">(No start date set on job)</span>
                  )}
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="custom" id="date-custom" data-testid="radio-date-custom" />
                <Label htmlFor="date-custom" className="font-normal cursor-pointer">
                  Use a different date
                </Label>
              </div>
            </RadioGroup>

            {dateSource === "custom" && (
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                data-testid="input-custom-start-date"
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => selectedJobTypeId && effectiveStartDate && onConfirm(selectedJobTypeId, effectiveStartDate)}
            disabled={!selectedJobTypeId || !effectiveStartDate || isPending}
            data-testid="button-confirm-instantiate"
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Load Activities
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActivitySidebar({
  activity,
  onClose,
  jobId,
  users,
  allParentActivities,
}: {
  activity: ActivityWithAssignees | null;
  onClose: () => void;
  jobId: string;
  users: any[];
  allParentActivities: ActivityWithAssignees[];
}) {
  const { toast } = useToast();
  const [commentText, setCommentText] = useState("");
  const [activeTab, setActiveTab] = useState("details");

  const { data: updates, isLoading: loadingUpdates } = useQuery<any[]>({
    queryKey: [activity ? PROJECT_ACTIVITIES_ROUTES.ACTIVITY_UPDATES(activity.id) : ""],
    enabled: !!activity,
  });

  const { data: files, isLoading: loadingFiles } = useQuery<any[]>({
    queryKey: [activity ? PROJECT_ACTIVITIES_ROUTES.ACTIVITY_FILES(activity.id) : ""],
    enabled: !!activity,
  });

  const postUpdateMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", PROJECT_ACTIVITIES_ROUTES.ACTIVITY_UPDATES(activity!.id), { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.ACTIVITY_UPDATES(activity!.id)] });
      setCommentText("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(PROJECT_ACTIVITIES_ROUTES.ACTIVITY_FILES(activity!.id), {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to upload file");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.ACTIVITY_FILES(activity!.id)] });
      toast({ title: "File uploaded" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", PROJECT_ACTIVITIES_ROUTES.JOB_ACTIVITIES_RECALCULATE(jobId), {});
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_ACTIVITIES(jobId)] });
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: async ({ id, _recalculate, ...data }: any) => {
      const res = await apiRequest("PATCH", PROJECT_ACTIVITIES_ROUTES.ACTIVITY_BY_ID(id), data);
      return { res, _recalculate };
    },
    onSuccess: async ({ _recalculate }: any) => {
      await queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_ACTIVITIES(jobId)] });
      if (_recalculate) {
        recalculateMutation.mutate();
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  function getUserName(userId: string) {
    const user = users?.find(u => u.id === userId);
    return user?.name || user?.email || "Unknown";
  }

  function getUserInitials(userId: string) {
    const name = getUserName(userId);
    return name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  }

  if (!activity) return null;

  return (
    <Sheet open={!!activity} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle data-testid="text-sidebar-activity-name">{activity.name}</SheetTitle>
          <SheetDescription>
            {activity.category && <Badge variant="outline" className="mr-2">{activity.category}</Badge>}
            {activity.jobPhase && <Badge variant="secondary">{activity.jobPhase}</Badge>}
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="details" className="flex-1" data-testid="tab-details">Details</TabsTrigger>
            <TabsTrigger value="chat" className="flex-1" data-testid="tab-chat">
              Chat {updates && updates.length > 0 && <Badge variant="secondary" className="ml-1">{updates.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="files" className="flex-1" data-testid="tab-files">
              Files {files && files.length > 0 && <Badge variant="secondary" className="ml-1">{files.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4 space-y-4">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Status</Label>
                <Select
                  value={activity.status}
                  onValueChange={(v) => updateActivityMutation.mutate({ id: activity.id, status: v })}
                >
                  <SelectTrigger data-testid="sidebar-select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Start Date</Label>
                  <Input
                    type="date"
                    value={activity.startDate ? format(new Date(activity.startDate), "yyyy-MM-dd") : ""}
                    onChange={(e) => updateActivityMutation.mutate({ id: activity.id, startDate: e.target.value || null, _recalculate: true })}
                    data-testid="sidebar-input-start-date"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">End Date</Label>
                  <Input
                    type="date"
                    value={activity.endDate ? format(new Date(activity.endDate), "yyyy-MM-dd") : ""}
                    onChange={(e) => updateActivityMutation.mutate({ id: activity.id, endDate: e.target.value || null })}
                    data-testid="sidebar-input-end-date"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Reminder Date</Label>
                <Input
                  type="date"
                  value={activity.reminderDate ? format(new Date(activity.reminderDate), "yyyy-MM-dd") : ""}
                  onChange={(e) => updateActivityMutation.mutate({ id: activity.id, reminderDate: e.target.value || null })}
                  data-testid="sidebar-input-reminder"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Estimated Days</Label>
                <div className="flex items-center gap-1 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {activity.estimatedDays || "-"} days
                </div>
              </div>

              {!activity.parentId && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Predecessor</Label>
                    <Select
                      value={activity.predecessorSortOrder != null ? String(activity.predecessorSortOrder) : "none"}
                      onValueChange={(v) => {
                        const predOrder = v === "none" ? null : parseInt(v);
                        const rel = predOrder != null ? (activity.relationship || "FS") : null;
                        updateActivityMutation.mutate({ id: activity.id, predecessorSortOrder: predOrder, relationship: rel, _recalculate: true });
                      }}
                    >
                      <SelectTrigger data-testid="sidebar-select-predecessor">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {allParentActivities
                          .filter(a => a.sortOrder < activity.sortOrder)
                          .map(a => (
                            <SelectItem key={a.id} value={String(a.sortOrder)}>
                              {a.sortOrder + 1}. {a.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Relationship</Label>
                    <Select
                      value={activity.relationship || "FS"}
                      onValueChange={(v) => {
                        updateActivityMutation.mutate({ id: activity.id, relationship: v, _recalculate: true });
                      }}
                      disabled={activity.predecessorSortOrder == null}
                    >
                      <SelectTrigger data-testid="sidebar-select-relationship">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FS">FS (Finish-to-Start)</SelectItem>
                        <SelectItem value="SS">SS (Start-to-Start)</SelectItem>
                        <SelectItem value="FF">FF (Finish-to-Finish)</SelectItem>
                        <SelectItem value="SF">SF (Start-to-Finish)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Consultant</Label>
                <div className="flex items-center gap-1 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  {activity.consultantName || "-"}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Deliverable</Label>
                <div className="flex items-center gap-1 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {activity.deliverable || "-"}
                </div>
              </div>

              {activity.notes && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Notes</Label>
                  <p className="text-sm">{activity.notes}</p>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Notes</Label>
                <Textarea
                  value={activity.notes || ""}
                  onChange={(e) => updateActivityMutation.mutate({ id: activity.id, notes: e.target.value })}
                  placeholder="Add notes..."
                  className="text-sm"
                  data-testid="sidebar-textarea-notes"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="chat" className="mt-4">
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-3">
                {loadingUpdates ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : updates && updates.length > 0 ? (
                  updates.map((update: any) => (
                    <div key={update.id} className="flex gap-2" data-testid={`update-${update.id}`}>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">{getUserInitials(update.userId)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{getUserName(update.userId)}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(update.createdAt), "dd MMM yyyy HH:mm")}
                          </span>
                        </div>
                        <p className="text-sm mt-0.5">{update.content}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground text-sm py-8">No comments yet</p>
                )}
              </div>
            </ScrollArea>

            <div className="flex gap-2 mt-3">
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && commentText.trim()) {
                    e.preventDefault();
                    postUpdateMutation.mutate(commentText.trim());
                  }
                }}
                data-testid="input-comment"
              />
              <Button
                size="icon"
                onClick={() => commentText.trim() && postUpdateMutation.mutate(commentText.trim())}
                disabled={!commentText.trim() || postUpdateMutation.isPending}
                data-testid="button-send-comment"
              >
                {postUpdateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="files" className="mt-4">
            <div className="space-y-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) uploadFileMutation.mutate(file);
                  };
                  input.click();
                }}
                disabled={uploadFileMutation.isPending}
                data-testid="button-upload-file"
              >
                {uploadFileMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Paperclip className="h-4 w-4 mr-2" />}
                Upload File
              </Button>

              {loadingFiles ? (
                <Skeleton className="h-20 w-full" />
              ) : files && files.length > 0 ? (
                <div className="space-y-2">
                  {files.map((file: any) => (
                    <div key={file.id} className="flex items-center justify-between gap-2 p-2 border rounded" data-testid={`file-${file.id}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline truncate block">
                            {file.fileName}
                          </a>
                          <span className="text-xs text-muted-foreground">
                            {file.fileSize ? `${(file.fileSize / 1024).toFixed(1)} KB` : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground text-sm py-8">No files attached</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
