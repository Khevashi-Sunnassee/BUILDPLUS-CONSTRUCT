import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TASKS_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  MoreHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  ChevronsDownUp,
  ChevronsUpDown,
  Palette,
  Check,
  Users,
  GripVertical,
  Briefcase,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
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
import { SortableTaskRow } from "./TaskRow";
import type { Task, TaskGroup, User, Job, SortOption } from "./types";
import {
  getTaskGridTemplate,
  getInitials,
  DEFAULT_ITEM_COL_WIDTH,
  MIN_ITEM_COL_WIDTH,
  MAX_ITEM_COL_WIDTH,
  ITEM_COL_STORAGE_KEY,
} from "./types";

interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  user: { id: string; name: string | null; email: string };
}

const GROUP_COLOR_PALETTE = [
  "#ef4444", "#f43f5e", "#e11d48", "#ec4899", "#db2777",
  "#d946ef", "#c026d3", "#a855f7", "#9333ea", "#8b5cf6",
  "#7c3aed", "#6366f1", "#4f46e5", "#3b82f6", "#2563eb",
  "#1d4ed8", "#0ea5e9", "#0284c7", "#06b6d4", "#0891b2",
  "#14b8a6", "#0d9488", "#10b981", "#059669", "#22c55e",
  "#16a34a", "#84cc16", "#65a30d", "#eab308", "#ca8a04",
  "#f59e0b", "#d97706", "#f97316", "#ea580c", "#dc2626",
];

export function TaskGroupComponent({
  group,
  users,
  jobs,
  onOpenSidebar,
  allGroups,
  showCompleted,
  selectedTaskIds,
  onToggleTaskSelected,
  isDropTarget,
  collapseAllVersion,
  expandAllVersion,
  onMoveGroup,
  groupIndex,
  totalGroups,
  sortableGroupId,
}: {
  group: TaskGroup;
  users: User[];
  jobs: Job[];
  onOpenSidebar: (task: Task) => void;
  allGroups: TaskGroup[];
  showCompleted: boolean;
  selectedTaskIds: Set<string>;
  onToggleTaskSelected: (taskId: string) => void;
  isDropTarget?: boolean;
  collapseAllVersion?: number;
  expandAllVersion?: number;
  onMoveGroup?: (groupId: string, direction: 'up' | 'down') => void;
  groupIndex?: number;
  totalGroups?: number;
  sortableGroupId?: string;
}) {
  const { toast } = useToast();
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `group-droppable-${group.id}`,
    data: { type: "group", groupId: group.id },
  });
  const {
    attributes: sortableAttributes,
    listeners: sortableListeners,
    setNodeRef: setSortableRef,
    transform: sortableTransform,
    transition: sortableTransition,
    isDragging: isSortableDragging,
  } = useSortable({ id: sortableGroupId || group.id });
  const [isCollapsed, setIsCollapsed] = useState(group.isCollapsed);

  useEffect(() => {
    if (collapseAllVersion && collapseAllVersion > 0) {
      setIsCollapsed(true);
    }
  }, [collapseAllVersion]);

  useEffect(() => {
    if (expandAllVersion && expandAllVersion > 0) {
      setIsCollapsed(false);
    }
  }, [expandAllVersion]);

  const [isEditingName, setIsEditingName] = useState(false);
  const [groupName, setGroupName] = useState(group.name);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>("default");
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [showMembersPopover, setShowMembersPopover] = useState(false);
  const [showJobPopover, setShowJobPopover] = useState(false);
  const [jobSearch, setJobSearch] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const { data: groupMembers = [] } = useQuery<GroupMember[]>({
    queryKey: [TASKS_ROUTES.GROUP_MEMBERS(group.id), group.id],
  });

  const setMembersMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      return apiRequest("PUT", TASKS_ROUTES.GROUP_MEMBERS(group.id), { userIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUP_MEMBERS(group.id), group.id] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const handleToggleMember = (userId: string) => {
    const currentIds = groupMembers.map(m => m.userId);
    const newIds = currentIds.includes(userId)
      ? currentIds.filter(id => id !== userId)
      : [...currentIds, userId];
    setMembersMutation.mutate(newIds);
  };

  const handleSetJob = (jobId: string | null) => {
    updateGroupMutation.mutate({ jobId });
    setShowJobPopover(false);
    setJobSearch("");
  };

  const filteredJobs = useMemo(() => jobs.filter(j => {
    if (!jobSearch) return true;
    const q = jobSearch.toLowerCase();
    return j.jobNumber.toLowerCase().includes(q) || j.name.toLowerCase().includes(q);
  }).slice(0, 20), [jobs, jobSearch]);

  const [itemColWidth, setItemColWidth] = useState<number>(() => {
    const saved = localStorage.getItem(ITEM_COL_STORAGE_KEY);
    return saved ? Math.max(MIN_ITEM_COL_WIDTH, Math.min(MAX_ITEM_COL_WIDTH, parseInt(saved, 10) || DEFAULT_ITEM_COL_WIDTH)) : DEFAULT_ITEM_COL_WIDTH;
  });
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = itemColWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = moveEvent.clientX - startXRef.current;
      const newWidth = Math.max(MIN_ITEM_COL_WIDTH, Math.min(MAX_ITEM_COL_WIDTH, startWidthRef.current + delta));
      setItemColWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setItemColWidth(w => {
        localStorage.setItem(ITEM_COL_STORAGE_KEY, String(w));
        return w;
      });
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [itemColWidth]);

  const gridTemplate = getTaskGridTemplate(itemColWidth);
  
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

  const expandAllTasks = () => {
    const allIds = new Set(group.tasks.map(t => t.id));
    setExpandedTaskIds(allIds);
  };

  const collapseAllTasks = () => {
    setExpandedTaskIds(new Set());
  };

  const allExpanded = group.tasks.length > 0 && expandedTaskIds.size === group.tasks.length;
  
  const sortedTasks = useMemo(() => {
    const statusOrder = ["NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "STUCK", "DONE"];
    return [...group.tasks].sort((a, b) => {
      switch (sortOption) {
        case "status":
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
  }, [group.tasks, sortOption]);

  const updateGroupMutation = useMutation({
    mutationFn: async (data: Partial<TaskGroup>) => {
      return apiRequest("PATCH", TASKS_ROUTES.GROUP_BY_ID(group.id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
    },
    onError: (error: Error) => {
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
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (title: string) => {
      return apiRequest("POST", TASKS_ROUTES.LIST, {
        groupId: group.id,
        title,
        dueDate: new Date().toISOString(),
        priority: "MEDIUM",
        status: "NOT_STARTED",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      setNewTaskTitle("");
    },
    onError: (error: Error) => {
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

  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    setDroppableRef(node);
    setSortableRef(node);
  }, [setDroppableRef, setSortableRef]);

  const sortableStyle = {
    transform: CSS.Transform.toString(sortableTransform),
    transition: sortableTransition,
  };

  return (
    <div
      ref={combinedRef}
      className={cn("mb-6 transition-all duration-150", isDropTarget && "ring-2 ring-primary/50 rounded-lg", isSortableDragging && "opacity-50")}
      style={sortableStyle}
      data-testid={`task-group-${group.id}`}
    >
      <div
        className="flex items-center gap-2 py-2 px-2 rounded-t-lg"
        style={{ backgroundColor: `${group.color}20`, borderLeft: `4px solid ${group.color}` }}
      >
        <div
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          {...sortableAttributes}
          {...sortableListeners}
          data-testid={`drag-handle-group-${group.id}`}
        >
          <GripVertical className="h-4 w-4" />
        </div>
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

        {group.job && (
          <Badge variant="outline" className="ml-1 gap-1">
            <Briefcase className="h-3 w-3" />
            {group.job.jobNumber}
          </Badge>
        )}

        <Popover open={showMembersPopover} onOpenChange={setShowMembersPopover}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 ml-2"
              data-testid={`btn-group-members-${group.id}`}
            >
              {groupMembers.length > 0 ? (
                <div className="flex -space-x-1.5">
                  {groupMembers.slice(0, 3).map((member) => (
                    <Avatar key={member.id} className="h-5 w-5 border border-background">
                      <AvatarFallback className="text-[9px]">{getInitials(member.user?.name)}</AvatarFallback>
                    </Avatar>
                  ))}
                  {groupMembers.length > 3 && (
                    <span className="text-xs text-muted-foreground ml-1">+{groupMembers.length - 3}</span>
                  )}
                </div>
              ) : (
                <Users className="h-3.5 w-3.5" />
              )}
              <span className="text-xs">Members</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2 max-h-72 overflow-y-auto">
            <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">Group Members</div>
            <div className="text-[11px] text-muted-foreground mb-2 px-1">
              Members are auto-assigned to new tasks in this group.
            </div>
            {users.map((user) => {
              const isMember = groupMembers.some(m => m.userId === user.id);
              return (
                <button
                  key={user.id}
                  className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover-elevate"
                  onClick={() => handleToggleMember(user.id)}
                  data-testid={`member-option-${group.id}-${user.id}`}
                >
                  <div className={cn("h-4 w-4 rounded-sm border flex items-center justify-center", isMember ? "bg-primary border-primary" : "border-muted-foreground/30")}>
                    {isMember && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[9px]">{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{user.name || user.email}</span>
                </button>
              );
            })}
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1"
              onClick={allExpanded ? collapseAllTasks : expandAllTasks}
              data-testid={`btn-toggle-all-subtasks-${group.id}`}
            >
              {allExpanded ? (
                <ChevronsDownUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronsUpDown className="h-3.5 w-3.5" />
              )}
              <span className="text-xs">{allExpanded ? "Collapse All" : "Expand All"}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{allExpanded ? "Collapse all subtasks" : "Expand all subtasks"}</TooltipContent>
        </Tooltip>

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
              disabled={groupIndex === 0}
              onClick={() => onMoveGroup?.(group.id, 'up')}
              data-testid={`menu-move-up-group-${group.id}`}
            >
              <ArrowUp className="h-4 w-4 mr-2" />
              Move Up
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={totalGroups !== undefined && groupIndex === totalGroups - 1}
              onClick={() => onMoveGroup?.(group.id, 'down')}
              data-testid={`menu-move-down-group-${group.id}`}
            >
              <ArrowDown className="h-4 w-4 mr-2" />
              Move Down
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowJobPopover(true)}
              data-testid={`menu-set-job-group-${group.id}`}
            >
              <Briefcase className="h-4 w-4 mr-2" />
              {group.jobId ? "Change job" : "Link to job"}
            </DropdownMenuItem>
            {group.jobId && (
              <DropdownMenuItem
                onClick={() => handleSetJob(null)}
                data-testid={`menu-unlink-job-group-${group.id}`}
              >
                <X className="h-4 w-4 mr-2" />
                Unlink job
              </DropdownMenuItem>
            )}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger data-testid={`menu-color-group-${group.id}`}>
                <Palette className="h-4 w-4 mr-2" />
                Change color
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="p-2">
                <div className="grid grid-cols-7 gap-1.5" data-testid={`color-picker-${group.id}`}>
                  {GROUP_COLOR_PALETTE.map((color) => {
                    const isUsed = allGroups.some(g => g.id !== group.id && g.color?.toLowerCase() === color.toLowerCase());
                    const isSelected = group.color?.toLowerCase() === color.toLowerCase();
                    return (
                      <button
                        key={color}
                        className={cn(
                          "w-6 h-6 rounded-md flex items-center justify-center transition-all",
                          isUsed ? "opacity-25 cursor-not-allowed" : "cursor-pointer hover:scale-110",
                          isSelected && "ring-2 ring-offset-1 ring-foreground"
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => {
                          if (!isUsed) {
                            updateGroupMutation.mutate({ color });
                          }
                        }}
                        disabled={isUsed}
                        title={isUsed ? "Already used by another group" : isSelected ? "Current color" : ""}
                        data-testid={`color-swatch-${group.id}-${color.replace("#", "")}`}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5 text-white drop-shadow-sm" />}
                      </button>
                    );
                  })}
                </div>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
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

        {showJobPopover && (
          <Popover open={showJobPopover} onOpenChange={setShowJobPopover}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1" data-testid={`btn-job-trigger-${group.id}`}>
                <Briefcase className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="end">
              <div className="space-y-2">
                <Input
                  placeholder="Search jobs..."
                  value={jobSearch}
                  onChange={(e) => setJobSearch(e.target.value)}
                  className="h-8"
                  autoFocus
                  data-testid={`input-job-search-${group.id}`}
                />
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {filteredJobs.length === 0 && (
                    <p className="text-xs text-muted-foreground p-2">No jobs found</p>
                  )}
                  {filteredJobs.map((j) => (
                    <Button
                      key={j.id}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "w-full justify-start gap-2",
                        group.jobId === j.id && "bg-primary/10"
                      )}
                      onClick={() => handleSetJob(j.id)}
                      data-testid={`job-option-${j.id}`}
                    >
                      <Briefcase className="h-3 w-3 shrink-0" />
                      <span className="truncate">{j.jobNumber} - {j.name}</span>
                      {group.jobId === j.id && <Check className="h-3 w-3 ml-auto shrink-0" />}
                    </Button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {!isCollapsed && (
        <div className="overflow-x-auto" data-testid={`task-group-table-${group.id}`}>
          <div className="min-w-max">
          <div className="grid text-xs text-muted-foreground font-medium border-b bg-muted/50 py-2" style={{ gridTemplateColumns: gridTemplate }}>
            <div />
            <div />
            <div />
            <div className="px-2 relative flex items-center select-none">
              <span>Item</span>
              <div
                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 z-10"
                onMouseDown={handleResizeStart}
                data-testid="resize-item-column"
              />
            </div>
            <div />
            <div className="px-2 text-center">Users</div>
            <div className="px-2 text-center">Job</div>
            <div className="px-2 text-center">Status</div>
            <div className="px-2 text-center">Priority</div>
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
                isSelected={selectedTaskIds.has(task.id)}
                onToggleSelected={() => onToggleTaskSelected(task.id)}
                gridTemplate={gridTemplate}
              />
            ))}
          </SortableContext>

          <div className="grid items-center border-b border-dashed border-border/50 hover:bg-muted/30" style={{ gridTemplateColumns: gridTemplate }}>
            <div />
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
            <div className="col-span-9" />
          </div>
          </div>
        </div>
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
