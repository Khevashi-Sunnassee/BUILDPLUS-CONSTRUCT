import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, ChevronDown, ChevronRight, FileText,
  Loader2, Search, ChevronsDownUp, ChevronsUpDown, Download, AlertTriangle,
  ListChecks, BarChart3, TableProperties, Eye, EyeOff,
  RefreshCw, Link2, Printer,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PROJECT_ACTIVITIES_ROUTES, SETTINGS_ROUTES } from "@shared/api-routes";
import type { ActivityStage, JobType } from "@shared/schema";

import { getStageColor } from "@/lib/stage-colors";
import { ErrorBoundary } from "@/components/error-boundary";
import { GanttChart } from "@/pages/job-activities-gantt";
import { ProgressFlowChart } from "@/pages/job-activities-progress";
import { PageHelpButton } from "@/components/help/page-help-button";
import { exportActivitiesToPDF } from "@/lib/activities-pdf-exporter";
import { ActivityRow } from "@/pages/job-activities/ActivityRow";
import { ActivitySidebar } from "@/pages/job-activities/ActivitySidebar";
import { InstantiateDialog } from "@/pages/job-activities/InstantiateDialog";
import {
  type ActivityWithAssignees,
  STATUS_OPTIONS,
  isOverdue,
} from "@/lib/activity-constants";

function JobActivitiesContent() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
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
  const [viewMode, setViewMode] = useState<"table" | "gantt" | "progress">("table");
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printIncludeTasks, setPrintIncludeTasks] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const printButtonRef = useRef<HTMLButtonElement>(null);

  const { data: job } = useQuery<Record<string, unknown>>({
    queryKey: [`/api/admin/jobs/${jobId}`],
    enabled: !!jobId,
  });

  const { data: brandingSettings } = useQuery<{ logoBase64: string | null; userLogoBase64: string | null; companyName: string }>({
    queryKey: [SETTINGS_ROUTES.LOGO],
  });
  const reportLogo = brandingSettings?.userLogoBase64 || brandingSettings?.logoBase64 || null;
  const companyName = brandingSettings?.companyName || "BuildPlus Ai";

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

  const { data: users } = useQuery<Record<string, unknown>[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: jobsList } = useQuery<Record<string, unknown>[]>({
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
    onSuccess: async (res: Response) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_ACTIVITIES(jobId)] });
      toast({ title: "Dates recalculated", description: `${data.updated} activities updated` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const syncPredecessorsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", PROJECT_ACTIVITIES_ROUTES.JOB_ACTIVITIES_SYNC_PREDECESSORS(jobId), {});
    },
    onSuccess: async (res: Response) => {
      const data = await res.json();
      await queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_ACTIVITIES(jobId)] });
      toast({ title: "Predecessors synced", description: `${data.synced} of ${data.total} activities updated from template` });
      recalculateMutation.mutate();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: async ({ id, _recalculate, ...data }: Record<string, unknown> & { id: string; _recalculate?: boolean }) => {
      const res = await apiRequest("PATCH", PROJECT_ACTIVITIES_ROUTES.ACTIVITY_BY_ID(id), data);
      return { res, _recalculate };
    },
    onSuccess: async ({ _recalculate }: { res: Response; _recalculate?: boolean }) => {
      await queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_ACTIVITIES(jobId)] });
      if (_recalculate) {
        recalculateMutation.mutate();
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleStageCollapse = useCallback((stageId: string) => {
    setCollapsedStages(prev => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setCollapsedStages(new Set(orderedStageIds));
  }, [orderedStageIds]);

  const expandAll = useCallback(() => {
    setCollapsedStages(new Set());
  }, []);

  const expandAllActivities = useCallback(() => {
    const ids = parentActivities.filter(a => (childActivities.get(a.id) || []).length > 0).map(a => a.id);
    setExpandedActivities(new Set(ids));
  }, [parentActivities, childActivities]);

  const collapseAllActivities = useCallback(() => {
    setExpandedActivities(new Set());
  }, []);

  const expandAllTasks = useCallback(() => {
    setExpandedTasks(new Set(parentActivities.map(a => a.id)));
  }, [parentActivities]);

  const collapseAllTasks = useCallback(() => {
    setExpandedTasks(new Set());
  }, []);

  const toggleActivityExpanded = useCallback((activityId: string) => {
    setExpandedActivities(prev => {
      const next = new Set(prev);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });
  }, []);

  const toggleTasksExpanded = useCallback((activityId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });
  }, []);

  const uniquePhases = useMemo(() => {
    if (!activities) return [];
    const phases = new Set(activities.filter(a => a.jobPhase).map(a => a.jobPhase!));
    return Array.from(phases);
  }, [activities]);

  const hasActivities = activities && activities.length > 0;

  const allParentActivities = useMemo(() => (activities || []).filter(a => !a.parentId), [activities]);

  const selectedActivityIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedActivity) {
      selectedActivityIdRef.current = selectedActivity.id;
    }
  }, [selectedActivity]);

  useEffect(() => {
    if (!selectedActivityIdRef.current || !activities) return;
    const freshData = activities.find(a => a.id === selectedActivityIdRef.current);
    if (freshData && selectedActivity) {
      const changed = freshData.status !== selectedActivity.status
        || freshData.startDate !== selectedActivity.startDate
        || freshData.endDate !== selectedActivity.endDate
        || freshData.reminderDate !== selectedActivity.reminderDate
        || freshData.notes !== selectedActivity.notes
        || freshData.predecessorSortOrder !== selectedActivity.predecessorSortOrder
        || freshData.relationship !== selectedActivity.relationship
        || freshData.estimatedDays !== selectedActivity.estimatedDays;
      if (changed) {
        setSelectedActivity(freshData);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities]);

  const { totalActivities, doneCount, overdueCount, progressPct } = useMemo(() => {
    const total = allParentActivities.length;
    const done = allParentActivities.filter(a => a.status === "DONE").length;
    const overdue = allParentActivities.filter(a => isOverdue(a)).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { totalActivities: total, doneCount: done, overdueCount: overdue, progressPct: pct };
  }, [allParentActivities]);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await exportActivitiesToPDF({
        activities: filteredActivities,
        activitiesByStage,
        orderedStageIds,
        stageMap,
        users: users || [],
        job,
        reportLogo,
        companyName,
        printIncludeTasks,
        jobId,
      });
      toast({ title: "PDF exported successfully" });
      setShowPrintDialog(false);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to generate PDF" });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintDialogKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setShowPrintDialog(false);
      printButtonRef.current?.focus();
    }
  }, []);

  if (loadingActivities) {
    return (
      <div className="p-4 md:p-6 space-y-4 h-full overflow-auto" role="main" aria-label="Job Activities" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 h-full overflow-auto" role="main" aria-label="Job Activities">
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
            <p className="text-muted-foreground" aria-live="polite">
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
            <FileText className="h-12 w-12 text-muted-foreground mb-4" aria-hidden="true" />
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-activities"
                aria-label="Search activities"
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
              onClick={() => syncPredecessorsMutation.mutate()}
              disabled={syncPredecessorsMutation.isPending}
              data-testid="button-sync-predecessors"
            >
              {syncPredecessorsMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
              Sync Predecessors
            </Button>

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

            <Button
              ref={printButtonRef}
              variant="outline"
              size="sm"
              onClick={() => setShowPrintDialog(true)}
              disabled={!hasActivities}
              data-testid="button-print-activities"
            >
              <Printer className="h-4 w-4 mr-1" />
              Print
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
                className="rounded-none gap-1"
                onClick={() => setViewMode("gantt")}
                data-testid="button-view-gantt"
              >
                <BarChart3 className="h-4 w-4" />
                Gantt
              </Button>
              <Button
                variant={viewMode === "progress" ? "default" : "ghost"}
                size="sm"
                className="rounded-l-none gap-1"
                onClick={() => setViewMode("progress")}
                data-testid="button-view-progress"
              >
                <ListChecks className="h-4 w-4" />
                Progress
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
              jobTitle={job ? `${job.jobNumber || ""} - ${job.name || ""}` : "Project Activities"}
            />
          ) : viewMode === "progress" ? (
            <ProgressFlowChart
              activities={filteredActivities}
              stages={stages || []}
              stageColorMap={stageColorMap}
              onSelectActivity={setSelectedActivity}
              jobTitle={job ? `${job.jobNumber || ""} - ${job.name || ""}` : "Project Activities"}
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
                                <th className="px-3 py-2 font-medium w-[40px]">#</th>
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
                                    currentUserId={currentUser?.id}
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

      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="sm:max-w-md" onKeyDown={handlePrintDialogKeyDown}>
          <DialogHeader>
            <DialogTitle>Print Project Activities</DialogTitle>
            <DialogDescription>
              Export activities for {job?.jobNumber} - {job?.name} as PDF
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="include-tasks"
                checked={printIncludeTasks}
                onCheckedChange={(checked) => setPrintIncludeTasks(checked === true)}
                data-testid="checkbox-include-tasks"
              />
              <label htmlFor="include-tasks" className="text-sm cursor-pointer">
                Include tasks with activities
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-2 ml-7">
              When enabled, tasks assigned to each activity will be printed below their parent activity
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPrintDialog(false)} data-testid="button-cancel-print">
              Cancel
            </Button>
            <Button onClick={handleExportPDF} disabled={isExporting} data-testid="button-confirm-print">
              {isExporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Printer className="h-4 w-4 mr-1" />}
              {isExporting ? "Generating..." : "Print PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

export default function JobActivitiesPage() {
  return (
    <ErrorBoundary name="job-activities">
      <JobActivitiesContent />
    </ErrorBoundary>
  );
}
