import { Router } from "express";
import multer from "multer";
import { storage } from "../storage";
import { requireAuth } from "./middleware/auth.middleware";
import logger from "../lib/logger";

const router = Router();

const ALLOWED_PO_ATTACHMENT_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
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

router.get("/api/purchase-orders", requireAuth, async (req, res) => {
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
    res.json(orders);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching purchase orders");
    res.status(500).json({ error: error.message || "Failed to fetch purchase orders" });
  }
});

router.get("/api/purchase-orders/my", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const orders = await storage.getPurchaseOrdersByUser(userId);
    res.json(orders);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching my purchase orders");
    res.status(500).json({ error: error.message || "Failed to fetch purchase orders" });
  }
});

router.get("/api/purchase-orders/next-number", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const poNumber = await storage.getNextPONumber(companyId);
    res.json({ poNumber });
  } catch (error: any) {
    logger.error({ err: error }, "Error getting next PO number");
    res.status(500).json({ error: error.message || "Failed to get next PO number" });
  }
});

router.get("/api/purchase-orders/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const order = await storage.getPurchaseOrder(String(req.params.id));
    if (!order || order.companyId !== companyId) return res.status(404).json({ error: "Purchase order not found" });
    res.json(order);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching purchase order");
    res.status(500).json({ error: error.message || "Failed to fetch purchase order" });
  }
});

router.post("/api/purchase-orders", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const userId = req.session.userId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { items: lineItems, ...poData } = req.body;
    const poNumber = await storage.getNextPONumber(companyId);
    if (poData.supplierId === "") {
      poData.supplierId = null;
    }
    const order = await storage.createPurchaseOrder(
      { ...poData, poNumber, companyId, requestedById: userId },
      lineItems || []
    );
    res.json(order);
  } catch (error: any) {
    logger.error({ err: error }, "Error creating purchase order");
    res.status(500).json({ error: error.message || "Failed to create purchase order" });
  }
});

router.patch("/api/purchase-orders/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const order = await storage.getPurchaseOrder(String(req.params.id));
    if (!order || order.companyId !== companyId) return res.status(404).json({ error: "Purchase order not found" });
    
    const userId = req.session.userId;
    if (order.requestedById !== userId && order.status !== "DRAFT") {
      return res.status(403).json({ error: "Cannot edit this purchase order" });
    }
    
    const { items: lineItems, ...poData } = req.body;
    if (poData.supplierId === "") {
      poData.supplierId = null;
    }
    const updated = await storage.updatePurchaseOrder(String(req.params.id), poData, lineItems);
    res.json(updated);
  } catch (error: any) {
    logger.error({ err: error }, "Error updating purchase order");
    res.status(500).json({ error: error.message || "Failed to update purchase order" });
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
  } catch (error: any) {
    logger.error({ err: error }, "Error submitting purchase order");
    res.status(500).json({ error: error.message || "Failed to submit purchase order" });
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

    const approved = await storage.approvePurchaseOrder(String(req.params.id), userId);
    res.json(approved);
  } catch (error: any) {
    logger.error({ err: error }, "Error approving purchase order");
    res.status(500).json({ error: error.message || "Failed to approve purchase order" });
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

    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const rejected = await storage.rejectPurchaseOrder(String(req.params.id), userId, reason);
    res.json(rejected);
  } catch (error: any) {
    logger.error({ err: error }, "Error rejecting purchase order");
    res.status(500).json({ error: error.message || "Failed to reject purchase order" });
  }
});

router.delete("/api/purchase-orders/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const order = await storage.getPurchaseOrder(String(req.params.id));
    if (!order || order.companyId !== companyId) return res.status(404).json({ error: "Purchase order not found" });
    
    const userId = req.session.userId;
    const user = userId ? await storage.getUser(userId) : null;
    
    if (order.requestedById !== userId && user?.role !== "ADMIN") {
      return res.status(403).json({ error: "Cannot delete this purchase order" });
    }
    
    if (order.status !== "DRAFT" && user?.role !== "ADMIN") {
      return res.status(400).json({ error: "Only draft POs can be deleted" });
    }

    await storage.deletePurchaseOrder(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error deleting purchase order");
    res.status(500).json({ error: error.message || "Failed to delete purchase order" });
  }
});

router.get("/api/purchase-orders/:id/attachments", requireAuth, async (req, res) => {
  try {
    const attachments = await storage.getPurchaseOrderAttachments(String(req.params.id));
    res.json(attachments);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching PO attachments");
    res.status(500).json({ error: error.message || "Failed to fetch attachments" });
  }
});

router.post("/api/purchase-orders/:id/attachments", requireAuth, upload.array("files", 10), async (req, res) => {
  try {
    const userId = (req.session as any).userId;
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
        uploadedById: userId,
      });
      attachments.push(attachment);
    }

    res.status(201).json(attachments);
  } catch (error: any) {
    logger.error({ err: error }, "Error uploading PO attachments");
    res.status(500).json({ error: error.message || "Failed to upload attachments" });
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
  } catch (error: any) {
    logger.error({ err: error }, "Error downloading attachment");
    res.status(500).json({ error: error.message || "Failed to download attachment" });
  }
});

router.delete("/api/po-attachments/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req.session as any).userId;
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
  } catch (error: any) {
    logger.error({ err: error }, "Error deleting attachment");
    res.status(500).json({ error: error.message || "Failed to delete attachment" });
  }
});

export const procurementOrdersRouter = router;
