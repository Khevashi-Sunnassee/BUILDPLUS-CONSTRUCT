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
  Trash2, GripVertical, Users, Bell, Check, Eye, EyeOff,
  Loader2,
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

interface ActivityTasksPanelProps {
  activityId: string;
  jobId: string;
  activityStartDate?: string | null;
  activityEndDate?: string | null;
  users: User[];
  jobs: Job[];
}

export function ActivityTasksPanel({
  activityId,
  jobId,
  activityStartDate,
  activityEndDate,
  users,
  jobs,
}: ActivityTasksPanelProps) {
  const { toast } = useToast();
  const [showCompleted, setShowCompleted] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
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
      return apiRequest("POST", PROJECT_ACTIVITIES_ROUTES.ACTIVITY_TASKS(activityId), {
        title,
        jobId,
      });
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
    <div className="space-y-1" data-testid={`activity-tasks-panel-${activityId}`}>
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-medium text-muted-foreground">
          Tasks ({tasks.length}{completedCount > 0 ? `, ${completedCount} done` : ""})
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs gap-1"
          onClick={() => setShowCompleted(!showCompleted)}
          data-testid={`button-toggle-completed-${activityId}`}
        >
          {showCompleted ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {showCompleted ? "Hide Done" : "Show Done"}
        </Button>
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
              queryKey={queryKey}
              activityStartDate={activityStartDate}
              activityEndDate={activityEndDate}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div className="flex items-center gap-2 px-2 py-1">
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
          data-testid={`input-new-task-${activityId}`}
        />
        {newTaskTitle.trim() && (
          <Button
            size="sm"
            className="h-6 text-xs"
            onClick={handleCreateTask}
            disabled={createTaskMutation.isPending}
            data-testid={`button-add-task-${activityId}`}
          >
            Add
          </Button>
        )}
      </div>
    </div>
  );
}

function SortableActivityTask({
  task,
  users,
  jobs,
  activityId,
  queryKey,
  activityStartDate,
  activityEndDate,
}: {
  task: Task;
  users: User[];
  jobs: Job[];
  activityId: string;
  queryKey: string[];
  activityStartDate?: string | null;
  activityEndDate?: string | null;
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
        queryKey={queryKey}
        sortableAttributes={attributes}
        sortableListeners={listeners}
        activityStartDate={activityStartDate}
        activityEndDate={activityEndDate}
      />
    </div>
  );
}

function ActivityTaskRow({
  task,
  users,
  jobs,
  activityId,
  queryKey,
  sortableAttributes,
  sortableListeners,
  activityStartDate,
  activityEndDate,
}: {
  task: Task;
  users: User[];
  jobs: Job[];
  activityId: string;
  queryKey: string[];
  sortableAttributes?: Record<string, any>;
  sortableListeners?: Record<string, any>;
  activityStartDate?: string | null;
  activityEndDate?: string | null;
}) {
  const { toast } = useToast();
  const [localTitle, setLocalTitle] = useState(task.title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAssigneePopover, setShowAssigneePopover] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalTitle(task.title);
  }, [task.title]);

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

  const isDone = task.status === "DONE";
  const isOverdue = task.dueDate && !isDone && isBefore(startOfDay(new Date(task.dueDate)), startOfDay(new Date()));
  const statusCfg = STATUS_CONFIG[task.status as TaskStatus] || STATUS_CONFIG.NOT_STARTED;

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-1 px-1 py-0.5 rounded group",
          isDone && "opacity-60",
          isOverdue && "bg-red-50/50 dark:bg-red-950/10",
        )}
        data-testid={`activity-task-row-${task.id}`}
      >
        <div
          className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          {...sortableAttributes}
          {...sortableListeners}
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>

        <Checkbox
          checked={isDone}
          onCheckedChange={(checked) => {
            updateMutation.mutate({ status: checked ? "DONE" : "NOT_STARTED" } as any);
          }}
          className="h-3.5 w-3.5 flex-shrink-0"
          data-testid={`checkbox-task-${task.id}`}
        />

        <Input
          ref={titleInputRef}
          className={cn(
            "h-6 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent flex-1 min-w-0",
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

        <Popover open={showAssigneePopover} onOpenChange={setShowAssigneePopover}>
          <PopoverTrigger asChild>
            <button
              className="flex items-center gap-0.5 flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
              data-testid={`button-assignees-${task.id}`}
            >
              {task.assignees.length > 0 ? (
                <div className="flex -space-x-1.5">
                  {task.assignees.slice(0, 3).map(a => (
                    <Avatar key={a.id} className="h-5 w-5 border border-background">
                      <AvatarFallback className="text-[8px]">
                        {getInitials(a.user?.name || a.user?.email || "")}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {task.assignees.length > 3 && (
                    <span className="text-[9px] text-muted-foreground ml-1">+{task.assignees.length - 3}</span>
                  )}
                </div>
              ) : (
                <Users className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2" align="end">
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {users.map(u => {
                const isAssigned = task.assignees.some(a => a.userId === u.id);
                return (
                  <button
                    key={u.id}
                    className={cn(
                      "flex items-center gap-2 w-full px-2 py-1 rounded text-xs hover-elevate",
                      isAssigned && "bg-accent",
                    )}
                    onClick={() => toggleAssignee(u.id)}
                    data-testid={`button-toggle-assignee-${u.id}-${task.id}`}
                  >
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className="text-[7px]">{getInitials(u.name || u.email)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{u.name || u.email}</span>
                    {isAssigned && <Check className="h-3 w-3 ml-auto text-green-500 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        <Select
          value={task.status}
          onValueChange={(val) => updateMutation.mutate({ status: val } as any)}
        >
          <SelectTrigger className="h-5 w-auto text-[10px] border-0 shadow-none px-1.5 gap-0.5" data-testid={`select-status-${task.id}`}>
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: statusCfg.color }}
            />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                  {cfg.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {task.priority && (
          <span className={cn(
            "text-[9px] px-1 rounded font-medium text-white flex-shrink-0",
            PRIORITY_CONFIG[task.priority as TaskPriority]?.bgClass || "bg-gray-500",
          )}>
            {PRIORITY_CONFIG[task.priority as TaskPriority]?.label || task.priority}
          </span>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-0.5 text-[10px] flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity",
                isOverdue && "text-red-500 opacity-100",
              )}
              data-testid={`button-due-date-${task.id}`}
            >
              <CalendarIcon className="h-3 w-3" />
              {task.dueDate && (
                <span>{format(new Date(task.dueDate), "MMM d")}</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={task.dueDate ? new Date(task.dueDate) : undefined}
              onSelect={(date) => {
                if (validateDate(date)) {
                  updateMutation.mutate({ dueDate: date ? date.toISOString() : null } as any);
                }
              }}
              disabled={(date) => {
                if (activityStartDate && isBefore(date, startOfDay(new Date(activityStartDate)))) return true;
                if (activityEndDate) {
                  const end = new Date(activityEndDate);
                  end.setDate(end.getDate() + 1);
                  return !isBefore(date, startOfDay(end));
                }
                return false;
              }}
            />
            {task.dueDate && (
              <div className="p-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs text-destructive"
                  onClick={() => updateMutation.mutate({ dueDate: null } as any)}
                >
                  Clear date
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {task.updatesCount > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
              <MessageSquare className="h-2.5 w-2.5" />{task.updatesCount}
            </span>
          )}
          {task.filesCount > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
              <Paperclip className="h-2.5 w-2.5" />{task.filesCount}
            </span>
          )}
          <button
            className="p-0.5 text-muted-foreground hover:text-destructive transition-colors"
            onClick={() => setShowDeleteConfirm(true)}
            data-testid={`button-delete-task-${task.id}`}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

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
