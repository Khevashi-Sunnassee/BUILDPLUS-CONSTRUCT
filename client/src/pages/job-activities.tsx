import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { dateInputProps } from "@/lib/validation";
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
  RefreshCw, Link2, Printer, ClipboardCheck,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { PROJECT_ACTIVITIES_ROUTES, SETTINGS_ROUTES } from "@shared/api-routes";
import type { JobType, ActivityStage, JobActivity } from "@shared/schema";
import { format, isAfter, isBefore, startOfDay } from "date-fns";

import { getStageColor } from "@/lib/stage-colors";
import { ActivityTasksPanel } from "@/pages/tasks/ActivityTasksPanel";
import { GanttChart } from "@/pages/job-activities-gantt";
import { ProgressFlowChart } from "@/pages/job-activities-progress";
import { PageHelpButton } from "@/components/help/page-help-button";

type ActivityWithAssignees = JobActivity & {
  assignees?: Array<{ id: string; activityId: string; userId: string }>;
  checklistTotal?: number;
  checklistCompleted?: number;
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

function isDatePast(date: string | Date | null | undefined, status: string): boolean {
  if (status === "DONE" || status === "SKIPPED") return false;
  if (!date) return false;
  const today = startOfDay(new Date());
  const d = startOfDay(new Date(date));
  return isBefore(d, today);
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

  const { data: job } = useQuery<any>({
    queryKey: [`/api/admin/jobs/${jobId}`],
    enabled: !!jobId,
  });

  const { data: brandingSettings } = useQuery<{ logoBase64: string | null; companyName: string }>({
    queryKey: [SETTINGS_ROUTES.LOGO],
  });
  const reportLogo = brandingSettings?.logoBase64 || null;
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

  const syncPredecessorsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", PROJECT_ACTIVITIES_ROUTES.JOB_ACTIVITIES_SYNC_PREDECESSORS(jobId), {});
    },
    onSuccess: async (res: any) => {
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

  useEffect(() => {
    if (selectedActivity && activities) {
      const freshData = activities.find(a => a.id === selectedActivity.id);
      if (freshData) {
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
    }
  }, [activities]);

  const totalActivities = allParentActivities.length;
  const doneCount = allParentActivities.filter(a => a.status === "DONE").length;
  const overdueCount = allParentActivities.filter(a => isOverdue(a)).length;
  const progressPct = totalActivities > 0 ? Math.round((doneCount / totalActivities) * 100) : 0;

  const exportActivitiesToPDF = async () => {
    setIsExporting(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let currentY = margin;

      const logoHeight = 20;
      let headerTextX = margin;

      try {
        if (reportLogo) {
          const img = document.createElement("img");
          img.src = reportLogo;
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
          if (img.naturalWidth && img.naturalHeight) {
            const aspectRatio = img.naturalWidth / img.naturalHeight;
            const lw = Math.min(25, logoHeight * aspectRatio);
            const lh = lw / aspectRatio;
            pdf.addImage(reportLogo, "PNG", margin, margin - 5, lw, lh, undefined, "FAST");
            headerTextX = margin + 30;
          }
        }
      } catch (_e) {}

      pdf.setTextColor(31, 41, 55);
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(companyName || "BuildPlus Ai", headerTextX, margin + 2);

      pdf.setFontSize(20);
      pdf.setTextColor(107, 114, 128);
      pdf.text("PROJECT ACTIVITIES", headerTextX, margin + 12);

      const jobTitle = job ? `${job.jobNumber || ""} - ${job.name || ""}`.trim() : "";
      if (jobTitle) {
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(31, 41, 55);
        pdf.text(jobTitle, headerTextX, margin + 18);
      }

      pdf.setFillColor(249, 250, 251);
      pdf.setDrawColor(229, 231, 235);
      pdf.roundedRect(pageWidth - margin - 55, margin - 5, 55, 22, 2, 2, "FD");
      pdf.setTextColor(107, 114, 128);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text("Generated", pageWidth - margin - 50, margin + 2);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(31, 41, 55);
      pdf.text(format(new Date(), "dd/MM/yyyy"), pageWidth - margin - 50, margin + 10);

      pdf.setDrawColor(229, 231, 235);
      pdf.line(margin, margin + 24, pageWidth - margin, margin + 24);
      currentY = margin + 32;

      const formatStatus = (status: string) => {
        switch (status) {
          case "NOT_STARTED": return "Not Started";
          case "IN_PROGRESS": return "In Progress";
          case "STUCK": return "Stuck";
          case "DONE": return "Done";
          case "ON_HOLD": return "On Hold";
          case "SKIPPED": return "Skipped";
          default: return status.replace(/_/g, " ");
        }
      };

      const checkPageBreak = (requiredHeight: number) => {
        if (currentY + requiredHeight > pageHeight - margin - 5) {
          pdf.addPage();
          currentY = margin;
          return true;
        }
        return false;
      };

      const drawCheckbox = (x: number, y: number, size: number = 3.5) => {
        pdf.setDrawColor(150, 150, 150);
        pdf.setLineWidth(0.3);
        pdf.rect(x, y, size, size, "S");
        pdf.setLineWidth(0.2);
      };

      const sortCol = 12;
      const activityCol = 70;
      const statusCol = 24;
      const daysCol = 14;
      const predCol = 12;
      const relCol = 12;
      const startCol = 24;
      const endCol = 24;
      const remainingCol = contentWidth - sortCol - activityCol - statusCol - daysCol - predCol - relCol - startCol - endCol;
      const assigneeCol = remainingCol;

      const colWidths = [sortCol, activityCol, statusCol, daysCol, predCol, relCol, startCol, endCol, assigneeCol];
      const colHeaders = ["#", "Activity", "Status", "Days", "Pred", "Rel", "Start", "End", "Assignees"];

      const drawTableHeaders = () => {
        pdf.setFillColor(75, 85, 99);
        pdf.rect(margin, currentY, contentWidth, 8, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "bold");
        let hx = margin;
        colHeaders.forEach((header, i) => {
          pdf.text(header, hx + 2, currentY + 5.5);
          hx += colWidths[i];
        });
        currentY += 8;
      };

      const taskColWidths = [8, 80, 24, 24, 30];
      const taskHeaders = ["", "Task", "Status", "Due Date", "Assignee"];

      const drawTaskHeaders = () => {
        pdf.setFillColor(107, 114, 128);
        const taskTotalWidth = taskColWidths.reduce((a, b) => a + b, 0);
        const taskStartX = margin + sortCol + 8;
        pdf.rect(taskStartX, currentY, taskTotalWidth, 6, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(6.5);
        pdf.setFont("helvetica", "bold");
        let hx = taskStartX;
        taskHeaders.forEach((header, i) => {
          if (i === 0) { hx += taskColWidths[i]; return; }
          pdf.text(header, hx + 2, currentY + 4);
          hx += taskColWidths[i];
        });
        currentY += 6;
      };

      const printedActivityIds = new Set<string>();
      for (const stageId of orderedStageIds) {
        const stageActs = activitiesByStage.get(stageId) || [];
        stageActs.forEach(a => printedActivityIds.add(a.id));
      }

      let taskDataCache: Map<string, any[]> | null = null;
      if (printIncludeTasks) {
        taskDataCache = new Map();
        const fetchPromises = Array.from(printedActivityIds).map(async (actId) => {
          try {
            const res = await fetch(PROJECT_ACTIVITIES_ROUTES.ACTIVITY_TASKS(actId), { credentials: "include" });
            if (res.ok) {
              const tasks = await res.json();
              taskDataCache!.set(actId, tasks);
            }
          } catch (_e) {}
        });
        await Promise.all(fetchPromises);
      }

      for (const stageId of orderedStageIds) {
        const stage = stageMap.get(stageId);
        const stageActivities = (activitiesByStage.get(stageId) || []).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        if (stageActivities.length === 0) continue;

        checkPageBreak(25);

        pdf.setFillColor(249, 250, 251);
        pdf.setDrawColor(229, 231, 235);
        pdf.roundedRect(margin, currentY, contentWidth, 9, 2, 2, "FD");
        pdf.setTextColor(31, 41, 55);
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        const stageName = (stage?.name || "Ungrouped").toUpperCase();
        pdf.text(stageName, margin + 5, currentY + 6.5);
        const stageNameWidth = pdf.getTextWidth(stageName);
        const stageDone = stageActivities.filter(a => a.status === "DONE").length;
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(107, 114, 128);
        pdf.text(`(${stageDone}/${stageActivities.length} done)`, margin + 5 + stageNameWidth + 4, currentY + 6.5);
        currentY += 13;

        drawTableHeaders();

        let rowIndex = 0;
        for (const activity of stageActivities) {
          const titleLines: string[] = pdf.splitTextToSize(activity.name, activityCol - 4);
          const lineHeight = 4;
          const rowHeight = Math.max(7, titleLines.length * lineHeight + 3);

          checkPageBreak(rowHeight);

          if (rowIndex % 2 === 0) {
            pdf.setFillColor(249, 250, 251);
            pdf.rect(margin, currentY, contentWidth, rowHeight, "F");
          }

          if (activity.status === "DONE") {
            pdf.setFillColor(220, 252, 231);
            pdf.rect(margin, currentY, contentWidth, rowHeight, "F");
          } else if (isOverdue(activity)) {
            pdf.setFillColor(254, 226, 226);
            pdf.rect(margin, currentY, contentWidth, rowHeight, "F");
          }

          let rx = margin;

          pdf.setTextColor(107, 114, 128);
          pdf.setFontSize(7);
          pdf.setFont("helvetica", "normal");
          pdf.text(String(activity.sortOrder ?? ""), rx + 2, currentY + 4.5);
          rx += sortCol;

          pdf.setTextColor(31, 41, 55);
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "normal");
          pdf.text(titleLines, rx + 2, currentY + 4.5);
          rx += activityCol;

          pdf.setFontSize(7);
          pdf.text(formatStatus(activity.status), rx + 2, currentY + 4.5);
          rx += statusCol;

          pdf.setTextColor(107, 114, 128);
          pdf.text(activity.estimatedDays != null ? String(activity.estimatedDays) : "-", rx + 2, currentY + 4.5);
          rx += daysCol;

          pdf.text(activity.predecessorSortOrder != null ? String(activity.predecessorSortOrder) : "-", rx + 2, currentY + 4.5);
          rx += predCol;

          pdf.text(activity.relationship || "-", rx + 2, currentY + 4.5);
          rx += relCol;

          pdf.setTextColor(31, 41, 55);
          pdf.text(activity.startDate ? format(new Date(activity.startDate), "dd/MM/yyyy") : "-", rx + 2, currentY + 4.5);
          rx += startCol;

          pdf.text(activity.endDate ? format(new Date(activity.endDate), "dd/MM/yyyy") : "-", rx + 2, currentY + 4.5);
          rx += endCol;

          const assigneeNames = activity.assignees?.map(a => {
            const u = users?.find((u: any) => u.id === a.userId);
            return u?.name?.split(" ")[0] || "";
          }).filter(Boolean).join(", ") || "-";
          pdf.setTextColor(107, 114, 128);
          pdf.setFontSize(7);
          const maxAssLen = Math.floor((assigneeCol - 4) / 1.8);
          const assigneeText = assigneeNames.length > maxAssLen ? assigneeNames.substring(0, maxAssLen - 2) + "..." : assigneeNames;
          pdf.text(assigneeText, rx + 2, currentY + 4.5);

          pdf.setDrawColor(229, 231, 235);
          pdf.line(margin, currentY + rowHeight, margin + contentWidth, currentY + rowHeight);

          currentY += rowHeight;
          rowIndex++;

          if (printIncludeTasks && taskDataCache) {
            const actTasks = taskDataCache.get(activity.id) || [];
            if (actTasks.length > 0) {
              checkPageBreak(12);
              drawTaskHeaders();

              for (let ti = 0; ti < actTasks.length; ti++) {
                const task = actTasks[ti];
                const taskRowHeight = 6;
                checkPageBreak(taskRowHeight);

                const taskStartX = margin + sortCol + 8;
                if (ti % 2 === 0) {
                  pdf.setFillColor(245, 245, 245);
                  pdf.rect(taskStartX, currentY, taskColWidths.reduce((a: number, b: number) => a + b, 0), taskRowHeight, "F");
                }

                let tx = taskStartX;
                drawCheckbox(tx + 2, currentY + 1.5, 3);
                if (task.status === "DONE") {
                  pdf.setDrawColor(100, 100, 100);
                  pdf.setLineWidth(0.3);
                  const cbx = tx + 2, cby = currentY + 1.5, cbs = 3;
                  pdf.line(cbx, cby, cbx + cbs, cby + cbs);
                  pdf.line(cbx + cbs, cby, cbx, cby + cbs);
                  pdf.setLineWidth(0.2);
                }
                tx += taskColWidths[0];

                pdf.setTextColor(task.status === "DONE" ? 156 : 55, task.status === "DONE" ? 163 : 65, task.status === "DONE" ? 175 : 81);
                pdf.setFontSize(7);
                pdf.setFont("helvetica", "normal");
                const taskTitle = task.title.length > 45 ? task.title.substring(0, 42) + "..." : task.title;
                pdf.text(taskTitle, tx + 2, currentY + 4);
                tx += taskColWidths[1];

                pdf.setFontSize(6.5);
                pdf.text(formatStatus(task.status), tx + 2, currentY + 4);
                tx += taskColWidths[2];

                pdf.text(task.dueDate ? format(new Date(task.dueDate), "dd/MM/yy") : "-", tx + 2, currentY + 4);
                tx += taskColWidths[3];

                const taskAssignees = task.assignees?.map((a: any) => a.user?.name?.split(" ")[0] || "").filter(Boolean).join(", ") || "-";
                const taskAssText = taskAssignees.length > 18 ? taskAssignees.substring(0, 15) + "..." : taskAssignees;
                pdf.text(taskAssText, tx + 2, currentY + 4);

                currentY += taskRowHeight;
              }
              currentY += 2;
            }
          }
        }
        currentY += 6;
      }

      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setTextColor(156, 163, 175);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.text(`${companyName} - Confidential`, margin, pageHeight - 8);
        pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
      }

      const filename = `Activities-${job?.jobNumber || jobId}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
      pdf.save(filename);
      toast({ title: "PDF exported successfully" });
      setShowPrintDialog(false);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to generate PDF" });
    } finally {
      setIsExporting(false);
    }
  };

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
        <DialogContent className="sm:max-w-md">
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
            <Button onClick={exportActivitiesToPDF} disabled={isExporting} data-testid="button-confirm-print">
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
  currentUserId,
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
  currentUserId?: string;
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
        <td className="px-3 py-2 text-muted-foreground font-mono text-xs w-[40px]" data-testid={`text-sort-order-${activity.id}`}>
          {activity.sortOrder}
        </td>
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
            {(activity.checklistTotal || 0) > 0 && (
              <Badge
                variant={activity.checklistCompleted === activity.checklistTotal ? "default" : "secondary"}
                className={cn(
                  "text-[10px] px-1.5 py-0",
                  activity.checklistCompleted === activity.checklistTotal
                    ? "bg-green-600 text-white"
                    : "bg-blue-600 text-white"
                )}
                data-testid={`badge-checklist-${activity.id}`}
              >
                <ClipboardCheck className="h-3 w-3 mr-0.5" />
                {activity.checklistCompleted}/{activity.checklistTotal}
              </Badge>
            )}
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
          <Select
            value={activity.status}
            onValueChange={(v) => onStatusChange(activity.id, v)}
          >
            <SelectTrigger className="h-7 border-0 w-auto p-0 shadow-none focus:ring-0 [&>svg]:hidden" data-testid={`inline-status-${activity.id}`}>
              <SelectValue>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusOpt.color}`}>
                  {statusOpt.label}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s.value} value={s.value}>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.color}`}>
                    {s.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <Input
            type="number"
            className="h-7 text-xs w-[70px] text-center"
            defaultValue={activity.estimatedDays ?? ""}
            key={`days-${activity.id}-${activity.estimatedDays}`}
            min={1}
            step="1"
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
                    {a.sortOrder}
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
            {...dateInputProps}
            className={`h-7 text-xs w-[120px] ${isDatePast(activity.startDate, activity.status) ? "border-red-500 text-red-600 dark:text-red-400" : ""}`}
            value={activity.startDate ? format(new Date(activity.startDate), "yyyy-MM-dd") : ""}
            onChange={(e) => onFieldChange(activity.id, { startDate: e.target.value || null }, true)}
            data-testid={`input-start-date-${activity.id}`}
          />
        </td>
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <Input
            type="date"
            {...dateInputProps}
            className={`h-7 text-xs w-[120px] ${isDatePast(activity.endDate, activity.status) ? "border-red-500 text-red-600 dark:text-red-400" : ""}`}
            value={activity.endDate ? format(new Date(activity.endDate), "yyyy-MM-dd") : ""}
            onChange={(e) => onFieldChange(activity.id, { endDate: e.target.value || null }, false)}
            data-testid={`input-end-date-${activity.id}`}
          />
        </td>
        <td className="px-3 py-2 text-muted-foreground text-xs truncate max-w-[140px]">{activity.deliverable || "-"}</td>
      </tr>

      {tasksExpanded && (
        <tr data-testid={`activity-tasks-row-${activity.id}`}>
          <td colSpan={11} className="px-4 py-2 bg-muted/30">
            <ActivityTasksPanel
              activityId={activity.id}
              jobId={jobId}
              activityStartDate={activity.startDate ? String(activity.startDate) : null}
              activityEndDate={activity.endDate ? String(activity.endDate) : null}
              users={users}
              jobs={jobs}
              currentUserId={currentUserId}
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
            <td className="px-3 py-1.5 text-muted-foreground font-mono text-xs w-[40px]" data-testid={`text-sort-order-child-${child.id}`}>
              {child.sortOrder}
            </td>
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
                step="1"
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
                {...dateInputProps}
                className={`h-6 text-xs w-[120px] ${isDatePast(child.startDate, child.status) ? "border-red-500 text-red-600 dark:text-red-400" : ""}`}
                value={child.startDate ? format(new Date(child.startDate), "yyyy-MM-dd") : ""}
                onChange={(e) => onFieldChange(child.id, { startDate: e.target.value || null }, false)}
              />
            </td>
            <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
              <Input
                type="date"
                {...dateInputProps}
                className={`h-6 text-xs w-[120px] ${isDatePast(child.endDate, child.status) ? "border-red-500 text-red-600 dark:text-red-400" : ""}`}
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
                {...dateInputProps}
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

  const { data: checklistItems = [] } = useQuery<any[]>({
    queryKey: [activity ? PROJECT_ACTIVITIES_ROUTES.ACTIVITY_CHECKLISTS(activity.id) : ""],
    enabled: !!activity && (activity.checklistTotal || 0) > 0,
  });

  const toggleChecklistMutation = useMutation({
    mutationFn: async (checklistId: string) => {
      return apiRequest("POST", PROJECT_ACTIVITIES_ROUTES.ACTIVITY_CHECKLIST_TOGGLE(checklistId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.ACTIVITY_CHECKLISTS(activity!.id)] });
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_ACTIVITIES(jobId)] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
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
            {(activity.checklistTotal || 0) > 0 && (
              <TabsTrigger value="checklist" className="flex-1" data-testid="tab-checklist">
                Checklist <Badge variant="secondary" className="ml-1">{activity.checklistCompleted}/{activity.checklistTotal}</Badge>
              </TabsTrigger>
            )}
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
                  <Label className={`text-xs ${isDatePast(activity.startDate, activity.status) ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>Start Date</Label>
                  <Input
                    type="date"
                    {...dateInputProps}
                    className={isDatePast(activity.startDate, activity.status) ? "border-red-500 text-red-600 dark:text-red-400" : ""}
                    value={activity.startDate ? format(new Date(activity.startDate), "yyyy-MM-dd") : ""}
                    onChange={(e) => updateActivityMutation.mutate({ id: activity.id, startDate: e.target.value || null, _recalculate: true })}
                    data-testid="sidebar-input-start-date"
                  />
                </div>
                <div className="space-y-1">
                  <Label className={`text-xs ${isDatePast(activity.endDate, activity.status) ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>End Date</Label>
                  <Input
                    type="date"
                    {...dateInputProps}
                    className={isDatePast(activity.endDate, activity.status) ? "border-red-500 text-red-600 dark:text-red-400" : ""}
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
                  {...dateInputProps}
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
                              {a.sortOrder}. {a.name}
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

          <TabsContent value="checklist" className="mt-4">
            <div className="space-y-2">
              {checklistItems.length > 0 ? checklistItems.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-2 border rounded cursor-pointer hover-elevate"
                  onClick={() => toggleChecklistMutation.mutate(item.id)}
                  data-testid={`checklist-item-${item.id}`}
                >
                  <Checkbox
                    checked={item.isChecked}
                    onCheckedChange={() => toggleChecklistMutation.mutate(item.id)}
                    data-testid={`checklist-checkbox-${item.id}`}
                  />
                  <span className={cn("text-sm flex-1", item.isChecked && "line-through text-muted-foreground")}>
                    {item.label}
                  </span>
                  {item.checkedByName && (
                    <span className="text-xs text-muted-foreground">{item.checkedByName}</span>
                  )}
                </div>
              )) : (
                <p className="text-center text-muted-foreground text-sm py-8">No checklist items</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
