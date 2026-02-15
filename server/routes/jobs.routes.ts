import { Router, Request, Response } from "express";
import { z } from "zod";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { storage, db, getFactoryWorkDays, getCfmeuHolidaysInRange, isWorkingDay, subtractWorkingDays, addWorkingDays } from "../storage";
import { insertJobSchema, jobs, factories, customers, contracts, salesStatusHistory, jobAuditLogs, jobLevelCycleTimes, jobMembers, users } from "@shared/schema";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import logger from "../lib/logger";
import { SALES_STAGES, STAGE_STATUSES, getDefaultStatus, isValidStatusForStage } from "@shared/sales-pipeline";
import type { SalesStage } from "@shared/sales-pipeline";
import { JOB_PHASES, PHASE_ALLOWED_STATUSES, isValidStatusForPhase, canAdvanceToPhase, getDefaultStatusForPhase, intToPhase, phaseToInt } from "@shared/job-phases";
import type { JobPhase, JobStatus } from "@shared/job-phases";
import { logJobChange, logJobPhaseChange, logJobStatusChange } from "../services/job-audit.service";
import { emailService } from "../services/email.service";
import { buildBrandedEmail } from "../lib/email-template";
import { getAllowedJobIds, isJobMember } from "../lib/job-membership";

async function resolveUserName(req: Request): Promise<string | null> {
  if (req.session?.name) return req.session.name;
  if (req.session?.userId) {
    const user = await storage.getUser(req.session.userId);
    if (user?.name) {
      req.session.name = user.name;
      return user.name;
    }
  }
  return null;
}

function serializeJobPhase(job: Record<string, unknown>): Record<string, unknown> {
  if (!job) return job;
  return { ...job, jobPhase: intToPhase(job.jobPhase ?? 0) };
}

function serializeJobsPhase(jobsList: Record<string, unknown>[]): Record<string, unknown>[] {
  return jobsList.map(serializeJobPhase);
}

function deserializePhase(phaseStr: string): number {
  return phaseToInt(phaseStr as JobPhase);
}

const router = Router();

const OPPORTUNITY_PHASES = [0, 1, 4] as const;

// GET /api/jobs/opportunities - List all opportunity-phase jobs
router.get("/api/jobs/opportunities", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      return res.status(403).json({ error: "Company context required" });
    }

    const result = await db.select({
      id: jobs.id,
      jobNumber: jobs.jobNumber,
      name: jobs.name,
      client: jobs.client,
      customerId: jobs.customerId,
      address: jobs.address,
      city: jobs.city,
      state: jobs.state,
      status: jobs.status,
      referrer: jobs.referrer,
      engineerOnJob: jobs.engineerOnJob,
      estimatedValue: jobs.estimatedValue,
      numberOfBuildings: jobs.numberOfBuildings,
      numberOfLevels: jobs.numberOfLevels,
      opportunityStatus: jobs.opportunityStatus,
      salesStage: jobs.salesStage,
      salesStatus: jobs.salesStatus,
      opportunityType: jobs.opportunityType,
      primaryContact: jobs.primaryContact,
      probability: jobs.probability,
      estimatedStartDate: jobs.estimatedStartDate,
      comments: jobs.comments,
      jobPhase: jobs.jobPhase,
      createdAt: jobs.createdAt,
      updatedAt: jobs.updatedAt,
    })
    .from(jobs)
    .where(sql`${inArray(jobs.jobPhase, [...OPPORTUNITY_PHASES])} AND ${eq(jobs.companyId, req.companyId)}`)
    .orderBy(desc(jobs.createdAt));

    const customerIds = [...new Set(result.filter(j => j.customerId).map(j => j.customerId!))];
    let customerMap = new Map<string, { id: string; name: string }>();
    if (customerIds.length > 0) {
      const custRows = await db.select({ id: customers.id, name: customers.name })
        .from(customers)
        .where(inArray(customers.id, customerIds));
      for (const c of custRows) {
        customerMap.set(c.id, c);
      }
    }

    const enriched = result.map(j => ({
      ...j,
      jobPhase: intToPhase(j.jobPhase ?? 0),
      customerName: j.customerId ? customerMap.get(j.customerId)?.name || null : null,
    }));

    res.json(enriched);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching opportunities");
    res.status(500).json({ error: "Failed to fetch opportunities" });
  }
});

// POST /api/jobs/opportunities - Create a new opportunity (lightweight)
router.post("/api/jobs/opportunities", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      return res.status(403).json({ error: "Company context required" });
    }

    const opportunitySchema = z.object({
      name: z.string().min(1, "Project name is required").max(255),
      customerId: z.string().max(36).optional().nullable(),
      address: z.string().min(1, "Address is required").max(500),
      city: z.string().min(1, "City is required").max(100),
      state: z.enum(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]).optional().nullable(),
      referrer: z.string().max(255).optional().nullable(),
      engineerOnJob: z.string().max(255).optional().nullable(),
      estimatedValue: z.string().optional().nullable(),
      numberOfBuildings: z.number().int().min(0).optional().nullable(),
      numberOfLevels: z.number().int().min(0).optional().nullable(),
      opportunityStatus: z.enum(["NEW", "CONTACTED", "PROPOSAL_SENT", "NEGOTIATING", "WON", "LOST", "ON_HOLD"]).optional().default("NEW"),
      salesStage: z.enum(["OPPORTUNITY", "PRE_QUALIFICATION", "ESTIMATING", "SUBMITTED", "AWARDED", "LOST"] as const).optional().default("OPPORTUNITY"),
      salesStatus: z.string().optional().nullable(),
      opportunityType: z.enum(["BUILDER_SELECTED", "OPEN_TENDER", "NEGOTIATED_CONTRACT", "GENERAL_PRICING"] as const).optional().nullable(),
      primaryContact: z.string().max(255).optional().nullable(),
      probability: z.number().int().min(0).max(100).optional().nullable(),
      estimatedStartDate: z.string().optional().nullable(),
      comments: z.string().optional().nullable(),
    });

    const parsed = opportunitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const maxResult = await db.select({ maxNum: sql<string>`MAX(job_number)` }).from(jobs).where(eq(jobs.companyId, req.companyId));
    const currentMax = maxResult[0]?.maxNum;
    let nextNum = "OPP-001";
    if (currentMax) {
      const match = currentMax.match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10) + 1;
        nextNum = `OPP-${String(num).padStart(3, '0')}`;
      }
    }
    const existingOpp = await storage.getJobByNumber(nextNum);
    if (existingOpp && existingOpp.companyId === req.companyId) {
      const timestamp = Date.now().toString(36).toUpperCase();
      nextNum = `OPP-${timestamp}`;
    }

    if (parsed.data.customerId) {
      const customer = await storage.getCustomer(parsed.data.customerId);
      if (!customer || customer.companyId !== req.companyId) {
        return res.status(400).json({ error: "Customer not found or belongs to another company" });
      }
    }

    const stage = parsed.data.salesStage || "OPPORTUNITY";
    const status = parsed.data.salesStatus || getDefaultStatus(stage as SalesStage);

    if (status && !isValidStatusForStage(stage as SalesStage, status)) {
      return res.status(400).json({ error: `Status "${status}" is not valid for stage "${stage}"` });
    }

    const data: Record<string, unknown> = {
      companyId: req.companyId,
      jobNumber: nextNum,
      name: parsed.data.name,
      jobPhase: 0,
      status: "ACTIVE",
      customerId: parsed.data.customerId || null,
      address: parsed.data.address,
      city: parsed.data.city,
      state: parsed.data.state || null,
      referrer: parsed.data.referrer || null,
      engineerOnJob: parsed.data.engineerOnJob || null,
      estimatedValue: parsed.data.estimatedValue || null,
      numberOfBuildings: parsed.data.numberOfBuildings || null,
      numberOfLevels: parsed.data.numberOfLevels || null,
      opportunityStatus: parsed.data.opportunityStatus,
      salesStage: stage,
      salesStatus: status,
      opportunityType: parsed.data.opportunityType || null,
      primaryContact: parsed.data.primaryContact || null,
      probability: parsed.data.probability ?? null,
      estimatedStartDate: parsed.data.estimatedStartDate ? new Date(parsed.data.estimatedStartDate) : null,
      comments: parsed.data.comments || null,
    };

    const job = await storage.createJob(data);

    try {
      await db.insert(salesStatusHistory).values({
        jobId: job.id,
        companyId: req.companyId,
        salesStage: stage,
        salesStatus: status,
        note: "Opportunity created",
        changedByUserId: req.session.userId || null,
        changedByName: req.session.name || null,
      });
    } catch (e) {
      logger.warn({ err: e }, "Failed to log sales status history on create");
    }

    res.json(serializeJobPhase(job));
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating opportunity");
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create opportunity" });
  }
});

// PATCH /api/jobs/opportunities/:id - Update opportunity status/details
router.patch("/api/jobs/opportunities/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(String(req.params.id));
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Opportunity not found" });
    }

    const updateSchema = z.object({
      name: z.string().min(1).max(255).optional(),
      customerId: z.string().max(36).optional().nullable(),
      address: z.string().max(500).optional(),
      city: z.string().max(100).optional(),
      state: z.enum(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]).optional().nullable(),
      status: z.enum(["OPPORTUNITY", "QUOTING", "WON", "LOST", "CANCELLED", "CONTRACTED", "IN_PROGRESS", "ACTIVE"]).optional(),
      referrer: z.string().max(255).optional().nullable(),
      engineerOnJob: z.string().max(255).optional().nullable(),
      estimatedValue: z.string().optional().nullable(),
      numberOfBuildings: z.number().int().min(0).optional().nullable(),
      numberOfLevels: z.number().int().min(0).optional().nullable(),
      opportunityStatus: z.enum(["NEW", "CONTACTED", "PROPOSAL_SENT", "NEGOTIATING", "WON", "LOST", "ON_HOLD"]).optional(),
      salesStage: z.enum(["OPPORTUNITY", "PRE_QUALIFICATION", "ESTIMATING", "SUBMITTED", "AWARDED", "LOST"] as const).optional(),
      salesStatus: z.string().optional().nullable(),
      opportunityType: z.enum(["BUILDER_SELECTED", "OPEN_TENDER", "NEGOTIATED_CONTRACT", "GENERAL_PRICING"] as const).optional().nullable(),
      primaryContact: z.string().max(255).optional().nullable(),
      probability: z.number().int().min(0).max(100).optional().nullable(),
      estimatedStartDate: z.string().optional().nullable(),
      comments: z.string().optional().nullable(),
      statusNote: z.string().max(500).optional(),
    });

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    if (parsed.data.customerId) {
      const customer = await storage.getCustomer(parsed.data.customerId);
      if (!customer || customer.companyId !== req.companyId) {
        return res.status(400).json({ error: "Customer not found or belongs to another company" });
      }
    }

    const { statusNote, ...rest } = parsed.data;
    const updateData: Record<string, unknown> = { ...rest };
    if (updateData.estimatedStartDate) {
      updateData.estimatedStartDate = new Date(updateData.estimatedStartDate);
    }

    if (updateData.salesStage && !updateData.salesStatus) {
      updateData.salesStatus = getDefaultStatus(updateData.salesStage as SalesStage);
    }

    const effectiveStage = updateData.salesStage || job.salesStage || "OPPORTUNITY";
    const effectiveStatus = updateData.salesStatus || job.salesStatus;
    if (effectiveStatus && !isValidStatusForStage(effectiveStage as SalesStage, effectiveStatus)) {
      return res.status(400).json({ error: `Status "${effectiveStatus}" is not valid for stage "${effectiveStage}"` });
    }

    const updated = await storage.updateJob(String(req.params.id), updateData);

    if (parsed.data.salesStage || parsed.data.salesStatus) {
      const newStage = updated!.salesStage || job.salesStage || "OPPORTUNITY";
      const newStatus = updated!.salesStatus || job.salesStatus || "";
      try {
        await db.insert(salesStatusHistory).values({
          jobId: job.id,
          companyId: req.companyId!,
          salesStage: newStage,
          salesStatus: newStatus,
          note: statusNote || null,
          changedByUserId: req.session.userId || null,
          changedByName: req.session.name || null,
        });
      } catch (e) {
        logger.warn({ err: e }, "Failed to log sales status history on update");
      }
    }

    res.json(serializeJobPhase(updated!));
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating opportunity");
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update opportunity" });
  }
});

// GET /api/jobs/opportunities/:id/history - Get sales status history for an opportunity
router.get("/api/jobs/opportunities/:id/history", requireAuth, async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(String(req.params.id));
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Opportunity not found" });
    }

    const history = await db.select()
      .from(salesStatusHistory)
      .where(eq(salesStatusHistory.jobId, String(req.params.id)))
      .orderBy(desc(salesStatusHistory.createdAt));

    res.json(history);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching sales status history");
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// POST /api/customers/quick - Quick customer creation for sales team (any auth user)
router.post("/api/customers/quick", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      return res.status(403).json({ error: "Company context required" });
    }
    const quickCustomerSchema = z.object({
      name: z.string().min(1, "Company name is required").max(255),
      contactName: z.string().max(255).optional().nullable(),
      phone: z.string().max(50).optional().nullable(),
      email: z.string().email().max(255).optional().nullable(),
    });
    const parsed = quickCustomerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const customer = await storage.createCustomer({ ...parsed.data, companyId: req.companyId } as Record<string, unknown>);
    res.json(customer);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating quick customer");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create customer" });
  }
});

// GET /api/projects - Legacy endpoint for backward compatibility
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
      .where(eq(jobMembers.userId, req.session.userId!));
    res.json(memberships.map(m => m.jobId));
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching user job memberships");
    res.status(500).json({ error: "Failed to fetch memberships" });
  }
});

// GET /api/jobs - Get all jobs (filtered by membership for non-admin/manager users)
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

// GET /api/jobs/:jobId - Get single job for authenticated users
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
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get job" });
  }
});

// GET /api/jobs/:jobId/audit-log - Get job audit trail for authenticated users
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
      .limit(100);
    res.json(logs);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching job audit log");
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

// GET /api/jobs/:jobId/totals - Get job totals (m2, m3, elements)
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
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get job totals" });
  }
});

// GET /api/jobs/:jobId/panel-rates - Get panel rates for a job
router.get("/api/jobs/:jobId/panel-rates", requireAuth, async (req: Request, res: Response) => {
  const job = await storage.getJob(req.params.jobId as string);
  if (!job || job.companyId !== req.companyId) {
    return res.status(404).json({ error: "Job not found" });
  }
  const rates = await storage.getEffectiveRates(req.params.jobId as string);
  res.json(rates);
});

// PUT /api/jobs/:jobId/panel-rates/:panelTypeId - Update panel rate for a job
router.put("/api/jobs/:jobId/panel-rates/:panelTypeId", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(req.params.jobId as string);
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }
    const rate = await storage.upsertJobPanelRate(req.params.jobId as string, req.params.panelTypeId as string, req.body);
    res.json(rate);
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update job rate" });
  }
});

// DELETE /api/jobs/:jobId/panel-rates/:rateId - Delete panel rate
router.delete("/api/jobs/:jobId/panel-rates/:rateId", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const job = await storage.getJob(req.params.jobId as string);
  if (!job || job.companyId !== req.companyId) {
    return res.status(404).json({ error: "Job not found" });
  }
  await storage.deleteJobPanelRate(req.params.rateId as string);
  res.json({ ok: true });
});

// Admin job endpoints

// GET /api/admin/jobs - Get all jobs (admin sees all, others see only their memberships)
router.get("/api/admin/jobs", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    
    const allJobs = await storage.getAllJobs(req.companyId);
    const serialized = serializeJobsPhase(allJobs);
    
    if (user.role === "ADMIN" || user.role === "MANAGER") {
      return res.json(serialized);
    }
    
    const memberships = await db.select({ jobId: jobMembers.jobId })
      .from(jobMembers)
      .where(eq(jobMembers.userId, user.id));
    const allowedJobIds = new Set(memberships.map(m => m.jobId));
    
    res.json(serialized.filter((job) => allowedJobIds.has(job.id)));
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching jobs");
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

// GET /api/admin/jobs/:id - Get single job (admin sees all, others only if member)
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
        .where(and(eq(jobMembers.userId, user.id), eq(jobMembers.jobId, job.id)));
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

// POST /api/admin/jobs - Create job
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
      jobNumber: z.string().min(1, "Job number is required").max(50),
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
      status: z.enum(["ACTIVE", "COMPLETED", "ON_HOLD", "ARCHIVED", "OPPORTUNITY", "QUOTING", "WON", "LOST", "CANCELLED", "CONTRACTED", "IN_PROGRESS"]).optional(),
      factoryId: z.string().max(36).optional().nullable(),
    }).passthrough();
    const parsed = jobCreateSchema.safeParse(body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
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
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create job" });
  }
});

// PUT /api/admin/jobs/:id - Update job
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
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update job" });
  }
});

// DELETE /api/admin/jobs/:id - Delete job
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

// GET /api/admin/jobs/:id/generate-levels - Generate level cycle times from job settings
router.get("/api/admin/jobs/:id/generate-levels", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(String(req.params.id));
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }
    if (!job.lowestLevel || !job.highestLevel) {
      return res.status(400).json({ error: "Job must have lowest and highest level configured to generate levels" });
    }

    const numberOfBuildings = job.numberOfBuildings || 1;
    const defaultCycleDays = job.expectedCycleTimePerFloor || 5;

    const lowMatch = job.lowestLevel.match(/^L?(\d+)$/i);
    const highMatch = job.highestLevel.match(/^L?(\d+)$/i);

    const levelOrder: Record<string, number> = {
      "Basement 2": -2, "B2": -2,
      "Basement 1": -1, "B1": -1, "Basement": -1,
      "Ground": 0, "G": 0, "GF": 0,
      "Mezzanine": 0.5, "Mezz": 0.5,
    };

    let levels: string[] = [];
    if (lowMatch && highMatch) {
      const lowNum = parseInt(lowMatch[1], 10);
      const highNum = parseInt(highMatch[1], 10);
      const useLPrefix = job.lowestLevel.toLowerCase().startsWith('l') || job.highestLevel.toLowerCase().startsWith('l');
      for (let i = lowNum; i <= highNum; i++) {
        levels.push(useLPrefix ? `L${i}` : String(i));
      }
    } else {
      const specialLevels = ["Basement 2", "B2", "Basement 1", "B1", "Basement", "Ground", "G", "GF", "Mezzanine", "Mezz"];
      const lowIdx = specialLevels.findIndex(l => l.toLowerCase() === job.lowestLevel!.toLowerCase());
      const highIdx = specialLevels.findIndex(l => l.toLowerCase() === job.highestLevel!.toLowerCase());
      if (lowIdx !== -1 && highIdx !== -1 && lowIdx <= highIdx) {
        levels = specialLevels.slice(lowIdx, highIdx + 1);
      } else if (job.lowestLevel === job.highestLevel) {
        levels = [job.lowestLevel];
      } else {
        levels = [job.lowestLevel, job.highestLevel];
      }
    }

    const result: { buildingNumber: number; level: string; levelOrder: number; cycleDays: number }[] = [];
    for (let b = 1; b <= numberOfBuildings; b++) {
      levels.forEach((level, idx) => {
        const order = levelOrder[level] !== undefined ? levelOrder[level] : (lowMatch ? parseInt(level.replace(/^L/i, ''), 10) : idx);
        result.push({
          buildingNumber: b,
          level,
          levelOrder: order,
          cycleDays: defaultCycleDays,
        });
      });
    }

    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error generating levels from settings");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate levels" });
  }
});

// GET /api/admin/jobs/:id/build-levels - Build level cycle times from registered panels
router.get("/api/admin/jobs/:id/build-levels", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(String(req.params.id));
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }

    const panels = await storage.getPanelsByJob(String(req.params.id));
    const defaultCycleDays = job.expectedCycleTimePerFloor || 5;

    const levelOrder: Record<string, number> = {
      "Basement 2": -2, "B2": -2,
      "Basement 1": -1, "B1": -1, "Basement": -1,
      "Ground": 0, "G": 0, "GF": 0,
      "Mezzanine": 0.5, "Mezz": 0.5,
    };

    const parseLevelNumber = (level: string): number => {
      if (levelOrder[level] !== undefined) return levelOrder[level];
      const match = level.match(/^L?(\d+)$/i);
      if (match) return parseInt(match[1], 10);
      if (level.toLowerCase() === "roof") return 999;
      return 500;
    };

    const existingCycleTimes = await storage.getJobLevelCycleTimes(String(req.params.id));
    const existingMap = new Map(existingCycleTimes.map(ct => [`${ct.buildingNumber}-${ct.level}`, ct.cycleDays]));

    const uniqueLevels = new Map<string, { buildingNumber: number; level: string }>();
    for (const panel of panels) {
      const level = panel.level || "Unknown";
      const building = parseInt(panel.building || "1", 10) || 1;
      const key = `${building}-${level}`;
      if (!uniqueLevels.has(key)) {
        uniqueLevels.set(key, { buildingNumber: building, level });
      }
    }

    const result = Array.from(uniqueLevels.values())
      .sort((a, b) => {
        if (a.buildingNumber !== b.buildingNumber) return a.buildingNumber - b.buildingNumber;
        return parseLevelNumber(a.level) - parseLevelNumber(b.level);
      })
      .map(item => ({
        buildingNumber: item.buildingNumber,
        level: item.level,
        levelOrder: parseLevelNumber(item.level),
        cycleDays: existingMap.get(`${item.buildingNumber}-${item.level}`) || defaultCycleDays,
      }));

    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error building levels from panels");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to build levels from panels" });
  }
});

// GET /api/admin/jobs/:id/level-cycle-times - Get level cycle times
router.get("/api/admin/jobs/:id/level-cycle-times", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(req.params.id as string);
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }
    const cycleTimes = await storage.getJobLevelCycleTimes(req.params.id as string);
    res.json(cycleTimes);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get level cycle times" });
  }
});

// POST /api/admin/jobs/:id/level-cycle-times - Update level cycle times
router.post("/api/admin/jobs/:id/level-cycle-times", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(req.params.id as string);
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }
    const cycleTimeSchema = z.object({
      buildingNumber: z.number().int().min(1),
      level: z.string().min(1),
      levelOrder: z.number().min(0),
      cycleDays: z.number().int().min(1),
    });
    
    const bodySchema = z.object({
      cycleTimes: z.array(cycleTimeSchema),
    });
    
    const parseResult = bodySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid cycle times data", details: parseResult.error.format() });
    }
    
    await storage.saveJobLevelCycleTimes(req.params.id as string, parseResult.data.cycleTimes);
    res.json({ ok: true });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to save level cycle times" });
  }
});

// ===== Job Programme Routes =====

// GET /api/admin/jobs/:id/programme - Get job programme entries
router.get("/api/admin/jobs/:id/programme", requireAuth, async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(String(req.params.id));
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }
    const programme = await storage.getJobProgramme(String(req.params.id));
    res.json(programme);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error getting job programme");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get job programme" });
  }
});

// PATCH /api/admin/jobs/:id/programme/:entryId - Update a single programme entry
router.patch("/api/admin/jobs/:id/programme/:entryId", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(String(req.params.id));
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }

    const updateSchema = z.object({
      cycleDays: z.number().int().min(1).optional(),
      predecessorSequenceOrder: z.number().int().nullable().optional(),
      relationship: z.enum(["FS", "SS", "FF", "SF"]).nullable().optional(),
      manualStartDate: z.string().nullable().optional(),
      manualEndDate: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    });

    const parseResult = updateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid update data", details: parseResult.error.format() });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (parseResult.data.cycleDays !== undefined) updateData.cycleDays = parseResult.data.cycleDays;
    if (parseResult.data.predecessorSequenceOrder !== undefined) {
      updateData.predecessorSequenceOrder = parseResult.data.predecessorSequenceOrder;
      if (parseResult.data.predecessorSequenceOrder === null) {
        updateData.relationship = null;
      }
    }
    if (parseResult.data.relationship !== undefined) {
      updateData.relationship = parseResult.data.relationship;
    }
    if (parseResult.data.manualStartDate !== undefined) {
      updateData.manualStartDate = parseResult.data.manualStartDate ? new Date(parseResult.data.manualStartDate) : null;
    }
    if (parseResult.data.manualEndDate !== undefined) {
      updateData.manualEndDate = parseResult.data.manualEndDate ? new Date(parseResult.data.manualEndDate) : null;
    }
    if (parseResult.data.notes !== undefined) updateData.notes = parseResult.data.notes;

    const [existing] = await db.select().from(jobLevelCycleTimes)
      .where(eq(jobLevelCycleTimes.id, String(req.params.entryId)));

    const [updated] = await db.update(jobLevelCycleTimes)
      .set(updateData)
      .where(eq(jobLevelCycleTimes.id, String(req.params.entryId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Programme entry not found" });
    }

    if (existing) {
      const changedFields: Record<string, { from: unknown; to: unknown }> = {};
      const trackKeys = ["cycleDays", "predecessorSequenceOrder", "relationship", "manualStartDate", "manualEndDate", "notes"];
      for (const key of trackKeys) {
        if (updateData[key] !== undefined) {
          const oldVal = (existing as Record<string, unknown>)[key];
          const newVal = updateData[key];
          const oldStr = oldVal instanceof Date ? oldVal.toISOString() : String(oldVal ?? "");
          const newStr = newVal instanceof Date ? newVal.toISOString() : String(newVal ?? "");
          if (oldStr !== newStr) {
            changedFields[key] = { from: oldVal ?? null, to: newVal ?? null };
          }
        }
      }
      if (Object.keys(changedFields).length > 0) {
        const entryLabel = existing.pourLabel ? `${existing.level} Pour ${existing.pourLabel}` : existing.level;
        const actionType = (changedFields.manualStartDate || changedFields.manualEndDate) ? "PROGRAMME_DATES_CHANGED" :
          (changedFields.predecessorSequenceOrder || changedFields.relationship) ? "PROGRAMME_PREDECESSOR_CHANGED" :
          "PROGRAMME_ENTRY_UPDATED";
        logJobChange(job.id, actionType, req.session?.userId || null, req.session?.name || null, {
          changedFields: { entryId: existing.id, entryLabel, ...changedFields },
        });
      }
    }

    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating programme entry");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update programme entry" });
  }
});

// POST /api/admin/jobs/:id/programme - Save job programme (bulk upsert)
router.post("/api/admin/jobs/:id/programme", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(String(req.params.id));
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }

    const entrySchema = z.object({
      id: z.string().optional(),
      buildingNumber: z.number().int().min(1),
      level: z.string().min(1),
      levelOrder: z.number(),
      pourLabel: z.string().nullable().optional(),
      sequenceOrder: z.number().int().min(0),
      cycleDays: z.number().int().min(1),
      predecessorSequenceOrder: z.number().int().nullable().optional(),
      relationship: z.enum(["FS", "SS", "FF", "SF"]).nullable().optional(),
      estimatedStartDate: z.string().nullable().optional().refine(v => !v || !isNaN(Date.parse(v)), "Invalid date"),
      estimatedEndDate: z.string().nullable().optional().refine(v => !v || !isNaN(Date.parse(v)), "Invalid date"),
      manualStartDate: z.string().nullable().optional().refine(v => !v || !isNaN(Date.parse(v)), "Invalid date"),
      manualEndDate: z.string().nullable().optional().refine(v => !v || !isNaN(Date.parse(v)), "Invalid date"),
      notes: z.string().nullable().optional(),
    });

    const bodySchema = z.object({ entries: z.array(entrySchema) });
    const parseResult = bodySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid programme data", details: parseResult.error.format() });
    }

    const entries = parseResult.data.entries.map(e => ({
      ...e,
      predecessorSequenceOrder: e.predecessorSequenceOrder ?? null,
      relationship: e.predecessorSequenceOrder != null ? (e.relationship || "FS") : null,
      estimatedStartDate: e.estimatedStartDate ? new Date(e.estimatedStartDate) : null,
      estimatedEndDate: e.estimatedEndDate ? new Date(e.estimatedEndDate) : null,
      manualStartDate: e.manualStartDate ? new Date(e.manualStartDate) : null,
      manualEndDate: e.manualEndDate ? new Date(e.manualEndDate) : null,
    }));

    const result = await storage.saveJobProgramme(String(req.params.id), entries);
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error saving job programme");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to save job programme" });
  }
});

// POST /api/admin/jobs/:id/programme/split - Split a level into pours
router.post("/api/admin/jobs/:id/programme/split", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(String(req.params.id));
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }

    const { entryId } = z.object({ entryId: z.string() }).parse(req.body);
    const result = await storage.splitProgrammeEntry(String(req.params.id), entryId);

    logJobChange(job.id, "PROGRAMME_LEVEL_SPLIT", req.session?.userId || null, req.session?.name || null, {
      changedFields: { entryId, newEntryCount: result.length },
    });

    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error splitting programme entry");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to split level" });
  }
});

// POST /api/admin/jobs/:id/programme/reorder - Reorder programme entries
router.post("/api/admin/jobs/:id/programme/reorder", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(String(req.params.id));
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }

    const { orderedIds } = z.object({ orderedIds: z.array(z.string()) }).parse(req.body);
    const result = await storage.reorderProgramme(String(req.params.id), orderedIds);

    logJobChange(job.id, "PROGRAMME_REORDERED", req.session?.userId || null, req.session?.name || null, {
      changedFields: { entriesReordered: orderedIds.length },
    });

    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error reordering programme");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to reorder programme" });
  }
});

// POST /api/admin/jobs/:id/programme/recalculate - Recalculate estimated dates using predecessor logic
router.post("/api/admin/jobs/:id/programme/recalculate", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(String(req.params.id));
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (!job.productionStartDate) {
      return res.status(400).json({ error: "Job must have a production start date configured to calculate programme dates" });
    }

    const entries = await storage.getJobProgramme(String(req.params.id));
    if (entries.length === 0) {
      return res.json([]);
    }

    const factoryWorkDays = await getFactoryWorkDays(job.factoryId ?? null, req.companyId);
    const baseDate = new Date(job.productionStartDate);
    const rangeEnd = new Date(baseDate);
    rangeEnd.setFullYear(rangeEnd.getFullYear() + 5);

    let cfmeuCalendarType: "VIC_ONSITE" | "VIC_OFFSITE" | "QLD" | null = null;
    if (job.factoryId) {
      const factoryData = await db.select().from(factories).where(eq(factories.id, job.factoryId));
      if (factoryData[0]?.cfmeuCalendar) {
        cfmeuCalendarType = factoryData[0].cfmeuCalendar;
      }
    }
    const holidays = await getCfmeuHolidaysInRange(cfmeuCalendarType, baseDate, rangeEnd);

    function ensureWorkDay(d: Date): Date {
      const result = new Date(d);
      while (!isWorkingDay(result, factoryWorkDays, holidays)) {
        result.setDate(result.getDate() + 1);
      }
      return result;
    }

    function nextWorkDay(d: Date): Date {
      const result = new Date(d);
      result.setDate(result.getDate() + 1);
      while (!isWorkingDay(result, factoryWorkDays, holidays)) {
        result.setDate(result.getDate() + 1);
      }
      return result;
    }

    function resolvePredecessorStart(
      predDates: { start: Date; end: Date },
      rel: string,
      cycleDays: number
    ): Date {
      let start: Date;
      switch (rel) {
        case "FS":
          start = nextWorkDay(predDates.end);
          break;
        case "SS":
          start = new Date(predDates.start);
          break;
        case "FF":
          start = subtractWorkingDays(new Date(predDates.end), cycleDays - 1, factoryWorkDays, holidays);
          break;
        case "SF":
          start = subtractWorkingDays(new Date(predDates.start), cycleDays - 1, factoryWorkDays, holidays);
          break;
        default:
          start = nextWorkDay(predDates.end);
      }
      return ensureWorkDay(start);
    }

    const projectStart = ensureWorkDay(new Date(job.productionStartDate));
    const resolvedDates = new Map<number, { start: Date; end: Date }>();

    const updatedEntries = entries.map((entry, idx) => {
      const cycleDays = entry.cycleDays || 1;
      const predOrder = entry.predecessorSequenceOrder;
      const rel = entry.relationship || "FS";
      let entryStart: Date;

      if (entry.manualStartDate) {
        entryStart = ensureWorkDay(new Date(entry.manualStartDate));
      } else if (predOrder != null && resolvedDates.has(predOrder)) {
        const predDates = resolvedDates.get(predOrder)!;
        entryStart = resolvePredecessorStart(predDates, rel, cycleDays);
      } else if (predOrder != null && !resolvedDates.has(predOrder)) {
        const prevEntry = idx > 0 ? resolvedDates.get(entries[idx - 1].sequenceOrder) : null;
        entryStart = prevEntry ? nextWorkDay(prevEntry.end) : new Date(projectStart);
        logger.warn({ entryId: entry.id, predOrder }, "Predecessor sequenceOrder not found, falling back");
      } else {
        const prevEntry = idx > 0 ? resolvedDates.get(entries[idx - 1].sequenceOrder) : null;
        entryStart = prevEntry ? nextWorkDay(prevEntry.end) : new Date(projectStart);
      }

      const entryEnd = entry.manualEndDate
        ? ensureWorkDay(new Date(entry.manualEndDate))
        : addWorkingDays(new Date(entryStart), cycleDays - 1, factoryWorkDays, holidays);

      resolvedDates.set(entry.sequenceOrder, { start: entryStart, end: entryEnd });

      return {
        ...entry,
        sequenceOrder: idx,
        estimatedStartDate: entryStart,
        estimatedEndDate: entryEnd,
      };
    });

    const result = await storage.saveJobProgramme(String(req.params.id), updatedEntries);

    logJobChange(job.id, "PROGRAMME_DATES_RECALCULATED", req.session?.userId || null, req.session?.name || null, {
      changedFields: { entriesRecalculated: updatedEntries.length },
    });

    res.json(result.sort((a, b) => a.sequenceOrder - b.sequenceOrder));
  } catch (error: unknown) {
    logger.error({ err: error }, "Error recalculating programme dates");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to recalculate dates" });
  }
});

// DELETE /api/admin/jobs/:id/programme/:entryId - Delete a programme entry
router.delete("/api/admin/jobs/:id/programme/:entryId", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(String(req.params.id));
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }
    const entryId = String(req.params.entryId);
    const result = await storage.deleteProgrammeEntry(String(req.params.id), entryId);

    logJobChange(job.id, "PROGRAMME_ENTRY_DELETED", req.session?.userId || null, req.session?.name || null, {
      changedFields: { entryId },
    });

    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting programme entry");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete programme entry" });
  }
});

// GET /api/admin/jobs/:id/production-slot-status - Get production slot status
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

// POST /api/admin/jobs/:id/rules - Create mapping rule
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

// DELETE /api/admin/mapping-rules/:id - Delete mapping rule
router.delete("/api/admin/mapping-rules/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const rule = await storage.getMappingRule(req.params.id as string);
  if (!rule || rule.companyId !== req.companyId) {
    return res.status(404).json({ error: "Mapping rule not found" });
  }
  await storage.deleteMappingRule(req.params.id as string);
  res.json({ ok: true });
});

// PUT /api/admin/jobs/:id/phase-status - Update job phase and/or status with audit logging
router.put("/api/admin/jobs/:id/phase-status", requireAuth, async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(req.params.id as string);
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }

    const schema = z.object({
      jobPhase: z.enum(JOB_PHASES as unknown as [string, ...string[]]).optional(),
      status: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const { jobPhase: newPhase, status: newStatus } = parsed.data;
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

      await db.update(jobs)
        .set({ status: newStatus as typeof jobs.status.enumValues[number], updatedAt: new Date() })
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

    return res.json(serializeJobPhase(job));
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating job phase/status");
    res.status(500).json({ error: "Failed to update job phase/status" });
  }
});

// GET /api/admin/jobs/:id/audit-log - Get job audit trail
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
      .limit(100);

    res.json(logs);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching job audit log");
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

// GET /api/admin/jobs/:id/members - Get job members
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
      .where(eq(jobMembers.jobId, jobId));

    res.json(members);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching job members");
    res.status(500).json({ error: "Failed to fetch job members" });
  }
});

// POST /api/admin/jobs/:id/members - Add a member to a job (and send invitation email)
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
      .where(and(eq(jobMembers.jobId, jobId), eq(jobMembers.userId, userId)));
    if (existing.length > 0) {
      return res.status(409).json({ error: "User is already a member of this job" });
    }

    const [member] = await db.insert(jobMembers).values({
      companyId: req.companyId!,
      jobId,
      userId,
      invitedBy: req.session.userId!,
    }).returning();

    // Send invitation email
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

// DELETE /api/admin/jobs/:id/members/:userId - Remove a member from a job
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

export const jobsRouter = router;
