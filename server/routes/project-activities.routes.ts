import { Router } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { z } from "zod";
import { eq, and, asc, desc, count, sql, inArray, isNull } from "drizzle-orm";
import { db } from "../db";
import {
  jobTypes, activityStages, activityConsultants,
  activityTemplates, activityTemplateSubtasks, activityTemplateChecklists,
  jobActivities, jobActivityAssignees, jobActivityUpdates, jobActivityFiles,
  jobActivityChecklists,
  taskGroups, tasks,
} from "@shared/schema";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import logger from "../lib/logger";
import { logJobChange } from "../services/job-audit.service";

const router = Router();

function addWorkingDaysHelper(from: Date, days: number): Date {
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) {
      added++;
    }
  }
  return result;
}

function nextWorkingDayHelper(from: Date): Date {
  const result = new Date(from);
  result.setDate(result.getDate() + 1);
  while (result.getDay() === 0 || result.getDay() === 6) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

function ensureWorkingDayHelper(d: Date): Date {
  const result = new Date(d);
  while (result.getDay() === 0 || result.getDay() === 6) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

function subtractWorkingDaysHelper(from: Date, days: number): Date {
  const result = new Date(from);
  let subtracted = 0;
  while (subtracted < days) {
    result.setDate(result.getDate() - 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) {
      subtracted++;
    }
  }
  return result;
}

function resolveActivityStart(
  predDates: { start: Date; end: Date },
  rel: string,
  estimatedDays: number
): Date {
  let activityStart: Date;
  switch (rel) {
    case "FS":
      activityStart = nextWorkingDayHelper(predDates.end);
      break;
    case "SS":
      activityStart = new Date(predDates.start);
      break;
    case "FF":
      activityStart = subtractWorkingDaysHelper(new Date(predDates.end), estimatedDays - 1);
      break;
    case "SF":
      activityStart = subtractWorkingDaysHelper(new Date(predDates.start), estimatedDays - 1);
      break;
    default:
      activityStart = nextWorkingDayHelper(predDates.end);
  }
  return ensureWorkingDayHelper(activityStart);
}

const ALLOWED_FILE_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv", "application/json",
  "application/zip",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

// ============================================================================
// JOB TYPES CRUD
// ============================================================================

router.get("/api/job-types", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const result = await db.select().from(jobTypes)
      .where(eq(jobTypes.companyId, companyId!))
      .orderBy(asc(jobTypes.sortOrder), asc(jobTypes.name));

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
      .where(and(eq(jobTypes.id, id), eq(jobTypes.companyId, companyId!)));
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
      .where(and(eq(jobTypes.id, id), eq(jobTypes.companyId, companyId!)));
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
      .where(and(eq(jobTypes.id, id), eq(jobTypes.companyId, companyId!)));
    if (!existing) return res.status(404).json({ error: "Job type not found" });

    await db.delete(jobTypes).where(eq(jobTypes.id, id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting job type");
    res.status(500).json({ error: "Failed to delete job type" });
  }
});

// ============================================================================
// ACTIVITY STAGES
// ============================================================================

router.get("/api/activity-stages", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const result = await db.select().from(activityStages)
      .where(eq(activityStages.companyId, companyId!))
      .orderBy(asc(activityStages.sortOrder), asc(activityStages.stageNumber));
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
      .where(and(eq(activityStages.id, id), eq(activityStages.companyId, companyId!)));
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
      .where(and(eq(activityStages.id, id), eq(activityStages.companyId, companyId!)));
    if (!existing) return res.status(404).json({ error: "Stage not found" });

    await db.delete(activityStages).where(eq(activityStages.id, id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting stage");
    res.status(500).json({ error: "Failed to delete stage" });
  }
});

// ============================================================================
// ACTIVITY CONSULTANTS
// ============================================================================

router.get("/api/activity-consultants", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const result = await db.select().from(activityConsultants)
      .where(eq(activityConsultants.companyId, companyId!))
      .orderBy(asc(activityConsultants.sortOrder), asc(activityConsultants.name));
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
      .where(and(eq(activityConsultants.id, id), eq(activityConsultants.companyId, companyId!)));
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
      .where(and(eq(activityConsultants.id, id), eq(activityConsultants.companyId, companyId!)));
    if (!existing) return res.status(404).json({ error: "Consultant not found" });

    await db.delete(activityConsultants).where(eq(activityConsultants.id, id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting consultant");
    res.status(500).json({ error: "Failed to delete consultant" });
  }
});

// ============================================================================
// ACTIVITY TEMPLATES (Workflow Builder)
// ============================================================================

router.get("/api/job-types/:jobTypeId/templates", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const jobTypeId = String(req.params.jobTypeId);

    const [jt] = await db.select().from(jobTypes)
      .where(and(eq(jobTypes.id, jobTypeId), eq(jobTypes.companyId, companyId!)));
    if (!jt) return res.status(404).json({ error: "Job type not found" });

    const templates = await db.select().from(activityTemplates)
      .where(and(eq(activityTemplates.jobTypeId, jobTypeId), eq(activityTemplates.companyId, companyId!)))
      .orderBy(asc(activityTemplates.sortOrder));

    const templateIds = templates.map(t => t.id);

    const filteredSubtasks = templateIds.length > 0
      ? await db.select().from(activityTemplateSubtasks)
          .where(inArray(activityTemplateSubtasks.templateId, templateIds))
          .orderBy(asc(activityTemplateSubtasks.sortOrder))
      : [];

    const filteredChecklists = templateIds.length > 0
      ? await db.select().from(activityTemplateChecklists)
          .where(inArray(activityTemplateChecklists.templateId, templateIds))
          .orderBy(asc(activityTemplateChecklists.sortOrder))
      : [];

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
      .where(and(eq(jobTypes.id, jobTypeId), eq(jobTypes.companyId, companyId!)));
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
      .where(and(eq(activityTemplates.id, String(req.params.id)), eq(activityTemplates.companyId, companyId!)));
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
      .where(and(eq(activityTemplates.id, String(req.params.id)), eq(activityTemplates.companyId, companyId!)));
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
      .where(and(eq(jobTypes.id, jobTypeId), eq(jobTypes.companyId, companyId!)));
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

// ============================================================================
// TEMPLATE SUBTASKS
// ============================================================================

router.get("/api/activity-templates/:templateId/subtasks", requireAuth, async (req, res) => {
  try {
    const result = await db.select().from(activityTemplateSubtasks)
      .where(eq(activityTemplateSubtasks.templateId, String(req.params.templateId)))
      .orderBy(asc(activityTemplateSubtasks.sortOrder));
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

    const result = await db.select().from(activityTemplateChecklists)
      .where(eq(activityTemplateChecklists.templateId, templateId))
      .orderBy(asc(activityTemplateChecklists.sortOrder));
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

// ============================================================================
// JOB ACTIVITIES (Instance per job)
// ============================================================================

router.get("/api/jobs/:jobId/activities", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const jobId = String(req.params.jobId);

    const activities = await db.select().from(jobActivities)
      .where(and(eq(jobActivities.jobId, jobId), eq(jobActivities.companyId, companyId!)))
      .orderBy(asc(jobActivities.sortOrder));

    const activityIds = activities.map(a => a.id);

    let assignees: Record<string, unknown>[] = [];
    let checklistCounts: Array<{ activityId: string; total: number; completed: number }> = [];
    if (activityIds.length > 0) {
      assignees = await db.select().from(jobActivityAssignees)
        .where(inArray(jobActivityAssignees.activityId, activityIds));

      const clRows = await db.select({
        activityId: jobActivityChecklists.activityId,
        total: count(),
        completed: sql<number>`count(*) filter (where ${jobActivityChecklists.isCompleted} = true)`,
      }).from(jobActivityChecklists)
        .where(inArray(jobActivityChecklists.activityId, activityIds))
        .groupBy(jobActivityChecklists.activityId);
      checklistCounts = clRows.map(r => ({
        activityId: r.activityId,
        total: Number(r.total),
        completed: Number(r.completed),
      }));
    }

    const result = activities.map(a => {
      const cl = checklistCounts.find(c => c.activityId === a.id);
      return {
        ...a,
        assignees: assignees.filter(x => x.activityId === a.id),
        checklistTotal: cl?.total || 0,
        checklistCompleted: cl?.completed || 0,
      };
    });

    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching job activities");
    res.status(500).json({ error: "Failed to fetch job activities" });
  }
});

router.post("/api/jobs/:jobId/activities/instantiate", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const jobId = String(req.params.jobId);
    const { jobTypeId, startDate } = req.body;

    if (!jobTypeId) return res.status(400).json({ error: "jobTypeId is required" });
    if (!startDate) return res.status(400).json({ error: "startDate is required" });

    const [jt] = await db.select().from(jobTypes)
      .where(and(eq(jobTypes.id, jobTypeId), eq(jobTypes.companyId, companyId!)));
    if (!jt) return res.status(404).json({ error: "Job type not found" });

    const templates = await db.select().from(activityTemplates)
      .where(and(eq(activityTemplates.jobTypeId, jobTypeId), eq(activityTemplates.companyId, companyId!)))
      .orderBy(asc(activityTemplates.sortOrder));

    if (templates.length === 0) {
      return res.status(400).json({ error: "No templates found for this job type. Build the workflow first." });
    }

    const templateIds = templates.map(t => t.id);
    const filteredSubtasks = templateIds.length > 0
      ? await db.select().from(activityTemplateSubtasks)
          .where(inArray(activityTemplateSubtasks.templateId, templateIds))
          .orderBy(asc(activityTemplateSubtasks.sortOrder))
      : [];

    const filteredChecklists = templateIds.length > 0
      ? await db.select().from(activityTemplateChecklists)
          .where(inArray(activityTemplateChecklists.templateId, templateIds))
          .orderBy(asc(activityTemplateChecklists.sortOrder))
      : [];

    function addWorkingDays(from: Date, days: number): Date {
      const result = new Date(from);
      let added = 0;
      while (added < days) {
        result.setDate(result.getDate() + 1);
        const dow = result.getDay();
        if (dow !== 0 && dow !== 6) {
          added++;
        }
      }
      return result;
    }

    function nextWorkingDay(from: Date): Date {
      const result = new Date(from);
      result.setDate(result.getDate() + 1);
      while (result.getDay() === 0 || result.getDay() === 6) {
        result.setDate(result.getDate() + 1);
      }
      return result;
    }

    function ensureWorkingDay(d: Date): Date {
      const result = new Date(d);
      while (result.getDay() === 0 || result.getDay() === 6) {
        result.setDate(result.getDate() + 1);
      }
      return result;
    }

    function subtractWorkingDays(from: Date, days: number): Date {
      const result = new Date(from);
      let subtracted = 0;
      while (subtracted < days) {
        result.setDate(result.getDate() - 1);
        const dow = result.getDay();
        if (dow !== 0 && dow !== 6) {
          subtracted++;
        }
      }
      return result;
    }

    const createdActivities: Record<string, unknown>[] = [];
    const projectStart = ensureWorkingDay(new Date(startDate));

    const resolvedDates = new Map<number, { start: Date; end: Date }>();

    for (const template of templates) {
      const estimatedDays = template.estimatedDays || 14;
      const predOrder = template.predecessorSortOrder;
      const rel = template.relationship || "FS";
      let activityStart: Date;

      if (predOrder != null && predOrder < template.sortOrder && resolvedDates.has(predOrder)) {
        const pred = resolvedDates.get(predOrder)!;
        switch (rel) {
          case "FS":
            activityStart = nextWorkingDay(pred.end);
            break;
          case "SS":
            activityStart = new Date(pred.start);
            break;
          case "FF": {
            const tempEnd = new Date(pred.end);
            activityStart = subtractWorkingDays(tempEnd, estimatedDays - 1);
            break;
          }
          case "SF": {
            const tempEnd = new Date(pred.start);
            activityStart = subtractWorkingDays(tempEnd, estimatedDays - 1);
            break;
          }
          default:
            activityStart = nextWorkingDay(pred.end);
        }
        activityStart = ensureWorkingDay(activityStart);
      } else {
        activityStart = new Date(projectStart);
      }

      const activityEndDate = addWorkingDays(activityStart, estimatedDays - 1);
      resolvedDates.set(template.sortOrder, { start: activityStart, end: activityEndDate });
    }

    await db.transaction(async (tx) => {
      for (const template of templates) {
        const dates = resolvedDates.get(template.sortOrder)!;

        const [activity] = await tx.insert(jobActivities).values({
          jobId,
          templateId: template.id,
          stageId: template.stageId,
          companyId: companyId!,
          category: template.category,
          name: template.name,
          description: template.description,
          estimatedDays: template.estimatedDays,
          consultantName: template.consultantName,
          deliverable: template.deliverable,
          jobPhase: template.jobPhase,
          sortOrder: template.sortOrder,
          predecessorSortOrder: template.predecessorSortOrder ?? null,
          relationship: template.predecessorSortOrder != null ? (template.relationship || "FS") : null,
          startDate: dates.start,
          endDate: dates.end,
          createdById: req.session.userId,
        }).returning();

        createdActivities.push(activity);

        const subs = filteredSubtasks.filter(s => s.templateId === template.id);
        let subStartDate = new Date(dates.start);
        for (const sub of subs) {
          const subDays = sub.estimatedDays || 7;
          const subEndDate = addWorkingDays(subStartDate, subDays - 1);
          await tx.insert(jobActivities).values({
            jobId,
            templateId: template.id,
            stageId: template.stageId,
            parentId: activity.id,
            companyId: companyId!,
            name: sub.name,
            estimatedDays: sub.estimatedDays,
            jobPhase: template.jobPhase,
            sortOrder: sub.sortOrder,
            startDate: subStartDate,
            endDate: subEndDate,
            createdById: req.session.userId,
          });
          subStartDate = nextWorkingDay(subEndDate);
        }

        const checklists = filteredChecklists.filter(c => c.templateId === template.id);
        for (const cl of checklists) {
          await tx.insert(jobActivityChecklists).values({
            activityId: activity.id,
            checklistTemplateId: cl.id,
            checklistTemplateRefId: cl.checklistTemplateRefId || null,
            name: cl.name,
            sortOrder: cl.sortOrder,
            isCompleted: false,
          });
        }
      }
    });

    logJobChange(jobId, "ACTIVITIES_INSTANTIATED", req.session.userId || null, req.session.name || null, {
      changedFields: {
        jobTypeId,
        jobTypeName: jt.name,
        startDate,
        activitiesCreated: createdActivities.length,
      },
    });

    res.status(201).json({ success: true, count: createdActivities.length });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error instantiating activities");
    res.status(500).json({ error: "Failed to instantiate activities" });
  }
});

router.post("/api/jobs/:jobId/activities/sync-predecessors", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const jobId = String(req.params.jobId);

    const activities = await db.select().from(jobActivities)
      .where(and(
        eq(jobActivities.jobId, jobId),
        eq(jobActivities.companyId, companyId!),
        isNull(jobActivities.parentId)
      ))
      .orderBy(asc(jobActivities.sortOrder));

    if (activities.length === 0) {
      return res.status(404).json({ error: "No activities found for this job" });
    }

    const templateIds = activities.map(a => a.templateId).filter(Boolean) as string[];
    if (templateIds.length === 0) {
      return res.status(400).json({ error: "Activities have no linked templates" });
    }

    const templates = await db.select().from(activityTemplates)
      .where(inArray(activityTemplates.id, templateIds));

    const templateMap = new Map(templates.map(t => [t.id, t]));

    let synced = 0;
    await db.transaction(async (tx) => {
      for (const activity of activities) {
        if (!activity.templateId) continue;
        const template = templateMap.get(activity.templateId);
        if (!template) continue;

        const predSortOrder = template.predecessorSortOrder ?? null;
        const rel = predSortOrder != null ? (template.relationship || "FS") : null;

        if (activity.predecessorSortOrder !== predSortOrder || activity.relationship !== rel) {
          await tx.update(jobActivities)
            .set({
              predecessorSortOrder: predSortOrder,
              relationship: rel,
              updatedAt: new Date(),
            })
            .where(eq(jobActivities.id, activity.id));
          synced++;
        }
      }
    });

    res.json({ success: true, synced, total: activities.length });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error syncing predecessors from templates");
    res.status(500).json({ error: "Failed to sync predecessors" });
  }
});

router.patch("/api/job-activities/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const id = req.params.id as string;
    const activityUpdateSchema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional().nullable(),
      status: z.enum(["NOT_STARTED", "IN_PROGRESS", "STUCK", "DONE", "ON_HOLD", "SKIPPED"]).optional(),
      startDate: z.string().optional().nullable(),
      endDate: z.string().optional().nullable(),
      reminderDate: z.string().optional().nullable(),
      estimatedDays: z.number().int().optional().nullable(),
      consultantName: z.string().optional().nullable(),
      deliverable: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      sortOrder: z.number().int().optional(),
      predecessorSortOrder: z.number().int().optional().nullable(),
      relationship: z.enum(["FS", "SS", "FF", "SF"]).optional().nullable(),
      category: z.string().optional().nullable(),
      jobPhase: z.string().optional().nullable(),
    });

    const parsed = activityUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

    const [existing] = await db.select().from(jobActivities)
      .where(and(eq(jobActivities.id, id), eq(jobActivities.companyId, companyId!)));
    if (!existing) return res.status(404).json({ error: "Activity not found" });

    const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };

    if (updateData.predecessorSortOrder !== undefined) {
      if (updateData.predecessorSortOrder === null) {
        updateData.relationship = null;
      } else if (Number(updateData.predecessorSortOrder) >= existing.sortOrder) {
        return res.status(400).json({ error: "Predecessor must have a lower sort order than the current activity" });
      }
    }
    if (updateData.relationship !== undefined && updateData.relationship !== null) {
      const effectivePred = updateData.predecessorSortOrder !== undefined
        ? updateData.predecessorSortOrder
        : existing.predecessorSortOrder;
      if (effectivePred == null) {
        return res.status(400).json({ error: "Cannot set relationship without a predecessor" });
      }
    }

    if (updateData.status === "DONE") {
      const checklists = await db.select().from(jobActivityChecklists)
        .where(eq(jobActivityChecklists.activityId, id));
      if (checklists.length > 0) {
        const incomplete = checklists.filter(c => !c.isCompleted);
        if (incomplete.length > 0) {
          return res.status(400).json({
            error: `Cannot mark activity as Done - ${incomplete.length} checklist item(s) not completed`,
          });
        }
      }
    }

    if (updateData.startDate !== undefined) {
      updateData.startDate = updateData.startDate ? new Date(updateData.startDate) : null;
    }
    if (updateData.endDate !== undefined) {
      updateData.endDate = updateData.endDate ? new Date(updateData.endDate) : null;
    }
    if (updateData.reminderDate !== undefined) {
      updateData.reminderDate = updateData.reminderDate ? new Date(updateData.reminderDate) : null;
    }

    const changedFields: Record<string, { from: unknown; to: unknown }> = {};
    const trackFields = ["status", "startDate", "endDate", "estimatedDays", "predecessorSortOrder", "relationship", "name", "consultantName", "deliverable", "notes", "category", "jobPhase", "reminderDate"];
    for (const field of trackFields) {
      if (updateData[field] !== undefined) {
        const oldVal = (existing as Record<string, unknown>)[field];
        const newVal = updateData[field];
        const oldStr = oldVal instanceof Date ? oldVal.toISOString() : String(oldVal ?? "");
        const newStr = newVal instanceof Date ? newVal.toISOString() : String(newVal ?? "");
        if (oldStr !== newStr) {
          changedFields[field] = { from: oldVal ?? null, to: newVal ?? null };
        }
      }
    }

    const [result] = await db.update(jobActivities)
      .set(updateData)
      .where(eq(jobActivities.id, id))
      .returning();

    if (Object.keys(changedFields).length > 0 && existing.jobId) {
      const actionType = changedFields.status ? "ACTIVITY_STATUS_CHANGED" :
        (changedFields.startDate || changedFields.endDate) ? "ACTIVITY_DATES_CHANGED" :
        (changedFields.predecessorSortOrder || changedFields.relationship) ? "ACTIVITY_PREDECESSOR_CHANGED" :
        "ACTIVITY_UPDATED";
      logJobChange(existing.jobId, actionType, req.session?.userId || null, req.session?.name || null, {
        changedFields: {
          activityId: existing.id,
          activityName: existing.name,
          ...changedFields,
        },
      });
    }

    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating activity");
    res.status(500).json({ error: "Failed to update activity" });
  }
});

router.delete("/api/job-activities/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const id = req.params.id as string;
    const [existing] = await db.select().from(jobActivities)
      .where(and(eq(jobActivities.id, id), eq(jobActivities.companyId, companyId!)));
    if (!existing) return res.status(404).json({ error: "Activity not found" });

    await db.delete(jobActivities).where(eq(jobActivities.id, id));

    if (existing.jobId) {
      logJobChange(existing.jobId, "ACTIVITY_DELETED", req.session?.userId || null, req.session?.name || null, {
        changedFields: {
          activityId: existing.id,
          activityName: existing.name,
          status: existing.status,
        },
      });
    }

    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting activity");
    res.status(500).json({ error: "Failed to delete activity" });
  }
});

router.post("/api/jobs/:jobId/activities/reorder", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const { activityIds } = req.body;
    if (!Array.isArray(activityIds)) return res.status(400).json({ error: "activityIds array required" });

    const jobId = String(req.params.jobId);

    await db.transaction(async (tx) => {
      for (let i = 0; i < activityIds.length; i++) {
        await tx.update(jobActivities)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(and(eq(jobActivities.id, activityIds[i]), eq(jobActivities.jobId, jobId), eq(jobActivities.companyId, companyId!)));
      }
    });
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error reordering activities");
    res.status(500).json({ error: "Failed to reorder activities" });
  }
});

// ============================================================================
// RECALCULATE ACTIVITY DATES BASED ON PREDECESSORS
// ============================================================================

router.post("/api/jobs/:jobId/activities/recalculate", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const jobId = String(req.params.jobId);

    const activities = await db.select().from(jobActivities)
      .where(and(
        eq(jobActivities.jobId, jobId),
        eq(jobActivities.companyId, companyId!),
        sql`${jobActivities.parentId} IS NULL`
      ))
      .orderBy(asc(jobActivities.sortOrder));

    if (activities.length === 0) {
      return res.json({ success: true, updated: 0 });
    }

    const resolvedDates = new Map<number, { start: Date; end: Date }>();

    const firstActivity = activities[0];
    const projectStart = firstActivity.startDate
      ? ensureWorkingDayHelper(new Date(firstActivity.startDate))
      : ensureWorkingDayHelper(new Date());

    const updates: Array<{ id: string; startDate: Date; endDate: Date }> = [];

    for (const activity of activities) {
      const estimatedDays = activity.estimatedDays || 1;
      const predOrder = activity.predecessorSortOrder;
      const rel = activity.relationship || "FS";
      let activityStart: Date;

      if (predOrder != null && resolvedDates.has(predOrder)) {
        const predDates = resolvedDates.get(predOrder)!;
        activityStart = resolveActivityStart(predDates, rel, estimatedDays);
      } else if (predOrder != null && !resolvedDates.has(predOrder)) {
        activityStart = activity.startDate
          ? ensureWorkingDayHelper(new Date(activity.startDate))
          : new Date(projectStart);
        logger.warn({ activityId: activity.id, predOrder }, "Predecessor sortOrder not found in resolved dates, preserving existing start date");
      } else if (activity.startDate) {
        activityStart = ensureWorkingDayHelper(new Date(activity.startDate));
      } else {
        activityStart = new Date(projectStart);
      }

      const activityEnd = addWorkingDaysHelper(activityStart, estimatedDays - 1);
      resolvedDates.set(activity.sortOrder, { start: activityStart, end: activityEnd });

      const startChanged = !activity.startDate || new Date(activity.startDate).toDateString() !== activityStart.toDateString();
      const endChanged = !activity.endDate || new Date(activity.endDate).toDateString() !== activityEnd.toDateString();

      if (startChanged || endChanged) {
        updates.push({ id: activity.id, startDate: activityStart, endDate: activityEnd });
      }
    }

    if (updates.length > 0) {
      await db.transaction(async (tx) => {
        for (const upd of updates) {
          await tx.update(jobActivities)
            .set({ startDate: upd.startDate, endDate: upd.endDate, updatedAt: new Date() })
            .where(eq(jobActivities.id, upd.id));
        }
      });
    }

    if (updates.length > 0) {
      logJobChange(jobId, "ACTIVITIES_DATES_RECALCULATED", req.session?.userId || null, req.session?.name || null, {
        changedFields: {
          activitiesUpdated: updates.length,
          updatedActivities: updates.map(u => u.id),
        },
      });
    }

    res.json({ success: true, updated: updates.length });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error recalculating activity dates");
    res.status(500).json({ error: "Failed to recalculate dates" });
  }
});

// ============================================================================
// ACTIVITY ASSIGNEES
// ============================================================================

router.get("/api/job-activities/:id/assignees", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const result = await db.select().from(jobActivityAssignees)
      .where(eq(jobActivityAssignees.activityId, id));
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching activity assignees");
    res.status(500).json({ error: "Failed to fetch assignees" });
  }
});

router.put("/api/job-activities/:id/assignees", requireAuth, async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds)) return res.status(400).json({ error: "userIds must be an array" });

    const activityId = String(req.params.id);

    await db.transaction(async (tx) => {
      await tx.delete(jobActivityAssignees).where(eq(jobActivityAssignees.activityId, activityId));
      for (const userId of userIds) {
        await tx.insert(jobActivityAssignees).values({ activityId, userId });
      }
    });

    const result = await db.select().from(jobActivityAssignees)
      .where(eq(jobActivityAssignees.activityId, activityId));
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error setting activity assignees");
    res.status(500).json({ error: "Failed to set assignees" });
  }
});

// ============================================================================
// ACTIVITY UPDATES (Chat/Comments)
// ============================================================================

router.get("/api/job-activities/:id/updates", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const updates = await db.select().from(jobActivityUpdates)
      .where(eq(jobActivityUpdates.activityId, id))
      .orderBy(asc(jobActivityUpdates.createdAt));

    const files = await db.select().from(jobActivityFiles)
      .where(eq(jobActivityFiles.activityId, id));

    const result = updates.map(u => ({
      ...u,
      files: files.filter(f => f.updateId === u.id),
    }));
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching activity updates");
    res.status(500).json({ error: "Failed to fetch updates" });
  }
});

router.post("/api/job-activities/:id/updates", requireAuth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || typeof content !== "string") return res.status(400).json({ error: "Content is required" });
    const id = req.params.id as string;

    const [result] = await db.insert(jobActivityUpdates).values({
      activityId: id,
      userId: req.session.userId!,
      content,
    }).returning();
    res.status(201).json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating activity update");
    res.status(500).json({ error: "Failed to create update" });
  }
});

router.delete("/api/job-activity-updates/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const [existing] = await db.select().from(jobActivityUpdates)
      .where(eq(jobActivityUpdates.id, id));
    if (!existing) return res.status(404).json({ error: "Update not found" });
    if (existing.userId !== req.session.userId) return res.status(403).json({ error: "Can only delete own updates" });

    await db.delete(jobActivityUpdates).where(eq(jobActivityUpdates.id, id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting activity update");
    res.status(500).json({ error: "Failed to delete update" });
  }
});

// ============================================================================
// ACTIVITY FILES
// ============================================================================

router.get("/api/job-activities/:id/files", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const result = await db.select().from(jobActivityFiles)
      .where(eq(jobActivityFiles.activityId, id))
      .orderBy(desc(jobActivityFiles.createdAt));
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching activity files");
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

router.post("/api/job-activities/:id/files", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "File is required" });

    const activityId = String(req.params.id);
    const updateId = req.body.updateId || null;

    let fileUrl: string;
    try {
      const { ObjectStorageService } = await import("../replit_integrations/object_storage");
      const storageService = new ObjectStorageService();
      const storageKey = `.private/activity-files/${activityId}/${Date.now()}-${req.file.originalname}`;
      await storageService.uploadFile(storageKey, req.file.buffer, req.file.mimetype);
      fileUrl = storageKey;
    } catch {
      const base64 = req.file.buffer.toString("base64");
      fileUrl = `data:${req.file.mimetype};base64,${base64}`;
    }

    const [result] = await db.insert(jobActivityFiles).values({
      activityId,
      updateId,
      fileName: req.file.originalname,
      fileUrl,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedById: req.session.userId,
    }).returning();
    res.status(201).json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error uploading activity file");
    res.status(500).json({ error: "Failed to upload file" });
  }
});

router.delete("/api/job-activity-files/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    await db.delete(jobActivityFiles).where(eq(jobActivityFiles.id, id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting activity file");
    res.status(500).json({ error: "Failed to delete file" });
  }
});

// ============================================================================
// ACTIVITY CHECKLISTS
// ============================================================================

router.get("/api/job-activities/:activityId/checklists", requireAuth, async (req, res) => {
  try {
    const activityId = req.params.activityId as string;
    const result = await db.select().from(jobActivityChecklists)
      .where(eq(jobActivityChecklists.activityId, activityId))
      .orderBy(asc(jobActivityChecklists.sortOrder));
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching activity checklists");
    res.status(500).json({ error: "Failed to fetch checklists" });
  }
});

router.post("/api/job-activity-checklists/:id/toggle", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const [existing] = await db.select().from(jobActivityChecklists)
      .where(eq(jobActivityChecklists.id, id));
    if (!existing) return res.status(404).json({ error: "Checklist item not found" });

    const newCompleted = !existing.isCompleted;
    const [updated] = await db.update(jobActivityChecklists)
      .set({
        isCompleted: newCompleted,
        completedAt: newCompleted ? new Date() : null,
        completedById: newCompleted ? req.session.userId : null,
      })
      .where(eq(jobActivityChecklists.id, id))
      .returning();
    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error toggling checklist item");
    res.status(500).json({ error: "Failed to toggle checklist item" });
  }
});

// ============================================================================
// SEED DATA
// ============================================================================

router.post("/api/activity-seed", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;

    const existingStages = await db.select().from(activityStages)
      .where(eq(activityStages.companyId, companyId!));
    if (existingStages.length > 0) {
      return res.status(400).json({ error: "Seed data already exists for this company" });
    }

    const stagesData = [
      { stageNumber: 1, name: "Strategy & Feasibility" },
      { stageNumber: 2, name: "Site Acquisition" },
      { stageNumber: 3, name: "Concept & Planning Strategy" },
      { stageNumber: 4, name: "Planning Approval" },
      { stageNumber: 5, name: "Detailed Design & Building Approval" },
      { stageNumber: 6, name: "Procurement" },
      { stageNumber: 7, name: "Construction" },
      { stageNumber: 8, name: "Commissioning & Occupancy" },
      { stageNumber: 9, name: "Settlement & Handover" },
      { stageNumber: 10, name: "Defects & Stabilisation" },
    ];

    const consultantsData = [
      "Agent", "Architect", "Asset Manager", "Builder", "Builder / Consultants",
      "Builder / Façade Engineer", "Builder / PM", "Builder / Structural Engineer",
      "Building Surveyor", "Civil Engineer", "Commissioning Manager",
      "Development Manager", "Development Manager / QS", "Environmental Consultant",
      "ESD Consultant", "Fire Engineer", "Geotechnical Engineer", "Landscape Architect",
      "Lawyer / Developer", "Licensed Surveyor", "Market Research Consultant",
      "MEP / ESD Consultants", "MEP Contractors", "MEP Engineers",
      "PCA / Consultants", "PM / QS", "Property Lawyer", "QS / PM",
      "Quantity Surveyor", "Strata Manager / Lawyer", "Structural Engineer",
      "Superintendent / PM", "Surveyor", "Town Planner", "Town Planner / Lawyer",
      "Traffic Engineer", "Various Consultants",
    ];

    const jobTypesData = [
      { name: "Construction Only", description: "Construction-only projects" },
      { name: "Development to Construction", description: "Full development lifecycle from feasibility to construction" },
      { name: "Manufacturing", description: "Manufacturing and production projects" },
      { name: "Procurement", description: "Procurement-focused projects" },
    ];

    await db.transaction(async (tx) => {
      const createdStages: { id: string; stageNumber: number; [key: string]: unknown }[] = [];
      for (let i = 0; i < stagesData.length; i++) {
        const [s] = await tx.insert(activityStages).values({
          ...stagesData[i],
          companyId: companyId!,
          sortOrder: i,
        }).returning();
        createdStages.push(s);
      }

      const createdConsultants: Record<string, string> = {};
      for (let i = 0; i < consultantsData.length; i++) {
        const [c] = await tx.insert(activityConsultants).values({
          name: consultantsData[i],
          companyId: companyId!,
          sortOrder: i,
        }).returning();
        createdConsultants[consultantsData[i]] = c.id;
      }

      const createdJobTypes: Record<string, unknown>[] = [];
      for (let i = 0; i < jobTypesData.length; i++) {
        const [jt] = await tx.insert(jobTypes).values({
          ...jobTypesData[i],
          companyId: companyId!,
          sortOrder: i,
        }).returning();
        createdJobTypes.push(jt);
      }

      const stageMap: Record<number, string> = {};
      for (const s of createdStages) {
        stageMap[Number(s.stageNumber)] = s.id;
      }

      const activitiesData = [
        { stage: 1, phase: "OPPORTUNITY", cat: "Market Analysis", name: "Undertake market and demand study", days: 5, consultant: "Market Research Consultant", deliverable: "Market demand report" },
        { stage: 1, phase: "OPPORTUNITY", cat: "Feasibility", name: "Prepare high-level development feasibility model", days: 5, consultant: "Development Manager / QS", deliverable: "Feasibility model" },
        { stage: 1, phase: "OPPORTUNITY", cat: "Planning Due Diligence", name: "Review zoning, overlays, planning controls", days: 5, consultant: "Town Planner", deliverable: "Planning due diligence memo" },
        { stage: 1, phase: "OPPORTUNITY", cat: "Concept Design", name: "Prepare test fit / massing options", days: 25, consultant: "Architect", deliverable: "Concept massing drawings" },
        { stage: 1, phase: "CONTRACTED", cat: "Cost Planning", name: "Prepare preliminary cost plan", days: 20, consultant: "Quantity Surveyor", deliverable: "Concept cost plan" },
        { stage: 1, phase: "CONTRACTED", cat: "Risk", name: "Prepare initial development risk register", days: 5, consultant: "Development Manager", deliverable: "Risk register" },
        { stage: 2, phase: "CONTRACTED", cat: "Legal", name: "Review title, easements, covenants", days: 5, consultant: "Property Lawyer", deliverable: "Title due diligence report" },
        { stage: 2, phase: "CONTRACTED", cat: "Surveying", name: "Prepare feature & level survey", days: 15, consultant: "Licensed Surveyor", deliverable: "Feature & level survey" },
        { stage: 2, phase: "CONTRACTED", cat: "Environmental", name: "Undertake contamination screening (PSI)", days: 30, consultant: "Environmental Consultant", deliverable: "Contamination assessment" },
        { stage: 2, phase: "CONTRACTED", cat: "Geotechnical", name: "Preliminary geotechnical investigation", days: 30, consultant: "Geotechnical Engineer", deliverable: "Geotechnical advice" },
        { stage: 2, phase: "CONTRACTED", cat: "Traffic", name: "Assess site access feasibility", days: 14, consultant: "Traffic Engineer", deliverable: "Access feasibility advice" },
        { stage: 2, phase: "CONTRACTED", cat: "Commercial", name: "Negotiate land contract / option", days: 14, consultant: "Lawyer / Developer", deliverable: "Executed contract" },
        { stage: 3, phase: "CONTRACTED", cat: "Architecture", name: "Develop concept design to schematic level", days: 14, consultant: "Architect", deliverable: "Schematic design package" },
        { stage: 3, phase: "CONTRACTED", cat: "Planning", name: "Prepare and lodge pre-application meeting request", days: 14, consultant: "Town Planner", deliverable: "Pre-app response" },
        { stage: 3, phase: "CONTRACTED", cat: "Engineering", name: "Engage structural and civil engineers", days: 14, consultant: "Structural Engineer", deliverable: "Preliminary engineering advice" },
        { stage: 3, phase: "CONTRACTED", cat: "Services", name: "Prepare services feasibility and infrastructure assessment", days: 14, consultant: "MEP Engineers", deliverable: "Services infrastructure report" },
        { stage: 3, phase: "CONTRACTED", cat: "Landscaping", name: "Prepare concept landscape design", days: 14, consultant: "Landscape Architect", deliverable: "Concept landscape plan" },
        { stage: 3, phase: "CONTRACTED", cat: "ESD", name: "Prepare sustainability strategy and NatHERS / Section J modelling", days: 14, consultant: "ESD Consultant", deliverable: "Sustainability report" },
        { stage: 3, phase: "CONTRACTED", cat: "Cost Update", name: "Update feasibility and cost plan", days: 14, consultant: "QS / PM", deliverable: "Updated cost plan" },
        { stage: 3, phase: "CONTRACTED", cat: "Stakeholder", name: "Prepare community engagement strategy", days: 14, consultant: "Development Manager", deliverable: "Engagement plan" },
        { stage: 4, phase: "CONTRACTED", cat: "Architecture", name: "Prepare DA architectural plans", days: 14, consultant: "Architect", deliverable: "DA drawings" },
        { stage: 4, phase: "CONTRACTED", cat: "Consultant Reports", name: "Prepare supporting consultant reports", days: 14, consultant: "Various Consultants", deliverable: "Planning reports" },
        { stage: 4, phase: "CONTRACTED", cat: "Council Process", name: "Respond to RFIs and objections", days: 14, consultant: "Town Planner", deliverable: "RFI responses" },
        { stage: 4, phase: "CONTRACTED", cat: "Approval", name: "Negotiate permit conditions and obtain approval", days: 14, consultant: "Town Planner / Lawyer", deliverable: "Planning permit" },
        { stage: 5, phase: "CONTRACTED", cat: "Architecture", name: "Prepare detailed design & construction documentation", days: 14, consultant: "Architect", deliverable: "IFC drawings" },
        { stage: 5, phase: "CONTRACTED", cat: "Structural", name: "Prepare structural design & drawings", days: 14, consultant: "Structural Engineer", deliverable: "Structural documentation" },
        { stage: 5, phase: "CONTRACTED", cat: "Services", name: "Prepare MEP design documentation", days: 14, consultant: "MEP Engineers", deliverable: "Services drawings" },
        { stage: 5, phase: "CONTRACTED", cat: "Fire", name: "Prepare fire safety strategy & reports", days: 14, consultant: "Fire Engineer", deliverable: "Fire engineering report" },
        { stage: 5, phase: "CONTRACTED", cat: "Certification", name: "Obtain building permit / construction certificate", days: 14, consultant: "Building Surveyor", deliverable: "Building permit" },
        { stage: 6, phase: "CONTRACTED", cat: "Tendering", name: "Prepare and issue tender documentation", days: 14, consultant: "PM / QS", deliverable: "Tender package" },
        { stage: 6, phase: "CONTRACTED", cat: "Tender Review", name: "Assess and level tenders", days: 14, consultant: "QS / PM", deliverable: "Tender report" },
        { stage: 6, phase: "CONTRACTED", cat: "Contracting", name: "Negotiate and execute building contract", days: 14, consultant: "Lawyer / Developer", deliverable: "Executed contract" },
        { stage: 7, phase: "CONTRACTED", cat: "Site Establishment", name: "Mobilise site and commence works", days: 14, consultant: "Builder", deliverable: "Site establishment" },
        { stage: 7, phase: "CONTRACTED", cat: "Structure", name: "Construct substructure and superstructure", days: 14, consultant: "Builder / Structural Engineer", deliverable: "Completed structure" },
        { stage: 7, phase: "CONTRACTED", cat: "Façade", name: "Install façade systems", days: 14, consultant: "Builder / Façade Engineer", deliverable: "Façade installation" },
        { stage: 7, phase: "CONTRACTED", cat: "Services", name: "Install building services", days: 14, consultant: "MEP Contractors", deliverable: "Services installation" },
        { stage: 7, phase: "CONTRACTED", cat: "Contract Admin", name: "Administer variations, EOTs, progress claims", days: 14, consultant: "Superintendent / PM", deliverable: "Contract records" },
        { stage: 8, phase: "CONTRACTED", cat: "Commissioning", name: "Commission all building systems", days: 14, consultant: "Commissioning Manager", deliverable: "Commissioning records" },
        { stage: 8, phase: "CONTRACTED", cat: "Compliance", name: "Final inspections and compliance certifications", days: 14, consultant: "PCA / Consultants", deliverable: "Compliance certificates" },
        { stage: 8, phase: "CONTRACTED", cat: "Handover", name: "Prepare O&M manuals and training", days: 14, consultant: "Builder / Consultants", deliverable: "O&M manuals" },
        { stage: 8, phase: "CONTRACTED", cat: "Occupancy", name: "Obtain occupancy permit", days: 14, consultant: "Building Surveyor", deliverable: "Occupancy permit" },
        { stage: 9, phase: "CONTRACTED", cat: "Subdivision", name: "Prepare and register plan of subdivision", days: 14, consultant: "Surveyor", deliverable: "Registered titles" },
        { stage: 9, phase: "CONTRACTED", cat: "Strata", name: "Establish Owners Corporation", days: 14, consultant: "Strata Manager / Lawyer", deliverable: "OC registration" },
        { stage: 9, phase: "CONTRACTED", cat: "Leasing", name: "Lease or sell completed asset", days: 14, consultant: "Agent", deliverable: "Executed leases/sales" },
        { stage: 10, phase: "CONTRACTED", cat: "Defects", name: "Manage defects liability period", days: 14, consultant: "Builder / PM", deliverable: "Defects closed" },
        { stage: 10, phase: "CONTRACTED", cat: "Tuning", name: "Post-occupancy building tuning", days: 14, consultant: "MEP / ESD Consultants", deliverable: "Performance reports" },
        { stage: 10, phase: "CONTRACTED", cat: "Stabilisation", name: "Achieve target occupancy and stable operations", days: 14, consultant: "Asset Manager", deliverable: "Stabilised asset" },
      ];

      const devJobType = createdJobTypes.find((jt) => jt.name === "Development to Construction");
      if (devJobType) {
        for (let i = 0; i < activitiesData.length; i++) {
          const a = activitiesData[i];
          await tx.insert(activityTemplates).values({
            jobTypeId: devJobType.id,
            stageId: stageMap[a.stage],
            companyId: companyId!,
            category: a.cat,
            name: a.name,
            estimatedDays: a.days,
            consultantId: createdConsultants[a.consultant] || null,
            consultantName: a.consultant,
            deliverable: a.deliverable,
            jobPhase: a.phase,
            sortOrder: i,
          });
        }
      }
    });

    res.status(201).json({ success: true, message: "Seed data created successfully" });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error seeding activity data");
    res.status(500).json({ error: "Failed to seed data" });
  }
});

// ============================================================================
// IMPORT / EXPORT TEMPLATE
// ============================================================================

router.get("/api/job-types/:jobTypeId/templates/download-template", requireAuth, async (req, res) => {
  try {
    const jobTypeId = String(req.params.jobTypeId);
    const companyId = req.companyId;

    const allStages = await db.select().from(activityStages)
      .where(eq(activityStages.companyId, companyId!))
      .orderBy(asc(activityStages.stageNumber));

    const allConsultants = await db.select().from(activityConsultants)
      .where(eq(activityConsultants.companyId, companyId!))
      .orderBy(asc(activityConsultants.sortOrder));

    const workbook = new ExcelJS.Workbook();

    const mainSheet = workbook.addWorksheet("Activities");
    mainSheet.columns = [
      { header: "Stage Number", key: "stageNumber", width: 15 },
      { header: "Stage Name", key: "stageName", width: 35 },
      { header: "Category", key: "category", width: 20 },
      { header: "Activity Name", key: "name", width: 40 },
      { header: "Description", key: "description", width: 40 },
      { header: "Estimated Days", key: "estimatedDays", width: 16 },
      { header: "Consultant", key: "consultant", width: 30 },
      { header: "Deliverable", key: "deliverable", width: 30 },
      { header: "Phase", key: "phase", width: 25 },
    ];

    const headerRow = mainSheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };

    mainSheet.addRow({
      stageNumber: 1,
      stageName: allStages.find(s => s.stageNumber === 1)?.name || "Strategy & Feasibility",
      category: "Architecture",
      name: "Example: Prepare feasibility study",
      description: "Prepare initial feasibility study report",
      estimatedDays: 14,
      consultant: allConsultants[0]?.name || "Architect",
      deliverable: "Feasibility report",
      phase: "OPPORTUNITY",
    });

    const refSheet = workbook.addWorksheet("Reference - Stages");
    refSheet.columns = [
      { header: "Stage Number", key: "stageNumber", width: 15 },
      { header: "Stage Name", key: "stageName", width: 40 },
    ];
    const refHeaderRow = refSheet.getRow(1);
    refHeaderRow.font = { bold: true };
    refHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
    for (const stage of allStages) {
      refSheet.addRow({ stageNumber: stage.stageNumber, stageName: stage.name });
    }

    const consultantSheet = workbook.addWorksheet("Reference - Consultants");
    consultantSheet.columns = [
      { header: "#", key: "num", width: 8 },
      { header: "Consultant Name", key: "name", width: 40 },
    ];
    const conHeaderRow = consultantSheet.getRow(1);
    conHeaderRow.font = { bold: true };
    conHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
    allConsultants.forEach((c, i) => {
      consultantSheet.addRow({ num: i + 1, name: c.name });
    });

    const phaseSheet = workbook.addWorksheet("Reference - Phases");
    phaseSheet.columns = [
      { header: "Phase Value", key: "phase", width: 30 },
    ];
    const phaseHeaderRow = phaseSheet.getRow(1);
    phaseHeaderRow.font = { bold: true };
    phaseHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
    ["OPPORTUNITY", "QUOTING", "WON_AWAITING_CONTRACT", "CONTRACTED", "LOST"].forEach(p => {
      phaseSheet.addRow({ phase: p });
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=workflow_template.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error: unknown) {
    logger.error({ err: error }, "Error generating template");
    res.status(500).json({ error: "Failed to generate template" });
  }
});

router.post("/api/job-types/:jobTypeId/templates/import", requireAuth, requireRole("ADMIN", "MANAGER"), upload.single("file"), async (req, res) => {
  try {
    const jobTypeId = String(req.params.jobTypeId);
    const companyId = req.companyId;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const [jobType] = await db.select().from(jobTypes)
      .where(and(eq(jobTypes.id, jobTypeId), eq(jobTypes.companyId, companyId!)));
    if (!jobType) {
      return res.status(404).json({ error: "Job type not found" });
    }

    const allStages = await db.select().from(activityStages)
      .where(eq(activityStages.companyId, companyId!));
    const stageByNumber = new Map(allStages.map(s => [s.stageNumber, s]));
    const stageByName = new Map(allStages.map(s => [s.name.toLowerCase().trim(), s]));

    const allConsultants = await db.select().from(activityConsultants)
      .where(eq(activityConsultants.companyId, companyId!));
    const consultantByName = new Map(allConsultants.map(c => [c.name.toLowerCase().trim(), c]));

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const sheet = workbook.getWorksheet("Activities") || workbook.getWorksheet(1);
    if (!sheet) {
      return res.status(400).json({ error: "No 'Activities' sheet found in the file" });
    }

    function getCellText(cell: ExcelJS.Cell): string {
      const val = cell.value;
      if (val === null || val === undefined) return "";
      if (typeof val === "string") return val.trim();
      if (typeof val === "number" || typeof val === "boolean") return String(val);
      if (typeof val === "object" && val !== null && "richText" in val) {
        return ((val as {richText: {text: string}[]}).richText || []).map((r) => r.text || "").join("").trim();
      }
      if (typeof val === "object" && val !== null && "text" in val) {
        return String((val as Record<string, unknown>).text || "").trim();
      }
      if (typeof val === "object" && val !== null && "result" in val) {
        return String((val as Record<string, unknown>).result || "").trim();
      }
      return String(val).trim();
    }

    const rows: Record<string, unknown>[] = [];
    const errors: string[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const stageNumberText = getCellText(row.getCell(1));
      const stageNumberRaw = row.getCell(1).value;
      const stageNameRaw = getCellText(row.getCell(2));
      const category = getCellText(row.getCell(3)) || null;
      const name = getCellText(row.getCell(4));
      const description = getCellText(row.getCell(5)) || null;
      const estimatedDaysText = getCellText(row.getCell(6));
      const estimatedDaysRaw = row.getCell(6).value;
      const consultantRaw = getCellText(row.getCell(7));
      const deliverable = getCellText(row.getCell(8)) || null;
      const phase = getCellText(row.getCell(9)) || null;

      if (!name) return;

      const stageNumber = typeof stageNumberRaw === "number" ? stageNumberRaw : parseInt(stageNumberText || String(stageNumberRaw));
      let stage = stageByNumber.get(stageNumber);
      if (!stage && stageNameRaw) {
        stage = stageByName.get(stageNameRaw.toLowerCase());
      }
      if (!stage) {
        errors.push(`Row ${rowNumber}: Stage "${stageNumberRaw || stageNameRaw}" not found`);
        return;
      }

      const estimatedDays = typeof estimatedDaysRaw === "number" ? estimatedDaysRaw : parseInt(estimatedDaysText || String(estimatedDaysRaw)) || 14;

      let consultantId: string | null = null;
      let consultantName: string | null = consultantRaw || null;
      if (consultantRaw) {
        const found = consultantByName.get(consultantRaw.toLowerCase());
        if (found) {
          consultantId = found.id;
          consultantName = found.name;
        }
      }

      rows.push({
        jobTypeId,
        companyId: companyId!,
        stageId: stage.id,
        category,
        name,
        description,
        estimatedDays,
        consultantId,
        consultantName,
        deliverable,
        jobPhase: phase,
        sortOrder: rowNumber - 1,
      });
    });

    if (rows.length === 0) {
      return res.status(400).json({
        error: "No valid activities found in the file",
        details: errors.length > 0 ? errors : undefined,
      });
    }

    await db.transaction(async (tx) => {
      for (const row of rows) {
        await tx.insert(activityTemplates).values(row);
      }
    });

    res.status(201).json({
      success: true,
      imported: rows.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error importing activities");
    res.status(500).json({ error: "Failed to import activities" });
  }
});

const activityTaskCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "STUCK", "DONE", "ON_HOLD"]).optional().default("NOT_STARTED"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional().nullable(),
  consultant: z.string().optional().nullable(),
  projectStage: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  reminderDate: z.string().optional().nullable(),
  jobId: z.string().optional().nullable(),
});

router.get("/api/job-activities/:activityId/tasks", requireAuth, requirePermission("tasks"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const activityId = String(req.params.activityId);

    const [activity] = await db.select().from(jobActivities).where(
      and(eq(jobActivities.id, activityId), eq(jobActivities.companyId, companyId!))
    );
    if (!activity) return res.status(404).json({ error: "Activity not found" });

    const { storage } = await import("../storage");
    const activityTasks = await storage.getTasksByActivity(activityId, companyId!);
    res.json(activityTasks);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching activity tasks");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch activity tasks" });
  }
});

router.post("/api/job-activities/:activityId/tasks", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const activityId = String(req.params.activityId);
    const userId = req.session.userId;

    const parsed = activityTaskCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const [activity] = await db.select().from(jobActivities).where(
      and(eq(jobActivities.id, activityId), eq(jobActivities.companyId, companyId!))
    );
    if (!activity) return res.status(404).json({ error: "Activity not found" });

    const validatedData = parsed.data;

    if (validatedData.dueDate) {
      const dueDate = new Date(validatedData.dueDate);
      if (isNaN(dueDate.getTime())) {
        return res.status(400).json({ error: "Invalid due date" });
      }
      if (activity.startDate && dueDate < new Date(activity.startDate)) {
        return res.status(400).json({ error: "Due date must be on or after activity start date" });
      }
      if (activity.endDate && dueDate > new Date(activity.endDate)) {
        return res.status(400).json({ error: "Due date must be on or before activity end date" });
      }
    }

    if (validatedData.reminderDate) {
      const reminderDate = new Date(validatedData.reminderDate);
      if (isNaN(reminderDate.getTime())) {
        return res.status(400).json({ error: "Invalid reminder date" });
      }
    }

    const { storage } = await import("../storage");

    let groupId = activity.taskGroupId;
    if (!groupId) {
      const group = await storage.createTaskGroup({
        companyId: companyId!,
        name: `Activity: ${activity.name}`,
        color: "#6366f1",
      });
      groupId = group.id;
      await db.update(jobActivities).set({ taskGroupId: groupId }).where(eq(jobActivities.id, activityId));
    }

    const taskData: Record<string, unknown> = {
      groupId,
      jobActivityId: activityId,
      jobId: activity.jobId,
      title: validatedData.title,
      status: validatedData.status,
      priority: validatedData.priority || null,
      consultant: validatedData.consultant || null,
      projectStage: validatedData.projectStage || null,
      createdById: userId,
    };

    if (validatedData.dueDate) {
      taskData.dueDate = new Date(validatedData.dueDate);
    }
    if (validatedData.reminderDate) {
      taskData.reminderDate = new Date(validatedData.reminderDate);
    }

    const task = await storage.createTask(taskData);

    if (userId) {
      await storage.setTaskAssignees(task.id, [userId]);
    }

    const taskWithDetails = await storage.getTask(task.id);
    res.status(201).json(taskWithDetails || task);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating activity task");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create activity task" });
  }
});

router.post("/api/job-activities/:activityId/tasks/reorder", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const activityId = String(req.params.activityId);

    const reorderSchema = z.object({ taskIds: z.array(z.string()) });
    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "taskIds must be an array of strings" });
    }

    const { taskIds } = parsed.data;

    const [activity] = await db.select().from(jobActivities).where(
      and(eq(jobActivities.id, activityId), eq(jobActivities.companyId, companyId!))
    );
    if (!activity) return res.status(404).json({ error: "Activity not found" });

    const { storage } = await import("../storage");
    const allTasks = await storage.getTasksByActivity(activityId, companyId!);
    const validTaskIds = new Set(allTasks.map(t => t.id));

    for (const id of taskIds) {
      if (!validTaskIds.has(id)) {
        return res.status(400).json({ error: `Task ${id} does not belong to this activity` });
      }
    }

    await db.transaction(async (tx) => {
      for (let i = 0; i < taskIds.length; i++) {
        await tx.update(tasks)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(eq(tasks.id, taskIds[i]));
      }
    });

    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error reordering activity tasks");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to reorder activity tasks" });
  }
});

export const projectActivitiesRouter = router;
