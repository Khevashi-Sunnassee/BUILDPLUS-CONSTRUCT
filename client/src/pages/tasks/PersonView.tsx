import { useState, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronDown, ChevronRight, UserX } from "lucide-react";
import { TaskRow } from "./TaskRow";
import type { Task, TaskGroup, User, Job } from "./types";
import {
  STATUS_CONFIG,
  getInitials,
  getTaskGridTemplate,
  DEFAULT_ITEM_COL_WIDTH,
  MIN_ITEM_COL_WIDTH,
  MAX_ITEM_COL_WIDTH,
  ITEM_COL_STORAGE_KEY,
} from "./types";

interface PersonSection {
  userId: string | null;
  userName: string;
  userEmail: string;
  tasks: Task[];
}

export function PersonView({
  groups,
  users,
  jobs,
  onOpenSidebar,
  showCompleted,
  selectedTaskIds,
  onToggleTaskSelected,
  personFilter,
}: {
  groups: TaskGroup[];
  users: User[];
  jobs: Job[];
  onOpenSidebar: (task: Task) => void;
  showCompleted: boolean;
  selectedTaskIds: Set<string>;
  onToggleTaskSelected: (taskId: string) => void;
  personFilter: string;
}) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());

  const [itemColWidth] = useState<number>(() => {
    const saved = localStorage.getItem(ITEM_COL_STORAGE_KEY);
    return saved ? Math.max(MIN_ITEM_COL_WIDTH, Math.min(MAX_ITEM_COL_WIDTH, parseInt(saved, 10) || DEFAULT_ITEM_COL_WIDTH)) : DEFAULT_ITEM_COL_WIDTH;
  });
  const gridTemplate = getTaskGridTemplate(itemColWidth);

  const allTasks = useMemo(() => {
    return groups.flatMap((g) => g.tasks);
  }, [groups]);

  const personSections = useMemo(() => {
    const userTaskMap = new Map<string, Task[]>();
    const unassignedTasks: Task[] = [];

    allTasks.forEach((task) => {
      if (task.assignees.length === 0) {
        unassignedTasks.push(task);
      } else {
        task.assignees.forEach((assignee) => {
          const existing = userTaskMap.get(assignee.userId) || [];
          if (!existing.find(t => t.id === task.id)) {
            existing.push(task);
          }
          userTaskMap.set(assignee.userId, existing);
        });
      }
    });

    const sections: PersonSection[] = [];

    const sortedUserIds = Array.from(userTaskMap.keys()).sort((a, b) => {
      const userA = users.find(u => u.id === a);
      const userB = users.find(u => u.id === b);
      return (userA?.name || userA?.email || "").localeCompare(userB?.name || userB?.email || "");
    });

    sortedUserIds.forEach((userId) => {
      const user = users.find(u => u.id === userId);
      sections.push({
        userId,
        userName: user?.name || "Unknown User",
        userEmail: user?.email || "",
        tasks: userTaskMap.get(userId) || [],
      });
    });

    if (unassignedTasks.length > 0) {
      sections.push({
        userId: null,
        userName: "Unassigned",
        userEmail: "",
        tasks: unassignedTasks,
      });
    }

    if (personFilter && personFilter !== "all") {
      if (personFilter === "unassigned") {
        return sections.filter(s => s.userId === null);
      }
      return sections.filter(s => s.userId === personFilter);
    }

    return sections;
  }, [allTasks, users, personFilter]);

  const toggleSection = useCallback((key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleExpanded = useCallback((taskId: string) => {
    setExpandedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  if (personSections.length === 0) {
    return (
      <div className="text-center py-16 border rounded-lg bg-muted/30">
        <p className="text-muted-foreground">No tasks found for the selected person.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-visible bg-card" data-testid="person-view">
      {personSections.map((section) => {
        const sectionKey = section.userId || "unassigned";
        const isCollapsed = collapsedSections.has(sectionKey);
        const statusCounts = section.tasks.reduce((acc, t) => {
          acc[t.status] = (acc[t.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        return (
          <div key={sectionKey} className="border-b last:border-b-0" data-testid={`person-section-${sectionKey}`}>
            <div
              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/50 select-none"
              onClick={() => toggleSection(sectionKey)}
              data-testid={`person-section-header-${sectionKey}`}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              )}

              {section.userId ? (
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                    {getInitials(section.userName)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <UserX className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}

              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="font-semibold text-sm truncate">{section.userName}</span>
                {section.userEmail && (
                  <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                    {section.userEmail}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {Object.entries(statusCounts).map(([status, count]) => {
                  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
                  if (!config) return null;
                  return (
                    <Badge
                      key={status}
                      variant="outline"
                      className="text-[10px] px-1.5 py-0"
                      style={{ borderColor: config.color, color: config.color }}
                    >
                      {count} {config.label}
                    </Badge>
                  );
                })}
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                  {section.tasks.length} total
                </Badge>
              </div>
            </div>

            {!isCollapsed && (
              <div>
                <div
                  className="grid items-center px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider border-b bg-muted/30"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  <div />
                  <div />
                  <div />
                  <div className="pl-1">Item</div>
                  <div />
                  <div>Assignee</div>
                  <div>Status</div>
                  <div>Date</div>
                  <div>Priority</div>
                  <div>Job</div>
                  <div>Group</div>
                  <div className="text-center">Msgs</div>
                  <div className="text-center">Files</div>
                  <div />
                </div>
                {section.tasks.map((task) => (
                  <PersonTaskRow
                    key={task.id}
                    task={task}
                    users={users}
                    jobs={jobs}
                    onOpenSidebar={onOpenSidebar}
                    showCompleted={showCompleted}
                    isExpanded={expandedTaskIds.has(task.id)}
                    onToggleExpanded={() => toggleExpanded(task.id)}
                    isSelected={selectedTaskIds.has(task.id)}
                    onToggleSelected={() => onToggleTaskSelected(task.id)}
                    gridTemplate={gridTemplate}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PersonTaskRow({
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
  return (
    <TaskRow
      task={task}
      users={users}
      jobs={jobs}
      isSubtask={false}
      onOpenSidebar={onOpenSidebar}
      showCompleted={showCompleted}
      isExpanded={isExpanded}
      onToggleExpanded={onToggleExpanded}
      isSelected={isSelected}
      onToggleSelected={onToggleSelected}
      gridTemplate={gridTemplate}
    />
  );
}
