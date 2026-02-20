import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { requireUUID } from "../../lib/api-utils";
import { db } from "../../db";
import { costCodes, childCostCodes } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { childCostCodeSchema } from "./shared";

const router = Router();

router.get("/api/child-cost-codes", requireAuth, requirePermission("admin_cost_codes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { parentCostCodeId, search, active } = req.query;

    let conditions = [eq(childCostCodes.companyId, companyId)];

    if (parentCostCodeId && typeof parentCostCodeId === "string") {
      conditions.push(eq(childCostCodes.parentCostCodeId, parentCostCodeId));
    }

    if (active === "true") {
      conditions.push(eq(childCostCodes.isActive, true));
    } else if (active === "false") {
      conditions.push(eq(childCostCodes.isActive, false));
    }

    let results = await db
      .select({
        id: childCostCodes.id,
        companyId: childCostCodes.companyId,
        parentCostCodeId: childCostCodes.parentCostCodeId,
        code: childCostCodes.code,
        name: childCostCodes.name,
        description: childCostCodes.description,
        isActive: childCostCodes.isActive,
        sortOrder: childCostCodes.sortOrder,
        createdAt: childCostCodes.createdAt,
        updatedAt: childCostCodes.updatedAt,
        parentCode: costCodes.code,
        parentName: costCodes.name,
      })
      .from(childCostCodes)
      .innerJoin(costCodes, eq(childCostCodes.parentCostCodeId, costCodes.id))
      .where(and(...conditions))
      .orderBy(asc(childCostCodes.sortOrder), asc(childCostCodes.code))
      .limit(1000);

    if (search && typeof search === "string" && search.trim()) {
      const s = search.trim().toLowerCase();
      results = results.filter(
        (cc) =>
          cc.code.toLowerCase().includes(s) ||
          cc.name.toLowerCase().includes(s) ||
          (cc.description && cc.description.toLowerCase().includes(s)) ||
          cc.parentName.toLowerCase().includes(s)
      );
    }

    res.json(results);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching child cost codes");
    res.status(500).json({ message: "Failed to fetch child cost codes" });
  }
});

router.get("/api/child-cost-codes/:id", requireAuth, requirePermission("admin_cost_codes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = requireUUID(req, res, "id");
    if (!id) return;
    const [result] = await db
      .select({
        id: childCostCodes.id,
        companyId: childCostCodes.companyId,
        parentCostCodeId: childCostCodes.parentCostCodeId,
        code: childCostCodes.code,
        name: childCostCodes.name,
        description: childCostCodes.description,
        isActive: childCostCodes.isActive,
        sortOrder: childCostCodes.sortOrder,
        createdAt: childCostCodes.createdAt,
        updatedAt: childCostCodes.updatedAt,
        parentCode: costCodes.code,
        parentName: costCodes.name,
      })
      .from(childCostCodes)
      .innerJoin(costCodes, eq(childCostCodes.parentCostCodeId, costCodes.id))
      .where(and(eq(childCostCodes.id, id), eq(childCostCodes.companyId, companyId)));

    if (!result) {
      return res.status(404).json({ message: "Child cost code not found" });
    }
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching child cost code");
    res.status(500).json({ message: "Failed to fetch child cost code" });
  }
});

router.post("/api/child-cost-codes", requireAuth, requirePermission("admin_cost_codes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const data = childCostCodeSchema.parse(req.body);

    const existing = await db
      .select()
      .from(childCostCodes)
      .where(and(eq(childCostCodes.code, data.code), eq(childCostCodes.companyId, companyId)))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ message: `Child cost code "${data.code}" already exists` });
    }

    const [result] = await db
      .insert(childCostCodes)
      .values({
        companyId,
        parentCostCodeId: data.parentCostCodeId,
        code: data.code,
        name: data.name,
        description: data.description || null,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();

    res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error creating child cost code");
    res.status(500).json({ message: "Failed to create child cost code" });
  }
});

router.patch("/api/child-cost-codes/:id", requireAuth, requirePermission("admin_cost_codes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = requireUUID(req, res, "id");
    if (!id) return;
    const data = childCostCodeSchema.partial().parse(req.body);

    if (data.code) {
      const existing = await db
        .select()
        .from(childCostCodes)
        .where(and(eq(childCostCodes.code, data.code), eq(childCostCodes.companyId, companyId)))
        .limit(1);

      if (existing.length > 0 && existing[0].id !== id) {
        return res.status(409).json({ message: `Child cost code "${data.code}" already exists` });
      }
    }

    const [result] = await db
      .update(childCostCodes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(childCostCodes.id, id), eq(childCostCodes.companyId, companyId)))
      .returning();

    if (!result) {
      return res.status(404).json({ message: "Child cost code not found" });
    }
    res.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error updating child cost code");
    res.status(500).json({ message: "Failed to update child cost code" });
  }
});

router.delete("/api/child-cost-codes/:id", requireAuth, requirePermission("admin_cost_codes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [deleted] = await db
      .delete(childCostCodes)
      .where(and(eq(childCostCodes.id, id), eq(childCostCodes.companyId, companyId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "Child cost code not found" });
    }
    res.json({ message: "Child cost code deleted", id: deleted.id });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting child cost code");
    res.status(500).json({ message: "Failed to delete child cost code" });
  }
});

export default router;
