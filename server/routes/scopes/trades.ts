import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { db } from "../../db";
import { scopeTrades, scopes, costCodes } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { isValidId, tradeSchema, DEFAULT_TRADES } from "./shared";

const router = Router();

router.get("/api/scope-trades/cost-codes", requireAuth, requirePermission("scopes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const results = await db
      .select({ id: costCodes.id, code: costCodes.code, name: costCodes.name })
      .from(costCodes)
      .where(and(eq(costCodes.companyId, companyId), eq(costCodes.isActive, true)))
      .orderBy(asc(costCodes.sortOrder), asc(costCodes.code))
      .limit(1000);
    res.json(results);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching cost codes for scope trades");
    res.status(500).json({ message: "Failed to fetch cost codes" });
  }
});

router.get("/api/scope-trades", requireAuth, requirePermission("scopes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const results = await db
      .select()
      .from(scopeTrades)
      .where(eq(scopeTrades.companyId, companyId))
      .orderBy(asc(scopeTrades.sortOrder), asc(scopeTrades.name))
      .limit(1000);
    res.json(results);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching scope trades");
    res.status(500).json({ message: "Failed to fetch scope trades" });
  }
});

router.post("/api/scope-trades/seed", requireAuth, requirePermission("scopes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const seeded: string[] = [];
    const skipped: string[] = [];

    const existingTrades = await db
      .select({ name: scopeTrades.name })
      .from(scopeTrades)
      .where(eq(scopeTrades.companyId, companyId))
      .limit(1000);
    const existingNames = new Set(existingTrades.map(t => t.name));

    const toInsert: { companyId: string; name: string; isActive: boolean; sortOrder: number }[] = [];
    for (let i = 0; i < DEFAULT_TRADES.length; i++) {
      const name = DEFAULT_TRADES[i];
      if (existingNames.has(name)) {
        skipped.push(name);
      } else {
        toInsert.push({ companyId, name, isActive: true, sortOrder: i });
        seeded.push(name);
      }
    }
    if (toInsert.length > 0) {
      await db.insert(scopeTrades).values(toInsert);
    }

    res.json({ message: "Seed complete", seeded, skipped });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error seeding scope trades");
    res.status(500).json({ message: "Failed to seed scope trades" });
  }
});

router.post("/api/scope-trades", requireAuth, requirePermission("scopes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const data = tradeSchema.parse(req.body);

    const [result] = await db
      .insert(scopeTrades)
      .values({
        companyId,
        name: data.name,
        description: data.description || null,
        costCodeId: data.costCodeId || null,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();

    res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    if ((error as any)?.code === "23505") {
      return res.status(409).json({ message: "A trade with that name already exists" });
    }
    logger.error({ err: error }, "Error creating scope trade");
    res.status(500).json({ message: "Failed to create scope trade" });
  }
});

router.put("/api/scope-trades/:id", requireAuth, requirePermission("scopes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid ID format" });
    const data = tradeSchema.partial().parse(req.body);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.costCodeId !== undefined) updateData.costCodeId = data.costCodeId || null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

    const [result] = await db
      .update(scopeTrades)
      .set(updateData)
      .where(and(eq(scopeTrades.id, id), eq(scopeTrades.companyId, companyId)))
      .returning();

    if (!result) return res.status(404).json({ message: "Trade not found" });
    res.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error updating scope trade");
    res.status(500).json({ message: "Failed to update scope trade" });
  }
});

router.delete("/api/scope-trades/:id", requireAuth, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid ID format" });

    const linkedScopes = await db
      .select({ id: scopes.id })
      .from(scopes)
      .where(and(eq(scopes.tradeId, id), eq(scopes.companyId, companyId)))
      .limit(1);

    if (linkedScopes.length > 0) {
      return res.status(400).json({ message: "Cannot delete trade with linked scopes" });
    }

    const [deleted] = await db
      .delete(scopeTrades)
      .where(and(eq(scopeTrades.id, id), eq(scopeTrades.companyId, companyId)))
      .returning();

    if (!deleted) return res.status(404).json({ message: "Trade not found" });
    res.json({ message: "Trade deleted", id: deleted.id });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting scope trade");
    res.status(500).json({ message: "Failed to delete scope trade" });
  }
});

export default router;
