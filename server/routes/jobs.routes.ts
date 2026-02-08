import { Router, Request, Response } from "express";
import { z } from "zod";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { storage, db, getFactoryWorkDays, getCfmeuHolidaysInRange, subtractWorkingDays } from "../storage";
import { insertJobSchema, jobs, factories, customers, contracts, salesStatusHistory, jobAuditLogs } from "@shared/schema";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import logger from "../lib/logger";
import { SALES_STAGES, STAGE_STATUSES, getDefaultStatus, isValidStatusForStage } from "@shared/sales-pipeline";
import type { SalesStage } from "@shared/sales-pipeline";
import { JOB_PHASES, PHASE_ALLOWED_STATUSES, isValidStatusForPhase, canAdvanceToPhase, getDefaultStatusForPhase, intToPhase, phaseToInt } from "@shared/job-phases";
import type { JobPhase, JobStatus } from "@shared/job-phases";
import { logJobChange, logJobPhaseChange, logJobStatusChange } from "../services/job-audit.service";

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

function serializeJobPhase(job: any): any {
  if (!job) return job;
  return { ...job, jobPhase: intToPhase(job.jobPhase ?? 0) };
}

function serializeJobsPhase(jobsList: any[]): any[] {
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

    const data: any = {
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
    const updateData: any = { ...rest };
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
    const customer = await storage.createCustomer({ ...parsed.data, companyId: req.companyId } as any);
    res.json(customer);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating quick customer");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create customer" });
  }
});

// GET /api/projects - Legacy endpoint for backward compatibility
router.get("/api/projects", requireAuth, async (req: Request, res: Response) => {
  const jobsList = await storage.getAllJobs(req.companyId);
  res.json(jobsList.map(j => ({ id: j.id, name: j.name, code: j.code || j.jobNumber })));
});

// GET /api/jobs - Get all jobs (active only, for general use)
router.get("/api/jobs", requireAuth, async (req: Request, res: Response) => {
  const allJobs = await storage.getAllJobs(req.companyId);
  const serialized = serializeJobsPhase(allJobs);
  if (req.query.status === "ACTIVE") {
    res.json(serialized.filter((j: any) => j.status === "ACTIVE"));
  } else {
    res.json(serialized);
  }
});

// GET /api/jobs/:jobId - Get single job for authenticated users
router.get("/api/jobs/:jobId", requireAuth, async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(req.params.jobId as string);
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
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

// GET /api/admin/jobs - Get all jobs (for admin)
router.get("/api/admin/jobs", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const allJobs = await storage.getAllJobs(req.companyId);
  res.json(serializeJobsPhase(allJobs));
});

// GET /api/admin/jobs/:id - Get single job
router.get("/api/admin/jobs/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const job = await storage.getJob(req.params.id as string);
  if (!job || job.companyId !== req.companyId) {
    return res.status(404).json({ error: "Job not found" });
  }
  res.json(serializeJobPhase(job));
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
    const data = { ...parsed.data, companyId: req.companyId } as any;
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
    const globalSettings = await storage.getGlobalSettings();
    if (data.procurementDaysInAdvance !== undefined && data.procurementDaysInAdvance !== null) {
      const val = parseInt(data.procurementDaysInAdvance, 10);
      if (isNaN(val) || val < 1) {
        return res.status(400).json({ error: "procurementDaysInAdvance must be a positive number" });
      }
      const ifcDays = data.daysInAdvance ?? globalSettings?.ifcDaysInAdvance ?? 14;
      if (val >= ifcDays) {
        return res.status(400).json({ error: `procurementDaysInAdvance must be less than IFC days in advance (${ifcDays})` });
      }
      data.procurementDaysInAdvance = val;
    }
    if (data.procurementTimeDays !== undefined && data.procurementTimeDays !== null) {
      const val = parseInt(data.procurementTimeDays, 10);
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
      newStatus: data.status,
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
    if (data.daysToAchieveIfc !== undefined && data.daysToAchieveIfc !== null) {
      const val = parseInt(data.daysToAchieveIfc, 10);
      if (isNaN(val) || val < 1) {
        return res.status(400).json({ error: "daysToAchieveIfc must be a positive number" });
      }
      data.daysToAchieveIfc = val;
    }
    if (data.productionWindowDays !== undefined && data.productionWindowDays !== null) {
      const val = parseInt(data.productionWindowDays, 10);
      if (isNaN(val) || val < 1) {
        return res.status(400).json({ error: "productionWindowDays must be a positive number" });
      }
      data.productionWindowDays = val;
    }
    if (data.productionDaysInAdvance !== undefined && data.productionDaysInAdvance !== null) {
      const val = parseInt(data.productionDaysInAdvance, 10);
      if (isNaN(val) || val < 1) {
        return res.status(400).json({ error: "productionDaysInAdvance must be a positive number" });
      }
      data.productionDaysInAdvance = val;
    }
    const globalSettings = await storage.getGlobalSettings();
    
    if (data.daysInAdvance !== undefined && data.daysInAdvance !== null) {
      const newIfcDays = parseInt(data.daysInAdvance, 10);
      const effectiveProcurementDays = data.procurementDaysInAdvance ?? existingJob?.procurementDaysInAdvance ?? globalSettings?.procurementDaysInAdvance ?? 7;
      if (!isNaN(newIfcDays) && newIfcDays <= effectiveProcurementDays) {
        return res.status(400).json({ error: `daysInAdvance must be greater than procurementDaysInAdvance (${effectiveProcurementDays})` });
      }
    }
    
    if (data.procurementDaysInAdvance !== undefined && data.procurementDaysInAdvance !== null) {
      const val = parseInt(data.procurementDaysInAdvance, 10);
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
      const val = parseInt(data.procurementTimeDays, 10);
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

    const changedFields: Record<string, any> = {};
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

      const updateData: any = { jobPhase: deserializePhase(targetPhase), updatedAt: new Date() };
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

export const jobsRouter = router;
