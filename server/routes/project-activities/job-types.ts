import { Router } from "express";
import { z } from "zod";
import { eq, and, asc, count } from "drizzle-orm";
import { db } from "../../db";
import { jobTypes, activityTemplates } from "@shared/schema";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import logger from "../../lib/logger";

const router = Router();

router.get("/api/job-types", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const safeLimit = Math.min(parseInt(req.query.limit as string) || 200, 200);
    const result = await db.select().from(jobTypes)
      .where(eq(jobTypes.companyId, companyId!))
      .orderBy(asc(jobTypes.sortOrder), asc(jobTypes.name))
      .limit(safeLimit);

    const templateCounts = await db
      .select({ jobTypeId: activityTemplates.jobTypeId, count: count() })
      .from(activityTemplates)
      .where(eq(activityTemplates.companyId, companyId!))
      .groupBy(activityTemplates.jobTypeId);

    const countMap = new Map(templateCounts.map(tc => [tc.jobTypeId, tc.count]));
    const resultWithCounts = result.map(jt => ({
      ...jt,
      activityCount: countMap.get(jt.id) || 0,
    }));

    res.json(resultWithCounts);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching job types");
    res.status(500).json({ error: "Failed to fetch job types" });
  }
});

router.get("/api/job-types/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const id = req.params.id as string;
    const [result] = await db.select().from(jobTypes)
      .where(and(eq(jobTypes.id, id), eq(jobTypes.companyId, companyId!)))
      .limit(1);
    if (!result) return res.status(404).json({ error: "Job type not found" });
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching job type");
    res.status(500).json({ error: "Failed to fetch job type" });
  }
});

const jobTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

router.post("/api/job-types", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const parsed = jobTypeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

    const [result] = await db.insert(jobTypes).values({
      ...parsed.data,
      companyId: companyId!,
    }).returning();
    res.status(201).json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating job type");
    res.status(500).json({ error: "Failed to create job type" });
  }
});

router.patch("/api/job-types/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const id = req.params.id as string;
    const parsed = jobTypeSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

    const [existing] = await db.select().from(jobTypes)
      .where(and(eq(jobTypes.id, id), eq(jobTypes.companyId, companyId!)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Job type not found" });

    const [result] = await db.update(jobTypes)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(jobTypes.id, id))
      .returning();
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating job type");
    res.status(500).json({ error: "Failed to update job type" });
  }
});

router.delete("/api/job-types/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const id = req.params.id as string;
    const [existing] = await db.select().from(jobTypes)
      .where(and(eq(jobTypes.id, id), eq(jobTypes.companyId, companyId!)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Job type not found" });

    await db.delete(jobTypes).where(eq(jobTypes.id, id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting job type");
    res.status(500).json({ error: "Failed to delete job type" });
  }
});

export default router;
