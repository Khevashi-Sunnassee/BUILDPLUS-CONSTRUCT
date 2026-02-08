import { Router } from "express";
import { storage } from "../storage";
import { requireAuth } from "./middleware/auth.middleware";
import { broadcastService } from "../services/broadcast.service";
import { insertBroadcastTemplateSchema, insertBroadcastMessageSchema } from "@shared/schema";
import logger from "../lib/logger";

const router = Router();

router.get("/api/broadcast-templates", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId;
    if (!companyId) return res.status(400).json({ error: "No company context" });
    const templates = await storage.getBroadcastTemplates(companyId);
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/broadcast-templates/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const template = await storage.getBroadcastTemplate(id);
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json(template);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/broadcast-templates", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId;
    if (!companyId) return res.status(400).json({ error: "No company context" });
    const data = insertBroadcastTemplateSchema.parse({
      ...req.body,
      companyId,
      createdBy: req.session.userId,
    });
    const template = await storage.createBroadcastTemplate(data);
    res.status(201).json(template);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/api/broadcast-templates/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const companyId = req.session.companyId;
    const existing = await storage.getBroadcastTemplate(id);
    if (!existing || existing.companyId !== companyId) {
      return res.status(404).json({ error: "Template not found" });
    }
    const parsed = insertBroadcastTemplateSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

    const template = await storage.updateBroadcastTemplate(id, parsed.data);
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json(template);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/api/broadcast-templates/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId;
    const existing = await storage.getBroadcastTemplate(String(req.params.id));
    if (!existing || existing.companyId !== companyId) {
      return res.status(404).json({ error: "Template not found" });
    }
    await storage.deleteBroadcastTemplate(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/broadcasts", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId;
    if (!companyId) return res.status(400).json({ error: "No company context" });
    const messages = await storage.getBroadcastMessages(companyId);
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/broadcasts/channels-status", requireAuth, async (_req, res) => {
  try {
    const status = broadcastService.getChannelStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/broadcasts/:id", requireAuth, async (req, res) => {
  try {
    const message = await storage.getBroadcastMessage(String(req.params.id));
    if (!message) return res.status(404).json({ error: "Broadcast not found" });
    res.json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/broadcasts/:id/deliveries", requireAuth, async (req, res) => {
  try {
    const deliveries = await storage.getBroadcastDeliveries(String(req.params.id));
    res.json(deliveries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/broadcasts/deliveries/:deliveryId/resend", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId;
    if (!companyId) return res.status(400).json({ error: "No company context" });
    const deliveryId = req.params.deliveryId as string;
    const result = await broadcastService.resendDelivery(deliveryId, companyId);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/broadcasts/send", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(400).json({ error: "No session context" });

    const { subject, message, channels, recipientType, recipientIds, customRecipients, templateId } = req.body;

    if (!message || !channels || !recipientType) {
      return res.status(400).json({ error: "Message, channels, and recipientType are required" });
    }

    const broadcastMessage = await storage.createBroadcastMessage({
      companyId,
      templateId: templateId || null,
      subject: subject || null,
      message,
      channels,
      recipientType,
      recipientIds: recipientIds || null,
      customRecipients: customRecipients || null,
      totalRecipients: 0,
      sentCount: 0,
      failedCount: 0,
      status: "PENDING",
      sentBy: userId,
    });

    broadcastService.sendBroadcast(broadcastMessage.id).catch((err) => {
      logger.error({ err, broadcastId: broadcastMessage.id }, "Broadcast send error");
    });

    res.status(201).json(broadcastMessage);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export const broadcastRouter = router;
