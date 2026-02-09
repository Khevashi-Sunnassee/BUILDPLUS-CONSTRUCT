import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { eq, and, asc, desc } from "drizzle-orm";
import { db } from "../db";
import {
  jobTypes, activityStages, activityConsultants,
  activityTemplates, activityTemplateSubtasks,
  jobActivities, jobActivityAssignees, jobActivityUpdates, jobActivityFiles,
} from "@shared/schema";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import logger from "../lib/logger";

const router = Router();

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
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching job types");
    res.status(500).json({ error: "Failed to fetch job types" });
  }
});

router.get("/api/job-types/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const [result] = await db.select().from(jobTypes)
      .where(and(eq(jobTypes.id, String(req.params.id)), eq(jobTypes.companyId, companyId!)));
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
    const parsed = jobTypeSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

    const [existing] = await db.select().from(jobTypes)
      .where(and(eq(jobTypes.id, String(req.params.id)), eq(jobTypes.companyId, companyId!)));
    if (!existing) return res.status(404).json({ error: "Job type not found" });

    const [result] = await db.update(jobTypes)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(jobTypes.id, String(req.params.id)))
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
    const [existing] = await db.select().from(jobTypes)
      .where(and(eq(jobTypes.id, String(req.params.id)), eq(jobTypes.companyId, companyId!)));
    if (!existing) return res.status(404).json({ error: "Job type not found" });

    await db.delete(jobTypes).where(eq(jobTypes.id, String(req.params.id)));
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
    const parsed = stageSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

    const [existing] = await db.select().from(activityStages)
      .where(and(eq(activityStages.id, String(req.params.id)), eq(activityStages.companyId, companyId!)));
    if (!existing) return res.status(404).json({ error: "Stage not found" });

    const [result] = await db.update(activityStages)
      .set(parsed.data)
      .where(eq(activityStages.id, String(req.params.id)))
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
    const [existing] = await db.select().from(activityStages)
      .where(and(eq(activityStages.id, String(req.params.id)), eq(activityStages.companyId, companyId!)));
    if (!existing) return res.status(404).json({ error: "Stage not found" });

    await db.delete(activityStages).where(eq(activityStages.id, String(req.params.id)));
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
    const parsed = consultantSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

    const [existing] = await db.select().from(activityConsultants)
      .where(and(eq(activityConsultants.id, String(req.params.id)), eq(activityConsultants.companyId, companyId!)));
    if (!existing) return res.status(404).json({ error: "Consultant not found" });

    const [result] = await db.update(activityConsultants)
      .set(parsed.data)
      .where(eq(activityConsultants.id, String(req.params.id)))
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
    const [existing] = await db.select().from(activityConsultants)
      .where(and(eq(activityConsultants.id, String(req.params.id)), eq(activityConsultants.companyId, companyId!)));
    if (!existing) return res.status(404).json({ error: "Consultant not found" });

    await db.delete(activityConsultants).where(eq(activityConsultants.id, String(req.params.id)));
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

    const subtasks = await db.select().from(activityTemplateSubtasks)
      .where(
        templates.length > 0
          ? eq(activityTemplateSubtasks.templateId, activityTemplateSubtasks.templateId)
          : eq(activityTemplateSubtasks.templateId, "NEVER_MATCH")
      );

    const allSubtasks = templates.length > 0
      ? await db.select().from(activityTemplateSubtasks)
          .orderBy(asc(activityTemplateSubtasks.sortOrder))
      : [];

    const templateIds = new Set(templates.map(t => t.id));
    const filteredSubtasks = allSubtasks.filter(s => templateIds.has(s.templateId));

    const result = templates.map(t => ({
      ...t,
      subtasks: filteredSubtasks.filter(s => s.templateId === t.id),
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

    let assignees: any[] = [];
    if (activityIds.length > 0) {
      assignees = await db.select().from(jobActivityAssignees);
      assignees = assignees.filter(a => activityIds.includes(a.activityId));
    }

    const result = activities.map(a => ({
      ...a,
      assignees: assignees.filter(x => x.activityId === a.id),
    }));

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
    const { jobTypeId } = req.body;

    if (!jobTypeId) return res.status(400).json({ error: "jobTypeId is required" });

    const [jt] = await db.select().from(jobTypes)
      .where(and(eq(jobTypes.id, jobTypeId), eq(jobTypes.companyId, companyId!)));
    if (!jt) return res.status(404).json({ error: "Job type not found" });

    const templates = await db.select().from(activityTemplates)
      .where(and(eq(activityTemplates.jobTypeId, jobTypeId), eq(activityTemplates.companyId, companyId!)))
      .orderBy(asc(activityTemplates.sortOrder));

    if (templates.length === 0) {
      return res.status(400).json({ error: "No templates found for this job type. Build the workflow first." });
    }

    const allSubtasks = await db.select().from(activityTemplateSubtasks)
      .orderBy(asc(activityTemplateSubtasks.sortOrder));
    const templateIds = new Set(templates.map(t => t.id));
    const filteredSubtasks = allSubtasks.filter(s => templateIds.has(s.templateId));

    const createdActivities: any[] = [];

    await db.transaction(async (tx) => {
      for (const template of templates) {
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
          createdById: req.session.userId,
        }).returning();

        createdActivities.push(activity);

        const subs = filteredSubtasks.filter(s => s.templateId === template.id);
        for (const sub of subs) {
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
            createdById: req.session.userId,
          });
        }
      }
    });

    res.status(201).json({ success: true, count: createdActivities.length });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error instantiating activities");
    res.status(500).json({ error: "Failed to instantiate activities" });
  }
});

router.patch("/api/job-activities/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
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
      category: z.string().optional().nullable(),
      jobPhase: z.string().optional().nullable(),
    });

    const parsed = activityUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

    const [existing] = await db.select().from(jobActivities)
      .where(and(eq(jobActivities.id, String(req.params.id)), eq(jobActivities.companyId, companyId!)));
    if (!existing) return res.status(404).json({ error: "Activity not found" });

    const updateData: any = { ...parsed.data, updatedAt: new Date() };
    if (updateData.startDate !== undefined) {
      updateData.startDate = updateData.startDate ? new Date(updateData.startDate) : null;
    }
    if (updateData.endDate !== undefined) {
      updateData.endDate = updateData.endDate ? new Date(updateData.endDate) : null;
    }
    if (updateData.reminderDate !== undefined) {
      updateData.reminderDate = updateData.reminderDate ? new Date(updateData.reminderDate) : null;
    }

    const [result] = await db.update(jobActivities)
      .set(updateData)
      .where(eq(jobActivities.id, String(req.params.id)))
      .returning();
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating activity");
    res.status(500).json({ error: "Failed to update activity" });
  }
});

router.delete("/api/job-activities/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const [existing] = await db.select().from(jobActivities)
      .where(and(eq(jobActivities.id, String(req.params.id)), eq(jobActivities.companyId, companyId!)));
    if (!existing) return res.status(404).json({ error: "Activity not found" });

    await db.delete(jobActivities).where(eq(jobActivities.id, String(req.params.id)));
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
// ACTIVITY ASSIGNEES
// ============================================================================

router.get("/api/job-activities/:id/assignees", requireAuth, async (req, res) => {
  try {
    const result = await db.select().from(jobActivityAssignees)
      .where(eq(jobActivityAssignees.activityId, String(req.params.id)));
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
    const updates = await db.select().from(jobActivityUpdates)
      .where(eq(jobActivityUpdates.activityId, String(req.params.id)))
      .orderBy(asc(jobActivityUpdates.createdAt));

    const files = await db.select().from(jobActivityFiles)
      .where(eq(jobActivityFiles.activityId, String(req.params.id)));

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

    const [result] = await db.insert(jobActivityUpdates).values({
      activityId: String(req.params.id),
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
    const [existing] = await db.select().from(jobActivityUpdates)
      .where(eq(jobActivityUpdates.id, String(req.params.id)));
    if (!existing) return res.status(404).json({ error: "Update not found" });
    if (existing.userId !== req.session.userId) return res.status(403).json({ error: "Can only delete own updates" });

    await db.delete(jobActivityUpdates).where(eq(jobActivityUpdates.id, String(req.params.id)));
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
    const result = await db.select().from(jobActivityFiles)
      .where(eq(jobActivityFiles.activityId, String(req.params.id)))
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
      const { uploadFile } = await import("../replit_integrations/object_storage");
      const fileName = `activity-files/${activityId}/${Date.now()}-${req.file.originalname}`;
      fileUrl = await uploadFile(fileName, req.file.buffer, req.file.mimetype);
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
    await db.delete(jobActivityFiles).where(eq(jobActivityFiles.id, String(req.params.id)));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting activity file");
    res.status(500).json({ error: "Failed to delete file" });
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
      const createdStages: any[] = [];
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

      const createdJobTypes: any[] = [];
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
        stageMap[s.stageNumber] = s.id;
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

      const devJobType = createdJobTypes.find((jt: any) => jt.name === "Development to Construction");
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

export const projectActivitiesRouter = router;
