import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown, ChevronRight, AlertTriangle, ListChecks, ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { dateInputProps } from "@/lib/validation";
import { format } from "date-fns";
import { ActivityTasksPanel } from "@/pages/tasks/ActivityTasksPanel";
import {
  type ActivityWithAssignees,
  STATUS_OPTIONS,
  getStatusOption,
  isOverdue,
  isDatePast,
  getRowClassName,
} from "@/lib/activity-constants";

interface ActivityRowProps {
  activity: ActivityWithAssignees;
  children: ActivityWithAssignees[];
  allParentActivities: ActivityWithAssignees[];
  onSelect: (a: ActivityWithAssignees) => void;
  onStatusChange: (id: string, status: string) => void;
  onFieldChange: (id: string, data: Record<string, unknown>, recalculate: boolean) => void;
  users: Record<string, unknown>[];
  jobs: Record<string, unknown>[];
  jobId: string;
  currentUserId?: string;
  expanded: boolean;
  tasksExpanded: boolean;
  onToggleExpanded: () => void;
  onToggleTasksExpanded: () => void;
}

export function ActivityRow({
  activity,
  children,
  allParentActivities,
  onSelect,
  onStatusChange,
  onFieldChange,
  users,
  jobs,
  jobId,
  currentUserId,
  expanded,
  tasksExpanded,
  onToggleExpanded,
  onToggleTasksExpanded,
}: ActivityRowProps) {
  const statusOpt = getStatusOption(activity.status);
  const overdue = isOverdue(activity);
  const rowBg = getRowClassName(activity);

  return (
    <>
      <tr
        className={`border-t cursor-pointer group ${rowBg}`}
        onClick={() => onSelect(activity)}
        data-testid={`activity-row-${activity.id}`}
      >
        <td className="px-3 py-2 text-muted-foreground font-mono text-xs w-[40px]" data-testid={`text-sort-order-${activity.id}`}>
          {activity.sortOrder}
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            {children.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleExpanded(); }}
                className="p-0.5"
                aria-label={expanded ? "Collapse sub-activities" : "Expand sub-activities"}
                data-testid={`button-expand-${activity.id}`}
              >
                {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
            )}
            <span className="font-medium" data-testid={`text-activity-name-${activity.id}`}>{activity.name}</span>
            {(activity.checklistTotal || 0) > 0 && (
              <Badge
                variant={activity.checklistCompleted === activity.checklistTotal ? "default" : "secondary"}
                className={cn(
                  "text-[10px] px-1.5 py-0",
                  activity.checklistCompleted === activity.checklistTotal
                    ? "bg-green-600 text-white"
                    : "bg-blue-600 text-white"
                )}
                data-testid={`badge-checklist-${activity.id}`}
              >
                <ClipboardCheck className="h-3 w-3 mr-0.5" />
                {activity.checklistCompleted}/{activity.checklistTotal}
              </Badge>
            )}
            {overdue && (
              <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleTasksExpanded(); }}
              className={cn(
                "p-0.5 rounded transition-colors",
                tasksExpanded ? "text-primary" : "text-muted-foreground opacity-0 group-hover:opacity-100",
              )}
              style={{ opacity: tasksExpanded ? 1 : undefined }}
              aria-label={tasksExpanded ? "Hide tasks" : "Show tasks"}
              data-testid={`button-tasks-${activity.id}`}
            >
              <ListChecks className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
        <td className="px-3 py-2 text-muted-foreground text-xs">{activity.category || "-"}</td>
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <Select
            value={activity.status}
            onValueChange={(v) => onStatusChange(activity.id, v)}
          >
            <SelectTrigger className="h-7 border-0 w-auto p-0 shadow-none focus:ring-0 [&>svg]:hidden" data-testid={`inline-status-${activity.id}`}>
              <SelectValue>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusOpt.color}`}>
                  {statusOpt.label}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s.value} value={s.value}>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.color}`}>
                    {s.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <Input
            type="number"
            className="h-7 text-xs w-[70px] text-center"
            defaultValue={activity.estimatedDays ?? ""}
            key={`days-${activity.id}-${activity.estimatedDays}`}
            min={1}
            step="1"
            onBlur={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val) && val > 0 && val !== activity.estimatedDays) {
                onFieldChange(activity.id, { estimatedDays: val }, true);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.target as HTMLInputElement).blur();
              }
            }}
            data-testid={`input-days-${activity.id}`}
          />
        </td>
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <Select
            value={activity.predecessorSortOrder != null ? String(activity.predecessorSortOrder) : "none"}
            onValueChange={(v) => {
              const predOrder = v === "none" ? null : parseInt(v);
              const rel = predOrder != null ? (activity.relationship || "FS") : null;
              onFieldChange(activity.id, { predecessorSortOrder: predOrder, relationship: rel }, true);
            }}
          >
            <SelectTrigger className="h-7 text-xs w-[70px]" data-testid={`select-pred-${activity.id}`}>
              <SelectValue placeholder="-" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-</SelectItem>
              {allParentActivities
                .filter(a => a.sortOrder < activity.sortOrder)
                .map(a => (
                  <SelectItem key={a.id} value={String(a.sortOrder)}>
                    {a.sortOrder}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </td>
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <Select
            value={activity.relationship || "FS"}
            onValueChange={(v) => {
              onFieldChange(activity.id, { relationship: v }, true);
            }}
            disabled={activity.predecessorSortOrder == null}
          >
            <SelectTrigger className="h-7 text-xs w-[60px]" data-testid={`select-rel-${activity.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FS">FS</SelectItem>
              <SelectItem value="SS">SS</SelectItem>
              <SelectItem value="FF">FF</SelectItem>
              <SelectItem value="SF">SF</SelectItem>
            </SelectContent>
          </Select>
        </td>
        <td className="px-3 py-2 text-muted-foreground text-xs truncate max-w-[140px]">{activity.consultantName || "-"}</td>
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <Input
            type="date"
            {...dateInputProps}
            className={`h-7 text-xs w-[120px] ${isDatePast(activity.startDate, activity.status) ? "border-red-500 text-red-600 dark:text-red-400" : ""}`}
            value={activity.startDate ? format(new Date(activity.startDate), "yyyy-MM-dd") : ""}
            onChange={(e) => onFieldChange(activity.id, { startDate: e.target.value || null }, true)}
            data-testid={`input-start-date-${activity.id}`}
          />
        </td>
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <Input
            type="date"
            {...dateInputProps}
            className={`h-7 text-xs w-[120px] ${isDatePast(activity.endDate, activity.status) ? "border-red-500 text-red-600 dark:text-red-400" : ""}`}
            value={activity.endDate ? format(new Date(activity.endDate), "yyyy-MM-dd") : ""}
            onChange={(e) => onFieldChange(activity.id, { endDate: e.target.value || null }, false)}
            data-testid={`input-end-date-${activity.id}`}
          />
        </td>
        <td className="px-3 py-2 text-muted-foreground text-xs truncate max-w-[140px]">{activity.deliverable || "-"}</td>
      </tr>

      {tasksExpanded && (
        <tr data-testid={`activity-tasks-row-${activity.id}`}>
          <td colSpan={11} className="px-4 py-2 bg-muted/30">
            <ActivityTasksPanel
              activityId={activity.id}
              jobId={jobId}
              activityStartDate={activity.startDate ? String(activity.startDate) : null}
              activityEndDate={activity.endDate ? String(activity.endDate) : null}
              users={users as any}
              jobs={jobs as any}
              currentUserId={currentUserId}
            />
          </td>
        </tr>
      )}

      {expanded && children.map(child => {
        const childOverdue = isOverdue(child);
        const childRowBg = getRowClassName(child);
        const childStatus = getStatusOption(child.status);
        return (
          <tr
            key={child.id}
            className={`border-t cursor-pointer ${childRowBg || "bg-muted/30"}`}
            onClick={() => onSelect(child)}
            data-testid={`activity-row-child-${child.id}`}
          >
            <td className="px-3 py-1.5 text-muted-foreground font-mono text-xs w-[40px]" data-testid={`text-sort-order-child-${child.id}`}>
              {child.sortOrder}
            </td>
            <td className="px-3 py-1.5 pl-10">
              <div className="flex items-center gap-2">
                <span className="text-sm">{child.name}</span>
                {childOverdue && <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />}
              </div>
            </td>
            <td className="px-3 py-1.5 text-muted-foreground text-xs">{child.category || "-"}</td>
            <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${childStatus.color}`}>
                {childStatus.label}
              </span>
            </td>
            <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
              <Input
                type="number"
                className="h-6 text-xs w-[70px] text-center"
                defaultValue={child.estimatedDays ?? ""}
                key={`days-${child.id}-${child.estimatedDays}`}
                min={1}
                step="1"
                onBlur={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val > 0 && val !== child.estimatedDays) {
                    onFieldChange(child.id, { estimatedDays: val }, false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
              />
            </td>
            <td className="px-3 py-1.5 text-center text-xs text-muted-foreground">-</td>
            <td className="px-3 py-1.5 text-center text-xs text-muted-foreground">-</td>
            <td className="px-3 py-1.5 text-muted-foreground text-xs">{child.consultantName || "-"}</td>
            <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
              <Input
                type="date"
                {...dateInputProps}
                className={`h-6 text-xs w-[120px] ${isDatePast(child.startDate, child.status) ? "border-red-500 text-red-600 dark:text-red-400" : ""}`}
                value={child.startDate ? format(new Date(child.startDate), "yyyy-MM-dd") : ""}
                onChange={(e) => onFieldChange(child.id, { startDate: e.target.value || null }, false)}
              />
            </td>
            <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
              <Input
                type="date"
                {...dateInputProps}
                className={`h-6 text-xs w-[120px] ${isDatePast(child.endDate, child.status) ? "border-red-500 text-red-600 dark:text-red-400" : ""}`}
                value={child.endDate ? format(new Date(child.endDate), "yyyy-MM-dd") : ""}
                onChange={(e) => onFieldChange(child.id, { endDate: e.target.value || null }, false)}
              />
            </td>
            <td className="px-3 py-1.5 text-muted-foreground text-xs">{child.deliverable || "-"}</td>
          </tr>
        );
      })}
    </>
  );
}
