import {
  Router, Request, Response,
  eq, and, desc,
  db,
  checklistInstances, checklistWorkOrders, checklistTemplates, users,
  requireAuth, requireRole,
  logger,
} from "./shared";
import { sql as dsql } from "drizzle-orm";

const router = Router();

router.get("/api/checklist/reports/summary", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

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

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const safeLimit = Math.min(parseInt(req.query.limit as string) || 500, 500);
    const orders = await db.select().from(checklistWorkOrders)
      .where(and(
        eq(checklistWorkOrders.checklistInstanceId, instanceId),
        eq(checklistWorkOrders.companyId, companyId!)
      ))
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
    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const orders = await db.select({
      status: checklistWorkOrders.status,
      priority: checklistWorkOrders.priority,
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
    };

    res.json(stats);
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to fetch work order stats");
    res.status(500).json({ error: "Failed to fetch work order stats" });
  }
});

router.get("/api/checklist/work-orders", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const safeLimit = Math.min(parseInt(req.query.limit as string) || 500, 500);

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
      assignedTo: checklistWorkOrders.assignedTo,
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
      .where(eq(checklistWorkOrders.companyId, companyId!))
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

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const [workOrder] = await db.select()
      .from(checklistWorkOrders)
      .where(and(
        eq(checklistWorkOrders.id, workOrderId),
        eq(checklistWorkOrders.companyId, companyId!)
      ))
      .limit(1);

    if (!workOrder) {
      return res.status(404).json({ error: "Work order not found" });
    }

    const [instance] = await db.select()
      .from(checklistInstances)
      .where(eq(checklistInstances.id, workOrder.checklistInstanceId))
      .limit(1);

    if (!instance) {
      return res.json({ workOrder, instance: null, template: null });
    }

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

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const { status, resolutionNotes, priority, details, assignedTo } = req.body;

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (resolutionNotes !== undefined) updateData.resolutionNotes = resolutionNotes;
    if (priority) updateData.priority = priority;
    if (details !== undefined) updateData.details = details;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo || null;

    if (status === "resolved" || status === "closed") {
      updateData.resolvedBy = userId;
      updateData.resolvedAt = new Date();
    }

    const [updated] = await db.update(checklistWorkOrders)
      .set(updateData)
      .where(and(
        eq(checklistWorkOrders.id, workOrderId),
        eq(checklistWorkOrders.companyId, companyId!)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Work order not found" });
    }

    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to update work order");
    res.status(500).json({ error: "Failed to update work order" });
  }
});

export default router;
