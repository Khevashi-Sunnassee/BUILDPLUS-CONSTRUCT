import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { requireUUID } from "../../lib/api-utils";
import { db } from "../../db";
import { costCodes, costCodeDefaults, jobCostCodes, jobs } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

router.get("/api/cost-code-defaults/:jobTypeId", requireAuth, requirePermission("admin_cost_codes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobTypeId = requireUUID(req, res, "jobTypeId");
    if (!jobTypeId) return;

    const results = await db
      .select({
        id: costCodeDefaults.id,
        jobTypeId: costCodeDefaults.jobTypeId,
        costCodeId: costCodeDefaults.costCodeId,
        costCode: costCodes.code,
        costCodeName: costCodes.name,
        costCodeDescription: costCodes.description,
      })
      .from(costCodeDefaults)
      .innerJoin(costCodes, eq(costCodeDefaults.costCodeId, costCodes.id))
      .where(and(eq(costCodeDefaults.jobTypeId, jobTypeId), eq(costCodeDefaults.companyId, companyId)))
      .orderBy(asc(costCodes.sortOrder), asc(costCodes.code))
      .limit(1000);

    res.json(results);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching cost code defaults");
    res.status(500).json({ message: "Failed to fetch cost code defaults" });
  }
});

router.post("/api/cost-code-defaults", requireAuth, requirePermission("admin_cost_codes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { jobTypeId, costCodeIds } = z.object({
      jobTypeId: z.string().min(1),
      costCodeIds: z.array(z.string().min(1)),
    }).parse(req.body);

    await db.delete(costCodeDefaults).where(
      and(eq(costCodeDefaults.jobTypeId, jobTypeId), eq(costCodeDefaults.companyId, companyId))
    );

    if (costCodeIds.length > 0) {
      await db.insert(costCodeDefaults).values(
        costCodeIds.map((costCodeId) => ({
          companyId,
          jobTypeId,
          costCodeId,
        }))
      );
    }

    const results = await db
      .select({
        id: costCodeDefaults.id,
        jobTypeId: costCodeDefaults.jobTypeId,
        costCodeId: costCodeDefaults.costCodeId,
        costCode: costCodes.code,
        costCodeName: costCodes.name,
      })
      .from(costCodeDefaults)
      .innerJoin(costCodes, eq(costCodeDefaults.costCodeId, costCodes.id))
      .where(and(eq(costCodeDefaults.jobTypeId, jobTypeId), eq(costCodeDefaults.companyId, companyId)))
      .orderBy(asc(costCodes.sortOrder), asc(costCodes.code))
      .limit(1000);

    res.json(results);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error saving cost code defaults");
    res.status(500).json({ message: "Failed to save cost code defaults" });
  }
});

router.get("/api/jobs/:jobId/cost-codes", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = requireUUID(req, res, "jobId");
    if (!jobId) return;

    const results = await db
      .select({
        id: jobCostCodes.id,
        jobId: jobCostCodes.jobId,
        costCodeId: jobCostCodes.costCodeId,
        isDisabled: jobCostCodes.isDisabled,
        customName: jobCostCodes.customName,
        sortOrder: jobCostCodes.sortOrder,
        costCode: costCodes.code,
        costCodeName: costCodes.name,
        costCodeDescription: costCodes.description,
        isActive: costCodes.isActive,
      })
      .from(jobCostCodes)
      .innerJoin(costCodes, eq(jobCostCodes.costCodeId, costCodes.id))
      .where(and(eq(jobCostCodes.jobId, jobId), eq(jobCostCodes.companyId, companyId)))
      .orderBy(asc(jobCostCodes.sortOrder), asc(costCodes.code))
      .limit(1000);

    res.json(results);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching job cost codes");
    res.status(500).json({ message: "Failed to fetch job cost codes" });
  }
});

router.post("/api/jobs/:jobId/cost-codes/inherit", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = requireUUID(req, res, "jobId");
    if (!jobId) return;

    const [job] = await db
      .select({ id: jobs.id, jobTypeId: jobs.jobTypeId })
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)));

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (!job.jobTypeId) {
      return res.status(400).json({ message: "Job has no job type set - cannot inherit cost codes" });
    }

    const defaults = await db
      .select({ costCodeId: costCodeDefaults.costCodeId })
      .from(costCodeDefaults)
      .where(and(eq(costCodeDefaults.jobTypeId, job.jobTypeId), eq(costCodeDefaults.companyId, companyId)))
      .limit(1000);

    if (defaults.length === 0) {
      return res.status(400).json({ message: "No default cost codes defined for this job type" });
    }

    const existing = await db
      .select({ costCodeId: jobCostCodes.costCodeId })
      .from(jobCostCodes)
      .where(and(eq(jobCostCodes.jobId, jobId), eq(jobCostCodes.companyId, companyId)))
      .limit(1000);

    const existingSet = new Set(existing.map((e) => e.costCodeId));
    const newCodes = defaults.filter((d) => !existingSet.has(d.costCodeId));

    if (newCodes.length > 0) {
      await db.insert(jobCostCodes).values(
        newCodes.map((d, idx) => ({
          companyId,
          jobId,
          costCodeId: d.costCodeId,
          sortOrder: existing.length + idx,
        }))
      );
    }

    const results = await db
      .select({
        id: jobCostCodes.id,
        jobId: jobCostCodes.jobId,
        costCodeId: jobCostCodes.costCodeId,
        isDisabled: jobCostCodes.isDisabled,
        customName: jobCostCodes.customName,
        sortOrder: jobCostCodes.sortOrder,
        costCode: costCodes.code,
        costCodeName: costCodes.name,
        costCodeDescription: costCodes.description,
        isActive: costCodes.isActive,
      })
      .from(jobCostCodes)
      .innerJoin(costCodes, eq(jobCostCodes.costCodeId, costCodes.id))
      .where(and(eq(jobCostCodes.jobId, jobId), eq(jobCostCodes.companyId, companyId)))
      .orderBy(asc(jobCostCodes.sortOrder), asc(costCodes.code))
      .limit(1000);

    res.json({ inherited: newCodes.length, total: results.length, costCodes: results });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error inheriting cost codes");
    res.status(500).json({ message: "Failed to inherit cost codes" });
  }
});

router.post("/api/jobs/:jobId/cost-codes", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = requireUUID(req, res, "jobId");
    if (!jobId) return;
    const { costCodeId, customName, sortOrder } = z.object({
      costCodeId: z.string().min(1),
      customName: z.string().nullable().optional(),
      sortOrder: z.number().int().optional(),
    }).parse(req.body);

    const existing = await db
      .select()
      .from(jobCostCodes)
      .where(and(eq(jobCostCodes.jobId, jobId), eq(jobCostCodes.costCodeId, costCodeId)))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ message: "Cost code already assigned to this job" });
    }

    const [result] = await db
      .insert(jobCostCodes)
      .values({
        companyId,
        jobId,
        costCodeId,
        customName: customName || null,
        sortOrder: sortOrder ?? 0,
      })
      .returning();

    res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error adding job cost code");
    res.status(500).json({ message: "Failed to add job cost code" });
  }
});

router.patch("/api/jobs/:jobId/cost-codes/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = requireUUID(req, res, "id");
    if (!id) return;
    const data = z.object({
      isDisabled: z.boolean().optional(),
      customName: z.string().nullable().optional(),
      sortOrder: z.number().int().optional(),
    }).parse(req.body);

    const [result] = await db
      .update(jobCostCodes)
      .set(data)
      .where(and(eq(jobCostCodes.id, id), eq(jobCostCodes.companyId, companyId)))
      .returning();

    if (!result) {
      return res.status(404).json({ message: "Job cost code not found" });
    }
    res.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error updating job cost code");
    res.status(500).json({ message: "Failed to update job cost code" });
  }
});

router.delete("/api/jobs/:jobId/cost-codes/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [deleted] = await db
      .delete(jobCostCodes)
      .where(and(eq(jobCostCodes.id, id), eq(jobCostCodes.companyId, companyId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "Job cost code not found" });
    }
    res.json({ message: "Job cost code removed", id: deleted.id });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error removing job cost code");
    res.status(500).json({ message: "Failed to remove job cost code" });
  }
});

export default router;
