export type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "STUCK" | "DONE" | "ON_HOLD";

export interface User {
  id: string;
  name: string | null;
  email: string;
}

export interface Job {
  id: string;
  jobNumber: string;
  name: string;
  status: string;
  productionSlotColor?: string | null;
}

export interface TaskAssignee {
  id: string;
  taskId: string;
  userId: string;
  user: User;
}

export interface Task {
  id: string;
  groupId: string;
  parentId: string | null;
  jobId: string | null;
  jobActivityId: string | null;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  reminderDate: string | null;
  consultant: string | null;
  projectStage: string | null;
  priority: string | null;
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

export interface TaskGroup {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isCollapsed: boolean;
  tasks: Task[];
}

export interface TaskUpdate {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  contentType?: string | null;
  emailSubject?: string | null;
  emailFrom?: string | null;
  emailTo?: string | null;
  emailDate?: string | null;
  emailBody?: string | null;
  createdAt: string;
  user: User;
  files?: TaskFile[];
}

export interface TaskFile {
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

export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bgClass: string }> = {
  NOT_STARTED: { label: "Not Started", color: "#6b7280", bgClass: "bg-gray-500" },
  IN_PROGRESS: { label: "In Progress", color: "#3b82f6", bgClass: "bg-blue-500" },
  STUCK: { label: "Stuck", color: "#ef4444", bgClass: "bg-red-500" },
  DONE: { label: "Done", color: "#22c55e", bgClass: "bg-green-500" },
  ON_HOLD: { label: "On Hold", color: "#eab308", bgClass: "bg-yellow-500" },
};

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; bgClass: string }> = {
  LOW: { label: "Low", bgClass: "bg-slate-500" },
  MEDIUM: { label: "Medium", bgClass: "bg-yellow-500" },
  HIGH: { label: "High", bgClass: "bg-orange-500" },
  CRITICAL: { label: "Critical", bgClass: "bg-red-500" },
};

export const PROJECT_STAGES = [
  "Planning",
  "Design",
  "Development",
  "Testing",
  "Deployment",
  "Completed",
];

export function getTaskGridTemplate(itemWidth: number): string {
  return `4px 30px 40px ${itemWidth}px 40px 100px 100px 120px 90px 120px 100px 60px 60px 40px`;
}

export const DEFAULT_ITEM_COL_WIDTH = 350;
export const MIN_ITEM_COL_WIDTH = 200;
export const MAX_ITEM_COL_WIDTH = 800;
export const ITEM_COL_STORAGE_KEY = "tasks-item-col-width";

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export type SortOption = "default" | "status" | "date-asc" | "date-desc" | "title";
