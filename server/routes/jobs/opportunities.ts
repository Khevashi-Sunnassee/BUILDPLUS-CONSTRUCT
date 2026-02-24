import { Router, Request, Response } from "express";
import { z } from "zod";
import { eq, and, inArray, desc, sql, count } from "drizzle-orm";
import { storage, db } from "../../storage";
import { jobs, customers, salesStatusHistory } from "@shared/schema";
import { requireAuth } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { SALES_STAGES, STAGE_STATUSES, getDefaultStatus, isValidStatusForStage } from "@shared/sales-pipeline";
import type { SalesStage } from "@shared/sales-pipeline";
import { intToPhase } from "@shared/job-phases";
import { serializeJobPhase, OPPORTUNITY_PHASES } from "./shared";

const router = Router();

router.get("/api/jobs/opportunities", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      return res.status(403).json({ error: "Company context required" });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    const whereClause = sql`(${inArray(jobs.jobPhase, [...OPPORTUNITY_PHASES])} OR ${eq(jobs.salesStage, 'AWARDED')}) AND ${eq(jobs.companyId, req.companyId)}`;

    const [{ total }] = await db
      .select({ total: count() })
      .from(jobs)
      .where(whereClause);

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
      submissionDate: jobs.submissionDate,
      comments: jobs.comments,
      jobPhase: jobs.jobPhase,
      jobTypeId: jobs.jobTypeId,
      createdAt: jobs.createdAt,
      updatedAt: jobs.updatedAt,
    })
    .from(jobs)
    .where(whereClause)
    .orderBy(desc(jobs.createdAt))
    .limit(limit)
    .offset(offset);

    const customerIds = [...new Set(result.filter(j => j.customerId).map(j => j.customerId!))];
    let customerMap = new Map<string, { id: string; name: string }>();
    if (customerIds.length > 0) {
      const custRows = await db.select({ id: customers.id, name: customers.name })
        .from(customers)
        .where(inArray(customers.id, customerIds))
        .limit(1000);
      for (const c of custRows) {
        customerMap.set(c.id, c);
      }
    }

    const enriched = result.map(j => ({
      ...j,
      jobPhase: intToPhase(j.jobPhase ?? 0),
      customerName: j.customerId ? customerMap.get(j.customerId)?.name || null : null,
    }));

    res.json({
      data: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching opportunities");
    res.status(500).json({ error: "Failed to fetch opportunities" });
  }
});

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
      submissionDate: z.string().optional().nullable(),
      comments: z.string().optional().nullable(),
      jobTypeId: z.string().max(36).optional().nullable(),
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
      submissionDate: parsed.data.submissionDate ? new Date(parsed.data.submissionDate) : null,
      comments: parsed.data.comments || null,
      jobTypeId: parsed.data.jobTypeId || null,
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
    res.status(400).json({ error: "An internal error occurred" });
  }
});

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
      submissionDate: z.string().optional().nullable(),
      comments: z.string().optional().nullable(),
      jobTypeId: z.string().max(36).optional().nullable(),
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
    if (updateData.submissionDate) {
      updateData.submissionDate = new Date(updateData.submissionDate);
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
    res.status(400).json({ error: "An internal error occurred" });
  }
});

router.get("/api/jobs/opportunities/:id/history", requireAuth, async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(String(req.params.id));
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Opportunity not found" });
    }

    const history = await db.select()
      .from(salesStatusHistory)
      .where(eq(salesStatusHistory.jobId, String(req.params.id)))
      .orderBy(desc(salesStatusHistory.createdAt))
      .limit(500);

    res.json(history);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching sales status history");
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

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
    res.status(500).json({ error: "An internal error occurred" });
  }
});

export default router;
