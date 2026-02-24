import { Router } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { requireAuth } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { emailService } from "../../services/email.service";
import { buildBrandedEmail } from "../../lib/email-template";
import { sendSuccess, sendForbidden, sendNotFound, sendServerError } from "../../lib/api-response";

const router = Router();

router.get("/api/task-notifications", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const notifications = await storage.getTaskNotifications(userId);
    sendSuccess(res, notifications);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching task notifications");
    sendServerError(res, "An internal error occurred");
  }
});

router.get("/api/task-notifications/unread-count", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const count = await storage.getUnreadTaskNotificationCount(userId);
    sendSuccess(res, { count });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching unread task notification count");
    sendServerError(res, "An internal error occurred");
  }
});

router.post("/api/task-notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const notification = await storage.getTaskNotificationById(String(req.params.id));
    if (!notification) {
      return sendNotFound(res, "Notification not found");
    }
    if (notification.userId !== userId) {
      return sendForbidden(res, "Not authorized to mark this notification");
    }
    await storage.markTaskNotificationRead(String(req.params.id));
    sendSuccess(res, { success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error marking notification read");
    sendServerError(res, "An internal error occurred");
  }
});

router.post("/api/task-notifications/read-all", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    await storage.markAllTaskNotificationsRead(userId);
    sendSuccess(res, { success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error marking all notifications read");
    sendServerError(res, "An internal error occurred");
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
      return sendServerError(res, "Email service is not configured");
    }

    const currentUser = await storage.getUser(userId);
    const senderName = currentUser
      ? (currentUser.name || currentUser.email)
      : "A team member";

    const htmlBody = await buildBrandedEmail({
      title: "Task Notification",
      subtitle: `Sent by ${senderName}`,
      body: data.message.replace(/\n/g, "<br>"),
      footerNote: "If you have any questions, reply directly to this email.",
      companyId: req.session.companyId,
    });

    const result = await emailService.sendEmailWithAttachment({
      to: data.to,
      cc: data.cc,
      bcc: data.sendCopy && currentUser?.email ? currentUser.email : undefined,
      subject: data.subject,
      body: htmlBody,
    });

    if (!result.success) {
      return sendServerError(res, result.error);
    }

    sendSuccess(res, { success: true, messageId: result.messageId });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error sending tasks email");
    sendServerError(res, "An internal error occurred");
  }
});

export default router;
