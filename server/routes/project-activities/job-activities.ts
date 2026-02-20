import { Router } from "express";
import { z } from "zod";
import { eq, and, asc, sql, inArray, isNull } from "drizzle-orm";
import { db } from "../../db";
import {
  jobTypes, activityTemplates, activityTemplateSubtasks,
  activityTemplateChecklists, jobActivities, jobActivityAssignees,
  jobActivityChecklists,
} from "@shared/schema";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { logJobChange } from "../../services/job-audit.service";
import { count } from "drizzle-orm";
import {
  addWorkingDaysHelper, nextWorkingDayHelper, ensureWorkingDayHelper,
  subtractWorkingDaysHelper,
} from "./shared";

const router = Router();

router.get("/api/jobs/:jobId/activities", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const jobId = String(req.params.jobId);

    const activities = await db.select().from(jobActivities)
      .where(and(eq(jobActivities.jobId, jobId), eq(jobActivities.companyId, companyId!)))
      .orderBy(asc(jobActivities.sortOrder))
      .limit(1000);

    const activityIds = activities.map(a => a.id);

    let assignees: Record<string, unknown>[] = [];
    let checklistCounts: Array<{ activityId: string; total: number; completed: number }> = [];
    if (activityIds.length > 0) {
      const [assigneesResult, clRows] = await Promise.all([
        db.select().from(jobActivityAssignees)
          .where(inArray(jobActivityAssignees.activityId, activityIds))
          .limit(1000),
        db.select({
          activityId: jobActivityChecklists.activityId,
          total: count(),
          completed: sql<number>`count(*) filter (where ${jobActivityChecklists.isCompleted} = true)`,
        }).from(jobActivityChecklists)
          .where(inArray(jobActivityChecklists.activityId, activityIds))
          .groupBy(jobActivityChecklists.activityId),
      ]);
      assignees = assigneesResult;
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
      .where(and(eq(jobTypes.id, jobTypeId), eq(jobTypes.companyId, companyId!)))
      .limit(1);
    if (!jt) return res.status(404).json({ error: "Job type not found" });

    const templates = await db.select().from(activityTemplates)
      .where(and(eq(activityTemplates.jobTypeId, jobTypeId), eq(activityTemplates.companyId, companyId!)))
      .orderBy(asc(activityTemplates.sortOrder))
      .limit(500);

    if (templates.length === 0) {
      return res.status(400).json({ error: "No templates found for this job type. Build the workflow first." });
    }

    const templateIds = templates.map(t => t.id);
    const filteredSubtasks = templateIds.length > 0
      ? await db.select().from(activityTemplateSubtasks)
          .where(inArray(activityTemplateSubtasks.templateId, templateIds))
          .orderBy(asc(activityTemplateSubtasks.sortOrder))
          .limit(500)
      : [];

    const filteredChecklists = templateIds.length > 0
      ? await db.select().from(activityTemplateChecklists)
          .where(inArray(activityTemplateChecklists.templateId, templateIds))
          .orderBy(asc(activityTemplateChecklists.sortOrder))
          .limit(500)
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
      .orderBy(asc(jobActivities.sortOrder))
      .limit(1000);

    if (activities.length === 0) {
      return res.status(404).json({ error: "No activities found for this job" });
    }

    const templateIds = activities.map(a => a.templateId).filter(Boolean) as string[];
    if (templateIds.length === 0) {
      return res.status(400).json({ error: "Activities have no linked templates" });
    }

    const templates = await db.select().from(activityTemplates)
      .where(inArray(activityTemplates.id, templateIds))
      .limit(500);

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
      .where(and(eq(jobActivities.id, id), eq(jobActivities.companyId, companyId!)))
      .limit(1);
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
        .where(eq(jobActivityChecklists.activityId, id))
        .limit(500);
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
      updateData.startDate = updateData.startDate ? new Date(updateData.startDate as string) : null;
    }
    if (updateData.endDate !== undefined) {
      updateData.endDate = updateData.endDate ? new Date(updateData.endDate as string) : null;
    }
    if (updateData.reminderDate !== undefined) {
      updateData.reminderDate = updateData.reminderDate ? new Date(updateData.reminderDate as string) : null;
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
      .where(and(eq(jobActivities.id, id), eq(jobActivities.companyId, companyId!)))
      .limit(1);
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

export default router;
