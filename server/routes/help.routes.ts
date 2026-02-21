import { Router, Request, Response } from "express";
import { requireAuth, requireRole, requireSuperAdmin } from "./middleware/auth.middleware";
import { db } from "../db";
import { helpEntries, helpEntryVersions, helpFeedback } from "@shared/schema";
import { eq, and, or, ilike, sql, desc, asc } from "drizzle-orm";
import { z } from "zod";
import logger from "../lib/logger";

const helpFeedbackSchema = z.object({
  helpEntryId: z.string().nullable().optional(),
  helpKey: z.string().nullable().optional(),
  rating: z.coerce.number().nullable().optional(),
  comment: z.string().nullable().optional(),
  pageUrl: z.string().nullable().optional(),
});

const helpAdminSchema = z.object({
  key: z.string(),
  scope: z.string().optional(),
  title: z.string(),
  shortText: z.string().nullable().optional(),
  bodyMd: z.string().nullable().optional(),
  keywords: z.array(z.string()).optional(),
  category: z.string().nullable().optional(),
  pageRoute: z.string().nullable().optional(),
  roleVisibility: z.array(z.string()).optional(),
  status: z.string().optional(),
  rank: z.coerce.number().optional(),
});

const helpAdminUpdateSchema = helpAdminSchema.partial();

const router = Router();

router.get("/api/help", requireAuth, async (req: Request, res: Response) => {
  try {
    const { key } = req.query;
    if (!key || typeof key !== "string") {
      return res.status(400).json({ error: "key query parameter is required" });
    }
    const [entry] = await db
      .select()
      .from(helpEntries)
      .where(and(eq(helpEntries.key, key), eq(helpEntries.status, "PUBLISHED")));
    if (!entry) {
      return res.status(404).json({ error: "Help entry not found" });
    }
    res.json(entry);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching help entry");
    res.status(500).json({ error: "Failed to fetch help entry" });
  }
});

router.get("/api/help/search", requireAuth, async (req: Request, res: Response) => {
  try {
    const { query, category, scope, route, limit = "50" } = req.query as Record<string, string>;
    const conditions = [eq(helpEntries.status, "PUBLISHED")];

    if (category) {
      conditions.push(eq(helpEntries.category, category));
    }
    if (scope) {
      conditions.push(eq(helpEntries.scope, scope as any));
    }
    if (route) {
      conditions.push(eq(helpEntries.pageRoute, route));
    }

    let results;
    if (query && typeof query === "string" && query.trim()) {
      const searchTerm = `%${query.trim()}%`;
      const searchCondition = or(
        ilike(helpEntries.key, searchTerm),
        ilike(helpEntries.title, searchTerm),
        ilike(helpEntries.shortText, searchTerm),
        ilike(helpEntries.bodyMd, searchTerm),
        sql`${searchTerm} ILIKE ANY(${helpEntries.keywords})`
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    results = await db
      .select()
      .from(helpEntries)
      .where(and(...conditions))
      .orderBy(desc(helpEntries.rank), asc(helpEntries.title))
      .limit(Number(limit));

    res.json(results);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error searching help");
    res.status(500).json({ error: "Failed to search help entries" });
  }
});

router.get("/api/help/categories", requireAuth, async (_req: Request, res: Response) => {
  try {
    const cats = await db
      .selectDistinct({ category: helpEntries.category })
      .from(helpEntries)
      .where(and(eq(helpEntries.status, "PUBLISHED"), sql`${helpEntries.category} IS NOT NULL`))
      .orderBy(asc(helpEntries.category))
      .limit(1000);
    res.json(cats.map((c) => c.category).filter(Boolean));
  } catch (error: unknown) {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.get("/api/help/recent", requireAuth, async (_req: Request, res: Response) => {
  try {
    const recent = await db
      .select()
      .from(helpEntries)
      .where(eq(helpEntries.status, "PUBLISHED"))
      .orderBy(desc(helpEntries.updatedAt))
      .limit(10);
    res.json(recent);
  } catch (error: unknown) {
    res.status(500).json({ error: "Failed to fetch recent help" });
  }
});

router.post("/api/help/feedback", requireAuth, async (req: Request, res: Response) => {
  try {
    const result = helpFeedbackSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const { helpEntryId, helpKey, rating, comment, pageUrl } = result.data;
    const [feedback] = await db
      .insert(helpFeedback)
      .values({
        helpEntryId: helpEntryId || null,
        helpKey: helpKey || null,
        userId: req.session.userId || null,
        rating: rating || null,
        comment: comment || null,
        pageUrl: pageUrl || null,
      })
      .returning();
    res.json(feedback);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error saving help feedback");
    res.status(500).json({ error: "Failed to save feedback" });
  }
});

router.get("/api/help/admin/list", requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const all = await db
      .select()
      .from(helpEntries)
      .orderBy(asc(helpEntries.category), asc(helpEntries.key))
      .limit(1000);
    res.json(all);
  } catch (error: unknown) {
    res.status(500).json({ error: "Failed to list help entries" });
  }
});

router.post("/api/help/admin", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const result = helpAdminSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const { key, scope, title, shortText, bodyMd, keywords, category, pageRoute, roleVisibility, status, rank } = result.data;
    if (!key || !title) {
      return res.status(400).json({ error: "key and title are required" });
    }
    const [existing] = await db.select().from(helpEntries).where(eq(helpEntries.key, key));
    if (existing) {
      return res.status(409).json({ error: "Help entry with this key already exists" });
    }
    const [entry] = await db
      .insert(helpEntries)
      .values({
        key,
        scope: scope || "GENERAL",
        title,
        shortText: shortText || null,
        bodyMd: bodyMd || null,
        keywords: keywords || [],
        category: category || null,
        pageRoute: pageRoute || null,
        roleVisibility: roleVisibility || [],
        status: status || "PUBLISHED",
        rank: rank || 0,
        createdBy: req.session.userId || null,
        updatedBy: req.session.userId || null,
      } as Record<string, unknown>)
      .returning();
    res.json(entry);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating help entry");
    res.status(500).json({ error: "Failed to create help entry" });
  }
});

router.put("/api/help/admin/:id", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const [existing] = await db.select().from(helpEntries).where(eq(helpEntries.id, id));
    if (!existing) {
      return res.status(404).json({ error: "Help entry not found" });
    }

    await db.insert(helpEntryVersions).values({
      helpEntryId: existing.id,
      key: existing.key,
      version: existing.version,
      snapshot: existing as Record<string, unknown>,
      createdBy: req.session.userId || null,
    });

    const updateResult = helpAdminUpdateSchema.safeParse(req.body);
    if (!updateResult.success) {
      return res.status(400).json({ error: updateResult.error.format() });
    }
    const { key, scope, title, shortText, bodyMd, keywords, category, pageRoute, roleVisibility, status, rank } = updateResult.data;
    const [updated] = await db
      .update(helpEntries)
      .set({
        key: key ?? existing.key,
        scope: scope ?? existing.scope,
        title: title ?? existing.title,
        shortText: shortText !== undefined ? shortText : existing.shortText,
        bodyMd: bodyMd !== undefined ? bodyMd : existing.bodyMd,
        keywords: keywords ?? existing.keywords,
        category: category !== undefined ? category : existing.category,
        pageRoute: pageRoute !== undefined ? pageRoute : existing.pageRoute,
        roleVisibility: roleVisibility ?? existing.roleVisibility,
        status: status ?? existing.status,
        rank: rank ?? existing.rank,
        version: existing.version + 1,
        updatedBy: req.session.userId || null,
        updatedAt: new Date(),
      } as Record<string, unknown>)
      .where(eq(helpEntries.id, id))
      .returning();
    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating help entry");
    res.status(500).json({ error: "Failed to update help entry" });
  }
});

router.delete("/api/help/admin/:id", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const [updated] = await db
      .update(helpEntries)
      .set({ status: "ARCHIVED", updatedBy: req.session.userId || null, updatedAt: new Date() } as Record<string, unknown>)
      .where(eq(helpEntries.id, id))
      .returning();
    if (!updated) {
      return res.status(404).json({ error: "Help entry not found" });
    }
    res.json(updated);
  } catch (error: unknown) {
    res.status(500).json({ error: "Failed to archive help entry" });
  }
});

router.get("/api/help/admin/:id/versions", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const versions = await db
      .select()
      .from(helpEntryVersions)
      .where(eq(helpEntryVersions.helpEntryId, id))
      .orderBy(desc(helpEntryVersions.version))
      .limit(1000);
    res.json(versions);
  } catch (error: unknown) {
    res.status(500).json({ error: "Failed to fetch versions" });
  }
});

export const helpRouter = router;
