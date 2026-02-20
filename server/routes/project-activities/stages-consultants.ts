import { Router } from "express";
import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { db } from "../../db";
import { activityStages, activityConsultants } from "@shared/schema";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import logger from "../../lib/logger";

const router = Router();

router.get("/api/activity-stages", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const safeLimit = Math.min(parseInt(req.query.limit as string) || 200, 200);
    const result = await db.select().from(activityStages)
      .where(eq(activityStages.companyId, companyId!))
      .orderBy(asc(activityStages.sortOrder), asc(activityStages.stageNumber))
      .limit(safeLimit);
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching activity stages");
    res.status(500).json({ error: "Failed to fetch activity stages" });
  }
});

const stageSchema = z.object({
  stageNumber: z.number().int().min(1),
  name: z.string().min(1),
  sortOrder: z.number().int().optional(),
});

router.post("/api/activity-stages", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const parsed = stageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

    const [result] = await db.insert(activityStages).values({
      ...parsed.data,
      companyId: companyId!,
    }).returning();
    res.status(201).json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating stage");
    res.status(500).json({ error: "Failed to create stage" });
  }
});

router.patch("/api/activity-stages/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const id = req.params.id as string;
    const parsed = stageSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

    const [existing] = await db.select().from(activityStages)
      .where(and(eq(activityStages.id, id), eq(activityStages.companyId, companyId!)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Stage not found" });

    const [result] = await db.update(activityStages)
      .set(parsed.data)
      .where(eq(activityStages.id, id))
      .returning();
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating stage");
    res.status(500).json({ error: "Failed to update stage" });
  }
});

router.delete("/api/activity-stages/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const id = req.params.id as string;
    const [existing] = await db.select().from(activityStages)
      .where(and(eq(activityStages.id, id), eq(activityStages.companyId, companyId!)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Stage not found" });

    await db.delete(activityStages).where(eq(activityStages.id, id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting stage");
    res.status(500).json({ error: "Failed to delete stage" });
  }
});

router.get("/api/activity-consultants", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const safeLimit = Math.min(parseInt(req.query.limit as string) || 200, 200);
    const result = await db.select().from(activityConsultants)
      .where(eq(activityConsultants.companyId, companyId!))
      .orderBy(asc(activityConsultants.sortOrder), asc(activityConsultants.name))
      .limit(safeLimit);
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching consultants");
    res.status(500).json({ error: "Failed to fetch consultants" });
  }
});

const consultantSchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int().optional(),
});

router.post("/api/activity-consultants", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const parsed = consultantSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

    const [result] = await db.insert(activityConsultants).values({
      ...parsed.data,
      companyId: companyId!,
    }).returning();
    res.status(201).json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating consultant");
    res.status(500).json({ error: "Failed to create consultant" });
  }
});

router.patch("/api/activity-consultants/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const id = req.params.id as string;
    const parsed = consultantSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

    const [existing] = await db.select().from(activityConsultants)
      .where(and(eq(activityConsultants.id, id), eq(activityConsultants.companyId, companyId!)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Consultant not found" });

    const [result] = await db.update(activityConsultants)
      .set(parsed.data)
      .where(eq(activityConsultants.id, id))
      .returning();
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating consultant");
    res.status(500).json({ error: "Failed to update consultant" });
  }
});

router.delete("/api/activity-consultants/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const id = req.params.id as string;
    const [existing] = await db.select().from(activityConsultants)
      .where(and(eq(activityConsultants.id, id), eq(activityConsultants.companyId, companyId!)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Consultant not found" });

    await db.delete(activityConsultants).where(eq(activityConsultants.id, id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting consultant");
    res.status(500).json({ error: "Failed to delete consultant" });
  }
});

export default router;
