import { Router } from "express";
import { requireAuth } from "./middleware/auth.middleware";
import { db } from "../db";
import { assetRepairRequests, assets, users, suppliers } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import logger from "../lib/logger";

const router = Router();

const createRepairSchema = z.object({
  assetId: z.string().min(1),
  title: z.string().min(1, "Title is required"),
  issueDescription: z.string().min(1, "Issue description is required"),
  repairDetails: z.string().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  desiredServiceDate: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  vendorNotes: z.string().optional().nullable(),
  estimatedCost: z.any().optional().nullable(),
  assetLocation: z.string().optional().nullable(),
  assetConditionBefore: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateRepairSchema = createRepairSchema.partial().extend({
  status: z.enum(["DRAFT", "SUBMITTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  actualCost: z.any().optional().nullable(),
  assetConditionAfter: z.string().optional().nullable(),
});

async function getNextRepairNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RPR-${year}-`;
  const result = await db.select({ repairNumber: assetRepairRequests.repairNumber })
    .from(assetRepairRequests)
    .where(and(
      eq(assetRepairRequests.companyId, companyId),
      sql`${assetRepairRequests.repairNumber} LIKE ${prefix + '%'}`
    ))
    .orderBy(desc(assetRepairRequests.repairNumber))
    .limit(1);

  if (result.length === 0) return `${prefix}0001`;
  const lastNum = parseInt(result[0].repairNumber.replace(prefix, ""), 10);
  return `${prefix}${String(lastNum + 1).padStart(4, "0")}`;
}

router.get("/api/asset-repair-requests/next-number", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const repairNumber = await getNextRepairNumber(companyId);
    res.json({ repairNumber });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error getting next repair number");
    res.status(500).json({ error: "Failed to get next repair number" });
  }
});

router.get("/api/asset-repair-requests", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const rows = await db.select()
      .from(assetRepairRequests)
      .leftJoin(assets, eq(assetRepairRequests.assetId, assets.id))
      .leftJoin(users, eq(assetRepairRequests.requestedById, users.id))
      .leftJoin(suppliers, eq(assetRepairRequests.vendorId, suppliers.id))
      .where(eq(assetRepairRequests.companyId, companyId))
      .orderBy(desc(assetRepairRequests.createdAt));

    const result = rows.map((r) => ({
      ...r.asset_repair_requests,
      asset: r.assets ? { id: r.assets.id, name: r.assets.name, assetTag: r.assets.assetTag, category: r.assets.category } : null,
      requestedBy: r.users ? { id: r.users.id, name: r.users.name, email: r.users.email } : null,
      vendor: r.suppliers ? { id: r.suppliers.id, name: r.suppliers.name } : null,
    }));
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching repair requests");
    res.status(500).json({ error: "Failed to fetch repair requests" });
  }
});

router.get("/api/admin/assets/:assetId/repair-requests", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const rows = await db.select()
      .from(assetRepairRequests)
      .leftJoin(users, eq(assetRepairRequests.requestedById, users.id))
      .leftJoin(suppliers, eq(assetRepairRequests.vendorId, suppliers.id))
      .where(and(
        eq(assetRepairRequests.companyId, companyId),
        eq(assetRepairRequests.assetId, req.params.assetId)
      ))
      .orderBy(desc(assetRepairRequests.createdAt));

    const result = rows.map((r) => ({
      ...r.asset_repair_requests,
      requestedBy: r.users ? { id: r.users.id, name: r.users.name, email: r.users.email } : null,
      vendor: r.suppliers ? { id: r.suppliers.id, name: r.suppliers.name } : null,
    }));
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching repair requests for asset");
    res.status(500).json({ error: "Failed to fetch repair requests" });
  }
});

router.get("/api/asset-repair-requests/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const [row] = await db.select()
      .from(assetRepairRequests)
      .leftJoin(assets, eq(assetRepairRequests.assetId, assets.id))
      .leftJoin(users, eq(assetRepairRequests.requestedById, users.id))
      .leftJoin(suppliers, eq(assetRepairRequests.vendorId, suppliers.id))
      .where(and(
        eq(assetRepairRequests.id, req.params.id),
        eq(assetRepairRequests.companyId, companyId)
      ));

    if (!row) return res.status(404).json({ error: "Repair request not found" });

    res.json({
      ...row.asset_repair_requests,
      asset: row.assets ? { id: row.assets.id, name: row.assets.name, assetTag: row.assets.assetTag, category: row.assets.category, location: row.assets.location } : null,
      requestedBy: row.users ? { id: row.users.id, name: row.users.name, email: row.users.email } : null,
      vendor: row.suppliers ? { id: row.suppliers.id, name: row.suppliers.name } : null,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching repair request");
    res.status(500).json({ error: "Failed to fetch repair request" });
  }
});

router.post("/api/asset-repair-requests", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(400).json({ error: "Company context required" });

    const parsed = createRepairSchema.parse(req.body);
    const repairNumber = await getNextRepairNumber(companyId);

    const [created] = await db.insert(assetRepairRequests).values({
      ...parsed,
      companyId,
      repairNumber,
      requestedById: userId,
      vendorId: parsed.vendorId || null,
      estimatedCost: parsed.estimatedCost ? String(parsed.estimatedCost) : null,
    }).returning();

    res.status(201).json(created);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating repair request");
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: "Failed to create repair request" });
  }
});

router.put("/api/asset-repair-requests/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const parsed = updateRepairSchema.parse(req.body);

    const updateData: Record<string, any> = { ...parsed, updatedAt: new Date() };
    if (parsed.vendorId !== undefined) updateData.vendorId = parsed.vendorId || null;
    if (parsed.estimatedCost !== undefined) updateData.estimatedCost = parsed.estimatedCost ? String(parsed.estimatedCost) : null;
    if (parsed.actualCost !== undefined) updateData.actualCost = parsed.actualCost ? String(parsed.actualCost) : null;

    if (parsed.status === "COMPLETED") {
      updateData.completedAt = new Date();
      updateData.completedById = req.session.userId;
    }

    const [updated] = await db.update(assetRepairRequests)
      .set(updateData)
      .where(and(
        eq(assetRepairRequests.id, req.params.id),
        eq(assetRepairRequests.companyId, companyId)
      ))
      .returning();

    if (!updated) return res.status(404).json({ error: "Repair request not found" });
    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating repair request");
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: "Failed to update repair request" });
  }
});

router.delete("/api/asset-repair-requests/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const [deleted] = await db.delete(assetRepairRequests)
      .where(and(
        eq(assetRepairRequests.id, req.params.id),
        eq(assetRepairRequests.companyId, companyId)
      ))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Repair request not found" });
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting repair request");
    res.status(500).json({ error: "Failed to delete repair request" });
  }
});

export default router;
