import { Router, Request, Response } from "express";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { db } from "../db";
import { helpEntries, helpEntryVersions, helpFeedback } from "@shared/schema";
import { eq, and, or, ilike, sql, desc, asc } from "drizzle-orm";
import { z } from "zod";

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
  } catch (error: any) {
    console.error("Error fetching help entry:", error);
    res.status(500).json({ error: "Failed to fetch help entry" });
  }
});

router.get("/api/help/search", requireAuth, async (req: Request, res: Response) => {
  try {
    const { query, category, scope, route, limit = "50" } = req.query as Record<string, string>;
    const conditions: any[] = [eq(helpEntries.status, "PUBLISHED")];

    if (category) {
      conditions.push(eq(helpEntries.category, category));
    }
    if (scope) {
      conditions.push(eq(helpEntries.scope, scope));
    }
    if (route) {
      conditions.push(eq(helpEntries.pageRoute, route));
    }

    let results;
    if (query && typeof query === "string" && query.trim()) {
      const searchTerm = `%${query.trim()}%`;
      conditions.push(
        or(
          ilike(helpEntries.key, searchTerm),
          ilike(helpEntries.title, searchTerm),
          ilike(helpEntries.shortText, searchTerm),
          ilike(helpEntries.bodyMd, searchTerm),
          sql`${searchTerm} ILIKE ANY(${helpEntries.keywords})`
        )
      );
    }

    results = await db
      .select()
      .from(helpEntries)
      .where(and(...conditions))
      .orderBy(desc(helpEntries.rank), asc(helpEntries.title))
      .limit(Number(limit));

    res.json(results);
  } catch (error: any) {
    console.error("Error searching help:", error);
    res.status(500).json({ error: "Failed to search help entries" });
  }
});

router.get("/api/help/categories", requireAuth, async (_req: Request, res: Response) => {
  try {
    const cats = await db
      .selectDistinct({ category: helpEntries.category })
      .from(helpEntries)
      .where(and(eq(helpEntries.status, "PUBLISHED"), sql`${helpEntries.category} IS NOT NULL`))
      .orderBy(asc(helpEntries.category));
    res.json(cats.map((c) => c.category).filter(Boolean));
  } catch (error: any) {
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
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch recent help" });
  }
});

router.post("/api/help/feedback", requireAuth, async (req: Request, res: Response) => {
  try {
    const { helpEntryId, helpKey, rating, comment, pageUrl } = req.body;
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
  } catch (error: any) {
    console.error("Error saving help feedback:", error);
    res.status(500).json({ error: "Failed to save feedback" });
  }
});

router.get("/api/help/admin/list", requireAuth, requireRole("ADMIN"), async (_req: Request, res: Response) => {
  try {
    const all = await db
      .select()
      .from(helpEntries)
      .orderBy(asc(helpEntries.category), asc(helpEntries.key));
    res.json(all);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list help entries" });
  }
});

router.post("/api/help/admin", requireAuth, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const { key, scope, title, shortText, bodyMd, keywords, category, pageRoute, roleVisibility, status, rank } = req.body;
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
      })
      .returning();
    res.json(entry);
  } catch (error: any) {
    console.error("Error creating help entry:", error);
    res.status(500).json({ error: "Failed to create help entry" });
  }
});

router.put("/api/help/admin/:id", requireAuth, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [existing] = await db.select().from(helpEntries).where(eq(helpEntries.id, id));
    if (!existing) {
      return res.status(404).json({ error: "Help entry not found" });
    }

    await db.insert(helpEntryVersions).values({
      helpEntryId: existing.id,
      key: existing.key,
      version: existing.version,
      snapshot: existing as any,
      createdBy: req.session.userId || null,
    });

    const { key, scope, title, shortText, bodyMd, keywords, category, pageRoute, roleVisibility, status, rank } = req.body;
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
      })
      .where(eq(helpEntries.id, id))
      .returning();
    res.json(updated);
  } catch (error: any) {
    console.error("Error updating help entry:", error);
    res.status(500).json({ error: "Failed to update help entry" });
  }
});

router.delete("/api/help/admin/:id", requireAuth, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [updated] = await db
      .update(helpEntries)
      .set({ status: "ARCHIVED", updatedBy: req.session.userId || null, updatedAt: new Date() })
      .where(eq(helpEntries.id, id))
      .returning();
    if (!updated) {
      return res.status(404).json({ error: "Help entry not found" });
    }
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to archive help entry" });
  }
});

router.get("/api/help/admin/:id/versions", requireAuth, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const versions = await db
      .select()
      .from(helpEntryVersions)
      .where(eq(helpEntryVersions.helpEntryId, id))
      .orderBy(desc(helpEntryVersions.version));
    res.json(versions);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch versions" });
  }
});

export const helpRouter = router;
