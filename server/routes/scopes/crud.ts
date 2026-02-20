import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { db } from "../../db";
import { scopes, scopeItems, scopeTrades, jobTypes, users } from "@shared/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { isValidId, scopeSchema, verifyScopeOwnership, verifyTradeOwnership } from "./shared";

const router = Router();

router.get("/api/scopes", requireAuth, requirePermission("scopes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { tradeId, jobTypeId, status, search, isTemplate } = req.query;

    let conditions = [eq(scopes.companyId, companyId)];

    if (tradeId && typeof tradeId === "string") {
      conditions.push(eq(scopes.tradeId, tradeId));
    }
    if (jobTypeId && typeof jobTypeId === "string") {
      conditions.push(eq(scopes.jobTypeId, jobTypeId));
    }
    if (status && typeof status === "string") {
      conditions.push(eq(scopes.status, status as any));
    }
    if (isTemplate === "true") {
      conditions.push(eq(scopes.isTemplate, true));
    } else if (isTemplate === "false") {
      conditions.push(eq(scopes.isTemplate, false));
    }

    const itemCountSubquery = db
      .select({
        scopeId: scopeItems.scopeId,
        count: sql<number>`count(*)::int`.as("item_count"),
      })
      .from(scopeItems)
      .groupBy(scopeItems.scopeId)
      .as("item_counts");

    let results = await db
      .select({
        scope: scopes,
        trade: {
          id: scopeTrades.id,
          name: scopeTrades.name,
        },
        jobType: {
          id: jobTypes.id,
          name: jobTypes.name,
        },
        createdBy: {
          id: users.id,
          name: users.name,
        },
        itemCount: sql<number>`coalesce(${itemCountSubquery.count}, 0)`.as("itemCount"),
      })
      .from(scopes)
      .leftJoin(scopeTrades, eq(scopes.tradeId, scopeTrades.id))
      .leftJoin(jobTypes, eq(scopes.jobTypeId, jobTypes.id))
      .leftJoin(users, eq(scopes.createdById, users.id))
      .leftJoin(itemCountSubquery, eq(scopes.id, itemCountSubquery.scopeId))
      .where(and(...conditions))
      .orderBy(desc(scopes.updatedAt))
      .limit(1000);

    if (search && typeof search === "string" && search.trim()) {
      const s = search.trim().toLowerCase();
      results = results.filter(
        (r) =>
          r.scope.name.toLowerCase().includes(s) ||
          (r.scope.description && r.scope.description.toLowerCase().includes(s)) ||
          (r.trade?.name && r.trade.name.toLowerCase().includes(s))
      );
    }

    const mapped = results.map((row) => ({
      ...row.scope,
      trade: row.trade,
      jobType: row.jobType,
      createdBy: row.createdBy,
      itemCount: row.itemCount,
    }));

    res.json(mapped);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching scopes");
    res.status(500).json({ message: "Failed to fetch scopes" });
  }
});

router.get("/api/scopes/stats", requireAuth, requirePermission("scopes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;

    const [totalResult] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(scopes)
      .where(eq(scopes.companyId, companyId))
      .limit(1);

    const byStatus = await db
      .select({
        status: scopes.status,
        count: sql<number>`count(*)::int`,
      })
      .from(scopes)
      .where(eq(scopes.companyId, companyId))
      .groupBy(scopes.status);

    const byTrade = await db
      .select({
        tradeId: scopeTrades.id,
        tradeName: scopeTrades.name,
        count: sql<number>`count(${scopes.id})::int`,
      })
      .from(scopes)
      .innerJoin(scopeTrades, eq(scopes.tradeId, scopeTrades.id))
      .where(eq(scopes.companyId, companyId))
      .groupBy(scopeTrades.id, scopeTrades.name)
      .orderBy(desc(sql`count(${scopes.id})`));

    const byJobType = await db
      .select({
        jobTypeId: jobTypes.id,
        jobTypeName: jobTypes.name,
        count: sql<number>`count(${scopes.id})::int`,
      })
      .from(scopes)
      .innerJoin(jobTypes, eq(scopes.jobTypeId, jobTypes.id))
      .where(eq(scopes.companyId, companyId))
      .groupBy(jobTypes.id, jobTypes.name)
      .orderBy(desc(sql`count(${scopes.id})`));

    res.json({
      total: totalResult?.total || 0,
      byStatus: byStatus.reduce((acc, r) => ({ ...acc, [r.status]: r.count }), {} as Record<string, number>),
      byTrade,
      byJobType,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching scope stats");
    res.status(500).json({ message: "Failed to fetch scope stats" });
  }
});

router.get("/api/scopes/:id", requireAuth, requirePermission("scopes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid ID format" });

    const [result] = await db
      .select({
        scope: scopes,
        trade: {
          id: scopeTrades.id,
          name: scopeTrades.name,
        },
        jobType: {
          id: jobTypes.id,
          name: jobTypes.name,
        },
        createdBy: {
          id: users.id,
          name: users.name,
        },
      })
      .from(scopes)
      .leftJoin(scopeTrades, eq(scopes.tradeId, scopeTrades.id))
      .leftJoin(jobTypes, eq(scopes.jobTypeId, jobTypes.id))
      .leftJoin(users, eq(scopes.createdById, users.id))
      .where(and(eq(scopes.id, id), eq(scopes.companyId, companyId)))
      .limit(1);

    if (!result) return res.status(404).json({ message: "Scope not found" });

    const items = await db
      .select()
      .from(scopeItems)
      .where(and(eq(scopeItems.scopeId, id), eq(scopeItems.companyId, companyId)))
      .orderBy(asc(scopeItems.sortOrder), asc(scopeItems.createdAt))
      .limit(1000);

    res.json({
      ...result.scope,
      trade: result.trade,
      jobType: result.jobType,
      createdBy: result.createdBy,
      items,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching scope");
    res.status(500).json({ message: "Failed to fetch scope" });
  }
});

router.post("/api/scopes", requireAuth, requirePermission("scopes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;
    const data = scopeSchema.parse(req.body);

    if (!(await verifyTradeOwnership(companyId, data.tradeId))) {
      return res.status(400).json({ message: "Trade not found" });
    }

    const [result] = await db
      .insert(scopes)
      .values({
        companyId,
        tradeId: data.tradeId,
        jobTypeId: data.jobTypeId || null,
        name: data.name,
        description: data.description || null,
        status: data.status || "DRAFT",
        source: data.source || "CUSTOM",
        isTemplate: data.isTemplate ?? false,
        createdById: userId,
        updatedById: userId,
      })
      .returning();

    res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error creating scope");
    res.status(500).json({ message: "Failed to create scope" });
  }
});

router.put("/api/scopes/:id", requireAuth, requirePermission("scopes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;
    const id = req.params.id as string;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid ID format" });
    const data = scopeSchema.partial().parse(req.body);

    const updateData: Record<string, unknown> = { updatedAt: new Date(), updatedById: userId };
    if (data.tradeId !== undefined) updateData.tradeId = data.tradeId;
    if (data.jobTypeId !== undefined) updateData.jobTypeId = data.jobTypeId || null;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.source !== undefined) updateData.source = data.source;
    if (data.isTemplate !== undefined) updateData.isTemplate = data.isTemplate;

    const [result] = await db
      .update(scopes)
      .set(updateData)
      .where(and(eq(scopes.id, id), eq(scopes.companyId, companyId)))
      .returning();

    if (!result) return res.status(404).json({ message: "Scope not found" });
    res.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error updating scope");
    res.status(500).json({ message: "Failed to update scope" });
  }
});

router.delete("/api/scopes/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid ID format" });

    const [deleted] = await db
      .delete(scopes)
      .where(and(eq(scopes.id, id), eq(scopes.companyId, companyId)))
      .returning();

    if (!deleted) return res.status(404).json({ message: "Scope not found" });
    res.json({ message: "Scope deleted", id: deleted.id });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting scope");
    res.status(500).json({ message: "Failed to delete scope" });
  }
});

router.post("/api/scopes/:id/duplicate", requireAuth, requirePermission("scopes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;
    const id = req.params.id as string;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid ID format" });

    const [original] = await db
      .select()
      .from(scopes)
      .where(and(eq(scopes.id, id), eq(scopes.companyId, companyId)))
      .limit(1);

    if (!original) return res.status(404).json({ message: "Scope not found" });

    const originalItems = await db
      .select()
      .from(scopeItems)
      .where(and(eq(scopeItems.scopeId, id), eq(scopeItems.companyId, companyId)))
      .orderBy(asc(scopeItems.sortOrder))
      .limit(1000);

    const newName = req.body.name || `${original.name} (Copy)`;

    const result = await db.transaction(async (tx) => {
      const [newScope] = await tx
        .insert(scopes)
        .values({
          companyId,
          tradeId: original.tradeId,
          jobTypeId: original.jobTypeId,
          name: newName,
          description: original.description,
          status: "DRAFT",
          source: original.source,
          isTemplate: original.isTemplate,
          createdById: userId,
          updatedById: userId,
        })
        .returning();

      if (originalItems.length > 0) {
        await tx.insert(scopeItems).values(
          originalItems.map((item) => ({
            scopeId: newScope.id,
            companyId,
            category: item.category,
            description: item.description,
            details: item.details,
            status: item.status,
            isCustom: item.isCustom,
            sortOrder: item.sortOrder,
          }))
        );
      }

      return newScope;
    });

    res.status(201).json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error duplicating scope");
    res.status(500).json({ message: "Failed to duplicate scope" });
  }
});

router.put("/api/scopes/:id/status", requireAuth, requirePermission("scopes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;
    const id = req.params.id as string;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid ID format" });

    const statusSchema = z.object({ status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]) });
    const { status } = statusSchema.parse(req.body);

    const [result] = await db
      .update(scopes)
      .set({ status, updatedAt: new Date(), updatedById: userId })
      .where(and(eq(scopes.id, id), eq(scopes.companyId, companyId)))
      .returning();

    if (!result) return res.status(404).json({ message: "Scope not found" });
    res.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error updating scope status");
    res.status(500).json({ message: "Failed to update scope status" });
  }
});

export default router;
