import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TASKS_ROUTES } from "@shared/api-routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format } from "date-fns";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Pause, 
  Circle, 
  ChevronDown, 
  ChevronRight,
  Plus,
  Calendar,
  User,
  Pencil,
  Save,
  X,
  Loader2,
  Eye,
  EyeOff,
  FolderPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "STUCK" | "DONE" | "ON_HOLD";

interface TaskAssignee {
  id: string;
  userId: string;
  user: { id: string; name: string | null; email: string };
}

interface Task {
  id: string;
  groupId: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  priority: string | null;
  consultant: string | null;
  projectStage: string | null;
  assignees: TaskAssignee[];
}

interface TaskGroup {
  id: string;
  name: string;
  color: string;
  isCollapsed: boolean;
  tasks: Task[];
}

const statusConfig: Record<TaskStatus, { icon: typeof Circle; label: string; color: string; bgColor: string }> = {
  NOT_STARTED: { icon: Circle, label: "Not Started", color: "text-white/40", bgColor: "bg-white/10" },
  IN_PROGRESS: { icon: Clock, label: "In Progress", color: "text-blue-400", bgColor: "bg-blue-500" },
  STUCK: { icon: AlertCircle, label: "Stuck", color: "text-red-400", bgColor: "bg-red-500" },
  DONE: { icon: CheckCircle2, label: "Done", color: "text-green-400", bgColor: "bg-green-500" },
  ON_HOLD: { icon: Pause, label: "On Hold", color: "text-yellow-400", bgColor: "bg-yellow-500" },
};

const statusOrder: TaskStatus[] = ["NOT_STARTED", "IN_PROGRESS", "STUCK", "ON_HOLD", "DONE"];

const priorityColors: Record<string, string> = {
  LOW: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  CRITICAL: "bg-red-500/20 text-red-400 border-red-500/30",
};

const GROUP_COLORS = [
  "#6b7280", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", 
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#06b6d4",
];

export default function MobileTasksPage() {
  const { toast } = useToast();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newTaskGroupId, setNewTaskGroupId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [hideDone, setHideDone] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0]);

  const { data: groups = [], isLoading } = useQuery<TaskGroup[]>({
    queryKey: [TASKS_ROUTES.GROUPS],
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: Partial<Task> }) => {
      return apiRequest("PATCH", TASKS_ROUTES.BY_ID(taskId), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
    },
    onError: () => {
      toast({ title: "Failed to update task", variant: "destructive" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async ({ groupId, title }: { groupId: string; title: string }) => {
      return apiRequest("POST", TASKS_ROUTES.LIST, { groupId, title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      setNewTaskGroupId(null);
      setNewTaskTitle("");
    },
    onError: () => {
      toast({ title: "Failed to create task", variant: "destructive" });
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      return apiRequest("POST", TASKS_ROUTES.GROUPS, { name, color });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      setShowCreateGroup(false);
      setNewGroupName("");
      setNewGroupColor(GROUP_COLORS[0]);
    },
    onError: () => {
      toast({ title: "Failed to create group", variant: "destructive" });
    },
  });

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const cycleStatus = (task: Task) => {
    const currentIndex = statusOrder.indexOf(task.status);
    const nextIndex = (currentIndex + 1) % statusOrder.length;
    const nextStatus = statusOrder[nextIndex];
    updateTaskMutation.mutate({ taskId: task.id, data: { status: nextStatus } });
  };

  const handleCreateTask = (groupId: string) => {
    if (newTaskTitle.trim()) {
      createTaskMutation.mutate({ groupId, title: newTaskTitle.trim() });
    }
  };

  const totalTasks = groups.reduce((sum, g) => sum + (g.tasks?.length || 0), 0);
  const activeTasks = groups.reduce((sum, g) => sum + (g.tasks?.filter(t => t.status !== "DONE").length || 0), 0);

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-2xl font-bold" data-testid="text-tasks-title">Tasks</div>
              <div className="text-sm text-white/60">
                {activeTasks} active of {totalTasks} total
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setHideDone(!hideDone)}
                className={cn("rounded-full", hideDone ? "text-white/40" : "text-green-400")}
                data-testid="button-toggle-done"
              >
                {hideDone ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setShowCreateGroup(true)}
                className="rounded-full text-blue-400"
                data-testid="button-create-group"
              >
                <FolderPlus className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-12 rounded-2xl bg-white/10" />
                <Skeleton className="h-16 rounded-2xl bg-white/5" />
                <Skeleton className="h-16 rounded-2xl bg-white/5" />
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="h-12 w-12 mx-auto text-white/30 mb-3" />
            <p className="text-white/60">No task groups yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => {
              const isCollapsed = collapsedGroups.has(group.id);
              const allGroupTasks = group.tasks || [];
              const groupTasks = hideDone ? allGroupTasks.filter(t => t.status !== "DONE") : allGroupTasks;
              const activeCount = allGroupTasks.filter(t => t.status !== "DONE").length;

              return (
                <div key={group.id} className="space-y-2">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl border border-white/10 bg-white/5"
                    data-testid={`group-${group.id}`}
                  >
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: group.color || "#6b7280" }}
                    />
                    <span className="font-semibold flex-1 text-left text-white">{group.name}</span>
                    <span className="text-sm text-white/60">
                      {activeCount}/{allGroupTasks.length}
                    </span>
                    {isCollapsed ? (
                      <ChevronRight className="h-5 w-5 text-white/40" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-white/40" />
                    )}
                  </button>

                  {!isCollapsed && (
                    <div className="space-y-2 ml-2">
                      {groupTasks.map((task) => {
                        const statusInfo = statusConfig[task.status];
                        const StatusIcon = statusInfo.icon;

                        return (
                          <div
                            key={task.id}
                            className="flex items-start gap-3 p-4 rounded-2xl border border-white/10 bg-white/5"
                            data-testid={`task-${task.id}`}
                          >
                            <button
                              onClick={() => cycleStatus(task)}
                              className="mt-0.5 flex-shrink-0"
                              data-testid={`task-status-${task.id}`}
                            >
                              <StatusIcon className={cn("h-6 w-6", statusInfo.color)} />
                            </button>
                            
                            <button 
                              onClick={() => setSelectedTask(task)}
                              className="flex-1 min-w-0 text-left"
                            >
                              <h3 className={cn(
                                "font-medium text-sm leading-snug text-white",
                                task.status === "DONE" && "line-through text-white/40"
                              )}>
                                {task.title}
                              </h3>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                {task.priority && (
                                  <Badge variant="outline" className={cn("text-xs border", priorityColors[task.priority])}>
                                    {task.priority}
                                  </Badge>
                                )}
                                {task.dueDate && (
                                  <span className="text-xs text-white/50 flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(task.dueDate), "dd MMM")}
                                  </span>
                                )}
                                {task.assignees?.length > 0 && (
                                  <span className="text-xs text-white/50 flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {task.assignees.length}
                                  </span>
                                )}
                              </div>
                            </button>
                          </div>
                        );
                      })}

                      {newTaskGroupId === group.id ? (
                        <div className="flex items-center gap-2 p-3 rounded-2xl border border-white/10 bg-white/5">
                          <Input
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="Task name..."
                            className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleCreateTask(group.id);
                              if (e.key === "Escape") {
                                setNewTaskGroupId(null);
                                setNewTaskTitle("");
                              }
                            }}
                            data-testid="input-new-task"
                          />
                          <Button 
                            size="sm" 
                            onClick={() => handleCreateTask(group.id)}
                            disabled={!newTaskTitle.trim() || createTaskMutation.isPending}
                            className="bg-blue-500 hover:bg-blue-600"
                            data-testid="button-create-task"
                          >
                            Add
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              setNewTaskGroupId(null);
                              setNewTaskTitle("");
                            }}
                            className="text-white/60"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setNewTaskGroupId(group.id)}
                          className="w-full justify-start text-white/50"
                          data-testid={`button-add-task-${group.id}`}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add task
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Sheet open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl bg-[#0D1117] border-white/10">
          {selectedTask && (
            <TaskDetailSheet 
              task={selectedTask} 
              onClose={() => setSelectedTask(null)}
              onSave={(data) => {
                updateTaskMutation.mutate(
                  { taskId: selectedTask.id, data },
                  {
                    onSuccess: () => {
                      setSelectedTask({ ...selectedTask, ...data } as Task);
                    },
                  }
                );
              }}
              isSaving={updateTaskMutation.isPending}
            />
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={showCreateGroup} onOpenChange={(open) => {
        setShowCreateGroup(open);
        if (!open) { setNewGroupName(""); setNewGroupColor(GROUP_COLORS[0]); }
      }}>
        <SheetContent side="bottom" className="rounded-t-2xl bg-[#0D1117] border-white/10">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-left text-white flex items-center gap-2">
              <FolderPlus className="h-4 w-4 text-blue-400" />
              New Group
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium text-white/60 mb-2 block">Group Name</label>
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Enter group name..."
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newGroupName.trim()) {
                    createGroupMutation.mutate({ name: newGroupName.trim(), color: newGroupColor });
                  }
                }}
                data-testid="input-new-group-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-white/60 mb-2 block">Color</label>
              <div className="flex flex-wrap gap-3">
                {GROUP_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewGroupColor(color)}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all",
                      newGroupColor === color ? "ring-2 ring-white ring-offset-2 ring-offset-[#0D1117] scale-110" : "opacity-60"
                    )}
                    style={{ backgroundColor: color }}
                    data-testid={`color-option-${color}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 border-white/20 text-white"
                onClick={() => {
                  setShowCreateGroup(false);
                  setNewGroupName("");
                  setNewGroupColor(GROUP_COLORS[0]);
                }}
                data-testid="button-cancel-create-group"
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-blue-500"
                onClick={() => createGroupMutation.mutate({ name: newGroupName.trim(), color: newGroupColor })}
                disabled={!newGroupName.trim() || createGroupMutation.isPending}
                data-testid="button-submit-create-group"
              >
                {createGroupMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-1" />
                )}
                Create Group
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <MobileBottomNav />
    </div>
  );
}

const priorityOptions = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

function TaskDetailSheet({ 
  task, 
  onClose,
  onSave,
  isSaving,
}: { 
  task: Task; 
  onClose: () => void;
  onSave: (data: Partial<Task>) => void;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState(task.title);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.split("T")[0] : "");
  const [priority, setPriority] = useState(task.priority || "");
  const [consultant, setConsultant] = useState(task.consultant || "");
  const [projectStage, setProjectStage] = useState(task.projectStage || "");

  useEffect(() => {
    setTitle(task.title);
    setStatus(task.status);
    setDueDate(task.dueDate ? task.dueDate.split("T")[0] : "");
    setPriority(task.priority || "");
    setConsultant(task.consultant || "");
    setProjectStage(task.projectStage || "");
  }, [task.id]);

  const hasChanges = 
    title !== task.title ||
    status !== task.status ||
    (dueDate || null) !== (task.dueDate ? task.dueDate.split("T")[0] : null) ||
    (priority || null) !== task.priority ||
    (consultant || null) !== (task.consultant || null) ||
    (projectStage || null) !== (task.projectStage || null);

  const handleSave = () => {
    const data: Record<string, any> = {};
    if (title !== task.title) data.title = title;
    if (status !== task.status) data.status = status;
    if ((dueDate || null) !== (task.dueDate ? task.dueDate.split("T")[0] : null)) {
      data.dueDate = dueDate || null;
    }
    if ((priority || null) !== task.priority) {
      data.priority = priority || null;
    }
    if ((consultant || "") !== (task.consultant || "")) data.consultant = consultant || null;
    if ((projectStage || "") !== (task.projectStage || "")) data.projectStage = projectStage || null;
    if (Object.keys(data).length > 0) {
      onSave(data);
    }
  };

  return (
    <div className="flex flex-col h-full text-white">
      <SheetHeader className="pb-4">
        <div className="flex items-center justify-between gap-2">
          <SheetTitle className="text-left text-white flex items-center gap-2">
            <Pencil className="h-4 w-4 text-white/60" />
            Edit Task
          </SheetTitle>
          {hasChanges && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className="bg-blue-500"
              data-testid="button-save-task"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save
            </Button>
          )}
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-auto space-y-5">
        <div>
          <label className="text-sm font-medium text-white/60 mb-2 block">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
            data-testid="input-task-title"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-white/60 mb-2 block">Status</label>
          <div className="flex flex-wrap gap-2">
            {statusOrder.map((s) => {
              const config = statusConfig[s];
              const isActive = status === s;
              
              return (
                <Button
                  key={s}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatus(s)}
                  className={cn(
                    "flex items-center gap-2",
                    isActive ? config.bgColor : "border-white/20 text-white/70"
                  )}
                  data-testid={`status-option-${s}`}
                >
                  <config.icon className="h-4 w-4" />
                  {config.label}
                </Button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-white/60 mb-2 block">Due Date</label>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-white/10 border-white/20 text-white flex-1 [color-scheme:dark]"
              data-testid="input-task-due-date"
            />
            {dueDate && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setDueDate("")}
                className="text-white/50 flex-shrink-0"
                data-testid="button-clear-due-date"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-white/60 mb-2 block">Priority</label>
          <div className="flex flex-wrap gap-2">
            {priorityOptions.map((p) => {
              const isActive = priority === p;
              return (
                <Button
                  key={p}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPriority(isActive ? "" : p)}
                  className={cn(
                    isActive ? priorityColors[p] : "border-white/20 text-white/70"
                  )}
                  data-testid={`priority-option-${p}`}
                >
                  {p}
                </Button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-white/60 mb-2 block">Consultant</label>
          <Input
            value={consultant}
            onChange={(e) => setConsultant(e.target.value)}
            placeholder="Enter consultant name..."
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
            data-testid="input-task-consultant"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-white/60 mb-2 block">Project Stage</label>
          <Input
            value={projectStage}
            onChange={(e) => setProjectStage(e.target.value)}
            placeholder="Enter project stage..."
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
            data-testid="input-task-project-stage"
          />
        </div>

        {task.assignees?.length > 0 && (
          <div>
            <label className="text-sm font-medium text-white/60 mb-2 block">Assignees</label>
            <div className="space-y-2">
              {task.assignees.map((assignee) => (
                <div key={assignee.id} className="flex items-center gap-2 text-sm">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium text-white">
                    {assignee.user.name?.charAt(0) || assignee.user.email.charAt(0)}
                  </div>
                  <span className="text-white">{assignee.user.name || assignee.user.email}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-white/10 mt-4 flex gap-2">
        {hasChanges ? (
          <>
            <Button 
              variant="outline" 
              className="flex-1 border-white/20 text-white" 
              onClick={onClose}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button 
              className="flex-1 bg-blue-500"
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              data-testid="button-save-task-bottom"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save Changes
            </Button>
          </>
        ) : (
          <Button variant="outline" className="w-full border-white/20 text-white" onClick={onClose} data-testid="button-close-task">
            Close
          </Button>
        )}
      </div>
    </div>
  );
}
