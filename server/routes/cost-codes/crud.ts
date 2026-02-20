import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { requireUUID } from "../../lib/api-utils";
import { db } from "../../db";
import { costCodes, childCostCodes, costCodeDefaults, jobCostCodes } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { costCodeSchema } from "./shared";

const router = Router();

router.get("/api/cost-codes", requireAuth, requirePermission("admin_cost_codes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { search, active } = req.query;

    let conditions = [eq(costCodes.companyId, companyId)];

    if (active === "true") {
      conditions.push(eq(costCodes.isActive, true));
    } else if (active === "false") {
      conditions.push(eq(costCodes.isActive, false));
    }

    let results = await db
      .select()
      .from(costCodes)
      .where(and(...conditions))
      .orderBy(asc(costCodes.sortOrder), asc(costCodes.code))
      .limit(1000);

    if (search && typeof search === "string" && search.trim()) {
      const s = search.trim().toLowerCase();
      results = results.filter(
        (cc) =>
          cc.code.toLowerCase().includes(s) ||
          cc.name.toLowerCase().includes(s) ||
          (cc.description && cc.description.toLowerCase().includes(s))
      );
    }

    res.json(results);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching cost codes");
    res.status(500).json({ message: "Failed to fetch cost codes" });
  }
});

router.get("/api/cost-codes-with-children", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;

    const parents = await db
      .select()
      .from(costCodes)
      .where(and(eq(costCodes.companyId, companyId), eq(costCodes.isActive, true)))
      .orderBy(asc(costCodes.sortOrder), asc(costCodes.code))
      .limit(1000);

    const children = await db
      .select()
      .from(childCostCodes)
      .where(and(eq(childCostCodes.companyId, companyId), eq(childCostCodes.isActive, true)))
      .orderBy(asc(childCostCodes.sortOrder), asc(childCostCodes.code))
      .limit(1000);

    const childMap = new Map<string, typeof children>();
    for (const child of children) {
      const existing = childMap.get(child.parentCostCodeId) || [];
      existing.push(child);
      childMap.set(child.parentCostCodeId, existing);
    }

    const result = parents.map((parent) => ({
      ...parent,
      children: childMap.get(parent.id) || [],
    }));

    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching cost codes with children");
    res.status(500).json({ message: "Failed to fetch cost codes with children" });
  }
});

router.get("/api/cost-codes/:id", requireAuth, requirePermission("admin_cost_codes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = requireUUID(req, res, "id");
    if (!id) return;
    const [result] = await db
      .select()
      .from(costCodes)
      .where(and(eq(costCodes.id, id), eq(costCodes.companyId, companyId)));

    if (!result) {
      return res.status(404).json({ message: "Cost code not found" });
    }
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching cost code");
    res.status(500).json({ message: "Failed to fetch cost code" });
  }
});

router.post("/api/cost-codes", requireAuth, requirePermission("admin_cost_codes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const data = costCodeSchema.parse(req.body);

    const existing = await db
      .select()
      .from(costCodes)
      .where(and(eq(costCodes.code, data.code), eq(costCodes.companyId, companyId)))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ message: `Cost code "${data.code}" already exists` });
    }

    const [result] = await db
      .insert(costCodes)
      .values({
        companyId,
        code: data.code,
        name: data.name,
        description: data.description || null,
        parentId: data.parentId || null,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();

    res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error creating cost code");
    res.status(500).json({ message: "Failed to create cost code" });
  }
});

router.patch("/api/cost-codes/:id", requireAuth, requirePermission("admin_cost_codes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = requireUUID(req, res, "id");
    if (!id) return;
    const data = costCodeSchema.partial().parse(req.body);

    if (data.code) {
      const existing = await db
        .select()
        .from(costCodes)
        .where(and(eq(costCodes.code, data.code), eq(costCodes.companyId, companyId)))
        .limit(1);

      if (existing.length > 0 && existing[0].id !== id) {
        return res.status(409).json({ message: `Cost code "${data.code}" already exists` });
      }
    }

    const [result] = await db
      .update(costCodes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(costCodes.id, id), eq(costCodes.companyId, companyId)))
      .returning();

    if (!result) {
      return res.status(404).json({ message: "Cost code not found" });
    }
    res.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error updating cost code");
    res.status(500).json({ message: "Failed to update cost code" });
  }
});

router.delete("/api/cost-codes/:id", requireAuth, requirePermission("admin_cost_codes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const usedInDefaults = await db
      .select({ id: costCodeDefaults.id })
      .from(costCodeDefaults)
      .where(eq(costCodeDefaults.costCodeId, id))
      .limit(1);

    const usedInJobs = await db
      .select({ id: jobCostCodes.id })
      .from(jobCostCodes)
      .where(eq(jobCostCodes.costCodeId, id))
      .limit(1);

    if (usedInDefaults.length > 0 || usedInJobs.length > 0) {
      const [result] = await db
        .update(costCodes)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(costCodes.id, id), eq(costCodes.companyId, companyId)))
        .returning();

      return res.json({ ...result, deactivated: true, message: "Cost code is in use and has been deactivated instead of deleted" });
    }

    const [deleted] = await db
      .delete(costCodes)
      .where(and(eq(costCodes.id, id), eq(costCodes.companyId, companyId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "Cost code not found" });
    }
    res.json({ message: "Cost code deleted", id: deleted.id });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting cost code");
    res.status(500).json({ message: "Failed to delete cost code" });
  }
});

export default router;
