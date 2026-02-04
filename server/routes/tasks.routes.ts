import { Router } from "express";
import multer from "multer";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

router.get("/task-groups", requireAuth, requirePermission("tasks"), async (req, res) => {
  try {
    const groups = await storage.getAllTaskGroups();
    res.json(groups);
  } catch (error: any) {
    console.error("Error fetching task groups:", error);
    res.status(500).json({ error: error.message || "Failed to fetch task groups" });
  }
});

router.get("/task-groups/:id", requireAuth, requirePermission("tasks"), async (req, res) => {
  try {
    const group = await storage.getTaskGroup(String(req.params.id));
    if (!group) return res.status(404).json({ error: "Task group not found" });
    res.json(group);
  } catch (error: any) {
    console.error("Error fetching task group:", error);
    res.status(500).json({ error: error.message || "Failed to fetch task group" });
  }
});

router.post("/task-groups", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const group = await storage.createTaskGroup(req.body);
    res.status(201).json(group);
  } catch (error: any) {
    console.error("Error creating task group:", error);
    res.status(500).json({ error: error.message || "Failed to create task group" });
  }
});

router.patch("/task-groups/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const group = await storage.updateTaskGroup(String(req.params.id), req.body);
    if (!group) return res.status(404).json({ error: "Task group not found" });
    res.json(group);
  } catch (error: any) {
    console.error("Error updating task group:", error);
    res.status(500).json({ error: error.message || "Failed to update task group" });
  }
});

router.delete("/task-groups/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    await storage.deleteTaskGroup(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting task group:", error);
    res.status(500).json({ error: error.message || "Failed to delete task group" });
  }
});

router.post("/task-groups/reorder", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const { groupIds } = req.body;
    if (!Array.isArray(groupIds)) {
      return res.status(400).json({ error: "groupIds must be an array" });
    }
    await storage.reorderTaskGroups(groupIds);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error reordering task groups:", error);
    res.status(500).json({ error: error.message || "Failed to reorder task groups" });
  }
});

router.get("/tasks/:id", requireAuth, requirePermission("tasks"), async (req, res) => {
  try {
    const task = await storage.getTask(String(req.params.id));
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  } catch (error: any) {
    console.error("Error fetching task:", error);
    res.status(500).json({ error: error.message || "Failed to fetch task" });
  }
});

router.post("/tasks", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const userId = (req.session as any).userId;
    const task = await storage.createTask({
      ...req.body,
      createdById: userId,
    });
    res.status(201).json(task);
  } catch (error: any) {
    console.error("Error creating task:", error);
    res.status(500).json({ error: error.message || "Failed to create task" });
  }
});

router.patch("/tasks/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.dueDate !== undefined) {
      updateData.dueDate = updateData.dueDate ? new Date(updateData.dueDate) : null;
    }
    const task = await storage.updateTask(String(req.params.id), updateData);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  } catch (error: any) {
    console.error("Error updating task:", error);
    res.status(500).json({ error: error.message || "Failed to update task" });
  }
});

router.delete("/tasks/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    await storage.deleteTask(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting task:", error);
    res.status(500).json({ error: error.message || "Failed to delete task" });
  }
});

router.post("/tasks/reorder", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const { groupId, taskIds } = req.body;
    if (!groupId || !Array.isArray(taskIds)) {
      return res.status(400).json({ error: "groupId and taskIds array are required" });
    }
    await storage.reorderTasks(groupId, taskIds);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error reordering tasks:", error);
    res.status(500).json({ error: error.message || "Failed to reorder tasks" });
  }
});

router.get("/tasks/:id/assignees", requireAuth, requirePermission("tasks"), async (req, res) => {
  try {
    const assignees = await storage.getTaskAssignees(String(req.params.id));
    res.json(assignees);
  } catch (error: any) {
    console.error("Error fetching task assignees:", error);
    res.status(500).json({ error: error.message || "Failed to fetch task assignees" });
  }
});

router.put("/tasks/:id/assignees", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds)) {
      return res.status(400).json({ error: "userIds must be an array" });
    }
    const assignees = await storage.setTaskAssignees(String(req.params.id), userIds);
    res.json(assignees);
  } catch (error: any) {
    console.error("Error setting task assignees:", error);
    res.status(500).json({ error: error.message || "Failed to set task assignees" });
  }
});

router.get("/tasks/:id/updates", requireAuth, requirePermission("tasks"), async (req, res) => {
  try {
    const updates = await storage.getTaskUpdates(String(req.params.id));
    res.json(updates);
  } catch (error: any) {
    console.error("Error fetching task updates:", error);
    res.status(500).json({ error: error.message || "Failed to fetch task updates" });
  }
});

router.post("/tasks/:id/updates", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
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
    console.error("Error creating task update:", error);
    res.status(500).json({ error: error.message || "Failed to create task update" });
  }
});

router.delete("/task-updates/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    await storage.deleteTaskUpdate(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting task update:", error);
    res.status(500).json({ error: error.message || "Failed to delete task update" });
  }
});

router.get("/tasks/:id/files", requireAuth, requirePermission("tasks"), async (req, res) => {
  try {
    const files = await storage.getTaskFiles(String(req.params.id));
    res.json(files);
  } catch (error: any) {
    console.error("Error fetching task files:", error);
    res.status(500).json({ error: error.message || "Failed to fetch task files" });
  }
});

router.post("/tasks/:id/files", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), upload.single("file"), async (req, res) => {
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
    console.error("Error uploading task file:", error);
    res.status(500).json({ error: error.message || "Failed to upload task file" });
  }
});

router.delete("/task-files/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    await storage.deleteTaskFile(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting task file:", error);
    res.status(500).json({ error: error.message || "Failed to delete task file" });
  }
});

router.get("/task-notifications", requireAuth, async (req, res) => {
  try {
    const userId = (req.session as any).userId;
    const notifications = await storage.getTaskNotifications(userId);
    res.json(notifications);
  } catch (error: any) {
    console.error("Error fetching task notifications:", error);
    res.status(500).json({ error: error.message || "Failed to fetch task notifications" });
  }
});

router.get("/task-notifications/unread-count", requireAuth, async (req, res) => {
  try {
    const userId = (req.session as any).userId;
    const count = await storage.getUnreadTaskNotificationCount(userId);
    res.json({ count });
  } catch (error: any) {
    console.error("Error fetching unread task notification count:", error);
    res.status(500).json({ error: error.message || "Failed to fetch count" });
  }
});

router.post("/task-notifications/:id/read", requireAuth, async (req, res) => {
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
    console.error("Error marking notification read:", error);
    res.status(500).json({ error: error.message || "Failed to mark notification read" });
  }
});

router.post("/task-notifications/read-all", requireAuth, async (req, res) => {
  try {
    const userId = (req.session as any).userId;
    await storage.markAllTaskNotificationsRead(userId);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error marking all notifications read:", error);
    res.status(500).json({ error: error.message || "Failed to mark notifications read" });
  }
});

export const tasksRouter = router;
