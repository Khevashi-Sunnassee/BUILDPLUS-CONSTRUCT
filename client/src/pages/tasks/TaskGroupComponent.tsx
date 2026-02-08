import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TASKS_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
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
  DEFAULT_ITEM_COL_WIDTH,
  MIN_ITEM_COL_WIDTH,
  MAX_ITEM_COL_WIDTH,
  ITEM_COL_STORAGE_KEY,
} from "./types";

const GROUP_COLOR_PALETTE = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
  "#0ea5e9", "#3b82f6", "#2563eb", "#7c3aed", "#c026d3",
  "#e11d48", "#ea580c", "#ca8a04", "#16a34a", "#0891b2",
  "#4f46e5", "#9333ea", "#db2777", "#dc2626", "#d97706",
  "#65a30d", "#059669", "#0d9488", "#0284c7", "#1d4ed8",
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
}) {
  const { toast } = useToast();
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `group-droppable-${group.id}`,
    data: { type: "group", groupId: group.id },
  });
  const [isCollapsed, setIsCollapsed] = useState(group.isCollapsed);
  const [isEditingName, setIsEditingName] = useState(false);
  const [groupName, setGroupName] = useState(group.name);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>("default");
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const nameInputRef = useRef<HTMLInputElement>(null);

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
        priority: "MEDIUM",
        status: "NOT_STARTED",
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
    <div
      ref={setDroppableRef}
      className={cn("mb-6 transition-all duration-150", isDropTarget && "ring-2 ring-primary/50 rounded-lg")}
      data-testid={`task-group-${group.id}`}
    >
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
