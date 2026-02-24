import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth } from "./middleware/auth.middleware";
import { broadcastService } from "../services/broadcast.service";
import { insertBroadcastTemplateSchema, insertBroadcastMessageSchema, customers, suppliers, employees } from "@shared/schema";
import { db } from "../db";
import { eq, and, or, isNotNull, ne } from "drizzle-orm";
import logger from "../lib/logger";

const router = Router();

router.get("/api/broadcast-templates", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId;
    if (!companyId) return res.status(400).json({ error: "No company context" });
    const templates = await storage.getBroadcastTemplates(companyId);
    res.json(templates);
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/broadcast-templates/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const template = await storage.getBroadcastTemplate(id);
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json(template);
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
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
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
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
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.delete("/api/broadcast-templates/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const companyId = req.session.companyId;
    const existing = await storage.getBroadcastTemplate(id);
    if (!existing || existing.companyId !== companyId) {
      return res.status(404).json({ error: "Template not found" });
    }
    await storage.deleteBroadcastTemplate(id);
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/broadcasts", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId;
    if (!companyId) return res.status(400).json({ error: "No company context" });
    const messages = await storage.getBroadcastMessages(companyId);
    res.json(messages);
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/broadcasts/channels-status", requireAuth, async (_req, res) => {
  try {
    const status = broadcastService.getChannelStatus();
    res.json(status);
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/broadcasts/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const message = await storage.getBroadcastMessage(id);
    if (!message) return res.status(404).json({ error: "Broadcast not found" });
    res.json(message);
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/broadcasts/:id/deliveries", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const deliveries = await storage.getBroadcastDeliveries(id);
    res.json(deliveries);
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
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
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/broadcasts/recipients", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId;
    if (!companyId) return res.status(400).json({ error: "No company context" });
    const companyIdStr = String(companyId);

    const [customerList, supplierList, employeeList] = await Promise.all([
      db.select({
        id: customers.id,
        name: customers.name,
        keyContact: customers.keyContact,
        email: customers.email,
        phone: customers.phone,
      })
        .from(customers)
        .where(
          and(
            eq(customers.companyId, companyIdStr),
            eq(customers.isActive, true),
            or(
              and(isNotNull(customers.email), ne(customers.email, "")),
              and(isNotNull(customers.phone), ne(customers.phone, ""))
            )
          )
        )
        .limit(5000),
      db.select({
        id: suppliers.id,
        name: suppliers.name,
        keyContact: suppliers.keyContact,
        email: suppliers.email,
        phone: suppliers.phone,
      })
        .from(suppliers)
        .where(
          and(
            eq(suppliers.companyId, companyIdStr),
            eq(suppliers.isActive, true),
            or(
              and(isNotNull(suppliers.email), ne(suppliers.email, "")),
              and(isNotNull(suppliers.phone), ne(suppliers.phone, ""))
            )
          )
        )
        .limit(5000),
      db.select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
        email: employees.email,
        phone: employees.phone,
      })
        .from(employees)
        .where(
          and(
            eq(employees.companyId, companyIdStr),
            eq(employees.isActive, true),
            or(
              and(isNotNull(employees.email), ne(employees.email, "")),
              and(isNotNull(employees.phone), ne(employees.phone, ""))
            )
          )
        )
        .limit(5000),
    ]);

    res.json({
      customers: customerList.map(c => ({
        id: c.id,
        name: c.keyContact ? `${c.name} (${c.keyContact})` : c.name,
        email: c.email || null,
        phone: c.phone || null,
        type: "customer" as const,
      })),
      suppliers: supplierList.map(s => ({
        id: s.id,
        name: s.keyContact ? `${s.name} (${s.keyContact})` : s.name,
        email: s.email || null,
        phone: s.phone || null,
        type: "supplier" as const,
      })),
      employees: employeeList.map(e => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        email: e.email || null,
        phone: e.phone || null,
        type: "employee" as const,
      })),
    });
  } catch (error: unknown) {
    logger.error({ error }, "Failed to fetch broadcast recipients");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

const validRecipientTypes = ["ALL_USERS", "SPECIFIC_USERS", "CUSTOM_CONTACTS", "SPECIFIC_CUSTOMERS", "SPECIFIC_SUPPLIERS", "SPECIFIC_EMPLOYEES"] as const;
const validChannels = ["EMAIL", "SMS", "WHATSAPP"] as const;

const sendBroadcastSchema = z.object({
  subject: z.string().optional().nullable(),
  message: z.string().min(1, "Message is required"),
  channels: z.array(z.string().min(1).transform(c => c.toUpperCase()).pipe(z.enum(validChannels))).min(1, "At least one channel is required"),
  recipientType: z.enum(validRecipientTypes),
  recipientIds: z.array(z.string()).optional().nullable(),
  customRecipients: z.array(z.object({
    name: z.string().optional(),
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
  })).optional().nullable(),
  templateId: z.string().optional().nullable(),
});

router.post("/api/broadcasts/send", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(400).json({ error: "No session context" });

    const parsed = sendBroadcastSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const { subject, message, channels, recipientType, recipientIds, customRecipients, templateId } = parsed.data;

    const adminOnlyTypes = ["SPECIFIC_CUSTOMERS", "SPECIFIC_SUPPLIERS", "SPECIFIC_EMPLOYEES"];
    if (adminOnlyTypes.includes(recipientType)) {
      const user = await storage.getUser(userId);
      if (!user || (user.role !== "ADMIN" && !user.isSuperAdmin)) {
        return res.status(403).json({ error: "Only administrators can broadcast to customers, suppliers, or employees" });
      }
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
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

export const broadcastRouter = router;
