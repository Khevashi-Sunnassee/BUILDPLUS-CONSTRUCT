import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "./middleware/auth.middleware";
import logger from "../lib/logger";
import { db } from "../db";
import {
  pmCallLogs,
  pmCallLogLevels,
  jobLevelCycleTimes,
  jobs,
  users,
  productionSlots,
  draftingProgram,
} from "@shared/schema";
import { eq, and, desc, gte, asc, sql } from "drizzle-orm";
import { PM_CALL_LOGS_ROUTES, ADMIN_ROUTES } from "@shared/api-routes";

const router = Router();

const createCallLogSchema = z.object({
  jobId: z.string().min(1),
  contactName: z.string().min(1),
  contactPhone: z.string().nullable().optional(),
  callDateTime: z.string().min(1),
  deliveryTime: z.string().nullable().optional(),
  nextDeliveryDate: z.string().nullable().optional(),
  draftingConcerns: z.string().nullable().optional(),
  clientDesignChanges: z.string().nullable().optional(),
  issuesReported: z.string().nullable().optional(),
  installationProblems: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  notifyManager: z.boolean().optional().default(false),
  notifyClient: z.boolean().optional().default(false),
  notifyProduction: z.boolean().optional().default(false),
  updateProductionSchedule: z.boolean().optional().default(false),
  updateDraftingSchedule: z.boolean().optional().default(false),
  levels: z.array(z.object({
    levelCycleTimeId: z.string().min(1),
    level: z.string().min(1),
    buildingNumber: z.number().int().default(1),
    pourLabel: z.string().nullable().optional(),
    sequenceOrder: z.number().int().default(0),
    status: z.enum(["ON_TIME", "LATE"]),
    daysLate: z.number().int().min(0).default(0),
    originalStartDate: z.string().nullable().optional(),
    originalEndDate: z.string().nullable().optional(),
    adjustedStartDate: z.string().nullable().optional(),
    adjustedEndDate: z.string().nullable().optional(),
  })),
});

router.get(PM_CALL_LOGS_ROUTES.LIST, requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = String(req.session.companyId);
    const jobId = req.query.jobId ? String(req.query.jobId) : undefined;

    const conditions = [eq(pmCallLogs.companyId, companyId)];
    if (jobId) {
      conditions.push(eq(pmCallLogs.jobId, jobId));
    }

    const logs = await db
      .select({
        id: pmCallLogs.id,
        jobId: pmCallLogs.jobId,
        jobName: jobs.name,
        contactName: pmCallLogs.contactName,
        contactPhone: pmCallLogs.contactPhone,
        callDateTime: pmCallLogs.callDateTime,
        deliveryTime: pmCallLogs.deliveryTime,
        nextDeliveryDate: pmCallLogs.nextDeliveryDate,
        draftingConcerns: pmCallLogs.draftingConcerns,
        clientDesignChanges: pmCallLogs.clientDesignChanges,
        issuesReported: pmCallLogs.issuesReported,
        installationProblems: pmCallLogs.installationProblems,
        notes: pmCallLogs.notes,
        notifyManager: pmCallLogs.notifyManager,
        notifyClient: pmCallLogs.notifyClient,
        notifyProduction: pmCallLogs.notifyProduction,
        updateProductionSchedule: pmCallLogs.updateProductionSchedule,
        updateDraftingSchedule: pmCallLogs.updateDraftingSchedule,
        createdById: pmCallLogs.createdById,
        createdByName: users.name,
        createdAt: pmCallLogs.createdAt,
      })
      .from(pmCallLogs)
      .leftJoin(jobs, eq(pmCallLogs.jobId, jobs.id))
      .leftJoin(users, eq(pmCallLogs.createdById, users.id))
      .where(and(...conditions))
      .orderBy(desc(pmCallLogs.callDateTime));

    res.json(logs);
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to fetch PM call logs");
    res.status(500).json({ message: "Failed to fetch call logs" });
  }
});

router.get("/api/pm-call-logs/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const companyId = String(req.session.companyId);

    const [log] = await db
      .select({
        id: pmCallLogs.id,
        jobId: pmCallLogs.jobId,
        jobName: jobs.name,
        contactName: pmCallLogs.contactName,
        contactPhone: pmCallLogs.contactPhone,
        callDateTime: pmCallLogs.callDateTime,
        deliveryTime: pmCallLogs.deliveryTime,
        nextDeliveryDate: pmCallLogs.nextDeliveryDate,
        draftingConcerns: pmCallLogs.draftingConcerns,
        clientDesignChanges: pmCallLogs.clientDesignChanges,
        issuesReported: pmCallLogs.issuesReported,
        installationProblems: pmCallLogs.installationProblems,
        notes: pmCallLogs.notes,
        notifyManager: pmCallLogs.notifyManager,
        notifyClient: pmCallLogs.notifyClient,
        notifyProduction: pmCallLogs.notifyProduction,
        updateProductionSchedule: pmCallLogs.updateProductionSchedule,
        updateDraftingSchedule: pmCallLogs.updateDraftingSchedule,
        createdById: pmCallLogs.createdById,
        createdByName: users.name,
        createdAt: pmCallLogs.createdAt,
      })
      .from(pmCallLogs)
      .leftJoin(jobs, eq(pmCallLogs.jobId, jobs.id))
      .leftJoin(users, eq(pmCallLogs.createdById, users.id))
      .where(and(eq(pmCallLogs.id, id), eq(pmCallLogs.companyId, companyId)));

    if (!log) {
      return res.status(404).json({ message: "Call log not found" });
    }

    const levels = await db
      .select()
      .from(pmCallLogLevels)
      .where(eq(pmCallLogLevels.callLogId, id))
      .orderBy(asc(pmCallLogLevels.sequenceOrder));

    res.json({ ...log, levels });
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to fetch PM call log detail");
    res.status(500).json({ message: "Failed to fetch call log" });
  }
});

router.get("/api/pm-call-logs/job/:jobId/upcoming-levels", requireAuth, async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.jobId);
    const now = new Date();
    const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const levels = await db
      .select()
      .from(jobLevelCycleTimes)
      .where(
        and(
          eq(jobLevelCycleTimes.jobId, jobId),
          gte(
            sql`COALESCE(${jobLevelCycleTimes.manualEndDate}, ${jobLevelCycleTimes.estimatedEndDate})`,
            now
          ),
        )
      )
      .orderBy(asc(jobLevelCycleTimes.sequenceOrder));

    const filtered = levels.filter((l) => {
      const startDate = l.manualStartDate || l.estimatedStartDate;
      return !startDate || startDate <= sixtyDaysFromNow;
    });

    res.json(filtered);
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to fetch upcoming levels for job");
    res.status(500).json({ message: "Failed to fetch upcoming levels" });
  }
});

router.post(PM_CALL_LOGS_ROUTES.LIST, requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = createCallLogSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
    }

    const { levels, ...logData } = parsed.data;
    const companyId = String(req.session.companyId);
    const createdById = String(req.session.userId);

    const result = await db.transaction(async (tx) => {
      const [callLog] = await tx
        .insert(pmCallLogs)
        .values({
          ...logData,
          callDateTime: new Date(logData.callDateTime),
          nextDeliveryDate: logData.nextDeliveryDate ? new Date(logData.nextDeliveryDate) : null,
          companyId,
          createdById,
        })
        .returning();

      if (levels.length > 0) {
        await tx.insert(pmCallLogLevels).values(
          levels.map((lvl) => ({
            callLogId: callLog.id,
            levelCycleTimeId: lvl.levelCycleTimeId,
            level: lvl.level,
            buildingNumber: lvl.buildingNumber,
            pourLabel: lvl.pourLabel || null,
            sequenceOrder: lvl.sequenceOrder,
            status: lvl.status as "ON_TIME" | "LATE",
            daysLate: lvl.daysLate,
            originalStartDate: lvl.originalStartDate ? new Date(lvl.originalStartDate) : null,
            originalEndDate: lvl.originalEndDate ? new Date(lvl.originalEndDate) : null,
            adjustedStartDate: lvl.adjustedStartDate ? new Date(lvl.adjustedStartDate) : null,
            adjustedEndDate: lvl.adjustedEndDate ? new Date(lvl.adjustedEndDate) : null,
          }))
        );
      }

      const lateLevels = levels.filter((l) => l.status === "LATE" && l.daysLate > 0);
      if (lateLevels.length > 0) {
        for (const lvl of lateLevels) {
          if (lvl.adjustedStartDate) {
            await tx
              .update(jobLevelCycleTimes)
              .set({
                manualStartDate: new Date(lvl.adjustedStartDate),
                manualEndDate: lvl.adjustedEndDate ? new Date(lvl.adjustedEndDate) : null,
                updatedAt: new Date(),
              })
              .where(eq(jobLevelCycleTimes.id, lvl.levelCycleTimeId));
          }
        }

        if (logData.updateProductionSchedule) {
          const jobSlots = await tx
            .select()
            .from(productionSlots)
            .where(eq(productionSlots.jobId, logData.jobId))
            .orderBy(asc(productionSlots.productionSlotDate));

          for (const lvl of lateLevels) {
            const matchingSlot = jobSlots.find(
              (s) => s.level === lvl.level && s.buildingNumber === lvl.buildingNumber
            );
            if (matchingSlot && lvl.adjustedStartDate) {
              await tx
                .update(productionSlots)
                .set({
                  productionSlotDate: new Date(lvl.adjustedStartDate),
                  updatedAt: new Date(),
                })
                .where(eq(productionSlots.id, matchingSlot.id));
            }
          }
        }

        if (logData.updateDraftingSchedule) {
          for (const lvl of lateLevels) {
            if (lvl.adjustedStartDate) {
              const draftingEntries = await tx
                .select()
                .from(draftingProgram)
                .where(
                  and(
                    eq(draftingProgram.jobId, logData.jobId),
                    eq(draftingProgram.level, lvl.level)
                  )
                );

              for (const entry of draftingEntries) {
                const newProdDate = new Date(lvl.adjustedStartDate);
                const drawingDue = new Date(newProdDate);
                drawingDue.setDate(drawingDue.getDate() - 14);
                await tx
                  .update(draftingProgram)
                  .set({
                    productionDate: newProdDate,
                    drawingDueDate: drawingDue,
                    updatedAt: new Date(),
                  })
                  .where(eq(draftingProgram.id, entry.id));
              }
            }
          }
        }
      }

      return callLog;
    });

    res.status(201).json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to create PM call log");
    res.status(500).json({ message: "Failed to create call log" });
  }
});

router.delete("/api/pm-call-logs/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const companyId = String(req.session.companyId);

    const [existing] = await db
      .select({ id: pmCallLogs.id })
      .from(pmCallLogs)
      .where(and(eq(pmCallLogs.id, id), eq(pmCallLogs.companyId, companyId)));

    if (!existing) {
      return res.status(404).json({ message: "Call log not found" });
    }

    await db.delete(pmCallLogs).where(eq(pmCallLogs.id, id));
    res.json({ message: "Call log deleted" });
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to delete PM call log");
    res.status(500).json({ message: "Failed to delete call log" });
  }
});

export const pmCallLogsRouter = router;
