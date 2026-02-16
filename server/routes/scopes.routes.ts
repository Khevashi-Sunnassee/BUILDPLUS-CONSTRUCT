import { Router, Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import ExcelJS from "exceljs";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import logger from "../lib/logger";
import { db } from "../db";
import { scopeTrades, scopes, scopeItems, tenderScopes, jobTypes, tenders, users, costCodes } from "@shared/schema";
import { eq, and, desc, asc, sql, ilike, or, inArray, count } from "drizzle-orm";
import OpenAI from "openai";
import { emailService } from "../services/email.service";
import { buildBrandedEmail } from "../lib/email-template";

const router = Router();
const openai = new OpenAI();

const SCOPE_IMPORT_TYPES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
];
const scopeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (SCOPE_IMPORT_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Only Excel (.xlsx) and CSV files are accepted.`));
    }
  },
});

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidId(id: string): boolean { return uuidRegex.test(id); }

const tradeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  costCodeId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const scopeSchema = z.object({
  tradeId: z.string().min(1, "Trade is required"),
  jobTypeId: z.string().nullable().optional(),
  name: z.string().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  source: z.enum(["TEMPLATE", "AI_GENERATED", "CUSTOM", "IMPORTED"]).optional(),
  isTemplate: z.boolean().optional(),
});

const scopeItemSchema = z.object({
  category: z.string().nullable().optional(),
  description: z.string().min(1, "Description is required"),
  details: z.string().nullable().optional(),
  status: z.enum(["INCLUDED", "EXCLUDED", "NA"]).optional(),
  isCustom: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const DEFAULT_TRADES = [
  "Painting", "Plastering", "Waterproofing", "Tiling", "Concrete Structure",
  "Steelwork", "Electrical", "Plumbing", "HVAC", "Carpentry",
  "Demolition", "Earthworks", "Landscaping", "Glazing", "Roofing",
  "Fire Protection", "Insulation", "Flooring", "Cladding", "Scaffolding",
];

async function verifyScopeOwnership(companyId: string, scopeId: string) {
  const [s] = await db.select({ id: scopes.id }).from(scopes).where(and(eq(scopes.id, scopeId), eq(scopes.companyId, companyId)));
  return !!s;
}

async function verifyTradeOwnership(companyId: string, tradeId: string) {
  const [t] = await db.select({ id: scopeTrades.id }).from(scopeTrades).where(and(eq(scopeTrades.id, tradeId), eq(scopeTrades.companyId, companyId)));
  return !!t;
}

// ============ TRADE MANAGEMENT ============

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

// ============ SCOPE MANAGEMENT ============

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
      .where(eq(scopes.companyId, companyId));

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
      .where(and(eq(scopes.id, id), eq(scopes.companyId, companyId)));

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
      .where(and(eq(scopes.id, id), eq(scopes.companyId, companyId)));

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

// ============ SCOPE ITEMS ============

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

// ============ AI GENERATION ============

router.post("/api/scopes/ai-generate", requireAuth, requirePermission("scopes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const aiSchema = z.object({
      tradeName: z.string().min(1, "Trade name is required"),
      jobType: z.string().min(1, "Job type is required"),
      projectDescription: z.string().optional(),
    });
    const { tradeName, jobType, projectDescription } = aiSchema.parse(req.body);

    const prompt = `You are an expert construction scope of works consultant in Australia. Generate an extremely detailed and comprehensive scope of works for the following:

Trade: ${tradeName}
Job Type: ${jobType}
${projectDescription ? `Project Description: ${projectDescription}` : ""}

Generate 40-80 highly detailed scope items organized by category. Each item must be specific, measurable, and industry-standard.

Categories MUST include:
1. GENERAL REQUIREMENTS - Insurance, site access, safety plans, inductions, compliance
2. SITE ESTABLISHMENT - Temporary facilities, storage, site offices, amenities
3. MATERIALS AND SPECIFICATIONS - All materials, grades, standards (Australian Standards AS/NZS), tolerances
4. LABOR AND WORKMANSHIP - Qualifications, licensing, supervision ratios, work standards
5. METHODOLOGY AND SEQUENCING - Work procedures, hold points, inspection stages
6. QUALITY ASSURANCE AND TESTING - QA plans, testing requirements, documentation, certifications
7. PROTECTION OF EXISTING WORK - Protection methods, damage rectification, adjacent works
8. ENVIRONMENTAL AND WASTE - Waste management, disposal, recycling, environmental controls
9. HEALTH AND SAFETY - WHS requirements, SWMS, PPE, emergency procedures
10. WARRANTIES AND DEFECTS LIABILITY - Defects liability period, warranty terms, rectification obligations
11. EXCLUSIONS AND LIMITATIONS - What is explicitly excluded from this scope
12. HANDOVER AND COMPLETION - As-built documentation, cleaning, commissioning, handover requirements

Return a JSON array of objects with exactly these fields:
- "category": The category name (from above list)
- "description": A concise but complete description of the scope item (1-2 sentences)
- "details": Additional technical details, specifications, standards references, or clarifications (2-4 sentences)

Make items EXTREMELY specific to ${tradeName} work. Reference relevant Australian Standards, NCC/BCA requirements, and industry best practices.

Return ONLY the JSON array, no other text.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 8000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(500).json({ message: "Failed to parse AI response" });
    }

    const items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.scope_items || parsed.scopeItems || Object.values(parsed)[0]);

    if (!Array.isArray(items)) {
      return res.status(500).json({ message: "AI response did not contain a valid items array" });
    }

    const validItems = items
      .filter((item: any) => item.description && typeof item.description === "string")
      .map((item: any) => ({
        category: item.category || "General",
        description: item.description,
        details: item.details || null,
      }));

    res.json({ items: validItems, count: validItems.length });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error generating AI scope");
    res.status(500).json({ message: "Failed to generate scope items with AI" });
  }
});

router.post("/api/scopes/ai-create", requireAuth, requirePermission("scopes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;

    const schema = z.object({
      name: z.string().min(1, "Name is required"),
      tradeId: z.string().min(1, "Trade is required"),
      jobTypeId: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
    });
    const data = schema.parse(req.body);

    if (!(await verifyTradeOwnership(companyId, data.tradeId))) {
      return res.status(400).json({ message: "Invalid trade" });
    }

    const [trade] = await db.select({ name: scopeTrades.name }).from(scopeTrades).where(eq(scopeTrades.id, data.tradeId));
    let jobTypeName: string | undefined;
    if (data.jobTypeId) {
      const [jt] = await db.select({ id: jobTypes.id, name: jobTypes.name }).from(jobTypes).where(and(eq(jobTypes.id, data.jobTypeId), eq(jobTypes.companyId, companyId)));
      if (!jt) return res.status(400).json({ message: "Invalid job type" });
      jobTypeName = jt.name;
    }

    const prompt = `You are an expert construction scope of works consultant in Australia. Generate an extremely detailed and comprehensive scope of works for the following:

Trade: ${trade.name}
${jobTypeName ? `Job Type: ${jobTypeName}` : ""}
${data.description ? `Project Description: ${data.description}` : ""}

Generate 40-80 highly detailed scope items organized by category. Each item must be specific, measurable, and industry-standard.

Categories MUST include:
1. GENERAL REQUIREMENTS - Insurance, site access, safety plans, inductions, compliance
2. SITE ESTABLISHMENT - Temporary facilities, storage, site offices, amenities
3. MATERIALS AND SPECIFICATIONS - All materials, grades, standards (Australian Standards AS/NZS), tolerances
4. LABOR AND WORKMANSHIP - Qualifications, licensing, supervision ratios, work standards
5. METHODOLOGY AND SEQUENCING - Work procedures, hold points, inspection stages
6. QUALITY ASSURANCE AND TESTING - QA plans, testing requirements, documentation, certifications
7. PROTECTION OF EXISTING WORK - Protection methods, damage rectification, adjacent works
8. ENVIRONMENTAL AND WASTE - Waste management, disposal, recycling, environmental controls
9. HEALTH AND SAFETY - WHS requirements, SWMS, PPE, emergency procedures
10. WARRANTIES AND DEFECTS LIABILITY - Defects liability period, warranty terms, rectification obligations
11. EXCLUSIONS AND LIMITATIONS - What is explicitly excluded from this scope
12. HANDOVER AND COMPLETION - As-built documentation, cleaning, commissioning, handover requirements

Return a JSON object with an "items" key containing an array of objects with exactly these fields:
- "category": The category name (from above list)
- "description": A concise but complete description of the scope item (1-2 sentences)
- "details": Additional technical details, specifications, standards references, or clarifications (2-4 sentences)
- "status": Always "INCLUDED"

Make items EXTREMELY specific to ${trade.name} work. Reference relevant Australian Standards, NCC/BCA requirements, and industry best practices.
Include trade-specific items covering: preparation, execution, inspection, documentation, and completion stages.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 8000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(500).json({ message: "Failed to parse AI response" });
    }

    const rawItems = Array.isArray(parsed) ? parsed : (parsed.items || parsed.scope_items || parsed.scopeItems || Object.values(parsed)[0]);
    if (!Array.isArray(rawItems)) {
      return res.status(500).json({ message: "AI response did not contain valid items" });
    }

    const validItems = rawItems
      .filter((item: any) => item.description && typeof item.description === "string")
      .map((item: any, idx: number) => ({
        category: item.category || "General",
        description: item.description,
        details: item.details || null,
        status: "INCLUDED" as const,
        sortOrder: idx + 1,
      }));

    const [newScope] = await db.insert(scopes).values({
      companyId,
      name: data.name,
      tradeId: data.tradeId,
      jobTypeId: data.jobTypeId || null,
      description: data.description || null,
      status: "DRAFT",
      source: "AI_GENERATED",
      createdById: userId,
      updatedById: userId,
    }).returning();

    if (validItems.length > 0) {
      await db.insert(scopeItems).values(
        validItems.map((item: any) => ({
          companyId,
          scopeId: newScope.id,
          category: item.category,
          description: item.description,
          details: item.details,
          status: item.status,
          sortOrder: item.sortOrder,
        }))
      );
    }

    res.json({
      scope: newScope,
      items: validItems,
      count: validItems.length,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error creating AI scope");
    res.status(500).json({ message: "Failed to create scope with AI" });
  }
});

// ============ FILE IMPORT (UPLOAD & CREATE) ============

router.post("/api/scopes/import-parse", requireAuth, requirePermission("scopes", "VIEW_AND_UPDATE"), scopeUpload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const items: { category: string; description: string; details: string }[] = [];

    const workbook = new ExcelJS.Workbook();
    if (req.file.mimetype === "text/csv") {
      await workbook.csv.read(require("stream").Readable.from(req.file.buffer));
    } else {
      await workbook.xlsx.load(req.file.buffer);
    }

    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) {
      return res.status(400).json({ message: "File is empty or has no data rows" });
    }

    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      headers[colNum - 1] = String(cell.value || "").toLowerCase().trim();
    });

    const catIdx = headers.findIndex(h => h.includes("category") || h.includes("cat") || h.includes("section") || h.includes("group"));
    const descIdx = headers.findIndex(h => h.includes("description") || h.includes("desc") || h.includes("item") || h.includes("scope") || h.includes("text") || h.includes("title"));
    const detailIdx = headers.findIndex(h => h.includes("detail") || h.includes("note") || h.includes("spec") || h.includes("comment") || h.includes("info"));

    if (descIdx === -1) {
      const firstCol = headers[0] || "";
      if (!firstCol) {
        return res.status(400).json({ message: "Could not find a description column. Please ensure your file has a column header containing 'description', 'item', 'scope', or 'text'." });
      }
      for (let r = 2; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const cellVal = String(row.getCell(1).value || "").trim();
        if (!cellVal) continue;
        items.push({ category: "General", description: cellVal, details: "" });
      }
    } else {
      for (let r = 2; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const desc = String(row.getCell(descIdx + 1).value || "").trim();
        if (!desc) continue;
        items.push({
          category: catIdx >= 0 ? String(row.getCell(catIdx + 1).value || "General").trim() : "General",
          description: desc,
          details: detailIdx >= 0 ? String(row.getCell(detailIdx + 1).value || "").trim() : "",
        });
      }
    }

    if (items.length === 0) {
      return res.status(400).json({ message: "No scope items found in the file. Ensure the file has rows with content." });
    }

    res.json({ items, count: items.length, fileName: req.file.originalname });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error parsing scope import file");
    res.status(500).json({ message: "Failed to parse the uploaded file" });
  }
});

router.post("/api/scopes/import-create", requireAuth, requirePermission("scopes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;

    const schema = z.object({
      name: z.string().min(1, "Name is required"),
      tradeId: z.string().min(1, "Trade is required"),
      jobTypeId: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      aiFormat: z.boolean().default(false),
      items: z.array(z.object({
        category: z.string(),
        description: z.string().min(1),
        details: z.string().optional().default(""),
      })),
    });
    const data = schema.parse(req.body);

    if (!(await verifyTradeOwnership(companyId, data.tradeId))) {
      return res.status(400).json({ message: "Invalid trade" });
    }
    if (data.jobTypeId) {
      const [jt] = await db.select({ id: jobTypes.id }).from(jobTypes).where(and(eq(jobTypes.id, data.jobTypeId), eq(jobTypes.companyId, companyId)));
      if (!jt) return res.status(400).json({ message: "Invalid job type" });
    }

    let finalItems = data.items;

    if (data.aiFormat) {
      const [trade] = await db.select({ name: scopeTrades.name }).from(scopeTrades).where(eq(scopeTrades.id, data.tradeId));

      const rawItemsList = data.items.map((item, idx) =>
        `${idx + 1}. [${item.category}] ${item.description}${item.details ? ` - ${item.details}` : ""}`
      ).join("\n");

      const prompt = `You are an expert construction scope of works consultant in Australia. A user has imported the following scope items from a spreadsheet. Your job is to:

1. Clean up, reword, and standardize each item to be professional, clear, and industry-standard
2. Ensure proper categorization (fix incorrect categories, merge duplicates, split items that cover multiple concerns)
3. Add missing technical details, Australian Standards references, and specifications where appropriate
4. Ensure items are comprehensive - add any obvious missing items for the trade
5. Remove any items that are clearly not scope items (e.g., headers, totals, empty rows)
6. Organize by proper construction scope categories

Trade: ${trade?.name || "General"}
${data.description ? `Project Context: ${data.description}` : ""}

Raw imported items:
${rawItemsList}

Return a JSON object with an "items" key containing an array of objects with exactly these fields:
- "category": A proper construction scope category (e.g., "GENERAL REQUIREMENTS", "MATERIALS AND SPECIFICATIONS", "METHODOLOGY AND SEQUENCING", "QUALITY ASSURANCE AND TESTING", "HEALTH AND SAFETY", "WARRANTIES AND DEFECTS LIABILITY", "EXCLUSIONS AND LIMITATIONS", "HANDOVER AND COMPLETION", etc.)
- "description": A concise but complete description of the scope item (1-2 sentences, professional language)
- "details": Additional technical details, specifications, standards references, or clarifications (2-4 sentences)
- "status": Always "INCLUDED"

Maintain all original intent but improve quality, clarity, and completeness. Keep the total count similar (within +/- 20% of original) unless many items are clearly duplicates or not scope items.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5,
        max_tokens: 8000,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content || "{}";
      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        return res.status(500).json({ message: "AI failed to format the items. Please try again or import without AI formatting." });
      }

      const aiItems = Array.isArray(parsed) ? parsed : (parsed.items || parsed.scope_items || Object.values(parsed)[0]);
      if (Array.isArray(aiItems)) {
        finalItems = aiItems
          .filter((item: any) => item.description && typeof item.description === "string")
          .map((item: any) => ({
            category: item.category || "General",
            description: item.description,
            details: item.details || "",
          }));
      }
    }

    const result = await db.transaction(async (tx) => {
      const [newScope] = await tx.insert(scopes).values({
        companyId,
        name: data.name,
        tradeId: data.tradeId,
        jobTypeId: data.jobTypeId || null,
        description: data.description || null,
        status: "DRAFT",
        source: "IMPORTED",
        createdById: userId,
        updatedById: userId,
      }).returning();

      if (finalItems.length > 0) {
        await tx.insert(scopeItems).values(
          finalItems.map((item: any, idx: number) => ({
            companyId,
            scopeId: newScope.id,
            category: item.category || "General",
            description: item.description,
            details: item.details || null,
            status: "INCLUDED" as const,
            sortOrder: idx + 1,
          }))
        );
      }

      return newScope;
    });

    res.json({
      scope: result,
      items: finalItems,
      count: finalItems.length,
      aiFormatted: data.aiFormat,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error creating imported scope");
    res.status(500).json({ message: "Failed to create scope from import" });
  }
});

// ============ IMPORT / EXPORT (EXISTING SCOPE) ============

router.post("/api/scopes/:id/import", requireAuth, requirePermission("scopes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid ID format" });

    if (!(await verifyScopeOwnership(companyId, id))) {
      return res.status(404).json({ message: "Scope not found" });
    }

    const importSchema = z.object({
      items: z.array(z.object({
        category: z.string().nullable().optional(),
        description: z.string().min(1),
        details: z.string().nullable().optional(),
        status: z.enum(["INCLUDED", "EXCLUDED", "NA"]).optional(),
      })),
    });
    const { items } = importSchema.parse(req.body);

    const maxSort = await db
      .select({ max: sql<number>`coalesce(max(${scopeItems.sortOrder}), -1)` })
      .from(scopeItems)
      .where(and(eq(scopeItems.scopeId, id), eq(scopeItems.companyId, companyId)));

    let nextSort = (maxSort[0]?.max || 0) + 1;

    const inserted = await db.insert(scopeItems).values(
      items.map((item, idx) => ({
        scopeId: id,
        companyId,
        category: item.category || null,
        description: item.description,
        details: item.details || null,
        status: (item.status || "INCLUDED") as any,
        isCustom: false,
        sortOrder: nextSort + idx,
      }))
    ).returning();

    res.json({ message: "Import complete", imported: inserted.length });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error importing scope items");
    res.status(500).json({ message: "Failed to import scope items" });
  }
});

router.get("/api/scopes/:id/export", requireAuth, requirePermission("scopes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid ID format" });

    const [scope] = await db
      .select({
        scope: scopes,
        tradeName: scopeTrades.name,
        jobTypeName: jobTypes.name,
      })
      .from(scopes)
      .leftJoin(scopeTrades, eq(scopes.tradeId, scopeTrades.id))
      .leftJoin(jobTypes, eq(scopes.jobTypeId, jobTypes.id))
      .where(and(eq(scopes.id, id), eq(scopes.companyId, companyId)));

    if (!scope) return res.status(404).json({ message: "Scope not found" });

    const items = await db
      .select()
      .from(scopeItems)
      .where(and(eq(scopeItems.scopeId, id), eq(scopeItems.companyId, companyId)))
      .orderBy(asc(scopeItems.sortOrder))
      .limit(1000);

    res.json({
      name: scope.scope.name,
      description: scope.scope.description,
      trade: scope.tradeName,
      jobType: scope.jobTypeName,
      status: scope.scope.status,
      source: scope.scope.source,
      isTemplate: scope.scope.isTemplate,
      exportedAt: new Date().toISOString(),
      items: items.map((item) => ({
        category: item.category,
        description: item.description,
        details: item.details,
        status: item.status,
      })),
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error exporting scope");
    res.status(500).json({ message: "Failed to export scope" });
  }
});

// ============ TENDER INTEGRATION ============

router.get("/api/tenders/:tenderId/scopes", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const tenderId = req.params.tenderId as string;
    if (!isValidId(tenderId)) return res.status(400).json({ message: "Invalid ID format" });

    const results = await db
      .select({
        tenderScope: tenderScopes,
        scope: scopes,
        trade: {
          id: scopeTrades.id,
          name: scopeTrades.name,
          costCodeId: scopeTrades.costCodeId,
        },
      })
      .from(tenderScopes)
      .innerJoin(scopes, eq(tenderScopes.scopeId, scopes.id))
      .leftJoin(scopeTrades, eq(scopes.tradeId, scopeTrades.id))
      .where(and(eq(tenderScopes.tenderId, tenderId), eq(tenderScopes.companyId, companyId)))
      .orderBy(asc(tenderScopes.sortOrder))
      .limit(1000);

    const mapped = results.map((row) => ({
      ...row.tenderScope,
      scope: { ...row.scope, trade: row.trade },
    }));

    res.json(mapped);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching tender scopes");
    res.status(500).json({ message: "Failed to fetch tender scopes" });
  }
});

router.post("/api/tenders/:tenderId/scopes", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const tenderId = req.params.tenderId as string;
    if (!isValidId(tenderId)) return res.status(400).json({ message: "Invalid ID format" });

    const linkSchema = z.object({
      scopeId: z.string().min(1, "Scope ID is required"),
      sortOrder: z.number().int().optional(),
    });
    const data = linkSchema.parse(req.body);

    const [tender] = await db
      .select({ id: tenders.id })
      .from(tenders)
      .where(and(eq(tenders.id, tenderId), eq(tenders.companyId, companyId)));
    if (!tender) return res.status(404).json({ message: "Tender not found" });

    if (!(await verifyScopeOwnership(companyId, data.scopeId))) {
      return res.status(404).json({ message: "Scope not found" });
    }

    const [result] = await db
      .insert(tenderScopes)
      .values({
        companyId,
        tenderId,
        scopeId: data.scopeId,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();

    res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    if ((error as any)?.code === "23505") {
      return res.status(409).json({ message: "Scope is already linked to this tender" });
    }
    logger.error({ err: error }, "Error linking scope to tender");
    res.status(500).json({ message: "Failed to link scope to tender" });
  }
});

router.delete("/api/tenders/:tenderId/scopes/:scopeId", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const tenderId = req.params.tenderId as string;
    const scopeId = req.params.scopeId as string;
    if (!isValidId(tenderId) || !isValidId(scopeId)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const [deleted] = await db
      .delete(tenderScopes)
      .where(and(
        eq(tenderScopes.tenderId, tenderId),
        eq(tenderScopes.scopeId, scopeId),
        eq(tenderScopes.companyId, companyId)
      ))
      .returning();

    if (!deleted) return res.status(404).json({ message: "Tender-scope link not found" });
    res.json({ message: "Scope unlinked from tender", id: deleted.id });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error unlinking scope from tender");
    res.status(500).json({ message: "Failed to unlink scope from tender" });
  }
});

// ============ EMAIL / PRINT ============

router.post("/api/scopes/email", requireAuth, requirePermission("scopes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;

    const emailSchema = z.object({
      scopeIds: z.array(z.string()).min(1, "At least one scope ID is required"),
      recipientEmail: z.string().email("Valid email is required"),
    });
    const { scopeIds, recipientEmail } = emailSchema.parse(req.body);

    const scopeResults = await db
      .select({
        scope: scopes,
        tradeName: scopeTrades.name,
      })
      .from(scopes)
      .leftJoin(scopeTrades, eq(scopes.tradeId, scopeTrades.id))
      .where(and(
        inArray(scopes.id, scopeIds),
        eq(scopes.companyId, companyId)
      ))
      .limit(1000);

    if (scopeResults.length === 0) {
      return res.status(404).json({ message: "No scopes found" });
    }

    let scopeBodyHtml = "";

    for (const row of scopeResults) {
      const items = await db
        .select()
        .from(scopeItems)
        .where(and(eq(scopeItems.scopeId, row.scope.id), eq(scopeItems.companyId, companyId)))
        .orderBy(asc(scopeItems.sortOrder))
        .limit(1000);

      scopeBodyHtml += `
        <h3>${row.scope.name} - ${row.tradeName || "Unknown Trade"}</h3>
        <p>${row.scope.description || ""}</p>
        <p><strong>Status:</strong> ${row.scope.status}</p>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="text-align: left;">Category</th>
              <th style="text-align: left;">Description</th>
              <th style="text-align: left;">Details</th>
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item) => `
              <tr>
                <td>${item.category || "-"}</td>
                <td>${item.description}</td>
                <td>${item.details || "-"}</td>
                <td style="text-align: center;">${item.status}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }

    const htmlContent = await buildBrandedEmail({
      title: "Scope of Works",
      body: scopeBodyHtml,
      companyId,
    });

    await emailService.sendEmail(
      recipientEmail,
      `Scope of Works - ${scopeResults.map(r => r.scope.name).join(", ")}`,
      htmlContent,
    );

    res.json({ message: "Email sent successfully" });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error emailing scopes");
    res.status(500).json({ message: "Failed to send scope email" });
  }
});

router.get("/api/scopes/:id/print", requireAuth, requirePermission("scopes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid ID format" });

    const [scope] = await db
      .select({
        scope: scopes,
        tradeName: scopeTrades.name,
        jobTypeName: jobTypes.name,
        createdByName: users.name,
      })
      .from(scopes)
      .leftJoin(scopeTrades, eq(scopes.tradeId, scopeTrades.id))
      .leftJoin(jobTypes, eq(scopes.jobTypeId, jobTypes.id))
      .leftJoin(users, eq(scopes.createdById, users.id))
      .where(and(eq(scopes.id, id), eq(scopes.companyId, companyId)));

    if (!scope) return res.status(404).json({ message: "Scope not found" });

    const items = await db
      .select()
      .from(scopeItems)
      .where(and(eq(scopeItems.scopeId, id), eq(scopeItems.companyId, companyId)))
      .orderBy(asc(scopeItems.sortOrder))
      .limit(1000);

    const categories = new Map<string, typeof items>();
    for (const item of items) {
      const cat = item.category || "Uncategorized";
      if (!categories.has(cat)) categories.set(cat, []);
      categories.get(cat)!.push(item);
    }

    let categoriesHtml = "";
    for (const [category, catItems] of categories) {
      categoriesHtml += `
        <h3 style="margin-top: 20px; color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px;">${category}</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <thead>
            <tr style="background-color: #f9fafb;">
              <th style="text-align: left; padding: 8px; border: 1px solid #e5e7eb; width: 5%;">#</th>
              <th style="text-align: left; padding: 8px; border: 1px solid #e5e7eb; width: 40%;">Description</th>
              <th style="text-align: left; padding: 8px; border: 1px solid #e5e7eb; width: 40%;">Details</th>
              <th style="text-align: center; padding: 8px; border: 1px solid #e5e7eb; width: 15%;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${catItems.map((item, idx) => `
              <tr>
                <td style="padding: 6px 8px; border: 1px solid #e5e7eb;">${idx + 1}</td>
                <td style="padding: 6px 8px; border: 1px solid #e5e7eb;">${item.description}</td>
                <td style="padding: 6px 8px; border: 1px solid #e5e7eb; color: #6b7280; font-size: 0.9em;">${item.details || "-"}</td>
                <td style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: center;">
                  <span style="padding: 2px 8px; border-radius: 4px; font-size: 0.85em; background-color: ${item.status === "INCLUDED" ? "#dcfce7" : item.status === "EXCLUDED" ? "#fef2f2" : "#f3f4f6"}; color: ${item.status === "INCLUDED" ? "#166534" : item.status === "EXCLUDED" ? "#991b1b" : "#6b7280"};">
                    ${item.status}
                  </span>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Scope of Works - ${scope.scope.name}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; color: #1f2937; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div style="border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="margin: 0; color: #1f2937;">Scope of Works</h1>
    <h2 style="margin: 4px 0 0; color: #4b5563; font-weight: normal;">${scope.scope.name}</h2>
  </div>

  <table style="width: 100%; margin-bottom: 24px;">
    <tr>
      <td style="padding: 4px 0;"><strong>Trade:</strong> ${scope.tradeName || "-"}</td>
      <td style="padding: 4px 0;"><strong>Job Type:</strong> ${scope.jobTypeName || "-"}</td>
    </tr>
    <tr>
      <td style="padding: 4px 0;"><strong>Status:</strong> ${scope.scope.status}</td>
      <td style="padding: 4px 0;"><strong>Created By:</strong> ${scope.createdByName || "-"}</td>
    </tr>
    <tr>
      <td style="padding: 4px 0;"><strong>Source:</strong> ${scope.scope.source}</td>
      <td style="padding: 4px 0;"><strong>Template:</strong> ${scope.scope.isTemplate ? "Yes" : "No"}</td>
    </tr>
  </table>

  ${scope.scope.description ? `<p style="color: #4b5563; margin-bottom: 24px;">${scope.scope.description}</p>` : ""}

  <p style="color: #6b7280; font-size: 0.9em;">Total Items: ${items.length} | Included: ${items.filter(i => i.status === "INCLUDED").length} | Excluded: ${items.filter(i => i.status === "EXCLUDED").length} | N/A: ${items.filter(i => i.status === "NA").length}</p>

  ${categoriesHtml}

  <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 0.85em;">
    <p>Generated on ${new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric" })}</p>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error generating printable scope");
    res.status(500).json({ message: "Failed to generate printable scope" });
  }
});

export const scopesRouter = router;
