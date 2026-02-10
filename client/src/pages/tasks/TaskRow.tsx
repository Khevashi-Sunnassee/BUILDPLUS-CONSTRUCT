import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, isBefore, startOfDay } from "date-fns";
import { TASKS_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  MoreHorizontal,
  Calendar as CalendarIcon,
  MessageSquare,
  Paperclip,
  Trash2,
  GripVertical,
  Users,
  Bell,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { Task, TaskStatus, TaskPriority, User, Job } from "./types";
import { STATUS_CONFIG, PRIORITY_CONFIG, PROJECT_STAGES, getInitials } from "./types";

export function SortableTaskRow({
  task,
  users,
  jobs,
  onOpenSidebar,
  showCompleted,
  isExpanded,
  onToggleExpanded,
  isSelected,
  onToggleSelected,
  gridTemplate,
}: {
  task: Task;
  users: User[];
  jobs: Job[];
  onOpenSidebar: (task: Task) => void;
  showCompleted: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  isSelected?: boolean;
  onToggleSelected?: () => void;
  gridTemplate: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TaskRow
      task={task}
      users={users}
      jobs={jobs}
      isSubtask={false}
      onOpenSidebar={onOpenSidebar}
      showCompleted={showCompleted}
      sortableRef={setNodeRef}
      sortableStyle={style}
      sortableAttributes={attributes}
      sortableListeners={listeners}
      isExpanded={isExpanded}
      onToggleExpanded={onToggleExpanded}
      isSelected={isSelected}
      onToggleSelected={onToggleSelected}
      gridTemplate={gridTemplate}
    />
  );
}

export function TaskRow({
  task,
  users,
  jobs,
  isSubtask = false,
  onOpenSidebar,
  showCompleted = true,
  sortableRef,
  sortableStyle,
  sortableAttributes,
  sortableListeners,
  isExpanded = false,
  onToggleExpanded,
  isSelected,
  onToggleSelected,
  gridTemplate,
}: {
  task: Task;
  users: User[];
  jobs: Job[];
  isSubtask?: boolean;
  onOpenSidebar: (task: Task) => void;
  showCompleted?: boolean;
  sortableRef?: (node: HTMLElement | null) => void;
  sortableStyle?: React.CSSProperties;
  sortableAttributes?: Record<string, any>;
  sortableListeners?: Record<string, any>;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  isSelected?: boolean;
  onToggleSelected?: () => void;
  gridTemplate?: string;
}) {
  const { toast } = useToast();
  const [localTitle, setLocalTitle] = useState(task.title);
  const [localConsultant, setLocalConsultant] = useState(task.consultant || "");
  const showSubtasks = isExpanded;
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskAssignees, setNewSubtaskAssignees] = useState<string[]>([]);
  const [newSubtaskJobId, setNewSubtaskJobId] = useState<string | null>(null);
  const [newSubtaskStatus, setNewSubtaskStatus] = useState<TaskStatus>("NOT_STARTED");
  const [newSubtaskDueDate, setNewSubtaskDueDate] = useState<Date | null>(new Date());
  const [newSubtaskReminderDate, setNewSubtaskReminderDate] = useState<Date | null>(null);
  const [newSubtaskProjectStage, setNewSubtaskProjectStage] = useState<string | null>(null);
  const [showNewSubtaskAssigneePopover, setShowNewSubtaskAssigneePopover] = useState(false);
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const subtaskInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAssigneePopover, setShowAssigneePopover] = useState(false);
  const pendingMutationRef = useRef<Promise<any> | null>(null);
  const settledTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  

  useEffect(() => {
    setLocalTitle(task.title);
    setLocalConsultant(task.consultant || "");
  }, [task.title, task.consultant]);

  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.style.height = "auto";
      titleInputRef.current.style.height = titleInputRef.current.scrollHeight + "px";
    }
  }, [localTitle]);

  useEffect(() => {
    if (showSubtasks && subtaskInputRef.current) {
      setTimeout(() => subtaskInputRef.current?.focus(), 50);
    }
  }, [showSubtasks]);

  const updateTaskMutation = useMutation({
    mutationFn: async (data: Partial<Task>) => {
      if (pendingMutationRef.current) {
        try { await pendingMutationRef.current; } catch {}
      }
      const promise = apiRequest("PATCH", TASKS_ROUTES.BY_ID(task.id), data);
      pendingMutationRef.current = promise;
      try {
        const result = await promise;
        return result;
      } finally {
        if (pendingMutationRef.current === promise) {
          pendingMutationRef.current = null;
        }
      }
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      if (settledTimerRef.current) {
        clearTimeout(settledTimerRef.current);
        settledTimerRef.current = null;
      }
      const previousGroups = queryClient.getQueryData([TASKS_ROUTES.GROUPS]);
      const updateTaskRecursive = (t: any): any => {
        if (t.id === task.id) {
          return { ...t, ...newData };
        }
        if (t.subtasks && t.subtasks.length > 0) {
          return { ...t, subtasks: t.subtasks.map(updateTaskRecursive) };
        }
        return t;
      };
      queryClient.setQueryData([TASKS_ROUTES.GROUPS], (old: any) => {
        if (!old) return old;
        return old.map((group: any) => ({
          ...group,
          tasks: group.tasks.map(updateTaskRecursive),
        }));
      });
      return { previousGroups };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousGroups) {
        queryClient.setQueryData([TASKS_ROUTES.GROUPS], context.previousGroups);
      }
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
    onSettled: () => {
      if (settledTimerRef.current) {
        clearTimeout(settledTimerRef.current);
      }
      settledTimerRef.current = setTimeout(() => {
        settledTimerRef.current = null;
        queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      }, 500);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", TASKS_ROUTES.BY_ID(task.id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      toast({ title: "Task deleted" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const setAssigneesMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      return apiRequest("PUT", TASKS_ROUTES.ASSIGNEES(task.id), { userIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const createSubtaskMutation = useMutation({
    mutationFn: async (data: { title: string; assigneeIds: string[]; jobId: string | null; status: TaskStatus; dueDate: Date | null; reminderDate: Date | null; projectStage: string | null }) => {
      const formatDate = (date: Date | null): string | null => {
        if (!date) return null;
        if (date instanceof Date && !isNaN(date.getTime())) {
          return date.toISOString();
        }
        return null;
      };
      
      const response = await apiRequest("POST", TASKS_ROUTES.LIST, {
        groupId: task.groupId,
        parentId: task.id,
        title: data.title,
        status: data.status,
        priority: "MEDIUM",
        jobId: data.jobId,
        dueDate: formatDate(data.dueDate),
        reminderDate: formatDate(data.reminderDate),
        projectStage: data.projectStage,
      });
      
      const createdTask = await response.json();
      
      if (data.assigneeIds.length > 0 && createdTask?.id) {
        await apiRequest("PUT", TASKS_ROUTES.ASSIGNEES(createdTask.id), { userIds: data.assigneeIds });
      }
      
      return createdTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      setNewSubtaskTitle("");
      setNewSubtaskAssignees([]);
      setNewSubtaskJobId(null);
      setNewSubtaskStatus("NOT_STARTED");
      setNewSubtaskDueDate(new Date());
      setNewSubtaskReminderDate(null);
      setNewSubtaskProjectStage(null);
      setTimeout(() => subtaskInputRef.current?.focus(), 50);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });
  
  const handleCreateSubtask = () => {
    if (newSubtaskTitle.trim() && !createSubtaskMutation.isPending) {
      createSubtaskMutation.mutate({
        title: newSubtaskTitle,
        assigneeIds: newSubtaskAssignees,
        jobId: newSubtaskJobId,
        status: newSubtaskStatus,
        dueDate: newSubtaskDueDate,
        reminderDate: newSubtaskReminderDate,
        projectStage: newSubtaskProjectStage,
      });
    }
  };
  
  const handleToggleNewSubtaskAssignee = (userId: string) => {
    setNewSubtaskAssignees(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleTitleBlur = () => {
    if (localTitle !== task.title && localTitle.trim()) {
      updateTaskMutation.mutate({ title: localTitle });
    }
  };

  const handleConsultantBlur = () => {
    if (localConsultant !== (task.consultant || "")) {
      updateTaskMutation.mutate({ consultant: localConsultant || null });
    }
  };

  const handleStatusChange = (status: TaskStatus) => {
    updateTaskMutation.mutate({ status });
  };

  const handlePriorityChange = (priority: string) => {
    updateTaskMutation.mutate({ priority: priority === "none" ? null : priority });
  };

  const handleDateChange = (date: Date | undefined) => {
    const isoDate = date instanceof Date && !isNaN(date.getTime()) ? date.toISOString() : null;
    updateTaskMutation.mutate({ dueDate: isoDate });
  };

  const handleReminderChange = (date: Date | undefined) => {
    const isoDate = date instanceof Date && !isNaN(date.getTime()) ? date.toISOString() : null;
    updateTaskMutation.mutate({ reminderDate: isoDate });
  };

  const handleStageChange = (stage: string) => {
    updateTaskMutation.mutate({ projectStage: stage === "none" ? null : stage });
  };

  const handleJobChange = (jobId: string) => {
    const selectedJob = jobId === "none" ? null : jobs.find(j => j.id === jobId);
    const updateData = { 
      jobId: jobId === "none" ? null : jobId,
      job: selectedJob || null 
    };
    updateTaskMutation.mutate(updateData);
  };

  const handleToggleAssignee = (userId: string) => {
    const currentIds = (task.assignees || []).map((a) => a.userId);
    const newIds = currentIds.includes(userId)
      ? currentIds.filter((id) => id !== userId)
      : [...currentIds, userId];
    setAssigneesMutation.mutate(newIds);
  };

  const hasSubtasks = task.subtasks && task.subtasks.length > 0;

  const jobColor = task.job?.productionSlotColor || null;

  return (
    <>
      <div
        ref={sortableRef}
        style={{ ...sortableStyle, ...(gridTemplate ? { gridTemplateColumns: gridTemplate } : {}) }}
        className={cn(
          "grid items-center border-b border-border/50 hover-elevate group relative",
          !gridTemplate && "grid-cols-[4px_30px_40px_minmax(250px,1fr)_40px_100px_100px_120px_90px_120px_100px_60px_60px_40px]",
          isSubtask && "bg-muted/30",
          task.status === "DONE" && "bg-green-50 dark:bg-green-950/30"
        )}
        data-testid={`task-row-${task.id}`}
      >
        <div 
          className="h-full w-1 rounded-r-sm self-stretch"
          style={{ backgroundColor: jobColor || 'transparent' }}
          title={task.job ? `${task.job.jobNumber} - ${task.job.name}` : undefined}
        />
        <div className="flex items-center justify-center">
          {!isSubtask && onToggleSelected && (
            <Checkbox
              checked={!!isSelected}
              onCheckedChange={() => onToggleSelected()}
              data-testid={`checkbox-task-${task.id}`}
            />
          )}
        </div>
        <div 
          className="flex items-center justify-center px-1"
          {...(sortableAttributes || {})}
          {...(sortableListeners || {})}
        >
          <GripVertical className={cn(
            "h-4 w-4 text-muted-foreground cursor-grab",
            isSubtask ? "opacity-0" : "opacity-0 group-hover:opacity-100"
          )} />
        </div>

        <div className={cn("flex items-start gap-2 py-1 pr-2", isSubtask && "pl-6")}>
          {!isSubtask && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 p-0 shrink-0 mt-1"
              onClick={() => onToggleExpanded?.()}
              data-testid={`btn-toggle-subtasks-${task.id}`}
            >
              {showSubtasks ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
          <textarea
            ref={titleInputRef}
            value={localTitle}
            onChange={(e) => {
              setLocalTitle(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); titleInputRef.current?.blur(); } }}
            rows={1}
            className="flex-1 min-h-[28px] py-1 px-2 border-0 bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-sm resize-none overflow-hidden rounded-md"
            placeholder="Task name..."
            data-testid={`input-task-title-${task.id}`}
          />
          {!isSubtask && hasSubtasks && (
            <span className="text-xs text-muted-foreground shrink-0 mt-1">
              {(task.subtasks || []).length}
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
                onClick={() => onOpenSidebar(task)}
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
                    onClick={() => handleToggleAssignee(user.id)}
                    data-testid={`assignee-option-${user.id}`}
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

        <Select
          value={task.jobId || "none"}
          onValueChange={handleJobChange}
        >
          <SelectTrigger
            className="h-7 border-0 text-xs"
            data-testid={`select-job-${task.id}`}
          >
            <SelectValue placeholder="No job" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No job</SelectItem>
            {jobs.slice().sort((a, b) => (a.jobNumber || '').localeCompare(b.jobNumber || '') || (a.name || '').localeCompare(b.name || '')).map((job) => (
              <SelectItem key={job.id} value={job.id}>
                {job.jobNumber}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={task.status} onValueChange={(v) => handleStatusChange(v as TaskStatus)}>
          <SelectTrigger
            className="h-7 border-0 text-xs justify-center"
            data-testid={`select-status-${task.id}`}
          >
            <div
              className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold text-white", STATUS_CONFIG[task.status].bgClass)}
            >
              {STATUS_CONFIG[task.status].label}
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
                task.dueDate && isBefore(new Date(task.dueDate), startOfDay(new Date())) && task.status !== "DONE" && "text-red-500 hover:text-red-600"
              )}
              data-testid={`btn-date-${task.id}`}
            >
              <CalendarIcon className={cn("h-3 w-3 mr-1", task.dueDate && isBefore(new Date(task.dueDate), startOfDay(new Date())) && task.status !== "DONE" && "text-red-500")} />
              {task.dueDate ? format(new Date(task.dueDate), "dd/MM/yy") : "No date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={task.dueDate ? new Date(task.dueDate) : undefined}
              onSelect={handleDateChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2 text-xs justify-start",
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
          {task.filesCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-xs">
                  <Paperclip className="h-3 w-3" />
                  {task.filesCount}
                </div>
              </TooltipTrigger>
              <TooltipContent>Files</TooltipContent>
            </Tooltip>
          )}
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
            {!isSubtask && (
              <DropdownMenuItem onClick={() => { if (!showSubtasks) onToggleExpanded?.(); }} data-testid={`menu-add-subtask-${task.id}`}>
                <Plus className="h-4 w-4 mr-2" />
                Add subtask
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onOpenSidebar(task)} data-testid={`menu-view-updates-${task.id}`}>
              <MessageSquare className="h-4 w-4 mr-2" />
              View updates
            </DropdownMenuItem>
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

      {showSubtasks &&
        (task.subtasks || [])
          .filter((subtask) => showCompleted || subtask.status !== "DONE")
          .map((subtask) => (
          <TaskRow
            key={subtask.id}
            task={subtask}
            users={users}
            jobs={jobs}
            isSubtask
            onOpenSidebar={onOpenSidebar}
            showCompleted={showCompleted}
          />
        ))}

      {!isSubtask && showSubtasks && (
        <div 
          style={gridTemplate ? { gridTemplateColumns: gridTemplate } : undefined}
          className={cn(
            "grid items-center border-b border-dashed border-border/30 bg-muted/20",
            !gridTemplate && "grid-cols-[4px_30px_40px_minmax(250px,1fr)_40px_100px_100px_120px_90px_120px_100px_60px_60px_40px]"
          )}
          data-testid={`add-subitem-row-${task.id}`}
        >
          <div />
          <div />
          <div />
          <div className="flex items-center gap-2 py-1 pl-8 pr-2">
            <Plus className="h-3 w-3 text-muted-foreground" />
            <Input
              ref={subtaskInputRef}
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateSubtask();
                }
              }}
              className="h-7 border-0 bg-transparent focus-visible:ring-1 text-sm"
              placeholder="Add subitem (press Enter)..."
              disabled={createSubtaskMutation.isPending}
              data-testid={`input-add-subitem-${task.id}`}
            />
          </div>
          
          <div />
          
          <Popover open={showNewSubtaskAssigneePopover} onOpenChange={setShowNewSubtaskAssigneePopover}>
            <PopoverTrigger asChild>
              <div
                className="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-muted/50 rounded"
                data-testid={`new-subitem-assignees-${task.id}`}
              >
                {newSubtaskAssignees.length > 0 ? (
                  <div className="flex -space-x-2">
                    {newSubtaskAssignees.slice(0, 3).map((userId) => {
                      const user = users.find(u => u.id === userId);
                      return (
                        <Avatar key={userId} className="h-5 w-5 border-2 border-background">
                          <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                            {getInitials(user?.name)}
                          </AvatarFallback>
                        </Avatar>
                      );
                    })}
                    {newSubtaskAssignees.length > 3 && (
                      <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[9px] border-2 border-background">
                        +{newSubtaskAssignees.length - 3}
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
                  const isAssigned = newSubtaskAssignees.includes(user.id);
                  return (
                    <div
                      key={user.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded cursor-pointer hover-elevate",
                        isAssigned && "bg-primary/10"
                      )}
                      onClick={() => handleToggleNewSubtaskAssignee(user.id)}
                      data-testid={`new-subitem-assignee-option-${user.id}`}
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

          <Select
            value={newSubtaskJobId || "none"}
            onValueChange={(v) => setNewSubtaskJobId(v === "none" ? null : v)}
          >
            <SelectTrigger
              className="h-7 border-0 text-xs"
              data-testid={`new-subitem-job-${task.id}`}
            >
              <SelectValue placeholder="No job" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No job</SelectItem>
              {jobs.slice().sort((a, b) => (a.jobNumber || '').localeCompare(b.jobNumber || '') || (a.name || '').localeCompare(b.name || '')).map((job) => (
                <SelectItem key={job.id} value={job.id}>
                  {job.jobNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={newSubtaskStatus} 
            onValueChange={(v) => setNewSubtaskStatus(v as TaskStatus)}
          >
            <SelectTrigger
              className="h-7 border-0 text-xs justify-center"
              data-testid={`new-subitem-status-${task.id}`}
            >
              <div
                className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold text-white", STATUS_CONFIG[newSubtaskStatus].bgClass)}
              >
                {STATUS_CONFIG[newSubtaskStatus].label}
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

          <div />

          <Select
            value={newSubtaskProjectStage || "none"}
            onValueChange={(v) => setNewSubtaskProjectStage(v === "none" ? null : v)}
          >
            <SelectTrigger
              className="h-7 border-0 text-xs"
              data-testid={`new-subitem-stage-${task.id}`}
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
                className="h-7 px-2 text-xs justify-start"
                data-testid={`new-subitem-date-${task.id}`}
              >
                <CalendarIcon className="h-3 w-3 mr-1" />
                {newSubtaskDueDate ? format(newSubtaskDueDate, "dd/MM/yy") : "Date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={newSubtaskDueDate || undefined}
                onSelect={(date) => setNewSubtaskDueDate(date || null)}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 text-xs justify-start",
                  newSubtaskReminderDate && "text-amber-600 dark:text-amber-400"
                )}
                data-testid={`new-subitem-reminder-${task.id}`}
              >
                <Bell className={cn("h-4 w-4", newSubtaskReminderDate && "fill-current")} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-2 border-b">
                <p className="text-sm font-medium">Set Reminder</p>
              </div>
              <Calendar
                mode="single"
                selected={newSubtaskReminderDate || undefined}
                onSelect={(date) => setNewSubtaskReminderDate(date || null)}
                initialFocus
              />
              {newSubtaskReminderDate && (
                <div className="p-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-destructive hover:text-destructive"
                    onClick={() => setNewSubtaskReminderDate(null)}
                  >
                    Clear Reminder
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <div />

          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCreateSubtask}
              disabled={!newSubtaskTitle.trim() || createSubtaskMutation.isPending}
              data-testid={`btn-add-subitem-${task.id}`}
            >
              <Check className="h-4 w-4 text-green-600" />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{task.title}"? This action cannot be undone.
              {hasSubtasks && " All subtasks will also be deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTaskMutation.mutate()}
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
