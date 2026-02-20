import {
  Router, Request, Response,
  eq, and, desc,
  db,
  checklistInstances, checklistWorkOrders,
  requireAuth, requireRole,
  logger,
} from "./shared";

const router = Router();

// ============================================================================
// REPORTING ENDPOINTS
// ============================================================================

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

// ============================================================================
// WORK ORDERS CRUD
// ============================================================================

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

router.get("/api/checklist/work-orders", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const safeLimit = Math.min(parseInt(req.query.limit as string) || 500, 500);
    const orders = await db.select().from(checklistWorkOrders)
      .where(eq(checklistWorkOrders.companyId, companyId!))
      .orderBy(desc(checklistWorkOrders.createdAt))
      .limit(safeLimit);

    res.json(orders);
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to fetch all work orders");
    res.status(500).json({ error: "Failed to fetch work orders" });
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

    const { status, resolutionNotes, priority, details } = req.body;

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (resolutionNotes !== undefined) updateData.resolutionNotes = resolutionNotes;
    if (priority) updateData.priority = priority;
    if (details !== undefined) updateData.details = details;

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
