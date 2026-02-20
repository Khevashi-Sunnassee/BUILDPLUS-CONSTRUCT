import { Router } from "express";
import {
  requireAuth, requireRole, Request, Response,
  db, assets, and, eq, desc,
  createMaintenanceSchema, createTransferSchema,
} from "./shared";
import { assetMaintenanceRecords, assetTransfers } from "@shared/schema";

const router = Router();

router.get("/api/admin/assets/:id/maintenance", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const safeLimit = Math.min(parseInt(req.query.limit as string) || 500, 1000);
    const records = await db.select().from(assetMaintenanceRecords)
      .where(and(eq(assetMaintenanceRecords.assetId, String(req.params.id)), eq(assetMaintenanceRecords.companyId, companyId)))
      .orderBy(desc(assetMaintenanceRecords.maintenanceDate))
      .limit(safeLimit);
    res.json(records);
  } catch (error: unknown) {
    res.status(500).json({ error: "Failed to fetch maintenance records" });
  }
});

router.post("/api/admin/assets/:id/maintenance", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const [asset] = await db.select({ id: assets.id }).from(assets)
      .where(and(eq(assets.id, String(req.params.id)), eq(assets.companyId, companyId)));
    if (!asset) return res.status(404).json({ error: "Asset not found" });

    const parsed = createMaintenanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    }
    const [record] = await db.insert(assetMaintenanceRecords).values({
      ...parsed.data,
      assetId: String(req.params.id),
      companyId,
      createdBy: req.session?.userId || null,
    }).returning();
    res.status(201).json(record);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create maintenance record" });
  }
});

router.delete("/api/admin/assets/:assetId/maintenance/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    await db.delete(assetMaintenanceRecords)
      .where(and(eq(assetMaintenanceRecords.id, String(req.params.id)), eq(assetMaintenanceRecords.companyId, companyId)));
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: "Failed to delete maintenance record" });
  }
});

router.get("/api/admin/assets/:id/transfers", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const safeLimit = Math.min(parseInt(req.query.limit as string) || 500, 1000);
    const records = await db.select().from(assetTransfers)
      .where(and(eq(assetTransfers.assetId, String(req.params.id)), eq(assetTransfers.companyId, companyId)))
      .orderBy(desc(assetTransfers.transferDate))
      .limit(safeLimit);
    res.json(records);
  } catch (error: unknown) {
    res.status(500).json({ error: "Failed to fetch transfer records" });
  }
});

router.post("/api/admin/assets/:id/transfers", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const [asset] = await db.select().from(assets)
      .where(and(eq(assets.id, String(req.params.id)), eq(assets.companyId, companyId)));
    if (!asset) return res.status(404).json({ error: "Asset not found" });

    const parsed = createTransferSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    }
    const [record] = await db.insert(assetTransfers).values({
      ...parsed.data,
      assetId: String(req.params.id),
      companyId,
      transferredBy: req.session?.userId || null,
    }).returning();

    const updateFields: Record<string, unknown> = {};
    if (parsed.data.toLocation) updateFields.location = parsed.data.toLocation;
    if (parsed.data.toDepartment) updateFields.department = parsed.data.toDepartment;
    if (parsed.data.toAssignee) updateFields.assignedTo = parsed.data.toAssignee;
    if (Object.keys(updateFields).length > 0) {
      updateFields.updatedAt = new Date();
      await db.update(assets).set(updateFields).where(and(eq(assets.id, String(req.params.id)), eq(assets.companyId, companyId)));
    }

    res.status(201).json(record);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create transfer record" });
  }
});

router.delete("/api/admin/assets/:assetId/transfers/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    await db.delete(assetTransfers)
      .where(and(eq(assetTransfers.id, String(req.params.id)), eq(assetTransfers.companyId, companyId)));
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: "Failed to delete transfer record" });
  }
});

export default router;
