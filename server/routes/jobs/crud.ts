import { Router, Request, Response } from "express";
import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { storage, db } from "../../storage";
import { jobs, contracts, jobMembers, jobAuditLogs, globalSettings as globalSettingsTable } from "@shared/schema";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { JOB_PHASES, PHASE_ALLOWED_STATUSES, isValidStatusForPhase, canAdvanceToPhase, getDefaultStatusForPhase } from "@shared/job-phases";
import type { JobPhase, JobStatus } from "@shared/job-phases";
import { logJobChange } from "../../services/job-audit.service";
import { getAllowedJobIds, isJobMember } from "../../lib/job-membership";
import { resolveUserName, serializeJobPhase, serializeJobsPhase, deserializePhase } from "./shared";
import { intToPhase } from "@shared/job-phases";

const router = Router();

router.get("/api/projects", requireAuth, async (req: Request, res: Response) => {
  try {
    let jobsList = await storage.getAllJobs(req.companyId);

    const allowedIds = await getAllowedJobIds(req);
    if (allowedIds !== null) {
      jobsList = jobsList.filter(j => allowedIds.has(j.id));
    }

    res.json(jobsList.map(j => ({ id: j.id, name: j.name, code: j.code || j.jobNumber })));
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching projects");
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.get("/api/jobs/my-memberships", requireAuth, async (req: Request, res: Response) => {
  try {
    const memberships = await db.select({ jobId: jobMembers.jobId })
      .from(jobMembers)
      .where(eq(jobMembers.userId, req.session.userId!))
      .limit(1000);
    res.json(memberships.map(m => m.jobId));
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching user job memberships");
    res.status(500).json({ error: "Failed to fetch memberships" });
  }
});

router.get("/api/jobs", requireAuth, async (req: Request, res: Response) => {
  try {
    const allJobs = await storage.getAllJobs(req.companyId);
    let serialized = serializeJobsPhase(allJobs);

    const allowedIds = await getAllowedJobIds(req);
    if (allowedIds !== null) {
      serialized = serialized.filter((job) => allowedIds.has(job.id));
    }

    if (req.query.status === "ACTIVE") {
      res.json(serialized.filter((j) => j.status === "ACTIVE"));
    } else {
      res.json(serialized);
    }
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching jobs");
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

router.get("/api/jobs/:jobId", requireAuth, async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(req.params.jobId as string);
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }
    const allowed = await isJobMember(req, job.id);
    if (!allowed) {
      return res.status(403).json({ error: "You are not a member of this job" });
    }
    res.json(serializeJobPhase(job));
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/jobs/:jobId/audit-log", requireAuth, async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(req.params.jobId as string);
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

router.get("/api/jobs/:jobId/totals", requireAuth, async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.jobId);
    const job = await storage.getJob(jobId);
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }
    const panels = await storage.getPanelsByJob(jobId);
    
    let totalAreaM2 = 0;
    let totalVolumeM3 = 0;
    let totalElements = 0;
    let pendingCount = 0;
    let validatedCount = 0;
    
    for (const panel of panels) {
      const qty = panel.qty || 1;
      totalElements += qty;
      
      if (panel.panelArea) {
        totalAreaM2 += parseFloat(panel.panelArea) * qty;
      }
      if (panel.panelVolume) {
        totalVolumeM3 += parseFloat(panel.panelVolume) * qty;
      }
      
      if (panel.status === "PENDING") {
        pendingCount += qty;
      } else {
        validatedCount += qty;
      }
    }
    
    res.json({
      totalAreaM2: Math.round(totalAreaM2 * 100) / 100,
      totalVolumeM3: Math.round(totalVolumeM3 * 1000) / 1000,
      totalElements,
      pendingCount,
      validatedCount,
      panelCount: panels.length,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/jobs/:jobId/panel-rates", requireAuth, async (req: Request, res: Response) => {
  const job = await storage.getJob(req.params.jobId as string);
  if (!job || job.companyId !== req.companyId) {
    return res.status(404).json({ error: "Job not found" });
  }
  const rates = await storage.getEffectiveRates(req.params.jobId as string);
  res.json(rates);
});

router.put("/api/jobs/:jobId/panel-rates/:panelTypeId", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(req.params.jobId as string);
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }
    const rate = await storage.upsertJobPanelRate(req.params.jobId as string, req.params.panelTypeId as string, req.body);
    res.json(rate);
  } catch (error: unknown) {
    res.status(400).json({ error: "An internal error occurred" });
  }
});

router.delete("/api/jobs/:jobId/panel-rates/:rateId", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const job = await storage.getJob(req.params.jobId as string);
  if (!job || job.companyId !== req.companyId) {
    return res.status(404).json({ error: "Job not found" });
  }
  await storage.deleteJobPanelRate(req.params.rateId as string);
  res.json({ ok: true });
});

router.get("/api/admin/jobs", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    
    const allJobs = await storage.getAllJobs(req.companyId);
    let serialized = serializeJobsPhase(allJobs);
    
    if (user.role !== "ADMIN" && user.role !== "MANAGER") {
      const memberships = await db.select({ jobId: jobMembers.jobId })
        .from(jobMembers)
        .where(eq(jobMembers.userId, user.id))
        .limit(1000);
      const allowedJobIds = new Set(memberships.map(m => m.jobId));
      serialized = serialized.filter((job) => allowedJobIds.has(job.id));
    }

    const { customerId } = req.query;
    if (customerId && typeof customerId === "string") {
      serialized = serialized.filter((job) => job.customerId === customerId);
    }
    
    res.json(serialized);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching jobs");
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

router.get("/api/admin/jobs/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(req.params.id as string);
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    
    if (user.role !== "ADMIN" && user.role !== "MANAGER") {
      const membership = await db.select({ jobId: jobMembers.jobId })
        .from(jobMembers)
        .where(and(eq(jobMembers.userId, user.id), eq(jobMembers.jobId, job.id)))
        .limit(1000);
      if (membership.length === 0) {
        return res.status(403).json({ error: "Not a member of this job" });
      }
    }
    res.json(serializeJobPhase(job));
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching job");
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

router.get("/api/admin/jobs/next-number", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      return res.status(403).json({ error: "Company context required" });
    }
    const settings = await storage.getGlobalSettings(req.companyId);
    const prefix = settings?.jobNumberPrefix || "";
    const minDigits = settings?.jobNumberMinDigits || 3;
    const nextSeq = settings?.jobNumberNextSequence || 1;
    const paddedNum = String(nextSeq).padStart(minDigits, "0");
    const nextJobNumber = prefix ? `${prefix}${paddedNum}` : "";
    res.json({ nextJobNumber, prefix, minDigits, nextSequence: nextSeq, hasAutoNumbering: !!prefix });
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/admin/jobs/check-number", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      return res.status(403).json({ error: "Company context required" });
    }
    const { jobNumber } = req.query;
    if (!jobNumber || typeof jobNumber !== "string") {
      return res.status(400).json({ error: "jobNumber query parameter is required" });
    }
    const existing = await storage.getJobByNumber(jobNumber.trim());
    const exists = !!existing && existing.companyId === req.companyId;
    res.json({ exists });
  } catch (error: unknown) {
    res.status(500).json({ error: "Failed to check job number" });
  }
});

router.post("/api/admin/jobs", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      return res.status(403).json({ error: "Company context required" });
    }
    const numericFields = [
      "numberOfBuildings", "expectedCycleTimePerFloor", "daysInAdvance",
      "daysToAchieveIfc", "productionWindowDays", "productionDaysInAdvance",
      "procurementDaysInAdvance", "procurementTimeDays"
    ];
    const body = { ...req.body };
    for (const field of numericFields) {
      if (body[field] !== undefined && body[field] !== null && body[field] !== "") {
        const num = parseInt(String(body[field]), 10);
        if (!isNaN(num)) body[field] = num;
      } else if (body[field] === "") {
        body[field] = null;
      }
    }
    const jobCreateSchema = z.object({
      jobNumber: z.string().max(50).optional().default(""),
      name: z.string().min(1, "Job name is required").max(255),
      code: z.string().max(50).optional().nullable(),
      client: z.string().max(255).optional().nullable(),
      customerId: z.string().max(36).optional().nullable(),
      address: z.string().max(500).optional().nullable(),
      city: z.string().max(100).optional().nullable(),
      state: z.enum(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]).optional().nullable(),
      siteContact: z.string().max(255).optional().nullable(),
      siteContactPhone: z.string().max(50).optional().nullable(),
      description: z.string().optional().nullable(),
      craneCapacity: z.string().max(50).optional().nullable(),
      numberOfBuildings: z.number().int().min(0).optional().nullable(),
      levels: z.string().max(50).optional().nullable(),
      lowestLevel: z.string().max(50).optional().nullable(),
      highestLevel: z.string().max(50).optional().nullable(),
      productionStartDate: z.string().optional().nullable(),
      expectedCycleTimePerFloor: z.number().int().min(0).optional().nullable(),
      daysInAdvance: z.number().int().min(0).optional().nullable(),
      daysToAchieveIfc: z.number().int().min(1).optional().nullable(),
      productionWindowDays: z.number().int().min(1).optional().nullable(),
      productionDaysInAdvance: z.number().int().min(1).optional().nullable(),
      procurementDaysInAdvance: z.number().int().min(1).optional().nullable(),
      procurementTimeDays: z.number().int().min(1).optional().nullable(),
      status: z.enum(["ACTIVE", "COMPLETED", "ON_HOLD", "ARCHIVED", "OPPORTUNITY", "QUOTING", "WON", "LOST", "CANCELLED", "CONTRACTED", "IN_PROGRESS", "DEFECT_LIABILITY_PERIOD"]).optional(),
      factoryId: z.string().max(36).optional().nullable(),
      defectLiabilityEndDate: z.string().optional().nullable(),
    }).passthrough();
    const parsed = jobCreateSchema.safeParse(body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    if (!parsed.data.jobNumber || parsed.data.jobNumber.trim() === "") {
      const settings = await storage.getGlobalSettings(req.companyId);
      const prefix = settings?.jobNumberPrefix || "";
      if (!prefix) {
        return res.status(400).json({ error: "Job number is required. Configure a prefix in Company Settings to enable auto-generation." });
      }
      const minDigits = settings?.jobNumberMinDigits || 3;
      const result = await db.update(globalSettingsTable)
        .set({ jobNumberNextSequence: sql`${globalSettingsTable.jobNumberNextSequence} + 1` })
        .where(eq(globalSettingsTable.companyId, req.companyId))
        .returning({ seq: globalSettingsTable.jobNumberNextSequence });
      const nextSeq = result[0] ? result[0].seq - 1 : 1;
      const paddedNum = String(nextSeq).padStart(minDigits, "0");
      parsed.data.jobNumber = `${prefix}${paddedNum}`;
    }
    const existing = await storage.getJobByNumber(parsed.data.jobNumber);
    if (existing && existing.companyId === req.companyId) {
      return res.status(400).json({ error: "Job with this number already exists" });
    }
    const data = { ...parsed.data, companyId: req.companyId } as Record<string, unknown>;
    if (typeof data.productionStartDate === 'string' && data.productionStartDate.trim() !== '') {
      data.productionStartDate = new Date(data.productionStartDate);
    } else if (!data.productionStartDate || data.productionStartDate === '') {
      data.productionStartDate = null;
    }
    if (typeof data.defectLiabilityEndDate === 'string' && data.defectLiabilityEndDate.trim() !== '') {
      data.defectLiabilityEndDate = new Date(data.defectLiabilityEndDate);
    } else {
      data.defectLiabilityEndDate = null;
    }
    const emptyStringFields = [
      "client", "address", "city", "description", "craneCapacity",
      "levels", "lowestLevel", "highestLevel", "siteContact", "siteContactPhone", "code"
    ];
    for (const field of emptyStringFields) {
      if (data[field] === "") data[field] = null;
    }
    const companyId = req.companyId;
    const globalSettings = await storage.getGlobalSettings(companyId);
    if (data.procurementDaysInAdvance !== undefined && data.procurementDaysInAdvance !== null) {
      const val = parseInt(String(data.procurementDaysInAdvance), 10);
      if (isNaN(val) || val < 1) {
        return res.status(400).json({ error: "procurementDaysInAdvance must be a positive number" });
      }
      const ifcDays = Number(data.daysInAdvance ?? globalSettings?.ifcDaysInAdvance ?? 14);
      if (val >= ifcDays) {
        return res.status(400).json({ error: `procurementDaysInAdvance must be less than IFC days in advance (${ifcDays})` });
      }
      data.procurementDaysInAdvance = val;
    }
    if (data.procurementTimeDays !== undefined && data.procurementTimeDays !== null) {
      const val = parseInt(String(data.procurementTimeDays), 10);
      if (isNaN(val) || val < 1) {
        return res.status(400).json({ error: "procurementTimeDays must be a positive number" });
      }
      data.procurementTimeDays = val;
    }
    if (!data.jobPhase) {
      data.jobPhase = "OPPORTUNITY";
    }
    const jobPhaseStr = data.jobPhase as JobPhase;
    if (!data.status || data.status === "ACTIVE") {
      const defaultSt = getDefaultStatusForPhase(jobPhaseStr);
      if (defaultSt) data.status = defaultSt;
    }
    data.jobPhase = deserializePhase(jobPhaseStr);
    const job = await storage.createJob(data);

    const userName = await resolveUserName(req);
    logJobChange(job.id, "JOB_CREATED", req.session?.userId || null, userName, {
      newPhase: jobPhaseStr,
      newStatus: data.status as string | undefined,
    });

    res.json(serializeJobPhase(job));
  } catch (error: unknown) {
    res.status(400).json({ error: "An internal error occurred" });
  }
});

router.put("/api/admin/jobs/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const existingJob = await storage.getJob(req.params.id as string);
    if (!existingJob || existingJob.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }
    const data = { ...req.body };
    delete data.companyId;
    if (data.productionStartDate !== undefined) {
      if (data.productionStartDate && typeof data.productionStartDate === 'string') {
        data.productionStartDate = new Date(data.productionStartDate);
      } else {
        data.productionStartDate = null;
      }
    }
    if (data.estimatedStartDate !== undefined) {
      if (data.estimatedStartDate && typeof data.estimatedStartDate === 'string') {
        data.estimatedStartDate = new Date(data.estimatedStartDate);
      } else {
        data.estimatedStartDate = null;
      }
    }
    if (data.defectLiabilityEndDate !== undefined) {
      if (data.defectLiabilityEndDate && typeof data.defectLiabilityEndDate === 'string') {
        data.defectLiabilityEndDate = new Date(data.defectLiabilityEndDate);
      } else {
        data.defectLiabilityEndDate = null;
      }
    }
    if (data.daysToAchieveIfc !== undefined && data.daysToAchieveIfc !== null) {
      const val = parseInt(String(data.daysToAchieveIfc), 10);
      if (isNaN(val) || val < 1) {
        return res.status(400).json({ error: "daysToAchieveIfc must be a positive number" });
      }
      data.daysToAchieveIfc = val;
    }
    if (data.productionWindowDays !== undefined && data.productionWindowDays !== null) {
      const val = parseInt(String(data.productionWindowDays), 10);
      if (isNaN(val) || val < 1) {
        return res.status(400).json({ error: "productionWindowDays must be a positive number" });
      }
      data.productionWindowDays = val;
    }
    if (data.productionDaysInAdvance !== undefined && data.productionDaysInAdvance !== null) {
      const val = parseInt(String(data.productionDaysInAdvance), 10);
      if (isNaN(val) || val < 1) {
        return res.status(400).json({ error: "productionDaysInAdvance must be a positive number" });
      }
      data.productionDaysInAdvance = val;
    }
    const globalSettings = await storage.getGlobalSettings(req.companyId);
    
    if (data.daysInAdvance !== undefined && data.daysInAdvance !== null) {
      const newIfcDays = parseInt(String(data.daysInAdvance), 10);
      const effectiveProcurementDays = data.procurementDaysInAdvance ?? existingJob?.procurementDaysInAdvance ?? globalSettings?.procurementDaysInAdvance ?? 7;
      if (!isNaN(newIfcDays) && newIfcDays <= effectiveProcurementDays) {
        return res.status(400).json({ error: `daysInAdvance must be greater than procurementDaysInAdvance (${effectiveProcurementDays})` });
      }
    }
    
    if (data.procurementDaysInAdvance !== undefined && data.procurementDaysInAdvance !== null) {
      const val = parseInt(String(data.procurementDaysInAdvance), 10);
      if (isNaN(val) || val < 1) {
        return res.status(400).json({ error: "procurementDaysInAdvance must be a positive number" });
      }
      const ifcDays = data.daysInAdvance ?? existingJob?.daysInAdvance ?? globalSettings?.ifcDaysInAdvance ?? 14;
      if (val >= ifcDays) {
        return res.status(400).json({ error: `procurementDaysInAdvance must be less than IFC days in advance (${ifcDays})` });
      }
      data.procurementDaysInAdvance = val;
    }
    if (data.procurementTimeDays !== undefined && data.procurementTimeDays !== null) {
      const val = parseInt(String(data.procurementTimeDays), 10);
      if (isNaN(val) || val < 1) {
        return res.status(400).json({ error: "procurementTimeDays must be a positive number" });
      }
      data.procurementTimeDays = val;
    }
    const existingPhaseStr = intToPhase(existingJob.jobPhase ?? 0);
    if (data.jobPhase || data.status) {
      const targetPhase = (data.jobPhase || existingPhaseStr || "CONTRACTED") as JobPhase;
      const targetStatus = (data.status || existingJob.status) as JobStatus;
      
      if (data.jobPhase && data.jobPhase !== existingPhaseStr) {
        if (!canAdvanceToPhase(existingPhaseStr || "CONTRACTED", targetPhase)) {
          return res.status(400).json({ error: `Cannot move from ${existingPhaseStr} to ${targetPhase}` });
        }
      }

      if (targetPhase !== "LOST" && !isValidStatusForPhase(targetPhase, targetStatus)) {
        return res.status(400).json({ error: `Status '${targetStatus}' is not valid for phase '${targetPhase}'` });
      }
    }

    if (data.jobPhase) {
      data.jobPhase = deserializePhase(data.jobPhase);
    }

    const changedFields: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data)) {
      if ((existingJob as Record<string, unknown>)[key] !== val) {
        changedFields[key] = { from: (existingJob as Record<string, unknown>)[key], to: val };
      }
    }

    const job = await storage.updateJob(req.params.id as string, data);

    if (Object.keys(changedFields).length > 0) {
      const userName = await resolveUserName(req);
      logJobChange(req.params.id as string, "JOB_UPDATED", req.session?.userId || null, userName, {
        changedFields,
        previousPhase: existingPhaseStr,
        newPhase: existingPhaseStr,
        previousStatus: existingJob.status,
        newStatus: existingJob.status,
      });
    }

    if (data.productionStartDate !== undefined) {
      try {
        const [existingContract] = await db.select()
          .from(contracts)
          .where(and(eq(contracts.jobId, req.params.id as string), eq(contracts.companyId, req.companyId!)));
        if (existingContract) {
          await db.update(contracts)
            .set({ requiredDeliveryStartDate: data.productionStartDate, updatedAt: new Date() })
            .where(eq(contracts.id, existingContract.id));
        }
      } catch (syncError: unknown) {
        logger.warn({ err: syncError }, "Failed to sync Required Delivery Start to contract");
      }
    }

    res.json(serializeJobPhase(job));
  } catch (error: unknown) {
    res.status(400).json({ error: "An internal error occurred" });
  }
});

router.delete("/api/admin/jobs/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const jobId = req.params.id as string;
  
  const existingJob = await storage.getJob(jobId);
  if (!existingJob || existingJob.companyId !== req.companyId) {
    return res.status(404).json({ error: "Job not found" });
  }
  
  const panels = await storage.getPanelsByJob(jobId);
  if (panels.length > 0) {
    return res.status(400).json({ 
      error: "Cannot delete job with panels",
      message: `This job has ${panels.length} panel(s) registered. Please delete or reassign them first.`
    });
  }
  
  await storage.deleteJob(jobId);
  res.json({ ok: true });
});

export default router;
