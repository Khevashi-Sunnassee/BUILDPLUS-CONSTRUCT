import { Router } from "express";
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../../db";
import {
  jobActivities, taskGroups, tasks, jobs,
  InsertTask,
} from "@shared/schema";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";

const router = Router();

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
    ).limit(1);
    if (!activity) return res.status(404).json({ error: "Activity not found" });

    const { storage } = await import("../../storage");
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
    ).limit(1);
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

    const { storage } = await import("../../storage");

    let groupId = activity.taskGroupId;
    if (!groupId) {
      const [job] = activity.jobId
        ? await db.select({ id: jobs.id, jobNumber: jobs.jobNumber }).from(jobs)
            .where(eq(jobs.id, activity.jobId)).limit(1)
        : [null];

      const programmeGroupName = job ? `${job.jobNumber} Programme Activities` : `Programme Activities`;

      if (job) {
        const [existingGroup] = await db.select().from(taskGroups)
          .where(and(
            eq(taskGroups.companyId, companyId!),
            eq(taskGroups.jobId, job.id),
            eq(taskGroups.name, programmeGroupName),
          ))
          .limit(1);
        if (existingGroup) {
          groupId = existingGroup.id;
        }
      }

      if (!groupId) {
        const group = await storage.createTaskGroup({
          companyId: companyId!,
          name: programmeGroupName,
          jobId: job?.id || null,
        });
        groupId = group.id;
      }
      await db.update(jobActivities).set({ taskGroupId: groupId }).where(eq(jobActivities.id, activityId));
    }

    let parentTaskId: string | null = null;
    const activityParentTitle = activity.name || `Activity ${activityId}`;
    const [existingParent] = await db.select().from(tasks).where(
      and(
        eq(tasks.groupId, groupId),
        eq(tasks.jobActivityId, activityId),
        isNull(tasks.parentId),
      )
    ).limit(1);

    if (existingParent) {
      parentTaskId = existingParent.id;
    } else {
      const parentTask = await storage.createTask({
        groupId,
        jobActivityId: activityId,
        jobId: activity.jobId,
        title: activityParentTitle,
        status: "NOT_STARTED",
        createdById: userId,
      } as InsertTask);
      parentTaskId = parentTask.id;
    }

    const taskData: Record<string, unknown> = {
      groupId,
      jobActivityId: activityId,
      jobId: activity.jobId,
      parentId: parentTaskId,
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

    const task = await storage.createTask(taskData as InsertTask);

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
    ).limit(1);
    if (!activity) return res.status(404).json({ error: "Activity not found" });

    const { storage } = await import("../../storage");
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

export default router;
