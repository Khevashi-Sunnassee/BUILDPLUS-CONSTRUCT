import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { dateInputProps } from "@/lib/validation";
import { useToast } from "@/hooks/use-toast";
import { TASKS_ROUTES, JOBS_ROUTES, PROJECT_ACTIVITIES_ROUTES, USER_ROUTES } from "@shared/api-routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format, isBefore, startOfDay } from "date-fns";
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
  Search,
  ChevronsUpDown,
  ListTodo,
  Activity,
  Briefcase,
  Users,
  UserPlus,
  Check,
  CornerDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "STUCK" | "DONE" | "ON_HOLD";

interface TaskAssignee {
  id: string;
  userId: string;
  user: { id: string; name: string | null; email: string };
}

interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  user: { id: string; name: string | null; email: string };
}

interface CompanyUser {
  id: string;
  name: string | null;
  email: string;
}

interface Task {
  id: string;
  groupId: string;
  parentId: string | null;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  priority: string | null;
  consultant: string | null;
  projectStage: string | null;
  assignees: TaskAssignee[];
  subtasks: Task[];
}

interface TaskGroup {
  id: string;
  name: string;
  color: string;
  isCollapsed: boolean;
  tasks: Task[];
}

interface JobActivity {
  id: string;
  jobId: string;
  name: string;
  status: string;
  category: string | null;
  startDate: string | null;
  endDate: string | null;
  sortOrder: number;
}

interface SimpleJob {
  id: string;
  name: string;
  jobNumber: string | null;
  status: string;
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

type TabView = "tasks" | "activity";

export default function MobileTasksPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabView>("tasks");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newTaskGroupId, setNewTaskGroupId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [hideDone, setHideDone] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0]);

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [jobSearchQuery, setJobSearchQuery] = useState("");
  const [collapsedActivities, setCollapsedActivities] = useState<Set<string>>(new Set());
  const [activityHideDone, setActivityHideDone] = useState(true);
  const [activitySearchQuery, setActivitySearchQuery] = useState("");

  const { data: groups = [], isLoading } = useQuery<TaskGroup[]>({
    queryKey: [TASKS_ROUTES.GROUPS],
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<SimpleJob[]>({
    queryKey: [JOBS_ROUTES.LIST],
    select: (data: unknown) => {
      if (Array.isArray(data)) return data;
      if (data && typeof data === 'object' && 'jobs' in data) return (data as { jobs: SimpleJob[] }).jobs;
      return [];
    },
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<JobActivity[]>({
    queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_ACTIVITIES(selectedJobId || ""), selectedJobId],
    enabled: !!selectedJobId,
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: Partial<Task> }) => {
      return apiRequest("PATCH", TASKS_ROUTES.BY_ID(taskId), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      if (selectedJobId) {
        activities.forEach(a => {
          queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.ACTIVITY_TASKS(a.id)] });
        });
      }
    },
    onError: () => {
      toast({ title: "Failed to update task", variant: "destructive" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async ({ groupId, title }: { groupId: string; title: string }) => {
      return apiRequest("POST", TASKS_ROUTES.LIST, { groupId, title, priority: "MEDIUM", status: "NOT_STARTED" });
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

  const toggleActivity = (activityId: string) => {
    setCollapsedActivities(prev => {
      const next = new Set(prev);
      if (next.has(activityId)) {
        next.delete(activityId);
      } else {
        next.add(activityId);
      }
      return next;
    });
  };

  const collapseAllGroups = () => {
    const allIds = groups.map(g => g.id);
    setCollapsedGroups(new Set(allIds));
  };

  const expandAllGroups = () => {
    setCollapsedGroups(new Set());
  };

  const allGroupsCollapsed = groups.length > 0 && collapsedGroups.size === groups.length;

  const collapseAllActivities = () => {
    setCollapsedActivities(new Set(activities.map(a => a.id)));
  };

  const expandAllActivities = () => {
    setCollapsedActivities(new Set());
  };

  const allActivitiesCollapsed = activities.length > 0 && collapsedActivities.size === activities.length;

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

  useEffect(() => {
    if (selectedTask && groups.length > 0) {
      for (const group of groups) {
        const findTask = (tasks: Task[]): Task | undefined => {
          for (const t of tasks) {
            if (t.id === selectedTask.id) return t;
            if (t.subtasks?.length) {
              const found = findTask(t.subtasks);
              if (found) return found;
            }
          }
          return undefined;
        };
        const found = findTask(group.tasks || []);
        if (found) {
          setSelectedTask(found);
          break;
        }
      }
    }
  }, [groups]);

  const totalTasks = useMemo(() => groups.reduce((sum, g) => sum + (g.tasks?.length || 0), 0), [groups]);
  const activeTasks = useMemo(() => groups.reduce((sum, g) => sum + (g.tasks?.filter(t => t.status !== "DONE").length || 0), 0), [groups]);

  const selectedJob = useMemo(() => jobs.find(j => j.id === selectedJobId), [jobs, selectedJobId]);
  const filteredJobs = useMemo(() => jobSearchQuery
    ? jobs.filter(j =>
        (j.name || "").toLowerCase().includes(jobSearchQuery.toLowerCase()) ||
        (j.jobNumber || "").toLowerCase().includes(jobSearchQuery.toLowerCase())
      )
    : jobs, [jobs, jobSearchQuery]);

  return (
    <div className="flex flex-col h-screen-safe bg-[#070B12] text-white overflow-hidden" role="main" aria-label="Mobile Tasks">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-2xl font-bold" data-testid="text-tasks-title">Tasks</div>
              {activeTab === "tasks" && (
                <div className="text-sm text-white/60">
                  {activeTasks} active of {totalTasks} total
                </div>
              )}
              {activeTab === "activity" && selectedJob && (
                <div className="text-sm text-white/60">
                  {activities.length} activities
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeTab === "tasks" && (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={allGroupsCollapsed ? expandAllGroups : collapseAllGroups}
                    className="rounded-full text-white/40"
                    data-testid="button-collapse-all"
                  >
                    <ChevronsUpDown className="h-5 w-5" />
                  </Button>
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
                </>
              )}
              {activeTab === "activity" && selectedJobId && activities.length > 0 && (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={allActivitiesCollapsed ? expandAllActivities : collapseAllActivities}
                    className="rounded-full text-white/40"
                    data-testid="button-collapse-all-activities"
                  >
                    <ChevronsUpDown className="h-5 w-5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setActivityHideDone(!activityHideDone)}
                    className={cn("rounded-full", activityHideDone ? "text-white/40" : "text-green-400")}
                    data-testid="button-toggle-done-activities"
                  >
                    {activityHideDone ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="flex mt-3 bg-white/5 rounded-xl p-1 border border-white/10">
            <button
              onClick={() => setActiveTab("tasks")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                activeTab === "tasks"
                  ? "bg-blue-500 text-white shadow-lg"
                  : "text-white/50"
              )}
              data-testid="tab-tasks"
            >
              <ListTodo className="h-4 w-4" />
              Tasks
            </button>
            <button
              onClick={() => setActiveTab("activity")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                activeTab === "activity"
                  ? "bg-blue-500 text-white shadow-lg"
                  : "text-white/50"
              )}
              data-testid="tab-activity-tasks"
            >
              <Activity className="h-4 w-4" />
              Activity Tasks
            </button>
          </div>

          {activeTab === "tasks" && (
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl"
                data-testid="input-search-tasks"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40"
                  data-testid="button-clear-search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {activeTab === "activity" && (
            <div className="mt-3 space-y-2">
              <button
                onClick={() => setShowJobPicker(true)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/20 bg-white/10"
                data-testid="button-select-job"
              >
                <Briefcase className="h-5 w-5 text-blue-400 flex-shrink-0" />
                <span className={cn("flex-1 text-left text-sm", selectedJob ? "text-white" : "text-white/40")}>
                  {selectedJob
                    ? `${selectedJob.jobNumber ? selectedJob.jobNumber + " - " : ""}${selectedJob.name}`
                    : "Select a job..."}
                </span>
                <ChevronDown className="h-4 w-4 text-white/40" />
              </button>
              {selectedJobId && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input
                    value={activitySearchQuery}
                    onChange={(e) => setActivitySearchQuery(e.target.value)}
                    placeholder="Search activities..."
                    className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl"
                    data-testid="input-search-activity-tasks"
                  />
                  {activitySearchQuery && (
                    <button
                      onClick={() => setActivitySearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40"
                      data-testid="button-clear-activity-search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-40 pt-4">
        {activeTab === "tasks" && (
          <TasksListView
            groups={groups}
            isLoading={isLoading}
            collapsedGroups={collapsedGroups}
            toggleGroup={toggleGroup}
            hideDone={hideDone}
            searchQuery={searchQuery}
            cycleStatus={cycleStatus}
            setSelectedTask={setSelectedTask}
            newTaskGroupId={newTaskGroupId}
            setNewTaskGroupId={setNewTaskGroupId}
            newTaskTitle={newTaskTitle}
            setNewTaskTitle={setNewTaskTitle}
            handleCreateTask={handleCreateTask}
            createTaskMutation={createTaskMutation}
          />
        )}

        {activeTab === "activity" && (
          <ActivityTasksView
            selectedJobId={selectedJobId}
            activities={activities}
            activitiesLoading={activitiesLoading}
            collapsedActivities={collapsedActivities}
            toggleActivity={toggleActivity}
            hideDone={activityHideDone}
            searchQuery={activitySearchQuery}
            cycleStatus={cycleStatus}
            setSelectedTask={setSelectedTask}
            updateTaskMutation={updateTaskMutation}
          />
        )}
      </div>

      <Sheet open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <SheetContent side="bottom" className="h-[100dvh] rounded-none bg-[#0D1117] border-white/10">
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

      <Sheet open={showJobPicker} onOpenChange={(open) => {
        setShowJobPicker(open);
        if (!open) setJobSearchQuery("");
      }}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl bg-[#0D1117] border-white/10">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-left text-white flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-blue-400" />
              Select Job
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                value={jobSearchQuery}
                onChange={(e) => setJobSearchQuery(e.target.value)}
                placeholder="Search jobs..."
                className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl"
                autoFocus
                data-testid="input-search-jobs"
              />
            </div>
            <div className="overflow-y-auto max-h-[calc(70vh-160px)] space-y-1">
              {jobsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-14 rounded-xl bg-white/10" />
                  ))}
                </div>
              ) : filteredJobs.length === 0 ? (
                <div className="text-center py-8 text-white/40 text-sm">
                  No jobs found
                </div>
              ) : (
                filteredJobs.map(job => (
                  <button
                    key={job.id}
                    onClick={() => {
                      setSelectedJobId(job.id);
                      setShowJobPicker(false);
                      setJobSearchQuery("");
                      setCollapsedActivities(new Set());
                    }}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border transition-all",
                      selectedJobId === job.id
                        ? "border-blue-500/50 bg-blue-500/10"
                        : "border-white/10 bg-white/5"
                    )}
                    data-testid={`job-option-${job.id}`}
                  >
                    <div className="font-medium text-sm text-white">{job.name}</div>
                    {job.jobNumber && (
                      <div className="text-xs text-white/50 mt-0.5">{job.jobNumber}</div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <MobileBottomNav />
    </div>
  );
}

function TasksListView({
  groups,
  isLoading,
  collapsedGroups,
  toggleGroup,
  hideDone,
  searchQuery,
  cycleStatus,
  setSelectedTask,
  newTaskGroupId,
  setNewTaskGroupId,
  newTaskTitle,
  setNewTaskTitle,
  handleCreateTask,
  createTaskMutation,
}: {
  groups: TaskGroup[];
  isLoading: boolean;
  collapsedGroups: Set<string>;
  toggleGroup: (id: string) => void;
  hideDone: boolean;
  searchQuery: string;
  cycleStatus: (task: Task) => void;
  setSelectedTask: (task: Task) => void;
  newTaskGroupId: string | null;
  setNewTaskGroupId: (id: string | null) => void;
  newTaskTitle: string;
  setNewTaskTitle: (title: string) => void;
  handleCreateTask: (groupId: string) => void;
  createTaskMutation: ReturnType<typeof useMutation<Response, Error, { groupId: string; title: string }>>;
}) {
  const { toast } = useToast();
  const [membersGroupId, setMembersGroupId] = useState<string | null>(null);

  const { data: allUsers = [] } = useQuery<CompanyUser[]>({
    queryKey: [USER_ROUTES.LIST],
  });

  const { data: groupMembers = [] } = useQuery<GroupMember[]>({
    queryKey: [TASKS_ROUTES.GROUP_MEMBERS(membersGroupId || ""), membersGroupId],
    enabled: !!membersGroupId,
  });

  const setMembersMutation = useMutation({
    mutationFn: async ({ groupId, userIds }: { groupId: string; userIds: string[] }) => {
      return apiRequest("PUT", TASKS_ROUTES.GROUP_MEMBERS(groupId), { userIds });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUP_MEMBERS(variables.groupId), variables.groupId] });
    },
    onError: () => {
      toast({ title: "Failed to update members", variant: "destructive" });
    },
  });

  const handleToggleMember = (userId: string) => {
    if (!membersGroupId) return;
    const currentIds = groupMembers.map(m => m.userId);
    const newIds = currentIds.includes(userId)
      ? currentIds.filter(id => id !== userId)
      : [...currentIds, userId];
    setMembersMutation.mutate({ groupId: membersGroupId, userIds: newIds });
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-12 rounded-2xl bg-white/10" />
            <Skeleton className="h-16 rounded-2xl bg-white/5" />
            <Skeleton className="h-16 rounded-2xl bg-white/5" />
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="h-12 w-12 mx-auto text-white/30 mb-3" />
        <p className="text-white/60">No task groups yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {groups.map((group) => {
          const isCollapsed = collapsedGroups.has(group.id);
          const allGroupTasks = group.tasks || [];
          const q = searchQuery.toLowerCase().trim();
          const searchFiltered = q
            ? allGroupTasks.filter(t =>
                t.title.toLowerCase().includes(q) ||
                (t.priority && t.priority.toLowerCase().includes(q)) ||
                (t.consultant && t.consultant.toLowerCase().includes(q)) ||
                (t.projectStage && t.projectStage.toLowerCase().includes(q)) ||
                (t.assignees?.some(a => a.user?.name?.toLowerCase().includes(q)))
              )
            : allGroupTasks;
          const groupTasks = hideDone ? searchFiltered.filter(t => t.status !== "DONE") : searchFiltered;
          const activeCount = allGroupTasks.filter(t => t.status !== "DONE").length;

          if (q && groupTasks.length === 0 && !group.name.toLowerCase().includes(q)) return null;

          return (
            <div key={group.id} className="space-y-2">
              <GroupHeader
                group={group}
                isCollapsed={isCollapsed}
                activeCount={activeCount}
                totalCount={allGroupTasks.length}
                onToggle={() => toggleGroup(group.id)}
                onOpenMembers={() => setMembersGroupId(group.id)}
                allUsers={allUsers}
              />

              {!isCollapsed && (
                <div className="space-y-2 ml-2">
                  {groupTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      cycleStatus={cycleStatus}
                      onSelect={() => setSelectedTask(task)}
                    />
                  ))}

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

      <Sheet open={!!membersGroupId} onOpenChange={(open) => { if (!open) setMembersGroupId(null); }}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl bg-[#0D1117] border-white/10">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-left text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" />
              Group Members
            </SheetTitle>
          </SheetHeader>
          <p className="text-xs text-white/40 mb-3">Members are auto-assigned to new tasks in this group.</p>
          <div className="overflow-y-auto max-h-[calc(70vh-140px)] space-y-1">
            {allUsers.map((user) => {
              const isMember = groupMembers.some(m => m.userId === user.id);
              return (
                <button
                  key={user.id}
                  onClick={() => handleToggleMember(user.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 transition-all"
                  data-testid={`member-toggle-${user.id}`}
                >
                  <div className={cn(
                    "h-5 w-5 rounded-md border flex items-center justify-center flex-shrink-0",
                    isMember ? "bg-blue-500 border-blue-500" : "border-white/30"
                  )}>
                    {isMember && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium text-white flex-shrink-0">
                    {getInitials(user.name)}
                  </div>
                  <span className="text-sm text-white truncate">{user.name || user.email}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function GroupHeader({
  group,
  isCollapsed,
  activeCount,
  totalCount,
  onToggle,
  onOpenMembers,
  allUsers,
}: {
  group: TaskGroup;
  isCollapsed: boolean;
  activeCount: number;
  totalCount: number;
  onToggle: () => void;
  onOpenMembers: () => void;
  allUsers: CompanyUser[];
}) {
  const { data: groupMembers = [] } = useQuery<GroupMember[]>({
    queryKey: [TASKS_ROUTES.GROUP_MEMBERS(group.id), group.id],
  });

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 p-4 rounded-2xl border border-white/10 bg-white/5"
      data-testid={`group-${group.id}`}
    >
      <div 
        className="w-3 h-3 rounded-full flex-shrink-0" 
        style={{ backgroundColor: group.color || "#6b7280" }}
      />
      <span className="font-semibold flex-1 text-left text-white">{group.name}</span>

      {groupMembers.length > 0 && (
        <div className="flex -space-x-1.5">
          {groupMembers.slice(0, 3).map((member) => (
            <div
              key={member.id}
              className="h-6 w-6 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-[9px] font-medium text-white"
            >
              {getInitials(member.user?.name)}
            </div>
          ))}
          {groupMembers.length > 3 && (
            <div className="h-6 w-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[9px] text-white/60">
              +{groupMembers.length - 3}
            </div>
          )}
        </div>
      )}

      <div
        onClick={(e) => {
          e.stopPropagation();
          onOpenMembers();
        }}
        className="p-1.5 rounded-lg bg-white/10 flex-shrink-0"
        data-testid={`button-group-members-${group.id}`}
      >
        <Users className="h-4 w-4 text-white/60" />
      </div>

      <span className="text-sm text-white/60">
        {activeCount}/{totalCount}
      </span>
      {isCollapsed ? (
        <ChevronRight className="h-5 w-5 text-white/40" />
      ) : (
        <ChevronDown className="h-5 w-5 text-white/40" />
      )}
    </button>
  );
}

function TaskCard({
  task,
  cycleStatus,
  onSelect,
}: {
  task: Task;
  cycleStatus: (task: Task) => void;
  onSelect: () => void;
}) {
  const statusInfo = statusConfig[task.status];
  const StatusIcon = statusInfo.icon;

  return (
    <div
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
        onClick={onSelect}
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
            <span className={`text-xs flex items-center gap-1 ${isBefore(new Date(task.dueDate), startOfDay(new Date())) && task.status !== "DONE" ? "text-red-500" : "text-white/50"}`}>
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
}

function ActivityTasksView({
  selectedJobId,
  activities,
  activitiesLoading,
  collapsedActivities,
  toggleActivity,
  hideDone,
  searchQuery,
  cycleStatus,
  setSelectedTask,
  updateTaskMutation,
}: {
  selectedJobId: string | null;
  activities: JobActivity[];
  activitiesLoading: boolean;
  collapsedActivities: Set<string>;
  toggleActivity: (id: string) => void;
  hideDone: boolean;
  searchQuery: string;
  cycleStatus: (task: Task) => void;
  setSelectedTask: (task: Task) => void;
  updateTaskMutation: ReturnType<typeof useMutation<Response, Error, { taskId: string; data: Partial<Task> }>>;
}) {
  if (!selectedJobId) {
    return (
      <div className="text-center py-12">
        <Briefcase className="h-12 w-12 mx-auto text-white/30 mb-3" />
        <p className="text-white/60">Select a job to view activity tasks</p>
      </div>
    );
  }

  if (activitiesLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-12 rounded-2xl bg-white/10" />
            <Skeleton className="h-16 rounded-2xl bg-white/5" />
          </div>
        ))}
      </div>
    );
  }

  const q = searchQuery.toLowerCase().trim();
  const filteredActivities = useMemo(() => q
    ? activities.filter(a => a.name.toLowerCase().includes(q) || (a.category || "").toLowerCase().includes(q))
    : activities, [activities, q]);

  if (filteredActivities.length === 0) {
    return (
      <div className="text-center py-12">
        <Activity className="h-12 w-12 mx-auto text-white/30 mb-3" />
        <p className="text-white/60">
          {q ? "No matching activities" : "No activities found for this job"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filteredActivities.map(activity => (
        <ActivitySection
          key={activity.id}
          activity={activity}
          isCollapsed={collapsedActivities.has(activity.id)}
          onToggle={() => toggleActivity(activity.id)}
          hideDone={hideDone}
          cycleStatus={cycleStatus}
          setSelectedTask={setSelectedTask}
        />
      ))}
    </div>
  );
}

const activityStatusColors: Record<string, string> = {
  NOT_STARTED: "bg-white/10",
  IN_PROGRESS: "bg-blue-500/20",
  STUCK: "bg-red-500/20",
  DONE: "bg-green-500/20",
  ON_HOLD: "bg-yellow-500/20",
  SKIPPED: "bg-white/5",
};

function ActivitySection({
  activity,
  isCollapsed,
  onToggle,
  hideDone,
  cycleStatus,
  setSelectedTask,
}: {
  activity: JobActivity;
  isCollapsed: boolean;
  onToggle: () => void;
  hideDone: boolean;
  cycleStatus: (task: Task) => void;
  setSelectedTask: (task: Task) => void;
}) {
  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: [PROJECT_ACTIVITIES_ROUTES.ACTIVITY_TASKS(activity.id)],
    enabled: !isCollapsed,
  });

  const visibleTasks = useMemo(() => hideDone ? tasks.filter(t => t.status !== "DONE") : tasks, [tasks, hideDone]);
  const activeCount = useMemo(() => tasks.filter(t => t.status !== "DONE").length, [tasks]);
  const statusBg = activityStatusColors[activity.status] || "bg-white/10";

  return (
    <div className="space-y-2">
      <button
        onClick={onToggle}
        className={cn("w-full flex items-center gap-3 p-4 rounded-2xl border border-white/10", statusBg)}
        data-testid={`activity-${activity.id}`}
      >
        <Activity className="h-4 w-4 text-blue-400 flex-shrink-0" />
        <div className="flex-1 text-left min-w-0">
          <span className="font-semibold text-white text-sm block truncate">{activity.name}</span>
          {activity.category && (
            <span className="text-xs text-white/40 block truncate">{activity.category}</span>
          )}
        </div>
        {!isCollapsed && !isLoading && (
          <span className="text-sm text-white/60 flex-shrink-0">
            {activeCount}/{tasks.length}
          </span>
        )}
        {isCollapsed ? (
          <ChevronRight className="h-5 w-5 text-white/40 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-5 w-5 text-white/40 flex-shrink-0" />
        )}
      </button>

      {!isCollapsed && (
        <div className="space-y-2 ml-2">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 rounded-2xl bg-white/5" />
              <Skeleton className="h-14 rounded-2xl bg-white/5" />
            </div>
          ) : visibleTasks.length === 0 ? (
            <div className="p-4 text-center text-white/40 text-sm rounded-2xl border border-white/10 bg-white/5">
              {tasks.length > 0 ? "All tasks completed" : "No tasks for this activity"}
            </div>
          ) : (
            visibleTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                cycleStatus={cycleStatus}
                onSelect={() => setSelectedTask(task)}
              />
            ))
          )}
        </div>
      )}
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
  const { toast } = useToast();
  const [title, setTitle] = useState(task.title);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.split("T")[0] : "");
  const [priority, setPriority] = useState(task.priority || "");
  const [consultant, setConsultant] = useState(task.consultant || "");
  const [projectStage, setProjectStage] = useState(task.projectStage || "");
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  const { data: allUsers = [] } = useQuery<CompanyUser[]>({
    queryKey: [USER_ROUTES.LIST],
  });

  const { data: assignees = [] } = useQuery<TaskAssignee[]>({
    queryKey: [TASKS_ROUTES.ASSIGNEES(task.id), task.id],
  });

  const setAssigneesMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      return apiRequest("PUT", TASKS_ROUTES.ASSIGNEES(task.id), { userIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.ASSIGNEES(task.id), task.id] });
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
    },
    onError: () => {
      toast({ title: "Failed to update assignees", variant: "destructive" });
    },
  });

  const createSubtaskMutation = useMutation({
    mutationFn: async (subtaskTitle: string) => {
      const response = await apiRequest("POST", TASKS_ROUTES.LIST, {
        groupId: task.groupId,
        parentId: task.id,
        title: subtaskTitle,
        status: "NOT_STARTED",
        priority: "MEDIUM",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      setNewSubtaskTitle("");
      setShowAddSubtask(false);
    },
    onError: () => {
      toast({ title: "Failed to create subtask", variant: "destructive" });
    },
  });

  const updateSubtaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: TaskStatus }) => {
      return apiRequest("PATCH", TASKS_ROUTES.BY_ID(taskId), { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
    },
    onError: () => {
      toast({ title: "Failed to update subtask", variant: "destructive" });
    },
  });

  const handleToggleAssignee = (userId: string) => {
    const currentIds = assignees.map(a => a.userId);
    const newIds = currentIds.includes(userId)
      ? currentIds.filter(id => id !== userId)
      : [...currentIds, userId];
    setAssigneesMutation.mutate(newIds);
  };

  const handleRemoveAssignee = (userId: string) => {
    const newIds = assignees.map(a => a.userId).filter(id => id !== userId);
    setAssigneesMutation.mutate(newIds);
  };

  const cycleSubtaskStatus = (subtask: Task) => {
    const currentIndex = statusOrder.indexOf(subtask.status);
    const nextIndex = (currentIndex + 1) % statusOrder.length;
    updateSubtaskStatusMutation.mutate({ taskId: subtask.id, status: statusOrder[nextIndex] });
  };

  const handleCreateSubtask = () => {
    if (newSubtaskTitle.trim() && !createSubtaskMutation.isPending) {
      createSubtaskMutation.mutate(newSubtaskTitle.trim());
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  };

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
    const data: Record<string, unknown> = {};
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

      <div className="flex-1 overflow-y-auto space-y-4">
        <div>
          <label className="text-sm font-medium text-white/60 mb-1.5 block">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-white/10 border-white/20 text-white"
            data-testid="input-task-title"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-white/60 mb-1.5 block">Assigned Users</label>
          <div className="space-y-2">
            {assignees.length > 0 ? (
              assignees.map((assignee) => (
                <div
                  key={assignee.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5"
                  data-testid={`assignee-${assignee.userId}`}
                >
                  <div className="h-8 w-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xs font-medium text-blue-400 flex-shrink-0">
                    {getInitials(assignee.user?.name)}
                  </div>
                  <span className="text-sm text-white flex-1 truncate">{assignee.user?.name || assignee.user?.email}</span>
                  <button
                    onClick={() => handleRemoveAssignee(assignee.userId)}
                    className="p-1 rounded-lg text-white/40"
                    data-testid={`button-remove-assignee-${assignee.userId}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            ) : (
              <div className="text-sm text-white/40 p-3 rounded-xl border border-white/10 bg-white/5 text-center">
                No users assigned
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAssigneePicker(true)}
              className="w-full justify-start text-blue-400 border border-dashed border-white/10 rounded-xl"
              data-testid="button-add-assignee"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add / Remove Users
            </Button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-white/60 mb-1.5 block">Status</label>
          <div className="flex flex-wrap gap-2">
            {statusOrder.map((s) => {
              const info = statusConfig[s];
              const Icon = info.icon;
              return (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border transition-all",
                    status === s
                      ? "border-blue-500 bg-blue-500/20 text-white"
                      : "border-white/10 bg-white/5 text-white/60"
                  )}
                  data-testid={`status-option-${s}`}
                >
                  <Icon className={cn("h-4 w-4", info.color)} />
                  {info.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-white/60 mb-1.5 block">Priority</label>
          <div className="flex flex-wrap gap-2">
            {priorityOptions.map((p) => (
              <button
                key={p}
                onClick={() => setPriority(priority === p ? "" : p)}
                className={cn(
                  "px-3 py-2 rounded-xl text-sm border transition-all",
                  priority === p
                    ? cn("border-blue-500 bg-blue-500/20 text-white")
                    : "border-white/10 bg-white/5 text-white/60"
                )}
                data-testid={`priority-option-${p}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-white/60 mb-1.5 block">Due Date</label>
          <Input
            type="date"
            {...dateInputProps}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="bg-white/10 border-white/20 text-white [color-scheme:dark]"
            data-testid="input-task-due-date"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-white/60 mb-1.5 block">Consultant</label>
          <Input
            value={consultant}
            onChange={(e) => setConsultant(e.target.value)}
            placeholder="Enter consultant name..."
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
            data-testid="input-task-consultant"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-white/60 mb-1.5 block">Project Stage</label>
          <Input
            value={projectStage}
            onChange={(e) => setProjectStage(e.target.value)}
            placeholder="Enter project stage..."
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
            data-testid="input-task-project-stage"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-white/60 flex items-center gap-1.5">
              <CornerDownRight className="h-3.5 w-3.5" />
              Subtasks
              {(task.subtasks?.length || 0) > 0 && (
                <span className="text-white/40">({task.subtasks.length})</span>
              )}
            </label>
          </div>
          <div className="space-y-2">
            {(task.subtasks || []).map((subtask) => {
              const stInfo = statusConfig[subtask.status];
              const StIcon = stInfo.icon;
              return (
                <div
                  key={subtask.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5"
                  data-testid={`subtask-${subtask.id}`}
                >
                  <button
                    type="button"
                    onClick={() => cycleSubtaskStatus(subtask)}
                    className="flex-shrink-0"
                    data-testid={`subtask-status-${subtask.id}`}
                  >
                    <StIcon className={cn("h-5 w-5", stInfo.color)} />
                  </button>
                  <span className={cn(
                    "text-sm flex-1 min-w-0 truncate",
                    subtask.status === "DONE" ? "line-through text-white/40" : "text-white"
                  )}>
                    {subtask.title}
                  </span>
                  {subtask.dueDate && (
                    <span className={cn(
                      "text-xs flex-shrink-0",
                      isBefore(new Date(subtask.dueDate), startOfDay(new Date())) && subtask.status !== "DONE"
                        ? "text-red-400"
                        : "text-white/40"
                    )}>
                      {format(new Date(subtask.dueDate), "dd MMM")}
                    </span>
                  )}
                </div>
              );
            })}

            {showAddSubtask ? (
              <div className="flex items-center gap-2 p-3 rounded-xl border border-blue-500/30 bg-blue-500/5">
                <Input
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  placeholder="Subtask name..."
                  className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateSubtask();
                    if (e.key === "Escape") {
                      setShowAddSubtask(false);
                      setNewSubtaskTitle("");
                    }
                  }}
                  data-testid="input-new-subtask"
                />
                <Button
                  size="sm"
                  onClick={handleCreateSubtask}
                  disabled={!newSubtaskTitle.trim() || createSubtaskMutation.isPending}
                  className="bg-blue-500 flex-shrink-0"
                  data-testid="button-create-subtask"
                >
                  {createSubtaskMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Add"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowAddSubtask(false);
                    setNewSubtaskTitle("");
                  }}
                  className="text-white/60 flex-shrink-0"
                  data-testid="button-cancel-subtask"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddSubtask(true)}
                className="w-full justify-start text-blue-400 border border-dashed border-white/10 rounded-xl"
                data-testid="button-add-subtask"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Subtask
              </Button>
            )}
          </div>
        </div>
      </div>

      <Sheet open={showAssigneePicker} onOpenChange={setShowAssigneePicker}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl bg-[#0D1117] border-white/10">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-left text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" />
              Assign Users
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto max-h-[calc(70vh-120px)] space-y-1">
            {allUsers.map((user) => {
              const isAssigned = assignees.some(a => a.userId === user.id);
              return (
                <button
                  key={user.id}
                  onClick={() => handleToggleAssignee(user.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 transition-all"
                  data-testid={`assignee-toggle-${user.id}`}
                >
                  <div className={cn(
                    "h-5 w-5 rounded-md border flex items-center justify-center flex-shrink-0",
                    isAssigned ? "bg-blue-500 border-blue-500" : "border-white/30"
                  )}>
                    {isAssigned && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium text-white flex-shrink-0">
                    {getInitials(user.name)}
                  </div>
                  <span className="text-sm text-white truncate">{user.name || user.email}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
