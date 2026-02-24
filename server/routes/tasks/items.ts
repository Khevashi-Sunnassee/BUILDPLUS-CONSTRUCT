import { Router } from "express";
import { storage } from "../../storage";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { sendSuccess, sendCreated, sendBadRequest, sendForbidden, sendNotFound, sendServerError } from "../../lib/api-response";
import { isAdminOrManager, canAccessTask, taskCreateSchema, taskUpdateSchema_partial } from "./shared";

const router = Router();

router.get("/api/tasks/:id", requireAuth, requirePermission("tasks"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const task = await storage.getTask(String(req.params.id));
    if (!task) return sendNotFound(res, "Task not found");
    if (task.groupId) {
      const group = await storage.getTaskGroup(task.groupId);
      if (!group || group.companyId !== companyId) return sendNotFound(res, "Task not found");
    }
    const adminManager = await isAdminOrManager(req);
    if (!adminManager && req.session.userId && !canAccessTask(task, req.session.userId)) {
      return sendForbidden(res);
    }
    sendSuccess(res, task);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching task");
    sendServerError(res, "An internal error occurred");
  }
});

router.post("/api/tasks", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return sendBadRequest(res, "Company context required");
    
    const parsed = taskCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendBadRequest(res, "Validation failed");
    }
    
    const userId = req.session.userId;
    const taskData = { ...parsed.data } as Record<string, unknown>;
    
    const group = await storage.getTaskGroup(taskData.groupId);
    if (!group || group.companyId !== companyId) {
      return sendBadRequest(res, "Invalid task group");
    }
    
    if (group.jobId && !taskData.jobId) {
      taskData.jobId = group.jobId;
    }
    
    if (taskData.dueDate !== undefined) {
      taskData.dueDate = taskData.dueDate ? new Date(taskData.dueDate) : null;
    }
    if (taskData.reminderDate !== undefined) {
      taskData.reminderDate = taskData.reminderDate ? new Date(taskData.reminderDate) : null;
    }
    
    const [task, groupMembers] = await Promise.all([
      storage.createTask({
        ...taskData,
        createdById: userId,
      }),
      storage.getTaskGroupMembers(taskData.groupId),
    ]);
    const memberUserIds = groupMembers.map(m => m.userId);
    const assigneeIds = new Set<string>(memberUserIds);
    if (userId) {
      assigneeIds.add(userId);
    }
    if (assigneeIds.size > 0) {
      await storage.setTaskAssignees(task.id, Array.from(assigneeIds));
    }
    const taskWithDetails = await storage.getTask(task.id);
    sendCreated(res, taskWithDetails || task);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating task");
    sendServerError(res, "An internal error occurred");
  }
});

router.patch("/api/tasks/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    
    const parsed = taskUpdateSchema_partial.safeParse(req.body);
    if (!parsed.success) {
      return sendBadRequest(res, "Validation failed");
    }
    
    const existingTask = await storage.getTask(String(req.params.id));
    if (!existingTask) return sendNotFound(res, "Task not found");
    if (existingTask.groupId) {
      const group = await storage.getTaskGroup(existingTask.groupId);
      if (!group || group.companyId !== companyId) return sendNotFound(res, "Task not found");
    }
    const adminManager = await isAdminOrManager(req);
    if (!adminManager && req.session.userId && !canAccessTask(existingTask, req.session.userId)) {
      return sendForbidden(res);
    }
    const updateData = { ...parsed.data } as Record<string, unknown>;
    if (updateData.dueDate !== undefined) {
      updateData.dueDate = updateData.dueDate ? new Date(updateData.dueDate) : null;
    }
    if (updateData.reminderDate !== undefined) {
      updateData.reminderDate = updateData.reminderDate ? new Date(updateData.reminderDate) : null;
    }
    const task = await storage.updateTask(String(req.params.id), updateData);
    if (!task) return sendNotFound(res, "Task not found");
    sendSuccess(res, task);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating task");
    sendServerError(res, "An internal error occurred");
  }
});

router.delete("/api/tasks/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const existingTask = await storage.getTask(String(req.params.id));
    if (!existingTask) return sendNotFound(res, "Task not found");
    if (existingTask.groupId) {
      const group = await storage.getTaskGroup(existingTask.groupId);
      if (!group || group.companyId !== companyId) return sendNotFound(res, "Task not found");
    }
    const adminManager = await isAdminOrManager(req);
    if (!adminManager && req.session.userId && !canAccessTask(existingTask, req.session.userId)) {
      return sendForbidden(res);
    }
    await storage.deleteTask(String(req.params.id));
    sendSuccess(res, { success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting task");
    sendServerError(res, "An internal error occurred");
  }
});

router.post("/api/tasks/reorder", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const { groupId, taskIds } = req.body;
    if (!groupId || !Array.isArray(taskIds)) {
      return sendBadRequest(res, "groupId and taskIds array are required");
    }
    const group = await storage.getTaskGroup(groupId);
    if (!group || group.companyId !== companyId) {
      return sendNotFound(res, "Task group not found");
    }
    await storage.reorderTasks(groupId, taskIds);
    sendSuccess(res, { success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error reordering tasks");
    sendServerError(res, "An internal error occurred");
  }
});

router.post("/api/tasks/:id/move", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const { targetGroupId, targetIndex } = req.body;
    if (!targetGroupId) {
      return sendBadRequest(res, "targetGroupId is required");
    }
    const targetGroup = await storage.getTaskGroup(targetGroupId);
    if (!targetGroup || targetGroup.companyId !== companyId) {
      return sendNotFound(res, "Target group not found");
    }
    const existingTask = await storage.getTask(String(req.params.id));
    if (!existingTask) return sendNotFound(res, "Task not found");
    if (existingTask.groupId) {
      const group = await storage.getTaskGroup(existingTask.groupId);
      if (!group || group.companyId !== companyId) return sendNotFound(res, "Task not found");
    }
    const task = await storage.moveTaskToGroup(String(req.params.id), targetGroupId, targetIndex ?? 0);
    if (!task) {
      return sendNotFound(res, "Task not found");
    }
    sendSuccess(res, task);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error moving task");
    sendServerError(res, "An internal error occurred");
  }
});

router.get("/api/tasks/:id/assignees", requireAuth, requirePermission("tasks"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const task = await storage.getTask(String(req.params.id));
    if (!task) return sendNotFound(res, "Task not found");
    if (task.groupId) {
      const group = await storage.getTaskGroup(task.groupId);
      if (!group || group.companyId !== companyId) return sendNotFound(res, "Task not found");
    }
    const adminManager = await isAdminOrManager(req);
    if (!adminManager && req.session.userId && !canAccessTask(task, req.session.userId)) {
      return sendForbidden(res);
    }
    const assignees = await storage.getTaskAssignees(String(req.params.id));
    sendSuccess(res, assignees);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching task assignees");
    sendServerError(res, "An internal error occurred");
  }
});

router.put("/api/tasks/:id/assignees", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const task = await storage.getTask(String(req.params.id));
    if (!task) return sendNotFound(res, "Task not found");
    if (task.groupId) {
      const group = await storage.getTaskGroup(task.groupId);
      if (!group || group.companyId !== companyId) return sendNotFound(res, "Task not found");
    }
    const adminManager = await isAdminOrManager(req);
    if (!adminManager && req.session.userId && !canAccessTask(task, req.session.userId)) {
      return sendForbidden(res);
    }
    const { userIds } = req.body;
    if (!Array.isArray(userIds)) {
      return sendBadRequest(res, "userIds must be an array");
    }
    const assignees = await storage.setTaskAssignees(String(req.params.id), userIds);
    sendSuccess(res, assignees);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error setting task assignees");
    sendServerError(res, "An internal error occurred");
  }
});

export default router;
