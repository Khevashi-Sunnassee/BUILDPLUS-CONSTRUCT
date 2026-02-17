import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { storage } from "../storage";
import { requireAuth } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import logger from "../lib/logger";
import { twilioService } from "../services/twilio.service";
import { insertPurchaseOrderSchema, purchaseOrderItems, purchaseOrders, InsertPurchaseOrder, InsertPurchaseOrderItem } from "@shared/schema";
import { db } from "../db";
import { eq, and, inArray } from "drizzle-orm";

const router = Router();

const ALLOWED_PO_ATTACHMENT_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_PO_ATTACHMENT_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

const createPurchaseOrderSchema = z.object({
  items: z.array(z.object({}).passthrough()).optional(),
  supplierId: z.string().nullable().optional(),
  requiredByDate: z.string().nullable().optional(),
}).passthrough();

const rejectPurchaseOrderSchema = z.object({
  reason: z.string(),
});

const receivePurchaseOrderSchema = z.object({
  receivedItemIds: z.array(z.string()),
});

router.get("/api/purchase-orders", requireAuth, requirePermission("purchase_orders"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const status = req.query.status as string | undefined;
    let orders;
    if (status) {
      orders = await storage.getPurchaseOrdersByStatus(status, companyId);
    } else {
      orders = await storage.getAllPurchaseOrders(companyId);
    }
    const level = req.permissionLevel;
    if (level === "VIEW_OWN" || level === "VIEW_AND_UPDATE_OWN") {
      const userId = req.session.userId;
      orders = orders.filter((o) => o.requestedById === userId);
    }
    const safeLimit = Math.min(parseInt(req.query.limit as string) || 500, 500);
    res.json(orders.slice(0, safeLimit));
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching purchase orders");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch purchase orders" });
  }
});

router.get("/api/purchase-orders/my", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const orders = await storage.getPurchaseOrdersByUser(userId);
    res.json(orders);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching my purchase orders");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch purchase orders" });
  }
});

router.get("/api/purchase-orders/by-capex/:capexId", requireAuth, requirePermission("purchase_orders"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const allOrders = await storage.getAllPurchaseOrders(companyId);
    const capexOrders = allOrders.filter((o) => o.capexRequestId === req.params.capexId);
    res.json(capexOrders);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching purchase orders by CAPEX");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch purchase orders" });
  }
});

router.get("/api/purchase-orders/next-number", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const poNumber = await storage.getNextPONumber(companyId);
    res.json({ poNumber });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error getting next PO number");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get next PO number" });
  }
});

router.get("/api/purchase-orders/:id", requireAuth, requirePermission("purchase_orders"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const order = await storage.getPurchaseOrder(String(req.params.id));
    if (!order || order.companyId !== companyId) return res.status(404).json({ error: "Purchase order not found" });
    const level = req.permissionLevel;
    if ((level === "VIEW_OWN" || level === "VIEW_AND_UPDATE_OWN") && order.requestedById !== req.session.userId) {
      return res.status(403).json({ error: "You can only view your own purchase orders" });
    }
    res.json(order);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching purchase order");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch purchase order" });
  }
});

router.post("/api/purchase-orders", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const userId = req.session.userId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const result = createPurchaseOrderSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const { items: lineItems, ...poData } = result.data;
    const poNumber = await storage.getNextPONumber(companyId);
    if (poData.supplierId === "") {
      (poData as Record<string, unknown>).supplierId = null;
    }
    if (poData.requiredByDate && typeof poData.requiredByDate === "string") {
      (poData as Record<string, unknown>).requiredByDate = new Date(poData.requiredByDate);
    }
    const order = await storage.createPurchaseOrder(
      { ...poData, poNumber, companyId, requestedById: userId } as InsertPurchaseOrder,
      (lineItems || []) as Omit<InsertPurchaseOrderItem, "purchaseOrderId">[]
    );
    if (poData.capexRequestId) {
      try {
        const capex = await storage.getCapexRequest(poData.capexRequestId as string);
        if (capex && capex.companyId === companyId) {
          await storage.updateCapexRequest(poData.capexRequestId as string, { purchaseOrderId: order.id });
          const actor = await storage.getUser(userId);
          await storage.createCapexAuditEvent({
            capexRequestId: poData.capexRequestId as string,
            eventType: "po_linked",
            actorId: userId!,
            actorName: actor?.name || actor?.email || "",
            metadata: { purchaseOrderId: order.id, poNumber: order.poNumber },
          });
        }
      } catch (linkErr) {
        logger.warn({ err: linkErr }, "Failed to link PO to CAPEX request");
      }
    }
    res.json(order);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating purchase order");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create purchase order" });
  }
});

router.patch("/api/purchase-orders/:id", requireAuth, requirePermission("purchase_orders"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const order = await storage.getPurchaseOrder(String(req.params.id));
    if (!order || order.companyId !== companyId) return res.status(404).json({ error: "Purchase order not found" });
    
    const userId = req.session.userId;
    const level = req.permissionLevel;
    if (level === "VIEW" || level === "VIEW_OWN") {
      return res.status(403).json({ error: "You only have view access to purchase orders" });
    }
    if (level !== "VIEW_AND_UPDATE" && order.requestedById !== userId) {
      return res.status(403).json({ error: "You can only edit your own purchase orders" });
    }
    
    const result = createPurchaseOrderSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const { items: lineItems, ...poData } = result.data;
    const mutablePoData = poData as Record<string, unknown>;
    if (mutablePoData.requiredByDate && typeof mutablePoData.requiredByDate === "string") {
      mutablePoData.requiredByDate = new Date(mutablePoData.requiredByDate);
    }
    if (mutablePoData.supplierId === "") {
      mutablePoData.supplierId = null;
    }
    const updated = await storage.updatePurchaseOrder(String(req.params.id), mutablePoData as Partial<InsertPurchaseOrder>, lineItems as Omit<InsertPurchaseOrderItem, "purchaseOrderId">[] | undefined);
    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating purchase order");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update purchase order" });
  }
});

router.post("/api/purchase-orders/:id/submit", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const order = await storage.getPurchaseOrder(String(req.params.id));
    if (!order || order.companyId !== companyId) return res.status(404).json({ error: "Purchase order not found" });
    
    const userId = req.session.userId;
    if (order.requestedById !== userId) {
      return res.status(403).json({ error: "Only the requester can submit this PO" });
    }
    
    if (order.status !== "DRAFT") {
      return res.status(400).json({ error: "Only draft POs can be submitted" });
    }

    const submitted = await storage.submitPurchaseOrder(String(req.params.id));
    res.json(submitted);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error submitting purchase order");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to submit purchase order" });
  }
});

router.post("/api/purchase-orders/:id/approve", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const order = await storage.getPurchaseOrder(String(req.params.id));
    if (!order || order.companyId !== companyId) return res.status(404).json({ error: "Purchase order not found" });
    
    if (order.status !== "SUBMITTED") {
      return res.status(400).json({ error: "Only submitted POs can be approved" });
    }

    const userId = req.session.userId;
    const user = userId ? await storage.getUser(userId) : null;
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.poApprover && user.role !== "ADMIN") {
      return res.status(403).json({ error: "You are not authorized to approve purchase orders" });
    }

    if (user.role !== "ADMIN" && user.poApprovalLimit) {
      const orderTotal = parseFloat(order.total || "0");
      const limit = parseFloat(user.poApprovalLimit);
      if (orderTotal > limit) {
        return res.status(403).json({ 
          error: `PO total ($${orderTotal.toFixed(2)}) exceeds your approval limit ($${limit.toFixed(2)})` 
        });
      }
    }

    const approved = await storage.approvePurchaseOrder(String(req.params.id), userId!);

    try {
      const requestor = await storage.getUser(order.requestedById);
      if (requestor?.phone) {
        const supplierName = order.supplierName || "Unknown Supplier";
        const total = parseFloat(order.total || "0").toFixed(2);
        const appDomain = process.env.APP_URL
          || (process.env.REPLIT_DEPLOYMENT ? `https://${process.env.REPLIT_DEPLOYMENT}` : "")
          || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "");
        const poLink = appDomain ? `${appDomain}/purchase-orders/${order.id}` : "";
        const message = `Your Purchase Order ${order.poNumber} for ${supplierName} totalling $${total} has been approved. You can now print and send it to the supplier.${poLink ? `\n\nView & Print: ${poLink}` : ""}`;
        const smsResult = await twilioService.sendSMS(requestor.phone, message);
        if (!smsResult.success) {
          logger.warn({ error: smsResult.error, poId: order.id, userId: order.requestedById }, "Failed to send PO approval SMS");
        } else {
          logger.info({ poId: order.id, userId: order.requestedById }, "PO approval SMS sent");
        }
      } else {
        logger.info({ poId: order.id, userId: order.requestedById }, "No phone number for PO requestor, skipping SMS");
      }
    } catch (smsError) {
      logger.warn({ err: smsError, poId: order.id }, "Error sending PO approval SMS notification");
    }

    res.json(approved);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error approving purchase order");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to approve purchase order" });
  }
});

router.post("/api/purchase-orders/:id/reject", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const order = await storage.getPurchaseOrder(String(req.params.id));
    if (!order || order.companyId !== companyId) return res.status(404).json({ error: "Purchase order not found" });
    
    if (order.status !== "SUBMITTED") {
      return res.status(400).json({ error: "Only submitted POs can be rejected" });
    }

    const userId = req.session.userId;
    const user = userId ? await storage.getUser(userId) : null;
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.poApprover && user.role !== "ADMIN") {
      return res.status(403).json({ error: "You are not authorized to reject purchase orders" });
    }

    const rejectResult = rejectPurchaseOrderSchema.safeParse(req.body);
    if (!rejectResult.success) {
      return res.status(400).json({ error: rejectResult.error.format() });
    }
    const { reason } = rejectResult.data;
    if (!reason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const rejected = await storage.rejectPurchaseOrder(String(req.params.id), userId!, reason);
    res.json(rejected);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error rejecting purchase order");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to reject purchase order" });
  }
});

router.post("/api/purchase-orders/:id/receive", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const order = await storage.getPurchaseOrder(String(req.params.id));
    if (!order || order.companyId !== companyId) return res.status(404).json({ error: "Purchase order not found" });

    if (order.status !== "APPROVED" && order.status !== "RECEIVED_IN_PART") {
      return res.status(400).json({ error: "Only approved or partially received POs can have items received" });
    }

    const receiveResult = receivePurchaseOrderSchema.safeParse(req.body);
    if (!receiveResult.success) {
      return res.status(400).json({ error: receiveResult.error.format() });
    }
    const { receivedItemIds } = receiveResult.data;
    if (!Array.isArray(receivedItemIds)) {
      return res.status(400).json({ error: "receivedItemIds must be an array" });
    }

    const allItems = await db.select().from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, String(req.params.id)))
      .limit(1000);

    if (allItems.length === 0) {
      return res.status(400).json({ error: "No items found for this purchase order" });
    }

    const validIds = new Set(allItems.map(i => i.id));
    for (const id of receivedItemIds) {
      if (!validIds.has(id)) {
        return res.status(400).json({ error: `Item ${id} not found in this purchase order` });
      }
    }

    await db.transaction(async (tx) => {
      for (const item of allItems) {
        const shouldBeReceived = receivedItemIds.includes(item.id);
        if (item.received !== shouldBeReceived) {
          await tx.update(purchaseOrderItems)
            .set({ received: shouldBeReceived, updatedAt: new Date() })
            .where(eq(purchaseOrderItems.id, item.id));
        }
      }

      const receivedCount = receivedItemIds.length;
      const totalCount = allItems.length;
      let newStatus: string;
      if (receivedCount === 0) {
        newStatus = "APPROVED";
      } else if (receivedCount >= totalCount) {
        newStatus = "RECEIVED";
      } else {
        newStatus = "RECEIVED_IN_PART";
      }

      await tx.update(purchaseOrders)
        .set({ status: newStatus as typeof purchaseOrders.status.enumValues[number], updatedAt: new Date() })
        .where(eq(purchaseOrders.id, String(req.params.id)));
    });

    const updated = await storage.getPurchaseOrder(String(req.params.id));
    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error receiving purchase order items");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to receive items" });
  }
});

router.delete("/api/purchase-orders/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const order = await storage.getPurchaseOrder(String(req.params.id));
    if (!order || order.companyId !== companyId) return res.status(404).json({ error: "Purchase order not found" });
    
    const userId = req.session.userId;
    const user = userId ? await storage.getUser(userId) : null;
    
    if (order.status === "APPROVED") {
      return res.status(400).json({ error: "Approved purchase orders cannot be deleted" });
    }

    if (order.requestedById !== userId && user?.role !== "ADMIN") {
      return res.status(403).json({ error: "Cannot delete this purchase order" });
    }
    
    if (order.status !== "DRAFT" && order.status !== "REJECTED" && user?.role !== "ADMIN") {
      return res.status(400).json({ error: "Only draft or rejected POs can be deleted" });
    }

    await storage.deletePurchaseOrder(String(req.params.id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting purchase order");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete purchase order" });
  }
});

router.get("/api/purchase-orders/:id/attachments", requireAuth, async (req, res) => {
  try {
    const attachments = await storage.getPurchaseOrderAttachments(String(req.params.id));
    res.json(attachments);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching PO attachments");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch attachments" });
  }
});

router.post("/api/purchase-orders/:id/attachments", requireAuth, upload.array("files", 10), async (req, res) => {
  try {
    const userId = req.session.userId;
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const poId = String(req.params.id);
    const order = await storage.getPurchaseOrder(poId);
    if (!order) return res.status(404).json({ error: "Purchase order not found" });

    const fs = await import("fs/promises");
    const path = await import("path");
    const uploadsDir = path.join(process.cwd(), "uploads", "po-attachments");
    await fs.mkdir(uploadsDir, { recursive: true });

    const attachments = [];
    for (const file of files) {
      const timestamp = Date.now();
      const safeFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
      const fileName = `${poId}_${timestamp}_${safeFileName}`;
      const filePath = path.join(uploadsDir, fileName);
      
      await fs.writeFile(filePath, file.buffer);

      const attachment = await storage.createPurchaseOrderAttachment({
        purchaseOrderId: poId,
        fileName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        filePath,
        uploadedById: userId!,
      });
      attachments.push(attachment);
    }

    res.status(201).json(attachments);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error uploading PO attachments");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to upload attachments" });
  }
});

router.get("/api/po-attachments/:id/download", requireAuth, async (req, res) => {
  try {
    const attachment = await storage.getPurchaseOrderAttachment(String(req.params.id));
    if (!attachment) return res.status(404).json({ error: "Attachment not found" });

    const fs = await import("fs");
    if (!fs.existsSync(attachment.filePath)) {
      return res.status(404).json({ error: "File not found on server" });
    }

    res.setHeader("Content-Disposition", `attachment; filename="${attachment.originalName}"`);
    res.setHeader("Content-Type", attachment.mimeType);
    fs.createReadStream(attachment.filePath).pipe(res);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error downloading attachment");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to download attachment" });
  }
});

router.delete("/api/po-attachments/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const user = await storage.getUser(userId);
    const attachment = await storage.getPurchaseOrderAttachment(String(req.params.id));
    if (!attachment) return res.status(404).json({ error: "Attachment not found" });

    const order = await storage.getPurchaseOrder(attachment.purchaseOrderId);
    if (!order) return res.status(404).json({ error: "Purchase order not found" });

    if (attachment.uploadedById !== userId && order.requestedById !== userId && user?.role !== "ADMIN") {
      return res.status(403).json({ error: "Cannot delete this attachment" });
    }

    const fs = await import("fs/promises");
    try {
      await fs.unlink(attachment.filePath);
    } catch (e) {
      logger.warn({ err: e }, "Could not delete file from disk");
    }

    await storage.deletePurchaseOrderAttachment(String(req.params.id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting attachment");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete attachment" });
  }
});

export const procurementOrdersRouter = router;
