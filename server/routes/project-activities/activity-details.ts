import { Router } from "express";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  jobActivities, jobActivityAssignees, jobActivityUpdates,
  jobActivityFiles, jobActivityChecklists,
  checklistTemplates, checklistInstances,
} from "@shared/schema";
import { requireAuth } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { logJobChange } from "../../services/job-audit.service";
import {
  upload, addWorkingDaysHelper, ensureWorkingDayHelper,
  resolveActivityStart,
} from "./shared";

const router = Router();

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
      .orderBy(asc(jobActivities.sortOrder))
      .limit(1000);

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

router.get("/api/job-activities/:id/assignees", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const result = await db.select().from(jobActivityAssignees)
      .where(eq(jobActivityAssignees.activityId, id))
      .limit(200);
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
      .where(eq(jobActivityAssignees.activityId, activityId))
      .limit(200);
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error setting activity assignees");
    res.status(500).json({ error: "Failed to set assignees" });
  }
});

router.get("/api/job-activities/:id/updates", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const safeLimit = Math.min(parseInt(req.query.limit as string) || 500, 1000);
    const updates = await db.select().from(jobActivityUpdates)
      .where(eq(jobActivityUpdates.activityId, id))
      .orderBy(asc(jobActivityUpdates.createdAt))
      .limit(safeLimit);

    const files = await db.select().from(jobActivityFiles)
      .where(eq(jobActivityFiles.activityId, id))
      .limit(500);

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
      .where(eq(jobActivityUpdates.id, id))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Update not found" });
    if (existing.userId !== req.session.userId) return res.status(403).json({ error: "Can only delete own updates" });

    await db.delete(jobActivityUpdates).where(eq(jobActivityUpdates.id, id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting activity update");
    res.status(500).json({ error: "Failed to delete update" });
  }
});

router.get("/api/job-activities/:id/files", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const result = await db.select().from(jobActivityFiles)
      .where(eq(jobActivityFiles.activityId, id))
      .orderBy(desc(jobActivityFiles.createdAt))
      .limit(500);
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
      const { ObjectStorageService } = await import("../../replit_integrations/object_storage");
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

router.get("/api/job-activities/:activityId/checklists", requireAuth, async (req, res) => {
  try {
    const activityId = req.params.activityId as string;
    const companyId = req.companyId;

    const [activityCheck] = await db.select({ id: jobActivities.id })
      .from(jobActivities)
      .where(and(eq(jobActivities.id, activityId), eq(jobActivities.companyId, companyId!)))
      .limit(1);
    if (!activityCheck) return res.status(404).json({ error: "Activity not found" });

    const linked = await db.select().from(jobActivityChecklists)
      .where(eq(jobActivityChecklists.activityId, activityId))
      .orderBy(asc(jobActivityChecklists.sortOrder))
      .limit(100);

    const enriched = await Promise.all(linked.map(async (item) => {
      let template = null;
      let instance = null;

      if (item.checklistTemplateRefId) {
        const [tmpl] = await db.select().from(checklistTemplates)
          .where(and(eq(checklistTemplates.id, item.checklistTemplateRefId), eq(checklistTemplates.companyId, companyId!)))
          .limit(1);
        template = tmpl || null;
      }

      if (item.instanceId) {
        const [inst] = await db.select().from(checklistInstances)
          .where(and(eq(checklistInstances.id, item.instanceId), eq(checklistInstances.companyId, companyId!)))
          .limit(1);
        instance = inst || null;
      }

      return {
        ...item,
        template: template ? { id: template.id, name: template.name, sections: template.sections, version: template.version } : null,
        instance: instance ? { id: instance.id, status: instance.status, responses: instance.responses, completionRate: instance.completionRate } : null,
      };
    }));

    res.json(enriched);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching activity checklists");
    res.status(500).json({ error: "Failed to fetch checklists" });
  }
});

router.post("/api/job-activity-checklists/:id/save", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const companyId = req.companyId;
    const { responses, completionRate } = req.body;

    if (!responses || typeof responses !== "object" || Array.isArray(responses)) {
      return res.status(400).json({ error: "responses must be an object" });
    }
    const rate = typeof completionRate === "string" ? completionRate : String(completionRate || "0");
    const parsedRate = parseFloat(rate);
    if (isNaN(parsedRate) || parsedRate < 0 || parsedRate > 100) {
      return res.status(400).json({ error: "completionRate must be a number between 0 and 100" });
    }

    const [actChecklist] = await db.select().from(jobActivityChecklists)
      .where(eq(jobActivityChecklists.id, id))
      .limit(1);
    if (!actChecklist) return res.status(404).json({ error: "Activity checklist not found" });

    const [activity] = await db.select({ jobId: jobActivities.jobId, companyId: jobActivities.companyId })
      .from(jobActivities)
      .where(and(eq(jobActivities.id, actChecklist.activityId), eq(jobActivities.companyId, companyId!)))
      .limit(1);
    if (!activity) return res.status(404).json({ error: "Activity not found" });

    if (!actChecklist.checklistTemplateRefId) {
      return res.status(400).json({ error: "Activity checklist has no linked template" });
    }

    let instanceId = actChecklist.instanceId;

    if (!instanceId) {
      const instanceNumber = `CHK-ACT-${Date.now()}`;
      let templateVersion = 1;
      const [tmpl] = await db.select({ version: checklistTemplates.version })
        .from(checklistTemplates)
        .where(and(eq(checklistTemplates.id, actChecklist.checklistTemplateRefId), eq(checklistTemplates.companyId, companyId!)))
        .limit(1);
      if (tmpl) templateVersion = tmpl.version;

      const [newInstance] = await db.insert(checklistInstances).values({
        companyId: companyId!,
        templateId: actChecklist.checklistTemplateRefId,
        templateVersion,
        instanceNumber,
        jobId: activity.jobId,
        status: "in_progress",
        responses: responses,
        completionRate: rate,
      }).returning();
      instanceId = newInstance.id;

      await db.update(jobActivityChecklists)
        .set({ instanceId })
        .where(eq(jobActivityChecklists.id, id));
    } else {
      await db.update(checklistInstances)
        .set({
          responses: responses,
          completionRate: rate,
          status: "in_progress",
          updatedAt: new Date(),
        })
        .where(and(eq(checklistInstances.id, instanceId), eq(checklistInstances.companyId, companyId!)));
    }

    const isComplete = parsedRate >= 100;
    await db.update(jobActivityChecklists)
      .set({
        isCompleted: isComplete,
        completedAt: isComplete ? new Date() : null,
        completedById: isComplete ? req.session.userId : null,
      })
      .where(eq(jobActivityChecklists.id, id));

    res.json({ success: true, instanceId });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error saving activity checklist responses");
    res.status(500).json({ error: "Failed to save checklist responses" });
  }
});

router.post("/api/job-activity-checklists/:id/toggle", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const [existing] = await db.select().from(jobActivityChecklists)
      .where(eq(jobActivityChecklists.id, id))
      .limit(1);
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

export default router;
