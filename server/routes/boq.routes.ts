import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import logger from "../lib/logger";
import { db } from "../db";
import { boqGroups, boqItems, costCodes, childCostCodes, budgetLines, tenderLineItems } from "@shared/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";

const router = Router();

const boqGroupSchema = z.object({
  costCodeId: z.string().min(1, "Cost code is required"),
  childCostCodeId: z.string().nullable().optional(),
  budgetLineId: z.string().nullable().optional(),
  name: z.string().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

const boqItemSchema = z.object({
  costCodeId: z.string().min(1, "Cost code is required"),
  childCostCodeId: z.string().nullable().optional(),
  groupId: z.string().nullable().optional(),
  budgetLineId: z.string().nullable().optional(),
  tenderLineItemId: z.string().nullable().optional(),
  description: z.string().min(1, "Description is required"),
  quantity: z.string().nullable().optional(),
  unit: z.enum(["EA", "SQM", "M3", "LM", "M2", "M", "HR", "DAY", "TONNE", "KG", "LOT"]).optional(),
  unitPrice: z.string().nullable().optional(),
  lineTotal: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

router.get("/api/jobs/:jobId/boq/groups", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = req.params.jobId;
    const { costCodeId } = req.query;

    let conditions = [eq(boqGroups.jobId, jobId), eq(boqGroups.companyId, companyId)];

    if (costCodeId && typeof costCodeId === "string") {
      conditions.push(eq(boqGroups.costCodeId, costCodeId));
    }

    const results = await db
      .select({
        group: boqGroups,
        costCode: {
          id: costCodes.id,
          code: costCodes.code,
          name: costCodes.name,
        },
        childCostCode: {
          id: childCostCodes.id,
          code: childCostCodes.code,
          name: childCostCodes.name,
        },
      })
      .from(boqGroups)
      .innerJoin(costCodes, eq(boqGroups.costCodeId, costCodes.id))
      .leftJoin(childCostCodes, eq(boqGroups.childCostCodeId, childCostCodes.id))
      .where(and(...conditions))
      .orderBy(asc(boqGroups.sortOrder), asc(boqGroups.name))
      .limit(1000);

    const mapped = results.map((row) => ({
      ...row.group,
      costCode: row.costCode,
      childCostCode: row.childCostCode?.id ? row.childCostCode : null,
    }));

    res.json(mapped);
  } catch (error: unknown) {
    logger.error("Error fetching BOQ groups:", error);
    res.status(500).json({ message: "Failed to fetch BOQ groups" });
  }
});

router.post("/api/jobs/:jobId/boq/groups", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = req.params.jobId;
    const data = boqGroupSchema.parse(req.body);

    const [result] = await db
      .insert(boqGroups)
      .values({
        companyId,
        jobId,
        costCodeId: data.costCodeId,
        childCostCodeId: data.childCostCodeId || null,
        budgetLineId: data.budgetLineId || null,
        name: data.name,
        description: data.description || null,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();

    res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error creating BOQ group:", error);
    res.status(500).json({ message: "Failed to create BOQ group" });
  }
});

router.patch("/api/jobs/:jobId/boq/groups/:id", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;
    const data = boqGroupSchema.partial().parse(req.body);

    const [result] = await db
      .update(boqGroups)
      .set({
        ...data,
        budgetLineId: data.budgetLineId !== undefined ? (data.budgetLineId || null) : undefined,
        description: data.description !== undefined ? (data.description || null) : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(boqGroups.id, id), eq(boqGroups.companyId, companyId)))
      .returning();

    if (!result) {
      return res.status(404).json({ message: "BOQ group not found" });
    }
    res.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error updating BOQ group:", error);
    res.status(500).json({ message: "Failed to update BOQ group" });
  }
});

router.delete("/api/jobs/:jobId/boq/groups/:id", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;

    const [deleted] = await db
      .delete(boqGroups)
      .where(and(eq(boqGroups.id, id), eq(boqGroups.companyId, companyId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "BOQ group not found" });
    }
    res.json({ message: "BOQ group deleted", id: deleted.id });
  } catch (error: unknown) {
    logger.error("Error deleting BOQ group:", error);
    res.status(500).json({ message: "Failed to delete BOQ group" });
  }
});

router.get("/api/jobs/:jobId/boq/items", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = req.params.jobId;
    const { groupId, costCodeId } = req.query;

    let conditions = [eq(boqItems.jobId, jobId), eq(boqItems.companyId, companyId)];

    if (groupId && typeof groupId === "string") {
      conditions.push(eq(boqItems.groupId, groupId));
    }
    if (costCodeId && typeof costCodeId === "string") {
      conditions.push(eq(boqItems.costCodeId, costCodeId));
    }

    const results = await db
      .select({
        item: boqItems,
        costCode: {
          id: costCodes.id,
          code: costCodes.code,
          name: costCodes.name,
        },
        childCostCode: {
          id: childCostCodes.id,
          code: childCostCodes.code,
          name: childCostCodes.name,
        },
      })
      .from(boqItems)
      .innerJoin(costCodes, eq(boqItems.costCodeId, costCodes.id))
      .leftJoin(childCostCodes, eq(boqItems.childCostCodeId, childCostCodes.id))
      .where(and(...conditions))
      .orderBy(asc(boqItems.sortOrder), asc(boqItems.description))
      .limit(1000);

    const mapped = results.map((row) => ({
      ...row.item,
      costCode: row.costCode,
      childCostCode: row.childCostCode?.id ? row.childCostCode : null,
    }));

    res.json(mapped);
  } catch (error: unknown) {
    logger.error("Error fetching BOQ items:", error);
    res.status(500).json({ message: "Failed to fetch BOQ items" });
  }
});

router.post("/api/jobs/:jobId/boq/items", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = req.params.jobId;
    const data = boqItemSchema.parse(req.body);

    const [result] = await db
      .insert(boqItems)
      .values({
        companyId,
        jobId,
        costCodeId: data.costCodeId,
        childCostCodeId: data.childCostCodeId || null,
        groupId: data.groupId || null,
        budgetLineId: data.budgetLineId || null,
        tenderLineItemId: data.tenderLineItemId || null,
        description: data.description,
        quantity: data.quantity || "0",
        unit: data.unit ?? "EA",
        unitPrice: data.unitPrice || "0",
        lineTotal: data.lineTotal || "0",
        notes: data.notes || null,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();

    res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error creating BOQ item:", error);
    res.status(500).json({ message: "Failed to create BOQ item" });
  }
});

router.patch("/api/jobs/:jobId/boq/items/:id", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const data = boqItemSchema.partial().parse(req.body);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.costCodeId !== undefined) updateData.costCodeId = data.costCodeId;
    if (data.childCostCodeId !== undefined) updateData.childCostCodeId = data.childCostCodeId || null;
    if (data.groupId !== undefined) updateData.groupId = data.groupId || null;
    if (data.budgetLineId !== undefined) updateData.budgetLineId = data.budgetLineId || null;
    if (data.tenderLineItemId !== undefined) updateData.tenderLineItemId = data.tenderLineItemId || null;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.quantity !== undefined) updateData.quantity = data.quantity || "0";
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.unitPrice !== undefined) updateData.unitPrice = data.unitPrice || "0";
    if (data.lineTotal !== undefined) updateData.lineTotal = data.lineTotal || "0";
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

    const id = req.params.id as string;

    const [result] = await db
      .update(boqItems)
      .set(updateData)
      .where(and(eq(boqItems.id, id), eq(boqItems.companyId, companyId)))
      .returning();

    if (!result) {
      return res.status(404).json({ message: "BOQ item not found" });
    }
    res.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error updating BOQ item:", error);
    res.status(500).json({ message: "Failed to update BOQ item" });
  }
});

router.delete("/api/jobs/:jobId/boq/items/:id", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;

    const [deleted] = await db
      .delete(boqItems)
      .where(and(eq(boqItems.id, id), eq(boqItems.companyId, companyId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "BOQ item not found" });
    }
    res.json({ message: "BOQ item deleted", id: deleted.id });
  } catch (error: unknown) {
    logger.error("Error deleting BOQ item:", error);
    res.status(500).json({ message: "Failed to delete BOQ item" });
  }
});

router.get("/api/jobs/:jobId/boq/summary", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = req.params.jobId;

    const [totals] = await db
      .select({
        totalItems: sql<number>`COUNT(*)::int`,
        totalValue: sql<string>`COALESCE(SUM(CAST(${boqItems.lineTotal} AS DECIMAL(14,2))), 0)`,
      })
      .from(boqItems)
      .where(and(eq(boqItems.jobId, jobId), eq(boqItems.companyId, companyId)));

    const breakdown = await db
      .select({
        costCodeId: costCodes.id,
        costCode: costCodes.code,
        costCodeName: costCodes.name,
        itemCount: sql<number>`COUNT(*)::int`,
        subtotal: sql<string>`COALESCE(SUM(CAST(${boqItems.lineTotal} AS DECIMAL(14,2))), 0)`,
      })
      .from(boqItems)
      .innerJoin(costCodes, eq(boqItems.costCodeId, costCodes.id))
      .where(and(eq(boqItems.jobId, jobId), eq(boqItems.companyId, companyId)))
      .groupBy(costCodes.id, costCodes.code, costCodes.name)
      .orderBy(asc(costCodes.code))
      .limit(1000);

    res.json({
      totalItems: totals?.totalItems || 0,
      totalValue: totals?.totalValue || "0",
      breakdown,
    });
  } catch (error: unknown) {
    logger.error("Error fetching BOQ summary:", error);
    res.status(500).json({ message: "Failed to fetch BOQ summary" });
  }
});

export const boqRouter = router;
