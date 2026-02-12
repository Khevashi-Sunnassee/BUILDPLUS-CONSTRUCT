import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { format, isBefore, startOfDay } from "date-fns";
import { TASKS_ROUTES, USER_ROUTES, JOBS_ROUTES, SETTINGS_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  pointerWithin,
  CollisionDetection,
} from "@dnd-kit/core";
import {
  Plus,
  Briefcase,
  Printer,
  Eye,
  EyeOff,
  Mail,
  ChevronsDownUp,
  ChevronsUpDown,
  Workflow,
} from "lucide-react";
import { Link } from "wouter";
import { PageHelpButton } from "@/components/help/page-help-button";
import { TaskGroupComponent } from "./TaskGroupComponent";
import { TaskSidebar } from "./TaskSidebar";
import { SendTasksEmailDialog } from "./SendTasksEmailDialog";
import type { Task, TaskGroup, User, Job } from "./types";
import { STATUS_CONFIG } from "./types";

export default function TasksPage() {
  useDocumentTitle("Tasks");
  const { toast } = useToast();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [dueDateFilter, setDueDateFilter] = useState<string>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overGroupId, setOverGroupId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [collapseAllVersion, setCollapseAllVersion] = useState(0);
  const [expandAllVersion, setExpandAllVersion] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length === 0) {
      return closestCenter(args);
    }
    const taskItemCollisions = pointerCollisions.filter(
      (c) => !String(c.id).startsWith("group-droppable-")
    );
    if (taskItemCollisions.length > 0) {
      return taskItemCollisions;
    }
    return pointerCollisions;
  }, []);

  const { data: groups = [], isLoading } = useQuery<TaskGroup[]>({
    queryKey: [TASKS_ROUTES.GROUPS],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: [USER_ROUTES.LIST],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  const { data: brandingSettings } = useQuery<{ logoBase64: string | null; companyName: string }>({
    queryKey: [SETTINGS_ROUTES.LOGO],
  });

  const notifiedRemindersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      groups.forEach((group) => {
        group.tasks.forEach((task) => {
          if (task.reminderDate && !notifiedRemindersRef.current.has(task.id)) {
            const reminderTime = new Date(task.reminderDate);
            if (reminderTime <= now && task.status !== "DONE") {
              notifiedRemindersRef.current.add(task.id);
              toast({
                title: "Task Reminder",
                description: `Reminder: ${task.title}`,
                variant: "default",
              });
            }
          }
        });
      });
    };

    checkReminders();
    const interval = setInterval(checkReminders, 60000);
    return () => clearInterval(interval);
  }, [groups, toast]);

  const [isExporting, setIsExporting] = useState(false);
  const reportLogo = brandingSettings?.logoBase64 || null;
  const companyName = brandingSettings?.companyName || "BuildPlus Ai";

  const filteredGroups = groups.map((group) => ({
    ...group,
    tasks: group.tasks.filter((task) => {
      if (!showCompleted && task.status === "DONE") return false;
      if (jobFilter !== "all") {
        if (jobFilter === "none" && task.jobId) return false;
        if (jobFilter !== "none" && task.jobId !== jobFilter) return false;
      }
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (dueDateFilter !== "all") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const taskDueDate = task.dueDate ? new Date(task.dueDate) : null;
        if (taskDueDate) taskDueDate.setHours(0, 0, 0, 0);
        
        if (dueDateFilter === "overdue") {
          if (!taskDueDate || taskDueDate >= today) return false;
        } else if (dueDateFilter === "today") {
          if (!taskDueDate || taskDueDate.getTime() !== today.getTime()) return false;
        } else if (dueDateFilter === "week") {
          const weekFromNow = new Date(today);
          weekFromNow.setDate(weekFromNow.getDate() + 7);
          if (!taskDueDate || taskDueDate > weekFromNow) return false;
        } else if (dueDateFilter === "no-date") {
          if (taskDueDate) return false;
        }
      }
      return true;
    }),
  }));

  const toggleTaskSelected = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const selectedTasksForEmail = filteredGroups.flatMap((g) =>
    g.tasks.filter((t) => selectedTaskIds.has(t.id))
  );

  const moveTaskMutation = useMutation({
    mutationFn: async ({ taskId, targetGroupId, targetIndex }: { taskId: string; targetGroupId: string; targetIndex: number }) => {
      return apiRequest("POST", TASKS_ROUTES.MOVE_TASK(taskId), { targetGroupId, targetIndex });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error moving task", description: error.message });
    },
  });

  const reorderTasksMutation = useMutation({
    mutationFn: async ({ groupId, taskIds }: { groupId: string; taskIds: string[] }) => {
      return apiRequest("POST", TASKS_ROUTES.TASKS_REORDER, { groupId, taskIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error reordering", description: error.message });
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", TASKS_ROUTES.GROUPS, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      setNewGroupName("");
      setShowNewGroupInput(false);
      toast({ title: "Group created" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const exportToPDF = async () => {
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
        const img = document.createElement("img");
        img.src = reportLogo!;
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
        if (img.naturalWidth && img.naturalHeight) {
          const aspectRatio = img.naturalWidth / img.naturalHeight;
          const lw = Math.min(25, logoHeight * aspectRatio);
          const lh = lw / aspectRatio;
          pdf.addImage(reportLogo!, "PNG", margin, margin - 5, lw, lh, undefined, "FAST");
          headerTextX = margin + 30;
        }
      } catch (_e) {}

      pdf.setTextColor(31, 41, 55);
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(companyName || "BuildPlus Ai", headerTextX, margin + 2);

      pdf.setFontSize(20);
      pdf.setTextColor(107, 114, 128);
      pdf.text("TASK LIST", headerTextX, margin + 12);

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

      if (jobFilter !== "all") {
        const filterLabel = jobFilter === "none"
          ? "No Job Assigned"
          : jobs.find(j => j.id === jobFilter)?.name || "";
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(107, 114, 128);
        pdf.text(`Filter: ${filterLabel}`, pageWidth - margin - 50, margin + 16);
      }

      pdf.setDrawColor(229, 231, 235);
      pdf.line(margin, margin + 20, pageWidth - margin, margin + 20);
      currentY = margin + 28;

      const formatStatus = (status: string) => {
        switch (status) {
          case "NOT_STARTED": return "Not Started";
          case "IN_PROGRESS": return "In Progress";
          case "STUCK": return "Stuck";
          case "DONE": return "Done";
          case "ON_HOLD": return "On Hold";
          default: return status.replace(/_/g, " ");
        }
      };

      const formatPriority = (priority: string | null) => {
        if (!priority) return "-";
        return priority.charAt(0) + priority.slice(1).toLowerCase();
      };

      const checkPageBreak = (requiredHeight: number) => {
        if (currentY + requiredHeight > pageHeight - margin - 5) {
          pdf.addPage();
          currentY = margin;
          return true;
        }
        return false;
      };

      const checkboxCol = 8;
      const taskCol = 82;
      const statusCol = 28;
      const priorityCol = 22;
      const assigneeCol = 38;
      const dueDateCol = 28;
      const jobCol = contentWidth - checkboxCol - taskCol - statusCol - priorityCol - assigneeCol - dueDateCol;
      const colWidths = [checkboxCol, taskCol, statusCol, priorityCol, assigneeCol, dueDateCol, jobCol];
      const colHeaders = ["", "Task", "Status", "Priority", "Assignee", "Due Date", "Job"];

      const drawCheckbox = (x: number, y: number, size: number = 3.5) => {
        pdf.setDrawColor(150, 150, 150);
        pdf.setLineWidth(0.3);
        pdf.rect(x, y, size, size, "S");
        pdf.setLineWidth(0.2);
      };

      const drawTableHeaders = () => {
        pdf.setFillColor(75, 85, 99);
        pdf.rect(margin, currentY, contentWidth, 8, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        let hx = margin;
        colHeaders.forEach((header, i) => {
          if (i === 0) {
            hx += colWidths[i];
            return;
          }
          pdf.text(header, hx + 3, currentY + 5.5);
          hx += colWidths[i];
        });
        currentY += 8;
      };

      for (const group of filteredGroups) {
        if (group.tasks.length === 0) continue;

        checkPageBreak(25);

        pdf.setFillColor(249, 250, 251);
        pdf.setDrawColor(229, 231, 235);
        pdf.roundedRect(margin, currentY, contentWidth, 9, 2, 2, "FD");
        pdf.setTextColor(31, 41, 55);
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.text(group.name.toUpperCase(), margin + 5, currentY + 6.5);
        const groupNameWidth = pdf.getTextWidth(group.name.toUpperCase());
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(107, 114, 128);
        pdf.text(`(${group.tasks.length} task${group.tasks.length !== 1 ? "s" : ""})`, margin + 5 + groupNameWidth + 4, currentY + 6.5);
        currentY += 13;

        drawTableHeaders();

        let rowIndex = 0;
        const drawTask = (task: Task, indent: number = 0) => {
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
          const taskTextX = margin + colWidths[0] + 3 + indent;
          const taskColWidth = colWidths[1] - 6 - indent;
          const titlePrefix = indent > 0 ? "  " : "";
          const titleLines: string[] = pdf.splitTextToSize(titlePrefix + task.title, taskColWidth);
          const lineHeight = 4;
          const rowHeight = Math.max(7, titleLines.length * lineHeight + 3);

          checkPageBreak(rowHeight);

          if (rowIndex % 2 === 0) {
            pdf.setFillColor(249, 250, 251);
            pdf.rect(margin, currentY, contentWidth, rowHeight, "F");
          }

          drawCheckbox(margin + 2.5, currentY + 2);

          if (indent > 0) {
            pdf.setTextColor(107, 114, 128);
          } else {
            pdf.setTextColor(31, 41, 55);
          }
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
          pdf.text(titleLines, taskTextX, currentY + 4.5);

          let rx = margin + colWidths[0] + colWidths[1];

          pdf.setTextColor(31, 41, 55);
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "normal");
          pdf.text(formatStatus(task.status), rx + 3, currentY + 4.5);
          rx += colWidths[2];

          pdf.text(formatPriority(task.priority), rx + 3, currentY + 4.5);
          rx += colWidths[3];

          pdf.setTextColor(107, 114, 128);
          const assignees = task.assignees?.map(a => a.user?.name?.split(" ")[0] || "").filter(Boolean).join(", ") || "-";
          const maxAssLen = Math.floor((colWidths[4] - 6) / 1.8);
          const assigneeText = assignees.length > maxAssLen ? assignees.substring(0, maxAssLen - 2) + "..." : assignees;
          pdf.text(assigneeText, rx + 3, currentY + 4.5);
          rx += colWidths[4];

          pdf.setTextColor(31, 41, 55);
          pdf.text(task.dueDate ? format(new Date(task.dueDate), "dd/MM/yyyy") : "-", rx + 3, currentY + 4.5);
          rx += colWidths[5];

          const jobText = task.job ? `${task.job.jobNumber || task.job.name || ""}` : "-";
          const maxJobLen = Math.floor((colWidths[6] - 6) / 1.8);
          pdf.text(jobText.length > maxJobLen ? jobText.substring(0, maxJobLen - 2) + "..." : jobText, rx + 3, currentY + 4.5);

          pdf.setDrawColor(229, 231, 235);
          pdf.line(margin, currentY + rowHeight, margin + contentWidth, currentY + rowHeight);

          currentY += rowHeight;
          rowIndex++;

          if (task.subtasks && task.subtasks.length > 0) {
            for (const subtask of task.subtasks) {
              drawTask(subtask, 6);
            }
          }
        };

        for (const task of group.tasks) {
          drawTask(task);
        }

        currentY += 8;
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

      pdf.save(`LTE-Tasks-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast({ title: "PDF exported successfully" });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to generate PDF" });
    } finally {
      setIsExporting(false);
    }
  };

  const findTaskById = (id: string): { task: Task; groupId: string } | null => {
    for (const group of filteredGroups) {
      const task = group.tasks.find(t => t.id === id);
      if (task) return { task, groupId: group.id };
    }
    return null;
  };

  const findGroupContainingTask = (taskId: string): string | null => {
    for (const group of filteredGroups) {
      if (group.tasks.some(t => t.id === taskId)) {
        return group.id;
      }
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setOverGroupId(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setOverGroupId(null);
      return;
    }

    const overId = over.id as string;

    if (overId.startsWith("group-droppable-")) {
      const groupId = overId.replace("group-droppable-", "");
      const activeTaskInfo = findTaskById(active.id as string);
      if (activeTaskInfo && activeTaskInfo.groupId !== groupId) {
        setOverGroupId(groupId);
      } else {
        setOverGroupId(null);
      }
      return;
    }

    const overTaskInfo = findTaskById(overId);
    if (overTaskInfo) {
      const activeTaskInfo = findTaskById(active.id as string);
      if (activeTaskInfo && activeTaskInfo.groupId !== overTaskInfo.groupId) {
        setOverGroupId(overTaskInfo.groupId);
      } else {
        setOverGroupId(null);
      }
    } else {
      setOverGroupId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverGroupId(null);

    if (!over) return;

    const activeTaskInfo = findTaskById(active.id as string);
    if (!activeTaskInfo) return;

    const overId = over.id as string;
    
    if (overId.startsWith("group-droppable-")) {
      const targetGroupId = overId.replace("group-droppable-", "");
      const targetGroup = filteredGroups.find(g => g.id === targetGroupId);
      if (targetGroup && activeTaskInfo.groupId !== targetGroupId) {
        moveTaskMutation.mutate({
          taskId: active.id as string,
          targetGroupId,
          targetIndex: targetGroup.tasks.length,
        });
      }
      return;
    }

    const overGroup = filteredGroups.find(g => g.id === overId);
    if (overGroup) {
      if (activeTaskInfo.groupId !== overId) {
        moveTaskMutation.mutate({
          taskId: active.id as string,
          targetGroupId: overId,
          targetIndex: overGroup.tasks.length,
        });
      }
      return;
    }

    const overTaskInfo = findTaskById(overId);
    if (overTaskInfo) {
      if (activeTaskInfo.groupId === overTaskInfo.groupId) {
        const group = filteredGroups.find(g => g.id === activeTaskInfo.groupId);
        if (group) {
          const taskIds = group.tasks.map(t => t.id);
          const oldIndex = taskIds.indexOf(active.id as string);
          const newIndex = taskIds.indexOf(overId);
          if (oldIndex !== newIndex) {
            const newTaskIds = [...taskIds];
            newTaskIds.splice(oldIndex, 1);
            newTaskIds.splice(newIndex, 0, active.id as string);
            reorderTasksMutation.mutate({ groupId: group.id, taskIds: newTaskIds });
          }
        }
      } else {
        const overGroupTasks = filteredGroups.find(g => g.id === overTaskInfo.groupId)?.tasks || [];
        const targetIndex = overGroupTasks.findIndex(t => t.id === overId);
        moveTaskMutation.mutate({
          taskId: active.id as string,
          targetGroupId: overTaskInfo.groupId,
          targetIndex: Math.max(0, targetIndex),
        });
      }
    }
  };

  const activeTask = activeId ? findTaskById(activeId)?.task : null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="tasks-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Tasks</h1>
            <PageHelpButton pageHelpKey="page.tasks" />
          </div>
          <p className="text-muted-foreground">Manage your team's work and track progress</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <Select value={jobFilter} onValueChange={setJobFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-job-filter">
                <SelectValue placeholder="Filter by job" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                <SelectItem value="none">No Job Assigned</SelectItem>
                {jobs.slice().sort((a, b) => (a.jobNumber || '').localeCompare(b.jobNumber || '') || (a.name || '').localeCompare(b.name || '')).map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.jobNumber} - {job.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="NOT_STARTED">Not Started</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="STUCK">Stuck</SelectItem>
              <SelectItem value="ON_HOLD">On Hold</SelectItem>
              <SelectItem value="DONE">Done</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dueDateFilter} onValueChange={setDueDateFilter}>
            <SelectTrigger className="w-[130px]" data-testid="select-date-filter">
              <SelectValue placeholder="Due Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="today">Due Today</SelectItem>
              <SelectItem value="week">Due This Week</SelectItem>
              <SelectItem value="no-date">No Due Date</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCompleted(!showCompleted)}
            className={cn("gap-1", showCompleted && "bg-accent")}
            data-testid="btn-toggle-completed"
          >
            {showCompleted ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {showCompleted ? "Showing Done" : "Done Hidden"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsEmailDialogOpen(true)}
            disabled={selectedTaskIds.size === 0}
            data-testid="btn-email-tasks"
          >
            <Mail className="h-4 w-4 mr-2" />
            Email{selectedTaskIds.size > 0 ? ` (${selectedTaskIds.size})` : ""}
          </Button>
          <Button
            variant="outline"
            onClick={exportToPDF}
            disabled={isExporting || filteredGroups.every(g => g.tasks.length === 0)}
            data-testid="btn-export-pdf"
          >
            <Printer className="h-4 w-4 mr-2" />
            {isExporting ? "Exporting..." : "Print"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCollapseAllVersion(v => v + 1)}
            data-testid="btn-collapse-all-groups"
          >
            <ChevronsDownUp className="h-4 w-4 mr-2" />
            Collapse All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandAllVersion(v => v + 1)}
            data-testid="btn-expand-all-groups"
          >
            <ChevronsUpDown className="h-4 w-4 mr-2" />
            Expand All
          </Button>
          {jobFilter && jobFilter !== "all" && jobFilter !== "none" && (
            <Link href={`/jobs/${jobFilter}/activities`}>
              <Button
                variant="outline"
                size="sm"
                data-testid="btn-project-activities"
              >
                <Workflow className="h-4 w-4 mr-2" />
                Project Activities
              </Button>
            </Link>
          )}
          <Button
            onClick={() => setShowNewGroupInput(true)}
            data-testid="btn-new-group"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Group
          </Button>
        </div>
      </div>

      {showNewGroupInput && (
        <div className="flex items-center gap-2 p-4 border rounded-lg bg-muted/30">
          <Input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newGroupName.trim()) {
                createGroupMutation.mutate(newGroupName);
              }
              if (e.key === "Escape") {
                setShowNewGroupInput(false);
                setNewGroupName("");
              }
            }}
            placeholder="Enter group name..."
            className="max-w-xs"
            autoFocus
            data-testid="input-new-group-name"
          />
          <Button
            onClick={() => newGroupName.trim() && createGroupMutation.mutate(newGroupName)}
            disabled={!newGroupName.trim() || createGroupMutation.isPending}
            data-testid="btn-create-group"
          >
            Create
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setShowNewGroupInput(false);
              setNewGroupName("");
            }}
            data-testid="btn-cancel-new-group"
          >
            Cancel
          </Button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {groups.length === 0 ? (
          <div className="text-center py-16 border rounded-lg bg-muted/30">
            <div className="max-w-md mx-auto">
              <h3 className="text-lg font-semibold mb-2">No task groups yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first group to start organizing tasks. Groups help you categorize and manage related work items.
              </p>
              <Button onClick={() => setShowNewGroupInput(true)} data-testid="btn-create-first-group">
                <Plus className="h-4 w-4 mr-2" />
                Create First Group
              </Button>
            </div>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-card">
            {filteredGroups.map((group) => (
              <TaskGroupComponent
                key={group.id}
                group={group}
                users={users}
                jobs={jobs}
                onOpenSidebar={setSelectedTask}
                allGroups={filteredGroups}
                showCompleted={showCompleted}
                selectedTaskIds={selectedTaskIds}
                onToggleTaskSelected={toggleTaskSelected}
                isDropTarget={overGroupId === group.id}
                collapseAllVersion={collapseAllVersion}
                expandAllVersion={expandAllVersion}
              />
            ))}
          </div>
        )}

        <DragOverlay>
          {activeTask && (
            <div className="bg-card border shadow-lg rounded-md p-2 opacity-90">
              <span className="text-sm font-medium">{activeTask.title}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <TaskSidebar task={selectedTask} onClose={() => setSelectedTask(null)} />

      <SendTasksEmailDialog
        open={isEmailDialogOpen}
        onOpenChange={setIsEmailDialogOpen}
        selectedTasks={selectedTasksForEmail}
        users={users}
        onSuccess={() => setSelectedTaskIds(new Set())}
      />
    </div>
  );
}
