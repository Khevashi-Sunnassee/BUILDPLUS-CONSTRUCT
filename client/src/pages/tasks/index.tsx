import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDocumentTitle } from "@/hooks/use-document-title";
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
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
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
  ListFilter,
} from "lucide-react";
import { Link } from "wouter";
import { PageHelpButton } from "@/components/help/page-help-button";
import { TaskGroupComponent } from "./TaskGroupComponent";
import { TaskSidebar } from "./TaskSidebar";
import { SendTasksEmailDialog } from "./SendTasksEmailDialog";
import type { Task, TaskGroup, User, Job, TaskTypeFilter } from "./types";
import { STATUS_CONFIG } from "./types";
import { exportTasksToPDF } from "./export-pdf";
import { ErrorBoundary } from "@/components/error-boundary";

function TasksPageContent() {
  useDocumentTitle("Tasks");
  const { toast } = useToast();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupJobId, setNewGroupJobId] = useState<string | null>(null);
  const [taskTypeFilter, setTaskTypeFilter] = useState<TaskTypeFilter>("all");
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [dueDateFilter, setDueDateFilter] = useState<string>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeGroupDragId, setActiveGroupDragId] = useState<string | null>(null);
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

  const filteredGroups = useMemo(() => {
    return groups.map((group) => ({
      ...group,
      tasks: group.tasks.filter((task) => {
        if (!showCompleted && task.status === "DONE") return false;
        if (taskTypeFilter !== "all") {
          if (taskTypeFilter === "personal" && (task.jobActivityId || task.draftingEmailId)) return false;
          if (taskTypeFilter === "activity" && !task.jobActivityId) return false;
          if (taskTypeFilter === "email" && !task.draftingEmailId) return false;
        }
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
    })).filter((group) => {
      const hasActiveFilter = taskTypeFilter !== "all" || jobFilter !== "all" || statusFilter !== "all" || dueDateFilter !== "all" || !showCompleted;
      if (hasActiveFilter && group.tasks.length === 0) return false;
      return true;
    });
  }, [groups, showCompleted, taskTypeFilter, jobFilter, statusFilter, dueDateFilter]);

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

  const selectedTasksForEmail = useMemo(() => 
    filteredGroups.flatMap((g) => g.tasks.filter((t) => selectedTaskIds.has(t.id))),
    [filteredGroups, selectedTaskIds]
  );

  const moveTaskMutation = useMutation({
    mutationFn: async ({ taskId, targetGroupId, targetIndex }: { taskId: string; targetGroupId: string; targetIndex: number }) => {
      return apiRequest("POST", TASKS_ROUTES.MOVE_TASK(taskId), { targetGroupId, targetIndex });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
    },
    onError: (error: Error) => {
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
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error reordering", description: error.message });
    },
  });

  const reorderGroupsMutation = useMutation({
    mutationFn: async ({ groupIds }: { groupIds: string[] }) => {
      return apiRequest("POST", TASKS_ROUTES.GROUPS_REORDER, { groupIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error reordering groups", description: error.message });
    },
  });

  const handleMoveGroup = useCallback((groupId: string, direction: 'up' | 'down') => {
    const currentIndex = groups.findIndex(g => g.id === groupId);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= groups.length) return;
    const newOrder = groups.map(g => g.id);
    [newOrder[currentIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[currentIndex]];
    reorderGroupsMutation.mutate({ groupIds: newOrder });
  }, [groups, reorderGroupsMutation]);

  const createGroupMutation = useMutation({
    mutationFn: async (data: { name: string; jobId?: string | null }) => {
      return apiRequest("POST", TASKS_ROUTES.GROUPS, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      setNewGroupName("");
      setNewGroupJobId(null);
      setShowNewGroupInput(false);
      toast({ title: "Group created" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const exportToPDF = useCallback(async () => {
    setIsExporting(true);
    try {
      await exportTasksToPDF({
        filteredGroups,
        reportLogo,
        companyName,
        taskTypeFilter,
        jobFilter,
        jobs,
      });
      toast({ title: "PDF exported successfully" });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ variant: "destructive", title: "Export failed", description: error instanceof Error ? error.message : "Failed to generate PDF" });
    } finally {
      setIsExporting(false);
    }
  }, [filteredGroups, reportLogo, companyName, taskTypeFilter, jobFilter, jobs, toast]);

  const taskLookupMap = useMemo(() => {
    const map = new Map<string, { task: Task; groupId: string }>();
    for (const group of groups) {
      for (const task of group.tasks) {
        map.set(task.id, { task, groupId: group.id });
      }
    }
    return map;
  }, [groups]);

  const findTaskById = useCallback((id: string): { task: Task; groupId: string } | null => {
    return taskLookupMap.get(id) || null;
  }, [taskLookupMap]);

  const findGroupContainingTask = useCallback((taskId: string): string | null => {
    const entry = taskLookupMap.get(taskId);
    return entry ? entry.groupId : null;
  }, [taskLookupMap]);

  const GROUP_SORTABLE_PREFIX = "sortable-group-";

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string;
    if (id.startsWith(GROUP_SORTABLE_PREFIX)) {
      setActiveGroupDragId(id.replace(GROUP_SORTABLE_PREFIX, ""));
      setActiveId(null);
    } else {
      setActiveId(id);
      setActiveGroupDragId(null);
    }
    setOverGroupId(null);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setOverGroupId(null);
      return;
    }

    if ((active.id as string).startsWith(GROUP_SORTABLE_PREFIX)) {
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
  }, [findTaskById]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveGroupDragId(null);
    setOverGroupId(null);

    if (!over) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    if (activeIdStr.startsWith(GROUP_SORTABLE_PREFIX) && overIdStr.startsWith(GROUP_SORTABLE_PREFIX)) {
      const activeGroupId = activeIdStr.replace(GROUP_SORTABLE_PREFIX, "");
      const overGroupId = overIdStr.replace(GROUP_SORTABLE_PREFIX, "");
      if (activeGroupId !== overGroupId) {
        const oldIndex = groups.findIndex(g => g.id === activeGroupId);
        const newIndex = groups.findIndex(g => g.id === overGroupId);
        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(groups.map(g => g.id), oldIndex, newIndex);
          reorderGroupsMutation.mutate({ groupIds: newOrder });
        }
      }
      return;
    }

    const activeTaskInfo = findTaskById(active.id as string);
    if (!activeTaskInfo) return;

    const overId = over.id as string;
    
    if (overId.startsWith("group-droppable-")) {
      const targetGroupId = overId.replace("group-droppable-", "");
      const targetGroup = groups.find(g => g.id === targetGroupId);
      if (targetGroup && activeTaskInfo.groupId !== targetGroupId) {
        moveTaskMutation.mutate({
          taskId: active.id as string,
          targetGroupId,
          targetIndex: targetGroup.tasks.length,
        });
      }
      return;
    }

    const overGroup = groups.find(g => g.id === overId);
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
        const group = groups.find(g => g.id === activeTaskInfo.groupId);
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
        const overGroupTasks = groups.find(g => g.id === overTaskInfo.groupId)?.tasks || [];
        const targetIndex = overGroupTasks.findIndex(t => t.id === overId);
        moveTaskMutation.mutate({
          taskId: active.id as string,
          targetGroupId: overTaskInfo.groupId,
          targetIndex: Math.max(0, targetIndex),
        });
      }
    }
  }, [groups, findTaskById, moveTaskMutation, reorderTasksMutation, reorderGroupsMutation]);

  const activeTask = activeId ? findTaskById(activeId)?.task : null;
  const activeGroupDrag = activeGroupDragId ? groups.find(g => g.id === activeGroupDragId) : null;

  const jobFilterOptions = useMemo(() => {
    const jobIdsInTasks = new Set<string>();
    groups.forEach(g => {
      if (g.jobId) jobIdsInTasks.add(g.jobId);
      g.tasks.forEach(t => { if (t.jobId) jobIdsInTasks.add(t.jobId); });
    });
    return jobs
      .filter(j => jobIdsInTasks.has(j.id))
      .sort((a, b) => (a.jobNumber || '').localeCompare(b.jobNumber || '') || (a.name || '').localeCompare(b.name || ''));
  }, [groups, jobs]);

  if (isLoading) {
    return (
      <div className="space-y-6" role="main" aria-label="Tasks" aria-busy="true">
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
    <div className="space-y-6" data-testid="tasks-page" role="main" aria-label="Tasks">
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
            <ListFilter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Select value={taskTypeFilter} onValueChange={(v) => setTaskTypeFilter(v as TaskTypeFilter)}>
              <SelectTrigger className="w-[180px]" data-testid="select-task-type-filter">
                <SelectValue placeholder="Task Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tasks</SelectItem>
                <SelectItem value="personal">Personal Tasks</SelectItem>
                <SelectItem value="activity">Job Programme Activity Tasks</SelectItem>
                <SelectItem value="email">Email Actions</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Select value={jobFilter} onValueChange={setJobFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-job-filter">
                <SelectValue placeholder="Filter by job" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                <SelectItem value="none">No Job Assigned</SelectItem>
                {jobFilterOptions.map((job) => (
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
        <div className="flex items-center gap-2 p-4 border rounded-lg bg-muted/30 flex-wrap">
          <Input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newGroupName.trim()) {
                createGroupMutation.mutate({ name: newGroupName, jobId: newGroupJobId });
              }
              if (e.key === "Escape") {
                setShowNewGroupInput(false);
                setNewGroupName("");
                setNewGroupJobId(null);
              }
            }}
            placeholder="Enter group name..."
            className="max-w-xs"
            autoFocus
            data-testid="input-new-group-name"
          />
          <select
            value={newGroupJobId || ""}
            onChange={(e) => setNewGroupJobId(e.target.value || null)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            data-testid="select-new-group-job"
          >
            <option value="">No job linked</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.jobNumber} - {j.name}</option>
            ))}
          </select>
          <Button
            onClick={() => newGroupName.trim() && createGroupMutation.mutate({ name: newGroupName, jobId: newGroupJobId })}
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
              setNewGroupJobId(null);
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
          <SortableContext items={filteredGroups.map(g => `${GROUP_SORTABLE_PREFIX}${g.id}`)} strategy={verticalListSortingStrategy}>
            <div className="border rounded-lg overflow-visible bg-card">
              {filteredGroups.map((group, index) => (
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
                  onMoveGroup={handleMoveGroup}
                  groupIndex={groups.findIndex(g => g.id === group.id)}
                  totalGroups={groups.length}
                  sortableGroupId={`${GROUP_SORTABLE_PREFIX}${group.id}`}
                />
              ))}
            </div>
          </SortableContext>
        )}

        <DragOverlay>
          {activeTask && (
            <div className="bg-card border shadow-lg rounded-md p-2 opacity-90">
              <span className="text-sm font-medium">{activeTask.title}</span>
            </div>
          )}
          {activeGroupDrag && (
            <div className="bg-card border shadow-lg rounded-md p-3 opacity-90">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: activeGroupDrag.color }} />
                <span className="font-semibold text-sm" style={{ color: activeGroupDrag.color }}>{activeGroupDrag.name}</span>
                <span className="text-xs text-muted-foreground ml-1">{activeGroupDrag.tasks.length} items</span>
              </div>
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

export default function TasksPage() {
  return (
    <ErrorBoundary name="tasks-page">
      <TasksPageContent />
    </ErrorBoundary>
  );
}
