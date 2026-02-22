import { Router, Request, Response } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { storage, db } from "../../storage";
import { jobs, jobAuditLogs, jobMembers, users } from "@shared/schema";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { JOB_PHASES, PHASE_ALLOWED_STATUSES, isValidStatusForPhase, canAdvanceToPhase, getDefaultStatusForPhase } from "@shared/job-phases";
import type { JobPhase, JobStatus } from "@shared/job-phases";
import { intToPhase } from "@shared/job-phases";
import { logJobChange, logJobPhaseChange, logJobStatusChange } from "../../services/job-audit.service";
import { emailService } from "../../services/email.service";
import { buildBrandedEmail } from "../../lib/email-template";
import { resolveUserName, serializeJobPhase, deserializePhase } from "./shared";

const router = Router();

router.get("/api/admin/jobs/:id/production-slot-status", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const jobId = req.params.id as string;
    const job = await storage.getJob(jobId);
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }
    const slots = await storage.getProductionSlots({ jobId });
    
    const hasSlots = slots.length > 0;
    const nonStartedSlots = slots.filter(s => s.status === "SCHEDULED" || s.status === "PENDING_UPDATE");
    const hasNonStartedSlots = nonStartedSlots.length > 0;
    const allStarted = hasSlots && !hasNonStartedSlots;
    
    res.json({
      hasSlots,
      hasNonStartedSlots,
      allStarted,
      totalSlots: slots.length,
      nonStartedCount: nonStartedSlots.length,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get production slot status" });
  }
});

router.post("/api/admin/jobs/:id/rules", requireRole("ADMIN"), async (req: Request, res: Response) => {
  if (!req.companyId) {
    return res.status(403).json({ error: "Company context required" });
  }
  const job = await storage.getJob(req.params.id as string);
  if (!job || job.companyId !== req.companyId) {
    return res.status(404).json({ error: "Job not found" });
  }
  const rule = await storage.createMappingRule({
    companyId: req.companyId,
    jobId: req.params.id as string,
    pathContains: req.body.pathContains,
    priority: req.body.priority || 100,
  });
  res.json(rule);
});

router.delete("/api/admin/mapping-rules/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const rule = await storage.getMappingRule(req.params.id as string);
  if (!rule || rule.companyId !== req.companyId) {
    return res.status(404).json({ error: "Mapping rule not found" });
  }
  await storage.deleteMappingRule(req.params.id as string);
  res.json({ ok: true });
});

router.put("/api/admin/jobs/:id/phase-status", requireAuth, async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(req.params.id as string);
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }

    const schema = z.object({
      jobPhase: z.enum(JOB_PHASES as unknown as [string, ...string[]]).optional(),
      status: z.string().optional(),
      defectLiabilityEndDate: z.string().nullable().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const { jobPhase: newPhase, status: newStatus, defectLiabilityEndDate } = parsed.data;
    const currentPhase = intToPhase(job.jobPhase ?? 0);
    const currentStatus = job.status;

    if (newPhase && newPhase !== currentPhase) {
      if (!canAdvanceToPhase(currentPhase, newPhase as JobPhase)) {
        return res.status(400).json({ 
          error: `Cannot move from ${currentPhase} to ${newPhase}. Jobs must progress through phases sequentially.` 
        });
      }

      const targetPhase = newPhase as JobPhase;
      let targetStatus = newStatus || getDefaultStatusForPhase(targetPhase);

      if (targetPhase === "LOST") {
        targetStatus = "ARCHIVED";
      } else if (targetStatus && !isValidStatusForPhase(targetPhase, targetStatus as JobStatus)) {
        return res.status(400).json({
          error: `Status '${targetStatus}' is not valid for phase '${newPhase}'`,
        });
      }

      const updateData: Record<string, unknown> = { jobPhase: deserializePhase(targetPhase), updatedAt: new Date() };
      if (targetStatus) {
        updateData.status = targetStatus;
      }

      await db.update(jobs).set(updateData).where(eq(jobs.id, job.id));

      const phaseUserName = await resolveUserName(req);
      logJobPhaseChange(
        job.id,
        currentPhase,
        targetPhase,
        currentStatus,
        targetStatus,
        req.session?.userId || null,
        phaseUserName
      );

      const updatedJob = await storage.getJob(job.id);
      return res.json(serializeJobPhase(updatedJob));
    }

    if (newStatus && newStatus !== currentStatus) {
      if (!isValidStatusForPhase(currentPhase, newStatus as JobStatus)) {
        return res.status(400).json({
          error: `Status '${newStatus}' is not valid for phase '${currentPhase}'`,
        });
      }

      const statusUpdateData: Record<string, unknown> = {
        status: newStatus as typeof jobs.status.enumValues[number],
        updatedAt: new Date(),
      };
      if (defectLiabilityEndDate !== undefined) {
        statusUpdateData.defectLiabilityEndDate = defectLiabilityEndDate ? new Date(defectLiabilityEndDate) : null;
      }

      await db.update(jobs)
        .set(statusUpdateData)
        .where(eq(jobs.id, job.id));

      const statusUserName = await resolveUserName(req);
      logJobStatusChange(
        job.id,
        currentPhase,
        currentStatus,
        newStatus,
        req.session?.userId || null,
        statusUserName
      );

      const updatedJob = await storage.getJob(job.id);
      return res.json(serializeJobPhase(updatedJob));
    }

    if (defectLiabilityEndDate !== undefined) {
      await db.update(jobs)
        .set({ defectLiabilityEndDate: defectLiabilityEndDate ? new Date(defectLiabilityEndDate) : null, updatedAt: new Date() })
        .where(eq(jobs.id, job.id));
      const updatedJob = await storage.getJob(job.id);
      return res.json(serializeJobPhase(updatedJob));
    }

    return res.json(serializeJobPhase(job));
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating job phase/status");
    res.status(500).json({ error: "Failed to update job phase/status" });
  }
});

router.get("/api/admin/jobs/:id/audit-log", requireAuth, async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(req.params.id as string);
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }

    const logs = await db.select()
      .from(jobAuditLogs)
      .where(eq(jobAuditLogs.jobId, job.id))
      .orderBy(desc(jobAuditLogs.createdAt))
      .limit(500);

    res.json(logs);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching job audit log");
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

router.get("/api/admin/jobs/:id/members", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.id);
    const job = await storage.getJob(jobId);
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }

    const members = await db.select({
      id: jobMembers.id,
      jobId: jobMembers.jobId,
      userId: jobMembers.userId,
      invitedBy: jobMembers.invitedBy,
      invitedAt: jobMembers.invitedAt,
      userName: users.name,
      userEmail: users.email,
      userRole: users.role,
    })
      .from(jobMembers)
      .innerJoin(users, eq(jobMembers.userId, users.id))
      .where(eq(jobMembers.jobId, jobId))
      .limit(1000);

    res.json(members);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching job members");
    res.status(500).json({ error: "Failed to fetch job members" });
  }
});

router.post("/api/admin/jobs/:id/members", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.id);
    const schema = z.object({ userId: z.string().min(1) });
    const { userId } = schema.parse(req.body);

    const job = await storage.getJob(jobId);
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }

    const invitedUser = await storage.getUser(userId);
    if (!invitedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (invitedUser.companyId !== req.companyId) {
      return res.status(403).json({ error: "User does not belong to your company" });
    }

    const existing = await db.select()
      .from(jobMembers)
      .where(and(eq(jobMembers.jobId, jobId), eq(jobMembers.userId, userId)))
      .limit(500);
    if (existing.length > 0) {
      return res.status(409).json({ error: "User is already a member of this job" });
    }

    const [member] = await db.insert(jobMembers).values({
      companyId: req.companyId!,
      jobId,
      userId,
      invitedBy: req.session.userId!,
    }).returning();

    if (invitedUser.email && emailService.isConfigured()) {
      const inviterName = req.session.name || "A team member";
      const subject = `You've been added to Job: ${job.jobNumber} - ${job.name}`;
      const companyId = req.session.companyId;
      const body = await buildBrandedEmail({
        title: "Job Invitation",
        recipientName: invitedUser.name || invitedUser.email,
        body: `<p><strong>${inviterName}</strong> has added you to the following job:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px 12px; background: #e2e8f0; font-weight: bold; width: 140px;">Job Number</td>
              <td style="padding: 8px 12px; background: white;">${job.jobNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #e2e8f0; font-weight: bold;">Job Name</td>
              <td style="padding: 8px 12px; background: white;">${job.name}</td>
            </tr>
            ${job.address ? `<tr><td style="padding: 8px 12px; background: #e2e8f0; font-weight: bold;">Address</td><td style="padding: 8px 12px; background: white;">${job.address}</td></tr>` : ""}
            ${job.client ? `<tr><td style="padding: 8px 12px; background: #e2e8f0; font-weight: bold;">Client</td><td style="padding: 8px 12px; background: white;">${job.client}</td></tr>` : ""}
          </table>
          <p>You now have access to documents and files associated with this job.</p>`,
        companyId,
      });
      emailService.sendEmail(invitedUser.email, subject, body).catch((err) => {
        logger.error({ err, userId, jobId }, "Failed to send job invitation email");
      });
    }

    res.json(member);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    logger.error({ err: error }, "Error adding job member");
    res.status(500).json({ error: "Failed to add job member" });
  }
});

router.delete("/api/admin/jobs/:id/members/:userId", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.id);
    const userId = String(req.params.userId);

    const job = await storage.getJob(jobId);
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }

    await db.delete(jobMembers)
      .where(and(eq(jobMembers.jobId, jobId), eq(jobMembers.userId, userId)));

    res.json({ ok: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error removing job member");
    res.status(500).json({ error: "Failed to remove job member" });
  }
});

export default router;
