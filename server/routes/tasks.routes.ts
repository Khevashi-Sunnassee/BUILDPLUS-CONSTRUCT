import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import logger from "../lib/logger";
import { emailService } from "../services/email.service";

const router = Router();

const ALLOWED_TASK_FILE_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv", "application/json",
  "application/zip",
];

const upload = multer({
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

const taskGroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  color: z.string().optional(),
});

const taskCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  groupId: z.string().min(1, "Group ID is required"),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "STUCK", "DONE", "ON_HOLD"]).optional(),
  dueDate: z.string().nullable().optional(),
  reminderDate: z.string().nullable().optional(),
  consultant: z.string().max(255).optional(),
  projectStage: z.string().max(255).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).nullable().optional(),
  jobId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  jobActivityId: z.string().nullable().optional(),
});

const taskUpdateSchema_partial = z.object({
  title: z.string().min(1).max(500).optional(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "STUCK", "DONE", "ON_HOLD"]).optional(),
  dueDate: z.string().nullable().optional(),
  reminderDate: z.string().nullable().optional(),
  consultant: z.string().max(255).optional(),
  projectStage: z.string().max(255).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).nullable().optional(),
  jobId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  jobActivityId: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
});

const taskUpdateSchema = z.object({
  content: z.string().min(1, "Content is required").max(10000),
});

router.get("/api/task-groups", requireAuth, requirePermission("tasks"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session.userId;
    const user = userId ? await storage.getUser(userId) : null;
    const isAdminOrManager = user?.role === "ADMIN" || user?.role === "MANAGER";
    const filterUserId = isAdminOrManager ? undefined : userId;
    const groups = await storage.getAllTaskGroups(companyId, filterUserId);
    res.json(groups);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching task groups");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch task groups" });
  }
});

router.get("/api/task-groups/:id", requireAuth, requirePermission("tasks"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const group = await storage.getTaskGroup(String(req.params.id));
    if (!group || group.companyId !== companyId) return res.status(404).json({ error: "Task group not found" });
    res.json(group);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching task group");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch task group" });
  }
});

router.post("/api/task-groups", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const parsed = taskGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const group = await storage.createTaskGroup({ ...parsed.data, companyId });
    res.status(201).json(group);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating task group");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create task group" });
  }
});

router.patch("/api/task-groups/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const existing = await storage.getTaskGroup(String(req.params.id));
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Task group not found" });
    const parsed = taskGroupSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    if (parsed.data.color) {
      const allGroups = await storage.getAllTaskGroups(companyId);
      const colorInUse = allGroups.some(
        g => g.id !== String(req.params.id) && g.color?.toLowerCase() === parsed.data.color!.toLowerCase()
      );
      if (colorInUse) {
        return res.status(400).json({ error: "This color is already used by another group" });
      }
    }

    const group = await storage.updateTaskGroup(String(req.params.id), parsed.data);
    if (!group) return res.status(404).json({ error: "Task group not found" });
    res.json(group);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating task group");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update task group" });
  }
});

router.delete("/api/task-groups/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const existing = await storage.getTaskGroup(String(req.params.id));
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Task group not found" });
    await storage.deleteTaskGroup(String(req.params.id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting task group");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete task group" });
  }
});

router.post("/api/task-groups/reorder", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { groupIds } = req.body;
    if (!Array.isArray(groupIds)) {
      return res.status(400).json({ error: "groupIds must be an array" });
    }
    for (const gid of groupIds) {
      const group = await storage.getTaskGroup(gid);
      if (!group || group.companyId !== companyId) {
        return res.status(403).json({ error: "Invalid group IDs" });
      }
    }
    await storage.reorderTaskGroups(groupIds);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error reordering task groups");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to reorder task groups" });
  }
});

router.get("/api/tasks/:id", requireAuth, requirePermission("tasks"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const task = await storage.getTask(String(req.params.id));
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (task.groupId) {
      const group = await storage.getTaskGroup(task.groupId);
      if (!group || group.companyId !== companyId) return res.status(404).json({ error: "Task not found" });
    }
    res.json(task);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching task");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch task" });
  }
});

router.post("/api/tasks", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    
    const parsed = taskCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    
    const userId = req.session.userId;
    const taskData = { ...parsed.data } as any;
    
    // Verify task group belongs to company
    const group = await storage.getTaskGroup(taskData.groupId);
    if (!group || group.companyId !== companyId) {
      return res.status(400).json({ error: "Invalid task group" });
    }
    
    // Convert date strings to Date objects for Drizzle timestamp columns
    if (taskData.dueDate !== undefined) {
      taskData.dueDate = taskData.dueDate ? new Date(taskData.dueDate) : null;
    }
    if (taskData.reminderDate !== undefined) {
      taskData.reminderDate = taskData.reminderDate ? new Date(taskData.reminderDate) : null;
    }
    
    const task = await storage.createTask({
      ...taskData,
      createdById: userId,
    });
    res.status(201).json(task);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating task");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create task" });
  }
});

router.patch("/api/tasks/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    
    const parsed = taskUpdateSchema_partial.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    
    const existingTask = await storage.getTask(String(req.params.id));
    if (!existingTask) return res.status(404).json({ error: "Task not found" });
    if (existingTask.groupId) {
      const group = await storage.getTaskGroup(existingTask.groupId);
      if (!group || group.companyId !== companyId) return res.status(404).json({ error: "Task not found" });
    }
    const updateData = { ...parsed.data } as any;
    if (updateData.dueDate !== undefined) {
      updateData.dueDate = updateData.dueDate ? new Date(updateData.dueDate) : null;
    }
    if (updateData.reminderDate !== undefined) {
      updateData.reminderDate = updateData.reminderDate ? new Date(updateData.reminderDate) : null;
    }
    const task = await storage.updateTask(String(req.params.id), updateData);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating task");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update task" });
  }
});

router.delete("/api/tasks/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const existingTask = await storage.getTask(String(req.params.id));
    if (!existingTask) return res.status(404).json({ error: "Task not found" });
    if (existingTask.groupId) {
      const group = await storage.getTaskGroup(existingTask.groupId);
      if (!group || group.companyId !== companyId) return res.status(404).json({ error: "Task not found" });
    }
    await storage.deleteTask(String(req.params.id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting task");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete task" });
  }
});

router.post("/api/tasks/reorder", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const { groupId, taskIds } = req.body;
    if (!groupId || !Array.isArray(taskIds)) {
      return res.status(400).json({ error: "groupId and taskIds array are required" });
    }
    const group = await storage.getTaskGroup(groupId);
    if (!group || group.companyId !== companyId) {
      return res.status(404).json({ error: "Task group not found" });
    }
    await storage.reorderTasks(groupId, taskIds);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error reordering tasks");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to reorder tasks" });
  }
});

router.post("/api/tasks/:id/move", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const { targetGroupId, targetIndex } = req.body;
    if (!targetGroupId) {
      return res.status(400).json({ error: "targetGroupId is required" });
    }
    const targetGroup = await storage.getTaskGroup(targetGroupId);
    if (!targetGroup || targetGroup.companyId !== companyId) {
      return res.status(404).json({ error: "Target group not found" });
    }
    const existingTask = await storage.getTask(String(req.params.id));
    if (!existingTask) return res.status(404).json({ error: "Task not found" });
    if (existingTask.groupId) {
      const group = await storage.getTaskGroup(existingTask.groupId);
      if (!group || group.companyId !== companyId) return res.status(404).json({ error: "Task not found" });
    }
    const task = await storage.moveTaskToGroup(String(req.params.id), targetGroupId, targetIndex ?? 0);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json(task);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error moving task");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to move task" });
  }
});

router.get("/api/tasks/:id/assignees", requireAuth, requirePermission("tasks"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const task = await storage.getTask(String(req.params.id));
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (task.groupId) {
      const group = await storage.getTaskGroup(task.groupId);
      if (!group || group.companyId !== companyId) return res.status(404).json({ error: "Task not found" });
    }
    const assignees = await storage.getTaskAssignees(String(req.params.id));
    res.json(assignees);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching task assignees");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch task assignees" });
  }
});

router.put("/api/tasks/:id/assignees", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const task = await storage.getTask(String(req.params.id));
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (task.groupId) {
      const group = await storage.getTaskGroup(task.groupId);
      if (!group || group.companyId !== companyId) return res.status(404).json({ error: "Task not found" });
    }
    const { userIds } = req.body;
    if (!Array.isArray(userIds)) {
      return res.status(400).json({ error: "userIds must be an array" });
    }
    const assignees = await storage.setTaskAssignees(String(req.params.id), userIds);
    res.json(assignees);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error setting task assignees");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to set task assignees" });
  }
});

router.get("/api/tasks/:id/updates", requireAuth, requirePermission("tasks"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const task = await storage.getTask(String(req.params.id));
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (task.groupId) {
      const group = await storage.getTaskGroup(task.groupId);
      if (!group || group.companyId !== companyId) return res.status(404).json({ error: "Task not found" });
    }
    const updates = await storage.getTaskUpdates(String(req.params.id));
    res.json(updates);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching task updates");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch task updates" });
  }
});

router.post("/api/tasks/:id/updates", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const parsed = taskUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const taskId = String(req.params.id);
    
    const task = await storage.getTask(taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (task.groupId) {
      const group = await storage.getTaskGroup(task.groupId);
      if (!group || group.companyId !== companyId) return res.status(404).json({ error: "Task not found" });
    }
    
    const update = await storage.createTaskUpdate({
      taskId,
      userId,
      content: parsed.data.content,
    });
    
    const taskTitle = task.title || "Task";
    
    const fromUser = await storage.getUser(userId);
    const fromName = fromUser?.name || fromUser?.email || "Someone";
    
    const contentStr = parsed.data.content;
    await storage.createTaskNotificationsForAssignees(
      taskId,
      userId,
      "COMMENT",
      `New comment on "${taskTitle}"`,
      `${fromName}: ${contentStr.substring(0, 100)}${contentStr.length > 100 ? '...' : ''}`,
      update.id
    );
    
    res.status(201).json(update);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating task update");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create task update" });
  }
});

router.delete("/api/task-updates/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const update = await storage.getTaskUpdate(String(req.params.id));
    if (!update) return res.status(404).json({ error: "Update not found" });
    const task = await storage.getTask(update.taskId);
    if (!task) return res.status(404).json({ error: "Update not found" });
    if (task.groupId) {
      const group = await storage.getTaskGroup(task.groupId);
      if (!group || group.companyId !== companyId) return res.status(404).json({ error: "Update not found" });
    }
    await storage.deleteTaskUpdate(String(req.params.id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting task update");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete task update" });
  }
});

router.get("/api/tasks/:id/files", requireAuth, requirePermission("tasks"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const task = await storage.getTask(String(req.params.id));
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (task.groupId) {
      const group = await storage.getTaskGroup(task.groupId);
      if (!group || group.companyId !== companyId) return res.status(404).json({ error: "Task not found" });
    }
    const files = await storage.getTaskFiles(String(req.params.id));
    res.json(files);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching task files");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch task files" });
  }
});

router.post("/api/tasks/:id/files", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), upload.single("file"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const task = await storage.getTask(String(req.params.id));
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (task.groupId) {
      const group = await storage.getTaskGroup(task.groupId);
      if (!group || group.companyId !== companyId) return res.status(404).json({ error: "Task not found" });
    }
    const userId = req.session.userId;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const base64 = file.buffer.toString("base64");
    const dataUrl = `data:${file.mimetype};base64,${base64}`;
    
    const updateId = req.body.updateId || null;

    const taskFile = await storage.createTaskFile({
      taskId: String(req.params.id),
      updateId,
      fileName: file.originalname,
      fileUrl: dataUrl,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedById: userId,
    });
    res.status(201).json(taskFile);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error uploading task file");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to upload task file" });
  }
});

router.delete("/api/task-files/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const file = await storage.getTaskFile(String(req.params.id));
    if (!file) return res.status(404).json({ error: "File not found" });
    const task = await storage.getTask(file.taskId);
    if (!task) return res.status(404).json({ error: "File not found" });
    if (task.groupId) {
      const group = await storage.getTaskGroup(task.groupId);
      if (!group || group.companyId !== companyId) return res.status(404).json({ error: "File not found" });
    }
    await storage.deleteTaskFile(String(req.params.id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting task file");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete task file" });
  }
});

router.get("/api/task-notifications", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const notifications = await storage.getTaskNotifications(userId);
    res.json(notifications);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching task notifications");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch task notifications" });
  }
});

router.get("/api/task-notifications/unread-count", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const count = await storage.getUnreadTaskNotificationCount(userId);
    res.json({ count });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching unread task notification count");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch count" });
  }
});

router.post("/api/task-notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const notification = await storage.getTaskNotificationById(String(req.params.id));
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }
    if (notification.userId !== userId) {
      return res.status(403).json({ error: "Not authorized to mark this notification" });
    }
    await storage.markTaskNotificationRead(String(req.params.id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error marking notification read");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to mark notification read" });
  }
});

router.post("/api/task-notifications/read-all", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    await storage.markAllTaskNotificationsRead(userId);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error marking all notifications read");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to mark notifications read" });
  }
});

router.post("/api/tasks/send-email", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      to: z.string().min(1),
      cc: z.string().optional(),
      subject: z.string().min(1),
      message: z.string().min(1),
      sendCopy: z.boolean().optional(),
    });

    const data = schema.parse(req.body);
    const userId = req.session.userId!;

    if (!emailService.isConfigured()) {
      return res.status(500).json({ error: "Email service is not configured" });
    }

    const currentUser = await storage.getUser(userId);
    const result = await emailService.sendEmailWithAttachment({
      to: data.to,
      cc: data.cc,
      bcc: data.sendCopy && currentUser?.email ? currentUser.email : undefined,
      subject: data.subject,
      body: data.message.replace(/\n/g, "<br>"),
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, messageId: result.messageId });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error sending tasks email");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to send email" });
  }
});

export const tasksRouter = router;
