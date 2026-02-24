import { Router } from "express";
import { requireAuth } from "./middleware/auth.middleware";
import { db } from "../db";
import { checklistWorkOrders, assets, users, suppliers } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import logger from "../lib/logger";

const router = Router();

const createServiceRequestSchema = z.object({
  assetId: z.string().min(1),
  title: z.string().min(1, "Title is required"),
  issueDescription: z.string().min(1, "Issue description is required"),
  details: z.string().optional().nullable(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  desiredServiceDate: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  supplierName: z.string().optional().nullable(),
  vendorNotes: z.string().optional().nullable(),
  estimatedCost: z.any().optional().nullable(),
  assetLocation: z.string().optional().nullable(),
  assetConditionBefore: z.string().optional().nullable(),
});

const updateServiceRequestSchema = createServiceRequestSchema.partial().extend({
  status: z.enum(["open", "in_progress", "resolved", "closed", "cancelled"]).optional(),
  actualCost: z.any().optional().nullable(),
  assetConditionAfter: z.string().optional().nullable(),
  resolutionNotes: z.string().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
});

async function getNextWorkOrderNumber(companyId: string): Promise<string> {
  const { getNextSequenceNumber } = await import("../lib/sequence-generator");
  const year = new Date().getFullYear();
  return getNextSequenceNumber("work_order", `${companyId}_${year}`, `WO-${year}-`, 4);
}

router.get("/api/asset-repair-requests/next-number", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const workOrderNumber = await getNextWorkOrderNumber(companyId);
    res.json({ repairNumber: workOrderNumber });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error getting next work order number");
    res.status(500).json({ error: "Failed to get next number" });
  }
});

router.get("/api/asset-repair-requests", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const rows = await db.select({
      id: checklistWorkOrders.id,
      companyId: checklistWorkOrders.companyId,
      workOrderNumber: checklistWorkOrders.workOrderNumber,
      assetId: checklistWorkOrders.assetId,
      title: checklistWorkOrders.title,
      issueDescription: checklistWorkOrders.issueDescription,
      details: checklistWorkOrders.details,
      priority: checklistWorkOrders.priority,
      status: checklistWorkOrders.status,
      workOrderType: checklistWorkOrders.workOrderType,
      requestedById: checklistWorkOrders.requestedById,
      requestedDate: checklistWorkOrders.requestedDate,
      desiredServiceDate: checklistWorkOrders.desiredServiceDate,
      supplierId: checklistWorkOrders.supplierId,
      supplierName: checklistWorkOrders.supplierName,
      vendorNotes: checklistWorkOrders.vendorNotes,
      estimatedCost: checklistWorkOrders.estimatedCost,
      actualCost: checklistWorkOrders.actualCost,
      assetLocation: checklistWorkOrders.assetLocation,
      assetConditionBefore: checklistWorkOrders.assetConditionBefore,
      assetConditionAfter: checklistWorkOrders.assetConditionAfter,
      completedAt: checklistWorkOrders.completedAt,
      completedById: checklistWorkOrders.completedById,
      resolvedAt: checklistWorkOrders.resolvedAt,
      resolutionNotes: checklistWorkOrders.resolutionNotes,
      assignedTo: checklistWorkOrders.assignedTo,
      createdAt: checklistWorkOrders.createdAt,
      updatedAt: checklistWorkOrders.updatedAt,
      assetName: assets.name,
      assetTag: assets.assetTag,
      assetCategory: assets.category,
      requestedByName: users.name,
      requestedByEmail: users.email,
      vendorName: suppliers.name,
    })
      .from(checklistWorkOrders)
      .leftJoin(assets, eq(checklistWorkOrders.assetId, assets.id))
      .leftJoin(users, eq(checklistWorkOrders.requestedById, users.id))
      .leftJoin(suppliers, eq(checklistWorkOrders.supplierId, suppliers.id))
      .where(and(
        eq(checklistWorkOrders.companyId, companyId),
        sql`${checklistWorkOrders.assetId} IS NOT NULL`
      ))
      .orderBy(desc(checklistWorkOrders.createdAt))
      .limit(1000);

    const result = rows.map((r) => ({
      ...r,
      repairNumber: r.workOrderNumber,
      asset: r.assetName ? { id: r.assetId, name: r.assetName, assetTag: r.assetTag, category: r.assetCategory } : null,
      requestedBy: r.requestedByName ? { id: r.requestedById, name: r.requestedByName, email: r.requestedByEmail } : null,
      vendor: r.vendorName ? { id: r.supplierId, name: r.vendorName } : null,
    }));
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching service requests");
    res.status(500).json({ error: "Failed to fetch service requests" });
  }
});

router.get("/api/admin/assets/:assetId/repair-requests", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const assetId = req.params.assetId as string;

    const rows = await db.select({
      id: checklistWorkOrders.id,
      companyId: checklistWorkOrders.companyId,
      workOrderNumber: checklistWorkOrders.workOrderNumber,
      assetId: checklistWorkOrders.assetId,
      title: checklistWorkOrders.title,
      issueDescription: checklistWorkOrders.issueDescription,
      details: checklistWorkOrders.details,
      priority: checklistWorkOrders.priority,
      status: checklistWorkOrders.status,
      workOrderType: checklistWorkOrders.workOrderType,
      requestedById: checklistWorkOrders.requestedById,
      requestedDate: checklistWorkOrders.requestedDate,
      desiredServiceDate: checklistWorkOrders.desiredServiceDate,
      supplierId: checklistWorkOrders.supplierId,
      supplierName: checklistWorkOrders.supplierName,
      vendorNotes: checklistWorkOrders.vendorNotes,
      estimatedCost: checklistWorkOrders.estimatedCost,
      actualCost: checklistWorkOrders.actualCost,
      assetLocation: checklistWorkOrders.assetLocation,
      assetConditionBefore: checklistWorkOrders.assetConditionBefore,
      assetConditionAfter: checklistWorkOrders.assetConditionAfter,
      completedAt: checklistWorkOrders.completedAt,
      completedById: checklistWorkOrders.completedById,
      resolvedAt: checklistWorkOrders.resolvedAt,
      resolutionNotes: checklistWorkOrders.resolutionNotes,
      assignedTo: checklistWorkOrders.assignedTo,
      createdAt: checklistWorkOrders.createdAt,
      updatedAt: checklistWorkOrders.updatedAt,
      requestedByName: users.name,
      requestedByEmail: users.email,
      vendorName: suppliers.name,
    })
      .from(checklistWorkOrders)
      .leftJoin(users, eq(checklistWorkOrders.requestedById, users.id))
      .leftJoin(suppliers, eq(checklistWorkOrders.supplierId, suppliers.id))
      .where(and(
        eq(checklistWorkOrders.companyId, companyId),
        eq(checklistWorkOrders.assetId, assetId)
      ))
      .orderBy(desc(checklistWorkOrders.createdAt))
      .limit(1000);

    const result = rows.map((r) => ({
      ...r,
      repairNumber: r.workOrderNumber,
      requestedBy: r.requestedByName ? { id: r.requestedById, name: r.requestedByName, email: r.requestedByEmail } : null,
      vendor: r.vendorName ? { id: r.supplierId, name: r.vendorName } : null,
    }));
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching service requests for asset");
    res.status(500).json({ error: "Failed to fetch service requests" });
  }
});

router.get("/api/asset-repair-requests/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = req.params.id as string;

    const [row] = await db.select()
      .from(checklistWorkOrders)
      .leftJoin(assets, eq(checklistWorkOrders.assetId, assets.id))
      .leftJoin(users, eq(checklistWorkOrders.requestedById, users.id))
      .leftJoin(suppliers, eq(checklistWorkOrders.supplierId, suppliers.id))
      .where(and(
        eq(checklistWorkOrders.id, id),
        eq(checklistWorkOrders.companyId, companyId)
      ))
      .limit(1);

    if (!row) return res.status(404).json({ error: "Service request not found" });

    const wo = row.checklist_work_orders;
    res.json({
      ...wo,
      repairNumber: wo.workOrderNumber,
      asset: row.assets ? { id: row.assets.id, name: row.assets.name, assetTag: row.assets.assetTag, category: row.assets.category, location: row.assets.location } : null,
      requestedBy: row.users ? { id: row.users.id, name: row.users.name, email: row.users.email } : null,
      vendor: row.suppliers ? { id: row.suppliers.id, name: row.suppliers.name } : null,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching service request");
    res.status(500).json({ error: "Failed to fetch service request" });
  }
});

router.post("/api/asset-repair-requests", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(400).json({ error: "Company context required" });

    const parsed = createServiceRequestSchema.parse(req.body);
    const workOrderNumber = await getNextWorkOrderNumber(companyId);

    let resolvedSupplierName = parsed.supplierName || null;
    if (parsed.supplierId && !resolvedSupplierName) {
      const [supplier] = await db.select({ name: suppliers.name })
        .from(suppliers).where(eq(suppliers.id, parsed.supplierId)).limit(1);
      resolvedSupplierName = supplier?.name || null;
    }

    const [created] = await db.insert(checklistWorkOrders).values({
      companyId,
      workOrderNumber,
      title: parsed.title,
      issueDescription: parsed.issueDescription,
      details: parsed.details || null,
      priority: parsed.priority,
      workOrderType: "service_request",
      assetId: parsed.assetId,
      assetLocation: parsed.assetLocation || null,
      assetConditionBefore: parsed.assetConditionBefore || null,
      estimatedCost: parsed.estimatedCost ? String(parsed.estimatedCost) : null,
      desiredServiceDate: parsed.desiredServiceDate || null,
      supplierId: parsed.supplierId || null,
      supplierName: resolvedSupplierName,
      vendorNotes: parsed.vendorNotes || null,
      requestedById: userId,
      requestedDate: new Date(),
      status: "open",
    }).returning();

    await db.update(assets)
      .set({ status: "awaiting_service" })
      .where(and(
        eq(assets.id, parsed.assetId),
        eq(assets.companyId, companyId)
      ));

    res.status(201).json({ ...created, repairNumber: created.workOrderNumber });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating service request");
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: "Failed to create service request" });
  }
});

router.put("/api/asset-repair-requests/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = req.params.id as string;

    const parsed = updateServiceRequestSchema.parse(req.body);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.title !== undefined) updateData.title = parsed.title;
    if (parsed.issueDescription !== undefined) updateData.issueDescription = parsed.issueDescription;
    if (parsed.details !== undefined) updateData.details = parsed.details;
    if (parsed.priority) updateData.priority = parsed.priority;
    if (parsed.status) updateData.status = parsed.status;
    if (parsed.desiredServiceDate !== undefined) updateData.desiredServiceDate = parsed.desiredServiceDate;
    if (parsed.supplierId !== undefined) updateData.supplierId = parsed.supplierId || null;
    if (parsed.supplierName !== undefined) updateData.supplierName = parsed.supplierName || null;
    if (parsed.vendorNotes !== undefined) updateData.vendorNotes = parsed.vendorNotes;
    if (parsed.estimatedCost !== undefined) updateData.estimatedCost = parsed.estimatedCost ? String(parsed.estimatedCost) : null;
    if (parsed.actualCost !== undefined) updateData.actualCost = parsed.actualCost ? String(parsed.actualCost) : null;
    if (parsed.assetLocation !== undefined) updateData.assetLocation = parsed.assetLocation;
    if (parsed.assetConditionBefore !== undefined) updateData.assetConditionBefore = parsed.assetConditionBefore;
    if (parsed.assetConditionAfter !== undefined) updateData.assetConditionAfter = parsed.assetConditionAfter;
    if (parsed.resolutionNotes !== undefined) updateData.resolutionNotes = parsed.resolutionNotes;
    if (parsed.assignedTo !== undefined) updateData.assignedTo = parsed.assignedTo || null;

    if (parsed.status === "resolved" || parsed.status === "closed") {
      updateData.completedAt = new Date();
      updateData.completedById = req.session.userId;
      updateData.resolvedBy = req.session.userId;
      updateData.resolvedAt = new Date();
    }

    const [updated] = await db.update(checklistWorkOrders)
      .set(updateData)
      .where(and(
        eq(checklistWorkOrders.id, id),
        eq(checklistWorkOrders.companyId, companyId)
      ))
      .returning();

    if (!updated) return res.status(404).json({ error: "Service request not found" });

    if (parsed.status && updated.assetId) {
      let newAssetStatus: string | null = null;
      if (parsed.status === "in_progress") {
        newAssetStatus = "in_service";
      } else if (parsed.status === "resolved" || parsed.status === "closed" || parsed.status === "cancelled") {
        const openRequests = await db.select({ id: checklistWorkOrders.id })
          .from(checklistWorkOrders)
          .where(and(
            eq(checklistWorkOrders.assetId, updated.assetId!),
            eq(checklistWorkOrders.companyId, companyId),
            sql`${checklistWorkOrders.status} NOT IN ('resolved', 'closed', 'cancelled')`,
            sql`${checklistWorkOrders.id} != ${updated.id}`
          ))
          .limit(1);
        if (openRequests.length === 0) {
          newAssetStatus = "active";
        }
      } else if (parsed.status === "open") {
        newAssetStatus = "awaiting_service";
      }
      if (newAssetStatus) {
        await db.update(assets)
          .set({ status: newAssetStatus })
          .where(and(eq(assets.id, updated.assetId!), eq(assets.companyId, companyId)));
      }
    }

    res.json({ ...updated, repairNumber: updated.workOrderNumber });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating service request");
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: "Failed to update service request" });
  }
});

router.delete("/api/asset-repair-requests/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = req.params.id as string;

    const [deleted] = await db.delete(checklistWorkOrders)
      .where(and(
        eq(checklistWorkOrders.id, id),
        eq(checklistWorkOrders.companyId, companyId)
      ))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Service request not found" });
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting service request");
    res.status(500).json({ error: "Failed to delete service request" });
  }
});

export default router;
