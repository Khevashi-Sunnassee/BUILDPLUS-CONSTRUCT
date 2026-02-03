import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
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

function TaskRow({
  task,
  users,
  jobs,
  isSubtask = false,
  onOpenSidebar,
}: {
  task: Task;
  users: User[];
  jobs: Job[];
  isSubtask?: boolean;
  onOpenSidebar: (task: Task) => void;
}) {
  const { toast } = useToast();
  const [localTitle, setLocalTitle] = useState(task.title);
  const [localConsultant, setLocalConsultant] = useState(task.consultant || "");
  const [showSubtasks, setShowSubtasks] = useState(true);
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAssigneePopover, setShowAssigneePopover] = useState(false);

  useEffect(() => {
    setLocalTitle(task.title);
    setLocalConsultant(task.consultant || "");
  }, [task.title, task.consultant]);

  const updateTaskMutation = useMutation({
    mutationFn: async (data: Partial<Task>) => {
      return apiRequest("PATCH", `/api/tasks/${task.id}`, data);
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ["/api/task-groups"] });
      const previousGroups = queryClient.getQueryData(["/api/task-groups"]);
      queryClient.setQueryData(["/api/task-groups"], (old: any) => {
        if (!old) return old;
        return old.map((group: any) => ({
          ...group,
          tasks: group.tasks.map((t: any) =>
            t.id === task.id ? { ...t, ...newData } : t
          ),
        }));
      });
      return { previousGroups };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousGroups) {
        queryClient.setQueryData(["/api/task-groups"], context.previousGroups);
      }
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-groups"] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/tasks/${task.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-groups"] });
      toast({ title: "Task deleted" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const setAssigneesMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      return apiRequest("PUT", `/api/tasks/${task.id}/assignees`, { userIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-groups"] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const createSubtaskMutation = useMutation({
    mutationFn: async (title: string) => {
      return apiRequest("POST", "/api/tasks", {
        groupId: task.groupId,
        parentId: task.id,
        title,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-groups"] });
      setNewSubtaskTitle("");
      setShowAddSubtask(false);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

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
    updateTaskMutation.mutate({ dueDate: date?.toISOString() || null } as any);
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
    const currentIds = task.assignees.map((a) => a.userId);
    const newIds = currentIds.includes(userId)
      ? currentIds.filter((id) => id !== userId)
      : [...currentIds, userId];
    setAssigneesMutation.mutate(newIds);
  };

  const hasSubtasks = task.subtasks && task.subtasks.length > 0;

  return (
    <>
      <div
        className={cn(
          "grid grid-cols-[40px_minmax(250px,1fr)_40px_100px_100px_120px_120px_100px_60px_40px] items-center border-b border-border/50 hover-elevate group",
          isSubtask && "bg-muted/30"
        )}
        data-testid={`task-row-${task.id}`}
      >
        <div className="flex items-center justify-center px-1">
          <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
        </div>

        <div className={cn("flex items-center gap-2 py-2 pr-2", isSubtask && "pl-6")}>
          {!isSubtask && hasSubtasks && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 p-0"
              onClick={() => setShowSubtasks(!showSubtasks)}
              data-testid={`btn-toggle-subtasks-${task.id}`}
            >
              {showSubtasks ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
          {!isSubtask && !hasSubtasks && <div className="w-5" />}
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
        </div>

        <div className="flex items-center justify-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
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
              {task.assignees.length > 0 ? (
                <div className="flex -space-x-2">
                  {task.assignees.slice(0, 3).map((assignee) => (
                    <Avatar key={assignee.id} className="h-6 w-6 border-2 border-background">
                      <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                        {getInitials(assignee.user.name)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {task.assignees.length > 3 && (
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] border-2 border-background">
                      +{task.assignees.length - 3}
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
                const isAssigned = task.assignees.some((a) => a.userId === user.id);
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
              className="h-7 w-7 opacity-0 group-hover:opacity-100"
              data-testid={`btn-task-menu-${task.id}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!isSubtask && (
              <DropdownMenuItem onClick={() => setShowAddSubtask(true)} data-testid={`menu-add-subtask-${task.id}`}>
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
        task.subtasks.map((subtask) => (
          <TaskRow
            key={subtask.id}
            task={subtask as any}
            users={users}
            jobs={jobs}
            isSubtask
            onOpenSidebar={onOpenSidebar}
          />
        ))}

      {showAddSubtask && (
        <div className="grid grid-cols-[40px_minmax(250px,1fr)_40px_100px_100px_120px_120px_100px_60px_40px] items-center border-b border-border/50 bg-muted/30">
          <div />
          <div className="flex items-center gap-2 py-2 pl-6 pr-2">
            <div className="w-5" />
            <Input
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newSubtaskTitle.trim()) {
                  createSubtaskMutation.mutate(newSubtaskTitle);
                }
                if (e.key === "Escape") {
                  setShowAddSubtask(false);
                  setNewSubtaskTitle("");
                }
              }}
              className="h-7 border-0 bg-transparent focus-visible:ring-1 text-sm"
              placeholder="New subtask..."
              autoFocus
              data-testid="input-new-subtask"
            />
          </div>
          <div className="col-span-7 flex items-center gap-2 px-2">
            <Button
              size="sm"
              className="h-6"
              onClick={() => newSubtaskTitle.trim() && createSubtaskMutation.mutate(newSubtaskTitle)}
              disabled={!newSubtaskTitle.trim() || createSubtaskMutation.isPending}
              data-testid="btn-save-subtask"
            >
              Add
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6"
              onClick={() => {
                setShowAddSubtask(false);
                setNewSubtaskTitle("");
              }}
              data-testid="btn-cancel-subtask"
            >
              Cancel
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

function TaskGroupComponent({
  group,
  users,
  jobs,
  onOpenSidebar,
}: {
  group: TaskGroup;
  users: User[];
  jobs: Job[];
  onOpenSidebar: (task: Task) => void;
}) {
  const { toast } = useToast();
  const [isCollapsed, setIsCollapsed] = useState(group.isCollapsed);
  const [isEditingName, setIsEditingName] = useState(false);
  const [groupName, setGroupName] = useState(group.name);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const updateGroupMutation = useMutation({
    mutationFn: async (data: Partial<TaskGroup>) => {
      return apiRequest("PATCH", `/api/task-groups/${group.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-groups"] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/task-groups/${group.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-groups"] });
      toast({ title: "Group deleted" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (title: string) => {
      return apiRequest("POST", "/api/tasks", {
        groupId: group.id,
        title,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-groups"] });
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
          <div className="grid grid-cols-[40px_minmax(250px,1fr)_40px_100px_100px_120px_120px_100px_60px_40px] text-xs text-muted-foreground font-medium border-b bg-muted/50 py-2">
            <div />
            <div className="px-2">Item</div>
            <div />
            <div className="px-2 text-center">Users</div>
            <div className="px-2 text-center">Job</div>
            <div className="px-2 text-center">Status</div>
            <div className="px-2 text-center">Stage</div>
            <div className="px-2 text-center">Date</div>
            <div className="px-2 text-center">Files</div>
            <div />
          </div>

          {group.tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              users={users}
              jobs={jobs}
              onOpenSidebar={onOpenSidebar}
            />
          ))}

          <div className="grid grid-cols-[40px_minmax(250px,1fr)_40px_100px_100px_120px_120px_100px_60px_40px] items-center border-b border-dashed border-border/50 hover:bg-muted/30">
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: updates = [], isLoading: updatesLoading } = useQuery<TaskUpdate[]>({
    queryKey: [`/api/tasks/${task?.id}/updates`],
    enabled: !!task,
  });

  const { data: files = [], isLoading: filesLoading } = useQuery<TaskFile[]>({
    queryKey: [`/api/tasks/${task?.id}/files`],
    enabled: !!task,
  });

  const createUpdateMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", `/api/tasks/${task?.id}/updates`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task?.id}/updates`] });
      queryClient.invalidateQueries({ queryKey: ["/api/task-groups"] });
      setNewUpdate("");
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deleteUpdateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/task-updates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task?.id}/updates`] });
      queryClient.invalidateQueries({ queryKey: ["/api/task-groups"] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/tasks/${task?.id}/files`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to upload file");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task?.id}/files`] });
      queryClient.invalidateQueries({ queryKey: ["/api/task-groups"] });
      toast({ title: "File uploaded" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/task-files/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task?.id}/files`] });
      queryClient.invalidateQueries({ queryKey: ["/api/task-groups"] });
      toast({ title: "File deleted" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFileMutation.mutate(file);
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
              <div className="flex gap-2">
                <Textarea
                  value={newUpdate}
                  onChange={(e) => setNewUpdate(e.target.value)}
                  placeholder="Write an update and mention others with @"
                  className="min-h-[80px] resize-none"
                  data-testid="input-new-update"
                />
              </div>
              <Button
                onClick={() => newUpdate.trim() && createUpdateMutation.mutate(newUpdate)}
                disabled={!newUpdate.trim() || createUpdateMutation.isPending}
                className="w-full"
                data-testid="btn-post-update"
              >
                <Send className="h-4 w-4 mr-2" />
                Post Update
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
                          <p className="text-sm mt-1 whitespace-pre-wrap">{update.content}</p>
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

  const { data: groups = [], isLoading } = useQuery<TaskGroup[]>({
    queryKey: ["/api/task-groups"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const filteredGroups = groups.map((group) => ({
    ...group,
    tasks: group.tasks.filter((task) => {
      if (jobFilter === "all") return true;
      if (jobFilter === "none") return !task.jobId;
      return task.jobId === jobFilter;
    }),
  }));

  const createGroupMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", "/api/task-groups", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-groups"] });
      setNewGroupName("");
      setShowNewGroupInput(false);
      toast({ title: "Group created" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

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
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <Select value={jobFilter} onValueChange={setJobFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-job-filter">
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
            />
          ))}
        </div>
      )}

      <TaskSidebar task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
