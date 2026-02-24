import { Router } from "express";
import {
  db, requireRoleOrSuperAdmin, eq, count, and, desc, asc,
  activityTemplates, activityTemplateSubtasks,
  jobActivities, jobActivityAssignees, jobActivityUpdates, jobActivityFiles,
  activityStages, activityConsultants,
  jobTypes, jobs, tasks,
} from "./shared";

const router = Router();

router.get("/api/admin/data-management/activity-templates", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const result = await db
      .select({
        id: activityTemplates.id,
        name: activityTemplates.name,
        description: activityTemplates.description,
        category: activityTemplates.category,
        estimatedDays: activityTemplates.estimatedDays,
        consultantName: activityTemplates.consultantName,
        deliverable: activityTemplates.deliverable,
        jobPhase: activityTemplates.jobPhase,
        jobTypeName: jobTypes.name,
        stageName: activityStages.name,
        createdAt: activityTemplates.createdAt,
      })
      .from(activityTemplates)
      .leftJoin(jobTypes, eq(activityTemplates.jobTypeId, jobTypes.id))
      .leftJoin(activityStages, eq(activityTemplates.stageId, activityStages.id))
      .where(eq(activityTemplates.companyId, companyId))
      .orderBy(asc(activityTemplates.sortOrder), asc(activityTemplates.name))
      .limit(1000);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.delete("/api/admin/data-management/activity-templates/:id", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = String(req.params.id);

    const [template] = await db.select({ id: activityTemplates.id }).from(activityTemplates).where(and(eq(activityTemplates.id, id), eq(activityTemplates.companyId, companyId)));
    if (!template) return res.status(404).json({ error: "Activity template not found or does not belong to your company" });

    await db.delete(activityTemplateSubtasks).where(eq(activityTemplateSubtasks.templateId, id));
    await db.delete(activityTemplates).where(and(eq(activityTemplates.id, id), eq(activityTemplates.companyId, companyId)));
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/admin/data-management/job-activities", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const result = await db
      .select({
        id: jobActivities.id,
        name: jobActivities.name,
        description: jobActivities.description,
        category: jobActivities.category,
        status: jobActivities.status,
        consultantName: jobActivities.consultantName,
        jobPhase: jobActivities.jobPhase,
        startDate: jobActivities.startDate,
        endDate: jobActivities.endDate,
        jobName: jobs.name,
        jobNumber: jobs.jobNumber,
        stageName: activityStages.name,
        createdAt: jobActivities.createdAt,
      })
      .from(jobActivities)
      .leftJoin(jobs, eq(jobActivities.jobId, jobs.id))
      .leftJoin(activityStages, eq(jobActivities.stageId, activityStages.id))
      .where(eq(jobActivities.companyId, companyId))
      .orderBy(desc(jobActivities.createdAt))
      .limit(1000);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.delete("/api/admin/data-management/job-activities/:id", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = String(req.params.id);

    const [activity] = await db.select({ id: jobActivities.id }).from(jobActivities).where(and(eq(jobActivities.id, id), eq(jobActivities.companyId, companyId)));
    if (!activity) return res.status(404).json({ error: "Job activity not found or does not belong to your company" });

    await db.update(tasks).set({ jobActivityId: null }).where(eq(tasks.jobActivityId, id));
    await db.delete(jobActivityFiles).where(eq(jobActivityFiles.activityId, id));
    await db.delete(jobActivityUpdates).where(eq(jobActivityUpdates.activityId, id));
    await db.delete(jobActivityAssignees).where(eq(jobActivityAssignees.activityId, id));
    await db.delete(jobActivities).where(and(eq(jobActivities.id, id), eq(jobActivities.companyId, companyId)));
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/admin/data-management/activity-stages", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const result = await db
      .select({
        id: activityStages.id,
        name: activityStages.name,
        stageNumber: activityStages.stageNumber,
        sortOrder: activityStages.sortOrder,
        createdAt: activityStages.createdAt,
      })
      .from(activityStages)
      .where(eq(activityStages.companyId, companyId))
      .orderBy(asc(activityStages.stageNumber))
      .limit(1000);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.delete("/api/admin/data-management/activity-stages/:id", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = String(req.params.id);

    const [stage] = await db.select({ id: activityStages.id }).from(activityStages).where(and(eq(activityStages.id, id), eq(activityStages.companyId, companyId)));
    if (!stage) return res.status(404).json({ error: "Activity stage not found or does not belong to your company" });

    const [templateCount] = await db.select({ count: count() }).from(activityTemplates).where(and(eq(activityTemplates.stageId, id), eq(activityTemplates.companyId, companyId)));
    if (templateCount.count > 0) {
      return res.status(409).json({ error: `Cannot delete: this stage is used by ${templateCount.count} activity template(s). Remove those templates first.` });
    }

    const [activityCount] = await db.select({ count: count() }).from(jobActivities).where(and(eq(jobActivities.stageId, id), eq(jobActivities.companyId, companyId)));
    if (activityCount.count > 0) {
      return res.status(409).json({ error: `Cannot delete: this stage is used by ${activityCount.count} job activit(ies). Remove those activities first.` });
    }

    await db.delete(activityStages).where(and(eq(activityStages.id, id), eq(activityStages.companyId, companyId)));
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/admin/data-management/activity-consultants", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const result = await db
      .select({
        id: activityConsultants.id,
        name: activityConsultants.name,
        sortOrder: activityConsultants.sortOrder,
        createdAt: activityConsultants.createdAt,
      })
      .from(activityConsultants)
      .where(eq(activityConsultants.companyId, companyId))
      .orderBy(asc(activityConsultants.name))
      .limit(1000);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.delete("/api/admin/data-management/activity-consultants/:id", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = String(req.params.id);

    const [consultant] = await db.select({ id: activityConsultants.id }).from(activityConsultants).where(and(eq(activityConsultants.id, id), eq(activityConsultants.companyId, companyId)));
    if (!consultant) return res.status(404).json({ error: "Activity consultant not found or does not belong to your company" });

    const [templateCount] = await db.select({ count: count() }).from(activityTemplates).where(and(eq(activityTemplates.consultantId, id), eq(activityTemplates.companyId, companyId)));
    if (templateCount.count > 0) {
      return res.status(409).json({ error: `Cannot delete: this consultant is assigned to ${templateCount.count} activity template(s). Remove those assignments first.` });
    }

    await db.delete(activityConsultants).where(and(eq(activityConsultants.id, id), eq(activityConsultants.companyId, companyId)));
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

export default router;
