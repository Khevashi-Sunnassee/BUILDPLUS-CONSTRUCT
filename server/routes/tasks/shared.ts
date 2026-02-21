import multer from "multer";
import { z } from "zod";
import { storage } from "../../storage";

export async function isAdminOrManager(req: Request): Promise<boolean> {
  const userId = req.session?.userId;
  if (!userId) return false;
  const user = await storage.getUser(userId);
  return user?.role === "ADMIN" || user?.role === "MANAGER";
}

export function canAccessTask(task: { createdById?: string | null; assignees?: { userId: string }[] }, userId: string): boolean {
  if (task.createdById === userId) return true;
  if (task.assignees?.some(a => a.userId === userId)) return true;
  return false;
}

export const ALLOWED_TASK_FILE_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv", "application/json",
  "application/zip",
];

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TASK_FILE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

export const emailUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export const taskGroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  color: z.string().optional(),
  jobId: z.string().nullable().optional(),
});

export const taskCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  groupId: z.string().min(1, "Group ID is required"),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "STUCK", "DONE", "ON_HOLD"]).optional(),
  dueDate: z.string().nullable().optional(),
  reminderDate: z.string().nullable().optional(),
  consultant: z.string().max(255).nullable().optional(),
  projectStage: z.string().max(255).nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).nullable().optional(),
  jobId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  jobActivityId: z.string().nullable().optional(),
  draftingEmailId: z.string().nullable().optional(),
});

export const taskUpdateSchema_partial = z.object({
  title: z.string().min(1).max(500).optional(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "STUCK", "DONE", "ON_HOLD"]).optional(),
  dueDate: z.string().nullable().optional(),
  reminderDate: z.string().nullable().optional(),
  consultant: z.string().max(255).nullable().optional(),
  projectStage: z.string().max(255).nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).nullable().optional(),
  jobId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  jobActivityId: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
});

export const taskUpdateSchema = z.object({
  content: z.string().min(1, "Content is required").max(10000),
});
