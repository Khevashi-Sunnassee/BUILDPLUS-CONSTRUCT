import { Router } from "express";
import { storage } from "../../storage";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { validateUploads } from "../../middleware/file-validation";
import { parseEmailFile, summarizeEmailBody } from "../../utils/email-parser";
import { sendSuccess, sendCreated, sendBadRequest, sendUnauthorized, sendForbidden, sendNotFound, sendServerError } from "../../lib/api-response";
import { isAdminOrManager, canAccessTask, upload, emailUpload, taskUpdateSchema } from "./shared";

const router = Router();

router.get("/api/tasks/:id/updates", requireAuth, requirePermission("tasks"), async (req, res) => {
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
    const updates = await storage.getTaskUpdates(String(req.params.id));
    sendSuccess(res, updates);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching task updates");
    sendServerError(res, "An internal error occurred");
  }
});

router.post("/api/tasks/:id/updates", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return sendBadRequest(res, "Company context required");
    const parsed = taskUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendBadRequest(res, "Validation failed");
    }
    const userId = req.session.userId;
    if (!userId) return sendUnauthorized(res);
    const taskId = String(req.params.id);
    
    const task = await storage.getTask(taskId);
    if (!task) return sendNotFound(res, "Task not found");
    if (task.groupId) {
      const group = await storage.getTaskGroup(task.groupId);
      if (!group || group.companyId !== companyId) return sendNotFound(res, "Task not found");
    }
    const adminManager = await isAdminOrManager(req);
    if (!adminManager && userId && !canAccessTask(task, userId)) {
      return sendForbidden(res);
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
    
    sendCreated(res, update);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating task update");
    sendServerError(res, "An internal error occurred");
  }
});

/**
 * Email-drop endpoint: accepts an uploaded .eml file, parses it via parseEmailFile
 * to extract subject/from/to/date/body, then creates a task update of type "email"
 * with a summarized body (≤80 chars). This allows users to attach email threads
 * as task context without manual copy-paste. Notifies all task assignees.
 */
router.post("/api/tasks/:id/email-drop", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), emailUpload.single("file"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return sendBadRequest(res, "Company context required");
    const userId = req.session?.userId;
    if (!userId) return sendUnauthorized(res);
    const taskId = String(req.params.id);

    const task = await storage.getTask(taskId);
    if (!task) return sendNotFound(res, "Task not found");
    if (task.groupId) {
      const group = await storage.getTaskGroup(task.groupId);
      if (!group || group.companyId !== companyId) return sendNotFound(res, "Task not found");
    }
    const adminManager = await isAdminOrManager(req as any);
    if (!adminManager && !canAccessTask(task, userId)) {
      return sendForbidden(res);
    }

    const file = (req as any).file;
    if (!file) return sendBadRequest(res, "No file uploaded");

    const parsed = await parseEmailFile(file.buffer, file.originalname || "email");
    const summary = await summarizeEmailBody(parsed.body, 80);

    const update = await storage.createTaskUpdate({
      taskId,
      userId,
      content: summary,
      contentType: "email",
      emailSubject: parsed.subject,
      emailFrom: parsed.from,
      emailTo: parsed.to,
      emailDate: parsed.date,
      emailBody: parsed.body,
    });

    const fromUser = await storage.getUser(userId);
    const fromName = fromUser?.name || fromUser?.email || "Someone";
    await storage.createTaskNotificationsForAssignees(
      taskId,
      userId,
      "COMMENT",
      `Email dropped on "${task.title || "Task"}"`,
      `${fromName} shared: ${parsed.subject}`,
      update.id
    );

    sendCreated(res, update);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error processing email drop");
    sendServerError(res, "An internal error occurred");
  }
});

router.delete("/api/task-updates/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const update = await storage.getTaskUpdate(String(req.params.id));
    if (!update) return sendNotFound(res, "Update not found");
    const task = await storage.getTask(update.taskId);
    if (!task) return sendNotFound(res, "Update not found");
    if (task.groupId) {
      const group = await storage.getTaskGroup(task.groupId);
      if (!group || group.companyId !== companyId) return sendNotFound(res, "Update not found");
    }
    await storage.deleteTaskUpdate(String(req.params.id));
    sendSuccess(res, { success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting task update");
    sendServerError(res, "An internal error occurred");
  }
});

router.get("/api/tasks/:id/files", requireAuth, requirePermission("tasks"), async (req, res) => {
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
    const files = await storage.getTaskFiles(String(req.params.id));
    sendSuccess(res, files);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching task files");
    sendServerError(res, "An internal error occurred");
  }
});

/**
 * Task file upload: validates the file via multer + validateUploads middleware,
 * then stores it as a base64 data URL in the database. Files can optionally be
 * linked to a specific task update via updateId for threaded attachments.
 * Access is restricted to task assignees, watchers, or admin/manager roles.
 */
router.post("/api/tasks/:id/files", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), upload.single("file"), validateUploads(), async (req, res) => {
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
    const userId = req.session.userId;
    const file = req.file;
    if (!file) {
      return sendBadRequest(res, "No file uploaded");
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
    sendCreated(res, taskFile);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error uploading task file");
    sendServerError(res, "An internal error occurred");
  }
});

router.delete("/api/task-files/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const file = await storage.getTaskFile(String(req.params.id));
    if (!file) return sendNotFound(res, "File not found");
    const task = await storage.getTask(file.taskId);
    if (!task) return sendNotFound(res, "File not found");
    if (task.groupId) {
      const group = await storage.getTaskGroup(task.groupId);
      if (!group || group.companyId !== companyId) return sendNotFound(res, "File not found");
    }
    await storage.deleteTaskFile(String(req.params.id));
    sendSuccess(res, { success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting task file");
    sendServerError(res, "An internal error occurred");
  }
});

export default router;
