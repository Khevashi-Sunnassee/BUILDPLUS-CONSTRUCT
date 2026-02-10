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
import { emailService } from "../services/email.service";
import { twilioService } from "../services/twilio.service";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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
  notificationEmails: z.string().nullable().optional(),
  notificationPhone: z.string().nullable().optional(),
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
        notificationEmails: pmCallLogs.notificationEmails,
        notificationPhone: pmCallLogs.notificationPhone,
        notificationResults: pmCallLogs.notificationResults,
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
        notificationEmails: pmCallLogs.notificationEmails,
        notificationPhone: pmCallLogs.notificationPhone,
        notificationResults: pmCallLogs.notificationResults,
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

    const shouldNotify = logData.notifyManager || logData.notifyClient || logData.notifyProduction;
    const hasRecipients = logData.notificationEmails || logData.notificationPhone;

    if (shouldNotify && hasRecipients) {
      const notificationResults: Array<{ channel: string; to: string; success: boolean; error?: string; messageId?: string }> = [];

      const [jobRecord] = await db
        .select({ name: jobs.name })
        .from(jobs)
        .where(eq(jobs.id, logData.jobId));
      const jobName = jobRecord?.name || logData.jobId;

      const [callerRecord] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, createdById));
      const callerName = callerRecord?.name || "PM";

      const lateLevels = levels.filter((l) => l.status === "LATE" && l.daysLate > 0);
      const formatDateShort = (d: string | null | undefined) => {
        if (!d) return "N/A";
        return new Date(d).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
      };

      const notifyTypes: string[] = [];
      if (logData.notifyManager) notifyTypes.push("Manager");
      if (logData.notifyClient) notifyTypes.push("Client");
      if (logData.notifyProduction) notifyTypes.push("Production");

      if (logData.notificationEmails) {
        const emailAddresses = logData.notificationEmails.split(",").map((e: string) => e.trim()).filter(Boolean);

        let lateSection = "";
        if (lateLevels.length > 0) {
          const lateRows = lateLevels.map((l) =>
            `<tr>
              <td style="padding:6px 12px;border:1px solid #ddd;">${l.pourLabel ? `${l.level} (${l.pourLabel})` : l.level}</td>
              <td style="padding:6px 12px;border:1px solid #ddd;">${l.daysLate} working days</td>
              <td style="padding:6px 12px;border:1px solid #ddd;">${formatDateShort(l.adjustedStartDate)}</td>
              <td style="padding:6px 12px;border:1px solid #ddd;">${formatDateShort(l.adjustedEndDate)}</td>
            </tr>`
          ).join("");
          lateSection = `
            <h3 style="color:#dc2626;margin-top:20px;">Late Items Reported</h3>
            <table style="border-collapse:collapse;width:100%;margin-top:8px;">
              <tr style="background:#f3f4f6;">
                <th style="padding:6px 12px;border:1px solid #ddd;text-align:left;">Level</th>
                <th style="padding:6px 12px;border:1px solid #ddd;text-align:left;">Days Late</th>
                <th style="padding:6px 12px;border:1px solid #ddd;text-align:left;">New Start</th>
                <th style="padding:6px 12px;border:1px solid #ddd;text-align:left;">New End</th>
              </tr>
              ${lateRows}
            </table>`;
        }

        let issuesSection = "";
        const issueItems: string[] = [];
        if (logData.draftingConcerns) issueItems.push(`<li><strong>Drafting Concerns:</strong> ${escapeHtml(logData.draftingConcerns)}</li>`);
        if (logData.clientDesignChanges) issueItems.push(`<li><strong>Client Design Changes:</strong> ${escapeHtml(logData.clientDesignChanges)}</li>`);
        if (logData.issuesReported) issueItems.push(`<li><strong>Issues Reported:</strong> ${escapeHtml(logData.issuesReported)}</li>`);
        if (logData.installationProblems) issueItems.push(`<li><strong>Installation Problems:</strong> ${escapeHtml(logData.installationProblems)}</li>`);
        if (issueItems.length > 0) {
          issuesSection = `<h3 style="margin-top:20px;">Concerns & Issues</h3><ul>${issueItems.join("")}</ul>`;
        }

        let logisticsSection = "";
        if (logData.deliveryTime || logData.nextDeliveryDate) {
          logisticsSection = `<h3 style="margin-top:20px;">Logistics</h3><ul>`;
          if (logData.deliveryTime) logisticsSection += `<li><strong>Delivery Time:</strong> ${escapeHtml(logData.deliveryTime)}</li>`;
          if (logData.nextDeliveryDate) logisticsSection += `<li><strong>Next Delivery:</strong> ${formatDateShort(logData.nextDeliveryDate)}</li>`;
          logisticsSection += `</ul>`;
        }

        const htmlBody = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#1e40af;color:white;padding:16px 24px;border-radius:8px 8px 0 0;">
              <h2 style="margin:0;">PM Call Log — ${jobName}</h2>
            </div>
            <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
              <p><strong>Call Date:</strong> ${new Date(logData.callDateTime).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}</p>
              <p><strong>Contact:</strong> ${escapeHtml(logData.contactName)}${logData.contactPhone ? ` (${escapeHtml(logData.contactPhone)})` : ""}</p>
              <p><strong>Logged By:</strong> ${callerName}</p>
              <p><strong>Notification Sent To:</strong> ${notifyTypes.join(", ")}</p>

              ${lateSection}
              ${issuesSection}
              ${logisticsSection}

              ${logData.notes ? `<h3 style="margin-top:20px;">Notes</h3><p>${escapeHtml(logData.notes)}</p>` : ""}

              ${logData.updateProductionSchedule ? `<p style="margin-top:16px;padding:8px 12px;background:#fef3c7;border-radius:4px;"><strong>Production schedule has been updated</strong> based on reported delays.</p>` : ""}
              ${logData.updateDraftingSchedule ? `<p style="padding:8px 12px;background:#fef3c7;border-radius:4px;"><strong>Drafting schedule has been updated</strong> based on reported delays.</p>` : ""}
            </div>
          </div>`;

        const subject = `PM Call Log: ${jobName} — ${new Date(logData.callDateTime).toLocaleDateString("en-AU")}${lateLevels.length > 0 ? ` [${lateLevels.length} LATE]` : ""}`;

        for (const email of emailAddresses) {
          try {
            const emailResult = await emailService.sendEmail(email, subject, htmlBody);
            notificationResults.push({ channel: "email", to: email, success: emailResult.success, error: emailResult.error, messageId: emailResult.messageId });
            logger.info({ to: email, success: emailResult.success }, "PM call log email notification sent");
          } catch (err: any) {
            notificationResults.push({ channel: "email", to: email, success: false, error: err?.message });
            logger.error({ err, to: email }, "Failed to send PM call log email notification");
          }
        }
      }

      if (logData.notificationPhone) {
        const phoneNumbers = logData.notificationPhone.split(",").map((p: string) => p.trim()).filter(Boolean);
        const onTimeCount = levels.filter((l) => l.status === "ON_TIME").length;
        const lateCount = lateLevels.length;

        let smsBody = `PM Call Log: ${jobName}\n`;
        smsBody += `Date: ${new Date(logData.callDateTime).toLocaleDateString("en-AU")}\n`;
        smsBody += `Contact: ${logData.contactName}\n`;
        smsBody += `Status: ${onTimeCount} on time, ${lateCount} late\n`;

        if (lateLevels.length > 0) {
          smsBody += `\nLate Items:\n`;
          for (const l of lateLevels) {
            smsBody += `- ${l.pourLabel ? `${l.level} (${l.pourLabel})` : l.level}: ${l.daysLate} days late\n`;
          }
        }

        if (logData.issuesReported) {
          smsBody += `\nIssues: ${logData.issuesReported.substring(0, 100)}`;
        }

        smsBody += `\n\nLogged by ${callerName}`;

        for (const phone of phoneNumbers) {
          try {
            const smsResult = await twilioService.sendSMS(phone, smsBody);
            notificationResults.push({ channel: "sms", to: phone, success: smsResult.success, error: smsResult.error, messageId: smsResult.messageId });
            logger.info({ to: phone, success: smsResult.success }, "PM call log SMS notification sent");
          } catch (err: any) {
            notificationResults.push({ channel: "sms", to: phone, success: false, error: err?.message });
            logger.error({ err, to: phone }, "Failed to send PM call log SMS notification");
          }
        }
      }

      if (notificationResults.length > 0) {
        await db
          .update(pmCallLogs)
          .set({ notificationResults })
          .where(eq(pmCallLogs.id, result.id));
      }

      res.status(201).json({ ...result, notificationResults });
    } else {
      res.status(201).json(result);
    }
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
