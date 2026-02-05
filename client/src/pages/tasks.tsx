import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { TASKS_ROUTES, USER_ROUTES, JOBS_ROUTES, SETTINGS_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import defaultLogo from "@/assets/lte-logo.png";
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
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
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
  X,
  Send,
  Upload,
  FileText,
  Image,
  File,
  Briefcase,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Printer,
  Bell,
  Filter,
  Eye,
  EyeOff,
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

type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "STUCK" | "DONE" | "ON_HOLD";

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface Job {
  id: string;
  jobNumber: string;
  name: string;
  status: string;
}

interface TaskAssignee {
  id: string;
  taskId: string;
  userId: string;
  user: User;
}

interface Task {
  id: string;
  groupId: string;
  parentId: string | null;
  jobId: string | null;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  reminderDate: string | null;
  consultant: string | null;
  projectStage: string | null;
  sortOrder: number;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  assignees: TaskAssignee[];
  subtasks: Task[];
  updatesCount: number;
  filesCount: number;
  createdBy: User | null;
  job: Job | null;
}

interface TaskGroup {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isCollapsed: boolean;
  tasks: Task[];
}

interface TaskUpdate {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: User;
  files?: TaskFile[];
}

interface TaskFile {
  id: string;
  taskId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedById: string | null;
  createdAt: string;
  uploadedBy: User | null;
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bgClass: string }> = {
  NOT_STARTED: { label: "Not Started", color: "#6b7280", bgClass: "bg-gray-500" },
  IN_PROGRESS: { label: "In Progress", color: "#3b82f6", bgClass: "bg-blue-500" },
  STUCK: { label: "Stuck", color: "#ef4444", bgClass: "bg-red-500" },
  DONE: { label: "Done", color: "#22c55e", bgClass: "bg-green-500" },
  ON_HOLD: { label: "On Hold", color: "#eab308", bgClass: "bg-yellow-500" },
};

const PROJECT_STAGES = [
  "Planning",
  "Design",
  "Development",
  "Testing",
  "Deployment",
  "Completed",
];

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function SortableTaskRow({
  task,
  users,
  jobs,
  onOpenSidebar,
  showCompleted,
  isExpanded,
  onToggleExpanded,
}: {
  task: Task;
  users: User[];
  jobs: Job[];
  onOpenSidebar: (task: Task) => void;
  showCompleted: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
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
    />
  );
}

function TaskRow({
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
}) {
  const { toast } = useToast();
  const [localTitle, setLocalTitle] = useState(task.title);
  const [localConsultant, setLocalConsultant] = useState(task.consultant || "");
  const showSubtasks = isExpanded;
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskAssignees, setNewSubtaskAssignees] = useState<string[]>([]);
  const [newSubtaskJobId, setNewSubtaskJobId] = useState<string | null>(null);
  const [newSubtaskStatus, setNewSubtaskStatus] = useState<TaskStatus>("NOT_STARTED");
  const [newSubtaskDueDate, setNewSubtaskDueDate] = useState<Date | null>(null);
  const [newSubtaskReminderDate, setNewSubtaskReminderDate] = useState<Date | null>(null);
  const [newSubtaskProjectStage, setNewSubtaskProjectStage] = useState<string | null>(null);
  const [showNewSubtaskAssigneePopover, setShowNewSubtaskAssigneePopover] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const subtaskInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAssigneePopover, setShowAssigneePopover] = useState(false);
  

  useEffect(() => {
    setLocalTitle(task.title);
    setLocalConsultant(task.consultant || "");
  }, [task.title, task.consultant]);

  useEffect(() => {
    if (showSubtasks && subtaskInputRef.current) {
      setTimeout(() => subtaskInputRef.current?.focus(), 50);
    }
  }, [showSubtasks]);

  const updateTaskMutation = useMutation({
    mutationFn: async (data: Partial<Task>) => {
      return apiRequest("PATCH", TASKS_ROUTES.BY_ID(task.id), data);
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
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
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
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
      setNewSubtaskDueDate(null);
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

  const handleDateChange = (date: Date | undefined) => {
    const isoDate = date instanceof Date && !isNaN(date.getTime()) ? date.toISOString() : null;
    updateTaskMutation.mutate({ dueDate: isoDate } as any);
  };

  const handleReminderChange = (date: Date | undefined) => {
    const isoDate = date instanceof Date && !isNaN(date.getTime()) ? date.toISOString() : null;
    updateTaskMutation.mutate({ reminderDate: isoDate } as any);
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
    updateTaskMutation.mutate(updateData as any);
  };

  const handleToggleAssignee = (userId: string) => {
    const currentIds = (task.assignees || []).map((a) => a.userId);
    const newIds = currentIds.includes(userId)
      ? currentIds.filter((id) => id !== userId)
      : [...currentIds, userId];
    setAssigneesMutation.mutate(newIds);
  };

  const hasSubtasks = task.subtasks && task.subtasks.length > 0;

  const jobColor = (task.job as any)?.productionSlotColor || null;

  return (
    <>
      <div
        ref={sortableRef}
        style={sortableStyle}
        className={cn(
          "grid grid-cols-[4px_40px_minmax(250px,1fr)_40px_100px_100px_120px_120px_100px_60px_60px_40px] items-center border-b border-border/50 hover-elevate group relative",
          isSubtask && "bg-muted/30",
          task.status === "DONE" && "bg-green-50 dark:bg-green-950/30"
        )}
        data-testid={`task-row-${task.id}`}
      >
        <div 
          className="h-full w-1 rounded-r-sm"
          style={{ backgroundColor: jobColor || 'transparent' }}
          title={task.job ? `${task.job.jobNumber} - ${task.job.name}` : undefined}
        />
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

        <div className={cn("flex items-center gap-2 py-1 pr-2", isSubtask && "pl-6")}>
          {!isSubtask && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 p-0 shrink-0"
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
          <Input
            ref={titleInputRef}
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => e.key === "Enter" && titleInputRef.current?.blur()}
            className="h-7 border-0 bg-transparent focus-visible:ring-1 text-sm"
            placeholder="Task name..."
            data-testid={`input-task-title-${task.id}`}
          />
          {!isSubtask && hasSubtasks && (
            <span className="text-xs text-muted-foreground shrink-0">
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
              {users.map((user) => {
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
            {jobs.map((job) => (
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
            <Badge
              className={cn("text-white text-[10px]", STATUS_CONFIG[task.status].bgClass)}
            >
              {STATUS_CONFIG[task.status].label}
            </Badge>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                <Badge className={cn("text-white text-[10px]", config.bgClass)}>
                  {config.label}
                </Badge>
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
              className="h-7 px-2 text-xs justify-start"
              data-testid={`btn-date-${task.id}`}
            >
              <CalendarIcon className="h-3 w-3 mr-1" />
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
          className="grid grid-cols-[4px_40px_minmax(250px,1fr)_40px_100px_100px_120px_120px_100px_60px_60px_40px] items-center border-b border-dashed border-border/30 bg-muted/20"
          data-testid={`add-subitem-row-${task.id}`}
        >
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
                {users.map((user) => {
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
              {jobs.map((job) => (
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
              <Badge
                className={cn("text-white text-[10px]", STATUS_CONFIG[newSubtaskStatus].bgClass)}
              >
                {STATUS_CONFIG[newSubtaskStatus].label}
              </Badge>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <Badge className={cn("text-white text-[10px]", config.bgClass)}>
                    {config.label}
                  </Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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

type SortOption = "default" | "status" | "date-asc" | "date-desc" | "title";

function TaskGroupComponent({
  group,
  users,
  jobs,
  onOpenSidebar,
  allGroups,
  showCompleted,
}: {
  group: TaskGroup;
  users: User[];
  jobs: Job[];
  onOpenSidebar: (task: Task) => void;
  allGroups: TaskGroup[];
  showCompleted: boolean;
}) {
  const { toast } = useToast();
  const [isCollapsed, setIsCollapsed] = useState(group.isCollapsed);
  const [isEditingName, setIsEditingName] = useState(false);
  const [groupName, setGroupName] = useState(group.name);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>("default");
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };
  
  const sortedTasks = [...group.tasks].sort((a, b) => {
    switch (sortOption) {
      case "status":
        const statusOrder = ["NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "STUCK", "DONE"];
        return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
      case "date-asc":
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      case "date-desc":
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
      case "title":
        return a.title.localeCompare(b.title);
      default:
        return a.sortOrder - b.sortOrder;
    }
  });

  const updateGroupMutation = useMutation({
    mutationFn: async (data: Partial<TaskGroup>) => {
      return apiRequest("PATCH", TASKS_ROUTES.GROUP_BY_ID(group.id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", TASKS_ROUTES.GROUP_BY_ID(group.id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      toast({ title: "Group deleted" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (title: string) => {
      return apiRequest("POST", TASKS_ROUTES.LIST, {
        groupId: group.id,
        title,
        dueDate: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      setNewTaskTitle("");
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    updateGroupMutation.mutate({ isCollapsed: !isCollapsed });
  };

  const handleNameSave = () => {
    if (groupName !== group.name && groupName.trim()) {
      updateGroupMutation.mutate({ name: groupName });
    }
    setIsEditingName(false);
  };

  return (
    <div className="mb-6" data-testid={`task-group-${group.id}`}>
      <div
        className="flex items-center gap-2 py-2 px-2 rounded-t-lg"
        style={{ backgroundColor: `${group.color}20`, borderLeft: `4px solid ${group.color}` }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleToggleCollapse}
          data-testid={`btn-collapse-group-${group.id}`}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>

        {isEditingName ? (
          <Input
            ref={nameInputRef}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={(e) => e.key === "Enter" && handleNameSave()}
            className="h-7 w-48 font-semibold"
            autoFocus
            data-testid={`input-group-name-${group.id}`}
          />
        ) : (
          <span
            className="font-semibold cursor-pointer hover:underline"
            onClick={() => setIsEditingName(true)}
            style={{ color: group.color }}
            data-testid={`text-group-name-${group.id}`}
          >
            {group.name}
          </span>
        )}

        <Badge variant="secondary" className="ml-2">
          {group.tasks.length} items
        </Badge>

        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1" data-testid={`btn-sort-${group.id}`}>
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span className="text-xs">Sort</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSortOption("default")} data-testid={`sort-default-${group.id}`}>
              {sortOption === "default" && <span className="mr-2">✓</span>}
              Default order
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOption("title")} data-testid={`sort-title-${group.id}`}>
              {sortOption === "title" && <span className="mr-2">✓</span>}
              By name
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOption("status")} data-testid={`sort-status-${group.id}`}>
              {sortOption === "status" && <span className="mr-2">✓</span>}
              By status
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOption("date-asc")} data-testid={`sort-date-asc-${group.id}`}>
              {sortOption === "date-asc" && <span className="mr-2">✓</span>}
              <ArrowUp className="h-3 w-3 mr-1" />
              Date (earliest first)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOption("date-desc")} data-testid={`sort-date-desc-${group.id}`}>
              {sortOption === "date-desc" && <span className="mr-2">✓</span>}
              <ArrowDown className="h-3 w-3 mr-1" />
              Date (latest first)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid={`btn-group-menu-${group.id}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsEditingName(true)} data-testid={`menu-rename-group-${group.id}`}>
              Rename group
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => setShowDeleteConfirm(true)}
              data-testid={`menu-delete-group-${group.id}`}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete group
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!isCollapsed && (
        <>
          <div className="grid grid-cols-[4px_40px_minmax(250px,1fr)_40px_100px_100px_120px_120px_100px_60px_60px_40px] text-xs text-muted-foreground font-medium border-b bg-muted/50 py-2">
            <div />
            <div />
            <div className="px-2">Item</div>
            <div />
            <div className="px-2 text-center">Users</div>
            <div className="px-2 text-center">Job</div>
            <div className="px-2 text-center">Status</div>
            <div className="px-2 text-center">Stage</div>
            <div className="px-2 text-center">Date</div>
            <div className="px-2 text-center">Reminder</div>
            <div className="px-2 text-center">Files</div>
            <div />
          </div>

          <SortableContext items={sortedTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {sortedTasks.map((task) => (
              <SortableTaskRow
                key={task.id}
                task={task}
                users={users}
                jobs={jobs}
                onOpenSidebar={onOpenSidebar}
                showCompleted={showCompleted}
                isExpanded={expandedTaskIds.has(task.id)}
                onToggleExpanded={() => toggleTaskExpanded(task.id)}
              />
            ))}
          </SortableContext>

          <div className="grid grid-cols-[4px_40px_minmax(250px,1fr)_40px_100px_100px_120px_120px_100px_60px_60px_40px] items-center border-b border-dashed border-border/50 hover:bg-muted/30">
            <div />
            <div />
            <div className="flex items-center gap-2 py-2 pr-2">
              <Plus className="h-4 w-4 text-muted-foreground" />
              <Input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTaskTitle.trim()) {
                    createTaskMutation.mutate(newTaskTitle);
                  }
                }}
                onBlur={() => {
                  if (newTaskTitle.trim()) {
                    createTaskMutation.mutate(newTaskTitle);
                  }
                }}
                className="h-7 border-0 bg-transparent focus-visible:ring-1 text-sm"
                placeholder="+ Add item"
                data-testid={`input-new-task-${group.id}`}
              />
            </div>
            <div className="col-span-8" />
          </div>
        </>
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{group.name}"? All tasks in this group will also be
              deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteGroupMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TaskSidebar({
  task,
  onClose,
}: {
  task: Task | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"updates" | "files" | "activity">("updates");
  const [newUpdate, setNewUpdate] = useState("");
  const [pastedImages, setPastedImages] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: updates = [], isLoading: updatesLoading } = useQuery<TaskUpdate[]>({
    queryKey: [TASKS_ROUTES.UPDATES(task?.id || "")],
    enabled: !!task,
  });

  const { data: files = [], isLoading: filesLoading } = useQuery<TaskFile[]>({
    queryKey: [TASKS_ROUTES.FILES(task?.id || "")],
    enabled: !!task,
  });

  const createUpdateMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", TASKS_ROUTES.UPDATES(task?.id || ""), { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.UPDATES(task?.id || "")] });
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      setNewUpdate("");
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deleteUpdateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", TASKS_ROUTES.UPDATE_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.UPDATES(task?.id || "")] });
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async ({ file, updateId }: { file: File; updateId?: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (updateId) formData.append("updateId", updateId);
      const res = await fetch(TASKS_ROUTES.FILES(task?.id || ""), {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to upload file");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.FILES(task?.id || "")] });
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      toast({ title: "File uploaded" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", TASKS_ROUTES.FILE_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.FILES(task?.id || "")] });
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      toast({ title: "File deleted" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFileMutation.mutate({ file });
    }
  };

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    const imageFiles: File[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          // Rename the file using Object.defineProperty to avoid TypeScript issues with File constructor
          const timestamp = Date.now();
          const extension = item.type.split("/")[1] || "png";
          const newFileName = `screenshot_${timestamp}.${extension}`;
          Object.defineProperty(file, 'name', {
            writable: true,
            value: newFileName
          });
          imageFiles.push(file);
        }
      }
    }
    
    if (imageFiles.length > 0) {
      e.preventDefault();
      setPastedImages(prev => [...prev, ...imageFiles]);
      toast({ title: `${imageFiles.length} image(s) pasted`, description: "Click Post Update to upload" });
    }
  }, [toast]);

  const removePastedImage = (index: number) => {
    setPastedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handlePostUpdate = async () => {
    if (!newUpdate.trim() && pastedImages.length === 0) return;
    
    try {
      // Create the update first to get the updateId
      const content = newUpdate.trim();
      const update = await createUpdateMutation.mutateAsync(content);
      const updateId = update?.id;
      
      // Upload pasted images with the updateId
      if (pastedImages.length > 0) {
        for (const file of pastedImages) {
          await uploadFileMutation.mutateAsync({ file, updateId });
        }
        // Refresh updates to show the linked files
        queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.UPDATES(task?.id || "")] });
      }
      
      setPastedImages([]);
    } catch (error) {
      // Error is already handled by mutation onError
    }
  };

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <File className="h-4 w-4" />;
    if (mimeType.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (mimeType.includes("pdf")) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!task) return null;

  return (
    <Sheet open={!!task} onOpenChange={() => onClose()}>
      <SheetContent className="w-[400px] sm:w-[500px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">{task.title}</SheetTitle>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="btn-close-sidebar">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              variant={activeTab === "updates" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("updates")}
              data-testid="tab-updates"
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              Updates
            </Button>
            <Button
              variant={activeTab === "files" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("files")}
              data-testid="tab-files"
            >
              <Paperclip className="h-4 w-4 mr-1" />
              Files
            </Button>
            <Button
              variant={activeTab === "activity" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("activity")}
              data-testid="tab-activity"
            >
              Activity Log
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "updates" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <Textarea
                  ref={textareaRef}
                  value={newUpdate}
                  onChange={(e) => setNewUpdate(e.target.value)}
                  onPaste={handlePaste}
                  placeholder="Write an update and mention others with @ - paste screenshots here"
                  className="min-h-[80px] resize-none"
                  data-testid="input-new-update"
                />
                {pastedImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2 border rounded-lg bg-muted/30">
                    {pastedImages.map((file, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Pasted screenshot ${index + 1}`}
                          className="h-16 w-auto rounded border object-cover"
                        />
                        <button
                          onClick={() => removePastedImage(index)}
                          className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          data-testid={`btn-remove-pasted-image-${index}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <span className="text-xs text-muted-foreground self-center">
                      {pastedImages.length} screenshot(s) ready to upload
                    </span>
                  </div>
                )}
              </div>
              <Button
                onClick={handlePostUpdate}
                disabled={(!newUpdate.trim() && pastedImages.length === 0) || createUpdateMutation.isPending || uploadFileMutation.isPending}
                className="w-full"
                data-testid="btn-post-update"
              >
                <Send className="h-4 w-4 mr-2" />
                {uploadFileMutation.isPending ? "Uploading..." : "Post Update"}
              </Button>

              {updatesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : updates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No updates yet</p>
                  <p className="text-sm">Share progress, mention a teammate, or upload a file to get things moving</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {updates.map((update) => (
                    <div key={update.id} className="border rounded-lg p-3 group" data-testid={`update-${update.id}`}>
                      <div className="flex items-start gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{getInitials(update.user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{update.user.name || update.user.email}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(update.createdAt), "dd/MM/yyyy HH:mm")}
                            </span>
                          </div>
                          {update.content && (
                            <p className="text-sm mt-1 whitespace-pre-wrap">{update.content}</p>
                          )}
                          {update.files && update.files.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {update.files.map((file) => (
                                file.mimeType?.startsWith("image/") ? (
                                  <a
                                    key={file.id}
                                    href={file.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block"
                                  >
                                    <img
                                      src={file.fileUrl}
                                      alt={file.fileName}
                                      className="max-w-full max-h-48 rounded border object-contain cursor-pointer hover:opacity-90"
                                      data-testid={`update-image-${file.id}`}
                                    />
                                  </a>
                                ) : (
                                  <a
                                    key={file.id}
                                    href={file.fileUrl}
                                    download={file.fileName}
                                    className="flex items-center gap-2 p-2 border rounded text-sm hover-elevate"
                                    data-testid={`update-file-${file.id}`}
                                  >
                                    <Paperclip className="h-4 w-4" />
                                    {file.fileName}
                                  </a>
                                )
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={() => deleteUpdateMutation.mutate(update.id)}
                          data-testid={`btn-delete-update-${update.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "files" && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadFileMutation.isPending}
                data-testid="btn-upload-file"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadFileMutation.isPending ? "Uploading..." : "Upload File"}
              </Button>

              {filesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : files.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Paperclip className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No files attached</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-3 border rounded-lg group hover-elevate"
                      data-testid={`file-${file.id}`}
                    >
                      {getFileIcon(file.mimeType)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.fileSize)} • {format(new Date(file.createdAt), "dd/MM/yyyy")}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={() => deleteFileMutation.mutate(file.id)}
                        data-testid={`btn-delete-file-${file.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "activity" && (
            <div className="space-y-4">
              <div className="text-center py-8 text-muted-foreground">
                <p>Activity log coming soon</p>
                <p className="text-sm">Track all changes made to this task</p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function TasksPage() {
  const { toast } = useToast();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [dueDateFilter, setDueDateFilter] = useState<string>("all");
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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
  const reportLogo = brandingSettings?.logoBase64 || defaultLogo;
  const companyName = brandingSettings?.companyName || "LTE Precast Concrete Structures";

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
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const headerHeight = 30;
      const footerHeight = 12;
      let yPos = headerHeight + 5;

      const maxLogoHeight = 12;
      const maxLogoWidth = 30;
      let logoWidth = maxLogoWidth;
      let logoHeight = maxLogoHeight;
      
      try {
        const img = document.createElement("img");
        img.src = reportLogo;
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
        
        if (img.naturalWidth && img.naturalHeight) {
          const aspectRatio = img.naturalWidth / img.naturalHeight;
          if (aspectRatio > maxLogoWidth / maxLogoHeight) {
            logoWidth = maxLogoWidth;
            logoHeight = maxLogoWidth / aspectRatio;
          } else {
            logoHeight = maxLogoHeight;
            logoWidth = maxLogoHeight * aspectRatio;
          }
        }
        
        pdf.addImage(reportLogo, "PNG", margin, 8, logoWidth, logoHeight, undefined, "FAST");
      } catch (e) {}

      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text("Task List", margin + maxLogoWidth + 8, 14);

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      pdf.text(companyName, margin + maxLogoWidth + 8, 20);

      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text(`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pdfWidth - margin, 14, { align: "right" });

      if (jobFilter !== "all") {
        const filterLabel = jobFilter === "none" 
          ? "No Job Assigned" 
          : jobs.find(j => j.id === jobFilter)?.name || "";
        pdf.text(`Filter: ${filterLabel}`, pdfWidth - margin, 20, { align: "right" });
      }

      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, headerHeight - 2, pdfWidth - margin, headerHeight - 2);

      const getStatusColor = (status: string): [number, number, number] => {
        switch (status) {
          case "NOT_STARTED": return [107, 114, 128];
          case "IN_PROGRESS": return [59, 130, 246];
          case "STUCK": return [239, 68, 68];
          case "DONE": return [34, 197, 94];
          case "ON_HOLD": return [245, 158, 11];
          default: return [107, 114, 128];
        }
      };

      const formatStatus = (status: string) => {
        return status.replace(/_/g, " ");
      };

      const checkNewPage = (requiredHeight: number) => {
        if (yPos + requiredHeight > pdfHeight - footerHeight - 10) {
          addFooter();
          pdf.addPage();
          yPos = margin;
          return true;
        }
        return false;
      };

      const addFooter = () => {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(0, pdfHeight - footerHeight, pdfWidth, footerHeight, "F");
        pdf.setDrawColor(226, 232, 240);
        pdf.line(0, pdfHeight - footerHeight, pdfWidth, pdfHeight - footerHeight);
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);
        pdf.text(`${companyName} - Confidential`, margin, pdfHeight - 5);
        pdf.text(`Page ${pdf.getNumberOfPages()}`, pdfWidth - margin, pdfHeight - 5, { align: "right" });
      };

      for (const group of filteredGroups) {
        if (group.tasks.length === 0) continue;

        checkNewPage(25);

        pdf.setFillColor(241, 245, 249);
        pdf.roundedRect(margin, yPos, pdfWidth - margin * 2, 8, 1, 1, "F");
        pdf.setTextColor(51, 65, 85);
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.text(group.name, margin + 3, yPos + 5.5);
        const groupNameWidth = pdf.getTextWidth(group.name);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(100, 116, 139);
        pdf.text(`(${group.tasks.length} tasks)`, margin + 3 + groupNameWidth + 4, yPos + 5.5);
        yPos += 12;

        const colWidths = {
          task: 70,
          status: 25,
          assignee: 35,
          dueDate: 25,
          job: 25,
        };
        const tableWidth = pdfWidth - margin * 2;
        const startX = margin;

        pdf.setFillColor(248, 250, 252);
        pdf.rect(startX, yPos, tableWidth, 7, "F");
        pdf.setDrawColor(226, 232, 240);
        pdf.line(startX, yPos, startX + tableWidth, yPos);
        pdf.line(startX, yPos + 7, startX + tableWidth, yPos + 7);

        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(71, 85, 105);
        let xPos = startX + 2;
        pdf.text("Task", xPos, yPos + 5);
        xPos += colWidths.task;
        pdf.text("Status", xPos, yPos + 5);
        xPos += colWidths.status;
        pdf.text("Assignee", xPos, yPos + 5);
        xPos += colWidths.assignee;
        pdf.text("Due Date", xPos, yPos + 5);
        xPos += colWidths.dueDate;
        pdf.text("Job", xPos, yPos + 5);
        yPos += 8;

        const drawTask = (task: Task, indent: number = 0) => {
          checkNewPage(8);

          pdf.setDrawColor(241, 245, 249);
          pdf.line(startX, yPos + 6, startX + tableWidth, yPos + 6);

          let xPos = startX + 2 + indent;
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(30, 41, 59);
          pdf.setFontSize(8);

          const taskTitle = task.title.length > 40 - indent / 2 
            ? task.title.substring(0, 37 - indent / 2) + "..." 
            : task.title;
          pdf.text(indent > 0 ? `└ ${taskTitle}` : taskTitle, xPos, yPos + 4);

          xPos = startX + 2 + colWidths.task;
          const statusColor = getStatusColor(task.status);
          pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
          pdf.roundedRect(xPos, yPos + 0.5, 20, 5, 1, 1, "F");
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(6);
          pdf.text(formatStatus(task.status), xPos + 1, yPos + 4);

          xPos += colWidths.status;
          pdf.setTextColor(71, 85, 105);
          pdf.setFontSize(8);
          const assignees = task.assignees?.map(a => a.user?.name?.split(" ")[0] || "").filter(Boolean).join(", ") || "-";
          const assigneeText = assignees.length > 18 ? assignees.substring(0, 15) + "..." : assignees;
          pdf.text(assigneeText, xPos, yPos + 4);

          xPos += colWidths.assignee;
          pdf.text(task.dueDate ? format(new Date(task.dueDate), "dd/MM/yy") : "-", xPos, yPos + 4);

          xPos += colWidths.dueDate;
          const jobText = task.job ? `${(task.job as any).jobNumber}` : "-";
          pdf.text(jobText.length > 12 ? jobText.substring(0, 9) + "..." : jobText, xPos, yPos + 4);

          yPos += 7;

          if (task.subtasks && task.subtasks.length > 0) {
            for (const subtask of task.subtasks) {
              drawTask(subtask, 6);
            }
          }
        };

        for (const task of group.tasks) {
          drawTask(task);
        }

        yPos += 6;
      }

      addFooter();

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
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeTaskInfo = findTaskById(active.id as string);
    if (!activeTaskInfo) return;

    const overId = over.id as string;
    
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
          <h1 className="text-2xl font-bold">Tasks</h1>
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
                {jobs.map((job) => (
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
            onClick={exportToPDF}
            disabled={isExporting || filteredGroups.every(g => g.tasks.length === 0)}
            data-testid="btn-export-pdf"
          >
            <Printer className="h-4 w-4 mr-2" />
            {isExporting ? "Exporting..." : "Print"}
          </Button>
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
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
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
    </div>
  );
}
