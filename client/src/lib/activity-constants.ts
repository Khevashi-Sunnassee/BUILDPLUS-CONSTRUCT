import type { JobActivity } from "@shared/schema";
import { startOfDay, isBefore } from "date-fns";

export type ActivityWithAssignees = JobActivity & {
  assignees?: Array<{ id: string; activityId: string; userId: string }>;
  checklistTotal?: number;
  checklistCompleted?: number;
};

export const STATUS_OPTIONS = [
  { value: "NOT_STARTED", label: "Not Started", color: "bg-muted text-muted-foreground" },
  { value: "IN_PROGRESS", label: "In Progress", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "STUCK", label: "Stuck", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  { value: "DONE", label: "Done", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "ON_HOLD", label: "On Hold", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  { value: "SKIPPED", label: "Skipped", color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
] as const;

export function getStatusOption(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
}

export function formatStatusLabel(status: string): string {
  switch (status) {
    case "NOT_STARTED": return "Not Started";
    case "IN_PROGRESS": return "In Progress";
    case "STUCK": return "Stuck";
    case "DONE": return "Done";
    case "ON_HOLD": return "On Hold";
    case "SKIPPED": return "Skipped";
    default: return status.replace(/_/g, " ");
  }
}

export function isOverdue(activity: ActivityWithAssignees): boolean {
  if (activity.status === "DONE" || activity.status === "SKIPPED") return false;
  if (!activity.endDate) return false;
  const today = startOfDay(new Date());
  const endDate = startOfDay(new Date(activity.endDate));
  return isBefore(endDate, today);
}

export function isDatePast(date: string | Date | null | undefined, status: string): boolean {
  if (status === "DONE" || status === "SKIPPED") return false;
  if (!date) return false;
  const today = startOfDay(new Date());
  const d = startOfDay(new Date(date));
  return isBefore(d, today);
}

export function getRowClassName(activity: ActivityWithAssignees): string {
  if (activity.status === "DONE") return "bg-green-50 dark:bg-green-950/20";
  if (isOverdue(activity)) return "bg-red-50 dark:bg-red-950/20";
  if (activity.status === "STUCK") return "bg-red-50/50 dark:bg-red-950/10";
  if (activity.status === "ON_HOLD") return "bg-yellow-50 dark:bg-yellow-950/20";
  if (activity.status === "IN_PROGRESS") return "bg-blue-50/50 dark:bg-blue-950/10";
  return "";
}
