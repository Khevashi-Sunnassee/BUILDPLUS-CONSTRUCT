import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { db } from "../../db";
import { scopeItems } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { isValidId, scopeItemSchema, verifyScopeOwnership } from "./shared";

const router = Router();

router.post("/api/scopes/:id/items", requireAuth, requirePermission("scopes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid ID format" });

    if (!(await verifyScopeOwnership(companyId, id))) {
      return res.status(404).json({ message: "Scope not found" });
    }

    const data = scopeItemSchema.parse(req.body);

    const [result] = await db
      .insert(scopeItems)
      .values({
        scopeId: id,
        companyId,
        category: data.category || null,
        description: data.description,
        details: data.details || null,
        status: data.status || "INCLUDED",
        isCustom: data.isCustom ?? true,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();

    res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error adding scope item");
    res.status(500).json({ message: "Failed to add scope item" });
  }
});

router.put("/api/scopes/:id/items/:itemId", requireAuth, requirePermission("scopes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;
    const itemId = req.params.itemId as string;
    if (!isValidId(id) || !isValidId(itemId)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    if (!(await verifyScopeOwnership(companyId, id))) {
      return res.status(404).json({ message: "Scope not found" });
    }

    const data = scopeItemSchema.partial().parse(req.body);
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.category !== undefined) updateData.category = data.category || null;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.details !== undefined) updateData.details = data.details || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.isCustom !== undefined) updateData.isCustom = data.isCustom;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

    const [result] = await db
      .update(scopeItems)
      .set(updateData)
      .where(and(
        eq(scopeItems.id, itemId),
        eq(scopeItems.scopeId, id),
        eq(scopeItems.companyId, companyId)
      ))
      .returning();

    if (!result) return res.status(404).json({ message: "Scope item not found" });
    res.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error updating scope item");
    res.status(500).json({ message: "Failed to update scope item" });
  }
});

router.delete("/api/scopes/:id/items/:itemId", requireAuth, requirePermission("scopes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;
    const itemId = req.params.itemId as string;
    if (!isValidId(id) || !isValidId(itemId)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    if (!(await verifyScopeOwnership(companyId, id))) {
      return res.status(404).json({ message: "Scope not found" });
    }

    const [deleted] = await db
      .delete(scopeItems)
      .where(and(
        eq(scopeItems.id, itemId),
        eq(scopeItems.scopeId, id),
        eq(scopeItems.companyId, companyId)
      ))
      .returning();

    if (!deleted) return res.status(404).json({ message: "Scope item not found" });
    res.json({ message: "Item deleted", id: deleted.id });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting scope item");
    res.status(500).json({ message: "Failed to delete scope item" });
  }
});

router.put("/api/scopes/:id/items/bulk-status", requireAuth, requirePermission("scopes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid ID format" });

    if (!(await verifyScopeOwnership(companyId, id))) {
      return res.status(404).json({ message: "Scope not found" });
    }

    const bulkSchema = z.object({
      items: z.array(z.object({
        id: z.string().min(1),
        status: z.enum(["INCLUDED", "EXCLUDED", "NA"]),
      })),
    });
    const { items } = bulkSchema.parse(req.body);

    const updated: string[] = [];
    for (const item of items) {
      const [result] = await db
        .update(scopeItems)
        .set({ status: item.status, updatedAt: new Date() })
        .where(and(
          eq(scopeItems.id, item.id),
          eq(scopeItems.scopeId, id),
          eq(scopeItems.companyId, companyId)
        ))
        .returning();
      if (result) updated.push(result.id);
    }

    res.json({ message: "Bulk status update complete", updated: updated.length });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error bulk updating scope items");
    res.status(500).json({ message: "Failed to bulk update scope items" });
  }
});

router.post("/api/scopes/:id/items/reorder", requireAuth, requirePermission("scopes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid ID format" });

    if (!(await verifyScopeOwnership(companyId, id))) {
      return res.status(404).json({ message: "Scope not found" });
    }

    const reorderSchema = z.object({
      items: z.array(z.object({
        id: z.string().min(1),
        sortOrder: z.number().int(),
      })),
    });
    const { items } = reorderSchema.parse(req.body);

    for (const item of items) {
      await db
        .update(scopeItems)
        .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
        .where(and(
          eq(scopeItems.id, item.id),
          eq(scopeItems.scopeId, id),
          eq(scopeItems.companyId, companyId)
        ));
    }

    res.json({ message: "Reorder complete", count: items.length });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error reordering scope items");
    res.status(500).json({ message: "Failed to reorder scope items" });
  }
});

export default router;
