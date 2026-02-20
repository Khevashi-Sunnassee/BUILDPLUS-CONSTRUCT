import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, isBefore, startOfDay } from "date-fns";
import { TASKS_ROUTES, PROJECT_ACTIVITIES_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, Calendar as CalendarIcon, MessageSquare, Paperclip,
  GripVertical, Users, Bell, Eye, EyeOff, Loader2, MoreHorizontal, Trash2,
  ChevronRight, ChevronDown,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Task, TaskStatus, TaskPriority, User, Job } from "./types";
import { STATUS_CONFIG, PRIORITY_CONFIG, PROJECT_STAGES, getInitials } from "./types";
import { TaskSidebar } from "./TaskSidebar";

const GRID_TEMPLATE = "40px minmax(200px,1fr) 40px 100px 120px 90px 120px 100px 60px 60px 40px";

interface ActivityTasksPanelProps {
  activityId: string;
  jobId: string;
  activityStartDate?: string | null;
  activityEndDate?: string | null;
  users: User[];
  jobs: Job[];
  currentUserId?: string;
}

export function ActivityTasksPanel({
  activityId,
  jobId,
  activityStartDate,
  activityEndDate,
  users,
  jobs,
  currentUserId,
}: ActivityTasksPanelProps) {
  const { toast } = useToast();
  const [showCompleted, setShowCompleted] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sidebarInitialTab, setSidebarInitialTab] = useState<"updates" | "files">("updates");
  const newTaskInputRef = useRef<HTMLInputElement>(null);

  const queryKey = [PROJECT_ACTIVITIES_ROUTES.ACTIVITY_TASKS(activityId)];

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey,
    enabled: !!activityId,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const createTaskMutation = useMutation({
    mutationFn: async (title: string) => {
      const body: any = { title, jobId };
      if (activityEndDate) {
        body.dueDate = new Date(activityEndDate).toISOString();
      }
      const res = await apiRequest("POST", PROJECT_ACTIVITIES_ROUTES.ACTIVITY_TASKS(activityId), body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      setNewTaskTitle("");
      setTimeout(() => newTaskInputRef.current?.focus(), 50);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (taskIds: string[]) => {
      return apiRequest("POST", PROJECT_ACTIVITIES_ROUTES.ACTIVITY_TASKS_REORDER(activityId), { taskIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const allTasksCopy = [...tasks];
    const oldIndex = allTasksCopy.findIndex(t => t.id === active.id);
    const newIndex = allTasksCopy.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const [moved] = allTasksCopy.splice(oldIndex, 1);
    allTasksCopy.splice(newIndex, 0, moved);
    reorderMutation.mutate(allTasksCopy.map(t => t.id));
  }

  function handleCreateTask() {
    const title = newTaskTitle.trim();
    if (!title) return;
    createTaskMutation.mutate(title);
  }

  const visibleTasks = showCompleted
    ? tasks
    : tasks.filter(t => t.status !== "DONE");

  const completedCount = tasks.filter(t => t.status === "DONE").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="ml-2 text-xs text-muted-foreground">Loading tasks...</span>
      </div>
    );
  }

  return (
    <div data-testid={`activity-tasks-panel-${activityId}`}>
      <div className="overflow-x-auto">
        <div className="min-w-max">
          <div className="grid text-xs text-muted-foreground font-medium border-b bg-muted/50 py-1.5" style={{ gridTemplateColumns: GRID_TEMPLATE }}>
            <div />
            <div className="px-2 flex items-center justify-between">
              <span>Item ({tasks.length}{completedCount > 0 ? `, ${completedCount} done` : ""})</span>
            </div>
            <div />
            <div className="px-2 text-center">Users</div>
            <div className="px-2 text-center">Status</div>
            <div className="px-2 text-center">Priority</div>
            <div className="px-2">Stage</div>
            <div className="px-2">Date</div>
            <div className="px-2 text-center">Reminder</div>
            <div className="px-2 text-center">Files</div>
            <div className="px-1 flex items-center justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-[10px] gap-0.5 px-1"
                onClick={() => setShowCompleted(!showCompleted)}
                data-testid={`button-toggle-completed-${activityId}`}
              >
                {showCompleted ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visibleTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {visibleTasks.map(task => (
                <SortableActivityTask
                  key={task.id}
                  task={task}
                  users={users}
                  jobs={jobs}
                  activityId={activityId}
                  jobId={jobId}
                  queryKey={queryKey}
                  activityStartDate={activityStartDate}
                  activityEndDate={activityEndDate}
                  onOpenSidebar={(t, tab) => {
                    setSelectedTask(t);
                    setSidebarInitialTab(tab);
                  }}
                />
              ))}
            </SortableContext>
          </DndContext>

          <div
            className="grid items-center border-b border-dashed border-border/30 bg-muted/20"
            style={{ gridTemplateColumns: GRID_TEMPLATE }}
          >
            <div />
            <div className="flex items-center gap-2 py-1 px-2">
              <Plus className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <Input
                ref={newTaskInputRef}
                placeholder="Add a task..."
                className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateTask();
                }}
                disabled={createTaskMutation.isPending}
                data-testid={`input-new-task-${activityId}`}
              />
            </div>
            <div />
            <div />
            <div />
            <div />
            <div />
            <div />
            <div />
            <div />
            <div />
          </div>
        </div>
      </div>

      <TaskSidebar
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        initialTab={sidebarInitialTab}
      />
    </div>
  );
}

function SortableActivityTask({
  task,
  users,
  jobs,
  activityId,
  jobId,
  queryKey,
  activityStartDate,
  activityEndDate,
  onOpenSidebar,
}: {
  task: Task;
  users: User[];
  jobs: Job[];
  activityId: string;
  jobId: string;
  queryKey: string[];
  activityStartDate?: string | null;
  activityEndDate?: string | null;
  onOpenSidebar: (task: Task, tab: "updates" | "files") => void;
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ActivityTaskRow
        task={task}
        users={users}
        jobs={jobs}
        activityId={activityId}
        jobId={jobId}
        queryKey={queryKey}
        sortableAttributes={attributes}
        sortableListeners={listeners}
        activityStartDate={activityStartDate}
        activityEndDate={activityEndDate}
        onOpenSidebar={onOpenSidebar}
      />
    </div>
  );
}

function ActivityTaskRow({
  task,
  users,
  jobs,
  activityId,
  jobId,
  queryKey,
  sortableAttributes,
  sortableListeners,
  activityStartDate,
  activityEndDate,
  onOpenSidebar,
}: {
  task: Task;
  users: User[];
  jobs: Job[];
  activityId: string;
  jobId: string;
  queryKey: string[];
  sortableAttributes?: Record<string, any>;
  sortableListeners?: Record<string, any>;
  activityStartDate?: string | null;
  activityEndDate?: string | null;
  onOpenSidebar: (task: Task, tab: "updates" | "files") => void;
}) {
  const { toast } = useToast();
  const [localTitle, setLocalTitle] = useState(task.title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAssigneePopover, setShowAssigneePopover] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const subtaskInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalTitle(task.title);
  }, [task.title]);

  useEffect(() => {
    if (isExpanded && subtaskInputRef.current) {
      setTimeout(() => subtaskInputRef.current?.focus(), 50);
    }
  }, [isExpanded]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Task>) => {
      return apiRequest("PATCH", TASKS_ROUTES.BY_ID(task.id), data);
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: Task[] | undefined) => {
        if (!old) return old;
        return old.map(t => t.id === task.id ? { ...t, ...newData } : t);
      });
      return { previous };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", TASKS_ROUTES.BY_ID(task.id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      toast({ title: "Task deleted" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const createSubtaskMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await apiRequest("POST", TASKS_ROUTES.LIST, {
        groupId: task.groupId,
        parentId: task.id,
        jobId: task.jobId || jobId,
        jobActivityId: activityId,
        title,
        dueDate: activityEndDate ? new Date(activityEndDate).toISOString() : null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      setNewSubtaskTitle("");
      setTimeout(() => subtaskInputRef.current?.focus(), 50);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deleteSubtaskMutation = useMutation({
    mutationFn: async (subtaskId: string) => {
      return apiRequest("DELETE", TASKS_ROUTES.BY_ID(subtaskId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const updateSubtaskMutation = useMutation({
    mutationFn: async ({ subtaskId, data }: { subtaskId: string; data: Partial<Task> }) => {
      return apiRequest("PATCH", TASKS_ROUTES.BY_ID(subtaskId), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  function handleCreateSubtask() {
    const title = newSubtaskTitle.trim();
    if (!title) return;
    createSubtaskMutation.mutate(title);
  }

  const subtasks = task.subtasks || [];
  const subtaskCount = subtasks.length;
  const subtaskDoneCount = subtasks.filter(s => s.status === "DONE").length;

  const addAssigneeMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", TASKS_ROUTES.ASSIGNEES(task.id), { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const removeAssigneeMutation = useMutation({
    mutationFn: async (assigneeId: string) => {
      return apiRequest("DELETE", TASKS_ROUTES.ASSIGNEE_BY_ID(assigneeId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  function handleTitleBlur() {
    if (localTitle.trim() && localTitle !== task.title) {
      updateMutation.mutate({ title: localTitle.trim() });
    } else {
      setLocalTitle(task.title);
    }
  }

  function toggleAssignee(userId: string) {
    const existing = task.assignees.find(a => a.userId === userId);
    if (existing) {
      removeAssigneeMutation.mutate(existing.id);
    } else {
      addAssigneeMutation.mutate(userId);
    }
  }

  function handleStatusChange(status: TaskStatus) {
    updateMutation.mutate({ status } as any);
  }

  function handlePriorityChange(val: string) {
    updateMutation.mutate({ priority: val === "none" ? null : val } as any);
  }

  function handleStageChange(val: string) {
    updateMutation.mutate({ projectStage: val === "none" ? null : val } as any);
  }

  function validateDate(date: Date | undefined): boolean {
    if (!date) return true;
    if (activityStartDate && isBefore(date, startOfDay(new Date(activityStartDate)))) {
      toast({ variant: "destructive", title: "Date must be on or after activity start date" });
      return false;
    }
    if (activityEndDate) {
      const end = startOfDay(new Date(activityEndDate));
      end.setDate(end.getDate() + 1);
      if (!isBefore(date, end)) {
        toast({ variant: "destructive", title: "Date must be on or before activity end date" });
        return false;
      }
    }
    return true;
  }

  function handleDateChange(date: Date | undefined) {
    if (validateDate(date)) {
      updateMutation.mutate({ dueDate: date ? date.toISOString() : null } as any);
    }
  }

  function handleReminderChange(date: Date | undefined) {
    updateMutation.mutate({ reminderDate: date ? date.toISOString() : null } as any);
  }

  const isDone = task.status === "DONE";
  const isOverdue = task.dueDate && !isDone && isBefore(startOfDay(new Date(task.dueDate)), startOfDay(new Date()));
  const jobData = jobs.find(j => j.id === jobId);

  return (
    <>
      <div
        className={cn(
          "grid items-center border-b border-border/50 hover-elevate group relative",
          isDone && "bg-green-50 dark:bg-green-950/30",
          isOverdue && "bg-red-50/50 dark:bg-red-950/10",
        )}
        style={{ gridTemplateColumns: GRID_TEMPLATE }}
        data-testid={`activity-task-row-${task.id}`}
      >
        <div
          className="flex items-center justify-center px-1"
          {...(sortableAttributes || {})}
          {...(sortableListeners || {})}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab opacity-0 group-hover:opacity-100" />
        </div>

        <div className="flex items-center gap-1 py-1 px-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-shrink-0"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid={`btn-expand-task-${task.id}`}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </Button>
          <Checkbox
            checked={isDone}
            onCheckedChange={(checked) => {
              updateMutation.mutate({ status: checked ? "DONE" : "NOT_STARTED" } as any);
            }}
            className="h-4 w-4 flex-shrink-0"
            data-testid={`checkbox-task-${task.id}`}
          />
          <Input
            ref={titleInputRef}
            className={cn(
              "h-7 border-0 bg-transparent focus-visible:ring-1 text-sm flex-1 min-w-0",
              isDone && "line-through text-muted-foreground",
            )}
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") titleInputRef.current?.blur();
            }}
            data-testid={`input-task-title-${task.id}`}
          />
          {subtaskCount > 0 && !isExpanded && (
            <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-1">
              {subtaskDoneCount}/{subtaskCount}
            </span>
          )}
        </div>

        <div className="flex items-center justify-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => onOpenSidebar(task, "updates")}
                data-testid={`btn-updates-${task.id}`}
              >
                <MessageSquare className="h-4 w-4" />
                {task.updatesCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
                    {task.updatesCount}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Updates</TooltipContent>
          </Tooltip>
        </div>

        <Popover open={showAssigneePopover} onOpenChange={setShowAssigneePopover}>
          <PopoverTrigger asChild>
            <div
              className="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-muted/50 rounded"
              data-testid={`assignees-${task.id}`}
            >
              {(task.assignees?.length || 0) > 0 ? (
                <div className="flex -space-x-2">
                  {(task.assignees || []).slice(0, 3).map((assignee) => (
                    <Avatar key={assignee.id} className="h-6 w-6 border-2 border-background">
                      <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                        {getInitials(assignee.user?.name)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {(task.assignees?.length || 0) > 3 && (
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] border-2 border-background">
                      +{(task.assignees?.length || 0) - 3}
                    </div>
                  )}
                </div>
              ) : (
                <Users className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {users.slice().sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || '')).map((user) => {
                const isAssigned = (task.assignees || []).some((a) => a.userId === user.id);
                return (
                  <div
                    key={user.id}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded cursor-pointer hover-elevate",
                      isAssigned && "bg-primary/10"
                    )}
                    onClick={() => toggleAssignee(user.id)}
                    data-testid={`assignee-option-${user.id}-${task.id}`}
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px]">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm flex-1">{user.name || user.email}</span>
                    {isAssigned && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        <Select value={task.status} onValueChange={(v) => handleStatusChange(v as TaskStatus)}>
          <SelectTrigger
            className="h-7 border-0 text-xs justify-center"
            data-testid={`select-status-${task.id}`}
          >
            <div
              className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold text-white", STATUS_CONFIG[task.status as TaskStatus]?.bgClass || "bg-muted-foreground")}
            >
              {STATUS_CONFIG[task.status as TaskStatus]?.label || task.status}
            </div>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                <div className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold text-white", config.bgClass)}>
                  {config.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={task.priority || "none"}
          onValueChange={handlePriorityChange}
        >
          <SelectTrigger
            className="h-7 border-0 text-xs justify-center"
            data-testid={`select-priority-${task.id}`}
          >
            {task.priority && PRIORITY_CONFIG[task.priority as TaskPriority] ? (
              <div
                className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold text-white", PRIORITY_CONFIG[task.priority as TaskPriority].bgClass)}
              >
                {PRIORITY_CONFIG[task.priority as TaskPriority].label}
              </div>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No priority</SelectItem>
            {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                <div className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold text-white", config.bgClass)}>
                  {config.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={task.projectStage || "none"}
          onValueChange={handleStageChange}
        >
          <SelectTrigger
            className="h-7 border-0 text-xs"
            data-testid={`select-stage-${task.id}`}
          >
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No stage</SelectItem>
            {PROJECT_STAGES.map((stage) => (
              <SelectItem key={stage} value={stage}>
                {stage}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2 text-xs justify-start",
                isOverdue && "text-red-500 hover:text-red-600"
              )}
              data-testid={`btn-date-${task.id}`}
            >
              <CalendarIcon className={cn("h-3 w-3 mr-1", isOverdue && "text-red-500")} />
              {task.dueDate ? format(new Date(task.dueDate), "dd/MM/yy") : "No date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={task.dueDate ? new Date(task.dueDate) : undefined}
              onSelect={handleDateChange}
              disabled={(date) => {
                if (activityStartDate && isBefore(date, startOfDay(new Date(activityStartDate)))) return true;
                if (activityEndDate) {
                  const end = new Date(activityEndDate);
                  end.setDate(end.getDate() + 1);
                  return !isBefore(date, startOfDay(end));
                }
                return false;
              }}
              initialFocus
            />
            {task.dueDate && (
              <div className="p-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => handleDateChange(undefined)}
                >
                  Clear date
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2 text-xs justify-center",
                task.reminderDate && "text-amber-600 dark:text-amber-400"
              )}
              data-testid={`btn-reminder-${task.id}`}
            >
              <Bell className={cn("h-4 w-4", task.reminderDate && "fill-current")} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-2 border-b">
              <p className="text-sm font-medium">Set Reminder</p>
            </div>
            <Calendar
              mode="single"
              selected={task.reminderDate ? new Date(task.reminderDate) : undefined}
              onSelect={handleReminderChange}
              initialFocus
            />
            {task.reminderDate && (
              <div className="p-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => handleReminderChange(undefined)}
                >
                  Clear Reminder
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <div className="flex items-center justify-center gap-1 text-muted-foreground">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => onOpenSidebar(task, "files")}
                data-testid={`btn-files-${task.id}`}
              >
                <Paperclip className="h-3.5 w-3.5" />
                {task.filesCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
                    {task.filesCount}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Files</TooltipContent>
          </Tooltip>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100"
              data-testid={`btn-task-menu-${task.id}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => setShowDeleteConfirm(true)}
              data-testid={`menu-delete-task-${task.id}`}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isExpanded && (
        <div className="border-b border-border/30 bg-muted/30">
          {subtasks.map(subtask => {
            const subIsDone = subtask.status === "DONE";
            const subIsOverdue = subtask.dueDate && !subIsDone && isBefore(startOfDay(new Date(subtask.dueDate)), startOfDay(new Date()));
            return (
              <div
                key={subtask.id}
                className={cn(
                  "grid items-center border-b border-border/20 hover-elevate group/sub relative",
                  subIsDone && "bg-green-50/50 dark:bg-green-950/20",
                  subIsOverdue && "bg-red-50/30 dark:bg-red-950/10",
                )}
                style={{ gridTemplateColumns: GRID_TEMPLATE }}
                data-testid={`subtask-row-${subtask.id}`}
              >
                <div />
                <div className="flex items-center gap-2 py-1 pl-10 pr-2">
                  <Checkbox
                    checked={subIsDone}
                    onCheckedChange={(checked) => {
                      updateSubtaskMutation.mutate({
                        subtaskId: subtask.id,
                        data: { status: checked ? "DONE" : "NOT_STARTED" } as any,
                      });
                    }}
                    className="h-3.5 w-3.5 flex-shrink-0"
                    data-testid={`checkbox-subtask-${subtask.id}`}
                  />
                  <SubtaskTitleInput
                    subtask={subtask}
                    updateSubtaskMutation={updateSubtaskMutation}
                    isDone={subIsDone}
                  />
                </div>
                <div />
                <div className="flex items-center justify-center">
                  {(subtask.assignees?.length || 0) > 0 && (
                    <div className="flex -space-x-1">
                      {(subtask.assignees || []).slice(0, 2).map((a) => (
                        <Avatar key={a.id} className="h-5 w-5 border border-background">
                          <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">
                            {getInitials(a.user?.name)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-center">
                  <Select
                    value={subtask.status}
                    onValueChange={(v) => updateSubtaskMutation.mutate({ subtaskId: subtask.id, data: { status: v } as any })}
                  >
                    <SelectTrigger className="h-6 border-0 text-[10px] justify-center" data-testid={`select-subtask-status-${subtask.id}`}>
                      <div className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-semibold text-white", STATUS_CONFIG[subtask.status as TaskStatus]?.bgClass || "bg-muted-foreground")}>
                        {STATUS_CONFIG[subtask.status as TaskStatus]?.label || subtask.status}
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold text-white", config.bgClass)}>
                            {config.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div />
                <div />
                <div className="px-2 text-xs text-muted-foreground">
                  {subtask.dueDate && (
                    <span className={cn(subIsOverdue && "text-red-500")}>
                      {format(new Date(subtask.dueDate), "dd/MM/yy")}
                    </span>
                  )}
                </div>
                <div />
                <div />
                <div className="flex items-center justify-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover/sub:opacity-100"
                    onClick={() => deleteSubtaskMutation.mutate(subtask.id)}
                    data-testid={`btn-delete-subtask-${subtask.id}`}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}

          <div
            className="grid items-center border-b border-dashed border-border/20"
            style={{ gridTemplateColumns: GRID_TEMPLATE }}
          >
            <div />
            <div className="flex items-center gap-2 py-1 pl-10 pr-2">
              <Plus className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <Input
                ref={subtaskInputRef}
                placeholder="Add a subtask..."
                className="h-6 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateSubtask();
                }}
                disabled={createSubtaskMutation.isPending}
                data-testid={`input-new-subtask-${task.id}`}
              />
            </div>
            <div />
            <div />
            <div />
            <div />
            <div />
            <div />
            <div />
            <div />
            <div />
          </div>
        </div>
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{task.title}&rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SubtaskTitleInput({
  subtask,
  updateSubtaskMutation,
  isDone,
}: {
  subtask: Task;
  updateSubtaskMutation: { mutate: (args: { subtaskId: string; data: Partial<Task> }) => void };
  isDone: boolean;
}) {
  const [localTitle, setLocalTitle] = useState(subtask.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalTitle(subtask.title);
  }, [subtask.title]);

  function handleBlur() {
    if (localTitle.trim() && localTitle !== subtask.title) {
      updateSubtaskMutation.mutate({
        subtaskId: subtask.id,
        data: { title: localTitle.trim() },
      });
    } else {
      setLocalTitle(subtask.title);
    }
  }

  return (
    <Input
      ref={inputRef}
      className={cn(
        "h-6 border-0 bg-transparent focus-visible:ring-1 text-xs flex-1 min-w-0",
        isDone && "line-through text-muted-foreground",
      )}
      value={localTitle}
      onChange={(e) => setLocalTitle(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter") inputRef.current?.blur();
      }}
      data-testid={`input-subtask-title-${subtask.id}`}
    />
  );
}
