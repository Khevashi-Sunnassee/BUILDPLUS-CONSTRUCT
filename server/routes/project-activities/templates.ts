import { Router } from "express";
import { z } from "zod";
import { eq, and, asc, count, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  jobTypes, activityTemplates, activityTemplateSubtasks,
  activityTemplateChecklists,
} from "@shared/schema";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import logger from "../../lib/logger";

const router = Router();

router.get("/api/job-types/:jobTypeId/templates", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const jobTypeId = String(req.params.jobTypeId);

    const [jt] = await db.select().from(jobTypes)
      .where(and(eq(jobTypes.id, jobTypeId), eq(jobTypes.companyId, companyId!)))
      .limit(1);
    if (!jt) return res.status(404).json({ error: "Job type not found" });

    const templates = await db.select().from(activityTemplates)
      .where(and(eq(activityTemplates.jobTypeId, jobTypeId), eq(activityTemplates.companyId, companyId!)))
      .orderBy(asc(activityTemplates.sortOrder))
      .limit(500);

    const templateIds = templates.map(t => t.id);

    const [filteredSubtasks, filteredChecklists] = templateIds.length > 0
      ? await Promise.all([
          db.select().from(activityTemplateSubtasks)
            .where(inArray(activityTemplateSubtasks.templateId, templateIds))
            .orderBy(asc(activityTemplateSubtasks.sortOrder))
            .limit(500),
          db.select().from(activityTemplateChecklists)
            .where(inArray(activityTemplateChecklists.templateId, templateIds))
            .orderBy(asc(activityTemplateChecklists.sortOrder))
            .limit(500),
        ])
      : [[], []] as [typeof activityTemplateSubtasks.$inferSelect[], typeof activityTemplateChecklists.$inferSelect[]];

    const result = templates.map(t => ({
      ...t,
      subtasks: filteredSubtasks.filter(s => s.templateId === t.id),
      checklists: filteredChecklists.filter(c => c.templateId === t.id),
    }));

    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching templates");
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

const templateSchema = z.object({
  stageId: z.string().min(1),
  category: z.string().optional().nullable(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  estimatedDays: z.number().int().min(1).optional(),
  consultantId: z.string().optional().nullable(),
  consultantName: z.string().optional().nullable(),
  deliverable: z.string().optional().nullable(),
  jobPhase: z.string().optional().nullable(),
  predecessorSortOrder: z.number().int().optional().nullable(),
  relationship: z.enum(["FS", "SS", "FF", "SF"]).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

router.post("/api/job-types/:jobTypeId/templates", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const jobTypeId = String(req.params.jobTypeId);

    const [jt] = await db.select().from(jobTypes)
      .where(and(eq(jobTypes.id, jobTypeId), eq(jobTypes.companyId, companyId!)))
      .limit(1);
    if (!jt) return res.status(404).json({ error: "Job type not found" });

    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

    const [result] = await db.insert(activityTemplates).values({
      ...parsed.data,
      jobTypeId,
      companyId: companyId!,
    }).returning();
    res.status(201).json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating template");
    res.status(500).json({ error: "Failed to create template" });
  }
});

router.patch("/api/activity-templates/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const parsed = templateSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

    const [existing] = await db.select().from(activityTemplates)
      .where(and(eq(activityTemplates.id, String(req.params.id)), eq(activityTemplates.companyId, companyId!)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Template not found" });

    const [result] = await db.update(activityTemplates)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(activityTemplates.id, String(req.params.id)))
      .returning();
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating template");
    res.status(500).json({ error: "Failed to update template" });
  }
});

router.delete("/api/activity-templates/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const [existing] = await db.select().from(activityTemplates)
      .where(and(eq(activityTemplates.id, String(req.params.id)), eq(activityTemplates.companyId, companyId!)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Template not found" });

    await db.delete(activityTemplates).where(eq(activityTemplates.id, String(req.params.id)));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting template");
    res.status(500).json({ error: "Failed to delete template" });
  }
});

router.post("/api/job-types/:jobTypeId/templates/reorder", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const { templateIds } = req.body;
    if (!Array.isArray(templateIds)) return res.status(400).json({ error: "templateIds array required" });

    const jobTypeId = String(req.params.jobTypeId);
    const [jt] = await db.select().from(jobTypes)
      .where(and(eq(jobTypes.id, jobTypeId), eq(jobTypes.companyId, companyId!)))
      .limit(1);
    if (!jt) return res.status(404).json({ error: "Job type not found" });

    await db.transaction(async (tx) => {
      for (let i = 0; i < templateIds.length; i++) {
        await tx.update(activityTemplates)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(and(eq(activityTemplates.id, templateIds[i]), eq(activityTemplates.jobTypeId, jobTypeId)));
      }
    });
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error reordering templates");
    res.status(500).json({ error: "Failed to reorder templates" });
  }
});

router.get("/api/activity-templates/:templateId/subtasks", requireAuth, async (req, res) => {
  try {
    const safeLimit = Math.min(parseInt(req.query.limit as string) || 500, 500);
    const result = await db.select().from(activityTemplateSubtasks)
      .where(eq(activityTemplateSubtasks.templateId, String(req.params.templateId)))
      .orderBy(asc(activityTemplateSubtasks.sortOrder))
      .limit(safeLimit);
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching template subtasks");
    res.status(500).json({ error: "Failed to fetch subtasks" });
  }
});

const subtaskSchema = z.object({
  name: z.string().min(1),
  estimatedDays: z.number().int().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

router.post("/api/activity-templates/:templateId/subtasks", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const parsed = subtaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

    const [result] = await db.insert(activityTemplateSubtasks).values({
      ...parsed.data,
      templateId: String(req.params.templateId),
    }).returning();
    res.status(201).json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating subtask");
    res.status(500).json({ error: "Failed to create subtask" });
  }
});

router.patch("/api/activity-template-subtasks/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const parsed = subtaskSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

    const [result] = await db.update(activityTemplateSubtasks)
      .set(parsed.data)
      .where(eq(activityTemplateSubtasks.id, String(req.params.id)))
      .returning();
    if (!result) return res.status(404).json({ error: "Subtask not found" });
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating subtask");
    res.status(500).json({ error: "Failed to update subtask" });
  }
});

router.delete("/api/activity-template-subtasks/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    await db.delete(activityTemplateSubtasks).where(eq(activityTemplateSubtasks.id, String(req.params.id)));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting subtask");
    res.status(500).json({ error: "Failed to delete subtask" });
  }
});

const checklistSchema = z.object({
  name: z.string().min(1),
  estimatedDays: z.number().int().optional().default(1),
  sortOrder: z.number().int().optional(),
  checklistTemplateRefId: z.string().nullable().optional(),
});

router.get("/api/activity-templates/:templateId/checklists", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const templateId = String(req.params.templateId);
    const [tmpl] = await db.select({ id: activityTemplates.id }).from(activityTemplates)
      .where(and(eq(activityTemplates.id, templateId), eq(activityTemplates.companyId, companyId!)));
    if (!tmpl) return res.status(404).json({ error: "Template not found" });

    const safeLimit = Math.min(parseInt(req.query.limit as string) || 500, 500);
    const result = await db.select().from(activityTemplateChecklists)
      .where(eq(activityTemplateChecklists.templateId, templateId))
      .orderBy(asc(activityTemplateChecklists.sortOrder))
      .limit(safeLimit);
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching template checklists");
    res.status(500).json({ error: "Failed to fetch checklists" });
  }
});

router.post("/api/activity-templates/:templateId/checklists", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const templateId = String(req.params.templateId);
    const [tmpl] = await db.select({ id: activityTemplates.id }).from(activityTemplates)
      .where(and(eq(activityTemplates.id, templateId), eq(activityTemplates.companyId, companyId!)));
    if (!tmpl) return res.status(404).json({ error: "Template not found" });

    const parsed = checklistSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

    const existing = await db.select({ count: count() }).from(activityTemplateChecklists)
      .where(eq(activityTemplateChecklists.templateId, templateId));
    const nextOrder = (existing[0]?.count ?? 0);

    const [result] = await db.insert(activityTemplateChecklists).values({
      ...parsed.data,
      sortOrder: parsed.data.sortOrder ?? nextOrder,
      templateId,
    }).returning();
    res.status(201).json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating checklist item");
    res.status(500).json({ error: "Failed to create checklist item" });
  }
});

router.delete("/api/activity-template-checklists/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const [item] = await db.select({
      id: activityTemplateChecklists.id,
      templateId: activityTemplateChecklists.templateId,
    }).from(activityTemplateChecklists)
      .where(eq(activityTemplateChecklists.id, String(req.params.id)));
    if (!item) return res.status(404).json({ error: "Checklist item not found" });

    const [tmpl] = await db.select({ id: activityTemplates.id }).from(activityTemplates)
      .where(and(eq(activityTemplates.id, item.templateId), eq(activityTemplates.companyId, companyId!)));
    if (!tmpl) return res.status(404).json({ error: "Not authorized" });

    await db.delete(activityTemplateChecklists).where(eq(activityTemplateChecklists.id, String(req.params.id)));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting checklist item");
    res.status(500).json({ error: "Failed to delete checklist item" });
  }
});

export default router;
