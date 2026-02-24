import {
  Router, Request, Response,
  eq, and, desc,
  db,
  checklistInstances, checklistWorkOrders, checklistTemplates, users,
  requireAuth, requireRole,
  logger,
} from "./shared";
import { sql as dsql, isNull, isNotNull, or } from "drizzle-orm";
import { workOrderUpdates, workOrderFiles } from "@shared/schema";
import multer from "multer";
import { parseEmailFile, summarizeEmailBody } from "../../utils/email-parser";
import { validateUploads } from "../../middleware/file-validation";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const emailUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.get("/api/checklist/reports/summary", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company ID required" });

    const instances = await db.select()
      .from(checklistInstances)
      .where(eq(checklistInstances.companyId, companyId))
      .limit(1000);

    const summary = {
      total: instances.length,
      byStatus: {
        draft: instances.filter(i => i.status === "draft").length,
        in_progress: instances.filter(i => i.status === "in_progress").length,
        completed: instances.filter(i => i.status === "completed").length,
        signed_off: instances.filter(i => i.status === "signed_off").length,
        cancelled: instances.filter(i => i.status === "cancelled").length,
      },
      completedThisMonth: instances.filter(i => {
        if (!i.completedAt) return false;
        const now = new Date();
        const completedDate = new Date(i.completedAt);
        return completedDate.getMonth() === now.getMonth() && completedDate.getFullYear() === now.getFullYear();
      }).length,
    };
    res.json(summary);
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to fetch report summary");
    res.status(500).json({ error: "Failed to fetch report summary" });
  }
});

router.get("/api/checklist/instances/:instanceId/work-orders", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const instanceId = String(req.params.instanceId);
    if (!companyId) return res.status(400).json({ error: "Company ID required" });

    const safeLimit = Math.min(parseInt(req.query.limit as string) || 500, 500);
    const orders = await db.select().from(checklistWorkOrders)
      .where(and(eq(checklistWorkOrders.checklistInstanceId, instanceId), eq(checklistWorkOrders.companyId, companyId!)))
      .orderBy(desc(checklistWorkOrders.createdAt))
      .limit(safeLimit);
    res.json(orders);
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to fetch work orders");
    res.status(500).json({ error: "Failed to fetch work orders" });
  }
});

router.get("/api/checklist/work-orders/stats", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company ID required" });

    const orders = await db.select({
      status: checklistWorkOrders.status,
      priority: checklistWorkOrders.priority,
      assignedTo: checklistWorkOrders.assignedTo,
      workOrderType: checklistWorkOrders.workOrderType,
    }).from(checklistWorkOrders)
      .where(eq(checklistWorkOrders.companyId, companyId))
      .limit(5000);

    const stats = {
      total: orders.length,
      open: orders.filter(o => o.status === "open").length,
      inProgress: orders.filter(o => o.status === "in_progress").length,
      resolved: orders.filter(o => o.status === "resolved").length,
      closed: orders.filter(o => o.status === "closed").length,
      cancelled: orders.filter(o => o.status === "cancelled").length,
      critical: orders.filter(o => o.priority === "critical").length,
      high: orders.filter(o => o.priority === "high").length,
      unassigned: orders.filter(o => !o.assignedTo).length,
      assigned: orders.filter(o => !!o.assignedTo).length,
      byType: {} as Record<string, number>,
    };

    for (const o of orders) {
      const t = o.workOrderType || "general";
      stats.byType[t] = (stats.byType[t] || 0) + 1;
    }

    res.json(stats);
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to fetch work order stats");
    res.status(500).json({ error: "Failed to fetch work order stats" });
  }
});

router.get("/api/checklist/work-orders", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company ID required" });

    const safeLimit = Math.min(parseInt(req.query.limit as string) || 500, 500);
    const tab = req.query.tab as string;
    const typeFilter = req.query.type as string;
    const statusFilter = req.query.status as string;

    const conditions = [eq(checklistWorkOrders.companyId, companyId!)];

    if (tab === "unassigned") {
      conditions.push(isNull(checklistWorkOrders.assignedTo));
    } else if (tab === "assigned") {
      conditions.push(isNotNull(checklistWorkOrders.assignedTo));
    } else if (tab === "mine") {
      conditions.push(eq(checklistWorkOrders.assignedTo, req.session.userId!));
    }

    if (typeFilter && typeFilter !== "all") {
      if (typeFilter === "general") {
        conditions.push(or(eq(checklistWorkOrders.workOrderType, "general" as any), isNull(checklistWorkOrders.workOrderType))!);
      } else {
        conditions.push(eq(checklistWorkOrders.workOrderType, typeFilter as any));
      }
    }

    if (statusFilter && statusFilter !== "all") {
      conditions.push(eq(checklistWorkOrders.status, statusFilter as any));
    }

    const orders = await db.select({
      id: checklistWorkOrders.id,
      companyId: checklistWorkOrders.companyId,
      checklistInstanceId: checklistWorkOrders.checklistInstanceId,
      fieldId: checklistWorkOrders.fieldId,
      fieldName: checklistWorkOrders.fieldName,
      sectionName: checklistWorkOrders.sectionName,
      triggerValue: checklistWorkOrders.triggerValue,
      result: checklistWorkOrders.result,
      details: checklistWorkOrders.details,
      photos: checklistWorkOrders.photos,
      status: checklistWorkOrders.status,
      priority: checklistWorkOrders.priority,
      workOrderType: checklistWorkOrders.workOrderType,
      assignedTo: checklistWorkOrders.assignedTo,
      supplierId: checklistWorkOrders.supplierId,
      supplierName: checklistWorkOrders.supplierName,
      dueDate: checklistWorkOrders.dueDate,
      resolvedBy: checklistWorkOrders.resolvedBy,
      resolvedAt: checklistWorkOrders.resolvedAt,
      resolutionNotes: checklistWorkOrders.resolutionNotes,
      createdAt: checklistWorkOrders.createdAt,
      updatedAt: checklistWorkOrders.updatedAt,
      templateName: checklistTemplates.name,
      instanceNumber: checklistInstances.instanceNumber,
      instanceStatus: checklistInstances.status,
      assignedUserName: users.name,
      assignedUserEmail: users.email,
    })
      .from(checklistWorkOrders)
      .leftJoin(checklistInstances, eq(checklistWorkOrders.checklistInstanceId, checklistInstances.id))
      .leftJoin(checklistTemplates, eq(checklistInstances.templateId, checklistTemplates.id))
      .leftJoin(users, eq(checklistWorkOrders.assignedTo, users.id))
      .where(and(...conditions))
      .orderBy(desc(checklistWorkOrders.createdAt))
      .limit(safeLimit);

    res.json(orders);
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to fetch all work orders");
    res.status(500).json({ error: "Failed to fetch work orders" });
  }
});

router.get("/api/checklist/work-orders/:id/checklist-detail", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const workOrderId = String(req.params.id);
    if (!companyId) return res.status(400).json({ error: "Company ID required" });

    const [workOrder] = await db.select()
      .from(checklistWorkOrders)
      .where(and(eq(checklistWorkOrders.id, workOrderId), eq(checklistWorkOrders.companyId, companyId!)))
      .limit(1);

    if (!workOrder) return res.status(404).json({ error: "Work order not found" });

    const [instance] = await db.select()
      .from(checklistInstances)
      .where(eq(checklistInstances.id, workOrder.checklistInstanceId))
      .limit(1);

    if (!instance) return res.json({ workOrder, instance: null, template: null });

    const [template] = await db.select()
      .from(checklistTemplates)
      .where(eq(checklistTemplates.id, instance.templateId))
      .limit(1);

    res.json({ workOrder, instance, template });
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to fetch checklist detail for work order");
    res.status(500).json({ error: "Failed to fetch checklist detail" });
  }
});

router.patch("/api/checklist/work-orders/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const workOrderId = String(req.params.id);
    const userId = req.session.userId;
    if (!companyId) return res.status(400).json({ error: "Company ID required" });

    const { status, resolutionNotes, priority, details, assignedTo, workOrderType, supplierId, supplierName, dueDate } = req.body;

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (resolutionNotes !== undefined) updateData.resolutionNotes = resolutionNotes;
    if (priority) updateData.priority = priority;
    if (details !== undefined) updateData.details = details;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo || null;
    if (workOrderType !== undefined) updateData.workOrderType = workOrderType;
    if (supplierId !== undefined) updateData.supplierId = supplierId || null;
    if (supplierName !== undefined) updateData.supplierName = supplierName || null;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

    if (status === "resolved" || status === "closed") {
      updateData.resolvedBy = userId;
      updateData.resolvedAt = new Date();
    }

    const [updated] = await db.update(checklistWorkOrders)
      .set(updateData)
      .where(and(eq(checklistWorkOrders.id, workOrderId), eq(checklistWorkOrders.companyId, companyId!)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Work order not found" });
    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to update work order");
    res.status(500).json({ error: "Failed to update work order" });
  }
});

// ==================== WORK ORDER UPDATES ====================

router.get("/api/checklist/work-orders/:id/updates", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const workOrderId = String(req.params.id);
    if (!companyId) return res.status(400).json({ error: "Company ID required" });

    const [wo] = await db.select({ id: checklistWorkOrders.id })
      .from(checklistWorkOrders)
      .where(and(eq(checklistWorkOrders.id, workOrderId), eq(checklistWorkOrders.companyId, companyId!)))
      .limit(1);
    if (!wo) return res.status(404).json({ error: "Work order not found" });

    const updates = await db.select({
      id: workOrderUpdates.id,
      workOrderId: workOrderUpdates.workOrderId,
      userId: workOrderUpdates.userId,
      content: workOrderUpdates.content,
      contentType: workOrderUpdates.contentType,
      emailSubject: workOrderUpdates.emailSubject,
      emailFrom: workOrderUpdates.emailFrom,
      emailTo: workOrderUpdates.emailTo,
      emailDate: workOrderUpdates.emailDate,
      emailBody: workOrderUpdates.emailBody,
      createdAt: workOrderUpdates.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
      .from(workOrderUpdates)
      .leftJoin(users, eq(workOrderUpdates.userId, users.id))
      .where(eq(workOrderUpdates.workOrderId, workOrderId))
      .orderBy(desc(workOrderUpdates.createdAt))
      .limit(200);

    const mapped = updates.map(u => ({
      id: u.id,
      content: u.content,
      contentType: u.contentType,
      emailSubject: u.emailSubject,
      emailFrom: u.emailFrom,
      emailTo: u.emailTo,
      emailDate: u.emailDate,
      emailBody: u.emailBody,
      createdAt: u.createdAt,
      user: { id: u.userId || "", name: u.userName, email: u.userEmail || "" },
    }));

    res.json(mapped);
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to fetch work order updates");
    res.status(500).json({ error: "Failed to fetch updates" });
  }
});

router.post("/api/checklist/work-orders/:id/updates", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const userId = req.session.userId;
    const workOrderId = String(req.params.id);
    if (!companyId || !userId) return res.status(401).json({ error: "Unauthorized" });

    const [wo] = await db.select({ id: checklistWorkOrders.id })
      .from(checklistWorkOrders)
      .where(and(eq(checklistWorkOrders.id, workOrderId), eq(checklistWorkOrders.companyId, companyId!)))
      .limit(1);
    if (!wo) return res.status(404).json({ error: "Work order not found" });

    const { content } = req.body;
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return res.status(400).json({ error: "Content is required" });
    }

    const [created] = await db.insert(workOrderUpdates).values({
      workOrderId,
      companyId: companyId!,
      userId,
      content: content.trim(),
      contentType: "text",
    }).returning();

    const [user] = await db.select({ name: users.name, email: users.email })
      .from(users).where(eq(users.id, userId)).limit(1);

    res.status(201).json({
      ...created,
      user: { id: userId, name: user?.name, email: user?.email || "" },
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to create work order update");
    res.status(500).json({ error: "Failed to create update" });
  }
});

router.delete("/api/work-order-updates/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const updateId = String(req.params.id);
    if (!companyId) return res.status(400).json({ error: "Company ID required" });

    const [update] = await db.select().from(workOrderUpdates)
      .where(and(eq(workOrderUpdates.id, updateId), eq(workOrderUpdates.companyId, companyId!)))
      .limit(1);
    if (!update) return res.status(404).json({ error: "Update not found" });

    await db.delete(workOrderUpdates).where(eq(workOrderUpdates.id, updateId));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to delete work order update");
    res.status(500).json({ error: "Failed to delete update" });
  }
});

router.post("/api/checklist/work-orders/:id/email-drop", requireAuth, emailUpload.single("file"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const userId = req.session.userId;
    const workOrderId = String(req.params.id);
    if (!companyId || !userId) return res.status(401).json({ error: "Unauthorized" });

    const [wo] = await db.select({ id: checklistWorkOrders.id })
      .from(checklistWorkOrders)
      .where(and(eq(checklistWorkOrders.id, workOrderId), eq(checklistWorkOrders.companyId, companyId!)))
      .limit(1);
    if (!wo) return res.status(404).json({ error: "Work order not found" });

    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const parsed = await parseEmailFile(file.buffer, file.originalname || "email");
    const summary = await summarizeEmailBody(parsed.body, 80);

    const [created] = await db.insert(workOrderUpdates).values({
      workOrderId,
      companyId: companyId!,
      userId,
      content: summary,
      contentType: "email",
      emailSubject: parsed.subject,
      emailFrom: parsed.from,
      emailTo: parsed.to,
      emailDate: parsed.date ? new Date(parsed.date) : null,
      emailBody: parsed.body,
    }).returning();

    const [user] = await db.select({ name: users.name, email: users.email })
      .from(users).where(eq(users.id, userId)).limit(1);

    res.status(201).json({
      ...created,
      user: { id: userId, name: user?.name, email: user?.email || "" },
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to process work order email drop");
    res.status(500).json({ error: "Failed to process email" });
  }
});

// ==================== WORK ORDER FILES ====================

router.get("/api/checklist/work-orders/:id/files", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const workOrderId = String(req.params.id);
    if (!companyId) return res.status(400).json({ error: "Company ID required" });

    const [wo] = await db.select({ id: checklistWorkOrders.id })
      .from(checklistWorkOrders)
      .where(and(eq(checklistWorkOrders.id, workOrderId), eq(checklistWorkOrders.companyId, companyId!)))
      .limit(1);
    if (!wo) return res.status(404).json({ error: "Work order not found" });

    const files = await db.select({
      id: workOrderFiles.id,
      workOrderId: workOrderFiles.workOrderId,
      userId: workOrderFiles.userId,
      updateId: workOrderFiles.updateId,
      fileName: workOrderFiles.fileName,
      fileSize: workOrderFiles.fileSize,
      mimeType: workOrderFiles.mimeType,
      filePath: workOrderFiles.filePath,
      createdAt: workOrderFiles.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
      .from(workOrderFiles)
      .leftJoin(users, eq(workOrderFiles.userId, users.id))
      .where(eq(workOrderFiles.workOrderId, workOrderId))
      .orderBy(desc(workOrderFiles.createdAt))
      .limit(200);

    const mapped = files.map(f => ({
      id: f.id,
      fileName: f.fileName,
      fileSize: f.fileSize,
      mimeType: f.mimeType,
      fileUrl: f.filePath,
      updateId: f.updateId,
      createdAt: f.createdAt,
      user: { id: f.userId || "", name: f.userName, email: f.userEmail || "" },
    }));

    res.json(mapped);
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to fetch work order files");
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

router.post("/api/checklist/work-orders/:id/files", requireAuth, upload.single("file"), validateUploads(), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const userId = req.session.userId;
    const workOrderId = String(req.params.id);
    if (!companyId || !userId) return res.status(401).json({ error: "Unauthorized" });

    const [wo] = await db.select({ id: checklistWorkOrders.id })
      .from(checklistWorkOrders)
      .where(and(eq(checklistWorkOrders.id, workOrderId), eq(checklistWorkOrders.companyId, companyId!)))
      .limit(1);
    if (!wo) return res.status(404).json({ error: "Work order not found" });

    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const base64 = file.buffer.toString("base64");
    const dataUrl = `data:${file.mimetype};base64,${base64}`;
    const updateId = req.body.updateId || null;

    const [created] = await db.insert(workOrderFiles).values({
      workOrderId,
      companyId: companyId!,
      userId,
      updateId,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      filePath: dataUrl,
    }).returning();

    const [user] = await db.select({ name: users.name, email: users.email })
      .from(users).where(eq(users.id, userId)).limit(1);

    res.status(201).json({
      id: created.id,
      fileName: created.fileName,
      fileSize: created.fileSize,
      mimeType: created.mimeType,
      fileUrl: created.filePath,
      updateId: created.updateId,
      createdAt: created.createdAt,
      user: { id: userId, name: user?.name, email: user?.email || "" },
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to upload work order file");
    res.status(500).json({ error: "Failed to upload file" });
  }
});

router.delete("/api/work-order-files/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const fileId = String(req.params.id);
    if (!companyId) return res.status(400).json({ error: "Company ID required" });

    const [file] = await db.select().from(workOrderFiles)
      .where(and(eq(workOrderFiles.id, fileId), eq(workOrderFiles.companyId, companyId!)))
      .limit(1);
    if (!file) return res.status(404).json({ error: "File not found" });

    await db.delete(workOrderFiles).where(eq(workOrderFiles.id, fileId));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to delete work order file");
    res.status(500).json({ error: "Failed to delete file" });
  }
});

export default router;
