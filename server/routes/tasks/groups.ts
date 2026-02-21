import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../../db";
import { jobs } from "@shared/schema";
import { storage } from "../../storage";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { sendSuccess, sendCreated, sendBadRequest, sendForbidden, sendNotFound, sendServerError } from "../../lib/api-response";
import { isAdminOrManager, canAccessTask, taskGroupSchema } from "./shared";

const router = Router();

router.get("/api/task-groups", requireAuth, requirePermission("tasks"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return sendBadRequest(res, "Company context required");
    const adminManager = await isAdminOrManager(req);
    const filterUserId = adminManager ? undefined : req.session.userId;
    const groups = await storage.getAllTaskGroups(companyId, filterUserId);
    sendSuccess(res, groups);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching task groups");
    sendServerError(res, error instanceof Error ? error.message : "Failed to fetch task groups");
  }
});

router.get("/api/task-groups/:id", requireAuth, requirePermission("tasks"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const group = await storage.getTaskGroup(String(req.params.id));
    if (!group || group.companyId !== companyId) return sendNotFound(res, "Task group not found");
    const adminManager = await isAdminOrManager(req);
    if (!adminManager && req.session.userId) {
      group.tasks = group.tasks.filter(task => canAccessTask(task, req.session.userId!));
    }
    sendSuccess(res, group);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching task group");
    sendServerError(res, error instanceof Error ? error.message : "Failed to fetch task group");
  }
});

router.post("/api/task-groups", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return sendBadRequest(res, "Company context required");
    const parsed = taskGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendBadRequest(res, "Validation failed");
    }

    if (parsed.data.jobId) {
      const [job] = await db.select({ id: jobs.id }).from(jobs)
        .where(and(eq(jobs.id, parsed.data.jobId), eq(jobs.companyId, companyId))).limit(1);
      if (!job) {
        return sendBadRequest(res, "Invalid job for this company");
      }
    }

    const userId = req.session.userId;
    const group = await storage.createTaskGroup({ ...parsed.data, companyId, createdById: userId });
    sendCreated(res, group);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating task group");
    sendServerError(res, error instanceof Error ? error.message : "Failed to create task group");
  }
});

router.patch("/api/task-groups/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const existing = await storage.getTaskGroup(String(req.params.id));
    if (!existing || existing.companyId !== companyId) return sendNotFound(res, "Task group not found");
    const parsed = taskGroupSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return sendBadRequest(res, "Validation failed");
    }

    if (parsed.data.jobId) {
      const [job] = await db.select({ id: jobs.id }).from(jobs)
        .where(and(eq(jobs.id, parsed.data.jobId), eq(jobs.companyId, companyId))).limit(1);
      if (!job) {
        return sendBadRequest(res, "Invalid job for this company");
      }
    }

    if (parsed.data.color) {
      const allGroups = await storage.getAllTaskGroups(companyId);
      const colorInUse = allGroups.some(
        g => g.id !== String(req.params.id) && g.color?.toLowerCase() === parsed.data.color!.toLowerCase()
      );
      if (colorInUse) {
        return sendBadRequest(res, "This color is already used by another group");
      }
    }

    const group = await storage.updateTaskGroup(String(req.params.id), parsed.data);
    if (!group) return sendNotFound(res, "Task group not found");
    sendSuccess(res, group);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating task group");
    sendServerError(res, error instanceof Error ? error.message : "Failed to update task group");
  }
});

router.delete("/api/task-groups/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const existing = await storage.getTaskGroup(String(req.params.id));
    if (!existing || existing.companyId !== companyId) return sendNotFound(res, "Task group not found");
    await storage.deleteTaskGroup(String(req.params.id));
    sendSuccess(res, { success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting task group");
    sendServerError(res, error instanceof Error ? error.message : "Failed to delete task group");
  }
});

router.get("/api/task-groups/:id/members", requireAuth, requirePermission("tasks"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const group = await storage.getTaskGroup(String(req.params.id));
    if (!group || group.companyId !== companyId) return sendNotFound(res, "Task group not found");
    const members = await storage.getTaskGroupMembers(String(req.params.id));
    sendSuccess(res, members);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching task group members");
    sendServerError(res, error instanceof Error ? error.message : "Failed to fetch task group members");
  }
});

router.put("/api/task-groups/:id/members", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const group = await storage.getTaskGroup(String(req.params.id));
    if (!group || group.companyId !== companyId) return sendNotFound(res, "Task group not found");
    const { userIds } = req.body;
    if (!Array.isArray(userIds)) {
      return sendBadRequest(res, "userIds must be an array");
    }
    const members = await storage.setTaskGroupMembers(String(req.params.id), userIds);
    sendSuccess(res, members);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error setting task group members");
    sendServerError(res, error instanceof Error ? error.message : "Failed to set task group members");
  }
});

router.post("/api/task-groups/reorder", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return sendBadRequest(res, "Company context required");
    const { groupIds } = req.body;
    if (!Array.isArray(groupIds)) {
      return sendBadRequest(res, "groupIds must be an array");
    }
    for (const gid of groupIds) {
      const group = await storage.getTaskGroup(gid);
      if (!group || group.companyId !== companyId) {
        return sendForbidden(res, "Invalid group IDs");
      }
    }
    await storage.reorderTaskGroups(groupIds);
    sendSuccess(res, { success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error reordering task groups");
    sendServerError(res, error instanceof Error ? error.message : "Failed to reorder task groups");
  }
});

export default router;
