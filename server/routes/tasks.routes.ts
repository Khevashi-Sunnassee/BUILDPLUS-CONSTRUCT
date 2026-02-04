import { Router } from "express";
import multer from "multer";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import logger from "../lib/logger";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

router.get("/api/task-groups", requireAuth, requirePermission("tasks"), async (req, res) => {
  try {
    const groups = await storage.getAllTaskGroups();
    res.json(groups);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching task groups");
    res.status(500).json({ error: error.message || "Failed to fetch task groups" });
  }
});

router.get("/api/task-groups/:id", requireAuth, requirePermission("tasks"), async (req, res) => {
  try {
    const group = await storage.getTaskGroup(String(req.params.id));
    if (!group) return res.status(404).json({ error: "Task group not found" });
    res.json(group);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching task group");
    res.status(500).json({ error: error.message || "Failed to fetch task group" });
  }
});

router.post("/api/task-groups", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const group = await storage.createTaskGroup(req.body);
    res.status(201).json(group);
  } catch (error: any) {
    logger.error({ err: error }, "Error creating task group");
    res.status(500).json({ error: error.message || "Failed to create task group" });
  }
});

router.patch("/api/task-groups/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const group = await storage.updateTaskGroup(String(req.params.id), req.body);
    if (!group) return res.status(404).json({ error: "Task group not found" });
    res.json(group);
  } catch (error: any) {
    logger.error({ err: error }, "Error updating task group");
    res.status(500).json({ error: error.message || "Failed to update task group" });
  }
});

router.delete("/api/task-groups/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    await storage.deleteTaskGroup(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error deleting task group");
    res.status(500).json({ error: error.message || "Failed to delete task group" });
  }
});

router.post("/api/task-groups/reorder", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const { groupIds } = req.body;
    if (!Array.isArray(groupIds)) {
      return res.status(400).json({ error: "groupIds must be an array" });
    }
    await storage.reorderTaskGroups(groupIds);
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error reordering task groups");
    res.status(500).json({ error: error.message || "Failed to reorder task groups" });
  }
});

router.get("/api/tasks/:id", requireAuth, requirePermission("tasks"), async (req, res) => {
  try {
    const task = await storage.getTask(String(req.params.id));
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching task");
    res.status(500).json({ error: error.message || "Failed to fetch task" });
  }
});

router.post("/api/tasks", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const userId = (req.session as any).userId;
    const task = await storage.createTask({
      ...req.body,
      createdById: userId,
    });
    res.status(201).json(task);
  } catch (error: any) {
    logger.error({ err: error }, "Error creating task");
    res.status(500).json({ error: error.message || "Failed to create task" });
  }
});

router.patch("/api/tasks/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.dueDate !== undefined) {
      updateData.dueDate = updateData.dueDate ? new Date(updateData.dueDate) : null;
    }
    const task = await storage.updateTask(String(req.params.id), updateData);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  } catch (error: any) {
    logger.error({ err: error }, "Error updating task");
    res.status(500).json({ error: error.message || "Failed to update task" });
  }
});

router.delete("/api/tasks/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    await storage.deleteTask(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error deleting task");
    res.status(500).json({ error: error.message || "Failed to delete task" });
  }
});

router.post("/api/tasks/reorder", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const { groupId, taskIds } = req.body;
    if (!groupId || !Array.isArray(taskIds)) {
      return res.status(400).json({ error: "groupId and taskIds array are required" });
    }
    await storage.reorderTasks(groupId, taskIds);
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error reordering tasks");
    res.status(500).json({ error: error.message || "Failed to reorder tasks" });
  }
});

router.get("/api/tasks/:id/assignees", requireAuth, requirePermission("tasks"), async (req, res) => {
  try {
    const assignees = await storage.getTaskAssignees(String(req.params.id));
    res.json(assignees);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching task assignees");
    res.status(500).json({ error: error.message || "Failed to fetch task assignees" });
  }
});

router.put("/api/tasks/:id/assignees", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds)) {
      return res.status(400).json({ error: "userIds must be an array" });
    }
    const assignees = await storage.setTaskAssignees(String(req.params.id), userIds);
    res.json(assignees);
  } catch (error: any) {
    logger.error({ err: error }, "Error setting task assignees");
    res.status(500).json({ error: error.message || "Failed to set task assignees" });
  }
});

router.get("/api/tasks/:id/updates", requireAuth, requirePermission("tasks"), async (req, res) => {
  try {
    const updates = await storage.getTaskUpdates(String(req.params.id));
    res.json(updates);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching task updates");
    res.status(500).json({ error: error.message || "Failed to fetch task updates" });
  }
});

router.post("/api/tasks/:id/updates", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const userId = (req.session as any).userId;
    const taskId = String(req.params.id);
    const update = await storage.createTaskUpdate({
      taskId,
      userId,
      content: req.body.content,
    });
    
    const taskGroups = await storage.getAllTaskGroups();
    let taskTitle = "Task";
    for (const group of taskGroups) {
      const task = group.tasks.find(t => t.id === taskId);
      if (task) {
        taskTitle = task.title;
        break;
      }
    }
    
    const fromUser = await storage.getUser(userId);
    const fromName = fromUser?.name || fromUser?.email || "Someone";
    
    await storage.createTaskNotificationsForAssignees(
      taskId,
      userId,
      "COMMENT",
      `New comment on "${taskTitle}"`,
      `${fromName}: ${req.body.content.substring(0, 100)}${req.body.content.length > 100 ? '...' : ''}`,
      update.id
    );
    
    res.status(201).json(update);
  } catch (error: any) {
    logger.error({ err: error }, "Error creating task update");
    res.status(500).json({ error: error.message || "Failed to create task update" });
  }
});

router.delete("/api/task-updates/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    await storage.deleteTaskUpdate(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error deleting task update");
    res.status(500).json({ error: error.message || "Failed to delete task update" });
  }
});

router.get("/api/tasks/:id/files", requireAuth, requirePermission("tasks"), async (req, res) => {
  try {
    const files = await storage.getTaskFiles(String(req.params.id));
    res.json(files);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching task files");
    res.status(500).json({ error: error.message || "Failed to fetch task files" });
  }
});

router.post("/api/tasks/:id/files", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), upload.single("file"), async (req, res) => {
  try {
    const userId = (req.session as any).userId;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const base64 = file.buffer.toString("base64");
    const dataUrl = `data:${file.mimetype};base64,${base64}`;

    const taskFile = await storage.createTaskFile({
      taskId: String(req.params.id),
      fileName: file.originalname,
      fileUrl: dataUrl,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedById: userId,
    });
    res.status(201).json(taskFile);
  } catch (error: any) {
    logger.error({ err: error }, "Error uploading task file");
    res.status(500).json({ error: error.message || "Failed to upload task file" });
  }
});

router.delete("/api/task-files/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    await storage.deleteTaskFile(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error deleting task file");
    res.status(500).json({ error: error.message || "Failed to delete task file" });
  }
});

router.get("/api/task-notifications", requireAuth, async (req, res) => {
  try {
    const userId = (req.session as any).userId;
    const notifications = await storage.getTaskNotifications(userId);
    res.json(notifications);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching task notifications");
    res.status(500).json({ error: error.message || "Failed to fetch task notifications" });
  }
});

router.get("/api/task-notifications/unread-count", requireAuth, async (req, res) => {
  try {
    const userId = (req.session as any).userId;
    const count = await storage.getUnreadTaskNotificationCount(userId);
    res.json({ count });
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching unread task notification count");
    res.status(500).json({ error: error.message || "Failed to fetch count" });
  }
});

router.post("/api/task-notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const userId = (req.session as any).userId;
    const notification = await storage.getTaskNotificationById(String(req.params.id));
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }
    if (notification.userId !== userId) {
      return res.status(403).json({ error: "Not authorized to mark this notification" });
    }
    await storage.markTaskNotificationRead(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error marking notification read");
    res.status(500).json({ error: error.message || "Failed to mark notification read" });
  }
});

router.post("/api/task-notifications/read-all", requireAuth, async (req, res) => {
  try {
    const userId = (req.session as any).userId;
    await storage.markAllTaskNotificationsRead(userId);
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error marking all notifications read");
    res.status(500).json({ error: error.message || "Failed to mark notifications read" });
  }
});

export const tasksRouter = router;
